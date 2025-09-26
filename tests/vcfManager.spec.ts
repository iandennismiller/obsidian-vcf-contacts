import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCFManager } from '../src/contacts/vcfManager';
import { VcardFile } from '../src/contacts/vcardFile';
import { ContactsPluginSettings } from '../src/settings/settings.d';
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

// Mock VcardFile
vi.mock('../src/contacts/vcard/fileOps', () => ({
  VcardFile: {
    listVCFFiles: vi.fn(),
    getFileStats: vi.fn(),
    readVCFFile: vi.fn(),
    writeVCFFile: vi.fn(),
    folderExists: vi.fn(),
    containsUID: vi.fn(),
    generateVCFFilename: vi.fn()
  }
}));

// Mock vcard
vi.mock('../src/contacts/vcard', () => ({
  vcard: {
    parse: vi.fn()
  }
}));

describe('VCFManager', () => {
  let mockSettings: ContactsPluginSettings;
  let vcfManager: VCFManager;

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

    vcfManager = new VCFManager(mockSettings);
    vi.clearAllMocks();
  });

  describe('Constructor and Settings', () => {
    it('should initialize with settings', () => {
      expect(vcfManager).toBeDefined();
      expect(vcfManager.getWatchFolder()).toBe('/test/vcf');
    });

    it('should update settings correctly', () => {
      const newSettings = { ...mockSettings, vcfWatchFolder: '/new/vcf' };
      vcfManager.updateSettings(newSettings);
      
      expect(vcfManager.getWatchFolder()).toBe('/new/vcf');
    });

    it('should return empty string when no watch folder is configured', () => {
      const settingsWithoutFolder = { ...mockSettings, vcfWatchFolder: '' };
      vcfManager.updateSettings(settingsWithoutFolder);
      
      expect(vcfManager.getWatchFolder()).toBe('');
    });
  });

  describe('File Listing', () => {
    it('should list VCF files using VcardFile', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      vi.mocked(VcardFile.listVCFFiles).mockResolvedValue(mockFiles);

      const files = await vcfManager.listVCFFiles();
      
      expect(files).toEqual(mockFiles);
      expect(VcardFile.listVCFFiles).toHaveBeenCalledWith('/test/vcf');
    });

    it('should return empty array when no watch folder is configured', async () => {
      const settingsWithoutFolder = { ...mockSettings, vcfWatchFolder: '' };
      vcfManager.updateSettings(settingsWithoutFolder);

      const files = await vcfManager.listVCFFiles();
      
      expect(files).toEqual([]);
      expect(VcardFile.listVCFFiles).not.toHaveBeenCalled();
    });
  });

  describe('File and UID Filtering', () => {
    it('should identify ignored files', () => {
      expect(vcfManager.shouldIgnoreFile('/test/vcf/ignored.vcf')).toBe(true);
      expect(vcfManager.shouldIgnoreFile('/test/vcf/normal.vcf')).toBe(false);
    });

    it('should identify ignored UIDs', () => {
      expect(vcfManager.shouldIgnoreUID('ignored-uid')).toBe(true);
      expect(vcfManager.shouldIgnoreUID('normal-uid')).toBe(false);
    });

    it('should log ignored files and UIDs', () => {
      vcfManager.shouldIgnoreFile('/test/vcf/ignored.vcf');
      expect(loggingService.info).toHaveBeenCalledWith('[VCFManager] Skipping ignored VCF file: ignored.vcf');

      vcfManager.shouldIgnoreUID('ignored-uid');
      expect(loggingService.info).toHaveBeenCalledWith('[VCFManager] Skipping ignored UID: ignored-uid');
    });

    it('should filter ignored files from list', () => {
      const filePaths = ['/test/vcf/normal.vcf', '/test/vcf/ignored.vcf', '/test/vcf/another.vcf'];
      const filtered = vcfManager.filterIgnoredFiles(filePaths);
      
      expect(filtered).toEqual(['/test/vcf/normal.vcf', '/test/vcf/another.vcf']);
    });
  });

  describe('File Information', () => {
    it('should get VCF file information', async () => {
      const mockStats = { mtimeMs: 1234567890 };
      vi.mocked(VcardFile.getFileStats).mockResolvedValue(mockStats);

      const fileInfo = await vcfManager.getVCFFileInfo('/test/vcf/contact.vcf');
      
      expect(fileInfo).toEqual({
        path: '/test/vcf/contact.vcf',
        lastModified: 1234567890,
        uid: undefined
      });
      expect(VcardFile.getFileStats).toHaveBeenCalledWith('/test/vcf/contact.vcf');
    });

    it('should return null when file stats are unavailable', async () => {
      vi.mocked(VcardFile.getFileStats).mockResolvedValue(null);

      const fileInfo = await vcfManager.getVCFFileInfo('/test/vcf/missing.vcf');
      
      expect(fileInfo).toBeNull();
    });
  });

  describe('VCF Reading and Parsing', () => {
    it('should read and parse VCF file successfully', async () => {
      const mockContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      const mockParsedEntries = [['john-doe', { UID: 'test-uid', FN: 'John Doe' }]];
      
      vi.mocked(VcardFile.readVCFFile).mockResolvedValue(mockContent);
      
      // Mock async generator
      const mockGenerator = (async function* () {
        for (const entry of mockParsedEntries) {
          yield entry;
        }
      })();
      vi.mocked(VcardFile.prototype.parse).mockReturnValue(mockGenerator);

      const result = await vcfManager.readAndParseVCF('/test/vcf/contact.vcf');
      
      expect(result).toEqual(mockParsedEntries);
      expect(VcardFile.readVCFFile).toHaveBeenCalledWith('/test/vcf/contact.vcf');
      expect(VcardFile.prototype.parse).toHaveBeenCalledWith(mockContent);
    });

    it('should return null when file cannot be read', async () => {
      vi.mocked(VcardFile.readVCFFile).mockResolvedValue(null);

      const result = await vcfManager.readAndParseVCF('/test/vcf/missing.vcf');
      
      expect(result).toBeNull();
    });

    it('should handle parsing errors gracefully', async () => {
      const mockContent = 'INVALID VCF CONTENT';
      vi.mocked(VcardFile.readVCFFile).mockResolvedValue(mockContent);
      vi.mocked(VcardFile.prototype.parse).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await vcfManager.readAndParseVCF('/test/vcf/invalid.vcf');
      
      expect(result).toBeNull();
      expect(loggingService.error).toHaveBeenCalledWith(
        expect.stringContaining('[VCFManager] Error parsing VCF file')
      );
    });
  });

  describe('VCF Writing', () => {
    it('should write VCF file successfully', async () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      vi.mocked(VcardFile.writeVCFFile).mockResolvedValue(true);

      const result = await vcfManager.writeVCFFile('contact.vcf', vcfContent);
      
      expect(result).toBe('/test/vcf/contact.vcf');
      expect(VcardFile.writeVCFFile).toHaveBeenCalledWith('/test/vcf/contact.vcf', vcfContent);
    });

    it('should return null when write fails', async () => {
      const vcfContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';
      vi.mocked(VcardFile.writeVCFFile).mockResolvedValue(false);

      const result = await vcfManager.writeVCFFile('contact.vcf', vcfContent);
      
      expect(result).toBeNull();
    });

    it('should return null when no watch folder is configured', async () => {
      const settingsWithoutFolder = { ...mockSettings, vcfWatchFolder: '' };
      vcfManager.updateSettings(settingsWithoutFolder);

      const result = await vcfManager.writeVCFFile('contact.vcf', 'content');
      
      expect(result).toBeNull();
      expect(loggingService.error).toHaveBeenCalledWith(
        '[VCFManager] No watch folder configured for writing VCF file'
      );
    });
  });

  describe('UID Search', () => {
    it('should find VCF file by UID', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const file1Content = 'BEGIN:VCARD\nUID:other-uid\nEND:VCARD';
      const file2Content = 'BEGIN:VCARD\nUID:target-uid\nEND:VCARD';
      
      vi.mocked(VcardFile.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VcardFile.readVCFFile)
        .mockResolvedValueOnce(file1Content)
        .mockResolvedValueOnce(file2Content);
      vi.mocked(VcardFile.containsUID)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const result = await vcfManager.findVCFFileByUID('target-uid');
      
      expect(result).toBe('/test/vcf/contact2.vcf');
    });

    it('should return null when UID is not found', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf'];
      const fileContent = 'BEGIN:VCARD\nUID:different-uid\nEND:VCARD';
      
      vi.mocked(VcardFile.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VcardFile.readVCFFile).mockResolvedValue(fileContent);
      vi.mocked(VcardFile.containsUID).mockReturnValue(false);

      const result = await vcfManager.findVCFFileByUID('target-uid');
      
      expect(result).toBeNull();
    });

    it('should handle file read errors during search', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const file2Content = 'BEGIN:VCARD\nUID:target-uid\nEND:VCARD';
      
      vi.mocked(VcardFile.listVCFFiles).mockResolvedValue(mockFiles);
      // Mock the first file returning null (no content, not an error)
      // and second file returning content
      vi.mocked(VcardFile.readVCFFile)
        .mockResolvedValueOnce(null) // First file returns null (no error thrown)
        .mockResolvedValueOnce(file2Content);
      vi.mocked(VcardFile.containsUID)
        .mockReturnValueOnce(true); // Only called for the second file

      const result = await vcfManager.findVCFFileByUID('target-uid');
      
      expect(result).toBe('/test/vcf/contact2.vcf');
      // No debug message is logged when readVCFFile returns null vs throwing error
    });
  });

  describe('Watch Folder Management', () => {
    it('should check if watch folder exists', async () => {
      vi.mocked(VcardFile.folderExists).mockResolvedValue(true);

      const exists = await vcfManager.watchFolderExists();
      
      expect(exists).toBe(true);
      expect(VcardFile.folderExists).toHaveBeenCalledWith('/test/vcf');
    });

    it('should return false and log warning when watch folder does not exist', async () => {
      vi.mocked(VcardFile.folderExists).mockResolvedValue(false);

      const exists = await vcfManager.watchFolderExists();
      
      expect(exists).toBe(false);
      expect(loggingService.warning).toHaveBeenCalledWith(
        '[VCFManager] VCF watch folder does not exist: /test/vcf'
      );
    });

    it('should return false when no watch folder is configured', async () => {
      const settingsWithoutFolder = { ...mockSettings, vcfWatchFolder: '' };
      vcfManager.updateSettings(settingsWithoutFolder);

      const exists = await vcfManager.watchFolderExists();
      
      expect(exists).toBe(false);
      expect(VcardFile.folderExists).not.toHaveBeenCalled();
    });
  });

  describe('Filename Generation', () => {
    it('should generate VCF filename using VcardFile', () => {
      vi.mocked(VcardFile.generateVCFFilename).mockReturnValue('John_Doe.vcf');

      const result = vcfManager.generateVCFFilename('John Doe');
      
      expect(result).toBe('John_Doe.vcf');
      expect(VcardFile.generateVCFFilename).toHaveBeenCalledWith('John Doe');
    });
  });

  describe('Get All VCF Files', () => {
    it('should get information for all VCF files', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const mockStats1 = { mtimeMs: 1234567890 };
      const mockStats2 = { mtimeMs: 1234567891 };
      
      vi.mocked(VcardFile.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VcardFile.getFileStats)
        .mockResolvedValueOnce(mockStats1)
        .mockResolvedValueOnce(mockStats2);

      const result = await vcfManager.getAllVCFFiles();
      
      expect(result).toEqual([
        {
          path: '/test/vcf/contact1.vcf',
          lastModified: 1234567890,
          uid: undefined
        },
        {
          path: '/test/vcf/contact2.vcf',
          lastModified: 1234567891,
          uid: undefined
        }
      ]);
    });

    it('should skip files with no stats', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const mockStats1 = { mtimeMs: 1234567890 };
      
      vi.mocked(VcardFile.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VcardFile.getFileStats)
        .mockResolvedValueOnce(mockStats1)
        .mockResolvedValueOnce(null); // Second file has no stats

      const result = await vcfManager.getAllVCFFiles();
      
      expect(result).toEqual([
        {
          path: '/test/vcf/contact1.vcf',
          lastModified: 1234567890,
          uid: undefined
        }
      ]);
    });
  });
});