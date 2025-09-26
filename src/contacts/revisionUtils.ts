import { TFile, App } from 'obsidian';
import { VCardForObsidianRecord } from './vcard/shared/vcard.d';
import { loggingService } from '../services/loggingService';

/**
 * Utilities for handling VCF revision timestamps and comparisons
 */
export class RevisionUtils {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Parses a revision date string from VCF REV field.
   * 
   * Handles multiple date formats:
   * - vCard format: YYYYMMDDTHHMMSSZ
   * - ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
   * 
   * @param revString - The revision string from VCF REV field
   * @returns Parsed Date object or null if parsing fails
   */
  parseRevisionDate(revString?: string): Date | null {
    if (!revString) return null;
    
    try {
      // REV field can be in various formats like ISO 8601 or timestamp
      // Handle common vCard REV format: 20240101T120000Z
      let dateString = revString;
      
      // If it's in vCard format (YYYYMMDDTHHMMSSZ), convert to ISO format
      if (/^\d{8}T\d{6}Z?$/.test(revString)) {
        const year = revString.substring(0, 4);
        const month = revString.substring(4, 6);
        const day = revString.substring(6, 8);
        const hour = revString.substring(9, 11);
        const minute = revString.substring(11, 13);
        const second = revString.substring(13, 15);
        
        // Basic validation of date components
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        
        if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
          loggingService.debug(`[RevisionUtils] Invalid date components in: ${revString}`);
          return null;
        }
        
        dateString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      }
      
      const date = new Date(dateString);
      
      // Check if the date is valid and represents the same date we intended to create
      if (isNaN(date.getTime())) {
        return null;
      }
      
      // Additional validation for dates that might be adjusted by JS Date constructor
      if (dateString.includes('-') && dateString.includes('T')) {
        const originalParts = dateString.split('T')[0].split('-');
        if (originalParts.length === 3) {
          const originalMonth = parseInt(originalParts[1], 10);
          const originalDay = parseInt(originalParts[2], 10);
          
          // Check if the parsed date represents a different month/day than intended
          if (date.getUTCMonth() + 1 !== originalMonth || date.getUTCDate() !== originalDay) {
            loggingService.debug(`[RevisionUtils] Date was adjusted by constructor: ${revString} -> ${date.toISOString()}`);
            return null;
          }
        }
      }
      
      return date;
    } catch (error) {
      loggingService.debug(`[RevisionUtils] Error parsing REV date: ${revString} - ${error.message}`);
      return null;
    }
  }

  /**
   * Determines if an existing contact should be updated based on revision timestamps.
   * 
   * Compares the REV field from the VCF record with the existing contact file's REV.
   * Only updates if the VCF has a newer revision timestamp.
   * 
   * @param vcfRecord - The VCF record data with REV field
   * @param existingFile - The existing contact file in Obsidian
   * @returns Promise resolving to true if contact should be updated, false otherwise
   */
  async shouldUpdateContact(vcfRecord: VCardForObsidianRecord, existingFile: TFile): Promise<boolean> {
    try {
      const cache = this.app.metadataCache.getFileCache(existingFile);
      const existingRev = cache?.frontmatter?.REV;
      const vcfRev = vcfRecord.REV;

      // If either REV is missing, we can't compare - skip update
      if (!existingRev || !vcfRev) {
        loggingService.debug(`[RevisionUtils] Missing REV field: existing=${existingRev}, vcf=${vcfRev}`);
        return false;
      }

      const existingRevDate = this.parseRevisionDate(existingRev);
      const vcfRevDate = this.parseRevisionDate(vcfRev);

      // If we can't parse either date, skip update
      if (!existingRevDate || !vcfRevDate) {
        loggingService.debug(`[RevisionUtils] Failed to parse dates: existing=${existingRevDate}, vcf=${vcfRevDate}`);
        return false;
      }

      // Update if VCF REV is newer than existing REV
      const shouldUpdate = vcfRevDate > existingRevDate;
      loggingService.debug(`[RevisionUtils] REV comparison: VCF ${vcfRev} (${vcfRevDate.toISOString()}) vs existing ${existingRev} (${existingRevDate.toISOString()}) -> ${shouldUpdate}`);
      return shouldUpdate;
    } catch (error) {
      loggingService.debug(`[RevisionUtils] Error comparing REV fields for ${existingFile.path}: ${error.message}`);
      return false;
    }
  }
}