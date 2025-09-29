import { App, TFile, Notice, Workspace, normalizePath } from 'obsidian';
import { VCardForObsidianRecord } from '../vcardFile';
import { Contact } from '../contactNote';
import { FileExistsModal } from '../../ui/modals/fileExistsModal';
import { insightService } from '../../insights/insightService';
import { RunType } from '../../insights/insight.d';

/**
 * Utility functions for contact operations that don't require instance state.
 * These are commonly used across the application for contact management.
 */
export class ContactManagerUtils {
  /**
   * Create a contact file in the specified folder with the given content
   */
  static async createContactFile(app: App, folderPath: string, content: string, filename: string): Promise<void> {
    const folder = app.vault.getAbstractFileByPath(folderPath !== '' ? folderPath : '/');
    if (!folder) {
      new Notice(`Can not find path: '${folderPath}'. Please update "Contacts" plugin settings`);
      return;
    }
    const activeFile = app.workspace.getActiveFile();
    const parentFolder = activeFile?.parent; // Get the parent folder if it's a file

    const fileJoin = (...parts: string[]): string => {
      return parts
        .filter(Boolean)
        .join("/")
        .replace(/\/{2,}/g, "/")
        .replace(/\/+$/, "");
    };

    if (parentFolder?.path?.contains(folderPath)) {
      const filePath = normalizePath(fileJoin(parentFolder.path, filename));
      await ContactManagerUtils.handleFileCreation(app, filePath, content);
    } else {
      const filePath = normalizePath(fileJoin(folderPath, filename));
      await ContactManagerUtils.handleFileCreation(app, filePath, content);
    }
  }

  /**
   * Handle file creation with conflict resolution
   */
  static async handleFileCreation(app: App, filePath: string, content: string): Promise<void> {
    const fileExists = await app.vault.adapter.exists(filePath);

    if (fileExists) {
      new FileExistsModal(app, filePath, async (action: "replace" | "skip") => {
        if (action === "skip") {
          new Notice("File creation skipped.");
          return;
        }

        if (action === "replace") {
          await app.vault.adapter.write(filePath, content);
          ContactManagerUtils.openCreatedFile(app, filePath);
          new Notice(`File overwritten.`);
        }
      }).open();
    } else {
      const createdFile = await app.vault.create(filePath, content);
      await new Promise(r => setTimeout(r, 50));
      const contact = await ContactManagerUtils.getFrontmatterFromFiles(app, [createdFile]);
      await insightService.process(contact, RunType.IMMEDIATELY);
      ContactManagerUtils.openFile(app, createdFile);
    }
  }

  /**
   * Open a file in the workspace
   */
  static async openFile(app: App, file: TFile, workspace?: Workspace): Promise<void> {
    const ws = workspace || app.workspace;
    const leaf = ws.getLeaf();
    await leaf.openFile(file, { active: true });
  }

  /**
   * Open a created file by path
   */
  static openCreatedFile(app: App, filePath: string): void {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      ContactManagerUtils.openFile(app, file);
    }
  }

  /**
   * Ensure a vCard object has the necessary name information
   */
  static async ensureHasName(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
    const { createNameSlug } = await import('../contactNote');
    const { VCardKinds } = await import('../vcardFile');
    const { ContactNameModal } = await import('../../ui/modals/contactNameModal');
    const { getApp } = await import('../../context/sharedAppContext');
    
    // Import the type separately
    type NamingPayload = import('../../ui/modals/contactNameModal').NamingPayload;
    
    try {
      // if we can create a file name then we meet the minimum requirements
      createNameSlug(vCardObject);
      return Promise.resolve(vCardObject);
    } catch (error) {
      // Need to prompt for some form of name information.
      const app = getApp();
      return new Promise((resolve) => {
        console.warn("No name found for record", vCardObject);
        new ContactNameModal(app, (nameData: NamingPayload) => {
          if (nameData.kind === VCardKinds.Individual) {
            vCardObject["N.PREFIX"] ??= "";
            vCardObject["N.GN"] = nameData.given;
            vCardObject["N.MN"] ??= "";
            vCardObject["N.FN"] = nameData.family;
            vCardObject["N.SUFFIX"] ??= "";
          } else {
            vCardObject["FN"] ??= nameData.fn;
          }
          vCardObject["KIND"] ??= nameData.kind;
          resolve(vCardObject);
        }).open();
      });
    }
  }

  /**
   * Get frontmatter data from multiple files and create Contact objects
   */
  static async getFrontmatterFromFiles(app: App, files: TFile[]): Promise<Contact[]> {
    const contactsData: Contact[] = [];
    for (const file of files) {
      const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter;
      if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
        contactsData.push({
          file: file,
          data: frontMatter
        });
      }
    }
    return contactsData;
  }
}