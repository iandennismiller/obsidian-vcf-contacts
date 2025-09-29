import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Static file operations for VCard files
 * These are utility methods that don't operate on a specific VCard instance
 */
export class VCardFileOperations {
  /**
   * Lists all VCF files in the specified folder
   */
  static async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      if (!entries || !Array.isArray(entries)) {
        return [];
      }
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error) {
      console.log(`[VCardFileOperations] Error listing VCF files: ${error.message}`);
      return [];
    }
  }

  /**
   * Gets file statistics for a VCF file
   */
  static async getFileStats(filePath: string): Promise<{ mtimeMs: number } | null> {
    try {
      const stat = await fs.stat(filePath);
      return stat ? { mtimeMs: stat.mtimeMs } : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks if a folder exists
   */
  static async folderExists(folderPath: string): Promise<boolean> {
    if (!folderPath) {
      return false;
    }

    try {
      await fs.access(folderPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Searches for a UID within VCF file content
   */
  static containsUID(content: string, uid: string): boolean {
    return content.includes(`UID:${uid}`);
  }

  /**
   * Generates a sanitized filename for a VCF file based on contact name
   */
  static generateVCFFilename(contactName: string): string {
    const sanitizedName = contactName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitizedName}.vcf`;
  }

  /**
   * Reads VCF file content
   */
  static async readVCFFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        console.log(`[VCardFileOperations] Empty or unreadable VCF file: ${path.basename(filePath)}`);
        return null;
      }
      return content;
    } catch (error) {
      console.log(`[VCardFileOperations] Error reading VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Writes content to a VCF file
   */
  static async writeVCFFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.log(`[VCardFileOperations] Error writing VCF file ${filePath}: ${error.message}`);
      return false;
    }
  }
}