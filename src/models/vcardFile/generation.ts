import { TFile, App } from "obsidian";
import { VCardToStringError, VCardToStringReply, StructuredFields } from './types';
import { getApp } from "../../plugin/context/sharedAppContext";
import { ContactManagerUtils } from "../contactManager/contactManagerUtils";
import { parseKey } from "../contactNote";
import { generateVcardFromFrontmatter, obsidianFrontmatterToVcard4 } from './vcard4Adapter';

/**
 * VCard generation operations
 * Now delegates to vcard4 library for RFC 6350 compliant generation
 */
export class VCardGenerator {
  /**
   * Create VCard data from Obsidian contact files
   * Uses vcard4 library for generation
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
   * Uses vcard4 library for generation
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
    // Convert the object back to VCF format using vcard4
    return generateVcardFromFrontmatter(namedObject);
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

    // Use vcard4 for generation
    return generateVcardFromFrontmatter(frontMatterWithFN);
  }

  /**
   * Convert vCard object to VCF string
   * Uses vcard4 library for generation
   * 
   * @deprecated Use generateVcardFromFrontmatter from vcard4Adapter instead
   */
  static objectToVcf(vCardObject: Record<string, any>): string {
    return generateVcardFromFrontmatter(vCardObject);
  }
}