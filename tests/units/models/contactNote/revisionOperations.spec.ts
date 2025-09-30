import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App } from 'obsidian';
import { ContactNote } from '../../../../src/models/contactNote/contactNote';
import { VCardForObsidianRecord } from '../../../../src/models/vcardFile/types';
import { ContactsPluginSettings } from '../../../../src/plugin/settings';

describe('ContactNote - Revision Utils', () => {
  let mockApp: Partial<App>;
  let mockFile: TFile;
  let mockSettings: ContactsPluginSettings;
  let contactNote: ContactNote;

  beforeEach(() => {
    mockFile = { 
      path: 'Contacts/john-doe.md',
      basename: 'john-doe'
    } as TFile;
    
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };
    
    mockSettings = {
      contactsFolder: 'Contacts'
    } as ContactsPluginSettings;
    
    contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    vi.clearAllMocks();
  });

  describe('Date Parsing and Comparison', () => {
    it('should parse valid vCard REV timestamps', () => {
      const validTimestamp = '20240315T143000Z';
      const result = contactNote.parseRevDate(validTimestamp);
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(2); // March is month 2 (0-based)
      expect(result?.getDate()).toBe(15);
    });

    it('should return null for invalid timestamps', () => {
      const invalidTimestamps = [
        'invalid-date',
        '2024-03-15T14:30:00Z', // ISO format - not VCard format
        '20241332T143000Z', // Invalid month
        ''
      ];

      invalidTimestamps.forEach(timestamp => {
        const result = contactNote.parseRevDate(timestamp);
        expect(result).toBeNull();
      });
    });
  });

  describe('Contact Update Decision', () => {
    let vcfRecord: VCardForObsidianRecord;

    beforeEach(() => {
      vcfRecord = {
        UID: 'test-uid-123',
        FN: 'John Doe',
        REV: '20240315T143000Z'
      } as VCardForObsidianRecord;
    });

    it('should update when VCF has newer revision', async () => {
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: '20240314T143000Z' // Day earlier
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await contactNote.shouldUpdateFromVCF(vcfRecord);
      expect(shouldUpdate).toBe(true);
    });

    it('should not update when existing file has newer revision', async () => {
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: '20240316T143000Z' // Day later
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await contactNote.shouldUpdateFromVCF(vcfRecord);
      expect(shouldUpdate).toBe(false);
    });

    it('should update when VCF has newer minute-level precision', async () => {
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: '20240315T143000Z' // 14:30:00
        }
      };

      const vcfWithLaterMinute = {
        UID: 'test-uid-123',
        FN: 'John Doe',
        REV: '20240315T143100Z' // 14:31:00 (1 minute later)
      } as VCardForObsidianRecord;

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await contactNote.shouldUpdateFromVCF(vcfWithLaterMinute);
      expect(shouldUpdate).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let vcfRecord: VCardForObsidianRecord;

    beforeEach(() => {
      vcfRecord = {
        UID: 'test-uid-123',
        FN: 'John Doe',
        REV: '20240315T143000Z'
      } as VCardForObsidianRecord;
    });

    it('should not update when existing file has no REV', async () => {
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123'
          // No REV field
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await contactNote.shouldUpdateFromVCF(vcfRecord);
      expect(shouldUpdate).toBe(false);
    });

    it('should not update when VCF has no REV', async () => {
      const vcfWithoutRev = {
        UID: 'test-uid-123',
        FN: 'John Doe'
        // No REV field
      } as VCardForObsidianRecord;

      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: '20240315T143000Z'
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await contactNote.shouldUpdateFromVCF(vcfWithoutRev);
      expect(shouldUpdate).toBe(false);
    });

    it('should not update when REV dates cannot be parsed', async () => {
      const vcfWithInvalidRev = {
        UID: 'test-uid-123',
        FN: 'John Doe',
        REV: 'invalid-date'
      } as VCardForObsidianRecord;

      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: 'also-invalid-date'
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await contactNote.shouldUpdateFromVCF(vcfWithInvalidRev);
      expect(shouldUpdate).toBe(false);
    });

    it('should handle mixed valid/invalid REV dates', async () => {
      const vcfWithValidRev = {
        UID: 'test-uid-123',
        FN: 'John Doe',
        REV: '20240315T143000Z'
      } as VCardForObsidianRecord;

      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: 'invalid-existing-date'
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await contactNote.shouldUpdateFromVCF(vcfWithValidRev);
      expect(shouldUpdate).toBe(false);
    });
  });
});