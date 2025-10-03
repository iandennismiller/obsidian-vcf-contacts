/**
 * @fileoverview Adapter functions for converting between vcard4 library format and Obsidian frontmatter
 * 
 * This module provides bidirectional conversion between:
 * - vcard4's structured property objects
 * - Obsidian's flattened frontmatter format
 * 
 * @module Vcard4Adapter
 */

import { parse, VCARD, FNProperty, NProperty, EmailProperty, TelProperty, AdrProperty, 
         TextType, URIType, SpecialValueType, TypeParameter, ParameterValueType,
         BdayProperty, GenderProperty, PhotoProperty, OrgProperty, TitleProperty, RoleProperty,
         UIDProperty, RevProperty, RelatedProperty, CategoriesProperty, NoteProperty, URLProperty } from 'vcard4';
import { VCardForObsidianRecord, StructuredFields } from './types';
import { createContactSlug } from '../contactNote';

/**
 * Convert vcard4 parsed object to Obsidian frontmatter format
 * 
 * @param parsedVcard - The parsed vcard object from vcard4.parse()
 * @returns VCardForObsidianRecord in Obsidian's flattened format
 */
export function vcard4ToObsidianFrontmatter(parsedVcard: any): VCardForObsidianRecord {
    const frontmatter: VCardForObsidianRecord = {};
    const parsedVcardArray = parsedVcard.parsedVcard || [];
    
    // Track counts for duplicate field handling
    const fieldCounts: Map<string, number> = new Map();
    
    for (const prop of parsedVcardArray) {
        const { property, parameters, value } = prop;
        
        // Handle structured fields (N, ADR)
        if (property === 'N' && typeof value === 'object') {
            const typeParam = parameters.TYPE || '';
            const typeStr = typeParam ? `[${typeParam}]` : '';
            
            // Map vcard4's N structure to Obsidian's format
            if (value.familyNames) frontmatter[`N${typeStr}.FN`] = value.familyNames;
            if (value.givenNames) frontmatter[`N${typeStr}.GN`] = value.givenNames;
            if (value.additionalNames) frontmatter[`N${typeStr}.MN`] = value.additionalNames;
            if (value.honorificPrefixes) frontmatter[`N${typeStr}.PREFIX`] = value.honorificPrefixes;
            if (value.honorificSuffixes) frontmatter[`N${typeStr}.SUFFIX`] = value.honorificSuffixes;
        } else if (property === 'ADR' && typeof value === 'object') {
            const typeParam = parameters.TYPE || '';
            const typeStr = typeParam ? `[${typeParam}]` : '';
            
            // Map vcard4's ADR structure to Obsidian's format
            if (value.postOfficeBox) frontmatter[`ADR${typeStr}.PO`] = value.postOfficeBox;
            if (value.extendedAddress) frontmatter[`ADR${typeStr}.EXT`] = value.extendedAddress;
            if (value.streetAddress) frontmatter[`ADR${typeStr}.STREET`] = value.streetAddress;
            if (value.locality) frontmatter[`ADR${typeStr}.LOCALITY`] = value.locality;
            if (value.region) frontmatter[`ADR${typeStr}.REGION`] = value.region;
            if (value.postalCode) frontmatter[`ADR${typeStr}.POSTAL`] = value.postalCode;
            if (value.countryName) frontmatter[`ADR${typeStr}.COUNTRY`] = value.countryName;
        } else if (property === 'GENDER' && typeof value === 'object') {
            // Handle GENDER object
            if (value.sex) frontmatter.GENDER = value.sex;
        } else {
            // Handle regular fields with TYPE parameters
            const typeParam = parameters.TYPE;
            let key = property;
            
            if (typeParam) {
                // Handle TYPE parameter - could be string or array
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
            
            // Convert value to string
            frontmatter[key] = typeof value === 'string' ? value : String(value);
        }
    }
    
    return frontmatter;
}

/**
 * Convert Obsidian frontmatter to vcard4 VCARD object
 * 
 * @param frontmatter - Obsidian frontmatter record
 * @returns VCARD object that can be serialized with .repr()
 */
export function obsidianFrontmatterToVcard4(frontmatter: Record<string, any>): VCARD {
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
    
    for (const [key, value] of Object.entries(frontmatter)) {
        if (!value) continue;
        
        const parsed = parseObsidianKey(key);
        
        if (parsed.base === 'N' && parsed.subfield) {
            const typeKey = parsed.type || 'default';
            if (!nFields.has(typeKey)) {
                nFields.set(typeKey, { type: parsed.type });
            }
            nFields.get(typeKey)[parsed.subfield] = value;
            processedKeys.add(key);
        } else if (parsed.base === 'ADR' && parsed.subfield) {
            const typeKey = parsed.type || 'default';
            if (!adrFields.has(typeKey)) {
                adrFields.set(typeKey, { type: parsed.type });
            }
            adrFields.get(typeKey)[parsed.subfield] = value;
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
    for (const [key, value] of Object.entries(frontmatter)) {
        if (!value || processedKeys.has(key)) continue;
        
        const parsed = parseObsidianKey(key);
        const params = parsed.type ? [new TypeParameter(`${parsed.base}Property`, new ParameterValueType(parsed.type))] : [];
        
        switch (parsed.base) {
            case 'FN':
                properties.push(new FNProperty(params, new TextType(String(value))));
                break;
            case 'EMAIL':
                properties.push(new EmailProperty(params, new TextType(String(value))));
                break;
            case 'TEL':
                // TEL should use URI format (but don't add tel: prefix if it's already there or if it's a plain number)
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
                // GENDER in vcard4 is complex, simplified here
                properties.push(new GenderProperty([], new SpecialValueType('GenderProperty', [
                    new TextType(String(value)),
                    new TextType('')
                ])));
                break;
            case 'PHOTO':
                properties.push(new PhotoProperty(params, new URIType(String(value))));
                break;
            case 'ORG':
                // ORG requires TextListType, not TextType
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
                // REV requires TimestampType, not TextType
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
            default:
                // Use generic property for unsupported types
                // Note: vcard4 may not support all custom properties
                console.warn(`Unsupported vCard property: ${parsed.base}`);
        }
    }
    
    // Ensure we have at least FN property (required by vcard4)
    if (!properties.some(p => p.constructor.name === 'FNProperty')) {
        properties.unshift(new FNProperty([], new TextType('Unnamed Contact')));
    }
    
    return new VCARD(properties);
}

/**
 * Parse vCard content using vcard4 and convert to Obsidian format
 * Generator function that yields [slug, frontmatter] tuples
 * 
 * @param vcardData - Raw vCard data string
 * @returns AsyncGenerator yielding [slug, VCardForObsidianRecord] tuples
 */
export async function* parseVcardWithVcard4(
    vcardData: string
): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown> {
    // Handle empty input
    if (!vcardData || !vcardData.trim()) {
        return;
    }
    
    // Normalize line endings to CRLF (required by vcard4)
    const normalized = vcardData.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    
    // Ensure proper CRLF ending
    const vcardWithCRLF = normalized.endsWith('\r\n') ? normalized : normalized + '\r\n';
    
    try {
        // vcard4.parse() can return single object or array
        const parseResult = parse(vcardWithCRLF);
        const results = Array.isArray(parseResult) ? parseResult : [parseResult];
        
        for (const parsedVcard of results) {
            const frontmatter = vcard4ToObsidianFrontmatter(parsedVcard);
            
            try {
                const slug = createContactSlug(frontmatter);
                yield [slug, frontmatter];
            } catch (error: any) {
                // If slug creation fails, still yield the frontmatter
                yield [undefined, frontmatter];
            }
        }
    } catch (error: any) {
        console.error('[parseVcardWithVcard4] Error parsing vCard:', error.message);
        // Don't yield anything for error case - just return
        return;
    }
}

/**
 * Generate vCard string from Obsidian frontmatter using vcard4
 * 
 * @param frontmatter - Obsidian frontmatter record
 * @returns vCard string in RFC 6350 format
 */
export function generateVcardFromFrontmatter(frontmatter: Record<string, any>): string {
    const vcard = obsidianFrontmatterToVcard4(frontmatter);
    return vcard.repr();
}
