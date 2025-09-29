import { TFile, App } from "obsidian";
import * as fs from 'fs/promises';
import * as path from 'path';
import { VCardForObsidianRecord, VCardToStringReply } from './types';
import { VCardParser } from './parsing';
import { VCardGenerator } from './generation';
import { VCardFileOperations } from './fileOperations';

/**
 * A unified interface for interacting with single vCard files (VCF)
 * Focuses on operations that act upon a single vCard instance
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
        console.log(`[VcardFile] Empty or unreadable VCF file: ${path.basename(filePath)}`);
        return null;
      }
      return new VcardFile(content);
    } catch (error) {
      console.log(`[VcardFile] Error reading VCF file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a VcardFile instance from Obsidian contact files
   */
  static async fromObsidianFiles(contactFiles: TFile[], app?: App): Promise<VCardToStringReply> {
    return VCardGenerator.fromObsidianFiles(contactFiles, app);
  }

  /**
   * Create an empty VcardFile instance with default fields
   */
  static async createEmpty(): Promise<VcardFile> {
    const vcfContent = await VCardGenerator.createEmpty();
    return new VcardFile(vcfContent);
  }

  /**
   * Parse the vCard data and yield [slug, vCardObject] tuples
   */
  async* parse(): AsyncGenerator<[string | undefined, VCardForObsidianRecord], void, unknown> {
    yield* VCardParser.parse(this.data);
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
      return true;
    } catch (error) {
      console.log(`[VcardFile] Error writing VCF file ${filePath}: ${error.message}`);
      return false;
    }
  }

  // Constants migrated from original file
  static readonly CONTACTS_VIEW_CONFIG = {
    type: "contacts-view",
    name: "Contacts",
    icon: "contact",
  };

  static readonly Sort = {
    NAME: 0,
    BIRTHDAY: 1,
    ORG: 2
  } as const;

  // Static methods for backward compatibility - delegate to VCardFileOperations
  static async listVCFFiles(folderPath: string): Promise<string[]> {
    return VCardFileOperations.listVCFFiles(folderPath);
  }

  static async getFileStats(filePath: string): Promise<{ mtimeMs: number } | null> {
    return VCardFileOperations.getFileStats(filePath);
  }

  static async folderExists(folderPath: string): Promise<boolean> {
    return VCardFileOperations.folderExists(folderPath);
  }

  static containsUID(content: string, uid: string): boolean {
    return VCardFileOperations.containsUID(content, uid);
  }

  static generateVCFFilename(contactName: string): string {
    return VCardFileOperations.generateVCFFilename(contactName);
  }

  static async readVCFFile(filePath: string): Promise<string | null> {
    return VCardFileOperations.readVCFFile(filePath);
  }

  static async writeVCFFile(filePath: string, content: string): Promise<boolean> {
    return VCardFileOperations.writeVCFFile(filePath, content);
  }

  static photoLineFromV3toV4(line: string): string {
    return VCardParser.photoLineFromV3toV4(line);
  }

  static objectToVcf(vCardObject: Record<string, any>): string {
    return VCardGenerator.objectToVcf(vCardObject);
  }
}