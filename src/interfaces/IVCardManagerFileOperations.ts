/**
 * @fileoverview Interface definition for VCard manager file operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for manager-specific file operations.
 * 
 * @module IVCardManagerFileOperations
 */

/**
 * Interface for VCard manager file operations.
 * Defines the contract for manager-specific file operations.
 * 
 * @interface IVCardManagerFileOperations
 */
export interface IVCardManagerFileOperations {
  /**
   * Writes VCard content to a file in the watch folder.
   * @param filename - Name of the VCard file
   * @param content - VCard content to write
   * @returns Promise resolving to full path if successful
   */
  writeVCardFile(filename: string, content: string): Promise<string | null>;

  /**
   * Checks if the VCard watch folder exists.
   * @returns Promise resolving to true if folder exists
   */
  watchFolderExists(): Promise<boolean>;

  /**
   * Generates a VCard filename for a contact.
   * @param contactName - The contact name
   * @returns Sanitized VCard filename
   */
  generateVCardFilename(contactName: string): string;
}