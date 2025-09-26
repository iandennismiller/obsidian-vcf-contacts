import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactManager } from '../src/contacts/contactManager';
import { syncRelatedListToFrontmatter } from '../src/util/relatedListSync';

// Mock the dependencies
vi.mock('../src/util/relatedListSync', () => ({
  syncRelatedListToFrontmatter: vi.fn()
}));

vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    debug: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}));

// Mock Obsidian types
const mockApp = {
  metadataCache: {
    getFileCache: vi.fn()
  },
  workspace: {
    on: vi.fn(),
    offref: vi.fn()
  },
  vault: {
    getAbstractFileByPath: vi.fn(),
    getMarkdownFiles: vi.fn()
  }
} as any;

const mockSettings = {
  contactsFolder: '/Contacts'
} as any;

const mockFile = {
  path: '/Contacts/John Doe.md',
  basename: 'John Doe'
} as any;

const mockLeaf = {
  view: {
    file: mockFile
  }
} as any;

const mockMarkdownView = {
  file: mockFile
};

describe('ContactManager - Active Leaf Event Handling', () => {
  let contactManager: ContactManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock app responses
    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: { UID: 'test-uid-123' }
    });
    mockApp.vault.getMarkdownFiles.mockReturnValue([]);
    mockApp.workspace.on.mockReturnValue({ ref: 'mock-event-ref' });
    
    contactManager = new ContactManager(mockApp, mockSettings);
  });

  it('should setup and cleanup event listeners properly', () => {
    contactManager.setupEventListeners();
    
    expect(mockApp.workspace.on).toHaveBeenCalledWith(
      'active-leaf-change',
      expect.any(Function)
    );

    contactManager.cleanupEventListeners();
    
    expect(mockApp.workspace.offref).toHaveBeenCalledWith({ ref: 'mock-event-ref' });
  });

  it('should sync when navigating away from a contact file', async () => {
    // Mock the sync function to return success
    vi.mocked(syncRelatedListToFrontmatter).mockResolvedValue({
      success: true,
      errors: []
    });

    contactManager.setupEventListeners();
    
    // Get the event handler that was registered
    const eventHandler = mockApp.workspace.on.mock.calls[0][1];
    
    // Simulate being on a contact file first
    const mockLeafWithMarkdownView = {
      view: mockMarkdownView
    };
    
    eventHandler(mockLeafWithMarkdownView);
    
    // Now simulate navigating away to a different file
    const differentFile = { path: '/Contacts/Jane Doe.md', basename: 'Jane Doe' };
    const differentLeaf = {
      view: { file: differentFile }
    };
    
    eventHandler(differentLeaf);
    
    // Should have called sync for the previous file
    expect(syncRelatedListToFrontmatter).toHaveBeenCalledWith(
      mockApp,
      mockFile,
      '/Contacts'
    );
  });

  it('should not sync when navigating away from non-contact file', async () => {
    // Mock the file as not being a contact file
    mockApp.metadataCache.getFileCache.mockReturnValue({});
    
    contactManager.setupEventListeners();
    
    const eventHandler = mockApp.workspace.on.mock.calls[0][1];
    
    // Simulate being on a non-contact file
    eventHandler(mockLeaf);
    
    // Simulate navigating away
    eventHandler(null);
    
    // Should not call sync since it wasn't a contact file
    expect(syncRelatedListToFrontmatter).not.toHaveBeenCalled();
  });

  it('should handle non-MarkdownView properly', async () => {
    contactManager.setupEventListeners();
    
    const eventHandler = mockApp.workspace.on.mock.calls[0][1];
    
    // Simulate a leaf with a non-MarkdownView
    const nonMarkdownLeaf = {
      view: { /* no file property */ }
    };
    
    // Should not throw an error
    expect(() => eventHandler(nonMarkdownLeaf)).not.toThrow();
    
    expect(syncRelatedListToFrontmatter).not.toHaveBeenCalled();
  });
});