import * as fs from 'fs/promises';
import { App, Notice, TFile } from 'obsidian';
import * as path from 'path';
import { mdRender } from "src/contacts/contactMdTemplate";
import { updateFrontMatterValue, generateRevTimestamp } from "src/contacts/contactFrontmatter";
import { vcard } from "src/contacts/vcard";
import { VCardForObsidianRecord } from "src/contacts/vcard/shared/vcard.d";
import { createContactFile } from "src/file/file";
import { loggingService } from "src/services/loggingService";
import { ContactsPluginSettings } from "src/settings/settings.d";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setupVCFDropHandler } from 'src/services/vcfDropHandler';

/**
 * Information about a VCF file being tracked by the watcher
 */
export interface VCFFileInfo {
  /** Full file system path to the VCF file */
  path: string;
  /** Last modified timestamp in milliseconds */
  lastModified: number;
  /** Optional UID associated with this file */
  uid?: string;
}

/**
 * Watches a folder for VCF (vCard) files and automatically syncs them with Obsidian contact files.
 * Provides bi-directional synchronization between VCF files and Obsidian markdown contact files.
 * 
 * Features:
 * - Monitors VCF folder for changes using polling
 * - Imports new contacts from VCF files
 * - Updates existing contacts based on revision timestamps
 * - Writes back changes from Obsidian to VCF files (when enabled)
 * - Respects ignore lists for files and UIDs
 * - Provides comprehensive logging of sync operations
 */
export class VCFolderWatcher {
  private app: App;
  private settings: ContactsPluginSettings;
  private intervalId: number | null = null;
  private knownFiles = new Map<string, VCFFileInfo>();
  private existingUIDs = new Set<string>();
  private contactFiles = new Map<string, TFile>(); // Track contact files by UID
  private contactFileListeners: (() => void)[] = []; // Track registered listeners
	private settingsUnsubscribe: (() => void) | null = null;
  // Debounce timers for write-back operations keyed by contact file path
  private writeBackTimers: Map<string, number> = new Map();
  // Keep track of vault create listener cleanup
  private vaultCreateCleanup: (() => void) | null = null;
  // Track files currently being updated to prevent infinite loops
  private updatingRevFields: Set<string> = new Set();

  /**
   * Creates a new VCF folder watcher instance.
   * 
   * @param app - The Obsidian App instance for vault operations
   * @param settings - Plugin settings containing folder paths and sync options
   */
  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Starts the VCF folder watcher service.
   * 
   * This method:
   * 1. Validates settings and stops any existing watcher
   * 2. Initializes the cache of existing contact UIDs
   * 3. Sets up file change tracking for write-back (if enabled)
   * 4. Performs an initial scan of the VCF folder
   * 5. Starts polling for changes at the configured interval
   * 
   * @returns Promise that resolves when the watcher is fully started
   */
  async start(): Promise<void> {
    if (!this.settings.vcfWatchEnabled || !this.settings.vcfWatchFolder) {
      return;
    }

    // Stop any existing watcher
    this.stop();

    // Wait a bit for Obsidian to fully initialize the metadata cache
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize existing UIDs from Obsidian contacts
    await this.initializeExistingUIDs();

    console.log(`Starting VCF folder watcher: ${this.settings.vcfWatchFolder}`);
    loggingService.info(`VCF folder sync started: ${this.settings.vcfWatchFolder}`);
    
    // Set up contact file change tracking for write-back
    if (this.settings.vcfWriteBackEnabled) {
      this.setupContactFileTracking();
      loggingService.info("VCF write-back enabled");
    }
  // VCF drop handler is initialized from main plugin entrypoint
    
    // Initial scan
    await this.scanVCFFolder();

    // Set up polling
    this.intervalId = window.setInterval(
      () => this.scanVCFFolder(),
      this.settings.vcfWatchPollingInterval * 1000
    );
    
    // Listen for settings changes to update watcher
    this.settingsUnsubscribe = onSettingsChange(async (newSettings) => {
      await this.updateSettings(newSettings);
    });

    loggingService.info(`VCF folder polling started (interval: ${this.settings.vcfWatchPollingInterval}s)`);
  }

  /**
   * Stops the VCF folder watcher service.
   * 
   * Cleans up:
   * - Clears the polling interval
   * - Removes all file change listeners
   * - Logs the shutdown
   */
  stop(): void {
    if (this.intervalId !== null) {
      // Use the window clearInterval so tests that mock window are hit
      window.clearInterval(this.intervalId as unknown as number);
      this.intervalId = null;
      console.log('Stopped VCF folder watcher');
      loggingService.info('VCF folder sync stopped');
    }
    
    // Clean up contact file listeners
    this.cleanupContactFileTracking();
    // Clean up vault create listener
    if (this.vaultCreateCleanup) {
      this.vaultCreateCleanup();
      this.vaultCreateCleanup = null;
    }
  }

