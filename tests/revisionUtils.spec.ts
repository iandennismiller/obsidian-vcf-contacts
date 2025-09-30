import { ContactNote } from 'src/contacts/contactNote';

// Create a test ContactNote instance for testing static methods
const createTestContactNote = () => new ContactNote(null as any, null as any, null as any);
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App } from 'obsidian';
import { RevisionUtils } from '../src/contacts/revisionUtils';
import { VCardForObsidianRecord } from '../src/contacts/vcard/shared/vcard.d';
import { loggingService } from '../src/services/loggingService';

// Mock the logging service
vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    debug: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}));

describe('RevisionUtils', () => {
  let mockApp: Partial<App>;
  let revisionUtils: RevisionUtils;

  beforeEach(() => {
    mockApp = {
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };
    
    revisionUtils = new RevisionUtils(mockApp as App);
    vi.clearAllMocks();
  });

  describe('Date Parsing and Comparison', () => {
    it('should parse valid vCard REV timestamps', () => {
      const validTimestamp = '20240315T143000Z';
      const result = revisionUtils.parseRevDate(validTimestamp);
      
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
        const result = revisionUtils.parseRevDate(timestamp);
        expect(result).toBeNull();
      });
    });
  });

  describe('Contact Update Decision', () => {
    let mockFile: TFile;
    let vcfRecord: VCardForObsidianRecord;

    beforeEach(() => {
      mockFile = { path: 'Contacts/john-doe.md' } as TFile;
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

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
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

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
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

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfWithLaterMinute, mockFile);
      expect(shouldUpdate).toBe(true);
    });

    it('should log detailed comparison information', async () => {
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: '20240314T143000Z'
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);

      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringMatching(/\[RevisionUtils\] REV comparison: VCF .* vs existing .* -> true/)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let mockFile: TFile;
    let vcfRecord: VCardForObsidianRecord;

    beforeEach(() => {
      mockFile = { path: 'Contacts/john-doe.md' } as TFile;
      vcfRecord = {
        UID: 'test-uid-123',
        FN: 'John Doe',
        REV: '20240315T143000Z'
      } as VCardForObsidianRecord;
    });

    it('should handle null/undefined inputs gracefully', async () => {
      const result = await revisionUtils.shouldUpdateContact(null as any, null as any);
      expect(result).toBe(false);
    });

    it('should not update when existing file has no REV', async () => {
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123'
          // No REV field
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
      expect(shouldUpdate).toBe(false);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[RevisionUtils] Missing REV field')
      );
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

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfWithoutRev, mockFile);
      expect(shouldUpdate).toBe(false);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[RevisionUtils] Missing REV field')
      );
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

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfWithInvalidRev, mockFile);
      expect(shouldUpdate).toBe(false);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[RevisionUtils] Failed to parse dates')
      );
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

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfWithValidRev, mockFile);
      expect(shouldUpdate).toBe(false);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[RevisionUtils] Failed to parse dates')
      );
    });
  });
});