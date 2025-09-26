import * as fs from 'fs/promises';
import { App, Notice, TFile } from 'obsidian';
import * as path from 'path';
import { mdRender } from "src/contacts/contactMdTemplate";
import { updateFrontMatterValue, generateRevTimestamp } from "src/contacts/contactFrontmatter";
import { VcardFile } from "src/contacts/vcardFile";
import { VCardForObsidianRecord } from "src/contacts/vcard-types";
import { ContactManager, RevisionUtils, VCFManager, VCFFileInfo } from "src/contacts";
import { createContactFile } from "src/file/file";
import { loggingService } from "src/services/loggingService";
import { ContactsPluginSettings } from "src/settings/settings.d";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setupVCFDropHandler } from 'src/services/vcfDropHandler';

/**
 * Information about a VCF file being tracked by the watcher
 */
export type { VCFFileInfo } from 'src/contacts/vcfManager';

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
  private contactFileListeners: (() => void)[] = []; // Track registered listeners
	private settingsUnsubscribe: (() => void) | null = null;
  // Debounce timers for write-back operations keyed by contact file path
  private writeBackTimers: Map<string, number> = new Map();
  // Keep track of vault create listener cleanup
  private vaultCreateCleanup: (() => void) | null = null;
  // Track files currently being updated to prevent infinite loops
  private updatingRevFields: Set<string> = new Set();

  // Dependency injection for contact management and utilities
  private contactManager: ContactManager;
  private revisionUtils: RevisionUtils;
  private vcfManager: VCFManager;

  /**
   * Creates a new VCF folder watcher instance.
   * 
   * @param app - The Obsidian App instance for vault operations
   * @param settings - Plugin settings containing folder paths and sync options
   */
  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
    
    // Initialize dependency classes
    this.contactManager = new ContactManager(app, settings);
    this.revisionUtils = new RevisionUtils(app);
    this.vcfManager = new VCFManager(settings);
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

    // Initialize existing UIDs from Obsidian contacts using ContactManager
    await this.contactManager.initializeCache();

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

    // Update dependency settings
    this.contactManager.updateSettings(newSettings);
    this.vcfManager.updateSettings(newSettings);

    if (shouldRestart) {
      this.stop();
      await this.start();
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
      // Check if folder exists using VCFManager
      const folderExists = await this.vcfManager.watchFolderExists();
      if (!folderExists) {
        return;
      }

      // Get list of files in the folder using VCFManager
      const files = await this.vcfManager.listVCFFiles();
      
      if (files.length === 0) {
        const watchFolder = this.vcfManager.getWatchFolder();
        loggingService.debug(`No VCF files found in ${watchFolder}`);
        return;
      }

      loggingService.debug(`Scanning ${files.length} VCF files in ${this.vcfManager.getWatchFolder()}`);
      
      for (const filePath of files) {
        await this.processVCFFile(filePath);
      }

    } catch (error) {
      loggingService.error(`Error scanning VCF folder: ${error.message}`);
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
      // Check if this filename should be ignored using VCFManager
      if (this.vcfManager.shouldIgnoreFile(filePath)) {
        return;
      }

      // Get file stats using VCFManager
      const fileInfo = await this.vcfManager.getVCFFileInfo(filePath);
      if (!fileInfo) {
        return;
      }

      const known = this.knownFiles.get(filePath);
      
      // Skip if file hasn't changed
      if (known && known.lastModified >= fileInfo.lastModified) {
        return;
      }

      const filename = path.basename(filePath);
      loggingService.debug(`Processing VCF file: ${filename}`);

      // Read and parse VCF content using VCFManager
      const parsedEntries = await this.vcfManager.readAndParseVCF(filePath);
      if (!parsedEntries) {
        return;
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;

      // Process each parsed entry
      for (const [slug, record] of parsedEntries) {
        if (slug && record.UID) {
          // Check if this UID should be ignored using VCFManager
          if (this.vcfManager.shouldIgnoreUID(record.UID)) {
            skipped++;
            continue;
          }

          const existingFile = await this.contactManager.findContactFileByUID(record.UID);
          
          if (!existingFile) {
            // New contact - import it
            try {
              const mdContent = mdRender(record, this.settings.defaultHashtag);
              const filename = slug + '.md';
              
              createContactFile(this.app, this.settings.contactsFolder, mdContent, filename);
              
              // Note: We'll let the ContactManager discover the new file naturally through cache refresh
              // or through the file tracking events
              imported++;
              loggingService.debug(`Imported new contact: ${slug} (UID: ${record.UID})`);
            } catch (error) {
              loggingService.error(`Failed to import contact ${slug} from ${filename}: ${error.message}`);
              skipped++;
            }
          } else {
            // Existing contact - check if we should update it using RevisionUtils
            const shouldUpdate = await this.revisionUtils.shouldUpdateContact(record, existingFile);
            
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
        lastModified: fileInfo.lastModified,
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

      // Get the UID from the file's frontmatter using ContactManager
      const uid = await this.contactManager.extractUIDFromFile(file);
      
      if (!uid) {
        return; // Skip files without UID
      }

      try {
        // Track this file in ContactManager cache
        this.contactManager.addToCache(uid, file);
        
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
        const uid = await this.contactManager.extractUIDFromFile(file);
        
        if (uid) {
          this.contactManager.updateCacheForRename(uid, file);
          // Debounced write-back on rename as well
          this.scheduleWriteBack(file, uid);
        }
      }
    };

    const onFileDelete = async (file: TFile) => {
      // Remove from tracking when deleted
      if (file.path.startsWith(this.settings.contactsFolder)) {
        const uid = await this.contactManager.extractUIDFromFile(file);
        
        if (uid) {
          this.contactManager.removeFromCache(uid);
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
      // Generate VCF content using the VcardFile class
      const { vcards, errors } = await VcardFile.fromObsidianFiles([contactFile], this.app);
      
      if (errors.length > 0) {
        loggingService.warning(`Error generating VCF for ${contactFile.name}: ${errors.map(e => e.message).join(', ')}`);
        return;
      }

      // Find corresponding VCF file by UID using VCFManager
      const vcfFilePath = await this.vcfManager.findVCFFileByUID(uid);
      let targetPath: string;

      if (vcfFilePath) {
        // Update existing VCF file
        targetPath = vcfFilePath;
      } else {
        // Create new VCF file using VCFManager filename generation
        const vcfFilename = this.vcfManager.generateVCFFilename(contactFile.basename);
        const writtenPath = await this.vcfManager.writeVCFFile(vcfFilename, vcards);
        if (!writtenPath) {
          new Notice(`Failed to write contact ${contactFile.basename} to VCF folder`);
          return;
        }
        targetPath = writtenPath;
      }

      // If updating existing file, write directly
      if (vcfFilePath) {
        const writeSuccess = await this.vcfManager.writeVCFFile(path.basename(targetPath), vcards);
        if (!writeSuccess) {
          new Notice(`Failed to write contact ${contactFile.basename} to VCF folder`);
          return;
        }
      }

      // Update our known files tracking
      const fileInfo = await this.vcfManager.getVCFFileInfo(targetPath);
      if (fileInfo) {
        this.knownFiles.set(targetPath, {
          path: targetPath,
          lastModified: fileInfo.lastModified,
          uid: uid
        });
      }

      console.log(`Wrote contact ${contactFile.basename} to VCF: ${targetPath}`);
      
    } catch (error) {
      loggingService.error(`Error writing contact to VCF: ${error.message}`);
      new Notice(`Failed to write contact ${contactFile.basename} to VCF folder: ${error.message}`);
    }
  }

}