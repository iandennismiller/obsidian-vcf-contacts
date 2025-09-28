import * as path from 'path';
import { VcardFile } from './vcardFile';
import { ContactsPluginSettings } from './settings/settings.d';

/**
 * Information about a VCard file being managed
 */
export interface VCardFileInfo {
  /** Full file system path to the VCard file */
  path: string;
  /** Last modified timestamp in milliseconds */
  lastModified: number;
  /** Optional UID associated with this file */
  uid?: string;
}

/**
 * Manages a collection of VCard files in the VCard watch folder.
 * Provides high-level operations for managing VCard file collections
 * while delegating low-level file operations to VcardFile.
 * Includes a write queue for controlled updates to VCard files.
 */
export class VcardManager {
  private settings: ContactsPluginSettings;
  private writeQueue: Map<string, { vcardData: string; timestamp: number }> = new Map();
  private processingQueue: boolean = false;

  constructor(settings: ContactsPluginSettings) {
    this.settings = settings;
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
   * Lists all VCF files in the watch folder
   * 
   * @returns Promise resolving to array of full file paths to VCF files
   */
  async listVCFFiles(): Promise<string[]> {
    const watchFolder = this.getWatchFolder();
    if (!watchFolder) {

      return [];
    }

    return VcardFile.listVCFFiles(watchFolder);
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

  /**
   * Gets file information for a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to VCF file info or null if error
   */
  async getVCFFileInfo(filePath: string): Promise<VCardFileInfo | null> {
    const stats = await VcardFile.getFileStats(filePath);
    if (!stats) {
      return null;
    }

    return {
      path: filePath,
      lastModified: stats.mtimeMs,
      uid: undefined // UID would need to be parsed from content
    };
  }

  /**
   * Reads and parses a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to parsed VCF content or null if error
   */
  async readAndParseVCF(filePath: string): Promise<Array<[string, any]> | null> {
    const content = await VcardFile.readVCFFile(filePath);
    if (!content) {
      return null;
    }

    try {
      const parsedEntries: Array<[string, any]> = [];
      const vcardFile = new VcardFile(content);
      for await (const entry of vcardFile.parse()) {
        if (entry[0]) { // Only push entries with valid slugs
          parsedEntries.push(entry);
        }
      }
      return parsedEntries;
    } catch (error) {
      console.log(`[VCFManager] Error parsing VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Writes VCF content to a file in the watch folder
   * 
   * @param filename - Name of the VCF file (with .vcf extension)
   * @param content - VCF content to write
   * @returns Promise resolving to the full path if successful, null otherwise
   */
  async writeVCFFile(filename: string, content: string): Promise<string | null> {
    const watchFolder = this.getWatchFolder();
    if (!watchFolder) {
      console.log(`[VCFManager] No watch folder configured for writing VCF file`);
      return null;
    }

    const fullPath = path.join(watchFolder, filename);
    const success = await VcardFile.writeVCFFile(fullPath, content);
    
    return success ? fullPath : null;
  }

  /**
   * Finds a VCF file in the watch folder that contains the specified UID
   * 
   * @param uid - The UID to search for in VCF files
   * @returns Promise resolving to the file path or null if not found
   */
  async findVCFFileByUID(uid: string): Promise<string | null> {
    const vcfFiles = await this.listVCFFiles();
    
    for (const filePath of vcfFiles) {
      try {
        const content = await VcardFile.readVCFFile(filePath);
        if (content && VcardFile.containsUID(content, uid)) {
          return filePath;
        }
      } catch (error) {

      }
    }

    return null;
  }

  /**
   * Checks if the VCF watch folder exists
   * 
   * @returns Promise resolving to true if folder exists, false otherwise
   */
  async watchFolderExists(): Promise<boolean> {
    const watchFolder = this.getWatchFolder();
    if (!watchFolder) {
      return false;
    }

    const exists = await VcardFile.folderExists(watchFolder);
    if (!exists) {
      console.log(`[VCFManager] VCF watch folder does not exist: ${watchFolder}`);
    }
    
    return exists;
  }

  /**
   * Generates a VCF filename for a contact
   * 
   * @param contactName - The contact name
   * @returns Sanitized VCF filename
   */
  generateVCFFilename(contactName: string): string {
    return VcardFile.generateVCFFilename(contactName);
  }

  /**
   * Gets all VCF files with their information
   * 
   * @returns Promise resolving to array of VCF file information
   */
  async getAllVCFFiles(): Promise<VCardFileInfo[]> {
    const filePaths = await this.listVCFFiles();
    const fileInfos: VCardFileInfo[] = [];

    for (const filePath of filePaths) {
      const fileInfo = await this.getVCFFileInfo(filePath);
      if (fileInfo) {
        fileInfos.push(fileInfo);
      }
    }

    return fileInfos;
  }

  /**
   * Filters VCF files based on ignore settings
   * 
   * @param filePaths - Array of VCF file paths to filter
   * @returns Array of file paths that should not be ignored
   */
  filterIgnoredFiles(filePaths: string[]): string[] {
    return filePaths.filter(filePath => !this.shouldIgnoreFile(filePath));
  }

  /**
   * Add a VCard to the write queue for controlled updates.
   * If the VCard is already in the queue, it moves to the end.
   * 
   * @param uid - Unique identifier for the VCard
   * @param vcardData - VCard data to write
   * @returns Promise that resolves when the VCard is queued
   */
  async queueVcardWrite(uid: string, vcardData: string): Promise<void> {
    // Remove existing entry if present (moves to end of queue)
    if (this.writeQueue.has(uid)) {
      this.writeQueue.delete(uid);
    }
    
    // Add to end of queue
    this.writeQueue.set(uid, {
      vcardData,
      timestamp: Date.now()
    });
    
    console.log(`[VcardManager] Queued VCard write for UID: ${uid} (queue size: ${this.writeQueue.size})`);
    
    // Process the queue if not already processing
    if (!this.processingQueue) {
      this.processWriteQueue();
    }
  }

  /**
   * Process the write queue by writing VCards to the filesystem
   */
  private async processWriteQueue(): Promise<void> {
    if (this.processingQueue || this.writeQueue.size === 0) {
      return;
    }

    this.processingQueue = true;
    console.log(`[VcardManager] Processing write queue with ${this.writeQueue.size} items`);

    try {
      // Process all items in the queue
      const queueEntries = Array.from(this.writeQueue.entries());
      
      for (const [uid, queueItem] of queueEntries) {
        try {
          // Find existing VCard file by UID
          const existingPath = await this.findVCFFileByUID(uid);
          let targetPath: string;

          if (existingPath) {
            // Update existing file
            targetPath = existingPath;
          } else {
            // Create new file with UID-based name
            const filename = `contact-${uid}.vcf`;
            targetPath = path.join(this.getWatchFolder(), filename);
          }

          // Write VCard data to file
          const success = await this.writeVCFFile(path.basename(targetPath), queueItem.vcardData);
          
          if (success) {
            console.log(`[VcardManager] Successfully wrote VCard to: ${targetPath}`);
            this.writeQueue.delete(uid);
          } else {
            console.log(`[VcardManager] Failed to write VCard for UID: ${uid}`);
          }
          
        } catch (error) {
          console.log(`[VcardManager] Error writing VCard for UID ${uid}: ${error.message}`);
          this.writeQueue.delete(uid); // Remove failed items
        }
      }
      
    } catch (error) {
      console.log(`[VcardManager] Error processing write queue: ${error.message}`);
    } finally {
      this.processingQueue = false;
      
      // If there are still items in the queue, schedule another processing
      if (this.writeQueue.size > 0) {
        setTimeout(() => this.processWriteQueue(), 1000);
      }
    }
  }

  /**
   * Get the current write queue status
   */
  getWriteQueueStatus(): { size: number; processing: boolean } {
    return {
      size: this.writeQueue.size,
      processing: this.processingQueue
    };
  }

  /**
   * Clear the write queue (for testing or emergency purposes)
   */
  clearWriteQueue(): void {
    this.writeQueue.clear();
    console.log(`[VcardManager] Write queue cleared`);
  }
}