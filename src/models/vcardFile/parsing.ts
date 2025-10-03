import { parse } from 'vcard4';
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
   * Convert vcard4 parsed object to Obsidian frontmatter format
   * @private
   */
  private static convertToFrontmatter(parsedVcard: any): VCardForObsidianRecord {
    const frontmatter: VCardForObsidianRecord = {};
    const parsedVcardArray = parsedVcard.parsedVcard || [];
    const fieldCounts: Map<string, number> = new Map();
    
    for (const prop of parsedVcardArray) {
      const { property, parameters, value } = prop;
      
      // Handle structured fields (N, ADR)
      if (property === 'N' && typeof value === 'object') {
        const typeParam = parameters.TYPE || '';
        const typeStr = typeParam ? `[${typeParam}]` : '';
        
        if (value.familyNames) frontmatter[`N${typeStr}.FN`] = value.familyNames;
        if (value.givenNames) frontmatter[`N${typeStr}.GN`] = value.givenNames;
        if (value.additionalNames) frontmatter[`N${typeStr}.MN`] = value.additionalNames;
        if (value.honorificPrefixes) frontmatter[`N${typeStr}.PREFIX`] = value.honorificPrefixes;
        if (value.honorificSuffixes) frontmatter[`N${typeStr}.SUFFIX`] = value.honorificSuffixes;
      } else if (property === 'ADR' && typeof value === 'object') {
        const typeParam = parameters.TYPE || '';
        const typeStr = typeParam ? `[${typeParam}]` : '';
        
        if (value.postOfficeBox) frontmatter[`ADR${typeStr}.PO`] = value.postOfficeBox;
        if (value.extendedAddress) frontmatter[`ADR${typeStr}.EXT`] = value.extendedAddress;
        if (value.streetAddress) frontmatter[`ADR${typeStr}.STREET`] = value.streetAddress;
        if (value.locality) frontmatter[`ADR${typeStr}.LOCALITY`] = value.locality;
        if (value.region) frontmatter[`ADR${typeStr}.REGION`] = value.region;
        if (value.postalCode) frontmatter[`ADR${typeStr}.POSTAL`] = value.postalCode;
        if (value.countryName) frontmatter[`ADR${typeStr}.COUNTRY`] = value.countryName;
      } else if (property === 'GENDER' && typeof value === 'object') {
        if (value.sex) frontmatter.GENDER = value.sex;
      } else {
        // Handle regular fields with TYPE parameters
        const typeParam = parameters.TYPE;
        let key = property;
        
        if (typeParam) {
          const typeValue = Array.isArray(typeParam) ? typeParam[0] : typeParam;
          key = `${property}[${typeValue}]`;
        }
        
        // Handle duplicate fields by adding index
        if (frontmatter.hasOwnProperty(key)) {
          const count = fieldCounts.get(property) || 1;
          fieldCounts.set(property, count + 1);
          
          if (typeParam) {
            const typeValue = Array.isArray(typeParam) ? typeParam[0] : typeParam;
            key = `${property}[${count}:${typeValue}]`;
          } else {
            key = `${property}[${count}:]`;
          }
        } else {
          fieldCounts.set(property, 1);
        }
        
        frontmatter[key] = typeof value === 'string' ? value : String(value);
      }
    }
    
    return frontmatter;
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
