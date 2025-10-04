import { TFile, App } from "obsidian";
import { unflatten } from 'flat';
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
      "TEL.CELL": "",
      "TEL.HOME": "",
      "TEL.WORK": "",
      "EMAIL.HOME": "",
      "EMAIL.WORK": "",
      "BDAY": "",
      "PHOTO": "",
      "ADR.HOME.STREET": "",
      "ADR.HOME.LOCALITY": "",
      "ADR.HOME.POSTAL": "",
      "ADR.HOME.COUNTRY": "",
      "URL.WORK": "",
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
   * Uses unflatten from flat library to convert dot notation to nested structure
   */
  static objectToVcf(vCardObject: Record<string, any>): string {
    const properties: any[] = [];
    
    // Use unflatten to convert dot notation to nested structure
    const nested = unflatten(vCardObject, { delimiter: '.' }) as Record<string, any>;
    
    // Helper to handle arrays and extract type parameters
    const processField = (fieldName: string, fieldValue: any): Array<{ value: any; type?: string }> => {
      const results: Array<{ value: any; type?: string }> = [];
      
      if (typeof fieldValue === 'object' && !Array.isArray(fieldValue) && fieldValue !== null) {
        // Check if it's a structured object with type parameters
        for (const [key, value] of Object.entries(fieldValue)) {
          if (Array.isArray(value)) {
            // Multiple values with same type
            value.forEach(v => results.push({ value: v, type: key }));
          } else if (value !== undefined && value !== null && value !== '') {
            results.push({ value, type: key });
          }
        }
      } else if (Array.isArray(fieldValue)) {
        // Array without type parameters
        fieldValue.forEach(v => results.push({ value: v }));
      } else if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        // Simple value
        results.push({ value: fieldValue });
      }
      
      return results;
    };
    
    // Process N (structured name) field
    if (nested.N) {
      const nData = nested.N;
      
      // Check if N has type parameters (like N.HOME, N.WORK, etc.)
      const hasTypeParams = Object.keys(nData).some(key => 
        typeof nData[key] === 'object' && !['FN', 'GN', 'MN', 'PREFIX', 'SUFFIX'].includes(key)
      );
      
      if (hasTypeParams) {
        // Process each type
        for (const [typeKey, typeData] of Object.entries(nData)) {
          if (typeof typeData === 'object' && typeData !== null) {
            const data = typeData as Record<string, any>;
            const nArr = new Array(5);
            nArr[0] = data.FN ? new TextType(data.FN) : new TextType('');
            nArr[1] = data.GN ? new TextType(data.GN) : new TextType('');
            nArr[2] = data.MN ? new TextType(data.MN) : new TextType('');
            nArr[3] = data.PREFIX ? new TextType(data.PREFIX) : new TextType('');
            nArr[4] = data.SUFFIX ? new TextType(data.SUFFIX) : new TextType('');
            
            const params = typeKey !== 'default' ? [new TypeParameter('NProperty', new ParameterValueType(typeKey))] : [];
            properties.push(new NProperty(params, new SpecialValueType('NProperty', nArr)));
          }
        }
      } else {
        // Simple N without type parameters
        const data = nData as Record<string, any>;
        const nArr = new Array(5);
        nArr[0] = data.FN ? new TextType(data.FN) : new TextType('');
        nArr[1] = data.GN ? new TextType(data.GN) : new TextType('');
        nArr[2] = data.MN ? new TextType(data.MN) : new TextType('');
        nArr[3] = data.PREFIX ? new TextType(data.PREFIX) : new TextType('');
        nArr[4] = data.SUFFIX ? new TextType(data.SUFFIX) : new TextType('');
        
        properties.push(new NProperty([], new SpecialValueType('NProperty', nArr)));
      }
    }
    
    // Process ADR (structured address) field
    if (nested.ADR) {
      const adrData = nested.ADR;
      
      for (const [typeKey, typeData] of Object.entries(adrData)) {
        if (typeof typeData === 'object' && typeData !== null) {
          const data = typeData as Record<string, any>;
          const adrArr = new Array(7);
          adrArr[0] = new TextType(data.PO || '');
          adrArr[1] = new TextType(data.EXT || '');
          adrArr[2] = new TextType(data.STREET || '');
          adrArr[3] = new TextType(data.LOCALITY || '');
          adrArr[4] = new TextType(data.REGION || '');
          adrArr[5] = new TextType(data.POSTAL || '');
          adrArr[6] = new TextType(data.COUNTRY || '');
          
          const params = typeKey !== 'default' ? [new TypeParameter('AdrProperty', new ParameterValueType(typeKey))] : [];
          properties.push(new AdrProperty(params, new SpecialValueType('AdrProperty', adrArr)));
        }
      }
    }
    
    // Process other fields
    for (const [fieldName, fieldValue] of Object.entries(nested)) {
      if (fieldName === 'N' || fieldName === 'ADR' || fieldName === 'VERSION') continue;
      
      const items = processField(fieldName, fieldValue);
      
      for (const item of items) {
        const params = item.type ? [new TypeParameter(`${fieldName}Property`, new ParameterValueType(item.type))] : [];
        const value = item.value;
        
        try {
          switch (fieldName) {
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
              const PropClass = fieldName === 'BDAY' ? BdayProperty : require('vcard4').AnniversaryProperty;
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
          }
        } catch (error: any) {
          console.warn(`[VCardGenerator] Error creating property ${fieldName}:`, error.message);
        }
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
