import { App, TFile, Notice, Workspace, normalizePath } from 'obsidian';
import { VCardForObsidianRecord } from '../vcardFile';
import { Contact } from '../contactNote';
import { FileExistsModal } from '../../ui/modals/fileExistsModal';
import { curatorService } from '../curatorManager/curatorManager';
import { RunType } from '../../interfaces/curatorManager.d';

/**
 * Utility functions for contact operations that don't require instance state.
 * These are commonly used across the application for contact management.
 */
export class ContactManagerUtils {
  /**
   * Create a contact file in the specified folder with the given content
   */
  static async createContactFile(app: App, folderPath: string, content: string, filename: string): Promise<void> {
    try {
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

      if (parentFolder?.path?.includes(folderPath)) {
        const filePath = normalizePath(fileJoin(parentFolder.path, filename));
        await ContactManagerUtils.handleFileCreation(app, filePath, content);
      } else {
        const filePath = normalizePath(fileJoin(folderPath, filename));
        await ContactManagerUtils.handleFileCreation(app, filePath, content);
      }
    } catch (error) {
      console.error('Error creating contact file:', error);
      new Notice('Failed to create contact file');
    }
  }

  /**
   * Handle file creation with conflict resolution
   */
  static async handleFileCreation(app: App, filePath: string, content: string): Promise<void> {
    try {
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
        await curatorService.process(contact, RunType.IMMEDIATELY);
        ContactManagerUtils.openFile(app, createdFile);
      }
    } catch (error) {
      console.error('Error handling file creation:', error);
      new Notice('Failed to handle file creation');
    }
  }

  /**
   * Open a file in the workspace
   */
  static async openFile(app: App, file: TFile, workspace?: Workspace): Promise<void> {
    const ws = workspace || app.workspace;
    const currentFile = ws.getActiveFile();
    
    // Don't open if the file is already active
    if (currentFile && currentFile.path === file.path) {
      return;
    }
    
    // Use openLinkText for navigation
    const filename = file.basename + '.md';
    const sourcePath = currentFile ? currentFile.path : '';
    await ws.openLinkText(filename, sourcePath);
  }

  /**
   * Open a created file by path or TFile
   */
  static async openCreatedFile(app: App, fileOrPath: string | TFile): Promise<void> {
    try {
      let file: TFile | null = null;
      
      if (typeof fileOrPath === 'string') {
        const abstractFile = app.vault.getAbstractFileByPath(fileOrPath);
        if (abstractFile instanceof TFile) {
          file = abstractFile;
        }
      } else {
        file = fileOrPath;
      }
      
      if (file) {
        const leaf = app.workspace.getLeaf();
        await leaf.openFile(file, { active: true });
      }
    } catch (error) {
      console.error('Error opening created file:', error);
    }
  }

  /**
   * Ensure a vCard object has the necessary name information
   */
  static async ensureHasName(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
    const { createNameSlug } = await import('../contactNote');
    const { VCardKinds } = await import('../vcardFile');
    
    try {
      // if we can create a file name then we meet the minimum requirements
      createNameSlug(vCardObject);
      return Promise.resolve(vCardObject);
    } catch (error) {
      // Add a default name if none exists
      if (!vCardObject.FN && !vCardObject["N.GN"] && !vCardObject["N.FN"]) {
        vCardObject.FN = "Unnamed Contact";
      }
      
      // If we have name components but no FN, construct it
      if (!vCardObject.FN && (vCardObject["N.GN"] || vCardObject["N.FN"])) {
        const nameParts = [
          vCardObject["N.PREFIX"],
          vCardObject["N.GN"],
          vCardObject["N.MN"], 
          vCardObject["N.FN"],
          vCardObject["N.SUFFIX"]
        ].filter(part => part && part.trim()).join(" ");
        
        vCardObject.FN = nameParts || "Unnamed Contact";
      }
      
      return Promise.resolve(vCardObject);
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