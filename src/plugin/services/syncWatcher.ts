import * as fs from 'fs/promises';
import { App, Notice, TFile } from 'obsidian';
import * as path from 'path';
import { VcardManager, VCardFileInfo } from "../../models/vcardManager";
import { ContactManager } from "../../models/contactManager";
import { ContactsPluginSettings } from 'src/plugin/settings';
import { onSettingsChange } from "src/plugin/context/sharedSettingsContext";
import { curatorService } from "src/models/curatorManager/curatorManager";
import { RunType } from "src/models/curatorManager/RunType";

/**
 * Information about a VCard file being tracked by the watcher
 */
export type { VCardFileInfo } from '../../models/vcardManager';

/* istanbul ignore next */
// SyncWatcher is a file system polling service that requires runtime environment
/**
 * Watches for VCard files and triggers curator processors when changes are detected.
 * Supports both single VCF files and VCF folder monitoring.
 * Provides lightweight monitoring that delegates actual sync operations to dedicated curator processors.
 * 
 * Features:
 * - Monitors VCard files/folders for changes using polling
 * - Supports both "single VCF" and "VCF folder" storage paradigms
 * - Triggers VCard sync processors when VCard files change
 * - Respects ignore lists for files and UIDs (VCF folder mode only)
 * - Provides comprehensive logging of sync operations
 */
export class SyncWatcher {
  private app: App;
  private settings: ContactsPluginSettings;
  private intervalId: number | null = null;
  private knownFiles = new Map<string, VCardFileInfo>();
  private settingsUnsubscribe: (() => void) | null = null;

  // Dependency injection for contact management and utilities
  private contactManager: ContactManager;
  private vcardManager: VcardManager;

  /**
   * Creates a new VCF sync watcher instance.
   * 
   * @param app - The Obsidian App instance for vault operations
   * @param settings - Plugin settings containing storage method and sync options
   */
  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
    
