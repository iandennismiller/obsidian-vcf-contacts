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

// Mock VcardFile
vi.mock('../../../../src/models/vcardFile', () => ({
  VcardFile: vi.fn().mockImplementation(() => ({
    parse: vi.fn()
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

  describe('processVCFContents', () => {
    it('should return empty array when parsing fails', async () => {
      (vcardManager as any).collection.readAndParseVCard.mockResolvedValue(null);

      const result = await vcardManager.processVCFContents('/test/file.vcf');

      expect(result).toEqual([]);
    });

    it('should filter out entries without slug or UID', async () => {
      (vcardManager as any).collection.readAndParseVCard.mockResolvedValue([
        ['valid-slug', { UID: 'uid-123', FN: 'John Doe' }],
        [null, { UID: 'uid-456', FN: 'Jane Doe' }],
        ['slug', { FN: 'No UID' }]
      ]);

      const result = await vcardManager.processVCFContents('/test/file.vcf');

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe('valid-slug');
      expect(result[0][1].UID).toBe('uid-123');
    });

    it('should filter out ignored UIDs', async () => {
      const settingsWithIgnore = {
        ...mockSettings,
        vcfIgnoreUIDs: ['ignored-uid']
      };
      vcardManager.updateSettings(settingsWithIgnore);

      (vcardManager as any).collection.readAndParseVCard.mockResolvedValue([
        ['valid-slug', { UID: 'valid-uid', FN: 'John Doe' }],
        ['ignored-slug', { UID: 'ignored-uid', FN: 'Ignored' }]
      ]);

      const result = await vcardManager.processVCFContents('/test/file.vcf');

      expect(result).toHaveLength(1);
      expect(result[0][1].UID).toBe('valid-uid');
    });

    it('should handle errors gracefully', async () => {
      (vcardManager as any).collection.readAndParseVCard.mockRejectedValue(new Error('Parse error'));

      const result = await vcardManager.processVCFContents('/test/file.vcf');

      expect(result).toEqual([]);
    });
  });

  describe('isMonitoringEnabled', () => {
    it('should return true when monitoring is enabled', () => {
      expect(vcardManager.isMonitoringEnabled()).toBe(true);
    });

    it('should return false when monitoring is disabled', () => {
      const disabledSettings = { ...mockSettings, vcfWatchEnabled: false };
      vcardManager.updateSettings(disabledSettings);

      expect(vcardManager.isMonitoringEnabled()).toBe(false);
    });
  });

  describe('getPollingInterval', () => {
    it('should return polling interval in milliseconds', () => {
      const result = vcardManager.getPollingInterval();

      expect(result).toBe(30000); // 30 seconds * 1000
    });

    it('should return default 5000ms when not set', () => {
      const settingsWithoutInterval = { ...mockSettings, vcfWatchPollingInterval: 0 };
      vcardManager.updateSettings(settingsWithoutInterval);

      const result = vcardManager.getPollingInterval();

      expect(result).toBe(5000);
    });
  });

  describe('validateVcfContent', () => {
    it('should validate valid VCF content', async () => {
      const validContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nEND:VCARD';

      const result = await vcardManager.validateVcfContent(validContent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing BEGIN:VCARD', async () => {
      const invalidContent = 'VERSION:3.0\nFN:John Doe\nEND:VCARD';

      const result = await vcardManager.validateVcfContent(invalidContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing BEGIN:VCARD');
    });

    it('should detect missing END:VCARD', async () => {
      const invalidContent = 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe';

      const result = await vcardManager.validateVcfContent(invalidContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing END:VCARD');
    });

    it('should detect missing VERSION field', async () => {
      const invalidContent = 'BEGIN:VCARD\nFN:John Doe\nEND:VCARD';

      const result = await vcardManager.validateVcfContent(invalidContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing VERSION field');
    });
  });

  describe('handleFileSystemError', () => {
    it('should handle ENOENT errors', async () => {
      const result = await vcardManager.handleFileSystemError('ENOENT: file not found', '/test/file.vcf');

      expect(result.success).toBe(false);
      expect(result.recovered).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should handle permission errors', async () => {
      const result = await vcardManager.handleFileSystemError('EACCES: permission denied', '/test/file.vcf');

      expect(result.success).toBe(false);
      expect(result.recovered).toBe(false);
      expect(result.error).toContain('EACCES');
    });

    it('should handle too many files errors', async () => {
      const result = await vcardManager.handleFileSystemError('EMFILE: too many open files', '/test/file.vcf');

      expect(result.success).toBe(false);
      expect(result.recovered).toBe(false);
      expect(result.error).toContain('EMFILE');
    });

    it('should handle unknown errors', async () => {
      const result = await vcardManager.handleFileSystemError('Unknown error', '/test/file.vcf');

      expect(result.success).toBe(false);
      expect(result.recovered).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('processDeletedFile', () => {
    it('should return delete action with UID', async () => {
      const result = await vcardManager.processDeletedFile('/test/file.vcf', 'test-uid');

      expect(result.processed).toBe(true);
      expect(result.action).toBe('delete');
      expect(result.contactUID).toBe('test-uid');
    });

    it('should return delete action without UID', async () => {
      const result = await vcardManager.processDeletedFile('/test/file.vcf');

      expect(result.processed).toBe(true);
      expect(result.action).toBe('delete');
      expect(result.contactUID).toBeUndefined();
    });
  });

  describe('readAndParseVCard', () => {
    it('should delegate to collection', async () => {
      const mockParsed = [['slug', { UID: 'uid-123', FN: 'John Doe' }]];
      (vcardManager as any).collection.readAndParseVCard.mockResolvedValue(mockParsed);

      const result = await vcardManager.readAndParseVCard('/test/file.vcf');

      expect(result).toEqual(mockParsed);
      expect((vcardManager as any).collection.readAndParseVCard).toHaveBeenCalledWith('/test/file.vcf');
    });
  });

  describe('getAllVCardFiles', () => {
    it('should delegate to collection', async () => {
      const mockFiles = [
        { path: '/test/file1.vcf', lastModified: 1000 },
        { path: '/test/file2.vcf', lastModified: 2000 }
      ];
      (vcardManager as any).collection.getAllVCardFiles.mockResolvedValue(mockFiles);

      const result = await vcardManager.getAllVCardFiles();

      expect(result).toEqual(mockFiles);
      expect((vcardManager as any).collection.getAllVCardFiles).toHaveBeenCalled();
    });
  });

  describe('filterIgnoredFiles', () => {
    it('should delegate to collection', () => {
      const inputFiles = ['/test/file1.vcf', '/test/file2.vcf'];
      const filteredFiles = ['/test/file1.vcf'];
      (vcardManager as any).collection.filterIgnoredFiles.mockReturnValue(filteredFiles);

      const result = vcardManager.filterIgnoredFiles(inputFiles);

      expect(result).toEqual(filteredFiles);
      expect((vcardManager as any).collection.filterIgnoredFiles).toHaveBeenCalledWith(inputFiles);
    });
  });

  describe('processNewFile', () => {
    it('should return ignore action for ignored files', async () => {
      const settingsWithIgnore = {
        ...mockSettings,
        vcfIgnoreFilenames: ['ignored.vcf']
      };
      vcardManager.updateSettings(settingsWithIgnore);

      const result = await vcardManager.processNewFile('/test/ignored.vcf', 'content');

      expect(result.processed).toBe(false);
      expect(result.action).toBe('ignore');
      expect(result.error).toBe('File ignored by configuration');
    });

    it('should return error for invalid VCF content', async () => {
      const result = await vcardManager.processNewFile('/test/file.vcf', 'invalid content');

      expect(result.processed).toBe(false);
      expect(result.action).toBe('error');
      expect(result.error).toContain('Invalid VCF content');
    });

    it('should return none action when no valid contacts found', async () => {
      const { VcardFile } = await import('../../../../src/models/vcardFile');
      const mockParse = vi.fn().mockImplementation(async function*() {
        yield ['slug', { UID: 'ignored-uid', FN: 'Ignored' }];
      });
      (VcardFile as any).mockImplementation(() => ({
        parse: mockParse
      }));

      const settingsWithIgnore = {
        ...mockSettings,
        vcfIgnoreUIDs: ['ignored-uid']
      };
      vcardManager.updateSettings(settingsWithIgnore);

      const validContent = 'BEGIN:VCARD\nVERSION:3.0\nUID:ignored-uid\nFN:Ignored\nEND:VCARD';
      const result = await vcardManager.processNewFile('/test/file.vcf', validContent);

      expect(result.processed).toBe(false);
      expect(result.action).toBe('none');
      expect(result.error).toBe('No valid contacts found');
    });

    it('should return create action for valid new file', async () => {
      const { VcardFile } = await import('../../../../src/models/vcardFile');
      const mockParse = vi.fn().mockImplementation(async function*() {
        yield ['john-doe', { UID: 'new-uid-123', FN: 'John Doe' }];
      });
      (VcardFile as any).mockImplementation(() => ({
        parse: mockParse
      }));

      const validContent = 'BEGIN:VCARD\nVERSION:3.0\nUID:new-uid-123\nFN:John Doe\nEND:VCARD';
      const result = await vcardManager.processNewFile('/test/file.vcf', validContent);

      expect(result.processed).toBe(true);
      expect(result.action).toBe('create');
      expect(result.contactUID).toBe('new-uid-123');
    });

    it('should handle parsing errors', async () => {
      const { VcardFile } = await import('../../../../src/models/vcardFile');
      const mockParse = vi.fn().mockImplementation(async function*() {
        throw new Error('Parse failure');
      });
      (VcardFile as any).mockImplementation(() => ({
        parse: mockParse
      }));

      const validContent = 'BEGIN:VCARD\nVERSION:3.0\nEND:VCARD';
      const result = await vcardManager.processNewFile('/test/file.vcf', validContent);

      expect(result.processed).toBe(false);
      expect(result.action).toBe('error');
      expect(result.error).toBe('Parse failure');
    });
  });

  describe('processModifiedFile', () => {
    it('should return ignore action for ignored files', async () => {
      const settingsWithIgnore = {
        ...mockSettings,
        vcfIgnoreFilenames: ['ignored.vcf']
      };
      vcardManager.updateSettings(settingsWithIgnore);

      const result = await vcardManager.processModifiedFile('/test/ignored.vcf', 'content');

      expect(result.processed).toBe(false);
      expect(result.action).toBe('ignore');
      expect(result.error).toBe('File ignored by configuration');
    });

    it('should return none action when no valid contacts found', async () => {
      const { VcardFile } = await import('../../../../src/models/vcardFile');
      const mockParse = vi.fn().mockImplementation(async function*() {
        yield ['slug', { UID: 'ignored-uid', FN: 'Ignored' }];
      });
      (VcardFile as any).mockImplementation(() => ({
        parse: mockParse
      }));

      const settingsWithIgnore = {
        ...mockSettings,
        vcfIgnoreUIDs: ['ignored-uid']
      };
      vcardManager.updateSettings(settingsWithIgnore);

      const validContent = 'BEGIN:VCARD\nVERSION:3.0\nUID:ignored-uid\nFN:Ignored\nEND:VCARD';
      const result = await vcardManager.processModifiedFile('/test/file.vcf', validContent);

      expect(result.processed).toBe(false);
      expect(result.action).toBe('none');
      expect(result.error).toBe('No valid contacts found');
    });

    it('should return update action for valid modified file', async () => {
      const { VcardFile } = await import('../../../../src/models/vcardFile');
      const mockParse = vi.fn().mockImplementation(async function*() {
        yield ['john-doe', { UID: 'modified-uid-123', FN: 'John Doe', REV: '2024-01-01T12:00:00Z' }];
      });
      (VcardFile as any).mockImplementation(() => ({
        parse: mockParse
      }));

      const validContent = 'BEGIN:VCARD\nVERSION:3.0\nUID:modified-uid-123\nREV:2024-01-01T12:00:00Z\nFN:John Doe\nEND:VCARD';
      const result = await vcardManager.processModifiedFile('/test/file.vcf', validContent);

      expect(result.processed).toBe(true);
      expect(result.action).toBe('update');
      expect(result.contactUID).toBe('modified-uid-123');
      expect(result.hasNewer).toBe(true);
    });

    it('should handle parsing errors', async () => {
      const { VcardFile } = await import('../../../../src/models/vcardFile');
      const mockParse = vi.fn().mockImplementation(async function*() {
        throw new Error('Parse failure');
      });
      (VcardFile as any).mockImplementation(() => ({
        parse: mockParse
      }));

      const validContent = 'BEGIN:VCARD\nVERSION:3.0\nEND:VCARD';
      const result = await vcardManager.processModifiedFile('/test/file.vcf', validContent);

      expect(result.processed).toBe(false);
      expect(result.action).toBe('error');
      expect(result.error).toBe('Parse failure');
    });
  });
});