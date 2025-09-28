/**
 * Handles file naming and slug generation operations
 */

import { VCardForObsidianRecord, VCardKind, VCardKinds } from '../vcardFile';

export class NamingOperations {
  /**
   * Doing our best for the user with minimal code to clean up the filename.
   */
  static sanitizeFileName(input: string): string {
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
   * Creates a name slug from vCard records. FN is a mandatory field in the spec so we fall back to that.
   * Migrated from src/util/nameUtils.ts
   */
  static createNameSlug(record: VCardForObsidianRecord): string {
    let fileName: string | undefined = undefined;
    if (NamingOperations.isKind(record, VCardKinds.Individual)) {
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
      throw new Error(`Failed to update, create file name due to missing FN property"`);
    }

    return NamingOperations.sanitizeFileName(fileName);
  }

  /**
   * Creates a kebab-case slug from vCard records for use as identifiers
   */
  static createContactSlug(record: VCardForObsidianRecord): string {
    let fileName: string | undefined = undefined;
    if (NamingOperations.isKind(record, VCardKinds.Individual)) {
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
      throw new Error(`Failed to update, create file name due to missing FN property"`);
    }

    // Create a kebab-case slug for use as identifier
    return NamingOperations.sanitizeFileName(fileName)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Check if record is of a specific kind
   * Migrated from src/util/nameUtils.ts
   */
  static isKind(record: VCardForObsidianRecord, kind: VCardKind): boolean {
    const myKind = record["KIND"] || VCardKinds.Individual;
    return myKind === kind;
  }
}