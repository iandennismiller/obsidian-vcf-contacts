import { App, Notice, TFile } from 'obsidian';
import { vcard } from "src/contacts/vcard";
import { createContactFile } from "src/file/file";
import { mdRender } from "src/contacts/contactMdTemplate";
import { ContactsPluginSettings } from "src/settings/settings.d";

export interface VCFFileInfo {
  path: string;
  lastModified: number;
  uid?: string;
}

export class VCFolderWatcher {
  private app: App;
  private settings: ContactsPluginSettings;
  private intervalId: number | null = null;
  private knownFiles = new Map<string, VCFFileInfo>();
  private existingUIDs = new Set<string>();

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  async start(): Promise<void> {
    if (!this.settings.vcfWatchEnabled || !this.settings.vcfWatchFolder) {
      return;
    }

    // Stop any existing watcher
    this.stop();

    // Initialize existing UIDs from Obsidian contacts
    await this.initializeExistingUIDs();

    console.log(`Starting VCF folder watcher: ${this.settings.vcfWatchFolder}`);
    
    // Initial scan
    await this.scanVCFFolder();

    // Set up polling
    this.intervalId = window.setInterval(
      () => this.scanVCFFolder(),
      this.settings.vcfWatchPollingInterval * 1000
    );
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped VCF folder watcher');
    }
  }

  async updateSettings(newSettings: ContactsPluginSettings): Promise<void> {
    const shouldRestart = 
      this.settings.vcfWatchEnabled !== newSettings.vcfWatchEnabled ||
      this.settings.vcfWatchFolder !== newSettings.vcfWatchFolder ||
      this.settings.vcfWatchPollingInterval !== newSettings.vcfWatchPollingInterval;

    this.settings = newSettings;

    if (shouldRestart) {
      this.stop();
      await this.start();
    }
  }

  private async initializeExistingUIDs(): Promise<void> {
    this.existingUIDs.clear();
    
    try {
      const contactsFolder = this.settings.contactsFolder || '/';
      const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
      
      if (!folder) {
        return;
      }

      const files = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.startsWith(contactsFolder)
      );

      for (const file of files) {
        try {
          const cache = this.app.metadataCache.getFileCache(file);
          const uid = cache?.frontmatter?.UID;
          if (uid) {
            this.existingUIDs.add(uid);
          }
        } catch (error) {
          console.warn(`Error reading UID from ${file.path}:`, error);
        }
      }

      console.log(`Initialized ${this.existingUIDs.size} existing contact UIDs`);
    } catch (error) {
      console.error('Error initializing existing UIDs:', error);
    }
  }

  private async findContactFileByUID(uid: string): Promise<TFile | null> {
    try {
      const contactsFolder = this.settings.contactsFolder || '/';
      const files = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.startsWith(contactsFolder)
      );

      for (const file of files) {
        try {
          const cache = this.app.metadataCache.getFileCache(file);
          const fileUID = cache?.frontmatter?.UID;
          if (fileUID === uid) {
            return file;
          }
        } catch (error) {
          console.warn(`Error reading UID from ${file.path}:`, error);
        }
      }
    } catch (error) {
      console.error('Error finding contact file by UID:', error);
    }
    
    return null;
  }

  private parseRevisionDate(revString?: string): Date | null {
    if (!revString) return null;
    
    try {
      // REV field can be in various formats like ISO 8601 or timestamp
      // Handle common vCard REV format: 20240101T120000Z
      let dateString = revString;
      
      // If it's in vCard format (YYYYMMDDTHHMMSSZ), convert to ISO format
      if (/^\d{8}T\d{6}Z?$/.test(revString)) {
        const year = revString.substring(0, 4);
        const month = revString.substring(4, 6);
        const day = revString.substring(6, 8);
        const hour = revString.substring(9, 11);
        const minute = revString.substring(11, 13);
        const second = revString.substring(13, 15);
        dateString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      }
      
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.warn('Error parsing REV date:', revString, error);
      return null;
    }
  }

  private async shouldUpdateContact(vcfRecord: any, existingFile: TFile): Promise<boolean> {
    try {
      const cache = this.app.metadataCache.getFileCache(existingFile);
      const existingRev = cache?.frontmatter?.REV;
      const vcfRev = vcfRecord.REV;

      // If either REV is missing, we can't compare - skip update
      if (!existingRev || !vcfRev) {
        console.log(`Missing REV field: existing=${existingRev}, vcf=${vcfRev}`);
        return false;
      }

      const existingRevDate = this.parseRevisionDate(existingRev);
      const vcfRevDate = this.parseRevisionDate(vcfRev);

      // If we can't parse either date, skip update
      if (!existingRevDate || !vcfRevDate) {
        console.log(`Failed to parse dates: existing=${existingRevDate}, vcf=${vcfRevDate}`);
        return false;
      }

      // Update if VCF REV is newer than existing REV
      const shouldUpdate = vcfRevDate > existingRevDate;
      console.log(`REV comparison: VCF ${vcfRev} (${vcfRevDate.toISOString()}) vs existing ${existingRev} (${existingRevDate.toISOString()}) -> ${shouldUpdate}`);
      return shouldUpdate;
    } catch (error) {
      console.warn(`Error comparing REV fields for ${existingFile.path}:`, error);
      return false;
    }
  }

  private async scanVCFFolder(): Promise<void> {
    try {
      const folderPath = this.settings.vcfWatchFolder;
      
      // Check if folder exists using Obsidian's adapter
      const exists = await this.app.vault.adapter.exists(folderPath);
      if (!exists) {
        return;
      }

      // Get list of files in the folder
      const files = await this.listVCFFiles(folderPath);
      
      for (const filePath of files) {
        await this.processVCFFile(filePath);
      }

    } catch (error) {
      console.error('Error scanning VCF folder:', error);
    }
  }

  private async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await this.app.vault.adapter.list(folderPath);
      return entries.files.filter(file => file.toLowerCase().endsWith('.vcf'));
    } catch (error) {
      console.error('Error listing VCF files:', error);
      return [];
    }
  }

  private async processVCFFile(filePath: string): Promise<void> {
    try {
      // Get file stats
      const stat = await this.app.vault.adapter.stat(filePath);
      if (!stat) {
        return;
      }

      const known = this.knownFiles.get(filePath);
      
      // Skip if file hasn't changed
      if (known && known.lastModified >= stat.mtime) {
        return;
      }

      // Read and parse VCF file
      const content = await this.app.vault.adapter.read(filePath);
      if (!content) {
        return;
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      // Parse VCF content and process contacts
      for await (const [slug, record] of vcard.parse(content)) {
        if (slug && record.UID) {
          const existingFile = await this.findContactFileByUID(record.UID);
          
          if (!existingFile) {
            // New contact - import it
            try {
              const mdContent = mdRender(record, this.settings.defaultHashtag);
              const filename = slug + '.md';
              
              createContactFile(this.app, this.settings.contactsFolder, mdContent, filename);
              
              // Add UID to our tracking set
              this.existingUIDs.add(record.UID);
              imported++;
            } catch (error) {
              console.warn(`Error importing contact from ${filePath}:`, error);
              skipped++;
            }
          } else {
            // Existing contact - check if we should update it
            const shouldUpdate = await this.shouldUpdateContact(record, existingFile);
            
            if (shouldUpdate) {
              try {
                await this.updateExistingContact(record, existingFile, slug);
                updated++;
              } catch (error) {
                console.warn(`Error updating contact from ${filePath}:`, error);
                skipped++;
              }
            } else {
              skipped++;
            }
          }
        } else {
          skipped++;
        }
      }

      // Update our tracking
      this.knownFiles.set(filePath, {
        path: filePath,
        lastModified: stat.mtime,
        uid: undefined // We don't store individual UIDs here since a file can contain multiple
      });

      // Show notification if contacts were processed
      if (imported > 0 || updated > 0) {
        const actions = [];
        if (imported > 0) actions.push(`imported ${imported}`);
        if (updated > 0) actions.push(`updated ${updated}`);
        new Notice(`VCF Watcher: ${actions.join(', ')} contact(s) from ${filePath.split('/').pop()}`);
      }

      if (imported > 0 || updated > 0 || skipped > 0) {
        console.log(`VCF Watcher processed ${filePath}: ${imported} imported, ${updated} updated, ${skipped} skipped`);
      }

    } catch (error) {
      console.error(`Error processing VCF file ${filePath}:`, error);
    }
  }

  private async updateExistingContact(vcfRecord: any, existingFile: TFile, newSlug: string): Promise<void> {
    try {
      // Generate new content
      const newMdContent = mdRender(vcfRecord, this.settings.defaultHashtag);
      
      // Check if the filename should change based on the new data
      const newFilename = newSlug + '.md';
      const currentFilename = existingFile.name;
      
      if (currentFilename !== newFilename) {
        // File needs to be renamed
        const newPath = existingFile.path.replace(currentFilename, newFilename);
        
        // Use Obsidian's rename API
        await this.app.vault.rename(existingFile, newPath);
        console.log(`Renamed contact file from ${currentFilename} to ${newFilename}`);
      }
      
      // Update the file content with new data
      await this.app.vault.modify(existingFile, newMdContent);
      
    } catch (error) {
      console.error(`Error updating existing contact:`, error);
      throw error;
    }
  }
}