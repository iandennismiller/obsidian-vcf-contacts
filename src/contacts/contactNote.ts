import { parseYaml, stringifyYaml, TFile, App, Notice, normalizePath, Platform, TFile as ObsidianTFile, TFolder, Vault, Workspace } from 'obsidian';
import { FileExistsModal } from 'src/ui/modals/fileExistsModal';
import { insightService } from 'src/insights/insightService';
import { RunType } from 'src/insights/insight.d';
import { extractRelationshipType, parseRelatedValue } from 'src/contacts/relatedFieldUtils';
import { getGenderedRelationshipTerm, type Gender } from 'src/contacts/genderUtils';
import { createNameSlug } from 'src/util/nameUtils';
import { getSettings } from 'src/context/sharedSettingsContext';

/**
 * A single class that provides an interface for interacting with an Obsidian contact note.
 * This consolidates utilities previously spread across contactMdTemplate, contactFrontmatter,
 * contactDataKeys and some file helpers.
 */
export class ContactNote {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /* ---------------------- frontmatter helpers ---------------------- */
  generateRevTimestamp(): string {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  async getFrontmatterFromFiles(files: TFile[]) {
    const { metadataCache } = this.app;
    const contactsData: { file: TFile; data: Record<string, any> }[] = [];
    for (const file of files) {
      const frontMatter = metadataCache.getFileCache(file)?.frontmatter;
      if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
        contactsData.push({ file, data: frontMatter });
      }
    }
    return contactsData;
  }

  async updateFrontMatterValue(
    file: TFile,
    key: string,
    value: string,
    app?: App,
    skipRevUpdate?: boolean
  ) {
    const appInstance = app || this.app;
    const content = await appInstance.vault.read(file);

    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

    let yamlObj: any = {};
    let body = content;

    if (match) {
      yamlObj = parseYaml(match[1]) || {};
      body = content.slice(match[0].length);
    }

    const currentValue = yamlObj[key];
    if (currentValue === value) return; // no change

    yamlObj[key] = value;

    if (!skipRevUpdate && key !== 'REV') {
      yamlObj['REV'] = this.generateRevTimestamp();
    }

    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    await appInstance.vault.modify(file, newContent);
  }

  async updateMultipleFrontMatterValues(
    file: TFile,
    updates: Record<string, string>,
    app?: App,
    skipRevUpdate?: boolean
  ) {
    const appInstance = app || this.app;
    const content = await appInstance.vault.read(file);

    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

    let yamlObj: any = {};
    let body = content;

    if (match) {
      yamlObj = parseYaml(match[1]) || {};
      body = content.slice(match[0].length);
    }

    let hasChanges = false;
    for (const [key, value] of Object.entries(updates)) {
      const currentValue = yamlObj[key];
      if (currentValue !== value) {
        yamlObj[key] = value;
        hasChanges = true;
      }
    }

    if (!hasChanges) return;

    if (!skipRevUpdate && !('REV' in updates)) {
      yamlObj['REV'] = this.generateRevTimestamp();
    }

    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    await appInstance.vault.modify(file, newContent);
  }

  /* ---------------------- vCard / md rendering helpers ---------------------- */
  private extractBaseKey(key: string): string {
    if (key.includes('[')) {
      return key.split('[')[0];
    } else if (key.includes('.')) {
      return key.split('.')[0];
    }
    return key;
  }

  private groupVCardFields(record: Record<string, any>) {
    const nameKeys = ['N', 'FN'];
    const priorityKeys = [
      'EMAIL', 'TEL', 'BDAY','URL',
      'ORG', 'TITLE', 'ROLE', 'PHOTO', 'RELATED', 'GENDER'
    ];
    const adrKeys = ['ADR'];

    const groups:{
      name: { [key: string]: any };
      priority: { [key: string]: any };
      address: { [key: string]: any };
      other: { [key: string]: any };
    } = { name: {}, priority: {}, address: {}, other: {} };

    Object.entries(record).forEach(([key, value]) => {
      const baseKey = this.extractBaseKey(key);

      if (nameKeys.includes(baseKey)) {
        groups.name[key] = value;
      } else if (priorityKeys.includes(baseKey)) {
        groups.priority[key] = value;
      } else if (adrKeys.includes(baseKey)) {
        groups.address[key] = value;
      } else {
        groups.other[key] = value;
      }
    });

    return groups;
  }

