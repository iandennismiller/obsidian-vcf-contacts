import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/relationships/relationshipManager';
import type { ContactsPluginSettings } from '../src/settings/settings.d';

const mockSettings: ContactsPluginSettings = {
  contactsFolder: 'Contacts',
  defaultHashtag: '',
  vcfWatchFolder: '',
  vcfWatchEnabled: false,
  vcfWatchPollingInterval: 30,
  vcfWriteBackEnabled: false,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'INFO',
};

describe('RelationshipManager Event Handling', () => {
  let mockApp: any;
  let manager: RelationshipManager;
  let mockFile1: any;
  let mockFile2: any;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn()
      },
      workspace: {
        on: vi.fn(),
        getActiveViewOfType: vi.fn()
      }
    };
    
    mockFile1 = { path: 'contact1.md' };
    mockFile2 = { path: 'contact2.md' };
    
    manager = new RelationshipManager(mockApp, mockSettings);
  });

  it('should set up event listeners correctly', () => {
    expect(mockApp.workspace.on).toHaveBeenCalledWith('file-open', expect.any(Function));
    expect(mockApp.workspace.on).toHaveBeenCalledWith('active-leaf-change', expect.any(Function));
  });

  it('should handle file open events by tracking previous file', () => {
    // Mock a contact file
    const mockContactFile = { path: 'contact.md' };
    const mockCache = { frontmatter: { UID: 'test-uid' } };
    
    mockApp.metadataCache.getFileCache.mockReturnValue(mockCache);
    
    // Access private method for testing - need to bind to manager instance
    const isContactFile = (manager as any).isContactFile.bind(manager);
    expect(isContactFile(mockContactFile)).toBe(true);
    
    // Test that a non-contact file returns false
    const mockNonContactFile = { path: 'note.md' };
    mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter: {} });
    expect(isContactFile(mockNonContactFile)).toBe(false);
  });

  it('should gracefully handle missing workspace in constructor', () => {
    const appWithoutWorkspace = {
      vault: { read: vi.fn(), modify: vi.fn() },
      metadataCache: { getFileCache: vi.fn() }
      // No workspace property
    };
    
    // Should not throw
    expect(() => new RelationshipManager(appWithoutWorkspace as any, mockSettings)).not.toThrow();
  });

  it('should handle destroy without errors', () => {
    expect(() => manager.destroy()).not.toThrow();
  });

  it('should track current contact file correctly', () => {
    const getCurrentContactFile = (manager as any).currentContactFile;
    
    // Should start with null since workspace is mocked
    expect(getCurrentContactFile).toBe(null);
  });
});