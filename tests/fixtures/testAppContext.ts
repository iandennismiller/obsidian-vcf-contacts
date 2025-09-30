import { vi } from 'vitest';
import { setApp, clearApp } from 'src/plugin/context/sharedAppContext';
import { setSettings } from 'src/plugin/context/sharedSettingsContext';

// Create a minimal mock app for tests
export function setupTestAppContext() {
  const mockApp = {
    workspace: {
      openFile: vi.fn(),
      getLeaf: vi.fn(),
      on: vi.fn(),
      offref: vi.fn()
    },
    vault: {
      recurseChildren: vi.fn(),
      read: vi.fn().mockResolvedValue(''),
      modify: vi.fn(),
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      getAbstractFileByPath: vi.fn()
    },
    metadataCache: {
      getFileCache: vi.fn().mockReturnValue({}),
      on: vi.fn(),
      offref: vi.fn()
    }
  } as any;

  const mockSettings = {
    contactsFolder: 'Contacts',
    vcfFolder: 'VCF'
  } as any;

  setApp(mockApp);
  setSettings(mockSettings);

  return { mockApp, mockSettings };
}

export function cleanupTestAppContext() {
  clearApp();
}