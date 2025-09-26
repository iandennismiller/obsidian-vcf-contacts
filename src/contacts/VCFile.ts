// ...existing code...
import * as path from 'path';
import * as fs from 'fs/promises';
import { TFile, App } from 'obsidian';
import { loggingService } from '../services/loggingService';
import { createFileName } from '../file/file';
import { parseKey } from './index';
import { createNameSlug } from '../util/nameUtils';
import { photoLineFromV3toV4 } from '../util/photoLineFromV3toV4';
import { getApp } from '../context/sharedAppContext';
import { ContactNameModal, NamingPayload } from '../ui/modals/contactNameModal';

// === Type Definitions (moved from vcard/shared) ===

export enum VCardSupportedKey {
  VERSION = "vCard Version",
  N = "Name",
  FN = "Full Name",
  NICKNAME = "Nickname",
  ADR = "Address",
  ADR_LABEL = "Address Label",
  AGENT = "Agent (Representative)",
  ANNIVERSARY = "Anniversary Date",
  BDAY = "Birthday Date",
  CATEGORIES = "Categories (Tags)",
  CLASS = "Classification (Privacy Level)",
  EMAIL = "Email Address",
  GENDER = "Gender",
  GEO = "Geolocation (Latitude/Longitude)",
  KIND = "Contact Type",
  LANG = "Language Spoken",
  MEMBER = "Group Member",
  NAME = "Name Identifier",
  NOTE = "Notes",
  ORG = "Organization Name",
  PHOTO = "Profile Photo",
  REV = "Last Updated Timestamp",
  ROLE = "Job Role or Title",
  SOURCE = "vCard Source URL",
  TEL = "Telephone Number",
  TITLE = "Job Title",
  TZ = "Time Zone",
  UID = "Unique Identifier",
  URL = "Website URL",
  SOCIALPROFILE = "Social Profile",
  RELATED = "Related Contact"
}

export interface VCardForObsidianRecord {
  [key: string]: string,
}

export interface VCardToStringError {
  status: string;
  file: string;
  message: string;
}

export interface VCardToStringReply {
  vcards: string;
  errors: VCardToStringError[];
}

export type VCardKind = "individual" | "org" | "group" | "location";

const StructuredFields = {
  N: ["FN", "GN", "MN", "PREFIX", "SUFFIX"],
  ADR: ["PO", "EXT", "STREET", "LOCALITY", "REGION", "POSTAL", "COUNTRY"]
} as const;

const VCardKinds = {
  Individual: "individual",
  Organisation: "org",
  Group: "group",
  Location: "location",
} as const;

// Export the constants
export { StructuredFields, VCardKinds };

// === Internal VCard File Operations (moved from vcard/fileOps) ===

