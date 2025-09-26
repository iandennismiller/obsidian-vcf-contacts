import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VCardFileOps } from '../src/contacts/vcard/fileOps';
import { loggingService } from '../src/services/loggingService';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn()
}));

// Mock the logging service
vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    debug: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}));

describe('VCardFileOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VCF File Listing', () => {
    it('should list VCF files correctly', async () => {
      const mockEntries = [
        { name: 'contact1.vcf', isFile: () => true },
        { name: 'contact2.VCF', isFile: () => true }, // Test case insensitive
        { name: 'not-vcf.txt', isFile: () => true },
        { name: 'subfolder', isFile: () => false },
        { name: 'contact3.vcf', isFile: () => true }
      ];

      (fs.readdir as any).mockResolvedValue(mockEntries);

      const files = await VCardFileOps.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(3);
      expect(files).toContain(path.join('/test/vcf', 'contact1.vcf'));
      expect(files).toContain(path.join('/test/vcf', 'contact2.VCF'));
      expect(files).toContain(path.join('/test/vcf', 'contact3.vcf'));
      expect(files).not.toContain(path.join('/test/vcf', 'not-vcf.txt'));
      expect(files).not.toContain(path.join('/test/vcf', 'subfolder'));
    });

    it('should handle empty directories', async () => {
      (fs.readdir as any).mockResolvedValue([]);

      const files = await VCardFileOps.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
    });

    it('should handle readdir errors gracefully', async () => {
      (fs.readdir as any).mockRejectedValue(new Error('Access denied'));

      const files = await VCardFileOps.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
      expect(loggingService.error).toHaveBeenCalledWith(
        '[VCardFileOps] Error listing VCF files: Access denied'
      );
    });

    it('should handle null/undefined readdir results', async () => {
      (fs.readdir as any).mockResolvedValue(null);

      const files = await VCardFileOps.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
      expect(loggingService.debug).toHaveBeenCalledWith(
        '[VCardFileOps] No entries returned from readdir for /test/vcf'
      );
    });

    it('should handle non-array readdir results', async () => {
      (fs.readdir as any).mockResolvedValue('not-an-array');

      const files = await VCardFileOps.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[VCardFileOps] No entries returned from readdir')
      );
    });
  });

  describe('File Statistics', () => {
    it('should get file statistics successfully', async () => {
      const mockStats = { mtimeMs: 1234567890 };
      (fs.stat as any).mockResolvedValue(mockStats);

      const stats = await VCardFileOps.getFileStats('/test/file.vcf');
      
      expect(stats).toEqual({ mtimeMs: 1234567890 });
      expect(fs.stat).toHaveBeenCalledWith('/test/file.vcf');
    });

    it('should handle stat errors gracefully', async () => {
      (fs.stat as any).mockRejectedValue(new Error('File not found'));

      const stats = await VCardFileOps.getFileStats('/test/missing.vcf');
      
      expect(stats).toBeNull();
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[VCardFileOps] Error getting file stats')
      );
    });

    it('should handle null stat results', async () => {
      (fs.stat as any).mockResolvedValue(null);

      const stats = await VCardFileOps.getFileStats('/test/file.vcf');
      
      expect(stats).toBeNull();
    });
  });

  describe('File Reading and Writing', () => {
    it('should read VCF file successfully', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      (fs.readFile as any).mockResolvedValue(mockContent);

      const content = await VCardFileOps.readVCFFile('/test/file.vcf');
      
      expect(content).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.vcf', 'utf-8');
    });

    it('should handle empty VCF files', async () => {
      (fs.readFile as any).mockResolvedValue('');

      const content = await VCardFileOps.readVCFFile('/test/empty.vcf');
      
      expect(content).toBeNull();
      expect(loggingService.warning).toHaveBeenCalledWith(
        '[VCardFileOps] Empty or unreadable VCF file: empty.vcf'
      );
    });

    it('should handle read errors gracefully', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('Permission denied'));

      const content = await VCardFileOps.readVCFFile('/test/protected.vcf');
      
      expect(content).toBeNull();
      expect(loggingService.error).toHaveBeenCalledWith(
        '[VCardFileOps] Error reading VCF file /test/protected.vcf: Permission denied'
      );
    });

    it('should write VCF file successfully', async () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      (fs.writeFile as any).mockResolvedValue(undefined);

      const success = await VCardFileOps.writeVCFFile('/test/output.vcf', vcfContent);
      
      expect(success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith('/test/output.vcf', vcfContent, 'utf-8');
      expect(loggingService.debug).toHaveBeenCalledWith(
        '[VCardFileOps] Successfully wrote VCF file: /test/output.vcf'
      );
    });

    it('should handle write errors gracefully', async () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      (fs.writeFile as any).mockRejectedValue(new Error('Disk full'));

      const success = await VCardFileOps.writeVCFFile('/test/output.vcf', vcfContent);
      
      expect(success).toBe(false);
      expect(loggingService.error).toHaveBeenCalledWith(
        '[VCardFileOps] Error writing VCF file /test/output.vcf: Disk full'
      );
    });
  });

  describe('Folder Operations', () => {
    it('should check if folder exists', async () => {
      (fs.access as any).mockResolvedValue(undefined);

      const exists = await VCardFileOps.folderExists('/test/vcf');
      
      expect(exists).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/vcf');
    });

    it('should return false when folder does not exist', async () => {
      (fs.access as any).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const exists = await VCardFileOps.folderExists('/test/vcf');
      
      expect(exists).toBe(false);
      expect(loggingService.debug).toHaveBeenCalledWith(
        '[VCardFileOps] Folder does not exist: /test/vcf'
      );
    });

    it('should return false when folder path is empty', async () => {
      const exists = await VCardFileOps.folderExists('');
      
      expect(exists).toBe(false);
      expect(fs.access).not.toHaveBeenCalled();
    });
  });

  describe('UID Operations', () => {
    it('should find UID in VCF content', () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nUID:test-uid-123\nFN:John Doe\nEND:VCARD';
      
      const hasUID = VCardFileOps.containsUID(vcfContent, 'test-uid-123');
      
      expect(hasUID).toBe(true);
    });

    it('should not find non-existent UID', () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nUID:test-uid-123\nFN:John Doe\nEND:VCARD';
      
      const hasUID = VCardFileOps.containsUID(vcfContent, 'different-uid');
      
      expect(hasUID).toBe(false);
    });

    it('should handle empty content', () => {
      const hasUID = VCardFileOps.containsUID('', 'test-uid-123');
      
      expect(hasUID).toBe(false);
    });
  });

  describe('Filename Generation', () => {
    it('should generate sanitized VCF filenames', () => {
      const testCases = [
        { input: 'John Doe', expected: 'John_Doe.vcf' },
        { input: 'Jane-Smith', expected: 'Jane-Smith.vcf' },
        { input: 'Bob_Wilson', expected: 'Bob_Wilson.vcf' },
        { input: 'Alice@Company.com', expected: 'Alice_Company_com.vcf' },
        { input: 'Special!@#$%^&*()Chars', expected: 'Special__________Chars.vcf' },
        { input: 'Numbers123AndText', expected: 'Numbers123AndText.vcf' },
        { input: '', expected: '.vcf' },
        { input: '   spaces   ', expected: '___spaces___.vcf' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = VCardFileOps.generateVCFFilename(input);
        expect(result, `Input: "${input}"`).toBe(expected);
      });
    });

    it('should preserve alphanumeric, hyphens, and underscores', () => {
      const validChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
      const result = VCardFileOps.generateVCFFilename(validChars);
      expect(result).toBe(`${validChars}.vcf`);
    });

    it('should handle unicode characters', () => {
      const unicodeNames = [
        'José García',
        '张三',
        'محمد عبدالله',
        'Владимир Путин',
        '🙂 Emoji Name 🎉'
      ];

      unicodeNames.forEach(name => {
        const result = VCardFileOps.generateVCFFilename(name);
        expect(result).toMatch(/^[\w_-]+\.vcf$/); // Should only contain safe characters
      });
    });
  });
});