    // Initialize dependency classes
    this.contactManager = new ContactManager(app, settings);
    this.vcardManager = new VcardManager(settings);
  }

  /**
   * Starts the VCF sync watcher service.
   * 
   * This method:
   * 1. Validates settings and stops any existing watcher
   * 2. Initializes the cache of existing contact UIDs
   * 3. Performs an initial scan based on storage method
   * 4. Starts polling for changes at the configured interval
   * 
   * @returns Promise that resolves when the watcher is fully started
   */
  async start(): Promise<void> {
    if (!this.settings.vcfWatchEnabled || 
        (this.settings.vcfStorageMethod === 'vcf-folder' && !this.settings.vcfWatchFolder) ||
        (this.settings.vcfStorageMethod === 'single-vcf' && !this.settings.vcfFilename)) {
      return;
    }

    // Stop any existing watcher
    this.stop();

    // Wait a bit for Obsidian to fully initialize the metadata cache
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize existing UIDs from Obsidian contacts using ContactManager
    await this.contactManager.initializeCache();

    const storageInfo = this.settings.vcfStorageMethod === 'single-vcf' 
      ? this.settings.vcfFilename 
      : this.settings.vcfWatchFolder;
    console.log(`Starting VCF sync watcher (${this.settings.vcfStorageMethod}): ${storageInfo}`);
    
    // Initial scan
    if (this.settings.vcfStorageMethod === 'single-vcf') {
      await this.scanSingleVCF();
    } else {
      await this.scanVCFFolder();
    }

    // Set up polling
    this.intervalId = window.setInterval(
      () => {
        if (this.settings.vcfStorageMethod === 'single-vcf') {
          this.scanSingleVCF();
        } else {
          this.scanVCFFolder();
        }
      },
      this.settings.vcfWatchPollingInterval * 1000
    );
    
    // Listen for settings changes to update watcher
    this.settingsUnsubscribe = onSettingsChange(async (newSettings) => {
      await this.updateSettings(newSettings);
    });
  }

  /**
   * Stops the VCF sync watcher service.
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
      console.log('Stopped VCF sync watcher');
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
   * - Storage method
   * - Watch folder path (VCF folder mode)
   * - VCF filename (single VCF mode)
   * - Polling interval
   * 
   * @param newSettings - The updated plugin settings
   * @returns Promise that resolves when settings are updated and watcher restarted if needed
   */
  async updateSettings(newSettings: ContactsPluginSettings): Promise<void> {
    const shouldRestart = 
      this.settings.vcfWatchEnabled !== newSettings.vcfWatchEnabled ||
      this.settings.vcfStorageMethod !== newSettings.vcfStorageMethod ||
      this.settings.vcfWatchFolder !== newSettings.vcfWatchFolder ||
      this.settings.vcfFilename !== newSettings.vcfFilename ||
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
   * Scans a single VCF file for changes and processes any modified contacts.
   * 
   * This method now delegates the VCF processing logic to the appropriate
   * manager classes for better separation of concerns.
   * 
   * @returns Promise that resolves when the scan is complete
   */
  private async scanSingleVCF(): Promise<void> {
    try {
      const vcfFilePath = this.settings.vcfFilename;
      if (!vcfFilePath) {
        return;
      }

      // Get file info for the single VCF file
      const fileInfo = await this.vcardManager.getVCardFileInfo(vcfFilePath);
      if (!fileInfo) {
        return;
      }

      const known = this.knownFiles.get(vcfFilePath);
      
      // Skip if file hasn't changed
      if (known && known.lastModified >= fileInfo.lastModified) {
        return;
      }

      console.log(`Processing single VCF file: ${vcfFilePath}`);

      // Use VcardManager to process VCF contents (no UID filtering for single VCF)
      const parsedEntries = await this.vcardManager.readAndParseVCard(vcfFilePath);
      if (!parsedEntries) {
        return;
      }

      // Filter to only valid entries (those with slug and UID)
      const vcfEntries = parsedEntries.filter(([slug, record]: [string, any]) => slug && record.UID);

      // Use ContactManager to process contact records and create/update contacts
      const contactsToProcess = await this.contactManager.processVCFContacts(
        vcfEntries, 
        this.app, 
        this.settings
      );

      // Trigger curator processors on all affected contacts
      if (contactsToProcess.length > 0) {
        console.log(`Triggering processors on ${contactsToProcess.length} contacts from ${vcfFilePath}`);
        
        // Get contacts data for insight processing
        const contacts = await this.contactManager.getFrontmatterFromFiles(contactsToProcess);
        
        // Trigger immediate processors (like VcfSyncPreProcessor)
        await curatorService.process(contacts, RunType.IMMEDIATELY);

        // Show notification for processed contacts
        new Notice(`VCF Sync: Processed ${contactsToProcess.length} contact(s) from ${vcfFilePath}`);
      }

      // Update tracking for this VCF file
      this.knownFiles.set(vcfFilePath, {
        path: vcfFilePath,
        lastModified: fileInfo.lastModified,
        uid: "" // Single VCF files contain multiple UIDs
      });

    } catch (error: any) {
      console.log(`Error scanning single VCF file: ${error.message}`);
    }
  }

  /**
   * Scans the configured VCF folder for changes and processes any modified files.
   * 
   * This method now delegates the scanning logic to VcardManager for better
   * separation of concerns and code reuse.
   * 
   * @returns Promise that resolves when the scan is complete
   */
  private async scanVCFFolder(): Promise<void> {
    try {
      // Use VcardManager to scan folder and get files that need processing
      const filesToProcess = await this.vcardManager.scanVCFFolder(this.knownFiles);
      
      if (filesToProcess.length === 0) {
        return;
      }

      // Process each file that needs updating
      for (const filePath of filesToProcess) {
        await this.processVCFFile(filePath);
      }

    } catch (error: any) {
      console.log(`Error scanning VCF folder: ${error.message}`);
    }
  }

  /**
   * Processes a single VCF file for changes and triggers curator processors.
   * 
   * This method now delegates the VCF processing logic to the appropriate
   * manager classes for better separation of concerns.
   * 
   * @param filePath - Full path to the VCF file to process
   * @returns Promise that resolves when file processing is complete
   */
  private async processVCFFile(filePath: string): Promise<void> {
    try {
      // Get file stats using VcardManager
      const fileInfo = await this.vcardManager.getVCardFileInfo(filePath);
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

      // Use VcardManager to process VCF contents
      const vcfEntries = await this.vcardManager.processVCFContents(filePath);
      if (vcfEntries.length === 0) {
        return;
      }

      // Use ContactManager to process contact records and create/update contacts
      const contactsToProcess = await this.contactManager.processVCFContacts(
        vcfEntries, 
        this.app, 
        this.settings
      );

      // Trigger curator processors on all affected contacts
      if (contactsToProcess.length > 0) {
        console.log(`Triggering processors on ${contactsToProcess.length} contacts from ${filename}`);
        
        // Get contacts data for insight processing
        const contacts = await this.contactManager.getFrontmatterFromFiles(contactsToProcess);
        
        // Trigger immediate processors (like VcfSyncPreProcessor)
        await curatorService.process(contacts, RunType.IMMEDIATELY);

        // Show notification for processed contacts
        new Notice(`VCF Sync: Processed ${contactsToProcess.length} contact(s) from ${filename}`);
      }

      // Update tracking for this VCF file
      this.knownFiles.set(filePath, {
        path: filePath,
        lastModified: fileInfo.lastModified,
        uid: "" // VCF files can contain multiple UIDs
      });

    } catch (error: any) {
      console.log(`Error processing VCF file ${filePath}: ${error.message}`);
    }
  }
}