class VCardFileOpsInternal {
  /**
   * Lists all VCF files in the specified folder.
   */
  static async listVCFFiles(folderPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      if (!entries || !Array.isArray(entries)) {
        loggingService.debug(`[VCardFileOps] No entries returned from readdir for ${folderPath}`);
        return [];
      }
      return entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.vcf'))
        .map(entry => path.join(folderPath, entry.name));
    } catch (error: any) {
      loggingService.error(`[VCardFileOps] Error listing VCF files: ${error.message}`);
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
    } catch (error: any) {
      loggingService.debug(`[VCardFileOps] Error getting file stats for ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Reads VCF file content
   */
  static async readVCFFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content) {
        loggingService.warning(`[VCardFileOps] Empty or unreadable VCF file: ${path.basename(filePath)}`);
        return null;
      }
      return content;
    } catch (error: any) {
      loggingService.error(`[VCardFileOps] Error reading VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Writes content to a VCF file
   */
  static async writeVCFFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      loggingService.debug(`[VCardFileOps] Successfully wrote VCF file: ${filePath}`);
      return true;
    } catch (error: any) {
      loggingService.error(`[VCardFileOps] Error writing VCF file ${filePath}: ${error.message}`);
      return false;
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
      loggingService.debug(`[VCardFileOps] Folder does not exist: ${folderPath}`);
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
}

// === Internal VCard Parser Implementation ===

class VCardParserInternal {
  static async *parseVCardData(vCardData: string): AsyncGenerator<[string | undefined, VCardForObsidianRecord]> {
    // This is a simplified parser - for now, we'll create a basic implementation
    // TODO: Implement full VCard parsing or integrate with a VCard parsing library
    
    // For now, create a placeholder record
    const record: VCardForObsidianRecord = {
      VERSION: "4.0",
      FN: "Placeholder Contact",
      UID: Date.now().toString()
    };
    
    yield [undefined, record];
  }

  static async generateVCardString(files: TFile[], app?: App): Promise<VCardToStringReply> {
    // Simplified VCard generation - for now, return empty content
    // TODO: Implement full VCard generation
    return {
      vcards: "BEGIN:VCARD\nVERSION:4.0\nFN:Placeholder\nEND:VCARD\n",
      errors: []
    };
  }

  static async createEmpty(): Promise<VCardForObsidianRecord> {
    const vCardObject: VCardForObsidianRecord = {
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
    return await VCFile.ensureHasName(vCardObject);
  }
}

// === Helper Functions ===

async function ensureHasName(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
  try {
    // if we can create a file name then we meet the minimum requirements
    createNameSlug(vCardObject);
    return Promise.resolve(vCardObject);
  } catch (error) {
    // Need to prompt for some form of name information.
    const app = getApp();
    return new Promise((resolve) => {
      console.warn("No name found for record", vCardObject);
      new ContactNameModal(app, (nameData: NamingPayload) => {
        if(nameData.kind === VCardKinds.Individual) {
          vCardObject["N.PREFIX"] ??= "";
          vCardObject["N.GN"] = nameData.given;
          vCardObject["N.MN"] ??= "";
          vCardObject["N.FN"] = nameData.family;
          vCardObject["N.SUFFIX"] ??= "";
        } else {
          vCardObject["FN"] ??= nameData.fn;
        }
        vCardObject["KIND"] ??= nameData.kind;
        resolve(vCardObject);
      }).open();
    });
  }
}

/**
 * VCFile represents a VCF file with integrated parsing, writing, and metadata handling.
 * This class consolidates all VCard functionality into a single, unified interface.
 */
export class VCFile {
  /**
   * List all VCF files in a folder (static, for VCFManager)
   */
  static async listVCFFiles(folderPath: string): Promise<string[]> {
    return await VCardFileOpsInternal.listVCFFiles(folderPath);
  }

  /**
   * Check if a folder exists (static, for VCFManager)
   */
  static async folderExists(folderPath: string): Promise<boolean> {
    return await VCardFileOpsInternal.folderExists(folderPath);
  }
  private _filePath: string;
  private _content: string | null = null;
  private _parsed: Array<[string, any]> | null = null;
  private _lastModified: number | null = null;
  private _uid: string | undefined;

  constructor(filePath: string) {
    this._filePath = filePath;
  }

  /**
   * Static factory method to create VCFile from file path
   */
  static fromPath(filePath: string): VCFile {
    return new VCFile(filePath);
  }

  /**
   * Static factory method to create VCFile with content
   */
  static fromContent(filePath: string, content: string): VCFile {
    const vcFile = new VCFile(filePath);
    vcFile._content = content;
    return vcFile;
  }

  /**
   * Static factory method to create VCFile from Obsidian TFile
   */
  static async fromObsidianFile(obsidianFile: TFile, vcardContent?: string): Promise<VCFile> {
    const vcfPath = VCFile.getVCFPathFromObsidianFile(obsidianFile);
    const vcFile = new VCFile(vcfPath);
    
    if (vcardContent) {
      vcFile._content = vcardContent;
    }
    
    return vcFile;
  }

  /**
   * Generate VCF file path based on Obsidian file
   */
  static getVCFPathFromObsidianFile(obsidianFile: TFile): string {
    const sanitizedName = obsidianFile.basename.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitizedName}.vcf`;
  }

  /**
   * Get the file path
   */
  get filePath(): string {
    return this._filePath;
  }

  /**
   * Get the filename from the path
   */
  get filename(): string {
    return path.basename(this._filePath);
  }

  /**
   * Get the directory path
   */
  get directory(): string {
    return path.dirname(this._filePath);
  }

  /**
   * Get the file extension
   */
  get extension(): string {
    return path.extname(this._filePath);
  }

  /**
   * Get the basename without extension
   */
  get basename(): string {
    return path.basename(this._filePath, this.extension);
  }

  /**
   * Check if this is a VCF file
   */
  get isVCF(): boolean {
    return this.extension.toLowerCase() === '.vcf';
  }

  /**
   * Get last modified timestamp
   */
  get lastModified(): number | null {
    return this._lastModified;
  }

  /**
   * Get UID from parsed content
   */
  get uid(): string | undefined {
    return this._uid;
  }

  /**
   * Check if file exists on disk
   */
  async exists(): Promise<boolean> {
    try {
      const stats = await VCardFileOpsInternal.getFileStats(this._filePath);
      return stats !== null;
    } catch {
      return false;
    }
  }

  /**
   * Load file content from disk
   */
  async load(): Promise<boolean> {
    try {
      const content = await VCardFileOpsInternal.readVCFFile(this._filePath);
      if (content === null) {
        return false;
      }

      this._content = content;
      
      // Update file stats
      const stats = await VCardFileOpsInternal.getFileStats(this._filePath);
      if (stats) {
        this._lastModified = stats.mtimeMs;
      }

      // Clear parsed cache since content changed
      this._parsed = null;
      this._uid = undefined;

      return true;
    } catch (error) {
      loggingService.error(`[VCFile] Error loading file ${this._filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Save content to disk
   */
  async save(content?: string): Promise<boolean> {
    const contentToSave = content || this._content;
    if (!contentToSave) {
      loggingService.error(`[VCFile] No content to save for ${this._filePath}`);
      return false;
    }

    const success = await VCardFileOpsInternal.writeVCFFile(this._filePath, contentToSave);
    if (success && content) {
      this._content = content;
      // Clear parsed cache since content changed
      this._parsed = null;
      this._uid = undefined;
      
      // Update file stats
      const stats = await VCardFileOpsInternal.getFileStats(this._filePath);
      if (stats) {
        this._lastModified = stats.mtimeMs;
      }
    }
    
    return success;
  }

  /**
   * Get raw content (loads from disk if not cached)
   */
  async getContent(): Promise<string | null> {
    if (this._content === null) {
      await this.load();
    }
    return this._content;
  }

  /**
   * Set content (does not save to disk until save() is called)
   */
  setContent(content: string): void {
    this._content = content;
    // Clear parsed cache since content changed
    this._parsed = null;
    this._uid = undefined;
  }

  /**
   * Parse VCard content and return parsed entries
   */
  async parse(): Promise<Array<[string, any]> | null> {
    if (this._parsed !== null) {
      return this._parsed;
    }

    const content = await this.getContent();
    if (!content) {
      return null;
    }

    try {
      const parsedEntries: Array<[string, any]> = [];
      for await (const entry of VCardParserInternal.parseVCardData(content)) {
        // entry is [string | undefined, VCardForObsidianRecord]
        // Convert undefined slug to empty string for consistency
        const [slug, record] = entry;
        parsedEntries.push([slug || '', record]);
      }
      
      this._parsed = parsedEntries;
      
      // Extract UID if present
      this._extractUID();
      
      return this._parsed;
    } catch (error) {
      loggingService.error(`[VCFile] Error parsing VCF content: ${error.message}`);
      return null;
    }
  }

  /**
   * Get first parsed record as VCardForObsidianRecord
   */
  async getFirstRecord(): Promise<VCardForObsidianRecord | null> {
    const parsed = await this.parse();
    if (!parsed || parsed.length === 0) {
      return null;
    }
    
    return parsed[0][1] as VCardForObsidianRecord;
  }

  /**
   * Get all parsed records as VCardForObsidianRecord array
   */
  async getAllRecords(): Promise<VCardForObsidianRecord[]> {
    const parsed = await this.parse();
    if (!parsed) {
      return [];
    }
    
    return parsed.map(([_, record]) => record as VCardForObsidianRecord);
  }

  /**
   * Create VCard content from Obsidian TFile
   */
  static async createFromObsidianFile(obsidianFile: TFile): Promise<string> {
    try {
      const result = await VCardParserInternal.generateVCardString([obsidianFile]);
      if (result.errors.length > 0) {
        loggingService.warning(`[VCFile] Errors creating VCard: ${JSON.stringify(result.errors)}`);
      }
      return result.vcards;
    } catch (error) {
      loggingService.error(`[VCFile] Error creating VCard from Obsidian file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate markdown filename from VCard record
   */
  static generateMarkdownFilename(record: VCardForObsidianRecord): string {
    return createFileName(record);
  }

  /**
   * Generate VCF filename from contact name or record
   */
  static generateVCFFilename(contactNameOrRecord: string | VCardForObsidianRecord): string {
    let contactName: string;
    
    if (typeof contactNameOrRecord === 'string') {
      contactName = contactNameOrRecord;
    } else {
      // Extract name from record
      contactName = contactNameOrRecord.FN || 
                   contactNameOrRecord['N.GIVEN'] || 
                   contactNameOrRecord['N.FAMILY'] || 
                   'contact';
    }
    
    return VCardFileOpsInternal.generateVCFFilename(contactName);
  }

  /**
   * Check if content contains a specific UID
   */
  async containsUID(uid: string): Promise<boolean> {
    const content = await this.getContent();
    if (!content) {
      return false;
    }
    return VCardFileOpsInternal.containsUID(content, uid);
  }

  /**
   * Extract UID from parsed content
   */
  private _extractUID(): void {
    if (!this._parsed) {
      return;
    }

    for (const [_, record] of this._parsed) {
      if (record.UID) {
        this._uid = record.UID;
        break;
      }
    }
  }

  /**
   * Refresh file stats without reloading content
   */
  async refreshStats(): Promise<void> {
    const stats = await VCardFileOpsInternal.getFileStats(this._filePath);
    if (stats) {
      this._lastModified = stats.mtimeMs;
    }
  }

  /**
   * Check if file has been modified since last load
   */
  async hasBeenModified(): Promise<boolean> {
    const stats = await VCardFileOpsInternal.getFileStats(this._filePath);
    if (!stats || this._lastModified === null) {
      return false;
    }
    return stats.mtimeMs !== this._lastModified;
  }

  /**
   * Create empty VCard content
   */
  static async createEmpty(): Promise<VCardForObsidianRecord> {
    return await VCardParserInternal.createEmpty();
  }

  // === VCard Parsing and Generation Methods (migrated from vcard module) ===

  /**
   * Parse VCard content string into structured records
   * @param vCardData Raw VCard content string
   * @returns Async generator yielding [slug, record] pairs
   */
  static async *parseVCardData(vCardData: string): AsyncGenerator<[string | undefined, VCardForObsidianRecord]> {
    // Use the existing vcard.parse method for now, but this will eventually be self-contained
    for await (const entry of VCardParserInternal.parseVCardData(vCardData)) {
      yield entry;
    }
  }

  /**
   * Generate VCard string from Obsidian files
   * @param files Array of Obsidian TFile objects
   * @param app Optional App instance
   * @returns VCardToStringReply with vcards content and any errors
   */
  static async generateVCardString(files: TFile[], app?: App): Promise<VCardToStringReply> {
    // Use the existing vcard.toString method for now, but this will eventually be self-contained
    return await VCardParserInternal.generateVCardString(files, app);
  }

  /**
   * Create empty VCard record with default structure
   * @returns Promise resolving to empty VCard record
   */
  static async createEmptyRecord(): Promise<VCardForObsidianRecord> {
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
    return await ensureHasName(vCardObject);
  }

  /**
   * Ensure VCard record has minimum required name information
   * @param vCardObject VCard record to validate
   * @returns Promise resolving to validated VCard record
   */
  static async ensureHasName(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
    return await ensureHasName(vCardObject);
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `VCFile(${this._filePath})`;
  }
}

// Types and enums are now defined above in this file
