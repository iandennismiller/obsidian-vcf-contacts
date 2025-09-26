// @vitest-skip - Deprecated: This test was for individual utility modules that have been consolidated into ContactNote
import.meta.env.VITEST_SKIP = true;
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
  });

  describe('Revision Date Parsing', () => {
    it('should parse vCard format dates correctly', () => {
      const vcardDate = '20240315T143000Z';
      const parsed = revisionUtils.parseRevisionDate(vcardDate);
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getFullYear()).toBe(2024);
      expect(parsed?.getMonth()).toBe(2); // March (0-indexed)
      expect(parsed?.getDate()).toBe(15);
      expect(parsed?.getHours()).toBe(14);
      expect(parsed?.getMinutes()).toBe(30);
      expect(parsed?.getSeconds()).toBe(0);
    });

    it('should parse ISO 8601 format dates correctly', () => {
      const isoDate = '2024-03-15T14:30:00Z';
      const parsed = revisionUtils.parseRevisionDate(isoDate);
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getFullYear()).toBe(2024);
      expect(parsed?.getMonth()).toBe(2); // March (0-indexed)
      expect(parsed?.getDate()).toBe(15);
    });

    it('should handle vCard format without Z suffix', () => {
      const vcardDate = '20240315T143000';
      const parsed = revisionUtils.parseRevisionDate(vcardDate);
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getFullYear()).toBe(2024);
    });

    it('should return null for empty strings', () => {
      expect(revisionUtils.parseRevisionDate('')).toBeNull();
      expect(revisionUtils.parseRevisionDate(undefined)).toBeNull();
    });

    it('should return null for invalid date strings', () => {
      const invalidDates = [
        'invalid-date',
        '2024-13-40T25:99:99Z', // Invalid date components
        'not-a-date-at-all',
        '20240315T', // Incomplete vCard format
      ];

      invalidDates.forEach(invalidDate => {
        expect(revisionUtils.parseRevisionDate(invalidDate)).toBeNull();
      });
    });

    it('should handle various date format edge cases', () => {
      const testCases = [
        { input: '20240229T120000Z', expected: true },  // Leap year
        { input: '20241231T235959Z', expected: true },  // End of year
        { input: '20240101T000000Z', expected: true },  // Start of year
        { input: '20241301T120000Z', expected: false }, // Invalid month
        { input: '20240431T120000Z', expected: false }, // Invalid day for April
      ];

      testCases.forEach(({ input, expected }) => {
        const result = revisionUtils.parseRevisionDate(input);
        if (expected) {
          expect(result).toBeInstanceOf(Date);
          expect(result?.getTime()).not.toBeNaN();
        } else {
          expect(result).toBeNull();
        }
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

    it('should not update when VCF has older revision', async () => {
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

    it('should not update when VCF has same revision', async () => {
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: '20240315T143000Z' // Same time
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
      expect(shouldUpdate).toBe(false);
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
      // VCF has valid date, existing has invalid
      const mockCache = {
        frontmatter: {
          UID: 'test-uid-123',
          REV: 'invalid-existing-date'
        }
      };

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
      expect(shouldUpdate).toBe(false);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[RevisionUtils] Failed to parse dates')
      );
    });

    it('should handle metadata cache errors gracefully', async () => {
      mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation(() => {
        throw new Error('Metadata cache error');
      });

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
      expect(shouldUpdate).toBe(false);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[RevisionUtils] Error comparing REV fields')
      );
    });

    it('should work with different date formats', async () => {
      const testCases = [
        {
          name: 'vCard vs ISO format',
          existingRev: '20240314T143000Z',
          vcfRev: '2024-03-15T14:30:00Z',
          expectedUpdate: true
        },
        {
          name: 'ISO vs vCard format',
          existingRev: '2024-03-15T14:30:00Z',
          vcfRev: '20240314T143000Z',
          expectedUpdate: false
        },
        {
          name: 'Both vCard format',
          existingRev: '20240314T143000Z',
          vcfRev: '20240315T143000Z',
          expectedUpdate: true
        },
        {
          name: 'Both ISO format',
          existingRev: '2024-03-14T14:30:00Z',
          vcfRev: '2024-03-15T14:30:00Z',
          expectedUpdate: true
        }
      ];

      for (const testCase of testCases) {
        const mockCache = {
          frontmatter: {
            UID: 'test-uid-123',
            REV: testCase.existingRev
          }
        };

        const testVcfRecord = {
          UID: 'test-uid-123',
          FN: 'John Doe',
          REV: testCase.vcfRev
        } as VCardForObsidianRecord;

        mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(mockCache);

        const shouldUpdate = await revisionUtils.shouldUpdateContact(testVcfRecord, mockFile);
        expect(shouldUpdate, `Test case: ${testCase.name}`).toBe(testCase.expectedUpdate);
      }
    });

    it('should handle precision differences in timestamps', async () => {
      // Test minute-level precision differences
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
    it('should handle null/undefined inputs gracefully', async () => {
      const mockFile = { path: 'Contacts/test.md' } as TFile;
      const vcfRecord = {} as VCardForObsidianRecord; // Empty record

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {}
      });

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
      expect(shouldUpdate).toBe(false);
    });

    it('should handle missing metadata cache gracefully', async () => {
      const mockFile = { path: 'Contacts/test.md' } as TFile;
      const vcfRecord = { REV: '20240315T143000Z' } as VCardForObsidianRecord;

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(null);

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
      expect(shouldUpdate).toBe(false);
    });

    it('should handle missing frontmatter gracefully', async () => {
      const mockFile = { path: 'Contacts/test.md' } as TFile;
      const vcfRecord = { REV: '20240315T143000Z' } as VCardForObsidianRecord;

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({});

      const shouldUpdate = await revisionUtils.shouldUpdateContact(vcfRecord, mockFile);
      expect(shouldUpdate).toBe(false);
    });
  });
});