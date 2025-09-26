import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCFile } from '../src/contacts/VCFile';
import { VCardFileOps } from '../src/contacts/vcard/fileOps';
import { vcard } from '../src/contacts/vcard';

// Mock the dependencies
vi.mock('../src/contacts/vcard/fileOps');
vi.mock('../src/contacts/vcard');
vi.mock('../src/services/loggingService');

describe('VCFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Factory Methods', () => {
    it('should create VCFile from path', () => {
      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      expect(vcFile.filePath).toBe('/test/path/contact.vcf');
      expect(vcFile.filename).toBe('contact.vcf');
      expect(vcFile.basename).toBe('contact');
      expect(vcFile.extension).toBe('.vcf');
      expect(vcFile.isVCF).toBe(true);
    });

    it('should create VCFile from content', () => {
      const content = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      const vcFile = VCFile.fromContent('/test/path/contact.vcf', content);
      expect(vcFile.filePath).toBe('/test/path/contact.vcf');
    });
  });

  describe('File Operations', () => {
    it('should load content from disk', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      const mockStats = { mtimeMs: 1234567890 };

      vi.mocked(VCardFileOps.readVCFFile).mockResolvedValue(mockContent);
      vi.mocked(VCardFileOps.getFileStats).mockResolvedValue(mockStats);

      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const result = await vcFile.load();

      expect(result).toBe(true);
      expect(await vcFile.getContent()).toBe(mockContent);
      expect(vcFile.lastModified).toBe(1234567890);
    });

    it('should save content to disk', async () => {
      const content = 'BEGIN:VCARD\nVERSION:4.0\nFN:Jane Doe\nEND:VCARD';
      const mockStats = { mtimeMs: 1234567891 };

      vi.mocked(VCardFileOps.writeVCFFile).mockResolvedValue(true);
      vi.mocked(VCardFileOps.getFileStats).mockResolvedValue(mockStats);

      const vcFile = VCFile.fromContent('/test/path/contact.vcf', content);
      const result = await vcFile.save();

      expect(result).toBe(true);
      expect(VCardFileOps.writeVCFFile).toHaveBeenCalledWith('/test/path/contact.vcf', content);
    });

    it('should check if file exists', async () => {
      const mockStats = { mtimeMs: 1234567890 };
      vi.mocked(VCardFileOps.getFileStats).mockResolvedValue(mockStats);

      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const exists = await vcFile.exists();

      expect(exists).toBe(true);
      expect(VCardFileOps.getFileStats).toHaveBeenCalledWith('/test/path/contact.vcf');
    });
  });

  describe('VCard Parsing', () => {
    it('should parse VCard content', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nUID:test-uid\nEND:VCARD';
      const mockParsedEntries: Array<[string, any]> = [
        ['john-doe', { FN: 'John Doe', UID: 'test-uid', VERSION: '4.0' }]
      ];

      vi.mocked(VCardFileOps.readVCFFile).mockResolvedValue(mockContent);
      
      // Mock async generator with proper typing
      const mockGenerator = (async function* (): AsyncGenerator<[string | undefined, any], void, unknown> {
        for (const [slug, record] of mockParsedEntries) {
          yield [slug, record];
        }
      })();
      vi.mocked(vcard.parse).mockReturnValue(mockGenerator);

      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const result = await vcFile.parse();

      expect(result).toEqual(mockParsedEntries);
      expect(vcFile.uid).toBe('test-uid');
    });

    it('should get first record from parsed content', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      const mockRecord = { FN: 'John Doe', VERSION: '4.0' };

      vi.mocked(VCardFileOps.readVCFFile).mockResolvedValue(mockContent);
      
      const mockGenerator = (async function* (): AsyncGenerator<[string | undefined, any], void, unknown> {
        yield ['john-doe', mockRecord];
      })();
      vi.mocked(vcard.parse).mockReturnValue(mockGenerator);

      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const result = await vcFile.getFirstRecord();

      expect(result).toEqual(mockRecord);
    });

    it('should check if content contains UID', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nUID:test-uid-123\nEND:VCARD';
      
      vi.mocked(VCardFileOps.readVCFFile).mockResolvedValue(mockContent);
      vi.mocked(VCardFileOps.containsUID).mockReturnValue(true);

      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const result = await vcFile.containsUID('test-uid-123');

      expect(result).toBe(true);
      expect(VCardFileOps.containsUID).toHaveBeenCalledWith(mockContent, 'test-uid-123');
    });
  });

  describe('Static Utility Methods', () => {
    it('should generate VCF filename from contact name', () => {
      vi.mocked(VCardFileOps.generateVCFFilename).mockReturnValue('John_Doe.vcf');
      
      const result = VCFile.generateVCFFilename('John Doe');
      expect(result).toBe('John_Doe.vcf');
      expect(VCardFileOps.generateVCFFilename).toHaveBeenCalledWith('John Doe');
    });

    it('should generate VCF filename from VCard record', () => {
      vi.mocked(VCardFileOps.generateVCFFilename).mockReturnValue('Jane_Smith.vcf');
      
      const record = { FN: 'Jane Smith', EMAIL: 'jane@example.com' };
      const result = VCFile.generateVCFFilename(record);
      expect(result).toBe('Jane_Smith.vcf');
      expect(VCardFileOps.generateVCFFilename).toHaveBeenCalledWith('Jane Smith');
    });

    it('should create empty VCard record', async () => {
      const mockEmptyRecord = { 
        'N.GIVEN': '', 
        'N.FAMILY': '', 
        FN: 'Test Contact',
        VERSION: '4.0' 
      };
      
      vi.mocked(vcard.createEmpty).mockResolvedValue(mockEmptyRecord);

      const result = await VCFile.createEmpty();
      expect(result).toEqual(mockEmptyRecord);
    });
  });

  describe('File Properties', () => {
    it('should correctly identify file properties', () => {
      const vcFile = VCFile.fromPath('/test/contacts/john-doe.vcf');
      
      expect(vcFile.filePath).toBe('/test/contacts/john-doe.vcf');
      expect(vcFile.filename).toBe('john-doe.vcf');
      expect(vcFile.directory).toBe('/test/contacts');
      expect(vcFile.extension).toBe('.vcf');
      expect(vcFile.basename).toBe('john-doe');
      expect(vcFile.isVCF).toBe(true);
    });

    it('should identify non-VCF files', () => {
      const vcFile = VCFile.fromPath('/test/contacts/document.txt');
      expect(vcFile.isVCF).toBe(false);
    });
  });
});
