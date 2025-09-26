import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { VcardFile } from 'src/contacts/vcard/vcardFile';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
}));

// Mock other dependencies
vi.mock('src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => ({
    metadataCache: {
      getFileCache: vi.fn(() => ({
        frontmatter: {
          'FN': 'John Doe',
          'EMAIL[HOME]': 'john@example.com',
          'TEL[CELL]': '+1234567890'
        }
      }))
    }
  }))
}));

vi.mock('src/contacts', () => ({
  parseKey: vi.fn((key) => {
    const typeMatch = key.match(/\[([^\]]+)\]/);
    const baseKey = key.replace(/\[.*?\].*/, '');
    return {
      key: baseKey,
      type: typeMatch ? typeMatch[1] : null
    };
  })
}));

vi.mock('src/util/nameUtils', () => ({
  createNameSlug: vi.fn(() => 'john-doe')
}));

vi.mock('src/util/photoLineFromV3toV4', () => ({
  photoLineFromV3toV4: vi.fn((line) => line)
}));

vi.mock('src/contacts/vcard/shared/ensureHasName', () => ({
  ensureHasName: vi.fn((obj) => Promise.resolve({ ...obj, 'FN': 'Test Name' }))
}));

vi.mock('../../services/loggingService', () => ({
  loggingService: {
    debug: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}));

describe('VcardFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with provided data', () => {
      const vcardData = 'BEGIN:VCARD\nFN:John Doe\nEND:VCARD';
      const vcardFile = new VcardFile(vcardData);
      
      expect(vcardFile.toString()).toBe(vcardData);
    });

    it('should create instance with empty data when none provided', () => {
      const vcardFile = new VcardFile();
      
      expect(vcardFile.toString()).toBe('');
    });
  });

  describe('fromFile', () => {
    it('should create VcardFile from file path', async () => {
      const mockContent = 'BEGIN:VCARD\nFN:John Doe\nEND:VCARD';
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await VcardFile.fromFile('/test/path/contact.vcf');
      
      expect(result).toBeInstanceOf(VcardFile);
      expect(result?.toString()).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test/path/contact.vcf', 'utf-8');
    });

    it('should return null on file read error', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await VcardFile.fromFile('/nonexistent/path.vcf');
      
      expect(result).toBeNull();
    });

    it('should return null for empty file content', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await VcardFile.fromFile('/empty/file.vcf');
      
      expect(result).toBeNull();
    });
  });

  describe('fromObsidianFiles', () => {
    it('should convert Obsidian files to VCF format', async () => {
      const mockFiles = [
        { basename: 'John Doe' },
        { basename: 'Jane Smith' }
      ] as any[];

      const result = await VcardFile.fromObsidianFiles(mockFiles);
      
      expect(result).toHaveProperty('vcards');
      expect(result).toHaveProperty('errors');
      expect(result.vcards).toContain('BEGIN:VCARD');
      expect(result.vcards).toContain('END:VCARD');
      expect(result.errors).toEqual([]);
    });

    it('should handle errors when converting files', async () => {
      const mockFiles = [{ basename: 'Test File' }] as any[];
      
      // Create a spy on the private method to force it to throw an error
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock the getApp to throw
      vi.mocked(vi.fn()).mockImplementation(() => {
        throw new Error('App not available');
      });
      
      // Simply test with a file that will cause an error due to missing frontmatter
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn(() => null) // This will cause "No frontmatter found." error
        }
      };
      
      const result = await VcardFile.fromObsidianFiles(mockFiles, mockApp as any);
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        status: 'error',
        file: 'Test File',
        message: 'No frontmatter found.'
      });
      
      errorSpy.mockRestore();
    });
  });

  describe('createEmpty', () => {
    it('should create VcardFile with default empty fields', async () => {
      const result = await VcardFile.createEmpty();
      
      expect(result).toBeInstanceOf(VcardFile);
      expect(result.toString()).toContain('BEGIN:VCARD');
      expect(result.toString()).toContain('END:VCARD');
      expect(result.toString()).toContain('VERSION:4.0');
    });
  });

  describe('parse', () => {
    it('should parse VCF data into vCard objects', async () => {
      const vcfData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
EMAIL:john@example.com
END:VCARD`;

      const vcardFile = new VcardFile(vcfData);
      const results = [];
      
      for await (const result of vcardFile.parse()) {
        results.push(result);
      }
      
      expect(results).toHaveLength(1);
      expect(results[0][0]).toBe('john-doe'); // slug
      expect(results[0][1]).toHaveProperty('FN', 'John Doe');
      expect(results[0][1]).toHaveProperty('EMAIL', 'john@example.com');
    });

    it('should handle multiple VCF entries', async () => {
      const vcfData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
END:VCARD

BEGIN:VCARD
VERSION:4.0
FN:Jane Smith
END:VCARD`;

      const vcardFile = new VcardFile(vcfData);
      const results = [];
      
      for await (const result of vcardFile.parse()) {
        results.push(result);
      }
      
      expect(results).toHaveLength(2);
    });
  });

  describe('saveToFile', () => {
    it('should save VCF data to file', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue();
      
      const vcardFile = new VcardFile('BEGIN:VCARD\nFN:John Doe\nEND:VCARD');
      const result = await vcardFile.saveToFile('/test/output.vcf');
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/output.vcf',
        'BEGIN:VCARD\nFN:John Doe\nEND:VCARD',
        'utf-8'
      );
    });

    it('should return false on write error', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));
      
      const vcardFile = new VcardFile('BEGIN:VCARD\nFN:John Doe\nEND:VCARD');
      const result = await vcardFile.saveToFile('/invalid/path.vcf');
      
      expect(result).toBe(false);
    });
  });

  describe('static file operations', () => {
    describe('listVCFFiles', () => {
      it('should list VCF files in directory', async () => {
        const mockEntries = [
          { name: 'contact1.vcf', isFile: () => true },
          { name: 'contact2.VCF', isFile: () => true },
          { name: 'not-vcf.txt', isFile: () => true },
          { name: 'subfolder', isFile: () => false }
        ];
        vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any);

        const result = await VcardFile.listVCFFiles('/test/folder');
        
        expect(result).toEqual([
          '/test/folder/contact1.vcf',
          '/test/folder/contact2.VCF'
        ]);
      });

      it('should handle directory read errors', async () => {
        vi.mocked(fs.readdir).mockRejectedValue(new Error('Directory not found'));

        const result = await VcardFile.listVCFFiles('/nonexistent');
        
        expect(result).toEqual([]);
      });
    });

    describe('getFileStats', () => {
      it('should return file statistics', async () => {
        const mockStats = { mtimeMs: 1234567890 };
        vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

        const result = await VcardFile.getFileStats('/test/file.vcf');
        
        expect(result).toEqual({ mtimeMs: 1234567890 });
      });

      it('should return null on error', async () => {
        vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

        const result = await VcardFile.getFileStats('/nonexistent.vcf');
        
        expect(result).toBeNull();
      });
    });

    describe('folderExists', () => {
      it('should return true for existing folder', async () => {
        vi.mocked(fs.access).mockResolvedValue();

        const result = await VcardFile.folderExists('/test/folder');
        
        expect(result).toBe(true);
      });

      it('should return false for non-existing folder', async () => {
        vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

        const result = await VcardFile.folderExists('/nonexistent');
        
        expect(result).toBe(false);
      });

      it('should return false for empty path', async () => {
        const result = await VcardFile.folderExists('');
        
        expect(result).toBe(false);
      });
    });

    describe('containsUID', () => {
      it('should find UID in content', () => {
        const content = 'BEGIN:VCARD\nUID:test-uid-123\nFN:John Doe\nEND:VCARD';
        
        const result = VcardFile.containsUID(content, 'test-uid-123');
        
        expect(result).toBe(true);
      });

      it('should not find non-existing UID', () => {
        const content = 'BEGIN:VCARD\nFN:John Doe\nEND:VCARD';
        
        const result = VcardFile.containsUID(content, 'non-existing-uid');
        
        expect(result).toBe(false);
      });
    });

    describe('generateVCFFilename', () => {
      it('should sanitize contact name for filename', () => {
        const result = VcardFile.generateVCFFilename('John Doe / Smith & Co.');
        
        expect(result).toBe('John_Doe___Smith___Co_.vcf');
      });

      it('should handle special characters', () => {
        const result = VcardFile.generateVCFFilename('Contact@#$%^&*()');
        
        expect(result).toBe('Contact_________.vcf');
      });
    });
  });
});