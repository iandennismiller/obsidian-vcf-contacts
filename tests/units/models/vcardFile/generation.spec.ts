import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCardGenerator } from '../../../../src/models/vcardFile/generation';
import { TFile, App } from 'obsidian';

// Mock ContactManagerUtils at the module level
vi.mock('../../../../src/models/contactManager/contactManagerUtils', () => ({
  ContactManagerUtils: {
    ensureHasName: vi.fn()
  }
}));

describe('VCardGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fromObsidianFiles', () => {
    it('should generate VCard from Obsidian contact files', async () => {
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue({
            frontmatter: {
              UID: 'john-doe-123',
              FN: 'John Doe',
              EMAIL: 'john@example.com'
            }
          })
        }
      } as any;

      const mockFiles = [
        { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile
      ];

      const result = await VCardGenerator.fromObsidianFiles(mockFiles, mockApp);

      expect(result.vcards).toContain('BEGIN:VCARD');
      expect(result.vcards).toContain('UID:john-doe-123');
      expect(result.vcards).toContain('FN:John Doe');
      expect(result.vcards).toContain('EMAIL:john@example.com');
      expect(result.vcards).toContain('END:VCARD');
      expect(result.errors).toEqual([]);
    });

    it('should handle empty contact file array', async () => {
      const result = await VCardGenerator.fromObsidianFiles([]);
      
      expect(result.vcards).toBe('');
      expect(result.errors).toEqual([]);
    });

    it('should collect errors for problematic files', async () => {
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn().mockImplementation(() => {
            throw new Error('Metadata error');
          })
        }
      } as any;

      const mockFiles = [
        { basename: 'problem-file', path: 'Contacts/problem-file.md' } as TFile
      ];

      const result = await VCardGenerator.fromObsidianFiles(mockFiles, mockApp);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].status).toBe('error');
      expect(result.errors[0].file).toBe('problem-file.md');
    });
  });

  describe('createEmpty', () => {
    it('should create an empty VCard template', async () => {
      // Get the mocked function
      const { ContactManagerUtils } = await import('../../../../src/models/contactManager/contactManagerUtils');
      const mockEnsureHasName = vi.mocked(ContactManagerUtils.ensureHasName);
      
      // Set up the mock return value
      mockEnsureHasName.mockResolvedValue({
        FN: 'New Contact',
        UID: 'new-contact-uid',
        VERSION: '4.0'
      });
      
      const result = await VCardGenerator.createEmpty();
      
      expect(result).toContain('BEGIN:VCARD');
      expect(result).toContain('END:VCARD');
      expect(mockEnsureHasName).toHaveBeenCalled();
    }, 10000); // Increase timeout
  });

  describe('objectToVcf', () => {
    it('should convert object to VCF format', () => {
      const vCardObject = {
        UID: 'test-123',
        FN: 'Test Contact',
        EMAIL: 'test@example.com',
        'RELATED[spouse]': 'name:Spouse Name'
      };

      const result = VCardGenerator.objectToVcf(vCardObject);

      expect(result).toContain('BEGIN:VCARD');
      expect(result).toContain('UID:test-123');
      expect(result).toContain('FN:Test Contact');
      expect(result).toContain('EMAIL:test@example.com');
      expect(result).toContain('RELATED;TYPE=spouse:name:Spouse Name');
      expect(result).toContain('END:VCARD');
    });

    it('should handle structured fields correctly', () => {
      const vCardObject = {
        UID: 'structured-123',
        'N.FN': 'Doe',
        'N.GN': 'John',
        'N.MN': 'William',
        'N.PREFIX': 'Dr.',
        'N.SUFFIX': 'Jr.',
        'ADR.STREET': '123 Main St',
        'ADR.LOCALITY': 'Anytown',
        'ADR.REGION': 'CA',
        'ADR.POSTAL': '12345',
        'ADR.COUNTRY': 'USA'
      };

      const result = VCardGenerator.objectToVcf(vCardObject);

      // Updated to match the structured field format
      expect(result).toContain('N.FN:Doe');
      expect(result).toContain('N.GN:John');
      expect(result).toContain('N.MN:William');
      expect(result).toContain('N.PREFIX:Dr.');
      expect(result).toContain('N.SUFFIX:Jr.');
      expect(result).toContain('ADR.STREET:123 Main St');
      expect(result).toContain('ADR.LOCALITY:Anytown');
      expect(result).toContain('ADR.REGION:CA');
      expect(result).toContain('ADR.POSTAL:12345');
      expect(result).toContain('ADR.COUNTRY:USA');
    });

    it('should handle empty or minimal objects', () => {
      const minimalObject = {
        UID: 'minimal-123'
      };

      const result = VCardGenerator.objectToVcf(minimalObject);

      expect(result).toContain('BEGIN:VCARD');
      expect(result).toContain('UID:minimal-123');
      expect(result).toContain('END:VCARD');
    });
  });
});