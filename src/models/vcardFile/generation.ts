import { TFile, App } from "obsidian";
import { VCARD, FNProperty, NProperty, EmailProperty, TelProperty, AdrProperty, 
         TextType, URIType, SpecialValueType, TypeParameter, ParameterValueType,
         BdayProperty, GenderProperty, PhotoProperty, OrgProperty, TitleProperty, RoleProperty,
         UIDProperty, RevProperty, RelatedProperty, CategoriesProperty, NoteProperty, URLProperty } from 'vcard4';
import { VCardToStringError, VCardToStringReply } from './types';
import { getApp } from "../../plugin/context/sharedAppContext";
import { ContactManagerUtils } from "../contactManager/contactManagerUtils";

/**
 * VCard generation operations
 * Uses vcard4 library for RFC 6350 compliant generation
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
      } catch (err: any) {
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

    // Add FN from filename if not present
    const frontMatterWithFN = { ...frontMatter };
    if (!hasFN) {
      frontMatterWithFN.FN = file.basename;
    }

    return VCardGenerator.objectToVcf(frontMatterWithFN);
  }

  /**
   * Convert vCard object to VCF string using vcard4 library
   */
  static objectToVcf(vCardObject: Record<string, any>): string {
    const properties: any[] = [];
    const processedKeys = new Set<string>();
    
    // Helper to parse Obsidian key format
    function parseObsidianKey(key: string): { base: string; type?: string; subfield?: string } {
      const typeMatch = key.match(/^([A-Z]+)\[([^\]]+)\](?:\.(.+))?$/);
      if (typeMatch) {
        return { 
          base: typeMatch[1], 
          type: typeMatch[2].includes(':') ? typeMatch[2].split(':')[1] : typeMatch[2],
          subfield: typeMatch[3]
        };
      }
      
      const dotMatch = key.match(/^([A-Z]+)\.(.+)$/);
      if (dotMatch) {
        return { base: dotMatch[1], subfield: dotMatch[2] };
      }
      
      return { base: key };
    }
    
    // First pass: handle structured fields (N, ADR)
    const nFields: Map<string, any> = new Map();
    const adrFields: Map<string, any> = new Map();
    
    for (const [key, value] of Object.entries(vCardObject)) {
      const parsed = parseObsidianKey(key);
      
      if (parsed.base === 'N' && parsed.subfield) {
        const typeKey = parsed.type || 'default';
        if (!nFields.has(typeKey)) {
          nFields.set(typeKey, { type: parsed.type });
        }
        // Only add non-empty values
        if (value) {
          nFields.get(typeKey)[parsed.subfield] = value;
        }
        processedKeys.add(key);
      } else if (parsed.base === 'ADR' && parsed.subfield) {
        const typeKey = parsed.type || 'default';
        if (!adrFields.has(typeKey)) {
          adrFields.set(typeKey, { type: parsed.type });
        }
        // Only add non-empty values
        if (value) {
          adrFields.get(typeKey)[parsed.subfield] = value;
        }
        processedKeys.add(key);
      }
    }
    
    // Create N properties
    for (const [typeKey, fields] of nFields) {
      const nArr = new Array(5);
      nArr[0] = fields.FN ? new TextType(fields.FN) : new TextType('');
      nArr[1] = fields.GN ? new TextType(fields.GN) : new TextType('');
      nArr[2] = fields.MN ? new TextType(fields.MN) : new TextType('');
      nArr[3] = fields.PREFIX ? new TextType(fields.PREFIX) : new TextType('');
      nArr[4] = fields.SUFFIX ? new TextType(fields.SUFFIX) : new TextType('');
      
      const params = fields.type ? [new TypeParameter('NProperty', new ParameterValueType(fields.type))] : [];
      properties.push(new NProperty(params, new SpecialValueType('NProperty', nArr)));
    }
    
    // Create ADR properties
    for (const [typeKey, fields] of adrFields) {
      const adrArr = new Array(7);
      adrArr[0] = new TextType(fields.PO || '');
      adrArr[1] = new TextType(fields.EXT || '');
      adrArr[2] = new TextType(fields.STREET || '');
      adrArr[3] = new TextType(fields.LOCALITY || '');
      adrArr[4] = new TextType(fields.REGION || '');
      adrArr[5] = new TextType(fields.POSTAL || '');
      adrArr[6] = new TextType(fields.COUNTRY || '');
      
      const params = fields.type ? [new TypeParameter('AdrProperty', new ParameterValueType(fields.type))] : [];
      properties.push(new AdrProperty(params, new SpecialValueType('AdrProperty', adrArr)));
    }
    
    // Second pass: handle regular fields
    for (const [key, value] of Object.entries(vCardObject)) {
      if (processedKeys.has(key)) continue;
      
      // Skip empty values but process non-empty ones
      if (!value && value !== 0 && value !== false) continue;
      
      const parsed = parseObsidianKey(key);
      const params = parsed.type ? [new TypeParameter(`${parsed.base}Property`, new ParameterValueType(parsed.type))] : [];
      
      try {
        switch (parsed.base) {
          case 'FN':
            properties.push(new FNProperty(params, new TextType(String(value))));
            break;
          case 'EMAIL':
            properties.push(new EmailProperty(params, new TextType(String(value))));
            break;
          case 'TEL':
            const telValue = String(value);
            const telUri = telValue.startsWith('tel:') || telValue.startsWith('+') ? telValue : `tel:${telValue}`;
            properties.push(new TelProperty(params, new URIType(telUri)));
            break;
          case 'BDAY':
          case 'ANNIVERSARY':
            const PropClass = parsed.base === 'BDAY' ? BdayProperty : require('vcard4').AnniversaryProperty;
            properties.push(new PropClass(params, new TextType(String(value))));
            break;
          case 'GENDER':
            properties.push(new GenderProperty([], new SpecialValueType('GenderProperty', [
              new TextType(String(value)),
              new TextType('')
            ])));
            break;
          case 'PHOTO':
            properties.push(new PhotoProperty(params, new URIType(String(value))));
            break;
          case 'ORG':
            const orgValue = String(value);
            const orgParts = orgValue.split(';').map(part => new TextType(part.trim()));
            const OrgTextListType = require('vcard4').TextListType;
            properties.push(new OrgProperty(params, new OrgTextListType(orgParts)));
            break;
          case 'TITLE':
            properties.push(new TitleProperty(params, new TextType(String(value))));
            break;
          case 'ROLE':
            properties.push(new RoleProperty(params, new TextType(String(value))));
            break;
          case 'UID':
            properties.push(new UIDProperty(params, new TextType(String(value))));
            break;
          case 'REV':
            const RevTimestampType = require('vcard4').TimestampType;
            properties.push(new RevProperty(params, new RevTimestampType(String(value))));
            break;
          case 'RELATED':
            properties.push(new RelatedProperty(params, new URIType(String(value))));
            break;
          case 'CATEGORIES':
            properties.push(new CategoriesProperty(params, new TextType(String(value))));
            break;
          case 'NOTE':
            properties.push(new NoteProperty(params, new TextType(String(value))));
            break;
          case 'URL':
            properties.push(new URLProperty(params, new URIType(String(value))));
            break;
          case 'VERSION':
            // VERSION is handled automatically by VCARD
            break;
        }
      } catch (error: any) {
        console.warn(`[VCardGenerator] Error creating property ${parsed.base}:`, error.message);
      }
    }
    
    // Ensure we have at least FN property (required by vcard4)
    if (!properties.some(p => p.constructor.name === 'FNProperty')) {
      properties.unshift(new FNProperty([], new TextType('Unnamed Contact')));
    }
    
    const vcard = new VCARD(properties);
    return vcard.repr();
  }
}
