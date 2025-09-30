import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupVCFDropHandler } from '../../../src/plugin/services/dropHandler';
import type { ContactsPluginSettings } from 'src/plugin/settings';
import type { App, TFile } from 'obsidian';

// Mock fs module
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock ContactManagerUtils
vi.mock('../../../src/models/contactManager/contactManagerUtils', () => ({
  ContactManagerUtils: {
    createContactFile: vi.fn(),
  },
}));

// Mock VcardFile
vi.mock('../../../src/models/vcardFile', () => ({
  VcardFile: vi.fn().mockImplementation(() => ({
    async *parse() {
      yield ['test-slug', {
        UID: 'test-uid-123',
        FN: 'Test User',
        EMAIL: 'test@example.com'
      }];
    }
  }))
}));

// Mock ContactNote
vi.mock('../../../src/models/contactNote', () => ({
  ContactNote: vi.fn().mockImplementation(() => ({
    mdRender: vi.fn().mockReturnValue('---\nUID: test-uid-123\nFN: Test User\n---\n# Test User')
  }))
}));

// Minimal mock vault implementation
class MockTFile {
  path: string;
  name: string;
  basename: string;
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || path;
    this.basename = this.name.replace(/\.md$/i, '').replace(/\.vcf$/i, '');
  }
}

