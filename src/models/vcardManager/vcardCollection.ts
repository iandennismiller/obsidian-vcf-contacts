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
   * Lists all VCard files in the watch folder
   * 
   * @returns Promise resolving to array of full file paths to VCard files
   */
  async listVCardFiles(): Promise<string[]> {
    const watchFolder = this.getWatchFolder();
    if (!watchFolder) {
      return [];
    }

    return VCardFileOperations.listVCFFiles(watchFolder);
  }

  /**
   * Gets file information for a VCard file
   * 
   * @param filePath - Full path to the VCard file
   * @returns Promise resolving to VCard file info or null if error
   */
  async getVCardFileInfo(filePath: string): Promise<VCardFileInfo | null> {
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
   * Gets all VCard files with their information
   * 
   * @returns Promise resolving to array of VCard file information
   */
  async getAllVCardFiles(): Promise<VCardFileInfo[]> {
    const filePaths = await this.listVCardFiles();
    const fileInfos: VCardFileInfo[] = [];

    for (const filePath of filePaths) {
      const fileInfo = await this.getVCardFileInfo(filePath);
      if (fileInfo) {
        fileInfos.push(fileInfo);
      }
    }

    return fileInfos;
  }

  /**
   * Filters VCard files based on ignore settings
   * 
   * @param filePaths - Array of VCard file paths to filter
   * @returns Array of file paths that should not be ignored
   */
  filterIgnoredFiles(filePaths: string[]): string[] {
    return filePaths.filter(filePath => !this.shouldIgnoreFile(filePath));
  }

  /**
   * Finds a VCard file in the watch folder that contains the specified UID
   * 
   * @param uid - The UID to search for in VCard files
   * @returns Promise resolving to the file path or null if not found
   */
  async findVCardFileByUID(uid: string): Promise<string | null> {
    const vcfFiles = await this.listVCardFiles();
    
    for (const filePath of vcfFiles) {
      try {
        const content = await VCardFileOperations.readVCFFile(filePath);
        if (content && VCardFileOperations.containsUID(content, uid)) {
          return filePath;
        }
      } catch (error: any) {
        // Continue searching other files
      }
    }

    return null;
  }

  /**
   * Reads and parses a VCard file
   * 
   * @param filePath - Full path to the VCard file
   * @returns Promise resolving to parsed VCard content or null if error
   */
  async readAndParseVCard(filePath: string): Promise<Array<[string, VCardForObsidianRecord]> | null> {
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
    } catch (error: any) {
      console.debug(`[VCardCollection] Error parsing VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }
}