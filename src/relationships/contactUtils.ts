import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { loggingService } from '../services/loggingService';

/**
 * Centralized utilities for contact file detection and management
 */
export class ContactUtils {
  private app: App;
  private settings: ContactsPluginSettings;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Get the effective contacts folder path (same logic as VcfFolderWatcher)
   */
  private getContactsFolder(): string {
    return this.settings.contactsFolder || '/';
  }

  /**
   * Extract UID from a file using metadata cache (reuses VcfFolderWatcher pattern)
   */
  extractUIDFromFile(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const uid = cache?.frontmatter?.UID;
    return uid || null;
  }

  /**
   * Check if a file is a contact file based on plugin settings and UID presence
   */
  isContactFile(file: TFile | null): boolean {
    if (!file) return false;
    
    // First check if it has a UID in front matter (regardless of location)
    const hasUID = !!this.extractUIDFromFile(file);
    if (hasUID) {
      return true;
    }
    
    // Use same folder logic as VcfFolderWatcher for consistency
    const contactsFolder = this.getContactsFolder();
    
    // For vault root or legacy setups, check common folder patterns
    if (contactsFolder === '/' || contactsFolder === '') {
      return file.path.includes('Contacts/') || file.path.includes('contacts/');
    }
    
    // Check if file is in the configured contacts folder with proper folder boundary matching
    const normalizedFolder = contactsFolder.endsWith('/') ? contactsFolder : contactsFolder + '/';
    return file.path.startsWith(normalizedFolder);
  }

  /**
   * Get all contact files from the vault using Obsidian API (with logging like VcfFolderWatcher)
   */
  getAllContactFiles(): TFile[] {
    const allMarkdownFiles = this.app.vault.getMarkdownFiles();
    loggingService.debug(`[ContactUtils] Total markdown files in vault: ${allMarkdownFiles.length}`);
    
    // Enhanced logging to debug contact detection
    const contactsFolder = this.getContactsFolder();
    loggingService.debug(`[ContactUtils] Using contacts folder: "${contactsFolder}"`);
    
    const contactFiles: TFile[] = [];
    const debugInfo: string[] = [];
    
    for (const file of allMarkdownFiles) {
      const isContact = this.isContactFile(file);
      if (isContact) {
        contactFiles.push(file);
        const uid = this.extractUIDFromFile(file);
        debugInfo.push(`  - ${file.path} (UID: ${uid || 'path-based'})`);
      }
    }
    
    loggingService.debug(`[ContactUtils] Contact files found: ${contactFiles.length}`);
    if (debugInfo.length > 0 && debugInfo.length <= 10) {
      loggingService.debug(`[ContactUtils] Contact files:\n${debugInfo.join('\n')}`);
    } else if (debugInfo.length > 10) {
      loggingService.debug(`[ContactUtils] First 5 contact files:\n${debugInfo.slice(0, 5).join('\n')}\n  ... and ${debugInfo.length - 5} more`);
    }
    
    if (contactFiles.length === 0) {
      loggingService.warning(`[ContactUtils] No contact files found. Contacts folder: "${contactsFolder}". Check folder setting or ensure files have UIDs in front matter.`);
      
      // Additional debugging: show sample files
      const sampleFiles = allMarkdownFiles.slice(0, 5);
      const sampleInfo = sampleFiles.map(f => {
        const uid = this.extractUIDFromFile(f);
        return `  - ${f.path} (UID: ${uid || 'none'})`;
      });
      loggingService.debug(`[ContactUtils] Sample files from vault:\n${sampleInfo.join('\n')}`);
    }
    
    return contactFiles;
  }

  /**
   * Get all contact files from a specific folder using Obsidian API (reuses VcfFolderWatcher pattern)
   */
  getContactFilesFromFolder(folderPath?: string): TFile[] {
    const targetFolder = folderPath || this.getContactsFolder();
    
    if (!targetFolder || targetFolder === '/') {
      // If no specific folder, return all contact files
      return this.getAllContactFiles();
    }

    // Use same filtering approach as VcfFolderWatcher
    const files = this.app.vault.getMarkdownFiles().filter(file => {
      return file.path.startsWith(targetFolder) && this.isContactFile(file);
    });

    loggingService.debug(`[ContactUtils] Found ${files.length} contact files in folder "${targetFolder}"`);
    return files;
  }
}