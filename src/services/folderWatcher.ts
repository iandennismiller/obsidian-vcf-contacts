import * as fs from 'fs/promises';
import { App, Notice, TFile } from 'obsidian';
import * as path from 'path';
import { ContactNote, getFrontmatterFromFiles } from "src/contacts/contactNote";
import { VcardFile } from "src/contacts/vcardFile";
import { VCardForObsidianRecord } from "src/contacts/vcardFile";
import { VcardManager, VCardFileInfo } from "src/contacts/vcardManager";
import { ContactManager } from "src/contacts/contactManager";
import { ContactsPluginSettings } from "src/settings/settings.d";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setupVCFDropHandler } from 'src/ui/vcfDropHandler';
import { insightService } from "src/insights/insightService";
import { RunType } from "src/insights/insight.d";

/**
 * Information about a VCard file being tracked by the watcher
 */
export type { VCardFileInfo } from 'src/contacts/vcardManager';

/**
 * Watches a folder for VCard files and triggers insight processors when changes are detected.
 * Provides lightweight monitoring that delegates actual sync operations to dedicated insight processors.
 * 
 * Features:
 * - Monitors VCard folder for changes using polling
 * - Triggers VCard sync processors when VCard files change
 * - Respects ignore lists for files and UIDs
 * - Provides comprehensive logging of sync operations
 */
export class FolderWatcher {
  private app: App;
  private settings: ContactsPluginSettings;
  private intervalId: number | null = null;
  private knownFiles = new Map<string, VCardFileInfo>();
  private settingsUnsubscribe: (() => void) | null = null;

  // Dependency injection for contact management and utilities
  private contactManager: ContactManager;
  private vcardManager: VcardManager;

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
    this.vcardManager = new VcardManager(settings);
  }

  /**
   * Starts the VCF folder watcher service.
   * 
   * This method:
   * 1. Validates settings and stops any existing watcher
   * 2. Initializes the cache of existing contact UIDs
   * 3. Performs an initial scan of the VCF folder
   * 4. Starts polling for changes at the configured interval
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
  }

  /**
   * Stops the VCF folder watcher service.
   * 
   * Cleans up:
   * - Clears the polling interval
   * - Removes all file change listeners
   * - Logs the shutdown
   */
  /**
   * Stops the VCF folder watcher service.
   * 
   * Cleans up:
   * - Clears the polling interval
   * - Unsubscribes from settings changes
   */
  stop(): void {
    if (this.intervalId !== null) {
      // Use the window clearInterval so tests that mock window are hit
      window.clearInterval(this.intervalId as unknown as number);
      this.intervalId = null;
      console.log('Stopped VCF folder watcher');
    }
    
    // Unsubscribe from settings changes
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
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
   * 
   * @param newSettings - The updated plugin settings
   * @returns Promise that resolves when settings are updated and watcher restarted if needed
   */
  async updateSettings(newSettings: ContactsPluginSettings): Promise<void> {
    const shouldRestart = 
      this.settings.vcfWatchEnabled !== newSettings.vcfWatchEnabled ||
      this.settings.vcfWatchFolder !== newSettings.vcfWatchFolder ||
      this.settings.vcfWatchPollingInterval !== newSettings.vcfWatchPollingInterval;

    this.settings = newSettings;

    // Update dependency settings
    this.contactManager.updateSettings(newSettings);
    this.vcardManager.updateSettings(newSettings);

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
      const folderExists = await this.vcardManager.watchFolderExists();
      if (!folderExists) {
        return;
      }

      // Get list of files in the folder using VCFManager
      const files = await this.vcardManager.listVCFFiles();
      
      if (files.length === 0) {
        const watchFolder = this.vcardManager.getWatchFolder();
        // No VCF files found
        return;
      }

      // Scanning VCF files
      
      for (const filePath of files) {
        await this.processVCFFile(filePath);
      }

    } catch (error) {
      console.log(`Error scanning VCF folder: ${error.message}`);
    }
  }

  /**
   * Processes a single VCF file for changes and triggers insight processors.
   * 
   * This method:
   * 1. Checks if the file should be ignored
   * 2. Verifies the file has been modified since last scan
   * 3. Parses VCF content and finds associated contacts
   * 4. Triggers insight processors on affected contacts
   * 5. Updates tracking data and shows notifications
   * 
   * @param filePath - Full path to the VCF file to process
   * @returns Promise that resolves when file processing is complete
   */
  private async processVCFFile(filePath: string): Promise<void> {
    try {
      // Check if this filename should be ignored using VCFManager
      if (this.vcardManager.shouldIgnoreFile(filePath)) {
        return;
      }

      // Get file stats using VCFManager
      const fileInfo = await this.vcardManager.getVCFFileInfo(filePath);
      if (!fileInfo) {
        return;
      }

      const known = this.knownFiles.get(filePath);
      
      // Skip if file hasn't changed
      if (known && known.lastModified >= fileInfo.lastModified) {
        return;
      }

      const filename = path.basename(filePath);
      console.log(`Processing VCF file: ${filename}`);

      // Read and parse VCF content using VCFManager
      const parsedEntries = await this.vcardManager.readAndParseVCF(filePath);
      if (!parsedEntries) {
        return;
      }

      // Track contacts that need processor triggers
      const contactsToProcess: TFile[] = [];

      // Process each parsed entry to find existing contacts
      for (const [slug, record] of parsedEntries) {
        if (slug && record.UID) {
          // Check if this UID should be ignored using VCFManager
          if (this.vcardManager.shouldIgnoreUID(record.UID)) {
            continue;
          }

          const existingFile = await this.contactManager.findContactFileByUID(record.UID);
          
          if (existingFile) {
            // Contact exists - add to processing list
            contactsToProcess.push(existingFile);
          } else {
            // New contact - create it and add to processing list
            try {
              const contactNote = new ContactNote(this.app, this.settings, null as any);
              const mdContent = contactNote.mdRender(record, this.settings.defaultHashtag);
              const filename = slug + '.md';
              
              await ContactManager.createContactFileStatic(this.app, this.settings.contactsFolder, mdContent, filename);
              
              // Find the newly created file and add to processing
              const newFile = await this.contactManager.findContactFileByUID(record.UID);
              if (newFile) {
                contactsToProcess.push(newFile);
                console.log(`Created new contact: ${newFile.basename}`);
              }
            } catch (error) {
              console.log(`Failed to create contact ${slug} from ${filename}: ${error.message}`);
            }
          }
        }
      }

      // Trigger insight processors on all affected contacts
      if (contactsToProcess.length > 0) {
        console.log(`Triggering processors on ${contactsToProcess.length} contacts from ${filename}`);
        
        // Get contacts data for insight processing
        const contacts = await getFrontmatterFromFiles(contactsToProcess);
        
        // Trigger immediate processors (like VcfSyncPreProcessor)
        await insightService.process(contacts, RunType.IMMEDIATELY);

        // Show notification for processed contacts
        new Notice(`VCF Watcher: Processed ${contactsToProcess.length} contact(s) from ${filename}`);
      }

      // Update tracking for this VCF file
      this.knownFiles.set(filePath, {
        path: filePath,
        lastModified: fileInfo.lastModified,
        uid: "" // VCF files can contain multiple UIDs
      });

    } catch (error) {
      console.log(`Error processing VCF file ${filePath}: ${error.message}`);
    }
  }
}