  private sortNameItems(record: Record<string, any>)  {
    const nameSortOrder = ['N.PREFIX', 'N.GN', 'N.MN', 'N.FN', 'N.SUFFIX', 'FN'];
    return Object.fromEntries(
      Object.entries(record).sort(([keyA], [keyB]) => {
        return nameSortOrder.indexOf(keyA) - nameSortOrder.indexOf(keyB);
      })
    );
  }

  private sortedPriorityItems(record: Record<string, any>)  {
    const priorityKeys = [
      'EMAIL', 'TEL', 'BDAY','URL',
      'ORG', 'TITLE', 'ROLE', 'PHOTO', 'RELATED', 'GENDER'
    ];
    return Object.fromEntries(
      Object.entries(record).sort(([keyA], [keyB]) => {
        const baseKeyA = this.extractBaseKey(keyA);
        const baseKeyB = this.extractBaseKey(keyB);
        return priorityKeys.indexOf(baseKeyA) - priorityKeys.indexOf(baseKeyB);
      })
    );
  }

  private generateRelatedList(record: Record<string, any>, genderLookup?: (contactRef: string) => Gender): string {
    const relatedFields = Object.entries(record).filter(([key]) => 
      this.extractBaseKey(key) === 'RELATED'
    );
    if (relatedFields.length === 0) return '';

    const relationships: { type: string; contact: string; displayType: string }[] = [];

    relatedFields.forEach(([key, value]) => {
      const type = extractRelationshipType(key);
      let contact = '';
      if (typeof value === 'string') {
        const parsed = parseRelatedValue(value);
        if (parsed) contact = parsed.value; else contact = value;
      }

      let displayType = type;
      if (genderLookup) {
        try {
          const contactGender = genderLookup(contact);
          displayType = getGenderedRelationshipTerm(type, contactGender);
        } catch {
          displayType = type;
        }
      }

      relationships.push({ type, contact, displayType });
    });

    relationships.sort((a, b) => {
      if (a.displayType !== b.displayType) return a.displayType.localeCompare(b.displayType);
      return a.contact.localeCompare(b.contact);
    });

    const listItems = relationships.map(rel => `- ${rel.displayType} [[${rel.contact}]]`).join('\n');
    return `\n## Related\n${listItems}\n`;
  }

  mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
    const { NOTE, ...recordWithoutNote } = record;
    const groups = this.groupVCardFields(recordWithoutNote);
    const myNote = NOTE ? NOTE.replace(/\\n/g, `\n`) : '';
    let additionalTags = '';
    if (recordWithoutNote.CATEGORIES) {
      const tempTags = recordWithoutNote.CATEGORIES.split(',');
      additionalTags = `#${tempTags.join(' #')}`;
    }

    const frontmatter = {
      ...this.sortNameItems(groups.name),
      ...this.sortedPriorityItems(groups.priority),
      ...groups.address,
      ...groups.other
    };

    const relatedSection = this.generateRelatedList(recordWithoutNote, genderLookup);

