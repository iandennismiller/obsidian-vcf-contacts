/**
 * @fileoverview Interface definition for VCardFile class
 * 
 * Defines the contract for classes that handle individual VCard file operations.
 * 
 * @module IVCardFile
 */

import { TFile, App } from "obsidian";
import { VCardForObsidianRecord } from '../models/vcardFile';

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