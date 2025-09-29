import * as path from 'path';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { VCardWriteQueue } from './writeQueue';
import { VCardCollection, VCardFileInfo } from './vcardCollection';
import { VCardManagerFileOperations } from './fileOperations';
import { VCardForObsidianRecord } from '../vcardFile';

/**
 * Manages a collection of VCard files in the VCard watch folder.
 * Provides high-level operations for managing VCard file collections
 * while delegating low-level file operations to VcardFile.
 * Includes a write queue for controlled updates to VCard files.
 */
export class VcardManager {
  private settings: ContactsPluginSettings;
  private writeQueue: VCardWriteQueue;
  private collection: VCardCollection;
  private fileOps: VCardManagerFileOperations;

  constructor(settings: ContactsPluginSettings) {
    this.settings = settings;
    
    // Initialize sub-components with necessary callbacks
    this.collection = new VCardCollection(
      () => this.getWatchFolder(),
      (filePath) => this.shouldIgnoreFile(filePath)
    );
    
    this.fileOps = new VCardManagerFileOperations(
      () => this.getWatchFolder(),
      (filePath) => this.shouldIgnoreFile(filePath),
      (uid) => this.shouldIgnoreUID(uid)
    );
    
    this.writeQueue = new VCardWriteQueue(
      () => this.getWatchFolder(),
      (uid) => this.collection.findVCardFileByUID(uid),
      (filename, content) => this.fileOps.writeVCardFile(filename, content)
    );
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
  }

  /**
   * Get the VCF watch folder path from settings
   */
  getWatchFolder(): string {
    return this.settings.vcfWatchFolder || '';
  }

  /**
   * Checks if a VCF file should be ignored based on filename
   * 
   * @param filePath - Full path to the VCF file
   * @returns true if the file should be ignored
   */
  shouldIgnoreFile(filePath: string): boolean {
    const filename = path.basename(filePath);
    const shouldIgnore = this.settings.vcfIgnoreFilenames.includes(filename);
    
    if (shouldIgnore) {
      // Skipping ignored VCF file
    }
    
    return shouldIgnore;
  }

  /**
   * Checks if a UID should be ignored based on settings
   * 
   * @param uid - The UID to check
   * @returns true if the UID should be ignored
   */
  shouldIgnoreUID(uid: string): boolean {
    const shouldIgnore = this.settings.vcfIgnoreUIDs.includes(uid);
    
    if (shouldIgnore) {
      // Skipping ignored UID
    }
    
    return shouldIgnore;
  }

  // Delegate collection operations
  
  /**
   * Lists all VCard files in the watch folder
   */
  async listVCardFiles(): Promise<string[]> {
    return this.collection.listVCardFiles();
  }

  /**
   * Gets file information for a VCard file
   */
  async getVCardFileInfo(filePath: string): Promise<VCardFileInfo | null> {
    return this.collection.getVCardFileInfo(filePath);
  }

  /**
   * Reads and parses a VCard file
   */
  async readAndParseVCard(filePath: string): Promise<Array<[string, VCardForObsidianRecord]> | null> {
    return this.collection.readAndParseVCard(filePath);
  }

  /**
   * Finds a VCard file in the watch folder that contains the specified UID
   */
  async findVCardFileByUID(uid: string): Promise<string | null> {
    return this.collection.findVCardFileByUID(uid);
  }

  /**
   * Gets all VCard files with their information
   */
  async getAllVCardFiles(): Promise<VCardFileInfo[]> {
    return this.collection.getAllVCardFiles();
  }

  /**
   * Filters VCard files based on ignore settings
   */
  filterIgnoredFiles(filePaths: string[]): string[] {
    return this.collection.filterIgnoredFiles(filePaths);
  }

  // Delegate file operations

  /**
   * Writes VCard content to a file in the watch folder
   */
  async writeVCardFile(filename: string, content: string): Promise<string | null> {
    return this.fileOps.writeVCardFile(filename, content);
  }

  /**
   * Checks if the VCard watch folder exists
   */
  async watchFolderExists(): Promise<boolean> {
    return this.fileOps.watchFolderExists();
  }

  /**
   * Generates a VCard filename for a contact
   */
  generateVCardFilename(contactName: string): string {
    return this.fileOps.generateVCardFilename(contactName);
  }

  // Delegate write queue operations

  /**
   * Add a VCard to the write queue for controlled updates
   */
  async queueVcardWrite(uid: string, vcardData: string): Promise<void> {
    return this.writeQueue.queueVcardWrite(uid, vcardData);
  }

  /**
   * Get the current write queue status
   */
  getWriteQueueStatus(): { size: number; processing: boolean } {
    return this.writeQueue.getStatus();
  }

  /**
   * Clear the write queue (for testing or emergency purposes)
   */
  clearWriteQueue(): void {
    this.writeQueue.clear();
  }

  // ============================================================================
  // VCF Scanning and Processing Methods
  // ============================================================================

  /**
   * Scans the VCF watch folder for changes and returns files that need processing.
   * 
   * This method handles the complete folder scanning logic that was previously
   * duplicated in syncWatcher. It checks folder existence, lists files, and
   * returns only those files that have been modified since last known state.
   * 
   * @param knownFiles - Map of known file states for change detection
   * @returns Promise resolving to array of file paths that need processing
   */
  async scanVCFFolder(knownFiles: Map<string, VCardFileInfo>): Promise<string[]> {
    try {
      // Check if folder exists
      const folderExists = await this.watchFolderExists();
      if (!folderExists) {
        return [];
      }

      // Get list of files in the folder
      const files = await this.listVCFFiles();
      
      if (files.length === 0) {
        return [];
      }

      // Filter files that need processing (modified or new)
      const filesToProcess: string[] = [];
      
      for (const filePath of files) {
        // Check if this filename should be ignored
        if (this.shouldIgnoreFile(filePath)) {
          continue;
        }

        // Get file stats
        const fileInfo = await this.getVCardFileInfo(filePath);
        if (!fileInfo) {
          continue;
        }

        const known = knownFiles.get(filePath);
        
        // Include if file is new or has been modified
        if (!known || known.lastModified < fileInfo.lastModified) {
          filesToProcess.push(filePath);
        }
      }

      return filesToProcess;

    } catch (error) {
      console.log(`[VcardManager] Error scanning VCF folder: ${error.message}`);
      return [];
    }
  }

  /**
   * Processes VCF file contents and returns contact records that need processing.
   * 
   * This method handles the core VCF processing logic that was previously
   * duplicated in syncWatcher. It reads, parses, and filters VCF content
   * based on ignore settings.
   * 
   * @param filePath - Path to the VCF file to process
   * @returns Promise resolving to array of [slug, record] tuples for valid contacts
   */
  async processVCFContents(filePath: string): Promise<Array<[string, VCardForObsidianRecord]>> {
    try {
      // Read and parse VCF content
      const parsedEntries = await this.readAndParseVCF(filePath);
      if (!parsedEntries) {
        return [];
      }

      // Filter entries based on ignore settings
      const validEntries: Array<[string, VCardForObsidianRecord]> = [];

      for (const [slug, record] of parsedEntries) {
        if (slug && record.UID) {
          // Check if this UID should be ignored
          if (this.shouldIgnoreUID(record.UID)) {
            continue;
          }
          validEntries.push([slug, record]);
        }
      }

      return validEntries;

    } catch (error) {
      console.log(`[VcardManager] Error processing VCF file ${filePath}: ${error.message}`);
      return [];
    }
  }
}