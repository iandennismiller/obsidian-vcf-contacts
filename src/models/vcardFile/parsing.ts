import { VCardForObsidianRecord, StructuredFields } from './types';
import { createContactSlug } from '../contactNote';

/**
 * VCard parsing operations
 * Handles parsing VCard data into structured objects
 */
export class VCardParser {
  /**
   * Parse VCard data and yield [slug, vCardObject] tuples
   */
  static async* parse(vcardData: string): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown> {
    const singles: string[] = VCardParser.parseToSingles(vcardData);

    for (const singleVCard of singles) {
      const unfoldedLines = VCardParser.unfoldVCardLines(singleVCard);
      const vCardObject: VCardForObsidianRecord = {};

      for (const line of unfoldedLines) {
        const parsedLine = VCardParser.parseVCardLine(line);
        if (parsedLine) {
          const indexedParsedLine = VCardParser.indexIfKeysExist(vCardObject, parsedLine);
          Object.assign(vCardObject, indexedParsedLine);
        }
      }

      try {
        const slug = createContactSlug(vCardObject);
        yield [slug, vCardObject];
      } catch (error) {
        yield [undefined, vCardObject];
      }
    }
  }

  private static unfoldVCardLines(vCardData: string): string[] {
    const normalized = vCardData.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const unfoldedLines: string[] = [];
    let currentLine = "";

    for (const line of lines) {
      if (/^[ \t]/.test(line)) {
        currentLine += ' ' + line.slice(1);
      } else {
        if (currentLine) unfoldedLines.push(currentLine);
        currentLine = line;
      }
    }

    return unfoldedLines;
  }

  private static parseToSingles(vCardsRaw: string): string[] {
    return vCardsRaw.split(/BEGIN:VCARD\s*[\n\r]+|END:VCARD\s*[\n\r]+/).filter(section => section.trim());
  }

  private static indexIfKeysExist(vCardObject: VCardForObsidianRecord, newEntry: VCardForObsidianRecord): VCardForObsidianRecord {
    const indexedEntry: Record<string, any> = {};
    const typeRegex = /\[(.*?)\]/;
    const dotRegex = /^([^\.]+)\./;

    Object.entries(newEntry).forEach(([key, value]) => {
      let newKey = key;

      if (vCardObject.hasOwnProperty(key)) {
        let index = 1;

        const typeMatch = key.match(typeRegex);
        const dotMatch = key.match(dotRegex);

        if (typeMatch) {
          // Key contains [TYPE] - insert index inside brackets
          const beforeBracket = key.substring(0, key.indexOf('['));
          const insideBrackets = typeMatch[1];
          const afterBracket = key.substring(key.indexOf(']') + 1);
          
          do {
            newKey = `${beforeBracket}[${index}:${insideBrackets}]${afterBracket}`;
            index++;
          } while (vCardObject.hasOwnProperty(newKey));
        } else if (dotMatch) {
          // Key contains dot - insert index before dot
          const beforeDot = dotMatch[1];
          const afterDot = key.substring(key.indexOf('.'));
          
          do {
            newKey = `${beforeDot}[${index}:]${afterDot}`;
            index++;
          } while (vCardObject.hasOwnProperty(newKey));
        } else {
          // General key - append index at end
          do {
            newKey = `${key}[${index}:]`;
            index++;
          } while (vCardObject.hasOwnProperty(newKey));
        }
      }

      indexedEntry[newKey] = value;
    });

    return indexedEntry;
  }

  private static parseStructuredField(key: keyof typeof StructuredFields, value: string, typeValues: string): Record<string, string> {
    const structuredFieldsForKey = StructuredFields[key];
    const result: Record<string, string> = {};
    const values = value.split(';');
    
    structuredFieldsForKey.forEach((field, index) => {
      const fieldValue = values[index] || '';
      if (fieldValue) {
        result[`${key}${typeValues}.${field}`] = fieldValue;
      }
    });
    
    return result;
  }

  private static parseVCardLine(line: string): VCardForObsidianRecord {
    const [keyPart, ...valueParts] = line.split(':');
    if (!keyPart || valueParts.length === 0) {
      // Throw error for lines without proper key:value format
      if (line.trim() && !line.startsWith('BEGIN:') && !line.startsWith('END:') && !line.startsWith('VERSION:')) {
        throw new Error(`VCard parse error: Invalid line format: ${line}`);
      }
      return {};
    }

    const value = valueParts.join(':').trim();
    if (!value) return {};

    const keyMatch = keyPart.match(/^([A-Z]+)(.*)/);
    if (!keyMatch) {
      // Throw error for invalid key format
      throw new Error(`VCard parse error: Invalid property key: ${keyPart}`);
    }

    const [, baseKey, paramsPart] = keyMatch;
    let typeValues = '';

    if (paramsPart) {
      const typeMatch = paramsPart.match(/TYPE=([^;]+)/);
      if (typeMatch) {
        typeValues = `[${typeMatch[1]}]`;
      }
    }

    if (['N', 'ADR'].includes(baseKey) && StructuredFields[baseKey as keyof typeof StructuredFields]) {
      return VCardParser.parseStructuredField(baseKey as keyof typeof StructuredFields, value, typeValues);
    }

    if (['BDAY', 'ANNIVERSARY'].includes(baseKey)) {
      return { [`${baseKey}${typeValues}`]: VCardParser.formatVCardDate(value) };
    }

    if (baseKey === 'PHOTO') {
      // Handle both v3 and v4 formats
      if (paramsPart && paramsPart.includes('ENCODING=BASE64')) {
        // v3 format: reconstruct the line for processing
        const fullLine = `PHOTO${paramsPart}:${value}`;
        return { [`${baseKey}${typeValues}`]: VCardParser.photoLineFromV3toV4(fullLine) };
      } else if (value.startsWith('data:')) {
        // v4 format
        return { [`${baseKey}${typeValues}`]: value };
      } else {
        return { [`${baseKey}${typeValues}`]: value };
      }
    }

    if (baseKey === 'VERSION') {
      // Convert vCard version 3.0 to 4.0
      if (value === '3.0') {
        return { [`${baseKey}${typeValues}`]: '4.0' };
      }
      return { [`${baseKey}${typeValues}`]: value };
    }

    return { [`${baseKey}${typeValues}`]: value };
  }

  private static formatVCardDate(input: string): string {
    let trimmed = input.trim();

    if (trimmed[8] === 'T') {
      trimmed = trimmed.slice(0, 8);
    }

    if (trimmed.length === 8 && !isNaN(Number(trimmed))) {
      const dashed = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
      const date = new Date(dashed);
      if (!isNaN(date.getTime())) {
        return date.toISOString().substring(0, 10);
      }
    }

    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().substring(0, 10);
    }

    return trimmed;
  }

  /**
   * Convert vCard v3 photo format to v4 format
   * Migrated from src/util/photoLineFromV3toV4.ts
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