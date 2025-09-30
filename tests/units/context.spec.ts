import { App } from "obsidian";
import { clearApp,getApp, setApp } from '../../src/plugin/context/sharedAppContext'
import {
  clearSettings,
  getSettings,
  onSettingsChange,
  setSettings,
} from '../../src/plugin/context/sharedSettingsContext';
import type { ContactsPluginSettings } from 'src/plugin/settings';
import { afterEach,describe, expect, it, vi } from 'vitest';

const mockSettings: ContactsPluginSettings = {
  contactsFolder: 'Contacts',
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
  enableSync: true,
  logLevel: 'INFO',
};

describe('sharedSppContext', () => {
  afterEach(() => clearApp());

  it('stores and retrieves the app instance', () => {
    const mockApp = { vault: { name: 'test' }, workspace: { activeLeaf: true } } as unknown as App;
    setApp(mockApp);
    const retrieved = getApp();
    expect(retrieved).toBe(mockApp);
  });

  it('throws if app is not set', () => {
    expect(() => getApp()).toThrow('App context has not been set.');
  });
});

describe('sharedSettingsContext', () => {
  afterEach(() => {
    clearSettings();
  });

  it('stores and retrieves the settings', () => {
    setSettings(mockSettings);
    const retrieved = getSettings();
    expect(retrieved).toBe(mockSettings);
  });

  it('throws if settings are not set', () => {
    expect(() => getSettings()).toThrow('Plugin context has not been set.');
  });

  it('calls listeners when settings are updated', () => {
    const listener = vi.fn();
    onSettingsChange(listener);

    setSettings(mockSettings);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(mockSettings);
  });

  it('removes listener when unsubscribe is called', () => {
    const listener = vi.fn();
    const unsubscribe = onSettingsChange(listener);

    unsubscribe();
    setSettings(mockSettings);
    expect(listener).not.toHaveBeenCalled();
  });

  it('clears listeners and settings', () => {
    const listener = vi.fn();
    onSettingsChange(listener);

    setSettings(mockSettings);
    clearSettings();

    expect(() => getSettings()).toThrow();
    setSettings(mockSettings);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
