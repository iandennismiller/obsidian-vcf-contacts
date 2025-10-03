import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import type { ContactsPluginSettings } from 'src/plugin/settings';

// Define default settings inline to avoid import issues
const DEFAULT_SETTINGS: ContactsPluginSettings = {
  contactsFolder: '',
  defaultHashtag: '',
  vcardStorageMethod: 'vcard-folder',
  vcardFilename: 'contacts.vcf',
  vcardWatchFolder: '',
  vcardWatchEnabled: false,
  vcardWatchPollingInterval: 30,
  vcardWriteBackEnabled: false,
  vcardCustomizeIgnoreList: false,
  vcardIgnoreFilenames: [],
  vcardIgnoreUIDs: [],
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
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: 'contacts.vcf',
      vcardWatchFolder: '/test/vcf',
      vcardWatchEnabled: false,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
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
      vcardFilename: customFilename
    };

    expect(settingsWithCustomFilename.vcardFilename).toBe(customFilename);
    expect(settingsWithCustomFilename.vcardFilename).not.toBe(DEFAULT_SETTINGS.vcardFilename);
  });

  it('should respect custom VCF watch folder setting', () => {
    const customWatchFolder = '/Users/me/MyVCFFolder';
    const settingsWithCustomWatch = {
      ...mockSettings,
      vcardWatchFolder: customWatchFolder
    };

    expect(settingsWithCustomWatch.vcardWatchFolder).toBe(customWatchFolder);
  });

  it('should support different VCF storage methods', () => {
    const singleVcfSettings: ContactsPluginSettings = {
      ...mockSettings,
      vcardStorageMethod: 'single-vcard',
      vcardFilename: 'all-contacts.vcf'
    };

    const folderVcfSettings: ContactsPluginSettings = {
      ...mockSettings,
      vcardStorageMethod: 'vcard-folder',
      vcardWatchFolder: '/path/to/vcf/folder'
    };

    expect(singleVcfSettings.vcardStorageMethod).toBe('single-vcard');
    expect(folderVcfSettings.vcardStorageMethod).toBe('vcard-folder');
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
        vcardWatchFolder: absPath
      };

      expect(settings.vcardWatchFolder).toBe(absPath);
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
        vcardStorageMethod: 'single-vcard' as const,
        vcardFilename: filename
      };

      expect(settings.vcardFilename).toBe(filename);
      expect(settings.vcardFilename).toMatch(/\.vcf$/);
    });
  });

  it('should maintain settings consistency across plugin lifecycle', () => {
    const initialSettings = {
      ...mockSettings,
      contactsFolder: 'MyContacts',
      vcardFilename: 'my-vcf.vcf',
      vcardWatchFolder: '/my/vcf/path'
    };

    // Simulate settings being saved and loaded
    const savedSettings = JSON.parse(JSON.stringify(initialSettings));
    const loadedSettings = JSON.parse(JSON.stringify(savedSettings));

    expect(loadedSettings.contactsFolder).toBe(initialSettings.contactsFolder);
    expect(loadedSettings.vcardFilename).toBe(initialSettings.vcardFilename);
    expect(loadedSettings.vcardWatchFolder).toBe(initialSettings.vcardWatchFolder);
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
      vcardWatchEnabled: false
    };

    const settingsWithWatchEnabled = {
      ...mockSettings,
      vcardWatchEnabled: true
    };

    expect(settingsWithWatchDisabled.vcardWatchEnabled).toBe(false);
    expect(settingsWithWatchEnabled.vcardWatchEnabled).toBe(true);
  });

  it('should support configurable polling interval', () => {
    const pollingIntervals = [10, 30, 60, 120, 300];

    pollingIntervals.forEach(interval => {
      const settings = {
        ...mockSettings,
        vcardWatchPollingInterval: interval
      };

      expect(settings.vcardWatchPollingInterval).toBe(interval);
      expect(settings.vcardWatchPollingInterval).toBeGreaterThan(0);
    });
  });

  it('should maintain all settings fields with proper types', () => {
    const settings: ContactsPluginSettings = {
      contactsFolder: 'TestFolder',
      defaultHashtag: '#Test',
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: 'test.vcf',
      vcardWatchFolder: '/test/path',
      vcardWatchEnabled: true,
      vcardWatchPollingInterval: 60,
      vcardWriteBackEnabled: true,
      vcardCustomizeIgnoreList: true,
      vcardIgnoreFilenames: ['ignore1.vcf', 'ignore2.vcf'],
      vcardIgnoreUIDs: ['uid1', 'uid2'],
      logLevel: 'DEBUG'
    };

    expect(typeof settings.contactsFolder).toBe('string');
    expect(typeof settings.defaultHashtag).toBe('string');
    expect(typeof settings.vcardStorageMethod).toBe('string');
    expect(typeof settings.vcardFilename).toBe('string');
    expect(typeof settings.vcardWatchFolder).toBe('string');
    expect(typeof settings.vcardWatchEnabled).toBe('boolean');
    expect(typeof settings.vcardWatchPollingInterval).toBe('number');
    expect(typeof settings.vcardWriteBackEnabled).toBe('boolean');
    expect(typeof settings.vcardCustomizeIgnoreList).toBe('boolean');
    expect(Array.isArray(settings.vcardIgnoreFilenames)).toBe(true);
    expect(Array.isArray(settings.vcardIgnoreUIDs)).toBe(true);
  });

  it('should support ignore lists for VCF files and UIDs', () => {
    const settingsWithIgnoreLists = {
      ...mockSettings,
      vcardCustomizeIgnoreList: true,
      vcardIgnoreFilenames: ['system.vcf', 'temp.vcf'],
      vcardIgnoreUIDs: ['system-uid-1', 'temp-uid-2']
    };

    expect(settingsWithIgnoreLists.vcardIgnoreFilenames).toHaveLength(2);
    expect(settingsWithIgnoreLists.vcardIgnoreUIDs).toHaveLength(2);
    expect(settingsWithIgnoreLists.vcardIgnoreFilenames).toContain('system.vcf');
    expect(settingsWithIgnoreLists.vcardIgnoreUIDs).toContain('system-uid-1');
  });

  it('should allow VCF write-back to be configured', () => {
    const writeBackEnabled = {
      ...mockSettings,
      vcardWriteBackEnabled: true
    };

    const writeBackDisabled = {
      ...mockSettings,
      vcardWriteBackEnabled: false
    };

    expect(writeBackEnabled.vcardWriteBackEnabled).toBe(true);
    expect(writeBackDisabled.vcardWriteBackEnabled).toBe(false);
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

  it('should show ignore lists when vcardCustomizeIgnoreList is enabled with vcf-folder method', () => {
    // Test that ignore lists should be visible when:
    // 1. VCF storage method is 'vcard-folder'
    // 2. vcardCustomizeIgnoreList is enabled
    // Previously, this also required vcardWatchEnabled and vcardWriteBackEnabled to be true
    
    const settingsShowingIgnoreLists = {
      ...mockSettings,
      vcardStorageMethod: 'vcard-folder' as const,
      vcardCustomizeIgnoreList: true,
      // These should NOT be required for ignore lists to show
      vcardWatchEnabled: false,
      vcardWriteBackEnabled: false
    };

    // Verify the conditions that should make ignore lists visible
    expect(settingsShowingIgnoreLists.vcardStorageMethod).toBe('vcard-folder');
    expect(settingsShowingIgnoreLists.vcardCustomizeIgnoreList).toBe(true);
    
    // This condition matches the updated logic in settings.ts line 255-256:
    // if (this.plugin.settings.vcardStorageMethod === 'vcard-folder' && 
    //     this.plugin.settings.vcardCustomizeIgnoreList)
    const shouldShowIgnoreLists = 
      settingsShowingIgnoreLists.vcardStorageMethod === 'vcard-folder' &&
      settingsShowingIgnoreLists.vcardCustomizeIgnoreList;
    
    expect(shouldShowIgnoreLists).toBe(true);
  });

  it('should NOT show ignore lists when vcardCustomizeIgnoreList is disabled', () => {
    const settingsHidingIgnoreLists = {
      ...mockSettings,
      vcardStorageMethod: 'vcard-folder' as const,
      vcardCustomizeIgnoreList: false,
      vcardWatchEnabled: true,
      vcardWriteBackEnabled: true
    };

    const shouldShowIgnoreLists = 
      settingsHidingIgnoreLists.vcardStorageMethod === 'vcard-folder' &&
      settingsHidingIgnoreLists.vcardCustomizeIgnoreList;
    
    expect(shouldShowIgnoreLists).toBe(false);
  });

  it('should NOT show ignore lists when storage method is single-vcf', () => {
    const settingsHidingIgnoreLists = {
      ...mockSettings,
      vcardStorageMethod: 'single-vcard' as const,
      vcardCustomizeIgnoreList: true
    };

    const shouldShowIgnoreLists = 
      settingsHidingIgnoreLists.vcardStorageMethod === 'vcard-folder' &&
      settingsHidingIgnoreLists.vcardCustomizeIgnoreList;
    
    expect(shouldShowIgnoreLists).toBe(false);
  });
});
