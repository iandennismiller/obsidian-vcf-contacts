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
      (uid) => this.collection.findVCFFileByUID(uid),
      (filename, content) => this.fileOps.writeVCFFile(filename, content)
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
   * Lists all VCF files in the watch folder
   */
  async listVCFFiles(): Promise<string[]> {
    return this.collection.listVCFFiles();
  }

  /**
   * Gets file information for a VCF file
   */
  async getVCFFileInfo(filePath: string): Promise<VCardFileInfo | null> {
    return this.collection.getVCFFileInfo(filePath);
  }

  /**
   * Reads and parses a VCF file
   */
  async readAndParseVCF(filePath: string): Promise<Array<[string, VCardForObsidianRecord]> | null> {
    return this.collection.readAndParseVCF(filePath);
  }

  /**
   * Finds a VCF file in the watch folder that contains the specified UID
   */
  async findVCFFileByUID(uid: string): Promise<string | null> {
    return this.collection.findVCFFileByUID(uid);
  }

  /**
   * Gets all VCF files with their information
   */
  async getAllVCFFiles(): Promise<VCardFileInfo[]> {
    return this.collection.getAllVCFFiles();
  }

  /**
   * Filters VCF files based on ignore settings
   */
  filterIgnoredFiles(filePaths: string[]): string[] {
    return this.collection.filterIgnoredFiles(filePaths);
  }

  // Delegate file operations

  /**
   * Writes VCF content to a file in the watch folder
   */
  async writeVCFFile(filename: string, content: string): Promise<string | null> {
    return this.fileOps.writeVCFFile(filename, content);
  }

  /**
   * Checks if the VCF watch folder exists
   */
  async watchFolderExists(): Promise<boolean> {
    return this.fileOps.watchFolderExists();
  }

  /**
   * Generates a VCF filename for a contact
   */
  generateVCFFilename(contactName: string): string {
    return this.fileOps.generateVCFFilename(contactName);
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
}