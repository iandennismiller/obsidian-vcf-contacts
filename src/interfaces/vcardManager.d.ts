/**
 * @fileoverview Interface definitions for VCard Manager module classes
 * 
 * This module provides TypeScript interfaces that define the contracts
 * for VCard Manager-related classes. These interfaces improve code intelligence,
 * enable better IDE support, and make testing easier by allowing mock
 * implementations.
 * 
 * @module VCardManagerInterfaces
 */

import { VCardForObsidianRecord } from '../vcardFile';
import { VCardFileInfo } from './vcardCollection';

/**
 * Interface for VCard manager operations.
 * Defines the contract for classes that manage collections of VCard files.
 * 
 * @interface IVCardManager
 */
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
   * Gets file information for a VCard file.
   * @param filePath - Full path to the VCard file
   * @returns Promise resolving to file info or null if error
   */
  getVCardFileInfo(filePath: string): Promise<VCardFileInfo | null>;

  /**
   * Reads and parses a VCard file.
   * @param filePath - Full path to the VCard file
   * @returns Promise resolving to parsed content or null if error
   */
  readAndParseVCard(filePath: string): Promise<Array<[string, VCardForObsidianRecord]> | null>;

  /**
   * Finds a VCard file by UID.
   * @param uid - The UID to search for
   * @returns Promise resolving to file path or null if not found
   */
  findVCardFileByUID(uid: string): Promise<string | null>;

  /**
   * Gets all VCard files with their information.
   * @returns Promise resolving to array of file information
   */
  getAllVCardFiles(): Promise<VCardFileInfo[]>;

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
   * Adds a VCard to the write queue.
   * @param uid - Unique identifier for the VCard
   * @param vcardData - VCard data to write
   * @returns Promise that resolves when queued
   */
  queueVcardWrite(uid: string, vcardData: string): Promise<void>;

  /**
   * Gets the current write queue status.
   * @returns Queue status information
   */
  getWriteQueueStatus(): { size: number; processing: boolean };

  /**
   * Clears the write queue.
   */
  clearWriteQueue(): void;
}

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

/**
 * Interface for VCard write queue operations.
 * Defines the contract for classes that manage write queue operations.
 * 
 * @interface IVCardWriteQueue
 */
export interface IVCardWriteQueue {
  /**
   * Adds a VCard to the write queue.
   * @param uid - Unique identifier for the VCard
   * @param vcardData - VCard data to write
   * @returns Promise that resolves when queued
   */
  queueVcardWrite(uid: string, vcardData: string): Promise<void>;

  /**
   * Gets the current write queue status.
   * @returns Queue status information
   */
  getStatus(): { size: number; processing: boolean };

  /**
   * Clears the write queue.
   */
  clear(): void;
}

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