    return `---\n${stringifyYaml(frontmatter)}---\n#### Notes\n${myNote}\n${relatedSection}\n${hashtags} ${additionalTags}\n`;
  }

  /* ---------------------- data-key parsing (from contactDataKeys) ---------------------- */
  exportParseKey(input: string) {
    return ContactNote.parseKey(input);
  }

  static parseKey(input: string) {
    function extractSubkey(input: string): { main: string; subkey?: string } {
      const dotIndex = input.indexOf('.');
      if (dotIndex === -1) return { main: input, subkey: '' };
      return { main: input.substring(0, dotIndex), subkey: input.substring(dotIndex + 1) };
    }

    function parseBracketContent(content: string): { index?: string; type?: string } {
      if (content.includes(':')) {
        const [index, type] = content.split(':');
        return { index, type };
      }
      return { type: content };
    }

    function parseKeyPart(main: string): { key: string; index?: string; type?: string } {
      const openBracketIndex = main.indexOf('[');
      if (openBracketIndex === -1) return { key: main };
      const key = main.substring(0, openBracketIndex);
      const closeBracketIndex = main.indexOf(']', openBracketIndex);
      if (closeBracketIndex === -1) throw new Error('Invalid vcard property key encountered please correct.');
      const bracketContent = main.substring(openBracketIndex + 1, closeBracketIndex);
      const { index, type } = parseBracketContent(bracketContent);
      return { key, index, type };
    }

    const { main, subkey } = extractSubkey(input);
    const { key, index, type } = parseKeyPart(main);
    return { key, index, type, subkey };
  }

  /* ---------------------- small file utilities ---------------------- */
  fileId(file: TFile): string {
    let hash = 0;
    for (let i = 0; i < file.path.length; i++) {
      hash = (hash << 5) - hash + file.path.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString();
  }

  fileJoin(...parts: string[]): string {
    return parts
      .filter(Boolean)
      .join('/')
      .replace(/\/{2,}/g, '/')
      .replace(/\/+$/, '');
  }

  createFileName(records: Record<string, string>) {
    const nameSlug = createNameSlug(records);
    if (!nameSlug) {
      console.error('No name found for record', records);
      throw new Error('No name found for record');
    }
    return nameSlug + '.md';
  }

  isFileInFolder(file: TFile) {
    const settings = getSettings();
    return file.path.startsWith(settings.contactsFolder);
  }

  /**
   * Extract UID from a contact file's frontmatter.
   * Tries metadata cache first then falls back to direct file read.
   */
  async extractUIDFromFile(file: TFile): Promise<string | null> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      if (uid) return uid;

      try {
        const content = await this.app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatterText = frontmatterMatch[1];
          const uidMatch = frontmatterText.match(/^UID:\s*(.+)$/m);
          if (uidMatch) return uidMatch[1].trim();
        }
      } catch (readError) {
        // ignore
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a file is a contact file based on contacts folder and UID in frontmatter
   */
  isContactFile(file: TFile, contactsFolder?: string): boolean {
    if (!file) return false;
    const folder = contactsFolder || getSettings().contactsFolder || '/';
    if (folder !== '/' && !file.path.startsWith(folder)) return false;
    const cache = this.app.metadataCache.getFileCache(file);
    const uid = cache?.frontmatter?.UID;
    return uid != null;
  }
}

export type Contact = {
  data: Record<string, any>;
  file: TFile;
}

// --- Backwards-compatible exported helpers (replace previous modules) ---

// mdRender wrapper
export function mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender) {
  // create a temporary ContactNote using the global app if available
  // Note: tests pass an App into methods that need it; callers in runtime provide app
  // For safety, attempt to use shared app context when available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getApp } = require('src/context/sharedAppContext');
  const app: App = getApp();
  return new ContactNote(app).mdRender(record, hashtags, genderLookup);
}

export function findContactFiles(contactsFolder: TFolder) {
  const contactFiles: TFile[] = [];
  Vault.recurseChildren(contactsFolder, async (contactNote) => {
    if (contactNote instanceof ObsidianTFile) {
      contactFiles.push(contactNote);
    }
  });
  return contactFiles;
}

export async function getFrontmatterFromFiles(files: TFile[]) {
  const app = require('src/context/sharedAppContext').getApp();
  return new ContactNote(app).getFrontmatterFromFiles(files);
}

export async function updateFrontMatterValue(file: TFile, key: string, value: string, app?: App, skipRevUpdate?: boolean) {
  const appInstance = app || require('src/context/sharedAppContext').getApp();
  return new ContactNote(appInstance).updateFrontMatterValue(file, key, value, appInstance, skipRevUpdate);
}

export async function updateMultipleFrontMatterValues(file: TFile, updates: Record<string, string>, app?: App, skipRevUpdate?: boolean) {
  const appInstance = app || require('src/context/sharedAppContext').getApp();
  return new ContactNote(appInstance).updateMultipleFrontMatterValues(file, updates, appInstance, skipRevUpdate);
}

export function generateRevTimestamp() {
  return new ContactNote(require('src/context/sharedAppContext').getApp()).generateRevTimestamp();
}

export function parseKey(input: string) {
  return ContactNote.parseKey(input);
}

// File helper wrappers (migrated from src/file/file.ts)
export async function openFile(file: TFile, workspace: Workspace) {
  const leaf = workspace.getLeaf();
  await leaf.openFile(file, { active: true });
}

export function fileId(file: TFile): string {
  return new ContactNote(require('src/context/sharedAppContext').getApp()).fileId(file);
}

