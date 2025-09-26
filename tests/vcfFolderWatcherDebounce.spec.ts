import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VCFolderWatcher } from 'src/services/vcfFolderWatcher';
import type { App, TFile } from 'obsidian';

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

describe('VCFolderWatcher debounce', () => {
  let app: Partial<App> & { vault: any; metadataCache: any };
  let settings: any;

  beforeEach(() => {
    settings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '',
      vcfWatchFolder: '/tmp/vcfwatch',
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: true,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      enableSync: true,
      logLevel: 'DEBUG',
    };

    app = {
      vault: {
        on: vi.fn(),
        off: vi.fn(),
      },
      metadataCache: {
        getFileCache: () => ({ frontmatter: { UID: 'u1' } })
      }
    } as unknown as App & { vault: any };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('schedules a debounced write-back on modify', async () => {
    const watcher = new VCFolderWatcher(app as unknown as App, settings);

    // Capture the modify handler registered
    let modifyHandler: ((file: TFile) => Promise<void>) | undefined;
    app.vault.on = vi.fn((evt: string, cb: any) => {
      if (evt === 'modify') modifyHandler = cb;
    });

    // Spy on writeContactToVCF
    const spy = vi.spyOn<any, any>(VCFolderWatcher.prototype as any, 'writeContactToVCF').mockResolvedValue(undefined);

    // Kick off contact tracking which registers handlers
    // @ts-ignore access private method indirectly by calling start then setupContactFileTracking via settings
    watcher['settings'] = settings;
    watcher['app'] = app as unknown as App;
    watcher['setupContactFileTracking']();

    // Simulate modify event call
    const file = new MockTFile('Contacts/test.md') as unknown as TFile;
    // Mock metadata cache to return UID
    app.metadataCache.getFileCache = () => ({ frontmatter: { UID: 'u1' } });

    if (!modifyHandler) throw new Error('modify handler not registered');

    // Call modify handler
    await modifyHandler(file);

    // After calling, the debounced write should be scheduled - wait >1s
    await new Promise(res => setTimeout(res, 1100));

    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
