import * as path from 'path';
import { VCardFileOperations } from '../vcardFile/fileOperations';
import { VcardFile, VCardForObsidianRecord } from '../vcardFile';

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
 * Manages operations that involve collections of VCard files
 * Focuses on operations that work across multiple VCard files
 */
export class VCardCollection {
  constructor(
    private getWatchFolder: () => string,
    private shouldIgnoreFile: (filePath: string) => boolean
  ) {}

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

    return VCardFileOperations.listVCFFiles(watchFolder);
  }

  /**
   * Gets file information for a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to VCF file info or null if error
   */
  async getVCFFileInfo(filePath: string): Promise<VCardFileInfo | null> {
    const stats = await VCardFileOperations.getFileStats(filePath);
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
   * Finds a VCF file in the watch folder that contains the specified UID
   * 
   * @param uid - The UID to search for in VCF files
   * @returns Promise resolving to the file path or null if not found
   */
  async findVCFFileByUID(uid: string): Promise<string | null> {
    const vcfFiles = await this.listVCFFiles();
    
    for (const filePath of vcfFiles) {
      try {
        const content = await VCardFileOperations.readVCFFile(filePath);
        if (content && VCardFileOperations.containsUID(content, uid)) {
          return filePath;
        }
      } catch (error) {
        // Continue searching other files
      }
    }

    return null;
  }

  /**
   * Reads and parses a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to parsed VCF content or null if error
   */
  async readAndParseVCF(filePath: string): Promise<Array<[string, VCardForObsidianRecord]> | null> {
    const content = await VCardFileOperations.readVCFFile(filePath);
    if (!content) {
      return null;
    }

    try {
      const parsedEntries: Array<[string, VCardForObsidianRecord]> = [];
      const vcardFile = new VcardFile(content);
      for await (const entry of vcardFile.parse()) {
        if (entry[0]) { // Only push entries with valid slugs
          // entry[0] is guaranteed to be string here
          parsedEntries.push([entry[0] as string, entry[1]]);
        }
      }
      return parsedEntries;
    } catch (error) {
      console.log(`[VCardCollection] Error parsing VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }
}