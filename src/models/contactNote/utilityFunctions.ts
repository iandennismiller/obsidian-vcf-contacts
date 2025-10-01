/**
 * Standalone utility functions for contact operations
 */

import { TFile } from 'obsidian';
import { VCardForObsidianRecord, VCardKind, VCardKinds } from '../vcardFile';
import { Contact, ParsedKey, Gender } from './types';
import { ContactData } from './contactData';
import { MarkdownOperations } from './markdownOperations';

/**
 * Parse a frontmatter key into its components
 */
export function parseKey(key: string): ParsedKey {
  const match = key.match(/^([^.[]+)(?:\[([^\]]*)\])?(?:\.(.+))?$/);
  if (!match) {
    return { key };
  }

  const [, baseKey, indexOrType, subkey] = match;
  
  // Check if the bracket contains a number (index) or type
  let index: string | undefined;
  let type: string | undefined;
  
  if (indexOrType) {
    if (indexOrType.includes(':')) {
      [index, type] = indexOrType.split(':', 2);
    } else if (/^\d+$/.test(indexOrType)) {
      index = indexOrType;
    } else {
      type = indexOrType;
    }
  }

  return {
    key: baseKey,
    index,
    type,
    subkey
  };
}

/**
 * Render markdown from vCard record data (standalone function for compatibility)
 */
export function mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
  // Create a temporary ContactData for rendering
  const tempApp = require('obsidian').App;
  const tempFile = { basename: 'temp' } as TFile;
  const tempContactData = new ContactData(tempApp, tempFile);
  const markdownOps = new MarkdownOperations(tempContactData);
  
  return markdownOps.mdRender(record, hashtags, genderLookup);
}

/**
 * Create a filename slug from a vCard record
 */
export function createNameSlug(record: VCardForObsidianRecord): string {
  let fileName: string | undefined = undefined;
  
  if (isKind(record, VCardKinds.Individual)) {
    fileName = [
      record["N.PREFIX"],
      record["N.GN"],
      record["N.MN"],
      record["N.FN"],
      record["N.SUFFIX"],
    ]
      .map((part) => part?.trim())
      .filter((part) => part)
      .join(" ") || undefined;
  }

  if (!fileName && record["FN"]) {
    fileName = record["FN"];
  }

  if (!fileName) {
    throw new Error("No name found for record");
  }

  return sanitizeFileName(fileName);
}

/**
 * Create a contact slug (alias for createNameSlug)
 */
export function createContactSlug(record: VCardForObsidianRecord): string {
  return createNameSlug(record);
}

/**
 * Check if a record is of a specific kind
 */
export function isKind(record: VCardForObsidianRecord, kind: VCardKind): boolean {
  return record.KIND === kind || (!record.KIND && kind === VCardKinds.Individual);
}

/**
 * Sanitize a filename for use in the filesystem
 */
function sanitizeFileName(input: string): string {
  const illegalRe = /[\/\?<>\\:\*\|"]/g;
  const controlRe = /[\x00-\x1f\x80-\x9f]/g;
  const reservedRe = /^\.+$/;
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  const windowsTrailingRe = /[\. ]+$/;
  const multipleSpacesRe = /\s+/g;
  
  return input
    .replace(illegalRe, ' ')
    .replace(controlRe, ' ')
    .replace(reservedRe, ' ')
    .replace(windowsReservedRe, ' ')
    .replace(windowsTrailingRe, ' ')
    .replace(multipleSpacesRe, " ")
    .trim();
}

/**
 * Get a unique file ID
 */
export function fileId(file: TFile): string {
  return file.path.replace(/[^\w]/g, '_');
}

/**
 * Get UI-friendly contact name
 */
export function getUiName(contact: Contact): string {
  const frontmatter = contact.data;
  return frontmatter?.["N.GN"] + " " + frontmatter?.["N.FN"] || frontmatter?.["FN"] || contact.file.basename;
}

/**
 * Make a string safe for UI display
 */
export function uiSafeString(input: string): string {
  return input.replace(/[<>&"]/g, (match) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;'
    };
    return escapeMap[match];
  });
}

/**
 * Get a name suitable for sorting
 */
export function getSortName(contact: Contact): string {
  const frontmatter = contact.data;
  return frontmatter?.["N.FN"] + ", " + frontmatter?.["N.GN"] || frontmatter?.["FN"] || contact.file.basename;
}

/**
 * Create a filename with .md extension
 */
export function createFileName(record: VCardForObsidianRecord): string {
  try {
    return createNameSlug(record) + '.md';
  } catch {
    return 'contact.md';
  }
}
