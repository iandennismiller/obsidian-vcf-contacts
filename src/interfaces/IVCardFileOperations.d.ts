/**
 * @fileoverview Interface definition for VCard file system operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that handle file system interactions.
 * 
 * @module IVCardFileOperations
 */

/**
 * Interface for VCard file system operations.
 * Defines the contract for classes that handle file system interactions.
 * 
 * @interface IVCardFileOperations
 */
export interface IVCardFileOperations {
  /**
   * Lists all VCF files in the specified folder.
   * @param folderPath - Path to search for VCF files
   * @returns Promise resolving to array of full file paths
   */
  listVCFFiles(folderPath: string): Promise<string[]>;

  /**
   * Gets file statistics for a VCF file.
   * @param filePath - Path to the VCF file
   * @returns Promise resolving to file stats or null if error
   */
  getFileStats(filePath: string): Promise<{ mtimeMs: number } | null>;

  /**
   * Checks if a folder exists.
   * @param folderPath - Path to check
   * @returns Promise resolving to true if folder exists
   */
  folderExists(folderPath: string): Promise<boolean>;

  /**
   * Searches for a UID within VCF file content.
   * @param content - VCF file content to search
   * @param uid - UID to search for
   * @returns True if UID is found in content
   */
  containsUID(content: string, uid: string): boolean;

  /**
   * Generates a sanitized filename for a VCF file.
   * @param contactName - Contact name to base filename on
   * @returns Sanitized filename with .vcf extension
   */
  generateVCFFilename(contactName: string): string;

  /**
   * Reads VCF file content from disk.
   * @param filePath - Path to VCF file
   * @returns Promise resolving to file content or null if error
   */
  readVCFFile(filePath: string): Promise<string | null>;

  /**
   * Writes content to a VCF file.
   * @param filePath - Path where to write the file
   * @param content - VCF content to write
   * @returns Promise resolving to true if write was successful
   */
  writeVCFFile(filePath: string, content: string): Promise<boolean>;
}