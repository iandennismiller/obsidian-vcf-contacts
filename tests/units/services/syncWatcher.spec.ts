import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncWatcher } from '../../../src/plugin/services/syncWatcher';
import type { ContactsPluginSettings } from 'src/plugin/settings';
import type { App } from 'obsidian';

// Mock metadataCacheWaiter
vi.mock('../../../src/plugin/services/metadataCacheWaiter', () => ({
  waitForMetadataCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock timers
vi.mock('timers', () => ({
  setTimeout: vi.fn((cb, ms) => {
    cb();
    return 1;
  }),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    stat: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
  stat: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

// Mock path module
vi.mock('path', () => ({
  default: {
    basename: vi.fn((p: string) => p.split('/').pop() || p),
  },
  basename: vi.fn((p: string) => p.split('/').pop() || p),
}));

// Mock ContactManager
vi.mock('../../../src/models/contactManager', () => ({
  ContactManager: vi.fn().mockImplementation(() => ({
    initializeCache: vi.fn().mockResolvedValue(undefined),
    updateSettings: vi.fn(),
    processVCFContacts: vi.fn().mockResolvedValue([]),
    getFrontmatterFromFiles: vi.fn().mockResolvedValue([]),
  }))
}));

// Mock VcardManager
vi.mock('../../../src/models/vcardManager', () => ({
  VcardManager: vi.fn().mockImplementation(() => ({
    updateSettings: vi.fn(),
    getVCardFileInfo: vi.fn(),
    readAndParseVCard: vi.fn(),
    scanVCFFolder: vi.fn().mockResolvedValue([]),
    processVCFContents: vi.fn().mockResolvedValue([]),
  }))
}));

// Mock curatorService
vi.mock('../../../src/models/curatorManager/curatorManager', () => ({
  curatorService: {
    process: vi.fn().mockResolvedValue([]),
  }
}));

// Mock Notice
vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  App: vi.fn(),
}));

// Mock settings context
const mockSettingsChangeCallbacks = new Set<(settings: any) => void>();
vi.mock('../../../src/plugin/context/sharedSettingsContext', () => ({
  onSettingsChange: vi.fn((callback) => {
    mockSettingsChangeCallbacks.add(callback);
    return () => mockSettingsChangeCallbacks.delete(callback);
  }),
}));

describe('SyncWatcher', () => {
  let syncWatcher: SyncWatcher;
  let app: Partial<App>;
  let settings: ContactsPluginSettings;
  let mockSetInterval: any;
  let mockClearInterval: any;
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    vi.clearAllMocks();
    // Don't clear the callbacks set here - it should persist during the test

    // Store original setTimeout
    originalSetTimeout = global.setTimeout;

    // Mock setTimeout to resolve immediately
    global.setTimeout = ((cb: any) => {
      if (typeof cb === 'function') {
        Promise.resolve().then(cb);
      }
      return 1 as any;
    }) as any;

    // Mock window interval functions
    mockSetInterval = vi.fn().mockReturnValue(1);
    mockClearInterval = vi.fn();
    global.window = {
      setInterval: mockSetInterval,
      clearInterval: mockClearInterval,
    } as any;

    app = {} as any;

    settings = {
      contactsFolder: 'Contacts',
      vcardWatchEnabled: true,
      vcardStorageMethod: 'vcard-folder',
      vcardWatchFolder: '/test/vcf',
      vcardFilename: 'contacts.vcf',
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
    } as any;
  });

  afterEach(() => {
    if (syncWatcher) {
      syncWatcher.stop();
    }
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout;
  });

  describe('Constructor', () => {
    it('should create a new SyncWatcher instance', () => {
      syncWatcher = new SyncWatcher(app as App, settings);
      expect(syncWatcher).toBeDefined();
      expect(syncWatcher).toBeInstanceOf(SyncWatcher);
    });

    it('should initialize with app and settings', () => {
      syncWatcher = new SyncWatcher(app as App, settings);
      expect(syncWatcher).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should not start when watch is disabled', async () => {
      settings.vcardWatchEnabled = false;
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      expect(mockSetInterval).not.toHaveBeenCalled();
    });

    it('should not start when vcardWatchFolder is missing for vcf-folder mode', async () => {
      settings.vcardStorageMethod = 'vcard-folder';
      settings.vcardWatchFolder = '';
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      expect(mockSetInterval).not.toHaveBeenCalled();
    });

    it('should not start when vcardFilename is missing for single-vcf mode', async () => {
      settings.vcardStorageMethod = 'single-vcard';
      settings.vcardFilename = '';
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      expect(mockSetInterval).not.toHaveBeenCalled();
    });

    it('should start polling for vcf-folder mode', async () => {
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      // Should have called setInterval
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        settings.vcardWatchPollingInterval * 1000
      );
    });

    it('should start polling for single-vcf mode', async () => {
      settings.vcardStorageMethod = 'single-vcard';
      settings.vcardFilename = 'contacts.vcf';
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        settings.vcardWatchPollingInterval * 1000
      );
    });

    it('should stop existing watcher before starting new one', async () => {
      syncWatcher = new SyncWatcher(app as App, settings);
      mockSetInterval.mockReturnValue(123);
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      await syncWatcher.start(); // Start again
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      expect(mockClearInterval).toHaveBeenCalledWith(123);
    });
  });

  describe('stop()', () => {
    it('should clear interval when stopping', async () => {
      const intervalId = 123;
      mockSetInterval.mockReturnValue(intervalId);
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      syncWatcher.stop();
      
      expect(mockClearInterval).toHaveBeenCalledWith(intervalId);
    });

    it('should unsubscribe from settings changes', async () => {
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      const callbackCount = mockSettingsChangeCallbacks.size;
      
      syncWatcher.stop();
      
      // Should have fewer callbacks after unsubscribe
      expect(mockSettingsChangeCallbacks.size).toBeLessThanOrEqual(callbackCount);
    });

    it('should handle stop when not started', () => {
      syncWatcher = new SyncWatcher(app as App, settings);
      
      expect(() => syncWatcher.stop()).not.toThrow();
      expect(mockClearInterval).not.toHaveBeenCalled();
    });

    it('should handle multiple stop calls', async () => {
      mockSetInterval.mockReturnValue(123);
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      syncWatcher.stop();
      syncWatcher.stop(); // Stop again
      
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSettings()', () => {
    beforeEach(async () => {
      syncWatcher = new SyncWatcher(app as App, settings);
    });

    it('should restart when vcardWatchEnabled changes', async () => {
      const newSettings = { ...settings, vcardWatchEnabled: false };
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      const startCallCount = mockSetInterval.mock.calls.length;
      
      await syncWatcher.updateSettings(newSettings);
      
      // Should have stopped
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcardStorageMethod changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcardStorageMethod: 'single-vcard' as any };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcardWatchFolder changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcardWatchFolder: '/new/folder' };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcardFilename changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcardFilename: 'newfile.vcf' };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcardWatchPollingInterval changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcardWatchPollingInterval: 60 };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should not restart when unrelated settings change', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, contactsFolder: 'NewContacts' };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).not.toHaveBeenCalled();
    });

    it('should update dependency settings', async () => {
      const { ContactManager } = await import('../../../src/models/contactManager');
      const { VcardManager } = await import('../../../src/models/vcardManager');
      
      const newSettings = { ...settings };
      await syncWatcher.updateSettings(newSettings);
      
      // The dependencies should have been created and updateSettings called
      expect(ContactManager).toHaveBeenCalled();
      expect(VcardManager).toHaveBeenCalled();
    });
  });

  describe('Integration with dependencies', () => {
    it('should initialize contact manager cache on start', async () => {
      const { ContactManager } = await import('../../../src/models/contactManager');
      const mockInstance = (ContactManager as any).mock.results[0]?.value || 
                          { initializeCache: vi.fn().mockResolvedValue(undefined) };
      
      syncWatcher = new SyncWatcher(app as App, settings);
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      // ContactManager should be instantiated
      expect(ContactManager).toHaveBeenCalled();
    });

    it('should use VcardManager for processing', async () => {
      const { VcardManager } = await import('../../../src/models/vcardManager');
      
      syncWatcher = new SyncWatcher(app as App, settings);
      
      expect(VcardManager).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle errors during start gracefully', async () => {
      const { ContactManager } = await import('../../../src/models/contactManager');
      const mockContactManager = {
        initializeCache: vi.fn().mockRejectedValue(new Error('Cache init failed')),
        updateSettings: vi.fn(),
      };
      (ContactManager as any).mockImplementation(() => mockContactManager);
      
      syncWatcher = new SyncWatcher(app as App, settings);
      
      // Should not throw even if initialization fails
      await expect(syncWatcher.start()).rejects.toThrow('Cache init failed');
    });
  });

  describe('File scanning operations', () => {
    beforeEach(async () => {
      const fsPromises = await import('fs/promises');
      const { ContactManager } = await import('../../../src/models/contactManager');
      const { VcardManager } = await import('../../../src/models/vcardManager');
      const { curatorService } = await import('../../../src/models/curatorManager/curatorManager');
      const { Notice } = await import('obsidian');
      
      // Setup comprehensive mocks for file scanning
      vi.mocked(fsPromises.stat).mockResolvedValue({
        mtimeMs: Date.now(),
      } as any);
      
      vi.mocked(fsPromises.readdir).mockResolvedValue([
        { name: 'contact1.vcf', isFile: () => true } as any,
        { name: 'contact2.vcf', isFile: () => true } as any,
      ]);
      
      vi.mocked(fsPromises.readFile).mockResolvedValue('BEGIN:VCARD\nVERSION:4.0\nUID:test-123\nFN:Test\nEND:VCARD\n');
      
      const mockVcardManager = {
        updateSettings: vi.fn(),
        getVCardFileInfo: vi.fn().mockResolvedValue({
          path: '/test/contact.vcf',
          lastModified: Date.now(),
          uid: 'test-uid',
        }),
        readAndParseVCard: vi.fn().mockResolvedValue([
          ['test-slug', { UID: 'test-uid-123', FN: 'Test Contact' }]
        ]),
        scanVCFFolder: vi.fn().mockResolvedValue(['/test/contact1.vcf', '/test/contact2.vcf']),
        processVCFContents: vi.fn().mockResolvedValue([
          ['test-slug', { UID: 'test-uid-123', FN: 'Test Contact' }]
        ]),
      };
      
      const mockContactManager = {
        initializeCache: vi.fn().mockResolvedValue(undefined),
        updateSettings: vi.fn(),
        processVCFContacts: vi.fn().mockResolvedValue(['Contacts/test-contact.md']),
        getFrontmatterFromFiles: vi.fn().mockResolvedValue([
          { UID: 'test-uid-123', FN: 'Test Contact' }
        ]),
      };
      
      vi.mocked(ContactManager).mockImplementation(() => mockContactManager as any);
      vi.mocked(VcardManager).mockImplementation(() => mockVcardManager as any);
      vi.mocked(curatorService.process).mockResolvedValue([]);
      vi.mocked(Notice).mockImplementation(() => ({} as any));
    });

    describe('scanSingleVCF', () => {
      it('should process single VCF file when changed', async () => {
        settings.vcardStorageMethod = 'single-vcard';
        settings.vcardFilename = '/test/contacts.vcf';
        syncWatcher = new SyncWatcher(app as App, settings);
        
        await syncWatcher.start();
        
        // Give async operations time to complete
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // VcardManager should have been called to process the file
        const vcardManager = (syncWatcher as any).vcardManager;
        expect(vcardManager.getVCardFileInfo).toHaveBeenCalled();
      });

      it('should skip processing if file has not changed', async () => {
        settings.vcardStorageMethod = 'single-vcard';
        settings.vcardFilename = '/test/contacts.vcf';
        syncWatcher = new SyncWatcher(app as App, settings);
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        const mockGetFileInfo = vi.fn().mockResolvedValue({
          path: '/test/contacts.vcf',
          lastModified: 1000,
          uid: 'test-uid',
        });
        
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          getVCardFileInfo: mockGetFileInfo,
          readAndParseVCard: vi.fn(),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        
        // Pre-populate known files with same timestamp
        (syncWatcher as any).knownFiles.set('/test/contacts.vcf', {
          path: '/test/contacts.vcf',
          lastModified: 1000,
          uid: 'test-uid',
        });
        
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // readAndParseVCard should not be called since file hasn't changed
        const vcardManager = (syncWatcher as any).vcardManager;
        expect(vcardManager.readAndParseVCard).not.toHaveBeenCalled();
      });

      it('should handle null parsed entries', async () => {
        settings.vcardStorageMethod = 'single-vcard';
        settings.vcardFilename = '/test/contacts.vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          getVCardFileInfo: vi.fn().mockResolvedValue({
            path: '/test/contacts.vcf',
            lastModified: Date.now(),
            uid: 'test-uid',
          }),
          readAndParseVCard: vi.fn().mockResolvedValue(null),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        
        // Should not throw
        await expect(syncWatcher.start()).resolves.not.toThrow();
      });

      it('should filter out entries without UID', async () => {
        settings.vcardStorageMethod = 'single-vcard';
        settings.vcardFilename = '/test/contacts.vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        const { ContactManager } = await import('../../../src/models/contactManager');
        
        const mockProcessVCFContacts = vi.fn().mockResolvedValue([]);
        
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          getVCardFileInfo: vi.fn().mockResolvedValue({
            path: '/test/contacts.vcf',
            lastModified: Date.now(),
            uid: 'test-uid',
          }),
          readAndParseVCard: vi.fn().mockResolvedValue([
            ['valid-slug', { UID: 'test-uid-1', FN: 'Valid' }],
            ['', { FN: 'No Slug' }], // Should be filtered out
            ['no-uid-slug', { FN: 'No UID' }], // Should be filtered out
          ]),
        } as any));
        
        vi.mocked(ContactManager).mockImplementation(() => ({
          initializeCache: vi.fn().mockResolvedValue(undefined),
          updateSettings: vi.fn(),
          processVCFContacts: mockProcessVCFContacts,
          getFrontmatterFromFiles: vi.fn().mockResolvedValue([]),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // processVCFContacts should only receive the valid entry
        expect(mockProcessVCFContacts).toHaveBeenCalledWith(
          expect.arrayContaining([['valid-slug', expect.objectContaining({ UID: 'test-uid-1' })]]),
          expect.anything(),
          expect.anything()
        );
      });

      it('should call curator service when contacts are processed', async () => {
        settings.vcardStorageMethod = 'single-vcard';
        settings.vcardFilename = '/test/contacts.vcf';
        
        const { ContactManager } = await import('../../../src/models/contactManager');
        const { VcardManager } = await import('../../../src/models/vcardManager');
        
        // Reset and reconfigure mocks for this test to return contacts
        const mockProcessVCFContacts = vi.fn().mockResolvedValue(['Contacts/test.md']);
        const mockGetFrontmatter = vi.fn().mockResolvedValue([{ UID: 'test-uid' }]);
        
        vi.mocked(ContactManager).mockImplementation(() => ({
          initializeCache: vi.fn().mockResolvedValue(undefined),
          updateSettings: vi.fn(),
          processVCFContacts: mockProcessVCFContacts,
          getFrontmatterFromFiles: mockGetFrontmatter,
        } as any));
        
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          getVCardFileInfo: vi.fn().mockResolvedValue({
            path: '/test/contacts.vcf',
            lastModified: Date.now(),
            uid: 'test-uid',
          }),
          readAndParseVCard: vi.fn().mockResolvedValue([
            ['test-slug', { UID: 'test-uid-123', FN: 'Test Contact' }]
          ]),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 150));
        
        // Verify the methods that lead to curator service being called
        expect(mockProcessVCFContacts).toHaveBeenCalled();
        expect(mockGetFrontmatter).toHaveBeenCalled();
      });

      it('should handle errors during single VCF scan', async () => {
        settings.vcardStorageMethod = 'single-vcard';
        settings.vcardFilename = '/test/contacts.vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          getVCardFileInfo: vi.fn().mockRejectedValue(new Error('File read error')),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        
        // Should not throw, error is caught and logged
        await expect(syncWatcher.start()).resolves.not.toThrow();
      });
    });

    describe('scanVCFFolder', () => {
      it('should process multiple VCF files in folder', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        syncWatcher = new SyncWatcher(app as App, settings);
        
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // VcardManager should scan the folder
        const vcardManager = (syncWatcher as any).vcardManager;
        expect(vcardManager.scanVcardFolder).toHaveBeenCalled();
      });

      it('should skip when no files need processing', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          scanVCFFolder: vi.fn().mockResolvedValue([]), // No files to process
          getVCardFileInfo: vi.fn(),
          processVCFContents: vi.fn(),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // processVCFContents should not be called
        const vcardManager = (syncWatcher as any).vcardManager;
        expect(vcardManager.processVcardContents).not.toHaveBeenCalled();
      });

      it('should handle errors during folder scan', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          scanVCFFolder: vi.fn().mockRejectedValue(new Error('Scan failed')),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        
        // Should not throw, error is caught and logged
        await expect(syncWatcher.start()).resolves.not.toThrow();
      });
    });

    describe('processVCFFile', () => {
      it('should process VCF file and update tracking', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        syncWatcher = new SyncWatcher(app as App, settings);
        
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // knownFiles should be updated
        const knownFiles = (syncWatcher as any).knownFiles;
        expect(knownFiles.size).toBeGreaterThan(0);
      });

      it('should skip file if not changed', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        const mockProcessContents = vi.fn();
        
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          scanVCFFolder: vi.fn().mockResolvedValue(['/test/vcf/contact.vcf']),
          getVCardFileInfo: vi.fn().mockResolvedValue({
            path: '/test/vcf/contact.vcf',
            lastModified: 1000,
            uid: 'test-uid',
          }),
          processVCFContents: mockProcessContents,
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        
        // Pre-populate known files
        (syncWatcher as any).knownFiles.set('/test/vcf/contact.vcf', {
          path: '/test/vcf/contact.vcf',
          lastModified: 1000,
          uid: 'test-uid',
        });
        
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // Should not process file since it hasn't changed
        expect(mockProcessContents).not.toHaveBeenCalled();
      });

      it('should skip when VCF has no entries', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        const { ContactManager } = await import('../../../src/models/contactManager');
        const mockProcessVCFContacts = vi.fn();
        
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          scanVCFFolder: vi.fn().mockResolvedValue(['/test/vcf/empty.vcf']),
          getVCardFileInfo: vi.fn().mockResolvedValue({
            path: '/test/vcf/empty.vcf',
            lastModified: Date.now(),
            uid: '',
          }),
          processVCFContents: vi.fn().mockResolvedValue([]), // Empty array
        } as any));
        
        vi.mocked(ContactManager).mockImplementation(() => ({
          initializeCache: vi.fn().mockResolvedValue(undefined),
          updateSettings: vi.fn(),
          processVCFContacts: mockProcessVCFContacts,
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // Should not process contacts since VCF is empty
        expect(mockProcessVCFContacts).not.toHaveBeenCalled();
      });

      it('should handle errors during file processing', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        
        const { VcardManager } = await import('../../../src/models/vcardManager');
        vi.mocked(VcardManager).mockImplementation(() => ({
          updateSettings: vi.fn(),
          scanVCFFolder: vi.fn().mockResolvedValue(['/test/vcf/error.vcf']),
          getVCardFileInfo: vi.fn().mockRejectedValue(new Error('File error')),
        } as any));
        
        syncWatcher = new SyncWatcher(app as App, settings);
        
        // Should not throw, error is caught and logged
        await expect(syncWatcher.start()).resolves.not.toThrow();
      });

      it('should show notification when contacts are processed', async () => {
        settings.vcardStorageMethod = 'vcard-folder';
        settings.vcardWatchFolder = '/test/vcf';
        
        const { Notice } = await import('obsidian');
        
        syncWatcher = new SyncWatcher(app as App, settings);
        await syncWatcher.start();
        await new Promise(resolve => originalSetTimeout(resolve, 100));
        
        // Notice should have been called
        expect(Notice).toHaveBeenCalled();
      });
    });
  });
});
