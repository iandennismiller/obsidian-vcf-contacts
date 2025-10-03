import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Static file operations for VCard files
 * These are utility methods that don't operate on a specific VCard instance
 */
export class VCardFileOperations {
  /**
   * Lists all vcard files in the specified folder
   */
  static async listVcardFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      if (!entries || !Array.isArray(entries)) {
        return [];
      }
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error: any) {
      console.debug(`[VCardFileOperations] Error listing vcard files: ${error.message}`);
      return [];
    }
  }

  /**
   * Gets file statistics for a vcard file
   */
  static async getFileStats(filePath: string): Promise<{ mtimeMs: number } | null> {
    try {
      const stat = await fs.stat(filePath);
      return stat ? { mtimeMs: stat.mtimeMs } : null;
    } catch (error: any) {
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
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Searches for a UID within vcard file content
   */
  static containsUID(content: string, uid: string): boolean {
    return content.includes(`UID:${uid}`);
  }

  /**
   * Generates a sanitized filename for a vcard file based on contact name
   */
  static generateVcardFilename(contactName: string): string {
    const sanitizedName = contactName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitizedName}.vcf`;
  }

  /**
   * Reads vcard file content
   */
  static async readVcardFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        console.debug(`[VCardFileOperations] Empty or unreadable vcard file: ${path.basename(filePath)}`);
        return null;
      }
      return content;
    } catch (error: any) {
      console.debug(`[VCardFileOperations] Error reading vcard file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Writes content to a vcard file
   */
  static async writeVcardFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error: any) {
      console.debug(`[VCardFileOperations] Error writing vcard file ${filePath}: ${error.message}`);
      return false;
    }
  }
}