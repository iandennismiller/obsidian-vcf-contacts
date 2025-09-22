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
      let skipped = 0;

      // Parse VCF content and import new contacts
      for await (const [slug, record] of vcard.parse(content)) {
        if (slug && record.UID) {
          // Check if we already have a contact with this UID
          if (!this.existingUIDs.has(record.UID)) {
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
            skipped++;
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

      // Show notification if contacts were imported
      if (imported > 0) {
        new Notice(`VCF Watcher: Imported ${imported} new contact(s) from ${filePath.split('/').pop()}`);
      }

      if (imported > 0 || skipped > 0) {
        console.log(`VCF Watcher processed ${filePath}: ${imported} imported, ${skipped} skipped`);
      }

    } catch (error) {
      console.error(`Error processing VCF file ${filePath}:`, error);
    }
  }
}