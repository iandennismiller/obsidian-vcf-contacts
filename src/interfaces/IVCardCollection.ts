/**
 * @fileoverview Interface definition for VCard collection operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that manage multiple VCard files.
 * 
 * @module IVCardCollection
 */

import { VCardForObsidianRecord } from '../models/vcardFile/types';
import { VCardFileInfo } from '../models/vcardManager/vcardCollection';

/**
 * Interface for VCard collection operations.
 * Defines the contract for classes that manage multiple VCard files.
 * 
 * @interface IVCardCollection
 */
export interface IVCardCollection {
  /**
   * Lists all VCard files in the watch folder.
   * @returns Promise resolving to array of file paths
   */
  listVCardFiles(): Promise<string[]>;

  /**
   * Gets file information for a VCard file.
   * @param filePath - Full path to the VCard file
   * @returns Promise resolving to file info or null if error
   */
  getVCardFileInfo(filePath: string): Promise<VCardFileInfo | null>;

  /**
   * Gets all VCard files with their information.
   * @returns Promise resolving to array of file information
   */
  getAllVCardFiles(): Promise<VCardFileInfo[]>;

  /**
   * Filters VCard files based on ignore settings.
   * @param filePaths - Array of file paths to filter
   * @returns Array of file paths that should not be ignored
   */
  filterIgnoredFiles(filePaths: string[]): string[];

  /**
   * Finds a VCard file by UID.
   * @param uid - The UID to search for
   * @returns Promise resolving to file path or null if not found
   */
  findVCardFileByUID(uid: string): Promise<string | null>;

  /**
   * Reads and parses a VCard file.
   * @param filePath - Full path to the VCard file
   * @returns Promise resolving to parsed content or null if error
   */
  readAndParseVCard(filePath: string): Promise<Array<[string, VCardForObsidianRecord]> | null>;
}