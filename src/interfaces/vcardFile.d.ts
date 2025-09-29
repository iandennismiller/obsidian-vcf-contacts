/**
 * @fileoverview Interface definitions for VCard module classes
 * 
 * This module provides TypeScript interfaces that define the contracts
 * for VCard-related classes. These interfaces improve code intelligence,
 * enable better IDE support, and make testing easier by allowing mock
 * implementations.
 * 
 * @module VCardInterfaces
 */

import { TFile, App } from "obsidian";
import { VCardForObsidianRecord, VCardToStringReply } from './types';

/**
 * Interface for VCard file operations.
 * Defines the contract for classes that handle individual VCard file operations.
 * 
 * @interface IVCardFile
 */
export interface IVCardFile {
  /**
   * Parses the VCard data and yields contact information.
   * @returns Async generator yielding [slug, contactData] tuples
   */
  parse(): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown>;

  /**
   * Converts the VCard data to string format.
   * @returns Raw VCard data in VCF format
   */
  toString(): string;

  /**
   * Saves the VCard data to a file.
   * @param filePath - Absolute path where to save the VCF file
   * @returns Promise resolving to true if saved successfully
   */
  saveToFile(filePath: string): Promise<boolean>;
}

/**
 * Interface for VCard parsing operations.
 * Defines the contract for classes that handle VCard parsing logic.
 * 
 * @interface IVCardParser
 */
export interface IVCardParser {
  /**
   * Parses VCard data and yields contact information.
   * @param vcardData - Raw VCard data string
   * @returns Async generator yielding [slug, contactData] tuples
   */
  parse(vcardData: string): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown>;

  /**
   * Converts vCard v3 photo format to v4 format.
   * @param line - VCard photo line in v3 format
   * @returns Photo line converted to v4 format
   */
  photoLineFromV3toV4(line: string): string;
}

/**
 * Interface for VCard generation operations.
 * Defines the contract for classes that generate VCard content.
 * 
 * @interface IVCardGenerator
 */
export interface IVCardGenerator {
  /**
   * Creates VCard content from Obsidian contact files.
   * @param contactFiles - Array of Obsidian TFile objects
   * @param app - Optional Obsidian App instance
   * @returns Promise resolving to generation results with errors
   */
  fromObsidianFiles(contactFiles: TFile[], app?: App): Promise<VCardToStringReply>;

  /**
   * Creates an empty VCard with default field structure.
   * @returns Promise resolving to empty VCard string
   */
  createEmpty(): Promise<string>;

  /**
   * Converts a VCard object to VCF format string.
   * @param vCardObject - VCard data object
   * @returns VCF format string
   */
  objectToVcf(vCardObject: Record<string, any>): string;
}

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