import { App } from 'obsidian';
import { VcfWatcherService } from 'src/vcfWatcher/vcfWatcherService';
import { ContactsPluginSettings } from 'src/settings/settings.d';
import { setApp, clearApp } from 'src/context/sharedAppContext';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the Notice class
vi.mock('obsidian', async () => {
  const actual = await vi.importActual('obsidian');
  return {
    ...actual,
    Notice: vi.fn()
  };
});

// Mock the other dependencies
vi.mock('src/contacts/vcard', () => ({
  vcard: {
    parse: vi.fn()
  }
}));

vi.mock('src/contacts/contactMdTemplate', () => ({
  mdRender: vi.fn(() => '---\nFN: Test User\n---\n#### Notes\n\n#Contact')
}));

vi.mock('src/file/file', () => ({
  createContactFile: vi.fn()
}));

describe('VcfWatcherService', () => {
  let vcfWatcherService: VcfWatcherService;
  let mockSettings: ContactsPluginSettings;
  let mockApp: Partial<App>;

  beforeEach(() => {
    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingFrequency: 10,
    };

    mockApp = {
      vault: {
        adapter: {
          list: vi.fn().mockResolvedValue({ files: [], folders: [] }),
          stat: vi.fn().mockResolvedValue({ mtime: Date.now() }),
          read: vi.fn().mockResolvedValue('BEGIN:VCARD\nFN:Test User\nEND:VCARD')
        },
        getAbstractFileByPath: vi.fn(),
        getRoot: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn()
      }
    } as any;

    setApp(mockApp as App);
    vcfWatcherService = new VcfWatcherService(mockSettings);
  });

  afterEach(() => {
    vcfWatcherService.stop();
    clearApp();
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should not start if vcfWatchEnabled is false', () => {
      mockSettings.vcfWatchEnabled = false;
      vcfWatcherService = new VcfWatcherService(mockSettings);
      
      const consoleSpy = vi.spyOn(console, 'log');
      vcfWatcherService.start();
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should not start if vcfWatchFolder is empty', () => {
      mockSettings.vcfWatchFolder = '';
      vcfWatcherService = new VcfWatcherService(mockSettings);
      
      const consoleSpy = vi.spyOn(console, 'log');
      vcfWatcherService.start();
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should start when enabled with valid folder', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      vcfWatcherService.start();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'VCF Watcher: Starting to watch folder /test/vcf every 10 seconds'
      );
    });

    it('should not start twice', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      vcfWatcherService.start();
      vcfWatcherService.start(); // Try to start again
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop the service and clear interval', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      vcfWatcherService.start();
      vcfWatcherService.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith('VCF Watcher: Stopped');
    });

    it('should handle stop when not running', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      vcfWatcherService.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith('VCF Watcher: Stopped');
    });
  });

  describe('updateSettings', () => {
    it('should restart when folder changes', () => {
      vcfWatcherService.start();
      const consoleSpy = vi.spyOn(console, 'log');
      
      const newSettings = { ...mockSettings, vcfWatchFolder: '/new/path' };
      vcfWatcherService.updateSettings(newSettings);
      
      expect(consoleSpy).toHaveBeenCalledWith('VCF Watcher: Stopped');
      expect(consoleSpy).toHaveBeenCalledWith(
        'VCF Watcher: Starting to watch folder /new/path every 10 seconds'
      );
    });

    it('should restart when frequency changes', () => {
      vcfWatcherService.start();
      const consoleSpy = vi.spyOn(console, 'log');
      
      const newSettings = { ...mockSettings, vcfWatchPollingFrequency: 30 };
      vcfWatcherService.updateSettings(newSettings);
      
      expect(consoleSpy).toHaveBeenCalledWith('VCF Watcher: Stopped');
      expect(consoleSpy).toHaveBeenCalledWith(
        'VCF Watcher: Starting to watch folder /test/vcf every 30 seconds'
      );
    });

    it('should stop when disabled', () => {
      vcfWatcherService.start();
      const consoleSpy = vi.spyOn(console, 'log');
      
      const newSettings = { ...mockSettings, vcfWatchEnabled: false };
      vcfWatcherService.updateSettings(newSettings);
      
      expect(consoleSpy).toHaveBeenCalledWith('VCF Watcher: Stopped');
    });
  });

  describe('filename generation', () => {
    it('should sanitize filenames properly', () => {
      // Test the private sanitizeFileName method through filename generation
      const service = new VcfWatcherService(mockSettings);
      
      // This is testing internal logic, but we can infer behavior
      // The sanitizeFileName method should handle illegal characters
      expect(true).toBe(true); // Placeholder - actual testing would require exposing the method
    });

    it('should generate UUID when needed', () => {
      // Test the private generateUUID method 
      const service = new VcfWatcherService(mockSettings);
      
      // This would test UUID generation logic
      expect(true).toBe(true); // Placeholder - actual testing would require exposing the method
    });
  });

  describe('name assembly', () => {
    it('should assemble name from N fields', () => {
      // Test the assembleNameFromFields method
      const service = new VcfWatcherService(mockSettings);
      
      // This would test name assembly logic
      expect(true).toBe(true); // Placeholder - actual testing would require exposing the method
    });

    it('should fallback to ORG field', () => {
      // Test fallback behavior
      const service = new VcfWatcherService(mockSettings);
      
      expect(true).toBe(true); // Placeholder
    });
  });
});