import { App, Notice, TFile } from 'obsidian';
import { vcard } from "src/contacts/vcard";
import { createContactFile } from "src/file/file";
import { mdRender } from "src/contacts/contactMdTemplate";
import { ContactsPluginSettings } from "src/settings/settings.d";
import { loggingService } from "src/services/loggingService";
import * as path from 'path';
import * as fs from 'fs/promises';

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
  private contactFiles = new Map<string, TFile>(); // Track contact files by UID
  private contactFileListeners: (() => void)[] = []; // Track registered listeners

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
    loggingService.info(`VCF folder sync started: ${this.settings.vcfWatchFolder}`);
    
    // Set up contact file change tracking for write-back
    if (this.settings.vcfWriteBackEnabled) {
      this.setupContactFileTracking();
      loggingService.info("VCF write-back enabled");
    }
    
    // Initial scan
    await this.scanVCFFolder();

    // Set up polling
    this.intervalId = window.setInterval(
      () => this.scanVCFFolder(),
      this.settings.vcfWatchPollingInterval * 1000
    );
    
    loggingService.info(`VCF folder polling started (interval: ${this.settings.vcfWatchPollingInterval}s)`);
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped VCF folder watcher');
      loggingService.info('VCF folder sync stopped');
    }
    
    // Clean up contact file listeners
    this.cleanupContactFileTracking();
  }

  async updateSettings(newSettings: ContactsPluginSettings): Promise<void> {
    const shouldRestart = 
      this.settings.vcfWatchEnabled !== newSettings.vcfWatchEnabled ||
      this.settings.vcfWatchFolder !== newSettings.vcfWatchFolder ||
      this.settings.vcfWatchPollingInterval !== newSettings.vcfWatchPollingInterval ||
      this.settings.vcfWriteBackEnabled !== newSettings.vcfWriteBackEnabled;

    // Log configuration changes
    if (this.settings.vcfWatchEnabled !== newSettings.vcfWatchEnabled) {
      loggingService.info(`VCF watch enabled changed: ${this.settings.vcfWatchEnabled} → ${newSettings.vcfWatchEnabled}`);
    }
    if (this.settings.vcfWatchFolder !== newSettings.vcfWatchFolder) {
      loggingService.info(`VCF watch folder changed: ${this.settings.vcfWatchFolder} → ${newSettings.vcfWatchFolder}`);
    }
    if (this.settings.vcfWatchPollingInterval !== newSettings.vcfWatchPollingInterval) {
      loggingService.info(`VCF polling interval changed: ${this.settings.vcfWatchPollingInterval}s → ${newSettings.vcfWatchPollingInterval}s`);
    }
    if (this.settings.vcfWriteBackEnabled !== newSettings.vcfWriteBackEnabled) {
      loggingService.info(`VCF write-back enabled changed: ${this.settings.vcfWriteBackEnabled} → ${newSettings.vcfWriteBackEnabled}`);
    }

    this.settings = newSettings;

    if (shouldRestart) {
      this.stop();
      await this.start();
    }
  }

  private async initializeExistingUIDs(): Promise<void> {
    this.existingUIDs.clear();
    this.contactFiles.clear();
    
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
            this.contactFiles.set(uid, file);
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
      
      // Check if folder exists using Node.js fs API
      try {
        await fs.access(folderPath);
      } catch (error) {
        loggingService.warn(`VCF watch folder does not exist: ${folderPath}`);
        return;
      }

      // Get list of files in the folder
      const files = await this.listVCFFiles(folderPath);
      
      if (files.length === 0) {
        loggingService.info(`No VCF files found in ${folderPath}`);
        return;
      }

      loggingService.info(`Scanning ${files.length} VCF files in ${folderPath}`);
      
      for (const filePath of files) {
        await this.processVCFFile(filePath);
      }

    } catch (error) {
      console.error('Error scanning VCF folder:', error);
      loggingService.error(`Error scanning VCF folder: ${error.message}`);
    }
  }

  private async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error) {
      console.error('Error listing VCF files:', error);
      return [];
    }
  }

  private async processVCFFile(filePath: string): Promise<void> {
    try {
      // Check if this filename should be ignored
      const filename = path.basename(filePath);
      if (this.settings.vcfIgnoreFilenames.includes(filename)) {
        loggingService.info(`Skipping ignored VCF file: ${filename}`);
        return;
      }

      // Get file stats
      const stat = await fs.stat(filePath);
      if (!stat) {
        return;
      }

      const known = this.knownFiles.get(filePath);
      
      // Skip if file hasn't changed - use stat.mtimeMs for more precise comparison
      if (known && known.lastModified >= stat.mtimeMs) {
        return;
      }

      loggingService.info(`Processing VCF file: ${filename}`);

      // Read and parse VCF file
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        loggingService.warn(`Empty or unreadable VCF file: ${filename}`);
        return;
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      // Parse VCF content and process contacts
      for await (const [slug, record] of vcard.parse(content)) {
        if (slug && record.UID) {
          // Check if this UID should be ignored
          if (this.settings.vcfIgnoreUIDs.includes(record.UID)) {
            loggingService.info(`Skipping ignored UID: ${record.UID}`);
            skipped++;
            continue;
          }

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
              loggingService.info(`Imported new contact: ${slug} (UID: ${record.UID})`);
            } catch (error) {
              console.warn(`Error importing contact from ${filePath}:`, error);
              loggingService.error(`Failed to import contact ${slug} from ${filename}: ${error.message}`);
              skipped++;
            }
          } else {
            // Existing contact - check if we should update it
            const shouldUpdate = await this.shouldUpdateContact(record, existingFile);
            
            if (shouldUpdate) {
              try {
                await this.updateExistingContact(record, existingFile, slug);
                updated++;
                loggingService.info(`Updated existing contact: ${slug} (UID: ${record.UID})`);
              } catch (error) {
                console.warn(`Error updating contact from ${filePath}:`, error);
                loggingService.error(`Failed to update contact ${slug} from ${filename}: ${error.message}`);
                skipped++;
              }
            } else {
              skipped++;
            }
          }
        } else {
          skipped++;
          loggingService.warn(`Skipping VCF entry without valid slug or UID in ${filename}`);
        }
      }

      // Update our tracking
      this.knownFiles.set(filePath, {
        path: filePath,
        lastModified: stat.mtimeMs,
        uid: undefined // We don't store individual UIDs here since a file can contain multiple
      });

      // Show notification if contacts were processed
      if (imported > 0 || updated > 0) {
        const actions = [];
        if (imported > 0) actions.push(`imported ${imported}`);
        if (updated > 0) actions.push(`updated ${updated}`);
        new Notice(`VCF Watcher: ${actions.join(', ')} contact(s) from ${filePath.split('/').pop()}`);
        loggingService.info(`VCF processing complete for ${filename}: ${imported} imported, ${updated} updated, ${skipped} skipped`);
      }

      if (imported > 0 || updated > 0 || skipped > 0) {
        console.log(`VCF Watcher processed ${filePath}: ${imported} imported, ${updated} updated, ${skipped} skipped`);
      }

    } catch (error) {
      console.error(`Error processing VCF file ${filePath}:`, error);
      loggingService.error(`Critical error processing VCF file ${path.basename(filePath)}: ${error.message}`);
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

  private setupContactFileTracking(): void {
    if (!this.settings.contactsFolder) {
      return;
    }

    const onFileModify = async (file: TFile) => {
      // Only process files in the contacts folder
      if (!file.path.startsWith(this.settings.contactsFolder)) {
        return;
      }

      // Get the UID from the file's frontmatter
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      
      if (!uid) {
        return; // Skip files without UID
      }

      // Update our tracking
      this.contactFiles.set(uid, file);
      
      // Write back to VCF if enabled
      await this.writeContactToVCF(file, uid);
    };

    const onFileRename = async (file: TFile, oldPath: string) => {
      // Handle renamed files in contacts folder
      if (file.path.startsWith(this.settings.contactsFolder)) {
        const cache = this.app.metadataCache.getFileCache(file);
        const uid = cache?.frontmatter?.UID;
        
        if (uid) {
          this.contactFiles.set(uid, file);
          await this.writeContactToVCF(file, uid);
        }
      }
    };

    const onFileDelete = (file: TFile) => {
      // Remove from tracking when deleted
      if (file.path.startsWith(this.settings.contactsFolder)) {
        const cache = this.app.metadataCache.getFileCache(file);
        const uid = cache?.frontmatter?.UID;
        
        if (uid) {
          this.contactFiles.delete(uid);
          // Note: We don't delete the VCF file as it might be the source of truth
        }
      }
    };

    // Register listeners
    this.app.vault.on('modify', onFileModify);
    this.app.vault.on('rename', onFileRename);
    this.app.vault.on('delete', onFileDelete);

    // Store cleanup functions
    this.contactFileListeners.push(
      () => this.app.vault.off('modify', onFileModify),
      () => this.app.vault.off('rename', onFileRename),
      () => this.app.vault.off('delete', onFileDelete)
    );
  }

  private cleanupContactFileTracking(): void {
    // Remove all listeners
    this.contactFileListeners.forEach(cleanup => cleanup());
    this.contactFileListeners = [];
  }

  private async writeContactToVCF(contactFile: TFile, uid: string): Promise<void> {
    if (!this.settings.vcfWriteBackEnabled || !this.settings.vcfWatchFolder) {
      return;
    }

    try {
      // Generate VCF content using the existing toString function
      const { vcards, errors } = await vcard.toString([contactFile]);
      
      if (errors.length > 0) {
        console.warn(`Error generating VCF for ${contactFile.name}:`, errors);
        return;
      }

      // Find corresponding VCF file by UID
      const vcfFilePath = await this.findVCFFileByUID(uid);
      let targetPath: string;

      if (vcfFilePath) {
        // Update existing VCF file
        targetPath = vcfFilePath;
      } else {
        // Create new VCF file
        const sanitizedName = contactFile.basename.replace(/[^a-zA-Z0-9-_]/g, '_');
        targetPath = path.join(this.settings.vcfWatchFolder, `${sanitizedName}.vcf`);
      }

      // Add REV field with current timestamp for sync tracking
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const vcfWithRev = vcards.replace('END:VCARD', `REV:${timestamp}\nEND:VCARD`);

      // Write to filesystem
      await fs.writeFile(targetPath, vcfWithRev, 'utf-8');
      
      // Update our known files tracking
      const stat = await fs.stat(targetPath);
      if (stat) {
        this.knownFiles.set(targetPath, {
          path: targetPath,
          lastModified: stat.mtimeMs,
          uid: uid
        });
      }

      console.log(`Wrote contact ${contactFile.basename} to VCF: ${targetPath}`);
      
    } catch (error) {
      console.error(`Error writing contact to VCF:`, error);
      new Notice(`Failed to write contact ${contactFile.basename} to VCF folder: ${error.message}`);
    }
  }

  private async findVCFFileByUID(uid: string): Promise<string | null> {
    if (!this.settings.vcfWatchFolder) {
      return null;
    }

    try {
      const vcfFiles = await this.listVCFFiles(this.settings.vcfWatchFolder);
      
      for (const filePath of vcfFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.includes(`UID:${uid}`)) {
            return filePath;
          }
        } catch (error) {
          console.warn(`Error reading VCF file ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Error searching for VCF file with UID ${uid}:`, error);
    }

    return null;
  }
}