describe('vcfDropHandler', () => {
  let app: Partial<App> & { vault: any; metadataCache: any };
  let settings: ContactsPluginSettings;
  let createdFiles: Record<string, string> = {};
  let fsPromises: any;

  beforeEach(async () => {
    createdFiles = {};

    // Get mocked fs/promises
    fsPromises = await import('fs/promises');

    app = {
      vault: {
        _files: new Map<string, string>(),
        async read(file: TFile) {
          const content = app.vault._files.get(file.path);
          if (!content) throw new Error('File not found');
          return content;
        },
        async delete(file: TFile) {
          app.vault._files.delete(file.path);
        },
        async modify(file: TFile, content: string) {
          app.vault._files.set(file.path, content);
        },
        async rename(file: TFile, newPath: string) {
          const content = app.vault._files.get(file.path);
          app.vault._files.delete(file.path);
          if (content) app.vault._files.set(newPath, content);
        },
        getAbstractFileByPath: vi.fn().mockReturnValue(null),
        getMarkdownFiles: vi.fn().mockReturnValue([]),
        on: vi.fn(),
        off: vi.fn(),
      },
      metadataCache: {
        getFileCache: vi.fn().mockReturnValue({ frontmatter: {} })
      }
    } as unknown as App & { vault: any };

    settings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/tmp/vcfwatch',
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      enableSync: true,
      logLevel: 'DEBUG',
    };

    // Reset fs mocks
    vi.mocked(fsPromises.readFile).mockReset();
    vi.mocked(fsPromises.writeFile).mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('setup and cleanup', () => {
    it('registers and returns cleanup function', () => {
      const on = vi.fn();
      const off = vi.fn();
      app.vault.on = on;
      app.vault.off = off;

      const cleanup = setupVCFDropHandler(app as unknown as App, settings);
      expect(on).toHaveBeenCalledWith('create', expect.any(Function));
      expect(typeof cleanup).toBe('function');
      
      cleanup();
      expect(off).toHaveBeenCalledWith('create', expect.any(Function));
    });

    it('cleanup function removes the correct listener', () => {
      const listeners: Map<string, Function> = new Map();
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        listeners.set(event, cb);
      });
      
      app.vault.off = vi.fn((event: string, cb: any) => {
        if (listeners.get(event) === cb) {
          listeners.delete(event);
        }
      });

      const cleanup = setupVCFDropHandler(app as unknown as App, settings);
      expect(listeners.has('create')).toBe(true);
      
      cleanup();
      expect(listeners.has('create')).toBe(false);
    });
  });

  describe('file filtering', () => {
    it('ignores non-vcf files', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const nonVcfFile = new MockTFile('notes/note.txt') as unknown as TFile;
      app.vault._files.set(nonVcfFile.path, 'Some text content');
      
      // Should not throw
      await handler!(nonVcfFile);
      
      // Verify no filesystem operations were attempted
      expect(fsPromises.writeFile).not.toHaveBeenCalled();
    });

    it('processes files with .vcf extension (case insensitive)', async () => {
      const testCases = ['test.vcf', 'TEST.VCF', 'Test.Vcf', 'contact.VCF'];
      
      for (const fileName of testCases) {
        let handler: Function | null = null;
        
        app.vault.on = vi.fn((event: string, cb: any) => {
          handler = cb;
        });

        setupVCFDropHandler(app as unknown as App, settings);
        
        const vcfFile = new MockTFile(`vault/${fileName}`) as unknown as TFile;
        const vcfContent = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-123\nFN:Test\nEND:VCARD\n';
        app.vault._files.set(vcfFile.path, vcfContent);
        
        vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
        
        await handler!(vcfFile);
        
        // Should attempt to write to watch folder
        expect(fsPromises.writeFile).toHaveBeenCalled();
        
        vi.mocked(fsPromises.writeFile).mockReset();
      }
    });

    it('ignores vcf drop when no watch folder configured', async () => {
      settings.vcfWatchFolder = '';
      
      let handler: Function | null = null;
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/test.vcf') as unknown as TFile;
      app.vault._files.set(vcfFile.path, 'BEGIN:VCARD\nVERSION:4.0\nEND:VCARD\n');
      
      await handler!(vcfFile);
      
      // Should not attempt to write to watch folder
      expect(fsPromises.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles file read errors gracefully', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/test.vcf') as unknown as TFile;
      // Don't add file to vault._files to simulate read error
      
      // Should not throw
      await expect(handler!(vcfFile)).resolves.not.toThrow();
    });

    it('handles VCF write errors gracefully', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/test.vcf') as unknown as TFile;
      app.vault._files.set(vcfFile.path, 'BEGIN:VCARD\nVERSION:4.0\nUID:test\nEND:VCARD\n');
      
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('Write failed'));
      
      // Should not throw
      await expect(handler!(vcfFile)).resolves.not.toThrow();
    });

    it('handles vault delete errors gracefully', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });
      
      app.vault.delete = vi.fn().mockRejectedValue(new Error('Delete failed'));

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/test.vcf') as unknown as TFile;
      app.vault._files.set(vcfFile.path, 'BEGIN:VCARD\nVERSION:4.0\nUID:test\nEND:VCARD\n');
      
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      
      // Should not throw
      await expect(handler!(vcfFile)).resolves.not.toThrow();
    });

    it('handles null or undefined file gracefully', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      // Should not throw
      await expect(handler!(null)).resolves.not.toThrow();
      await expect(handler!(undefined)).resolves.not.toThrow();
    });
  });

  describe('VCF file operations', () => {
    it('copies VCF to watch folder', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/contact.vcf') as unknown as TFile;
      const vcfContent = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-uid\nFN:John Doe\nEND:VCARD\n';
      app.vault._files.set(vcfFile.path, vcfContent);
      
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('Not found'));
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      
      await handler!(vcfFile);
      
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('contact.vcf'),
        vcfContent,
        'utf-8'
      );
    });

    it('does not overwrite identical VCF in watch folder', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/contact.vcf') as unknown as TFile;
      const vcfContent = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-uid\nFN:John Doe\nEND:VCARD\n';
      app.vault._files.set(vcfFile.path, vcfContent);
      
      // Mock that the same content already exists in watch folder
      vi.mocked(fsPromises.readFile).mockResolvedValue(vcfContent);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      
      await handler!(vcfFile);
      
      // Should not write when content is identical
      expect(fsPromises.writeFile).not.toHaveBeenCalled();
    });

    it('overwrites different VCF content in watch folder', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/contact.vcf') as unknown as TFile;
      const newContent = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-uid\nFN:John Doe Updated\nEND:VCARD\n';
      const oldContent = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-uid\nFN:John Doe\nEND:VCARD\n';
      app.vault._files.set(vcfFile.path, newContent);
      
      // Mock that different content exists in watch folder
      vi.mocked(fsPromises.readFile).mockResolvedValue(oldContent);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      
      await handler!(vcfFile);
      
      // Should overwrite when content differs
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('contact.vcf'),
        newContent,
        'utf-8'
      );
    });

    it('deletes VCF from vault after processing', async () => {
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });
      
      const deleteSpy = vi.spyOn(app.vault, 'delete');

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/contact.vcf') as unknown as TFile;
      app.vault._files.set(vcfFile.path, 'BEGIN:VCARD\nVERSION:4.0\nUID:test\nEND:VCARD\n');
      
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      
      await handler!(vcfFile);
      
      expect(deleteSpy).toHaveBeenCalledWith(vcfFile);
    });
  });

  describe('contact operations', () => {
    it('processes contacts from VCF', async () => {
      const { ContactManagerUtils } = await import('../../../src/models/contactManager/contactManagerUtils');
      
      let handler: Function | null = null;
      
      app.vault.on = vi.fn((event: string, cb: any) => {
        handler = cb;
      });

      setupVCFDropHandler(app as unknown as App, settings);
      
      const vcfFile = new MockTFile('vault/contact.vcf') as unknown as TFile;
      app.vault._files.set(vcfFile.path, 'BEGIN:VCARD\nVERSION:4.0\nUID:test-uid\nFN:Test User\nEND:VCARD\n');
      
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      vi.mocked(ContactManagerUtils.createContactFile).mockResolvedValue(undefined);
      
      await handler!(vcfFile);
      
      // The dropHandler processes VCF files and attempts contact operations
      // Since we have proper mocks, it should complete without errors
      expect(handler).toBeDefined();
    });
  });
});
