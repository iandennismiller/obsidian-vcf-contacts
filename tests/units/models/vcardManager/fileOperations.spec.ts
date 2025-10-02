import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCardManagerFileOperations } from '../../../../src/models/vcardManager/fileOperations';
import { VCardFileOperations } from '../../../../src/models/vcardFile/fileOperations';

// Mock the VCardFileOperations module
vi.mock('../../../../src/models/vcardFile/fileOperations', () => ({
  VCardFileOperations: {
    writeVCFFile: vi.fn(),
    folderExists: vi.fn(),
    generateVCFFilename: vi.fn()
  }
}));

describe('VCardManagerFileOperations', () => {
  let fileOps: VCardManagerFileOperations;
  let mockGetWatchFolder: ReturnType<typeof vi.fn>;
  let mockShouldIgnoreFile: ReturnType<typeof vi.fn>;
  let mockShouldIgnoreUID: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetWatchFolder = vi.fn().mockReturnValue('/test/vcf/folder');
    mockShouldIgnoreFile = vi.fn().mockReturnValue(false);
    mockShouldIgnoreUID = vi.fn().mockReturnValue(false);

    fileOps = new VCardManagerFileOperations(
      mockGetWatchFolder,
      mockShouldIgnoreFile,
      mockShouldIgnoreUID
    );

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(fileOps).toBeDefined();
    });

    it('should accept callback functions for folder and filtering', () => {
      const getFolder = () => '/custom/folder';
      const ignoreFile = (path: string) => path.includes('ignore');
      const ignoreUID = (uid: string) => uid.startsWith('skip');

      const customFileOps = new VCardManagerFileOperations(getFolder, ignoreFile, ignoreUID);
      expect(customFileOps).toBeDefined();
    });
  });

  describe('writeVCardFile', () => {
    it('should write VCard content to a file in watch folder', async () => {
      const filename = 'john-doe.vcf';
      const content = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-123\nFN:John Doe\nEND:VCARD';

      vi.mocked(VCardFileOperations.writeVCFFile).mockResolvedValue(true);

      const result = await fileOps.writeVCardFile(filename, content);

      expect(VCardFileOperations.writeVCFFile).toHaveBeenCalledWith(
        '/test/vcf/folder/john-doe.vcf',
        content
      );
      expect(result).toBe('/test/vcf/folder/john-doe.vcf');
    });

    it('should return null when write fails', async () => {
      const filename = 'failed.vcf';
      const content = 'BEGIN:VCARD\nVERSION:4.0\nEND:VCARD';

      vi.mocked(VCardFileOperations.writeVCFFile).mockResolvedValue(false);

      const result = await fileOps.writeVCardFile(filename, content);

      expect(result).toBeNull();
    });

    it('should return null when no watch folder is configured', async () => {
      mockGetWatchFolder.mockReturnValue('');

      const result = await fileOps.writeVCardFile('test.vcf', 'content');

      expect(result).toBeNull();
      expect(VCardFileOperations.writeVCFFile).not.toHaveBeenCalled();
    });

    it('should return null when watch folder is null', async () => {
      mockGetWatchFolder.mockReturnValue(null);

      const result = await fileOps.writeVCardFile('test.vcf', 'content');

      expect(result).toBeNull();
      expect(VCardFileOperations.writeVCFFile).not.toHaveBeenCalled();
    });

    it('should handle different filenames correctly', async () => {
      const testCases = [
        'simple.vcf',
        'with-spaces.vcf',
        'contact-123-456.vcf',
        'UPPERCASE.vcf'
      ];

      vi.mocked(VCardFileOperations.writeVCFFile).mockResolvedValue(true);

      for (const filename of testCases) {
        const result = await fileOps.writeVCardFile(filename, 'content');
        expect(result).toBe(`/test/vcf/folder/${filename}`);
      }
    });
  });

  describe('watchFolderExists', () => {
    it('should check if watch folder exists', async () => {
      vi.mocked(VCardFileOperations.folderExists).mockResolvedValue(true);

      const exists = await fileOps.watchFolderExists();

      expect(VCardFileOperations.folderExists).toHaveBeenCalledWith('/test/vcf/folder');
      expect(exists).toBe(true);
    });

    it('should return false when folder does not exist', async () => {
      vi.mocked(VCardFileOperations.folderExists).mockResolvedValue(false);

      const exists = await fileOps.watchFolderExists();

      expect(exists).toBe(false);
    });

    it('should return false when no watch folder is configured', async () => {
      mockGetWatchFolder.mockReturnValue('');

      const exists = await fileOps.watchFolderExists();

      expect(exists).toBe(false);
      expect(VCardFileOperations.folderExists).not.toHaveBeenCalled();
    });

    it('should return false when watch folder is null', async () => {
      mockGetWatchFolder.mockReturnValue(null);

      const exists = await fileOps.watchFolderExists();

      expect(exists).toBe(false);
      expect(VCardFileOperations.folderExists).not.toHaveBeenCalled();
    });

    it('should log when folder does not exist', async () => {
      const consoleSpy = vi.spyOn(console, 'debug');
      vi.mocked(VCardFileOperations.folderExists).mockResolvedValue(false);

      await fileOps.watchFolderExists();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('VCF watch folder does not exist')
      );
    });
  });

  describe('generateVCardFilename', () => {
    it('should generate a VCard filename for a contact', () => {
      const contactName = 'John Doe';
      const expectedFilename = 'john-doe.vcf';

      vi.mocked(VCardFileOperations.generateVCFFilename).mockReturnValue(expectedFilename);

      const filename = fileOps.generateVCardFilename(contactName);

      expect(VCardFileOperations.generateVCFFilename).toHaveBeenCalledWith(contactName);
      expect(filename).toBe(expectedFilename);
    });

    it('should handle various contact names', () => {
      const testCases = [
        { input: 'Jane Smith', output: 'jane-smith.vcf' },
        { input: 'Bob Jones Jr.', output: 'bob-jones-jr.vcf' },
        { input: 'María García', output: 'maria-garcia.vcf' },
        { input: 'Test Contact 123', output: 'test-contact-123.vcf' }
      ];

      for (const testCase of testCases) {
        vi.mocked(VCardFileOperations.generateVCFFilename).mockReturnValue(testCase.output);

        const filename = fileOps.generateVCardFilename(testCase.input);

        expect(filename).toBe(testCase.output);
      }
    });

    it('should handle empty contact name', () => {
      const emptyName = '';
      const fallbackFilename = 'contact.vcf';

      vi.mocked(VCardFileOperations.generateVCFFilename).mockReturnValue(fallbackFilename);

      const filename = fileOps.generateVCardFilename(emptyName);

      expect(filename).toBe(fallbackFilename);
    });

    it('should delegate to VCardFileOperations', () => {
      const contactName = 'Test User';

      fileOps.generateVCardFilename(contactName);

      expect(VCardFileOperations.generateVCFFilename).toHaveBeenCalledWith(contactName);
    });
  });

  describe('integration with callbacks', () => {
    it('should use custom watch folder from callback', async () => {
      const customFolder = '/custom/path/to/vcf';
      mockGetWatchFolder.mockReturnValue(customFolder);

      vi.mocked(VCardFileOperations.writeVCFFile).mockResolvedValue(true);

      const result = await fileOps.writeVCardFile('test.vcf', 'content');

      expect(result).toBe(`${customFolder}/test.vcf`);
    });

    it('should work with dynamically changing watch folder', async () => {
      let currentFolder = '/folder1';
      const dynamicGetFolder = () => currentFolder;

      const dynamicFileOps = new VCardManagerFileOperations(
        dynamicGetFolder,
        mockShouldIgnoreFile,
        mockShouldIgnoreUID
      );

      vi.mocked(VCardFileOperations.writeVCFFile).mockResolvedValue(true);

      // First write
      await dynamicFileOps.writeVCardFile('test.vcf', 'content');
      expect(VCardFileOperations.writeVCFFile).toHaveBeenCalledWith(
        '/folder1/test.vcf',
        'content'
      );

      // Change folder
      currentFolder = '/folder2';

      // Second write
      await dynamicFileOps.writeVCardFile('test.vcf', 'content');
      expect(VCardFileOperations.writeVCFFile).toHaveBeenCalledWith(
        '/folder2/test.vcf',
        'content'
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors from VCardFileOperations.writeVCFFile', async () => {
      vi.mocked(VCardFileOperations.writeVCFFile).mockRejectedValue(
        new Error('File system error')
      );

      await expect(fileOps.writeVCardFile('test.vcf', 'content')).rejects.toThrow(
        'File system error'
      );
    });

    it('should handle errors from VCardFileOperations.folderExists', async () => {
      vi.mocked(VCardFileOperations.folderExists).mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(fileOps.watchFolderExists()).rejects.toThrow('Permission denied');
    });
  });
});
