/**
 * @fileoverview Interface definition for VCard generation operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that generate VCard content.
 * 
 * @module IVCardGenerator
 */

import { TFile, App } from "obsidian";
import { VCardToStringReply } from '../models/vcardFile/types';

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