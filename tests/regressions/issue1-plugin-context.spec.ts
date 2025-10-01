import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setSettings, getSettings, clearSettings } from 'src/plugin/context/sharedSettingsContext';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Regression Test for Issue 1: Plugin Context Not Set
 * 
 * Bug: Settings context was never initialized during plugin load, causing
 * "Plugin context has not been set" errors when curator processors called getSettings().
 * 
 * Fixed in: commit 9c7b558
 * 
 * This test ensures that:
 * 1. Settings context can be initialized with setSettings()
 * 2. Settings context can be retrieved with getSettings()
 * 3. Settings context can be cleared with clearSettings()
 * 4. getSettings() throws appropriate error when context not set
 */
describe('Regression: Plugin Context Not Set (Issue 1)', () => {
  const mockSettings: ContactsPluginSettings = {
    contactsFolder: 'Contacts',
    defaultHashtag: '#Contact',
    vcfStorageMethod: 'vcf-folder',
    vcfFilename: 'contacts.vcf',
    vcfWatchFolder: '/test/vcf',
    vcfWatchEnabled: true,
    vcfWatchPollingInterval: 30,
    vcfWriteBackEnabled: false,
    vcfCustomizeIgnoreList: false,
    vcfIgnoreFilenames: [],
    vcfIgnoreUIDs: [],
    relatedListProcessor: true,
    relatedFrontMatterProcessor: true
  } as any;

  beforeEach(() => {
    // Clear any existing context
    try {
      clearSettings();
    } catch (e) {
      // Ignore if already clear
    }
  });

  it('should throw error when getSettings called before setSettings', () => {
    expect(() => getSettings()).toThrow('Plugin context has not been set');
  });

  it('should successfully set and get settings context', () => {
    setSettings(mockSettings);
    const retrieved = getSettings();
    
    expect(retrieved).toBeDefined();
    expect(retrieved.contactsFolder).toBe('Contacts');
    expect(retrieved.relatedListProcessor).toBe(true);
  });

  it('should allow clearing settings context', () => {
    setSettings(mockSettings);
    expect(() => getSettings()).not.toThrow();
    
    clearSettings();
    expect(() => getSettings()).toThrow('Plugin context has not been set');
  });

  it('should allow updating settings after initial set', () => {
    setSettings(mockSettings);
    
    const updatedSettings = { ...mockSettings, contactsFolder: 'UpdatedContacts' };
    setSettings(updatedSettings);
    
    const retrieved = getSettings();
    expect(retrieved.contactsFolder).toBe('UpdatedContacts');
  });
});
