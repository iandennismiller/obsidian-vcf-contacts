import { App, TFile } from 'obsidian';
import { VCardForObsidianRecord } from '../models/vcardFile/types';
import { loggingService } from '../services/loggingService';

/**
 * Utility class for handling VCard revision comparisons and contact update decisions
 */
export class RevisionUtils {
  constructor(private app: App) {}

  /**
   * Parse a VCard REV date string into a Date object
   */
  parseRevDate(revString: string): Date | null {
    if (!revString) {
      return null;
    }

    try {
      // Only handle VCard format: YYYYMMDDTHHMMSSZ - be strict about format
      if (/^\d{8}T\d{6}Z$/.test(revString)) {
        const year = parseInt(revString.substr(0, 4), 10);
        const month = parseInt(revString.substr(4, 2), 10);
        const day = parseInt(revString.substr(6, 2), 10);
        const hour = parseInt(revString.substr(9, 2), 10);
        const minute = parseInt(revString.substr(11, 2), 10);
        const second = parseInt(revString.substr(13, 2), 10);

        // Validate ranges
        if (month < 1 || month > 12 || day < 1 || day > 31 || 
            hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
          return null;
        }

        const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
        return isNaN(date.getTime()) ? null : date;
      }

      // Don't parse ISO format or other formats - return null for non-VCard formats
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Determine whether a contact should be updated based on REV timestamps
   */
  async shouldUpdateContact(vcfRecord: VCardForObsidianRecord, file: TFile): Promise<boolean> {
    if (!vcfRecord || !file) {
      return false;
    }

    try {
      const fileCache = this.app.metadataCache.getFileCache(file);
      const frontmatter = fileCache?.frontmatter;

      if (!frontmatter) {
        loggingService.debug('[RevisionUtils] No frontmatter found in existing file');
        return true;
      }

      const existingRev = frontmatter.REV;
      const vcfRev = vcfRecord.REV;

      // If either REV is missing, don't update
      if (!existingRev || !vcfRev) {
        loggingService.debug('[RevisionUtils] Missing REV field - existing or VCF');
        return false;
      }

      const existingDate = this.parseRevDate(existingRev);
      const vcfDate = this.parseRevDate(vcfRev);

      // If we can't parse either date, don't update
      if (!existingDate || !vcfDate) {
        loggingService.debug('[RevisionUtils] Failed to parse dates - existing or VCF REV format invalid');
        return false;
      }

      const shouldUpdate = vcfDate.getTime() > existingDate.getTime();
      
      loggingService.debug(
        `[RevisionUtils] REV comparison: VCF ${vcfRev} vs existing ${existingRev} -> ${shouldUpdate}`
      );

      return shouldUpdate;
    } catch (error) {
      loggingService.error(`[RevisionUtils] Error comparing revisions: ${error.message}`);
      return false;
    }
  }
}