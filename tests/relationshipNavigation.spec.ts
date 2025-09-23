import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RelationshipEventManager } from 'src/services/relationshipEventManager';

// Mock dependencies
vi.mock('src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('src/services/relationshipGraph', () => ({
  relationshipGraphService: {
    syncAllContactsWithFrontMatter: vi.fn(),
    verifyAndAddMissingBacklinks: vi.fn()
  }
}));

vi.mock('src/util/revDebouncer', () => ({
  revDebouncer: {
    cancelAllUpdates: vi.fn()
  }
}));

describe('Relationship Navigation Event Handling', () => {
  let eventManager: RelationshipEventManager;
  let mockApp: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockApp = {
      workspace: {
        on: vi.fn(),
        offref: vi.fn(),
        getActiveViewOfType: vi.fn(() => ({
          file: { path: 'current-contact.md', name: 'current-contact.md' }
        }))
      },
      vault: {
        on: vi.fn(),
        read: vi.fn(() => 'mock content'),
        modify: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          frontmatter: {
            FN: 'Test Contact',
            UID: '12345'
          }
        }))
      }
    };

    eventManager = new RelationshipEventManager(mockApp);
  });

  afterEach(() => {
    vi.useRealTimers();
    eventManager.stop();
  });

  it('should register multiple event listeners for comprehensive navigation detection', () => {
    eventManager.start();

    // Should register Obsidian events
    expect(mockApp.workspace.on).toHaveBeenCalledWith('file-open', expect.any(Function));
    expect(mockApp.workspace.on).toHaveBeenCalledWith('active-leaf-change', expect.any(Function));
    expect(mockApp.workspace.on).toHaveBeenCalledWith('layout-change', expect.any(Function));
    expect(mockApp.workspace.on).toHaveBeenCalledWith('window-close', expect.any(Function));
    expect(mockApp.vault.on).toHaveBeenCalledWith('delete', expect.any(Function));
  });

  it('should start periodic sync check for missed navigation events', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    
    eventManager.start();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
  });

  it('should clean up all event listeners and intervals on stop', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    eventManager.start();
    eventManager.stop();

    expect(mockApp.workspace.offref).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should handle layout change events to detect navigation', async () => {
    const mockIsContactFile = vi.fn(() => true);
    const mockSyncRelatedListToFrontMatter = vi.fn();
    
    // Mock the private methods
    (eventManager as any).isContactFile = mockIsContactFile;
    (eventManager as any).syncRelatedListToFrontMatter = mockSyncRelatedListToFrontMatter;
    (eventManager as any).currentContactFile = { path: 'old-contact.md' };

    // Simulate layout change with different active file
    mockApp.workspace.getActiveViewOfType.mockReturnValue({
      file: { path: 'new-contact.md', name: 'new-contact.md' }
    });

    await (eventManager as any).handleLayoutChange();

    expect(mockSyncRelatedListToFrontMatter).toHaveBeenCalledWith({ path: 'old-contact.md' });
  });

  it('should handle popstate events (back/forward navigation) with delay', async () => {
    const mockIsContactFile = vi.fn(() => true);
    const mockSyncRelatedListToFrontMatter = vi.fn();
    
    (eventManager as any).isContactFile = mockIsContactFile;
    (eventManager as any).syncRelatedListToFrontMatter = mockSyncRelatedListToFrontMatter;
    (eventManager as any).currentContactFile = { path: 'old-contact.md' };

    // Mock different active file after navigation
    mockApp.workspace.getActiveViewOfType.mockReturnValue({
      file: { path: 'new-contact.md', name: 'new-contact.md' }
    });

    // Trigger popstate handler
    (eventManager as any).handlePopState();

    // Should not sync immediately
    expect(mockSyncRelatedListToFrontMatter).not.toHaveBeenCalled();

    // Fast-forward the setTimeout
    vi.advanceTimersByTime(100);
    
    // Wait for async operations
    await vi.runAllTimersAsync();

    expect(mockSyncRelatedListToFrontMatter).toHaveBeenCalledWith({ path: 'old-contact.md' });
  });

  it('should perform periodic sync check to catch missed events', async () => {
    const mockIsContactFile = vi.fn(() => true);
    const mockSyncRelatedListToFrontMatter = vi.fn();
    
    (eventManager as any).isContactFile = mockIsContactFile;
    (eventManager as any).syncRelatedListToFrontMatter = mockSyncRelatedListToFrontMatter;
    (eventManager as any).currentContactFile = { path: 'old-contact.md' };

    eventManager.start();

    // Mock active file change without triggering events
    mockApp.workspace.getActiveViewOfType.mockReturnValue({
      file: { path: 'new-contact.md', name: 'new-contact.md' }
    });

    // Fast-forward to trigger periodic check
    vi.advanceTimersByTime(2000);
    
    // Wait for async operations
    await vi.runAllTimersAsync();

    expect(mockSyncRelatedListToFrontMatter).toHaveBeenCalledWith({ path: 'old-contact.md' });
  });
});