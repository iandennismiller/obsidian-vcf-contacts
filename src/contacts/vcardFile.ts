import { TFile, App } from "obsidian";
import { parseKey } from "src/contacts";
import { StructuredFields, VCardToStringError, VCardToStringReply, VCardForObsidianRecord, VCardSupportedKey } from "src/contacts/vcard-types";
import { getApp } from "src/context/sharedAppContext";
import { createNameSlug } from "src/util/nameUtils";
import { photoLineFromV3toV4 } from "src/util/photoLineFromV3toV4";
import { ensureHasName } from "src/contacts/ensureHasName";
import * as fs from 'fs/promises';
import * as path from 'path';
import { loggingService } from '../services/loggingService';

/**
 * A unified interface for interacting with vCard files (VCF)
 * Combines parsing, generation, and file operations functionality
 */
export class VcardFile {
  private data: string;
  
  constructor(vcardData: string = '') {
    this.data = vcardData;
  }

  /**
   * Create a VcardFile instance from a file path
   */
  static async fromFile(filePath: string): Promise<VcardFile | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        loggingService.warning(`[VcardFile] Empty or unreadable VCF file: ${path.basename(filePath)}`);
        return null;
      }
      return new VcardFile(content);
    } catch (error) {
      loggingService.error(`[VcardFile] Error reading VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a VcardFile instance from Obsidian contact files
   */
  static async fromObsidianFiles(contactFiles: TFile[], app?: App): Promise<VCardToStringReply> {
    const vCards: string[] = [];
    const vCardsErrors: VCardToStringError[] = [];

    contactFiles.forEach((file) => {
      try {
        const singleVcard = VcardFile.generateVCardFromFile(file, app);
        vCards.push(singleVcard);
      } catch (err) {
        vCardsErrors.push({"status": "error", "file": file.basename, "message": err.message});
      }
    });

    return Promise.resolve({
      vcards: vCards.join('\n'),
      errors: vCardsErrors
    });
  }

  /**
   * Create an empty VcardFile instance with default fields
   */
  static async createEmpty(): Promise<VcardFile> {
    const vCardObject: Record<string, any> = {
      "N.PREFIX": "",
      "N.GN": "",
      "N.MN": "",
      "N.FN": "",
      "N.SUFFIX": "",
      "TEL[CELL]": "",
      "TEL[HOME]": "",
      "TEL[WORK]": "",
      "EMAIL[HOME]": "",
      "EMAIL[WORK]": "",
      "BDAY": "",
      "PHOTO": "",
      "ADR[HOME].STREET": "",
      "ADR[HOME].LOCALITY": "",
      "ADR[HOME].POSTAL": "",
      "ADR[HOME].COUNTRY": "",
      "URL[WORK]": "",
      "ORG": "",
      "ROLE": "",
      "CATEGORIES": "",
      "VERSION": "4.0"
    };
    
    const namedObject = await ensureHasName(vCardObject);
    // Convert the object back to VCF format
    const vcfContent = VcardFile.objectToVcf(namedObject);
    return new VcardFile(vcfContent);
  }

  /**
   * Parse the vCard data and yield [slug, vCardObject] tuples
   */
  async* parse(): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown> {
    const singles: string[] = this.parseToSingles(this.data);

    for (const singleVCard of singles) {
      const unfoldedLines = this.unfoldVCardLines(singleVCard);
      const vCardObject: VCardForObsidianRecord = {};

      for (const line of unfoldedLines) {
        const parsedLine = this.parseVCardLine(line);
        if (parsedLine) {
          const indexedParsedLine = this.indexIfKeysExist(vCardObject, parsedLine);
          Object.assign(vCardObject, indexedParsedLine);
        }
      }

      try {
        const slug = createNameSlug(vCardObject);
        yield [slug, vCardObject];
      } catch (error) {
        yield [undefined, vCardObject];
      }
    }
  }

  /**
   * Convert to VCF string format
   */
  toString(): string {
    return this.data;
  }

  /**
   * Save to file
   */
  async saveToFile(filePath: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, this.data, 'utf-8');
      loggingService.debug(`[VcardFile] Successfully wrote VCF file: ${filePath}`);
      return true;
    } catch (error) {
      loggingService.error(`[VcardFile] Error writing VCF file ${filePath}: ${error.message}`);
      return false;
    }
  }

  // Static methods for file operations (backward compatibility with VCardFileOps)
  
  /**
   * Lists all VCF files in the specified folder
   */
  static async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      if (!entries || !Array.isArray(entries)) {
        loggingService.debug(`[VcardFile] No entries returned from readdir for ${folderPath}`);
        return [];
      }
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error) {
      loggingService.error(`[VcardFile] Error listing VCF files: ${error.message}`);
      return [];
    }
  }

  /**
   * Gets file statistics for a VCF file
   */
  static async getFileStats(filePath: string): Promise<{ mtimeMs: number } | null> {
    try {
      const stat = await fs.stat(filePath);
      return stat ? { mtimeMs: stat.mtimeMs } : null;
    } catch (error) {
      loggingService.debug(`[VcardFile] Error getting file stats for ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Checks if a folder exists
   */
  static async folderExists(folderPath: string): Promise<boolean> {
    if (!folderPath) {
      return false;
    }

    try {
      await fs.access(folderPath);
      return true;
    } catch (error) {
      loggingService.debug(`[VcardFile] Folder does not exist: ${folderPath}`);
      return false;
    }
  }

  /**
   * Searches for a UID within VCF file content
   */
  static containsUID(content: string, uid: string): boolean {
    return content.includes(`UID:${uid}`);
  }

  /**
   * Generates a sanitized filename for a VCF file based on contact name
   */
  static generateVCFFilename(contactName: string): string {
    const sanitizedName = contactName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitizedName}.vcf`;
  }

  /**
   * Reads VCF file content
   */
  static async readVCFFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        loggingService.warning(`[VcardFile] Empty or unreadable VCF file: ${path.basename(filePath)}`);
        return null;
      }
      return content;
    } catch (error) {
      loggingService.error(`[VcardFile] Error reading VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Writes content to a VCF file
   */
  static async writeVCFFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      loggingService.debug(`[VcardFile] Successfully wrote VCF file: ${filePath}`);
      return true;
    } catch (error) {
      loggingService.error(`[VcardFile] Error writing VCF file ${filePath}: ${error.message}`);
      return false;
    }
  }

  // Private helper methods (migrated from individual files)

  private unfoldVCardLines(vCardData: string): string[] {
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

  private parseToSingles(vCardsRaw: string): string[] {
    return vCardsRaw.split(/BEGIN:VCARD\s*[\n\r]+|END:VCARD\s*[\n\r]+/).filter(section => section.trim());
  }

  private indexIfKeysExist(vCardObject: VCardForObsidianRecord, newEntry: VCardForObsidianRecord): VCardForObsidianRecord {
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

  private parseStructuredField(key: keyof typeof StructuredFields, value: string, typeValues: string): Record<string, string> {
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

  private parseVCardLine(line: string): VCardForObsidianRecord {
    const [keyPart, ...valueParts] = line.split(':');
    if (!keyPart || valueParts.length === 0) return {};

    const value = valueParts.join(':').trim();
    if (!value) return {};

    const keyMatch = keyPart.match(/^([A-Z]+)(.*)/);
    if (!keyMatch) return {};

    const [, baseKey, paramsPart] = keyMatch;
    let typeValues = '';

    if (paramsPart) {
      const typeMatch = paramsPart.match(/TYPE=([^;]+)/);
      if (typeMatch) {
        typeValues = `[${typeMatch[1]}]`;
      }
    }

    if (['N', 'ADR'].includes(baseKey) && StructuredFields[baseKey as keyof typeof StructuredFields]) {
      return this.parseStructuredField(baseKey as keyof typeof StructuredFields, value, typeValues);
    }

    if (['BDAY', 'ANNIVERSARY'].includes(baseKey)) {
      return { [`${baseKey}${typeValues}`]: this.formatVCardDate(value) };
    }

    if (baseKey === 'PHOTO') {
      // Handle both v3 and v4 formats
      if (paramsPart && paramsPart.includes('ENCODING=BASE64')) {
        // v3 format: reconstruct the line for processing
        const fullLine = `PHOTO${paramsPart}:${value}`;
        return { [`${baseKey}${typeValues}`]: photoLineFromV3toV4(fullLine) };
      } else if (value.startsWith('data:')) {
        // v4 format
        return { [`${baseKey}${typeValues}`]: value };
      } else {
        return { [`${baseKey}${typeValues}`]: value };
      }
    }

    return { [`${baseKey}${typeValues}`]: value };
  }

  private formatVCardDate(input: string): string {
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

  // Static methods for backward compatibility with existing toString functionality

  private static generateVCardFromFile(file: TFile, app?: App): string {
    const appInstance = app || getApp();
    const frontMatter = appInstance.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontMatter) {
      throw new Error('No frontmatter found.');
    }

    const entries = Object.entries(frontMatter) as Array<[string, string]>;
    const singleLineFields: Array<[string, string]> = [];
    const structuredFields: Array<[string, string]> = [];

    entries.forEach(([key, value]) => {
      const keyObj = parseKey(key);

      if (['ADR', 'N'].includes(keyObj.key)) {
        structuredFields.push([key, value]);
      } else {
        singleLineFields.push([key, value]);
      }
    });

    const hasFN = singleLineFields.some(([key, _]) => key === 'FN');
    if (!hasFN) {
      singleLineFields.push(['FN', file.basename]);
    }

    const structuredLines = VcardFile.renderStructuredLines(structuredFields);
    const singleLines = singleLineFields.map(VcardFile.renderSingleKey);
    const lines = structuredLines.concat(singleLines);

    return `BEGIN:VCARD\n${lines.join("\n")}\nEND:VCARD`;
  }

  private static renderStructuredLines(structuredFields: [string, string][]): string[] {
    const fields = Object.fromEntries(structuredFields);
    const partialKeys = structuredFields
      .map(([key]) => key.includes('.') ? key.split('.')[0] : null)
      .filter((item): item is string => item !== null);
    const uniqueKeys = [...new Set(partialKeys)];

    const structuredLines = uniqueKeys.map((key) => {
      const keyObj = parseKey(key);
      const type = keyObj.type ? `;TYPE=${keyObj.type}` : '';
      switch (keyObj.key) {
        case 'N': {
          return `N${type}:${StructuredFields.N.map(field => fields[key + '.' + field] || "").join(";")}`;
        }
        case 'ADR': {
          return `ADR${type}:${StructuredFields.ADR.map(field => fields[key + '.' + field] || "").join(";")}`;
        }
        default: {
          return '';
        }
      }
    });

    return structuredLines.filter((line) => line !== '');
  }

  private static renderSingleKey([key, value]: [string, string]): string {
    const keyObj = parseKey(key);
    const type = keyObj.type ? `;TYPE=${keyObj.type}` : '';
    return `${keyObj.key}${type}:${value}`;
  }

  private static objectToVcf(vCardObject: Record<string, any>): string {
    const entries = Object.entries(vCardObject) as Array<[string, string]>;
    const singleLineFields: Array<[string, string]> = [];
    const structuredFields: Array<[string, string]> = [];

    entries.forEach(([key, value]) => {
      const keyObj = parseKey(key);

      if (['ADR', 'N'].includes(keyObj.key)) {
        structuredFields.push([key, value]);
      } else {
        singleLineFields.push([key, value]);
      }
    });

    const structuredLines = VcardFile.renderStructuredLines(structuredFields);
    const singleLines = singleLineFields.map(VcardFile.renderSingleKey);
    const lines = structuredLines.concat(singleLines);

    return `BEGIN:VCARD\n${lines.join("\n")}\nEND:VCARD`;
  }
}