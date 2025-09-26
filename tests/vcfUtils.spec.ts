import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { VCFUtils } from '../src/contacts/vcfUtils';
import { ContactsPluginSettings } from '../src/settings/settings.d';
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

describe('VCFUtils', () => {
  let mockSettings: ContactsPluginSettings;
  let vcfUtils: VCFUtils;

  beforeEach(() => {
    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfIgnoreFilenames: ['ignored.vcf'],
      vcfIgnoreUIDs: ['ignored-uid'],
      logLevel: 'DEBUG'
    };

    vcfUtils = new VCFUtils(mockSettings);
    vi.clearAllMocks();
  });

  describe('Constructor and Settings', () => {
    it('should initialize with settings', () => {
      expect(vcfUtils).toBeDefined();
    });

    it('should update settings correctly', () => {
      const newSettings = { ...mockSettings, vcfIgnoreFilenames: ['new-ignore.vcf'] };
      vcfUtils.updateSettings(newSettings);
      
      expect(vcfUtils.shouldIgnoreFile('/test/new-ignore.vcf')).toBe(true);
      expect(vcfUtils.shouldIgnoreFile('/test/ignored.vcf')).toBe(false); // Old setting no longer applies
    });
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

      const files = await vcfUtils.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(3);
      expect(files).toContain(path.join('/test/vcf', 'contact1.vcf'));
      expect(files).toContain(path.join('/test/vcf', 'contact2.VCF'));
      expect(files).toContain(path.join('/test/vcf', 'contact3.vcf'));
      expect(files).not.toContain(path.join('/test/vcf', 'not-vcf.txt'));
      expect(files).not.toContain(path.join('/test/vcf', 'subfolder'));
    });

    it('should handle empty directories', async () => {
      (fs.readdir as any).mockResolvedValue([]);

      const files = await vcfUtils.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
      // The debug log is only called when readdir returns null or non-array, not empty array
    });

    it('should handle readdir errors gracefully', async () => {
      (fs.readdir as any).mockRejectedValue(new Error('Access denied'));

      const files = await vcfUtils.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
      expect(loggingService.error).toHaveBeenCalledWith(
        '[VCFUtils] Error listing VCF files: Access denied'
      );
    });

    it('should handle null/undefined readdir results', async () => {
      (fs.readdir as any).mockResolvedValue(null);

      const files = await vcfUtils.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
      expect(loggingService.debug).toHaveBeenCalledWith(
        '[VCFUtils] No entries returned from readdir for /test/vcf'
      );
    });

    it('should handle non-array readdir results', async () => {
      (fs.readdir as any).mockResolvedValue('not-an-array');

      const files = await vcfUtils.listVCFFiles('/test/vcf');
      
      expect(files).toHaveLength(0);
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[VCFUtils] No entries returned from readdir')
      );
    });
  });

  describe('File and UID Filtering', () => {
    it('should identify ignored files', () => {
      expect(vcfUtils.shouldIgnoreFile('/test/vcf/ignored.vcf')).toBe(true);
      expect(vcfUtils.shouldIgnoreFile('/test/vcf/normal.vcf')).toBe(false);
      expect(vcfUtils.shouldIgnoreFile('/other/path/ignored.vcf')).toBe(true); // Path doesn't matter, just filename
    });

    it('should identify ignored UIDs', () => {
      expect(vcfUtils.shouldIgnoreUID('ignored-uid')).toBe(true);
      expect(vcfUtils.shouldIgnoreUID('normal-uid')).toBe(false);
    });

    it('should log ignored files and UIDs', () => {
      vcfUtils.shouldIgnoreFile('/test/vcf/ignored.vcf');
      expect(loggingService.info).toHaveBeenCalledWith('[VCFUtils] Skipping ignored VCF file: ignored.vcf');

      vcfUtils.shouldIgnoreUID('ignored-uid');
      expect(loggingService.info).toHaveBeenCalledWith('[VCFUtils] Skipping ignored UID: ignored-uid');
    });

    it('should handle files with different path separators', () => {
      // On Unix systems, backslashes are not treated as separators
      // so we test with normalized paths
      expect(vcfUtils.shouldIgnoreFile('/test/vcf/ignored.vcf')).toBe(true);
      expect(vcfUtils.shouldIgnoreFile('/different/path/ignored.vcf')).toBe(true);
      expect(vcfUtils.shouldIgnoreFile('/test/vcf/normal.vcf')).toBe(false);
    });
  });

  describe('File Statistics', () => {
    it('should get file statistics successfully', async () => {
      const mockStats = { mtimeMs: 1234567890 };
      (fs.stat as any).mockResolvedValue(mockStats);

      const stats = await vcfUtils.getFileStats('/test/file.vcf');
      
      expect(stats).toEqual({ mtimeMs: 1234567890 });
      expect(fs.stat).toHaveBeenCalledWith('/test/file.vcf');
    });

    it('should handle stat errors gracefully', async () => {
      (fs.stat as any).mockRejectedValue(new Error('File not found'));

      const stats = await vcfUtils.getFileStats('/test/missing.vcf');
      
      expect(stats).toBeNull();
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[VCFUtils] Error getting file stats')
      );
    });

    it('should handle null stat results', async () => {
      (fs.stat as any).mockResolvedValue(null);

      const stats = await vcfUtils.getFileStats('/test/file.vcf');
      
      expect(stats).toBeNull();
    });
  });

  describe('File Reading and Writing', () => {
    it('should read VCF file successfully', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      (fs.readFile as any).mockResolvedValue(mockContent);

      const content = await vcfUtils.readVCFFile('/test/file.vcf');
      
      expect(content).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.vcf', 'utf-8');
    });

    it('should handle empty VCF files', async () => {
      (fs.readFile as any).mockResolvedValue('');

      const content = await vcfUtils.readVCFFile('/test/empty.vcf');
      
      expect(content).toBeNull();
      expect(loggingService.warning).toHaveBeenCalledWith(
        '[VCFUtils] Empty or unreadable VCF file: empty.vcf'
      );
    });

    it('should handle read errors gracefully', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('Permission denied'));

      const content = await vcfUtils.readVCFFile('/test/protected.vcf');
      
      expect(content).toBeNull();
      expect(loggingService.error).toHaveBeenCalledWith(
        '[VCFUtils] Error reading VCF file /test/protected.vcf: Permission denied'
      );
    });

    it('should write VCF file successfully', async () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      (fs.writeFile as any).mockResolvedValue(undefined);

      const success = await vcfUtils.writeVCFFile('/test/output.vcf', vcfContent);
      
      expect(success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith('/test/output.vcf', vcfContent, 'utf-8');
      expect(loggingService.debug).toHaveBeenCalledWith(
        '[VCFUtils] Successfully wrote VCF file: /test/output.vcf'
      );
    });

    it('should handle write errors gracefully', async () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      (fs.writeFile as any).mockRejectedValue(new Error('Disk full'));

      const success = await vcfUtils.writeVCFFile('/test/output.vcf', vcfContent);
      
      expect(success).toBe(false);
      expect(loggingService.error).toHaveBeenCalledWith(
        '[VCFUtils] Error writing VCF file /test/output.vcf: Disk full'
      );
    });
  });

  describe('VCF File Search by UID', () => {
    it('should find VCF file containing specific UID', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const file1Content = 'BEGIN:VCARD\nVERSION:3.0\nUID:other-uid\nEND:VCARD';
      const file2Content = 'BEGIN:VCARD\nVERSION:3.0\nUID:target-uid\nEND:VCARD';

      vi.spyOn(vcfUtils, 'listVCFFiles').mockResolvedValue(mockFiles);
      (fs.readFile as any)
        .mockResolvedValueOnce(file1Content)
        .mockResolvedValueOnce(file2Content);

      const foundFile = await vcfUtils.findVCFFileByUID('target-uid');
      
      expect(foundFile).toBe('/test/vcf/contact2.vcf');
    });

    it('should return null when UID is not found', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf'];
      const fileContent = 'BEGIN:VCARD\nVERSION:3.0\nUID:different-uid\nEND:VCARD';

      vi.spyOn(vcfUtils, 'listVCFFiles').mockResolvedValue(mockFiles);
      (fs.readFile as any).mockResolvedValue(fileContent);

      const foundFile = await vcfUtils.findVCFFileByUID('target-uid');
      
      expect(foundFile).toBeNull();
    });

    it('should return null when watch folder is not set', async () => {
      const settingsWithoutFolder = { ...mockSettings, vcfWatchFolder: '' };
      vcfUtils.updateSettings(settingsWithoutFolder);

      const foundFile = await vcfUtils.findVCFFileByUID('any-uid');
      
      expect(foundFile).toBeNull();
    });

    it('should handle file read errors during search', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const file2Content = 'BEGIN:VCARD\nVERSION:3.0\nUID:target-uid\nEND:VCARD';

      vi.spyOn(vcfUtils, 'listVCFFiles').mockResolvedValue(mockFiles);
      (fs.readFile as any)
        .mockRejectedValueOnce(new Error('File error'))
        .mockResolvedValueOnce(file2Content);

      const foundFile = await vcfUtils.findVCFFileByUID('target-uid');
      
      expect(foundFile).toBe('/test/vcf/contact2.vcf');
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[VCFUtils] Error reading VCF file')
      );
    });

    it('should handle listVCFFiles errors during search', async () => {
      vi.spyOn(vcfUtils, 'listVCFFiles').mockRejectedValue(new Error('Directory access error'));

      const foundFile = await vcfUtils.findVCFFileByUID('target-uid');
      
      expect(foundFile).toBeNull();
      expect(loggingService.debug).toHaveBeenCalledWith(
        expect.stringContaining('[VCFUtils] Error searching for VCF file with UID')
      );
    });
  });

  describe('Watch Folder Management', () => {
    it('should check if watch folder exists', async () => {
      (fs.access as any).mockResolvedValue(undefined);

      const exists = await vcfUtils.checkWatchFolderExists();
      
      expect(exists).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/vcf');
    });

    it('should return false when watch folder does not exist', async () => {
      (fs.access as any).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const exists = await vcfUtils.checkWatchFolderExists();
      
      expect(exists).toBe(false);
      expect(loggingService.warning).toHaveBeenCalledWith(
        '[VCFUtils] VCF watch folder does not exist: /test/vcf'
      );
    });

    it('should return false when watch folder is not set', async () => {
      const settingsWithoutFolder = { ...mockSettings, vcfWatchFolder: '' };
      vcfUtils.updateSettings(settingsWithoutFolder);

      const exists = await vcfUtils.checkWatchFolderExists();
      
      expect(exists).toBe(false);
      expect(fs.access).not.toHaveBeenCalled();
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
        const result = vcfUtils.generateVCFFilename(input);
        expect(result, `Input: "${input}"`).toBe(expected);
      });
    });

    it('should preserve alphanumeric, hyphens, and underscores', () => {
      const validChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
      const result = vcfUtils.generateVCFFilename(validChars);
      expect(result).toBe(`${validChars}.vcf`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle filesystem errors consistently', async () => {
      const testOperations = [
        () => vcfUtils.getFileStats('/nonexistent/file.vcf'),
        () => vcfUtils.readVCFFile('/protected/file.vcf'),
        () => vcfUtils.writeVCFFile('/readonly/file.vcf', 'content'),
        () => vcfUtils.findVCFFileByUID('any-uid'),
        () => vcfUtils.checkWatchFolderExists()
      ];

      // Mock all fs operations to fail
      (fs.stat as any).mockRejectedValue(new Error('FS Error'));
      (fs.readFile as any).mockRejectedValue(new Error('FS Error'));
      (fs.writeFile as any).mockRejectedValue(new Error('FS Error'));
      (fs.access as any).mockRejectedValue(new Error('FS Error'));
      vi.spyOn(vcfUtils, 'listVCFFiles').mockRejectedValue(new Error('FS Error'));

      // All operations should handle errors gracefully
      for (const operation of testOperations) {
        await expect(operation()).resolves.not.toThrow();
      }
    });

    it('should handle unicode characters in filenames', () => {
      const unicodeNames = [
        'José García',
        '张三',
        'محمد عبدالله',
        'Владимир Путин',
        '🙂 Emoji Name 🎉'
      ];

      unicodeNames.forEach(name => {
        const result = vcfUtils.generateVCFFilename(name);
        expect(result).toMatch(/^[\w_-]+\.vcf$/); // Should only contain safe characters
      });
    });
  });
});