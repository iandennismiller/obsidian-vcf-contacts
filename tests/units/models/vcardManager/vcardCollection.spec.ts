import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCardCollection } from '../../../../src/models/vcardManager/vcardCollection';
import { VCardFileOperations } from '../../../../src/models/vcardFile/fileOperations';

// Mock VCardFileOperations
vi.mock('../../../../src/models/vcardFile/fileOperations', () => ({
  VCardFileOperations: {
    listVCFFiles: vi.fn(),
    getFileStats: vi.fn(),
    readVCFFile: vi.fn(),
    containsUID: vi.fn()
  }
}));

describe('VCardCollection', () => {
  let vcardCollection: VCardCollection;
  let mockGetWatchFolder: () => string;
  let mockShouldIgnoreFile: (filePath: string) => boolean;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetWatchFolder = vi.fn(() => '/test/vcf');
    mockShouldIgnoreFile = vi.fn(() => false);

    vcardCollection = new VCardCollection(mockGetWatchFolder, mockShouldIgnoreFile);
  });

  describe('constructor', () => {
    it('should initialize with callbacks', () => {
      expect(vcardCollection).toBeDefined();
    });
  });

  describe('listVCardFiles', () => {
    it('should list VCard files from watch folder', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      
      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue(mockFiles);

      const result = await vcardCollection.listVCardFiles();

      expect(result).toEqual(mockFiles);
      expect(VCardFileOperations.listVCFFiles).toHaveBeenCalledWith('/test/vcf');
    });

    it('should return empty array when no watch folder configured', async () => {
      mockGetWatchFolder = vi.fn(() => '');
      vcardCollection = new VCardCollection(mockGetWatchFolder, mockShouldIgnoreFile);

      const result = await vcardCollection.listVCardFiles();

      expect(result).toEqual([]);
      expect(VCardFileOperations.listVCFFiles).not.toHaveBeenCalled();
    });

    it('should handle VCardFileOperations errors', async () => {
      vi.mocked(VCardFileOperations.listVCFFiles).mockRejectedValue(new Error('File operation error'));

      const result = await vcardCollection.listVCardFiles();

      expect(result).toEqual([]);
    });
  });

  describe('getVCardFileInfo', () => {
    it('should get file stats for VCard file', async () => {
      const mockStats = {
        mtimeMs: 1640995200000
      };
      
      vi.mocked(VCardFileOperations.getFileStats).mockResolvedValue(mockStats);

      const result = await vcardCollection.getVCardFileInfo('/test/vcf/contact.vcf');

      expect(result).toEqual({
        path: '/test/vcf/contact.vcf',
        lastModified: 1640995200000,
        uid: undefined
      });
    });

    it('should return null when file stats unavailable', async () => {
      vi.mocked(VCardFileOperations.getFileStats).mockResolvedValue(null);

      const result = await vcardCollection.getVCardFileInfo('/test/vcf/nonexistent.vcf');

      expect(result).toBeNull();
    });

    it('should handle file stats errors', async () => {
      vi.mocked(VCardFileOperations.getFileStats).mockRejectedValue(new Error('Stats error'));

      const result = await vcardCollection.getVCardFileInfo('/test/vcf/error.vcf');

      expect(result).toBeNull();
    });
  });

  describe('getAllVCardFiles', () => {
    it('should get file info for all VCard files', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const mockStats = {
        mtimeMs: 1640995200000
      };

      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VCardFileOperations.getFileStats).mockResolvedValue(mockStats);

      const result = await vcardCollection.getAllVCardFiles();

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('/test/vcf/contact1.vcf');
      expect(result[1].path).toBe('/test/vcf/contact2.vcf');
    });

    it('should filter out files with no stats', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];

      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VCardFileOperations.getFileStats)
        .mockResolvedValueOnce({
          mtimeMs: 1640995200000
        })
        .mockResolvedValueOnce(null); // Second file has no stats

      const result = await vcardCollection.getAllVCardFiles();

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/test/vcf/contact1.vcf');
    });

    it('should handle empty file list', async () => {
      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue([]);

      const result = await vcardCollection.getAllVCardFiles();

      expect(result).toEqual([]);
    });
  });

  describe('filterIgnoredFiles', () => {
    it('should filter out ignored files', () => {
      const files = [
        '/test/vcf/contact1.vcf',
        '/test/vcf/ignored.vcf',
        '/test/vcf/contact2.vcf'
      ];

      mockShouldIgnoreFile = vi.fn((path) => path.includes('ignored'));
      vcardCollection = new VCardCollection(mockGetWatchFolder, mockShouldIgnoreFile);

      const result = vcardCollection.filterIgnoredFiles(files);

      expect(result).toEqual([
        '/test/vcf/contact1.vcf',
        '/test/vcf/contact2.vcf'
      ]);
    });

    it('should return all files when nothing is ignored', () => {
      const files = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];

      const result = vcardCollection.filterIgnoredFiles(files);

      expect(result).toEqual(files);
    });

    it('should handle empty file list', () => {
      const result = vcardCollection.filterIgnoredFiles([]);

      expect(result).toEqual([]);
    });
  });

  describe('findVCardFileByUID', () => {
    it('should find VCard file containing specific UID', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];
      const mockContent = 'BEGIN:VCARD\nUID:test-uid-123\nFN:Test Contact\nEND:VCARD';

      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VCardFileOperations.readVCFFile)
        .mockResolvedValueOnce('different content')
        .mockResolvedValueOnce(mockContent);
      vi.mocked(VCardFileOperations.containsUID)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const result = await vcardCollection.findVCardFileByUID('test-uid-123');

      expect(result).toBe('/test/vcf/contact2.vcf');
    });

    it('should return null when UID not found', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf'];

      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VCardFileOperations.readVCFFile).mockResolvedValue('content without uid');
      vi.mocked(VCardFileOperations.containsUID).mockReturnValue(false);

      const result = await vcardCollection.findVCardFileByUID('nonexistent-uid');

      expect(result).toBeNull();
    });

    it('should handle file read errors gracefully', async () => {
      const mockFiles = ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'];

      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue(mockFiles);
      vi.mocked(VCardFileOperations.readVCFFile)
        .mockRejectedValueOnce(new Error('Read error'))
        .mockResolvedValueOnce('content with uid');
      vi.mocked(VCardFileOperations.containsUID).mockReturnValue(true);

      const result = await vcardCollection.findVCardFileByUID('test-uid');

      expect(result).toBe('/test/vcf/contact2.vcf'); // Should find in second file
    });

    it('should return null when no files exist', async () => {
      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue([]);

      const result = await vcardCollection.findVCardFileByUID('test-uid');

      expect(result).toBeNull();
    });
  });

  describe('readAndParseVCard', () => {
    it('should read and parse VCard file', async () => {
      const mockContent = 'BEGIN:VCARD\nUID:test-uid\nFN:Test Contact\nEND:VCARD';

      vi.mocked(VCardFileOperations.readVCFFile).mockResolvedValue(mockContent);

      const result = await vcardCollection.readAndParseVCard('/test/vcf/contact.vcf');

      // The actual implementation uses VCardParser.parse which is a generator
      // We expect the result to be an array of [slug, record] pairs
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return null when file cannot be read', async () => {
      vi.mocked(VCardFileOperations.readVCFFile).mockResolvedValue(null);

      const result = await vcardCollection.readAndParseVCard('/test/vcf/nonexistent.vcf');

      expect(result).toBeNull();
    });

    it('should handle parsing errors gracefully', async () => {
      const mockContent = 'invalid vcard content';

      vi.mocked(VCardFileOperations.readVCFFile).mockResolvedValue(mockContent);

      const result = await vcardCollection.readAndParseVCard('/test/vcf/invalid.vcf');

      // When parsing invalid content, it returns an empty array rather than null
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('integration with callbacks', () => {
    it('should use watch folder callback', async () => {
      mockGetWatchFolder = vi.fn(() => '/custom/path');
      vcardCollection = new VCardCollection(mockGetWatchFolder, mockShouldIgnoreFile);

      vi.mocked(VCardFileOperations.listVCFFiles).mockResolvedValue([]);

      await vcardCollection.listVCardFiles();

      expect(mockGetWatchFolder).toHaveBeenCalled();
      expect(VCardFileOperations.listVCFFiles).toHaveBeenCalledWith('/custom/path');
    });

    it('should use ignore file callback', () => {
      const files = ['/test/vcf/normal.vcf', '/test/vcf/special.vcf'];
      
      mockShouldIgnoreFile = vi.fn((path) => path.includes('special'));
      vcardCollection = new VCardCollection(mockGetWatchFolder, mockShouldIgnoreFile);

      const result = vcardCollection.filterIgnoredFiles(files);

      expect(mockShouldIgnoreFile).toHaveBeenCalledTimes(2);
      expect(result).toEqual(['/test/vcf/normal.vcf']);
    });
  });

  describe('error resilience', () => {
    it('should handle callback errors in getWatchFolder', async () => {
      mockGetWatchFolder = vi.fn(() => {
        throw new Error('Callback error');
      });
      vcardCollection = new VCardCollection(mockGetWatchFolder, mockShouldIgnoreFile);

      await expect(vcardCollection.listVCardFiles()).rejects.toThrow('Callback error');
    });

    it('should handle callback errors in shouldIgnoreFile', () => {
      const files = ['/test/vcf/contact.vcf'];
      
      mockShouldIgnoreFile = vi.fn(() => {
        throw new Error('Ignore callback error');
      });
      vcardCollection = new VCardCollection(mockGetWatchFolder, mockShouldIgnoreFile);

      expect(() => vcardCollection.filterIgnoredFiles(files)).toThrow('Ignore callback error');
    });
  });
});