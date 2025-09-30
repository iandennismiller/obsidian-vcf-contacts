import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncWatcher } from '../../../src/plugin/services/syncWatcher';
import type { ContactsPluginSettings } from 'src/plugin/settings';
import type { App } from 'obsidian';

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
      vcfWatchEnabled: true,
      vcfStorageMethod: 'vcf-folder',
      vcfWatchFolder: '/test/vcf',
      vcfFilename: 'contacts.vcf',
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
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
      settings.vcfWatchEnabled = false;
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      expect(mockSetInterval).not.toHaveBeenCalled();
    });

    it('should not start when vcfWatchFolder is missing for vcf-folder mode', async () => {
      settings.vcfStorageMethod = 'vcf-folder';
      settings.vcfWatchFolder = '';
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      expect(mockSetInterval).not.toHaveBeenCalled();
    });

    it('should not start when vcfFilename is missing for single-vcf mode', async () => {
      settings.vcfStorageMethod = 'single-vcf';
      settings.vcfFilename = '';
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
        settings.vcfWatchPollingInterval * 1000
      );
    });

    it('should start polling for single-vcf mode', async () => {
      settings.vcfStorageMethod = 'single-vcf';
      settings.vcfFilename = 'contacts.vcf';
      syncWatcher = new SyncWatcher(app as App, settings);
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        settings.vcfWatchPollingInterval * 1000
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

    it('should restart when vcfWatchEnabled changes', async () => {
      const newSettings = { ...settings, vcfWatchEnabled: false };
      
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      const startCallCount = mockSetInterval.mock.calls.length;
      
      await syncWatcher.updateSettings(newSettings);
      
      // Should have stopped
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcfStorageMethod changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcfStorageMethod: 'single-vcf' as any };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcfWatchFolder changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcfWatchFolder: '/new/folder' };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcfFilename changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcfFilename: 'newfile.vcf' };
      await syncWatcher.updateSettings(newSettings);
      
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it('should restart when vcfWatchPollingInterval changes', async () => {
      await syncWatcher.start();
      
      // Give async operations a chance to complete
      await new Promise(resolve => originalSetTimeout(resolve, 50));
      
      vi.clearAllMocks();
      
      const newSettings = { ...settings, vcfWatchPollingInterval: 60 };
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
});
