/**
 * Revision and timestamp operations for contact versioning
 */

import { ContactData } from './contactData';

/**
 * Operations for handling contact revision timestamps and versioning
 */
export class RevisionOperations {
  private contactData: ContactData;

  constructor(contactData: ContactData) {
    this.contactData = contactData;
  }

  /**
   * Parse a VCard REV date string into a Date object
   * Handles VCard format: YYYYMMDDTHHMMSSZ
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
   * Check if contact should be updated from vcard based on REV timestamp
   */
  async shouldUpdateFromVcard(record: Record<string, any>): Promise<boolean> {
    const frontmatter = await this.contactData.getFrontmatter();
    if (!frontmatter) return true;

    const contactRev = frontmatter.REV;
    const vcardRev = record.REV;

    // If either timestamp is missing, don't update (conservative approach)
    if (!contactRev || !vcardRev) return false;

    // Parse both timestamps using VCard format parser
    const contactDate = this.parseRevDate(contactRev);
    const vcardDate = this.parseRevDate(vcardRev);

    // If we can't parse either date, don't update
    if (!contactDate || !vcardDate) return false;

    // Compare timestamps - allow update if vcard is newer
    return vcardDate.getTime() > contactDate.getTime();
  }
}