  /**
   * Updates the watcher settings and restarts if necessary.
   * 
   * Compares new settings with current settings and determines if a restart
   * is needed based on changes to:
   * - Watch enabled status
   * - Watch folder path
   * - Polling interval
   * - Write-back enabled status
   * 
   * @param newSettings - The updated plugin settings
   * @returns Promise that resolves when settings are updated and watcher restarted if needed
   */
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
      loggingService.debug(`VCF polling interval changed: ${this.settings.vcfWatchPollingInterval}s → ${newSettings.vcfWatchPollingInterval}s`);
    }
    if (this.settings.vcfWriteBackEnabled !== newSettings.vcfWriteBackEnabled) {
      loggingService.debug(`VCF write-back enabled changed: ${this.settings.vcfWriteBackEnabled} → ${newSettings.vcfWriteBackEnabled}`);
    }

    this.settings = newSettings;

    if (shouldRestart) {
      this.stop();
      await this.start();
    }
  }

  /**
   * Extracts UID from a contact file's frontmatter.
   * 
   * Tries multiple approaches:
   * 1. Uses Obsidian's metadata cache (primary method)
   * 2. Falls back to direct file reading and frontmatter parsing
   * 
   * @param file - The contact file to read UID from
   * @returns Promise resolving to the UID string or null if not found
   */
  private async extractUIDFromFile(file: TFile): Promise<string | null> {
    try {
      // Try metadata cache first (most efficient)
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      
      if (uid) {
        loggingService.debug(`Found UID "${uid}" via metadata cache from ${file.path}`);
        return uid;
      }

      // Fallback: read file directly and parse frontmatter
      try {
        const content = await this.app.vault.read(file);
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatterText = frontmatterMatch[1];
          const uidMatch = frontmatterText.match(/^UID:\s*(.+)$/m);
          if (uidMatch) {
            const extractedUID = uidMatch[1].trim();
            loggingService.debug(`Found UID "${extractedUID}" via direct read from ${file.path}`);
            return extractedUID;
          }
        }
      } catch (readError) {
        loggingService.debug(`Failed to read file ${file.path} directly: ${readError.message}`);
      }

      return null;
    } catch (error) {
      loggingService.debug(`Error extracting UID from ${file.path}: ${error.message}`);
      return null;
    }
  }

  /**
   * Initializes the cache of existing contact UIDs from the Obsidian contacts folder.
   * 
   * Scans all markdown files in the contacts folder and builds:
   * - A set of existing UIDs for duplicate detection
   * - A map of UIDs to TFile objects for quick lookups
   * 
   * @returns Promise that resolves when the UID cache is built
   */
  private async initializeExistingUIDs(): Promise<void> {
    this.existingUIDs.clear();
    this.contactFiles.clear();
    
    loggingService.info("Building UID cache from existing contacts...");
    
    try {
      const contactsFolder = this.settings.contactsFolder || '/';
      loggingService.debug(`Contacts folder path: "${contactsFolder}"`);
      
      const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
      
      if (!folder) {
        loggingService.warning(`Contacts folder not found: ${contactsFolder}`);
        return;
      }

      const allMarkdownFiles = this.app.vault.getMarkdownFiles();
      loggingService.debug(`Total markdown files in vault: ${allMarkdownFiles.length}`);
      
      const files = allMarkdownFiles.filter(file => 
        file.path.startsWith(contactsFolder)
      );
      loggingService.debug(`Markdown files in contacts folder: ${files.length}`);

      let filesWithUID = 0;
      let filesWithoutUID = 0;

      for (const file of files) {
        const uid = await this.extractUIDFromFile(file);
        
        if (uid) {
          this.existingUIDs.add(uid);
          this.contactFiles.set(uid, file);
          filesWithUID++;
          loggingService.debug(`Found UID "${uid}" in file: ${file.path}`);
        } else {
          filesWithoutUID++;
          loggingService.debug(`No UID found in file: ${file.path}`);
        }
      }

      loggingService.info(`UID cache built successfully: ${this.existingUIDs.size} existing contacts indexed`);
      loggingService.debug(`Files with UID: ${filesWithUID}, without UID: ${filesWithoutUID}`);
    } catch (error) {
      loggingService.error(`Failed to build UID cache: ${error.message}`);
    }
  }

  /**
   * Finds a contact file by its UID.
   * 
   * Uses a two-tier approach:
   * 1. First checks the cached contactFiles map for fast lookup
   * 2. Falls back to scanning all files if cache miss or stale cache
   * 
   * @param uid - The UID to search for
   * @returns Promise resolving to the TFile or null if not found
   */
  private async findContactFileByUID(uid: string): Promise<TFile | null> {
    loggingService.debug(`Looking for contact with UID: "${uid}"`);
    
    // First check the cached contactFiles map
    const cachedFile = this.contactFiles.get(uid);
    if (cachedFile) {
      loggingService.debug(`Found cached file for UID "${uid}": ${cachedFile.path}`);
      // Verify the file still exists and has the correct UID
      const fileUID = await this.extractUIDFromFile(cachedFile);
      if (fileUID === uid) {
        loggingService.debug(`Cache verification successful for UID "${uid}"`);
        return cachedFile;
      } else {
        loggingService.debug(`Cache verification failed for UID "${uid}": file UID is "${fileUID}"`);
        // Remove stale cache entry
        this.contactFiles.delete(uid);
        loggingService.debug(`Removed stale cache entry for UID "${uid}"`);
      }
    } else {
      loggingService.debug(`No cached file found for UID "${uid}"`);
    }

    // Fall back to searching all files if not in cache or cache is stale
    try {
      const contactsFolder = this.settings.contactsFolder || '/';
      const files = this.app.vault.getMarkdownFiles().filter(file => 
        file.path.startsWith(contactsFolder)
      );

      loggingService.debug(`Searching ${files.length} files in "${contactsFolder}" for UID "${uid}"`);

      for (const file of files) {
        const fileUID = await this.extractUIDFromFile(file);
        
        if (fileUID === uid) {
          // Update the cache
          this.contactFiles.set(uid, file);
          loggingService.debug(`Found matching file for UID "${uid}": ${file.path}`);
          return file;
        }
      }
      
      loggingService.debug(`No file found for UID "${uid}" after searching ${files.length} files`);
    } catch (error) {
      loggingService.error(`Error finding contact file by UID: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Parses a revision date string from VCF REV field.
   * 
   * Handles multiple date formats:
   * - vCard format: YYYYMMDDTHHMMSSZ
   * - ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
   * 
   * @param revString - The revision string from VCF REV field
   * @returns Parsed Date object or null if parsing fails
   */
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
      loggingService.debug(`Error parsing REV date: ${revString} - ${error.message}`);
      return null;
    }
  }

  /**
   * Determines if an existing contact should be updated based on revision timestamps.
   * 
   * Compares the REV field from the VCF record with the existing contact file's REV.
   * Only updates if the VCF has a newer revision timestamp.
   * 
   * @param vcfRecord - The VCF record data with REV field
   * @param existingFile - The existing contact file in Obsidian
   * @returns Promise resolving to true if contact should be updated, false otherwise
   */
  private async shouldUpdateContact(vcfRecord: VCardForObsidianRecord, existingFile: TFile): Promise<boolean> {
    try {
      const cache = this.app.metadataCache.getFileCache(existingFile);
      const existingRev = cache?.frontmatter?.REV;
      const vcfRev = vcfRecord.REV;

      // If either REV is missing, we can't compare - skip update
      if (!existingRev || !vcfRev) {
        loggingService.debug(`Missing REV field: existing=${existingRev}, vcf=${vcfRev}`);
        return false;
      }

      const existingRevDate = this.parseRevisionDate(existingRev);
      const vcfRevDate = this.parseRevisionDate(vcfRev);

      // If we can't parse either date, skip update
      if (!existingRevDate || !vcfRevDate) {
        loggingService.debug(`Failed to parse dates: existing=${existingRevDate}, vcf=${vcfRevDate}`);
        return false;
      }

      // Update if VCF REV is newer than existing REV
      const shouldUpdate = vcfRevDate > existingRevDate;
      loggingService.debug(`REV comparison: VCF ${vcfRev} (${vcfRevDate.toISOString()}) vs existing ${existingRev} (${existingRevDate.toISOString()}) -> ${shouldUpdate}`);
      return shouldUpdate;
    } catch (error) {
      loggingService.debug(`Error comparing REV fields for ${existingFile.path}: ${error.message}`);
      return false;
    }
  }

  /**
   * Scans the configured VCF folder for changes and processes any modified files.
   * 
   * This is the main sync method that:
   * 1. Verifies the VCF folder exists
   * 2. Lists all VCF files in the folder
   * 3. Processes each file for new or updated contacts
   * 
   * @returns Promise that resolves when the scan is complete
   */
  private async scanVCFFolder(): Promise<void> {
    try {
      const folderPath = this.settings.vcfWatchFolder;
      
      // Check if folder exists using Node.js fs API
      try {
        await fs.access(folderPath);
      } catch (error) {
        loggingService.warning(`VCF watch folder does not exist: ${folderPath}`);
        return;
      }

      // Get list of files in the folder
      const files = await this.listVCFFiles(folderPath);
      
      if (files.length === 0) {
        loggingService.debug(`No VCF files found in ${folderPath}`);
        return;
      }

      loggingService.debug(`Scanning ${files.length} VCF files in ${folderPath}`);
      
      for (const filePath of files) {
        await this.processVCFFile(filePath);
      }

    } catch (error) {
      loggingService.error(`Error scanning VCF folder: ${error.message}`);
    }
  }

  /**
   * Lists all VCF files in the specified folder.
   * 
   * Filters directory entries to include only:
   * - Regular files (not directories)
   * - Files with .vcf extension (case insensitive)
   * 
   * @param folderPath - The folder path to scan for VCF files
   * @returns Promise resolving to array of full file paths to VCF files
   */
  private async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      if (!entries || !Array.isArray(entries)) {
        loggingService.debug(`No entries returned from readdir for ${folderPath}`);
        return [];
      }
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error) {
      loggingService.error(`Error listing VCF files: ${error.message}`);
      return [];
    }
  }

  /**
   * Processes a single VCF file for contacts to import or update.
   * 
   * This method:
   * 1. Checks if the file should be ignored
   * 2. Verifies the file has been modified since last scan
   * 3. Parses VCF content and processes each contact record
   * 4. Imports new contacts or updates existing ones based on REV timestamps
   * 5. Updates tracking data and shows notifications
   * 
   * @param filePath - Full path to the VCF file to process
   * @returns Promise that resolves when file processing is complete
   */
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

      loggingService.debug(`Processing VCF file: ${filename}`);

      // Read and parse VCF file
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        loggingService.warning(`Empty or unreadable VCF file: ${filename}`);
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
              loggingService.debug(`Imported new contact: ${slug} (UID: ${record.UID})`);
            } catch (error) {
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
                loggingService.debug(`Updated existing contact: ${slug} (UID: ${record.UID})`);
              } catch (error) {
                loggingService.error(`Failed to update contact ${slug} from ${filename}: ${error.message}`);
                skipped++;
              }
            } else {
              skipped++;
            }
          }
        } else {
          skipped++;
          loggingService.debug(`Skipping VCF entry without valid slug or UID in ${filename}`);
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
        loggingService.debug(`VCF processing complete for ${filename}: ${imported} imported, ${updated} updated, ${skipped} skipped`);
      }

      if (imported > 0 || updated > 0 || skipped > 0) {
        loggingService.debug(`VCF Watcher processed ${filePath}: ${imported} imported, ${updated} updated, ${skipped} skipped`);
      }

    } catch (error) {
      loggingService.error(`Critical error processing VCF file ${path.basename(filePath)}: ${error.message}`);
    }
  }

  /**
   * Updates an existing contact file with new VCF data.
   * 
   * This method:
   * 1. Generates new markdown content from the VCF record
   * 2. Renames the file if the contact name has changed
   * 3. Updates the file content with the new data
   * 
   * @param vcfRecord - The VCF record with updated contact data
   * @param existingFile - The existing contact file to update
   * @param newSlug - The new filename slug based on contact name
   * @returns Promise that resolves when update is complete
   */
  private async updateExistingContact(vcfRecord: VCardForObsidianRecord, existingFile: TFile, newSlug: string): Promise<void> {
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
        loggingService.debug(`Renamed contact file from ${currentFilename} to ${newFilename}`);
      }
      
      // Mark file as being updated to prevent loops
      this.updatingRevFields.add(existingFile.path);
      
      try {
        // Update the file content with new data
        await this.app.vault.modify(existingFile, newMdContent);
      } finally {
        // Remove from tracking set after update
        this.updatingRevFields.delete(existingFile.path);
      }
      
    } catch (error) {
      loggingService.error(`Error updating existing contact: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sets up file change tracking for contact files to enable write-back to VCF.
   * 
   * Registers listeners for:
   * - File modification: Updates VCF when contact file is modified
   * - File rename: Updates tracking when contact file is renamed
   * - File deletion: Removes from tracking when contact file is deleted
   * 
   * Only tracks files in the configured contacts folder that have UIDs.
   */
  private setupContactFileTracking(): void {
    if (!this.settings.contactsFolder) {
      return;
    }

    const onFileModify = async (file: TFile) => {
      // Only process files in the contacts folder
      if (!file.path.startsWith(this.settings.contactsFolder)) {
        return;
      }

      // Skip if we're currently updating this file internally to avoid loops
      if (this.updatingRevFields.has(file.path)) {
        return;
      }

      // Get the UID from the file's frontmatter
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      
      if (!uid) {
        return; // Skip files without UID
      }

      try {
        // Track this file in our contact files map
        this.contactFiles.set(uid, file);
        
        // Schedule debounced write-back to VCF
        this.scheduleWriteBack(file, uid);

        loggingService.debug(`Updated contact file tracking for ${file.basename} (UID: ${uid})`);
      } catch (error) {
        loggingService.error(`Error updating contact file tracking: ${error.message}`);
      }
    };

    const onFileRename = async (file: TFile) => {
      // Handle renamed files in contacts folder
      if (file.path.startsWith(this.settings.contactsFolder)) {
        const cache = this.app.metadataCache.getFileCache(file);
        const uid = cache?.frontmatter?.UID;
        
        if (uid) {
          this.contactFiles.set(uid, file);
          // Debounced write-back on rename as well
          this.scheduleWriteBack(file, uid);
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

  /**
   * Schedule a debounced write-back for the provided contact file.
   * Ensures we do not write back more than once per second per file.
   */
  private scheduleWriteBack(file: TFile, uid: string) {
    try {
      const key = file.path;

      // Clear any existing timer
      const existing = this.writeBackTimers.get(key);
      if (existing) {
        globalThis.clearTimeout(existing as unknown as number);
      }

      // Schedule new timer for 1 second
      const timer = globalThis.setTimeout(async () => {
        try {
          await this.writeContactToVCF(file, uid);
        } catch (err) {
          loggingService.error(`Debounced write-back failed for ${file.path}: ${err.message}`);
        } finally {
          this.writeBackTimers.delete(key);
        }
      }, 1000);

      this.writeBackTimers.set(key, timer as unknown as number);
    } catch (error) {
      loggingService.debug(`Error scheduling write-back for ${file.path}: ${error.message}`);
    }
  }

  private setupVaultCreateHandler(): void {
    if (!this.settings.vcfWatchFolder) return;
    this.vaultCreateCleanup = setupVCFDropHandler(this.app, this.settings);
  }

  /**
   * Cleans up all file change tracking listeners.
   * 
   * Removes all registered event listeners to prevent memory leaks
   * when the watcher is stopped or settings are changed.
   */
  private cleanupContactFileTracking(): void {
    // Remove all listeners
    this.contactFileListeners.forEach(cleanup => cleanup());
    this.contactFileListeners = [];
  }

  /**
   * Writes a contact file back to the VCF folder as a VCF file.
   * 
   * This method:
   * 1. Generates VCF content from the contact file
   * 2. Finds the corresponding VCF file by UID or creates a new one
   * 3. Adds a current REV timestamp for sync tracking
   * 4. Writes the VCF content to the filesystem
   * 5. Updates internal tracking data
   * 
   * @param contactFile - The Obsidian contact file to write back
   * @param uid - The UID of the contact
   * @returns Promise that resolves when write-back is complete
   */
  private async writeContactToVCF(contactFile: TFile, uid: string): Promise<void> {
    if (!this.settings.vcfWriteBackEnabled || !this.settings.vcfWatchFolder) {
      return;
    }

    try {
      // Generate VCF content using the existing toString function
      const { vcards, errors } = await vcard.toString([contactFile], this.app);
      
      if (errors.length > 0) {
        loggingService.warning(`Error generating VCF for ${contactFile.name}: ${errors.map(e => e.message).join(', ')}`);
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

      // Generate VCard content - REV field will be included if present in frontmatter
      // (REV is automatically managed by contactFrontmatter.ts)
      
      // Write to filesystem
      await fs.writeFile(targetPath, vcards, 'utf-8');
      
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
      loggingService.error(`Error writing contact to VCF: ${error.message}`);
      new Notice(`Failed to write contact ${contactFile.basename} to VCF folder: ${error.message}`);
    }
  }

  /**
   * Finds a VCF file in the watch folder that contains the specified UID.
   * 
   * Searches all VCF files in the configured watch folder for one that
   * contains the given UID in its content.
   * 
   * @param uid - The UID to search for in VCF files
   * @returns Promise resolving to the file path or null if not found
   */
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
          loggingService.debug(`Error reading VCF file ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      loggingService.debug(`Error searching for VCF file with UID ${uid}: ${error.message}`);
    }

    return null;
  }
}