export function fileJoin(...parts: string[]) {
  return new ContactNote(require('src/context/sharedAppContext').getApp()).fileJoin(...parts);
}

export async function openFilePicker(type: string): Promise<string | Blob> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type;
    input.style.display = 'none';

    input.addEventListener('change', () => {
      if (input?.files && input.files.length > 0) {
        const file = input.files[0];

        const isImage = type === 'image/*' || type.startsWith('image/');
        if (isImage) {
          resolve(file);
        } else {
          const reader = new FileReader();
          reader.onload = function (event) {
            const rawData = event?.target?.result || '';
            if (typeof rawData === 'string') {
              resolve(rawData);
            } else {
              resolve(new TextDecoder('utf-8').decode(rawData));
            }
          };
          reader.readAsText(file, 'UTF-8');
        }
      } else {
        resolve('');
      }
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

export function saveVcardFilePicker(data: string, obsidianFile?: TFile) {
  try {
    const file = new Blob([data], { type: 'text/vcard' });
    const filename = obsidianFile ? obsidianFile.basename.replace(/ /g, '-') + '.vcf' : 'shared-contacts.vcf';
    const fileObject = new File([file], filename, { type: 'text/vcard' });

    // @ts-ignore
    if (Platform.isMobileApp && (window as any).Capacitor && typeof (window as any).Capacitor.Plugins.Filesystem.open === 'function') {
      (async () => {
        try {
          // @ts-ignore
          await (window as any).Capacitor.Plugins.Filesystem.writeFile({
            path: filename,
            data,
            directory: 'DOCUMENTS',
            encoding: 'utf8'
          });
          if (Platform.isAndroidApp) {
            new Notice(`Saved to /Documents on device:\n${filename}\nOpen the Files app to share with other applications`);
          } else {
            new Notice(`` +
              `\`Saved to your device's Files app under this app:\n${filename}\nOpen the Files app to share with other applications`);
          }
        } catch (e) {
          console.log(e);
        }
      })();

    } else {
      const element = document.createElement('a');
      element.href = URL.createObjectURL(fileObject);
      element.download = filename;
      element.click();
    }

  } catch (err) {
    console.log('Failed to share or save VCard', err);
  }
}

export function createFileName(records: Record<string, string>) {
  return new ContactNote(require('src/context/sharedAppContext').getApp()).createFileName(records);
}

export function isFileInFolder(file: TFile) {
  return new ContactNote(require('src/context/sharedAppContext').getApp()).isFileInFolder(file);
}

async function openCreatedFile(app: App, filePath: string) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (file instanceof ObsidianTFile) {
    const workspace: Workspace = app.workspace as Workspace;
    const leaf = workspace.getLeaf();
    // @ts-ignore
    await leaf.openFile(file, { active: true });
  }
}

async function handleFileCreation(app: App, filePath: string, content: string) {
  const fileExists = await app.vault.adapter.exists(filePath);

  if (fileExists) {
    new FileExistsModal(app, filePath, async (action: 'replace' | 'skip') => {
      if (action === 'skip') {
        new Notice('File creation skipped.');
        return;
      }

      if (action === 'replace') {
        await app.vault.adapter.write(filePath, content);
        await openCreatedFile(app, filePath);
        new Notice(`File overwritten.`);
      }
    }).open();
  } else {
    const createdFile = await app.vault.create(filePath, content);
    await new Promise(r => setTimeout(r, 50));
    const contact= await new ContactNote(app).getFrontmatterFromFiles([createdFile]);
    await insightService.process(contact, RunType.IMMEDIATELY);
    await openCreatedFile(app, filePath);
  }
}

export function createContactFile(
  app: App,
  folderPath: string,
  content: string,
  filename: string
) {
  const folder = app.vault.getAbstractFileByPath(folderPath !== '' ? folderPath : '/') ;
  if (!folder) {
    new Notice(`Can not find path: '${folderPath}'. Please update "Contacts" plugin settings`);
    return;
  }
  const activeFile = app.workspace.getActiveFile();
  const parentFolder = activeFile?.parent;

  if (parentFolder?.path?.includes(folderPath)) {
    const filePath = normalizePath(fileJoin(parentFolder.path, filename));
    handleFileCreation(app, filePath, content);
  } else {
    const filePath = normalizePath(fileJoin(folderPath, filename));
    handleFileCreation(app, filePath, content);
  }
}
