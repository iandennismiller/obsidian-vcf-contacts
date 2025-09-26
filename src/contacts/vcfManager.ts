import * as path from 'path';
import { VCFile, VCardForObsidianRecord } from './VCFile';
import { loggingService } from '../services/loggingService';
import { ContactsPluginSettings } from '../settings/settings.d';

/**
 * Information about a VCF file being managed
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
 * Manages a collection of VCF files in the VCF watch folder.
 * Provides high-level operations for managing VCF file collections
 * while delegating low-level file operations to VCardFileOps.
 */
export class VCFManager {
  private settings: ContactsPluginSettings;

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
      loggingService.debug(`[VCFManager] No watch folder configured`);
      return [];
    }

  return await VCFile.listVCFFiles(watchFolder);
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
      loggingService.info(`[VCFManager] Skipping ignored VCF file: ${filename}`);
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
      loggingService.info(`[VCFManager] Skipping ignored UID: ${uid}`);
    }
    
    return shouldIgnore;
  }

  /**
   * Gets file information for a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to VCF file info or null if error
   */
  async getVCFFileInfo(filePath: string): Promise<VCFFileInfo | null> {
    const vcFile = VCFile.fromPath(filePath);
    
    // Try to refresh stats, which will fail if file doesn't exist
    try {
      await vcFile.refreshStats();
      
      if (vcFile.lastModified === null) {
        return null;
      }

      return {
        path: filePath,
        lastModified: vcFile.lastModified,
        uid: vcFile.uid
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Reads and parses a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to parsed VCF content or null if error
   */
  async readAndParseVCF(filePath: string): Promise<Array<[string, any]> | null> {
    const vcFile = VCFile.fromPath(filePath);
    return await vcFile.parse();
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
      loggingService.error(`[VCFManager] No watch folder configured for writing VCF file`);
      return null;
    }

    const fullPath = path.join(watchFolder, filename);
    const vcFile = VCFile.fromContent(fullPath, content);
    const success = await vcFile.save();
    
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
        const vcFile = VCFile.fromPath(filePath);
        if (await vcFile.containsUID(uid)) {
          return filePath;
        }
      } catch (error) {
        loggingService.debug(`[VCFManager] Error reading VCF file ${filePath}: ${error.message}`);
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

  const exists = await VCFile.folderExists(watchFolder);
    if (!exists) {
      loggingService.warning(`[VCFManager] VCF watch folder does not exist: ${watchFolder}`);
    }
    
    return exists;
  }

  /**
   * Generates a VCF filename for a contact
   * 
   * @param contactNameOrRecord - The contact name or VCard record
   * @returns Sanitized VCF filename
   */
  generateVCFFilename(contactNameOrRecord: string | VCardForObsidianRecord): string {
    return VCFile.generateVCFFilename(contactNameOrRecord);
  }

  /**
   * Gets all VCF files with their information
   * 
   * @returns Promise resolving to array of VCF file information
   */
  async getAllVCFFiles(): Promise<VCFFileInfo[]> {
    const filePaths = await this.listVCFFiles();
    const fileInfos: VCFFileInfo[] = [];

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
   * Create a VCFile instance from a file path in the watch folder
   * 
   * @param filename - Name of the VCF file
   * @returns VCFile instance
   */
  createVCFile(filename: string): VCFile {
    const watchFolder = this.getWatchFolder();
    const fullPath = path.join(watchFolder, filename);
    return VCFile.fromPath(fullPath);
  }

  /**
   * Create a VCFile instance with content
   * 
   * @param filename - Name of the VCF file
   * @param content - VCF content
   * @returns VCFile instance
   */
  createVCFileWithContent(filename: string, content: string): VCFile {
    const watchFolder = this.getWatchFolder();
    const fullPath = path.join(watchFolder, filename);
    return VCFile.fromContent(fullPath, content);
  }

  /**
   * Get all VCF files as VCFile instances
   * 
   * @returns Promise resolving to array of VCFile instances
   */
  async getAllVCFiles(): Promise<VCFile[]> {
    const filePaths = await this.listVCFFiles();
    return filePaths.map(filePath => VCFile.fromPath(filePath));
  }

  /**
   * Get all VCF files as VCFile instances, filtered by ignore settings
   * 
   * @returns Promise resolving to array of VCFile instances
   */
  async getFilteredVCFiles(): Promise<VCFile[]> {
    const filePaths = await this.listVCFFiles();
    const filteredPaths = this.filterIgnoredFiles(filePaths);
    return filteredPaths.map(filePath => VCFile.fromPath(filePath));
  }

  /**
   * Read a VCF file and get the first record
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to the first VCard record or null if error
   */
  async getFirstVCFRecord(filePath: string): Promise<VCardForObsidianRecord | null> {
    const vcFile = VCFile.fromPath(filePath);
    return await vcFile.getFirstRecord();
  }

  /**
   * Read a VCF file and get all records
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to array of VCard records
   */
  async getAllVCFRecords(filePath: string): Promise<VCardForObsidianRecord[]> {
    const vcFile = VCFile.fromPath(filePath);
    return await vcFile.getAllRecords();
  }
}