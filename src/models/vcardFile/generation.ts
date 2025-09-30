import { TFile, App } from "obsidian";
import { VCardToStringError, VCardToStringReply, StructuredFields } from './types';
import { getApp } from "../../plugin/context/sharedAppContext";
import { ContactManagerUtils } from "../contactManager/contactManagerUtils";
import { parseKey } from "../contactNote";

/**
 * VCard generation operations
 * Handles generating VCard data from various sources
 */
export class VCardGenerator {
  /**
   * Create VCard data from Obsidian contact files
   */
  static async fromObsidianFiles(contactFiles: TFile[], app?: App): Promise<VCardToStringReply> {
    const vCards: string[] = [];
    const vCardsErrors: VCardToStringError[] = [];

    contactFiles.forEach((file) => {
      try {
        const singleVcard = VCardGenerator.generateVCardFromFile(file, app);
        if (singleVcard) {
          vCards.push(singleVcard);
        }
      } catch (err) {
        vCardsErrors.push({"status": "error", "file": file.basename + '.md', "message": err.message});
      }
    });

    return Promise.resolve({
      vcards: vCards.join('\n'),
      errors: vCardsErrors
    });
  }

  /**
   * Create an empty VCard with default fields
   */
  static async createEmpty(): Promise<string> {
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
    
    const namedObject = await ContactManagerUtils.ensureHasName(vCardObject);
    // Convert the object back to VCF format
    return VCardGenerator.objectToVcf(namedObject);
  }

  private static generateVCardFromFile(file: TFile, app?: App): string | null {
    const appInstance = app || getApp();
    const frontMatter = appInstance.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontMatter) {
      throw new Error('No frontmatter found.');
    }

    // Validate required fields - either UID or FN should be present
    const hasUID = frontMatter.UID;
    const hasFN = frontMatter.FN;
    
    if (!hasUID && !hasFN) {
      throw new Error('Missing required fields (UID or FN).');
    }

    const entries = Object.entries(frontMatter) as Array<[string, string]>;
    const singleLineFields: Array<[string, string]> = [];
    const structuredFields: Array<[string, string]> = [];

    entries.forEach(([key, value]) => {
      const keyObj = parseKey(key);

      // Check if this is a structured field by looking for subkey/dot notation
      if (['ADR', 'N'].includes(keyObj.key) && key.includes('.')) {
        structuredFields.push([key, value]);
      } else {
        singleLineFields.push([key, value]);
      }
    });

    const fnExists = singleLineFields.some(([key, _]) => key === 'FN');
    if (!fnExists) {
      singleLineFields.push(['FN', file.basename]);
    }

    const structuredLines = VCardGenerator.renderStructuredLines(structuredFields);
    const singleLines = singleLineFields.map(VCardGenerator.renderSingleKey);
    
    // Ensure VERSION is included and comes first
    const versionLine = 'VERSION:4.0';
    const hasVersion = singleLines.some(line => line.startsWith('VERSION:'));
    
    let lines: string[] = [];
    if (!hasVersion) {
      lines.push(versionLine);
    }
    lines = lines.concat(structuredLines).concat(singleLines);

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

  static objectToVcf(vCardObject: Record<string, any>): string {
    const entries = Object.entries(vCardObject) as Array<[string, string]>;
    const singleLineFields: Array<[string, string]> = [];
    const structuredFields: Array<[string, string]> = [];

    entries.forEach(([key, value]) => {
      const keyObj = parseKey(key);

      // Check if this is a structured field by looking for subkey/dot notation
      if (['ADR', 'N'].includes(keyObj.key) && key.includes('.')) {
        structuredFields.push([key, value]);
      } else {
        singleLineFields.push([key, value]);
      }
    });

    const structuredLines = VCardGenerator.renderStructuredLines(structuredFields);
    const singleLines = singleLineFields.map(VCardGenerator.renderSingleKey);
    
    // Ensure VERSION is included and comes first
    const versionLine = 'VERSION:4.0';
    const hasVersion = singleLines.some(line => line.startsWith('VERSION:'));
    
    let lines: string[] = [];
    if (!hasVersion) {
      lines.push(versionLine);
    }
    lines = lines.concat(structuredLines).concat(singleLines);

    return `BEGIN:VCARD\n${lines.join("\n")}\nEND:VCARD`;
  }
}