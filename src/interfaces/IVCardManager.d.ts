/**
 * @fileoverview Interface definition for VCardManager class
 * 
 * Defines the contract for classes that manage collections of VCard files.
 * 
 * @module IVCardManager
 */

import { VCardForObsidianRecord } from '../models/vcardFile';

export interface IVCardManager {
  /**
   * Updates the settings reference.
   * @param settings - New settings object
   */
  updateSettings(settings: any): void;

  /**
   * Gets the VCF watch folder path from settings.
   * @returns Watch folder path
   */
  getWatchFolder(): string;

  /**
   * Checks if a VCF file should be ignored based on filename.
   * @param filePath - Full path to the VCF file
   * @returns True if the file should be ignored
   */
  shouldIgnoreFile(filePath: string): boolean;

  /**
   * Checks if a UID should be ignored based on settings.
   * @param uid - The UID to check
   * @returns True if the UID should be ignored
   */
  shouldIgnoreUID(uid: string): boolean;

  /**
   * Lists all VCard files in the watch folder.
   * @returns Promise resolving to array of file paths
   */
  listVCardFiles(): Promise<string[]>;

  /**
   * Processes a VCard file and yields contact data.
   * @param filePath - Path to the VCF file
   * @returns Async generator yielding contact data
   */
  processVCardFile(filePath: string): AsyncGenerator<VCardForObsidianRecord, void, unknown>;

  /**
   * Reads and parses a VCard file.
   * @param filePath - Path to the VCF file
   * @returns Promise resolving to array of contact records
   */
  readVCardFile(filePath: string): Promise<VCardForObsidianRecord[]>;

  /**
   * Writes contact data to a VCard file.
   * @param filePath - Destination file path
   * @param contacts - Array of contact records to write
   * @returns Promise resolving when write is complete
   */
  writeVCardFile(filePath: string, contacts: VCardForObsidianRecord[]): Promise<void>;

  /**
   * Gets statistics about managed VCard files.
   * @returns Object containing VCard file statistics
   */
  getStats(): Promise<{
    totalFiles: number;
    totalContacts: number;
    ignoredFiles: number;
    lastProcessed: Date | null;
  }>;

  /**
   * Validates VCard file integrity.
   * @param filePath - Path to VCF file to validate
   * @returns Promise resolving to validation results
   */
  validateVCardFile(filePath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
}