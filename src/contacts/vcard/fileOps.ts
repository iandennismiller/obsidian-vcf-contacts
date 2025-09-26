import * as fs from 'fs/promises';
import * as path from 'path';
import { loggingService } from '../../services/loggingService';

/**
 * Low-level VCF file operations
 * These are basic file system operations for VCF files without business logic
 */
export class VCardFileOps {
  /**
   * Lists all VCF files in the specified folder.
   * 
   * @param folderPath - The folder path to scan for VCF files
   * @returns Promise resolving to array of full file paths to VCF files
   */
  static async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      if (!entries || !Array.isArray(entries)) {
        loggingService.debug(`[VCardFileOps] No entries returned from readdir for ${folderPath}`);
        return [];
      }
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error) {
      loggingService.error(`[VCardFileOps] Error listing VCF files: ${error.message}`);
      return [];
    }
  }

  /**
   * Gets file statistics for a VCF file
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to file stats or null if error
   */
  static async getFileStats(filePath: string): Promise<{ mtimeMs: number } | null> {
    try {
      const stat = await fs.stat(filePath);
      return stat ? { mtimeMs: stat.mtimeMs } : null;
    } catch (error) {
      loggingService.debug(`[VCardFileOps] Error getting file stats for ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Reads VCF file content
   * 
   * @param filePath - Full path to the VCF file
   * @returns Promise resolving to file content or null if error
   */
  static async readVCFFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        loggingService.warning(`[VCardFileOps] Empty or unreadable VCF file: ${path.basename(filePath)}`);
        return null;
      }
      return content;
    } catch (error) {
      loggingService.error(`[VCardFileOps] Error reading VCF file ${filePath}: ${error.message}`);
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
  static async writeVCFFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      loggingService.debug(`[VCardFileOps] Successfully wrote VCF file: ${filePath}`);
      return true;
    } catch (error) {
      loggingService.error(`[VCardFileOps] Error writing VCF file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Checks if a folder exists
   * 
   * @param folderPath - Path to check
   * @returns Promise resolving to true if folder exists, false otherwise
   */
  static async folderExists(folderPath: string): Promise<boolean> {
    if (!folderPath) {
      return false;
    }

    try {
      await fs.access(folderPath);
      return true;
    } catch (error) {
      loggingService.debug(`[VCardFileOps] Folder does not exist: ${folderPath}`);
      return false;
    }
  }

  /**
   * Searches for a UID within VCF file content
   * 
   * @param content - VCF file content
   * @param uid - UID to search for
   * @returns true if UID is found in the content
   */
  static containsUID(content: string, uid: string): boolean {
    return content.includes(`UID:${uid}`);
  }

  /**
   * Generates a sanitized filename for a VCF file based on contact name
   * 
   * @param contactName - The contact name/basename
   * @returns Sanitized filename for the VCF file
   */
  static generateVCFFilename(contactName: string): string {
    const sanitizedName = contactName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitizedName}.vcf`;
  }
}