import * as path from 'path';
import { VcardFile } from './vcardFile';
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
 * while delegating low-level file operations to VcardFile.
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
        parsedEntries.push(entry);
      }
      return parsedEntries;
    } catch (error) {
      loggingService.error(`[VCFManager] Error parsing VCF file ${filePath}: ${error.message}`);
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
      loggingService.error(`[VCFManager] No watch folder configured for writing VCF file`);
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

    const exists = await VcardFile.folderExists(watchFolder);
    if (!exists) {
      loggingService.warning(`[VCFManager] VCF watch folder does not exist: ${watchFolder}`);
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
}