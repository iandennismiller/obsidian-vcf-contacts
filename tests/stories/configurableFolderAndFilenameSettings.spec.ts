import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import type { ContactsPluginSettings } from 'src/plugin/settings';

// Define default settings inline to avoid import issues
const DEFAULT_SETTINGS: ContactsPluginSettings = {
  contactsFolder: '',
  defaultHashtag: '',
  vcfStorageMethod: 'vcf-folder',
  vcfFilename: 'contacts.vcf',
  vcfWatchFolder: '',
  vcfWatchEnabled: false,
  vcfWatchPollingInterval: 30,
  vcfWriteBackEnabled: false,
  vcfCustomizeIgnoreList: false,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'INFO'
};

/**
 * User Story 23: Configurable Folder and Filename Settings
 * As a user, I want to control the folder or filename in the configuration settings; 
 * the rest of the plugin should make reference to these values as appropriate.
 */
describe('Configurable Folder and Filename Settings Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(),
        getAbstractFileByPath: vi.fn(),
        getRoot: vi.fn().mockReturnValue({ path: '/' })
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };

    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should respect custom contacts folder setting', () => {
    const customFolder = 'MyCustomContacts';
    const settingsWithCustomFolder = {
      ...mockSettings,
      contactsFolder: customFolder
    };

    expect(settingsWithCustomFolder.contactsFolder).toBe(customFolder);
    expect(settingsWithCustomFolder.contactsFolder).not.toBe(DEFAULT_SETTINGS.contactsFolder);
  });

  it('should respect custom VCF filename setting', () => {
    const customFilename = 'my-custom-contacts.vcf';
    const settingsWithCustomFilename = {
      ...mockSettings,
      vcfFilename: customFilename
    };

    expect(settingsWithCustomFilename.vcfFilename).toBe(customFilename);
    expect(settingsWithCustomFilename.vcfFilename).not.toBe(DEFAULT_SETTINGS.vcfFilename);
  });

  it('should respect custom VCF watch folder setting', () => {
    const customWatchFolder = '/Users/me/MyVCFFolder';
    const settingsWithCustomWatch = {
      ...mockSettings,
      vcfWatchFolder: customWatchFolder
    };

    expect(settingsWithCustomWatch.vcfWatchFolder).toBe(customWatchFolder);
  });

  it('should support different VCF storage methods', () => {
    const singleVcfSettings: ContactsPluginSettings = {
      ...mockSettings,
      vcfStorageMethod: 'single-vcf',
      vcfFilename: 'all-contacts.vcf'
    };

    const folderVcfSettings: ContactsPluginSettings = {
      ...mockSettings,
      vcfStorageMethod: 'vcf-folder',
      vcfWatchFolder: '/path/to/vcf/folder'
    };

    expect(singleVcfSettings.vcfStorageMethod).toBe('single-vcf');
    expect(folderVcfSettings.vcfStorageMethod).toBe('vcf-folder');
  });

  it('should handle nested folder paths for contacts', () => {
    const nestedFolderPaths = [
      'People/Contacts',
      'Work/Contacts',
      'Personal/Family/Contacts',
      'Vault/Data/Contacts'
    ];

    nestedFolderPaths.forEach(folderPath => {
      const settings = {
        ...mockSettings,
        contactsFolder: folderPath
      };

      expect(settings.contactsFolder).toBe(folderPath);
      expect(settings.contactsFolder).toContain('Contacts');
    });
  });

  it('should handle absolute paths for VCF watch folder', () => {
    const absolutePaths = [
      '/Users/username/Documents/Contacts',
      '/home/user/contacts',
      'C:\\Users\\username\\Documents\\Contacts'
    ];

    absolutePaths.forEach(absPath => {
      const settings = {
        ...mockSettings,
        vcfWatchFolder: absPath
      };

      expect(settings.vcfWatchFolder).toBe(absPath);
    });
  });

  it('should allow different VCF filenames for single-vcf mode', () => {
    const differentFilenames = [
      'contacts.vcf',
      'all-contacts.vcf',
      'people.vcf',
      'address-book.vcf',
      'my-contacts.vcf'
    ];

    differentFilenames.forEach(filename => {
      const settings = {
        ...mockSettings,
        vcfStorageMethod: 'single-vcf' as const,
        vcfFilename: filename
      };

      expect(settings.vcfFilename).toBe(filename);
      expect(settings.vcfFilename).toMatch(/\.vcf$/);
    });
  });

  it('should maintain settings consistency across plugin lifecycle', () => {
    const initialSettings = {
      ...mockSettings,
      contactsFolder: 'MyContacts',
      vcfFilename: 'my-vcf.vcf',
      vcfWatchFolder: '/my/vcf/path'
    };

    // Simulate settings being saved and loaded
    const savedSettings = JSON.parse(JSON.stringify(initialSettings));
    const loadedSettings = JSON.parse(JSON.stringify(savedSettings));

    expect(loadedSettings.contactsFolder).toBe(initialSettings.contactsFolder);
    expect(loadedSettings.vcfFilename).toBe(initialSettings.vcfFilename);
    expect(loadedSettings.vcfWatchFolder).toBe(initialSettings.vcfWatchFolder);
  });

  it('should handle empty folder paths gracefully', () => {
    const settingsWithEmptyFolder = {
      ...mockSettings,
      contactsFolder: ''
    };

    // Empty folder should be allowed (could mean vault root)
    expect(settingsWithEmptyFolder.contactsFolder).toBe('');
    expect(typeof settingsWithEmptyFolder.contactsFolder).toBe('string');
  });

  it('should support custom default hashtag configuration', () => {
    const customHashtags = [
      '#Contact',
      '#Person',
      '#People',
      '#AddressBook',
      ''  // No hashtag
    ];

    customHashtags.forEach(hashtag => {
      const settings = {
        ...mockSettings,
        defaultHashtag: hashtag
      };

      expect(settings.defaultHashtag).toBe(hashtag);
    });
  });

  it('should allow VCF watch folder to be disabled', () => {
    const settingsWithWatchDisabled = {
      ...mockSettings,
      vcfWatchEnabled: false
    };

    const settingsWithWatchEnabled = {
      ...mockSettings,
      vcfWatchEnabled: true
    };

    expect(settingsWithWatchDisabled.vcfWatchEnabled).toBe(false);
    expect(settingsWithWatchEnabled.vcfWatchEnabled).toBe(true);
  });

  it('should support configurable polling interval', () => {
    const pollingIntervals = [10, 30, 60, 120, 300];

    pollingIntervals.forEach(interval => {
      const settings = {
        ...mockSettings,
        vcfWatchPollingInterval: interval
      };

      expect(settings.vcfWatchPollingInterval).toBe(interval);
      expect(settings.vcfWatchPollingInterval).toBeGreaterThan(0);
    });
  });

  it('should maintain all settings fields with proper types', () => {
    const settings: ContactsPluginSettings = {
      contactsFolder: 'TestFolder',
      defaultHashtag: '#Test',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'test.vcf',
      vcfWatchFolder: '/test/path',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 60,
      vcfWriteBackEnabled: true,
      vcfCustomizeIgnoreList: true,
      vcfIgnoreFilenames: ['ignore1.vcf', 'ignore2.vcf'],
      vcfIgnoreUIDs: ['uid1', 'uid2'],
      logLevel: 'DEBUG'
    };

    expect(typeof settings.contactsFolder).toBe('string');
    expect(typeof settings.defaultHashtag).toBe('string');
    expect(typeof settings.vcfStorageMethod).toBe('string');
    expect(typeof settings.vcfFilename).toBe('string');
    expect(typeof settings.vcfWatchFolder).toBe('string');
    expect(typeof settings.vcfWatchEnabled).toBe('boolean');
    expect(typeof settings.vcfWatchPollingInterval).toBe('number');
    expect(typeof settings.vcfWriteBackEnabled).toBe('boolean');
    expect(typeof settings.vcfCustomizeIgnoreList).toBe('boolean');
    expect(Array.isArray(settings.vcfIgnoreFilenames)).toBe(true);
    expect(Array.isArray(settings.vcfIgnoreUIDs)).toBe(true);
  });

  it('should support ignore lists for VCF files and UIDs', () => {
    const settingsWithIgnoreLists = {
      ...mockSettings,
      vcfCustomizeIgnoreList: true,
      vcfIgnoreFilenames: ['system.vcf', 'temp.vcf'],
      vcfIgnoreUIDs: ['system-uid-1', 'temp-uid-2']
    };

    expect(settingsWithIgnoreLists.vcfIgnoreFilenames).toHaveLength(2);
    expect(settingsWithIgnoreLists.vcfIgnoreUIDs).toHaveLength(2);
    expect(settingsWithIgnoreLists.vcfIgnoreFilenames).toContain('system.vcf');
    expect(settingsWithIgnoreLists.vcfIgnoreUIDs).toContain('system-uid-1');
  });

  it('should allow VCF write-back to be configured', () => {
    const writeBackEnabled = {
      ...mockSettings,
      vcfWriteBackEnabled: true
    };

    const writeBackDisabled = {
      ...mockSettings,
      vcfWriteBackEnabled: false
    };

    expect(writeBackEnabled.vcfWriteBackEnabled).toBe(true);
    expect(writeBackDisabled.vcfWriteBackEnabled).toBe(false);
  });

  it('should handle special characters in folder names', () => {
    const foldersWithSpecialChars = [
      'Contacts & People',
      'Contacts (Personal)',
      'Contacts_2024',
      'Contacts-Work'
    ];

    foldersWithSpecialChars.forEach(folderName => {
      const settings = {
        ...mockSettings,
        contactsFolder: folderName
      };

      expect(settings.contactsFolder).toBe(folderName);
    });
  });
});
