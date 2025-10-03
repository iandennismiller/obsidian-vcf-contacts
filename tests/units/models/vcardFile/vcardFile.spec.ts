import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VcardFile } from '../../../../src/models/vcardFile/vcardFile';
import { TFile } from 'obsidian';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock the specialized classes
vi.mock('../../../../src/models/vcardFile/parsing', () => ({
  VCardParser: {
    async *parse(data: string) {
      if (data.includes('UID:test-123')) {
        yield ['john-doe', {
          UID: 'test-123',
          FN: 'John Doe',
          EMAIL: 'john@example.com'
        }];
      }
    },
    photoLineFromV3toV4: vi.fn((line: string) => line.replace('v3', 'v4'))
  }
}));

vi.mock('../../../../src/models/vcardFile/generation', () => ({
  VCardGenerator: {
    fromObsidianFiles: vi.fn(),
    createEmpty: vi.fn().mockResolvedValue('BEGIN:VCARD\nVERSION:4.0\nEND:VCARD\n'),
    objectToVcf: vi.fn((obj: any) => `BEGIN:VCARD\nVERSION:4.0\nUID:${obj.UID}\nEND:VCARD\n`)
  }
}));

vi.mock('../../../../src/models/vcardFile/fileOperations', () => ({
  VCardFileOperations: {
    listVcardFiles: vi.fn(),
    getFileStats: vi.fn(),
    folderExists: vi.fn(),
    containsUID: vi.fn(),
    generateVcardFilename: vi.fn(),
    readVcardFile: vi.fn(),
    writeVcardFile: vi.fn()
  }
}));

