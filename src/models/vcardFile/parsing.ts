import { VCardForObsidianRecord, StructuredFields } from './types';
import { createContactSlug } from '../contactNote';
import { parseVcardWithVcard4 } from './vcard4Adapter';

/**
 * VCard parsing operations
 * Now delegates to vcard4 library for RFC 6350 compliant parsing
 */
export class VCardParser {
  /**
   * Parse VCard data and yield [slug, vCardObject] tuples
   * Uses vcard4 library for parsing, then converts to Obsidian format
   * 
   * @param {string} vcardData - The raw VCard data to parse
   * @returns {AsyncGenerator} An async generator that yields arrays with two elements: slug (string or undefined) and vCardObject
   */
  static async* parse(vcardData: string): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown> {
    // Delegate to vcard4 adapter
    yield* parseVcardWithVcard4(vcardData);
  }
  /**
   * Convert vCard v3 photo format to v4 format
   * Migrated from src/util/photoLineFromV3toV4.ts
   * 
   * @deprecated This functionality is now handled by vcard4 library
   * Kept for backward compatibility during migration
   */
  static photoLineFromV3toV4(line: string): string {
    const url = line.startsWith('PHOTO;') ? line.slice(6) : line;
    const match = url.match(/^ENCODING=BASE64;(.*?):/);
    if (match) {
      const mimeType = match[1].toLowerCase(); // e.g., "jpeg"
      const base64Data = url.split(':').slice(1).join(':');
      return `data:image/${mimeType};base64,${base64Data}`;
    }
    return url;
  }
}