/**
 * @fileoverview Interface definition for VCard parsing operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that handle VCard parsing logic.
 * 
 * @module IVCardParser
 */

import { VCardForObsidianRecord } from '../models/vcardFile/types';

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