import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VcardManager } from '../../../../src/models/vcardManager/vcardManager';
import { ContactsPluginSettings } from 'src/plugin/settings';

// Mock the sub-components
vi.mock('../../../../src/models/vcardManager/vcardCollection', () => ({
  VCardCollection: vi.fn().mockImplementation(() => ({
    listVCardFiles: vi.fn(),
    getVCardFileInfo: vi.fn(),
    getAllVCardFiles: vi.fn(),
    findVCardFileByUID: vi.fn(),
    readAndParseVCard: vi.fn(),
    filterIgnoredFiles: vi.fn()
  }))
}));

vi.mock('../../../../src/models/vcardManager/fileOperations', () => ({
  VCardManagerFileOperations: vi.fn().mockImplementation(() => ({
    writeVCardFile: vi.fn(),
    watchFolderExists: vi.fn(),
    generateVCardFilename: vi.fn()
  }))
}));

vi.mock('../../../../src/models/vcardManager/writeQueue', () => ({
  VCardWriteQueue: vi.fn().mockImplementation(() => ({
    queueVcardWrite: vi.fn(),
    getStatus: vi.fn(),
    clear: vi.fn()
  }))
}));

describe('VcardManager', () => {
  let mockSettings: ContactsPluginSettings;
  let vcardManager: VcardManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: true,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };

    vcardManager = new VcardManager(mockSettings);
  });

  describe('constructor', () => {
    it('should initialize with settings', () => {
      expect(vcardManager).toBeDefined();
      expect(vcardManager.getWatchFolder()).toBe('/test/vcf');
    });

    it('should initialize sub-components', () => {
      // Verify that all sub-components are created
      expect(vcardManager).toHaveProperty('collection');
      expect(vcardManager).toHaveProperty('fileOps');
      expect(vcardManager).toHaveProperty('writeQueue');
    });
  });

  describe('updateSettings', () => {
    it('should update settings reference', () => {
      const newSettings = {
        ...mockSettings,
        vcfWatchFolder: '/new/path'
      };

      vcardManager.updateSettings(newSettings);
      
      expect(vcardManager.getWatchFolder()).toBe('/new/path');
    });
  });

  describe('getWatchFolder', () => {
    it('should return watch folder from settings', () => {
      expect(vcardManager.getWatchFolder()).toBe('/test/vcf');
    });

    it('should return empty string when no watch folder set', () => {
      const emptySettings = { ...mockSettings, vcfWatchFolder: '' };
      vcardManager.updateSettings(emptySettings);
      
      expect(vcardManager.getWatchFolder()).toBe('');
    });
  });

  describe('shouldIgnoreFile', () => {
    it('should return false for files not in ignore list', () => {
      expect(vcardManager.shouldIgnoreFile('/test/vcf/contact.vcf')).toBe(false);
    });

    it('should return true for files in ignore list', () => {
      const settingsWithIgnore = {
        ...mockSettings,
        vcfCustomizeIgnoreList: true,
        vcfIgnoreFilenames: ['ignored.vcf']
      };
      vcardManager.updateSettings(settingsWithIgnore);
      
      expect(vcardManager.shouldIgnoreFile('/test/vcf/ignored.vcf')).toBe(true);
    });

    it('should handle path normalization', () => {
      const settingsWithIgnore = {
        ...mockSettings,
        vcfCustomizeIgnoreList: true,
        vcfIgnoreFilenames: ['contact.vcf']
      };
      vcardManager.updateSettings(settingsWithIgnore);
      
      expect(vcardManager.shouldIgnoreFile('/different/path/contact.vcf')).toBe(true);
    });
  });

  describe('shouldIgnoreUID', () => {
    it('should return false for UIDs not in ignore list', () => {
      expect(vcardManager.shouldIgnoreUID('normal-uid-123')).toBe(false);
    });

    it('should return true for UIDs in ignore list', () => {
      const settingsWithIgnore = {
        ...mockSettings,
        vcfCustomizeIgnoreList: true,
        vcfIgnoreUIDs: ['ignored-uid-123']
      };
      vcardManager.updateSettings(settingsWithIgnore);
      
      expect(vcardManager.shouldIgnoreUID('ignored-uid-123')).toBe(true);
    });
  });

  describe('delegation to collection', () => {
    it('should delegate listVCardFiles to collection', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      (vcardManager as any).collection.listVCardFiles.mockResolvedValue(mockFiles);

      const result = await vcardManager.listVCardFiles();

      expect(result).toEqual(mockFiles);
      expect((vcardManager as any).collection.listVCardFiles).toHaveBeenCalled();
    });

    it('should delegate getVCardFileInfo to collection', async () => {
      const mockFileInfo = { path: '/test/file.vcf', size: 1024, mtime: new Date() };
      (vcardManager as any).collection.getVCardFileInfo.mockResolvedValue(mockFileInfo);

      const result = await vcardManager.getVCardFileInfo('/test/file.vcf');

      expect(result).toEqual(mockFileInfo);
      expect((vcardManager as any).collection.getVCardFileInfo).toHaveBeenCalledWith('/test/file.vcf');
    });

    it('should delegate findVCardFileByUID to collection', async () => {
      const expectedPath = '/test/vcf/contact.vcf';
      (vcardManager as any).collection.findVCardFileByUID.mockResolvedValue(expectedPath);

      const result = await vcardManager.findVCardFileByUID('test-uid-123');

      expect(result).toBe(expectedPath);
      expect((vcardManager as any).collection.findVCardFileByUID).toHaveBeenCalledWith('test-uid-123');
    });
  });

  describe('delegation to file operations', () => {
    it('should delegate writeVCardFile to fileOps', async () => {
      const expectedPath = '/test/vcf/contact.vcf';
      (vcardManager as any).fileOps.writeVCardFile.mockResolvedValue(expectedPath);

      const result = await vcardManager.writeVCardFile('contact.vcf', 'VCard content');

      expect(result).toBe(expectedPath);
      expect((vcardManager as any).fileOps.writeVCardFile).toHaveBeenCalledWith('contact.vcf', 'VCard content');
    });

    it('should delegate watchFolderExists to fileOps', async () => {
      (vcardManager as any).fileOps.watchFolderExists.mockResolvedValue(true);

      const result = await vcardManager.watchFolderExists();

      expect(result).toBe(true);
      expect((vcardManager as any).fileOps.watchFolderExists).toHaveBeenCalled();
    });

    it('should delegate generateVCardFilename to fileOps', () => {
      const expectedFilename = 'john-doe.vcf';
      (vcardManager as any).fileOps.generateVCardFilename.mockReturnValue(expectedFilename);

      const result = vcardManager.generateVCardFilename('John Doe');

      expect(result).toBe(expectedFilename);
      expect((vcardManager as any).fileOps.generateVCardFilename).toHaveBeenCalledWith('John Doe');
    });
  });

  describe('delegation to write queue', () => {
    it('should delegate queueVcardWrite to writeQueue', async () => {
      (vcardManager as any).writeQueue.queueVcardWrite.mockResolvedValue(undefined);

      await vcardManager.queueVcardWrite('test-uid', 'VCard data');

      expect((vcardManager as any).writeQueue.queueVcardWrite).toHaveBeenCalledWith('test-uid', 'VCard data');
    });

    it('should delegate getWriteQueueStatus to writeQueue', () => {
      const mockStatus = { size: 5, processing: true };
      (vcardManager as any).writeQueue.getStatus.mockReturnValue(mockStatus);

      const result = vcardManager.getWriteQueueStatus();

      expect(result).toEqual(mockStatus);
      expect((vcardManager as any).writeQueue.getStatus).toHaveBeenCalled();
    });

    it('should delegate clearWriteQueue to writeQueue', () => {
      vcardManager.clearWriteQueue();

      expect((vcardManager as any).writeQueue.clear).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors in collection operations gracefully', async () => {
      (vcardManager as any).collection.listVCardFiles.mockRejectedValue(new Error('Collection error'));

      await expect(vcardManager.listVCardFiles()).rejects.toThrow('Collection error');
    });

    it('should handle errors in file operations gracefully', async () => {
      (vcardManager as any).fileOps.writeVCardFile.mockRejectedValue(new Error('File operation error'));

      await expect(vcardManager.writeVCardFile('test.vcf', 'content')).rejects.toThrow('File operation error');
    });
  });

  describe('scanVCFFolder', () => {
    it('should return empty array when folder does not exist', async () => {
      (vcardManager as any).fileOps.watchFolderExists.mockResolvedValue(false);

      const result = await vcardManager.scanVCFFolder(new Map());

      expect(result).toEqual([]);
    });

    it('should return empty array when no files in folder', async () => {
      (vcardManager as any).fileOps.watchFolderExists.mockResolvedValue(true);
      (vcardManager as any).collection.listVCardFiles.mockResolvedValue([]);

      const result = await vcardManager.scanVCFFolder(new Map());

      expect(result).toEqual([]);
    });

    it('should return new files that are not in known files', async () => {
      (vcardManager as any).fileOps.watchFolderExists.mockResolvedValue(true);
      (vcardManager as any).collection.listVCardFiles.mockResolvedValue([
        '/test/vcf/new.vcf',
        '/test/vcf/existing.vcf'
      ]);
      (vcardManager as any).collection.getVCardFileInfo
        .mockResolvedValueOnce({ path: '/test/vcf/new.vcf', lastModified: 2000 })
        .mockResolvedValueOnce({ path: '/test/vcf/existing.vcf', lastModified: 1000 });

      const knownFiles = new Map([
        ['/test/vcf/existing.vcf', { path: '/test/vcf/existing.vcf', lastModified: 1000 }]
      ]);

      const result = await vcardManager.scanVCFFolder(knownFiles);

      expect(result).toContain('/test/vcf/new.vcf');
      expect(result).not.toContain('/test/vcf/existing.vcf');
    });

    it('should return modified files', async () => {
      (vcardManager as any).fileOps.watchFolderExists.mockResolvedValue(true);
      (vcardManager as any).collection.listVCardFiles.mockResolvedValue(['/test/vcf/modified.vcf']);
      (vcardManager as any).collection.getVCardFileInfo.mockResolvedValue({
        path: '/test/vcf/modified.vcf',
        lastModified: 2000
      });

      const knownFiles = new Map([
        ['/test/vcf/modified.vcf', { path: '/test/vcf/modified.vcf', lastModified: 1000 }]
      ]);

      const result = await vcardManager.scanVCFFolder(knownFiles);

      expect(result).toContain('/test/vcf/modified.vcf');
    });

    it('should filter ignored files', async () => {
      const settingsWithIgnore = {
        ...mockSettings,
        vcfIgnoreFilenames: ['ignored.vcf']
      };
      vcardManager.updateSettings(settingsWithIgnore);

      (vcardManager as any).fileOps.watchFolderExists.mockResolvedValue(true);
      (vcardManager as any).collection.listVCardFiles.mockResolvedValue([
        '/test/vcf/normal.vcf',
        '/test/vcf/ignored.vcf'
      ]);
      (vcardManager as any).collection.getVCardFileInfo.mockResolvedValue({
        path: '/test/vcf/normal.vcf',
        lastModified: 1000
      });

      const result = await vcardManager.scanVCFFolder(new Map());

      expect(result).toContain('/test/vcf/normal.vcf');
      expect(result).not.toContain('/test/vcf/ignored.vcf');
    });

    it('should skip files that return null file info', async () => {
      (vcardManager as any).fileOps.watchFolderExists.mockResolvedValue(true);
      (vcardManager as any).collection.listVCardFiles.mockResolvedValue([
        '/test/vcf/valid.vcf',
        '/test/vcf/invalid.vcf'
      ]);
      (vcardManager as any).collection.getVCardFileInfo
        .mockResolvedValueOnce({ path: '/test/vcf/valid.vcf', lastModified: 1000 })
        .mockResolvedValueOnce(null);

      const result = await vcardManager.scanVCFFolder(new Map());

      expect(result).toContain('/test/vcf/valid.vcf');
      expect(result).not.toContain('/test/vcf/invalid.vcf');
    });

    it('should handle errors gracefully', async () => {
      (vcardManager as any).fileOps.watchFolderExists.mockRejectedValue(new Error('Scan error'));

      const result = await vcardManager.scanVCFFolder(new Map());

      expect(result).toEqual([]);
    });
  });
});