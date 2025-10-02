import * as path from 'path';
import { VCardFileOperations } from '../vcardFile/fileOperations';

/**
 * File operations for VCard manager
 * Handles file system operations specific to the manager's responsibilities
 */
export class VCardManagerFileOperations {
  constructor(
    private getWatchFolder: () => string,
    private shouldIgnoreFile: (filePath: string) => boolean,
    private shouldIgnoreUID: (uid: string) => boolean
  ) {}

  /**
   * Writes VCard content to a file in the watch folder
   * 
   * @param filename - Name of the VCard file (with .vcf extension)
   * @param content - VCard content to write
   * @returns Promise resolving to the full path if successful, null otherwise
   */
  async writeVCardFile(filename: string, content: string): Promise<string | null> {
    const watchFolder = this.getWatchFolder();
    if (!watchFolder) {
      console.debug(`[VCardManagerFileOperations] No watch folder configured for writing VCard file`);
      return null;
    }

    const fullPath = path.join(watchFolder, filename);
    const success = await VCardFileOperations.writeVCFFile(fullPath, content);
    
    return success ? fullPath : null;
  }

  /**
   * Checks if the VCard watch folder exists
   * 
   * @returns Promise resolving to true if folder exists, false otherwise
   */
  async watchFolderExists(): Promise<boolean> {
    const watchFolder = this.getWatchFolder();
    if (!watchFolder) {
      return false;
    }

    const exists = await VCardFileOperations.folderExists(watchFolder);
    if (!exists) {
      console.debug(`[VCardManagerFileOperations] VCF watch folder does not exist: ${watchFolder}`);
    }
    
    return exists;
  }

  /**
   * Generates a VCard filename for a contact
   * 
   * @param contactName - The contact name
   * @returns Sanitized VCard filename
   */
  generateVCardFilename(contactName: string): string {
    return VCardFileOperations.generateVCFFilename(contactName);
  }
}