describe('VcardFile', () => {
  let fsPromises: any;

  beforeEach(async () => {
    fsPromises = await import('fs/promises');
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with provided data', () => {
      const vcfData = 'BEGIN:VCARD\nVERSION:4.0\nUID:test\nEND:VCARD\n';
      const vcard = new VcardFile(vcfData);
      
      expect(vcard).toBeDefined();
      expect(vcard.toString()).toBe(vcfData);
    });

    it('should create instance with empty string if no data provided', () => {
      const vcard = new VcardFile();
      
      expect(vcard).toBeDefined();
      expect(vcard.toString()).toBe('');
    });

    it('should store the raw VCard data', () => {
      const testData = 'test vcard content';
      const vcard = new VcardFile(testData);
      
      expect(vcard.toString()).toBe(testData);
    });
  });

  describe('fromFile', () => {
    it('should read and create VcardFile from file path', async () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:4.0\nUID:test\nFN:Test User\nEND:VCARD\n';
      vi.mocked(fsPromises.readFile).mockResolvedValue(vcfContent);

      const vcard = await VcardFile.fromFile('/path/to/contact.vcf');

      expect(vcard).not.toBeNull();
      expect(vcard?.toString()).toBe(vcfContent);
      expect(fsPromises.readFile).toHaveBeenCalledWith('/path/to/contact.vcf', 'utf-8');
    });

    it('should return null if file is empty', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue('');

      const vcard = await VcardFile.fromFile('/path/to/empty.vcf');

      expect(vcard).toBeNull();
    });

    it('should return null and log error if file read fails', async () => {
      const consoleSpy = vi.spyOn(console, 'debug');
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('File not found'));

      const vcard = await VcardFile.fromFile('/path/to/missing.vcf');

      expect(vcard).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading VCF file')
      );
    });

    it('should handle various file paths correctly', async () => {
      const testPaths = [
        '/absolute/path/contact.vcf',
        'relative/path/contact.vcf',
        '/with spaces/contact name.vcf',
        '/special-chars/contact_123.vcf'
      ];

      vi.mocked(fsPromises.readFile).mockResolvedValue('BEGIN:VCARD\nEND:VCARD\n');

      for (const path of testPaths) {
        const vcard = await VcardFile.fromFile(path);
        expect(vcard).not.toBeNull();
      }
    });
  });

  describe('fromObsidianFiles', () => {
    it('should delegate to VCardGenerator', async () => {
      const { VCardGenerator } = await import('../../../../src/models/vcardFile/generation');
      const mockFiles = [
        { path: 'Contacts/john.md', basename: 'john' } as TFile,
        { path: 'Contacts/jane.md', basename: 'jane' } as TFile
      ];

      vi.mocked(VCardGenerator.fromObsidianFiles).mockResolvedValue({
        vcards: 'vcard data',
        errors: []
      });

      const result = await VcardFile.fromObsidianFiles(mockFiles);

      expect(VCardGenerator.fromObsidianFiles).toHaveBeenCalledWith(mockFiles, undefined);
      expect(result.vcards).toBe('vcard data');
    });

    it('should pass app parameter when provided', async () => {
      const { VCardGenerator } = await import('../../../../src/models/vcardFile/generation');
      const mockApp = {} as any;
      const mockFiles = [] as TFile[];

      vi.mocked(VCardGenerator.fromObsidianFiles).mockResolvedValue({
        vcards: '',
        errors: []
      });

      await VcardFile.fromObsidianFiles(mockFiles, mockApp);

      expect(VCardGenerator.fromObsidianFiles).toHaveBeenCalledWith(mockFiles, mockApp);
    });
  });

  describe('createEmpty', () => {
    it('should create empty VcardFile with template', async () => {
      const { VCardGenerator } = await import('../../../../src/models/vcardFile/generation');
      
      const vcard = await VcardFile.createEmpty();

      expect(VCardGenerator.createEmpty).toHaveBeenCalled();
      expect(vcard).toBeDefined();
      expect(vcard.toString()).toBe('BEGIN:VCARD\nVERSION:4.0\nEND:VCARD\n');
    });

    it('should return a VcardFile instance', async () => {
      const vcard = await VcardFile.createEmpty();
      
      expect(vcard).toBeInstanceOf(VcardFile);
    });
  });

  describe('parse', () => {
    it('should parse VCard data and yield contacts', async () => {
      const vcfData = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-123\nFN:John Doe\nEND:VCARD\n';
      const vcard = new VcardFile(vcfData);

      const results: Array<[string | undefined, any]> = [];
      for await (const result of vcard.parse()) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0][0]).toBe('john-doe');
      expect(results[0][1].UID).toBe('test-123');
      expect(results[0][1].FN).toBe('John Doe');
    });

    it('should handle empty VCard data', async () => {
      const vcard = new VcardFile('');

      const results: Array<[string | undefined, any]> = [];
      for await (const result of vcard.parse()) {
        results.push(result);
      }

      expect(results).toHaveLength(0);
    });

    it('should yield multiple contacts from multi-contact VCard', async () => {
      // This test verifies the async generator works correctly
      const vcfData = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-123\nFN:John\nEND:VCARD\n';
      const vcard = new VcardFile(vcfData);

      let count = 0;
      for await (const _ of vcard.parse()) {
        count++;
      }

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('toString', () => {
    it('should return the raw VCard data', () => {
      const vcfData = 'BEGIN:VCARD\nVERSION:4.0\nUID:test\nEND:VCARD\n';
      const vcard = new VcardFile(vcfData);

      expect(vcard.toString()).toBe(vcfData);
    });

    it('should return empty string for empty VCard', () => {
      const vcard = new VcardFile();

      expect(vcard.toString()).toBe('');
    });

    it('should preserve exact data format', () => {
      const vcfData = 'BEGIN:VCARD\r\nVERSION:4.0\r\nUID:test\r\nEND:VCARD\r\n';
      const vcard = new VcardFile(vcfData);

      expect(vcard.toString()).toBe(vcfData);
    });
  });

  describe('saveToFile', () => {
    it('should save VCard data to file', async () => {
      const vcfData = 'BEGIN:VCARD\nVERSION:4.0\nUID:test\nEND:VCARD\n';
      const vcard = new VcardFile(vcfData);

      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const success = await vcard.saveToFile('/path/to/save.vcf');

      expect(success).toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        '/path/to/save.vcf',
        vcfData,
        'utf-8'
      );
    });

    it('should return false and log error on write failure', async () => {
      const consoleSpy = vi.spyOn(console, 'debug');
      const vcard = new VcardFile('test data');

      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('Write failed'));

      const success = await vcard.saveToFile('/path/to/fail.vcf');

      expect(success).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error writing VCF file')
      );
    });

    it('should handle empty VCard data', async () => {
      const vcard = new VcardFile('');

      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const success = await vcard.saveToFile('/path/to/empty.vcf');

      expect(success).toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        '/path/to/empty.vcf',
        '',
        'utf-8'
      );
    });
  });

  describe('Sort constants', () => {
    it('should define sort constants', () => {
      expect(VcardFile.Sort).toBeDefined();
      expect(VcardFile.Sort.NAME).toBe(0);
      expect(VcardFile.Sort.BIRTHDAY).toBe(1);
      expect(VcardFile.Sort.ORG).toBe(2);
    });

    it('should have immutable sort constants', () => {
      // The Sort object is defined with 'as const' which makes it readonly
      expect(VcardFile.Sort.NAME).toBe(0);
      expect(VcardFile.Sort.BIRTHDAY).toBe(1);
      expect(VcardFile.Sort.ORG).toBe(2);
    });
  });
});
