import { parse } from 'vcard4';
import { flatten } from 'flat';
import { VCardForObsidianRecord } from './types';
import { createContactSlug } from '../contactNote';

/**
 * VCard parsing operations
 * Uses vcard4 library for RFC 6350 compliant parsing
 */
export class VCardParser {
  /**
   * Parse VCard data and yield [slug, vCardObject] tuples
   * Converts vcard4 parsed objects directly to Obsidian frontmatter format
   * 
   * @param {string} vcardData - The raw VCard data to parse
   * @returns {AsyncGenerator} An async generator that yields arrays with two elements: slug (string or undefined) and vCardObject
   */
  static async* parse(vcardData: string): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown> {
    // Handle empty input
    if (!vcardData || !vcardData.trim()) {
      return;
    }
    
    // Normalize line endings to CRLF (required by vcard4)
    const normalized = vcardData.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    
    // Split into individual vCards (vcard4 parses one at a time)
    const vcardStrings = VCardParser.splitVCards(normalized);
    
    for (const vcardString of vcardStrings) {
      try {
        // vcard4.parse() expects a single vCard
        const parsedVcard = parse(vcardString);
        const frontmatter = VCardParser.convertToFrontmatter(parsedVcard);
        
        try {
          const slug = createContactSlug(frontmatter);
          yield [slug, frontmatter];
        } catch (error: any) {
          // If slug creation fails, still yield the frontmatter
          console.warn('[VCardParser] Failed to create slug:', error.message, 'FN:', frontmatter.FN);
          yield [undefined, frontmatter];
        }
      } catch (error: any) {
        console.error('[VCardParser] Error parsing vCard:', error.message, 'vCard preview:', vcardString.substring(0, 100));
        // Skip this vCard and continue with others
        continue;
      }
    }
  }

  /**
   * Split multiple vCards into individual vCard strings
   * @private
   */
  private static splitVCards(vcardData: string): string[] {
    const vcards: string[] = [];
    const lines = vcardData.split('\r\n');
    let currentVCard: string[] = [];
    let inVCard = false;
    
    for (const line of lines) {
      if (line === 'BEGIN:VCARD') {
        inVCard = true;
        currentVCard = [line];
      } else if (line === 'END:VCARD') {
        currentVCard.push(line);
        currentVCard.push(''); // Add trailing CRLF
        vcards.push(currentVCard.join('\r\n'));
        currentVCard = [];
        inVCard = false;
      } else if (inVCard) {
        currentVCard.push(line);
      }
    }
    
    return vcards;
  }

  /**
   * Convert vcard4 parsed object to Obsidian frontmatter format using flat library
   * @private
   */
  private static convertToFrontmatter(parsedVcard: any): VCardForObsidianRecord {
    const parsedVcardArray = parsedVcard.parsedVcard || [];
    
    // Build a nested object structure from vcard4 properties
    const nested: Record<string, any> = {};
    
    for (const prop of parsedVcardArray) {
      const { property, parameters, value } = prop;
      
      // Handle structured fields (N, ADR) - create nested objects
      if (property === 'N' && typeof value === 'object') {
        const typeParam = parameters.TYPE || '';
        
        if (!nested.N) nested.N = {};
        const nObj: Record<string, any> = typeParam ? (nested.N[typeParam] || (nested.N[typeParam] = {})) : nested.N;
        
        if (value.familyNames) nObj.FN = value.familyNames;
        if (value.givenNames) nObj.GN = value.givenNames;
        if (value.additionalNames) nObj.MN = value.additionalNames;
        if (value.honorificPrefixes) nObj.PREFIX = value.honorificPrefixes;
        if (value.honorificSuffixes) nObj.SUFFIX = value.honorificSuffixes;
        
      } else if (property === 'ADR' && typeof value === 'object') {
        const typeParam = parameters.TYPE || '';
        
        if (!nested.ADR) nested.ADR = {};
        const adrObj: Record<string, any> = typeParam ? (nested.ADR[typeParam] || (nested.ADR[typeParam] = {})) : (nested.ADR.default || (nested.ADR.default = {}));
        
        if (value.postOfficeBox) adrObj.PO = value.postOfficeBox;
        if (value.extendedAddress) adrObj.EXT = value.extendedAddress;
        if (value.streetAddress) adrObj.STREET = value.streetAddress;
        if (value.locality) adrObj.LOCALITY = value.locality;
        if (value.region) adrObj.REGION = value.region;
        if (value.postalCode) adrObj.POSTAL = value.postalCode;
        if (value.countryName) adrObj.COUNTRY = value.countryName;
        
      } else if (property === 'GENDER' && typeof value === 'object') {
        if (value.sex) nested.GENDER = value.sex;
        
      } else {
        // Handle regular fields with TYPE parameters
        const typeParam = parameters.TYPE;
        const stringValue = typeof value === 'string' ? value : String(value);
        
        if (typeParam) {
          const typeValue = Array.isArray(typeParam) ? typeParam[0] : typeParam;
          
          // Create nested structure for typed fields
          if (!nested[property]) nested[property] = {};
          
          // If this type already exists, create an array
          if (nested[property][typeValue] !== undefined) {
            // Convert to array if not already
            if (!Array.isArray(nested[property][typeValue])) {
              nested[property][typeValue] = [nested[property][typeValue]];
            }
            nested[property][typeValue].push(stringValue);
          } else {
            nested[property][typeValue] = stringValue;
          }
        } else {
          // No type parameter - use bare key
          // If key already exists, create an array
          if (nested[property] !== undefined) {
            if (!Array.isArray(nested[property])) {
              nested[property] = [nested[property]];
            }
            nested[property].push(stringValue);
          } else {
            nested[property] = stringValue;
          }
        }
      }
    }
    
    // Use flat to convert nested structure to dot notation
    const flattened = flatten(nested, { delimiter: '.' }) as VCardForObsidianRecord;
    
    return flattened;
  }

  /**
   * Convert vCard v3 photo format to v4 format
   * 
   * @deprecated This functionality is now handled by vcard4 library
   * Kept for backward compatibility during migration
   */
  static photoLineFromV3toV4(line: string): string {
    const url = line.startsWith('PHOTO;') ? line.slice(6) : line;
    const match = url.match(/^ENCODING=BASE64;(.*?):/);
    if (match) {
      const mimeType = match[1].toLowerCase();
      const base64Data = url.split(':').slice(1).join(':');
      return `data:image/${mimeType};base64,${base64Data}`;
    }
    return url;
  }
}
