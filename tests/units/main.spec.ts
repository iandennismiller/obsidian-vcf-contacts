import { describe, it, expect, vi, beforeEach } from 'vitest';
import ContactsPlugin from '../../src/main';
import { App, Plugin } from 'obsidian';

// Mock all dependencies
vi.mock('../../src/models/vcardFile');
vi.mock('../../src/plugin/services/syncWatcher');
vi.mock('../../src/plugin/services/dropHandler');
vi.mock('../../src/plugin/context/sharedAppContext');
vi.mock('../../src/models/curatorManager/curatorManager');
vi.mock('../../src/models/contactManager');
vi.mock('../../src/plugin/settings');
vi.mock('../../src/curators/uidValidate');
vi.mock('../../src/curators/vcardSyncRead');
vi.mock('../../src/curators/relatedOther');
vi.mock('../../src/curators/relatedFrontMatter');
vi.mock('../../src/curators/relatedList');
vi.mock('../../src/curators/genderInference');
vi.mock('../../src/curators/genderRender');
vi.mock('../../src/curators/namespaceUpgrade');
vi.mock('../../src/curators/vcardSyncWrite');
vi.mock('../../src/models/contactNote');
vi.mock('../../src/plugin/ui/modals/fileExistsModal');

// Mock Obsidian
vi.mock('obsidian', () => ({
  Plugin: class MockPlugin {
    app: any;
    manifest: any;
    loadData = vi.fn().mockResolvedValue({});
    saveData = vi.fn().mockResolvedValue(undefined);
    addCommand = vi.fn();
    addSettingTab = vi.fn();
    registerEvent = vi.fn();
    registerDomEvent = vi.fn();
  },
  Notice: vi.fn(),
  App: vi.fn(),
  Modal: vi.fn(),
  TFile: vi.fn(),
  normalizePath: vi.fn((path) => path),
  AbstractInputSuggest: class MockAbstractInputSuggest {},
  PluginSettingTab: class MockPluginSettingTab {},
  Setting: class MockSetting {
    addText = vi.fn().mockReturnThis();
    addToggle = vi.fn().mockReturnThis();
    addDropdown = vi.fn().mockReturnThis();
    addButton = vi.fn().mockReturnThis();
    setName = vi.fn().mockReturnThis();
    setDesc = vi.fn().mockReturnThis();
  },
}));

/**
 * Tests for the main ContactsPlugin class
 * 
 * Note: The main.ts file has istanbul ignore because it integrates
 * with Obsidian API and requires full app context. These tests verify the
 * structure and basic behavior patterns without full integration testing.
 */
describe('ContactsPlugin (main.ts)', () => {
  let plugin: ContactsPlugin;
  let mockApp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApp = {
      workspace: {
        on: vi.fn(),
        off: vi.fn(),
      },
      vault: {
        on: vi.fn(),
        off: vi.fn(),
        getMarkdownFiles: vi.fn().mockReturnValue([]),
      },
      metadataCache: {
        on: vi.fn(),
        off: vi.fn(),
      },
    };

    // Create plugin instance
    plugin = new ContactsPlugin(mockApp, { id: 'test', name: 'Test', version: '1.0.0' } as any);
  });

  describe('Plugin Structure', () => {
    it('should be an instance of Plugin', () => {
      expect(plugin).toBeInstanceOf(Plugin);
    });

    it('should have required properties after loading settings', async () => {
      // Load settings first
      await plugin.loadSettings();
      
      expect(plugin).toHaveProperty('settings');
      expect(plugin.settings).toBeDefined();
    });

    it('should have lifecycle methods', () => {
      expect(plugin).toHaveProperty('onload');
      expect(plugin).toHaveProperty('onunload');
      expect(plugin.onload).toBeInstanceOf(Function);
      expect(plugin.onunload).toBeInstanceOf(Function);
    });

    it('should have settings methods', () => {
      expect(plugin).toHaveProperty('loadSettings');
      expect(plugin).toHaveProperty('saveSettings');
      expect(plugin.loadSettings).toBeInstanceOf(Function);
      expect(plugin.saveSettings).toBeInstanceOf(Function);
    });
  });

  describe('Settings Management', () => {
    it('should load settings from storage', async () => {
      const mockData = { contactsFolder: 'Contacts', vcfWatchEnabled: true };
      plugin.loadData = vi.fn().mockResolvedValue(mockData);
      
      await plugin.loadSettings();
      
      expect(plugin.loadData).toHaveBeenCalled();
      expect(plugin.settings).toBeDefined();
    });

    it('should save settings to storage', async () => {
      plugin.saveData = vi.fn().mockResolvedValue(undefined);
      plugin.settings = { contactsFolder: 'Contacts' } as any;
      
      await plugin.saveSettings();
      
      expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
    });

    it('should merge loaded settings with defaults', async () => {
      const partialSettings = { contactsFolder: 'CustomContacts' };
      plugin.loadData = vi.fn().mockResolvedValue(partialSettings);
      
      await plugin.loadSettings();
      
      // Should have merged with defaults
      expect(plugin.settings).toBeDefined();
      expect(plugin.settings.contactsFolder).toBe('CustomContacts');
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should have onload method', () => {
      expect(typeof plugin.onload).toBe('function');
    });

    it('should have onunload method', () => {
      expect(typeof plugin.onunload).toBe('function');
    });

    it('should handle onunload cleanup', () => {
      // Set up some internal state with spies
      const stopSpy = vi.fn();
      const cleanupSpy = vi.fn();
      const cleanupListenersSpy = vi.fn();
      
      (plugin as any).syncWatcher = { stop: stopSpy };
      (plugin as any).vcfDropCleanup = cleanupSpy;
      (plugin as any).contactManager = { cleanupEventListeners: cleanupListenersSpy };
      
      plugin.onunload();
      
      // Verify cleanup was called
      expect(stopSpy).toHaveBeenCalled();
      expect(cleanupSpy).toHaveBeenCalled();
      expect(cleanupListenersSpy).toHaveBeenCalled();
    });

    it('should set cleanup properties to null on unload', () => {
      (plugin as any).syncWatcher = { stop: vi.fn() };
      (plugin as any).vcfDropCleanup = vi.fn();
      (plugin as any).contactManager = { cleanupEventListeners: vi.fn() };
      (plugin as any).curatorManager = {};
      
      plugin.onunload();
      
      expect((plugin as any).syncWatcher).toBeNull();
      expect((plugin as any).vcfDropCleanup).toBeNull();
      expect((plugin as any).contactManager).toBeNull();
      expect((plugin as any).curatorManager).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing syncWatcher gracefully on unload', () => {
      (plugin as any).syncWatcher = null;
      
      expect(() => plugin.onunload()).not.toThrow();
    });

    it('should handle missing contactManager gracefully on unload', () => {
      (plugin as any).contactManager = null;
      
      expect(() => plugin.onunload()).not.toThrow();
    });

    it('should handle missing vcfDropCleanup gracefully on unload', () => {
      (plugin as any).vcfDropCleanup = null;
      
      expect(() => plugin.onunload()).not.toThrow();
    });

    it('should handle missing curatorManager gracefully on unload', () => {
      (plugin as any).curatorManager = null;
      
      expect(() => plugin.onunload()).not.toThrow();
    });
  });
});
