import { Notice, TFile, TFolder, Vault } from "obsidian";
import { vcard } from "src/contacts/vcard";
import { mdRender } from "src/contacts/contactMdTemplate";
import { createContactFile } from "src/file/file";
import { getApp } from "src/context/sharedAppContext";
import { createNameSlug } from "src/util/nameUtils";
import { ContactsPluginSettings } from "src/settings/settings.d";

export class VcfWatcherService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastScanTime: number = 0;

  constructor(private settings: ContactsPluginSettings) {}

  start(): void {
    if (this.isRunning || !this.settings.vcfWatchEnabled || !this.settings.vcfWatchFolder) {
      return;
    }

    this.isRunning = true;
    this.lastScanTime = Date.now();
    
    console.log(`VCF Watcher: Starting to watch folder ${this.settings.vcfWatchFolder} every ${this.settings.vcfWatchPollingFrequency} seconds`);
    
    this.intervalId = setInterval(() => {
      this.scanVcfFolder().catch(error => {
        console.error('VCF Watcher: Error during scan:', error);
        new Notice(`VCF Watcher error: ${error.message}`);
      });
    }, this.settings.vcfWatchPollingFrequency * 1000);

    // Perform initial scan
    this.scanVcfFolder().catch(error => {
      console.error('VCF Watcher: Error during initial scan:', error);
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('VCF Watcher: Stopped');
  }

  updateSettings(newSettings: ContactsPluginSettings): void {
    const wasRunning = this.isRunning;
    const folderChanged = this.settings.vcfWatchFolder !== newSettings.vcfWatchFolder;
    const frequencyChanged = this.settings.vcfWatchPollingFrequency !== newSettings.vcfWatchPollingFrequency;
    const enabledChanged = this.settings.vcfWatchEnabled !== newSettings.vcfWatchEnabled;

    this.settings = newSettings;

    if (wasRunning && (folderChanged || frequencyChanged || !newSettings.vcfWatchEnabled)) {
      this.stop();
    }

    if (newSettings.vcfWatchEnabled && (!wasRunning || folderChanged || frequencyChanged)) {
      this.start();
    }
  }

  private async scanVcfFolder(): Promise<void> {
    if (!this.settings.vcfWatchFolder) {
      return;
    }

    try {
      const app = getApp();
      
      // Check if the folder exists and is accessible
      let folderExists = false;
      try {
        const listing = await app.vault.adapter.list(this.settings.vcfWatchFolder);
        folderExists = true;
      } catch (error) {
        // Folder doesn't exist or isn't accessible
        console.log(`VCF Watcher: Folder ${this.settings.vcfWatchFolder} not accessible:`, error);
        return;
      }

      const listing = await app.vault.adapter.list(this.settings.vcfWatchFolder);
      const vcfFiles = listing.files.filter(file => file.toLowerCase().endsWith('.vcf'));
      
      let processedCount = 0;
      
      for (const vcfFilePath of vcfFiles) {
        try {
          const stat = await app.vault.adapter.stat(vcfFilePath);
          
          // Only process files that have been modified since our last scan
          if (stat && stat.mtime > this.lastScanTime) {
            const processed = await this.processVcfFile(vcfFilePath);
            if (processed > 0) {
              processedCount += processed;
            }
          }
        } catch (error) {
          console.error(`VCF Watcher: Error checking file ${vcfFilePath}:`, error);
        }
      }
      
      this.lastScanTime = Date.now();
      
      if (processedCount > 0) {
        new Notice(`VCF Watcher: Processed ${processedCount} contact(s)`);
      }
    } catch (error) {
      console.error('VCF Watcher: Error scanning folder:', error);
      throw error;
    }
  }

  private async processVcfFile(vcfPath: string): Promise<number> {
    try {
      const app = getApp();
      const vcfContent = await app.vault.adapter.read(vcfPath);
      let processedCount = 0;

      // Get existing contact files to check for UIDs
      const existingContactUids = await this.getExistingContactUids();

      // Parse VCF file and process each contact
      for await (const [slug, record] of vcard.parse(vcfContent)) {
        const uid = record.UID;
        
        // Skip if contact already exists (based on UID)
        if (uid && existingContactUids.has(uid)) {
          continue;
        }

        // Generate UID if missing
        if (!uid) {
          record.UID = this.generateUUID();
        }

        // Determine filename
        let filename: string;
        try {
          if (slug) {
            filename = slug + '.md';
          } else if (record.FN) {
            filename = this.sanitizeFileName(record.FN) + '.md';
          } else {
            // Try to assemble name from other fields
            const assembledName = this.assembleNameFromFields(record);
            if (assembledName) {
              filename = this.sanitizeFileName(assembledName) + '.md';
            } else {
              filename = record.UID.replace('urn:uuid:', '') + '.md';
            }
          }
        } catch (error) {
          // Fallback to UID if name generation fails
          filename = record.UID.replace('urn:uuid:', '') + '.md';
        }

        // Create markdown content
        const mdContent = mdRender(record, this.settings.defaultHashtag);
        
        // Create contact file
        createContactFile(app, this.settings.contactsFolder, mdContent, filename);
        processedCount++;
      }

      return processedCount;
    } catch (error) {
      console.error(`VCF Watcher: Error processing file ${vcfPath}:`, error);
      return 0;
    }
  }

  private async getExistingContactUids(): Promise<Set<string>> {
    const app = getApp();
    const uids = new Set<string>();
    
    try {
      const contactsFolder = this.settings.contactsFolder;
      const folder = contactsFolder ? 
        app.vault.getAbstractFileByPath(contactsFolder) as TFolder : 
        app.vault.getRoot();
      
      if (!folder) return uids;

      const files: TFile[] = [];
      Vault.recurseChildren(folder, (child) => {
        if (child instanceof TFile && child.extension === 'md') {
          files.push(child);
        }
      });

      // Check frontmatter for UIDs
      for (const file of files) {
        const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.UID) {
          uids.add(frontmatter.UID);
        }
      }
    } catch (error) {
      console.error('VCF Watcher: Error getting existing contact UIDs:', error);
    }

    return uids;
  }

  private assembleNameFromFields(record: any): string | null {
    // Try to assemble name from N fields
    const nameComponents = [
      record["N.PREFIX"],
      record["N.GN"],
      record["N.MN"], 
      record["N.FN"],
      record["N.SUFFIX"]
    ].filter(component => component && component.trim());

    if (nameComponents.length > 0) {
      return nameComponents.join(' ');
    }

    // Try other fields that might contain a name
    if (record.ORG) {
      return record.ORG;
    }

    return null;
  }

  private sanitizeFileName(input: string): string {
    const illegalRe = /[\/\?<>\\:\*\|"]/g;
    const controlRe = /[\x00-\x1f\x80-\x9f]/g;
    const reservedRe = /^\.+$/;
    const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
    const windowsTrailingRe = /[\. ]+$/;
    const multipleSpacesRe = /\s+/g;
    
    return input
      .replace(illegalRe, ' ')
      .replace(controlRe, ' ')
      .replace(reservedRe, ' ')
      .replace(windowsReservedRe, ' ')
      .replace(windowsTrailingRe, ' ')
      .replace(multipleSpacesRe, " ")
      .trim();
  }

  private generateUUID(): string {
    // Simple UUID v4 generator
    return 'urn:uuid:' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}