import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCFile } from '../src/contacts/VCFile';
import { loggingService } from '../src/services/loggingService';

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

  // Spy on internal file ops exposed via VCFile static methods
  const readSpy = vi.spyOn((VCFile as any).__proto__?.constructor ?? VCFile, 'listVCFFiles');
  // Instead of spying listVCFFiles, we directly spy on the internal read method used by VCFile.load
  const readFileSpy = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'readVCFFile').mockResolvedValue(mockContent);
  const statSpy = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'getFileStats').mockResolvedValue(mockStats);

  const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const result = await vcFile.load();

      expect(result).toBe(true);
      expect(await vcFile.getContent()).toBe(mockContent);
      expect(vcFile.lastModified).toBe(1234567890);
    });

    it('should save content to disk', async () => {
      const content = 'BEGIN:VCARD\nVERSION:4.0\nFN:Jane Doe\nEND:VCARD';
      const mockStats = { mtimeMs: 1234567891 };

  const writeSpy = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'writeVCFFile').mockResolvedValue(true);
  const statSpy2 = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'getFileStats').mockResolvedValue(mockStats);

  const vcFile = VCFile.fromContent('/test/path/contact.vcf', content);
  const result = await vcFile.save();

  expect(result).toBe(true);
  expect(writeSpy).toHaveBeenCalledWith('/test/path/contact.vcf', content);

  writeSpy.mockRestore();
  statSpy2.mockRestore();
    });

    it('should check if file exists', async () => {
      const mockStats = { mtimeMs: 1234567890 };
  const statSpy3 = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'getFileStats').mockResolvedValue(mockStats);

  const vcFile = VCFile.fromPath('/test/path/contact.vcf');
  const exists = await vcFile.exists();

  expect(exists).toBe(true);
  expect(statSpy3).toHaveBeenCalledWith('/test/path/contact.vcf');

  statSpy3.mockRestore();
    });
  });

  describe('VCard Parsing', () => {
    it('should parse VCard content', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nUID:test-uid\nEND:VCARD';
      const mockParsedEntries: Array<[string, any]> = [
        ['john-doe', { FN: 'John Doe', UID: 'test-uid', VERSION: '4.0' }]
      ];

      const readFileSpy2 = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'readVCFFile').mockResolvedValue(mockContent);

      // Provide a mock parser by spying on VCardParserInternal.parseVCardData
      const parserSpy = vi.spyOn(require('../src/contacts/VCFile').VCardParserInternal as any, 'parseVCardData').mockImplementation(async function*() {
        for (const [slug, record] of mockParsedEntries) {
          yield [slug, record];
        }
      } as any);

      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const result = await vcFile.parse();

      expect(result).toEqual(mockParsedEntries);
      expect(vcFile.uid).toBe('test-uid');

      readFileSpy2.mockRestore();
      parserSpy.mockRestore();
    });

    it('should get first record from parsed content', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      const mockRecord = { FN: 'John Doe', VERSION: '4.0' };

      const readFileSpy3 = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'readVCFFile').mockResolvedValue(mockContent);
      const parserSpy2 = vi.spyOn(require('../src/contacts/VCFile').VCardParserInternal as any, 'parseVCardData').mockImplementation(async function*() {
        yield ['john-doe', mockRecord];
      } as any);

      const vcFile = VCFile.fromPath('/test/path/contact.vcf');
      const result = await vcFile.getFirstRecord();

      expect(result).toEqual(mockRecord);

      readFileSpy3.mockRestore();
      parserSpy2.mockRestore();
    });

    it('should check if content contains UID', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nUID:test-uid-123\nEND:VCARD';
      
  const readFileSpy4 = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'readVCFFile').mockResolvedValue(mockContent);
  const containsSpy = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'containsUID').mockReturnValue(true);

  const vcFile = VCFile.fromPath('/test/path/contact.vcf');
  const result = await vcFile.containsUID('test-uid-123');

  expect(result).toBe(true);
  expect(containsSpy).toHaveBeenCalledWith(mockContent, 'test-uid-123');

  readFileSpy4.mockRestore();
  containsSpy.mockRestore();
    });
  });

  describe('Static Utility Methods', () => {
    it('should generate VCF filename from contact name', () => {
      const genSpy = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'generateVCFFilename').mockReturnValue('John_Doe.vcf');

      const result = VCFile.generateVCFFilename('John Doe');
      expect(result).toBe('John_Doe.vcf');
      expect(genSpy).toHaveBeenCalledWith('John Doe');

      genSpy.mockRestore();
    });

    it('should generate VCF filename from VCard record', () => {
  const genSpy2 = vi.spyOn(require('../src/contacts/VCFile').VCardFileOpsInternal as any, 'generateVCFFilename').mockReturnValue('Jane_Smith.vcf');

  const record = { FN: 'Jane Smith', EMAIL: 'jane@example.com' };
  const result = VCFile.generateVCFFilename(record);
  expect(result).toBe('Jane_Smith.vcf');
  expect(genSpy2).toHaveBeenCalledWith('Jane Smith');

  genSpy2.mockRestore();
    });

    it('should create empty VCard record', async () => {
      const mockEmptyRecord = { 
        'N.GIVEN': '', 
        'N.FAMILY': '', 
        FN: 'Test Contact',
        VERSION: '4.0' 
      };
      
  const createSpy = vi.spyOn(require('../src/contacts/VCFile').VCardParserInternal as any, 'createEmpty').mockResolvedValue(mockEmptyRecord);

  const result = await VCFile.createEmpty();
  expect(result).toEqual(mockEmptyRecord);

  createSpy.mockRestore();
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
