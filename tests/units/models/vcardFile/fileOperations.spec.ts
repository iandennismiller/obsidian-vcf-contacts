import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCardFileOperations } from '../../../../src/models/vcardFile/fileOperations';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
}));

const mockedFs = vi.mocked(fs);

describe('VCardFileOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listVCFFiles', () => {
    it('should list VCF files in a directory', async () => {
      const mockEntries = [
        { name: 'contact1.vcf', isFile: () => true },
        { name: 'contact2.vcf', isFile: () => true },
        { name: 'readme.txt', isFile: () => true }
      ];

      mockedFs.readdir.mockResolvedValue(mockEntries as any);

      const result = await VCardFileOperations.listVcardFiles('/test/folder');

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        path.join('/test/folder', 'contact1.vcf'),
        path.join('/test/folder', 'contact2.vcf')
      ]);
    });

    it('should handle directory read errors gracefully', async () => {
      mockedFs.readdir.mockRejectedValue(new Error('Directory not found'));

      const result = await VCardFileOperations.listVcardFiles('/nonexistent');

      expect(result).toEqual([]);
    });

    it('should filter out directories', async () => {
      const mockEntries = [
        { name: 'contact1.vcf', isFile: () => true },
        { name: 'subfolder', isFile: () => false },
        { name: 'contact2.vcf', isFile: () => true }
      ];
      mockedFs.readdir.mockResolvedValue(mockEntries as any);

      const result = await VCardFileOperations.listVcardFiles('/test/folder');

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        path.join('/test/folder', 'contact1.vcf'),
        path.join('/test/folder', 'contact2.vcf')
      ]);
    });
  });

  describe('generateVCFFilename', () => {
    it('should generate valid VCF filenames', () => {
      expect(VCardFileOperations.generateVcardFilename('John Doe')).toBe('John_Doe.vcf');
      expect(VCardFileOperations.generateVcardFilename('Mary Jane Smith')).toBe('Mary_Jane_Smith.vcf');
      expect(VCardFileOperations.generateVcardFilename('Dr. Robert Wilson Jr.')).toBe('Dr__Robert_Wilson_Jr_.vcf');
    });

    it('should handle special characters', () => {
      expect(VCardFileOperations.generateVcardFilename("O'Brien, Patrick")).toBe('O_Brien__Patrick.vcf');
      expect(VCardFileOperations.generateVcardFilename('José García-López')).toBe('Jos__Garc_a-L_pez.vcf');
    });

    it('should handle empty or invalid names', () => {
      expect(VCardFileOperations.generateVcardFilename('')).toBe('.vcf');
      expect(VCardFileOperations.generateVcardFilename('   ')).toBe('___.vcf');
      expect(VCardFileOperations.generateVcardFilename('!@#$%')).toBe('_____.vcf');
    });
  });

  describe('writeVCFFile', () => {
    it('should write VCF content to file successfully', async () => {
      mockedFs.writeFile.mockResolvedValue(undefined);

      const content = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      const result = await VCardFileOperations.writeVcardFile('/test/john.vcf', content);

      expect(result).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith('/test/john.vcf', content, 'utf-8');
    });

    it('should handle write errors gracefully', async () => {
      mockedFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const content = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      const result = await VCardFileOperations.writeVcardFile('/test/john.vcf', content);

      expect(result).toBe(false);
    });
  });

  describe('readVCFFile', () => {
    it('should read VCF file content successfully', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD';
      mockedFs.readFile.mockResolvedValue(mockContent);

      const result = await VCardFileOperations.readVcardFile('/test/john.vcf');

      expect(result).toBe(mockContent);
      expect(mockedFs.readFile).toHaveBeenCalledWith('/test/john.vcf', 'utf-8');
    });

    it('should handle read errors gracefully', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await VCardFileOperations.readVcardFile('/test/nonexistent.vcf');

      expect(result).toBe(null);
    });
  });

  describe('getFileStats', () => {
    it('should get file stats successfully', async () => {
      const mockStats = { 
        mtimeMs: 1640995200000,
        isFile: () => true,
        isDirectory: () => false
      };
      mockedFs.stat.mockResolvedValue(mockStats as any);

      const result = await VCardFileOperations.getFileStats('/test/john.vcf');

      expect(result).toEqual({
        mtimeMs: 1640995200000
      });
    });

    it('should handle stat errors gracefully', async () => {
      mockedFs.stat.mockRejectedValue(new Error('File not found'));

      const result = await VCardFileOperations.getFileStats('/test/nonexistent.vcf');

      expect(result).toBe(null);
    });
  });

  describe('containsUID', () => {
    it('should find UID in VCF content', () => {
      const content = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
END:VCARD`;

      expect(VCardFileOperations.containsUID(content, 'john-doe-123')).toBe(true);
      expect(VCardFileOperations.containsUID(content, 'jane-doe-456')).toBe(false);
    });

    it('should handle different UID formats', () => {
      const content = `BEGIN:VCARD
VERSION:4.0
UID:urn:uuid:550e8400-e29b-41d4-a716-446655440000
FN:John Doe
END:VCARD`;

      expect(VCardFileOperations.containsUID(content, 'urn:uuid:550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should handle multiple VCards in one file', () => {
      const content = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:jane-doe-456
FN:Jane Doe
END:VCARD`;

      expect(VCardFileOperations.containsUID(content, 'john-doe-123')).toBe(true);
      expect(VCardFileOperations.containsUID(content, 'jane-doe-456')).toBe(true);
      expect(VCardFileOperations.containsUID(content, 'bob-doe-789')).toBe(false);
    });
  });

  describe('folderExists', () => {
    it('should return true for existing folders', async () => {
      mockedFs.access.mockResolvedValue(undefined);

      const result = await VCardFileOperations.folderExists('/test/existing');

      expect(result).toBe(true);
    });

    it('should return false for non-existing folders', async () => {
      mockedFs.access.mockRejectedValue(new Error('Folder not found'));

      const result = await VCardFileOperations.folderExists('/test/nonexistent');

      expect(result).toBe(false);
    });
  });
});