import * as fs from 'fs/promises';
import * as path from 'path';
import { loggingService } from '../services/loggingService';
import { ContactsPluginSettings } from '../settings/settings.d';

/**
 * Information about a VCF file being tracked
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
 * Utilities for VCF file processing and management
 */
export class VCFUtils {
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
   * Lists all VCF files in the specified folder.
   * 
   * Filters directory entries to include only:
   * - Regular files (not directories)
   * - Files with .vcf extension (case insensitive)
   * 
   * @param folderPath - The folder path to scan for VCF files
   * @returns Promise resolving to array of full file paths to VCF files
   */
  async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      if (!entries || !Array.isArray(entries)) {
        loggingService.debug(`[VCFUtils] No entries returned from readdir for ${folderPath}`);
        return [];
      }
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error) {
      loggingService.error(`[VCFUtils] Error listing VCF files: ${error.message}`);
      return [];
    }
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
      loggingService.info(`[VCFUtils] Skipping ignored VCF file: ${filename}`);
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
      loggingService.info(`[VCFUtils] Skipping ignored UID: ${uid}`);
    }
    
    return shouldIgnore;
  }

  /**
   * Gets file statistics for a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to file stats or null if error
   */
  async getFileStats(filePath: string): Promise<{ mtimeMs: number } | null> {
    try {
      const stat = await fs.stat(filePath);
      return stat ? { mtimeMs: stat.mtimeMs } : null;
    } catch (error) {
      loggingService.debug(`[VCFUtils] Error getting file stats for ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Reads VCF file content
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to file content or null if error
   */
  async readVCFFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        loggingService.warning(`[VCFUtils] Empty or unreadable VCF file: ${path.basename(filePath)}`);
        return null;
      }
      return content;
    } catch (error) {
      loggingService.error(`[VCFUtils] Error reading VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Writes content to a VCF file
   * 
   * @param filePath - Full path where to write the VCF file
   * @param content - VCF content to write
   * @returns Promise resolving to true if successful, false otherwise
   */
  async writeVCFFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      loggingService.debug(`[VCFUtils] Successfully wrote VCF file: ${filePath}`);
      return true;
    } catch (error) {
      loggingService.error(`[VCFUtils] Error writing VCF file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Finds a VCF file in the watch folder that contains the specified UID.
   * 
   * Searches all VCF files in the configured watch folder for one that
   * contains the given UID in its content.
   * 
   * @param uid - The UID to search for in VCF files
   * @returns Promise resolving to the file path or null if not found
   */
  async findVCFFileByUID(uid: string): Promise<string | null> {
    if (!this.settings.vcfWatchFolder) {
      return null;
    }

    try {
      const vcfFiles = await this.listVCFFiles(this.settings.vcfWatchFolder);
      
      for (const filePath of vcfFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.includes(`UID:${uid}`)) {
            return filePath;
          }
        } catch (error) {
          loggingService.debug(`[VCFUtils] Error reading VCF file ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      loggingService.debug(`[VCFUtils] Error searching for VCF file with UID ${uid}: ${error.message}`);
    }

    return null;
  }

  /**
   * Checks if VCF watch folder exists
   * 
   * @returns Promise resolving to true if folder exists, false otherwise
   */
  async checkWatchFolderExists(): Promise<boolean> {
    if (!this.settings.vcfWatchFolder) {
      return false;
    }

    try {
      await fs.access(this.settings.vcfWatchFolder);
      return true;
    } catch (error) {
      loggingService.warning(`[VCFUtils] VCF watch folder does not exist: ${this.settings.vcfWatchFolder}`);
      return false;
    }
  }

  /**
   * Generates a sanitized filename for a VCF file based on contact name
   * 
   * @param contactName - The contact name/basename
   * @returns Sanitized filename for the VCF file
   */
  generateVCFFilename(contactName: string): string {
    const sanitizedName = contactName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitizedName}.vcf`;
  }
}