import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupVCFDropHandler } from 'src/ui/vcfDropHandler';
import type { ContactsPluginSettings } from 'src/settings/settings.d';
import type { App, TFile } from 'obsidian';

// Minimal mock vault implementation
class MockTFile {
  path: string;
  name: string;
  basename: string;
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || path;
    this.basename = this.name.replace(/\.md$/i, '');
  }
}

describe('vcfDropHandler', () => {
  let app: Partial<App> & { vault: any; metadataCache: any };
  let settings: ContactsPluginSettings;
  let createdFiles: Record<string, string> = {};

  beforeEach(() => {
    createdFiles = {};

    app = {
      vault: {
        _files: new Map<string, string>(),
        async read(file: TFile) {
          return app.vault._files.get(file.path) ?? '';
        },
        async delete(file: TFile) {
          app.vault._files.delete(file.path);
        },
        on: vi.fn(),
        off: vi.fn(),
      },
      metadataCache: {
        getFileCache: (f: TFile) => ({ frontmatter: {} })
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('registers and returns cleanup function', () => {
    const on = vi.fn();
    const off = vi.fn();
    app.vault.on = on;
    app.vault.off = off;

    const cleanup = setupVCFDropHandler(app as unknown as App, settings);
    expect(on).toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(off).toHaveBeenCalled();
  });

  it('ignores non-vcf files and does not throw', async () => {
    const on = vi.fn((event: string, cb: any) => {
      // simulate create with non-vcf
      const file = new MockTFile('notes/note.txt') as unknown as TFile;
      cb(file);
    });
    app.vault.on = on;

    const cleanup = setupVCFDropHandler(app as unknown as App, settings);
    cleanup();
  });

  // Note: full filesystem interactions are out of scope; we ensure no exceptions when called with vcf
  it('handles a dropped vcf file without throwing', async () => {
    // Create sample VCF content in vault
    const content = 'BEGIN:VCARD\nVERSION:4.0\nUID:12345\nFN:Test User\nEND:VCARD\n';
    const file = new MockTFile('vault/Test.vcf') as unknown as TFile;

    const on = vi.fn((event: string, cb: any) => {
      // call the handler with our file
      app.vault._files.set(file.path, content);
      cb(file);
    });

    app.vault.on = on;
    app.vault.off = vi.fn();

  const cleanup = setupVCFDropHandler(app as unknown as App, settings);
  expect(on).toHaveBeenCalled();
  cleanup();
  });
});
