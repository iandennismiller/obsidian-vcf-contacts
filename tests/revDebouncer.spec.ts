import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RevDebouncer } from 'src/util/revDebouncer';

// Mock the dependencies
vi.mock('src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => ({
    vault: {
      read: vi.fn(),
      modify: vi.fn()
    },
    metadataCache: {
      getFileCache: vi.fn()
    }
  }))
}));

vi.mock('src/contacts/contactFrontmatter', () => ({
  updateFrontMatterValue: vi.fn()
}));

describe('RevDebouncer', () => {
  let debouncer: RevDebouncer;
  let mockFile: any;

  beforeEach(() => {
    vi.useFakeTimers();
    debouncer = new RevDebouncer(100); // 100ms debounce time for testing
    mockFile = {
      path: 'test-contact.md',
      name: 'test-contact.md'
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    debouncer.cancelAllUpdates();
  });

  it('should schedule REV update with debouncing', () => {
    debouncer.scheduleRevUpdate(mockFile);
    
    expect(debouncer.getPendingUpdates()).toContain('test-contact.md');
  });

  it('should cancel existing update when scheduling new one', () => {
    debouncer.scheduleRevUpdate(mockFile);
    debouncer.scheduleRevUpdate(mockFile);
    
    // Should still only have one pending update
    expect(debouncer.getPendingUpdates()).toHaveLength(1);
  });

  it('should cancel specific update', () => {
    debouncer.scheduleRevUpdate(mockFile);
    expect(debouncer.getPendingUpdates()).toContain('test-contact.md');
    
    debouncer.cancelRevUpdate(mockFile);
    expect(debouncer.getPendingUpdates()).not.toContain('test-contact.md');
  });

  it('should cancel all updates', () => {
    const mockFile2 = { path: 'contact2.md', name: 'contact2.md' };
    
    debouncer.scheduleRevUpdate(mockFile);
    debouncer.scheduleRevUpdate(mockFile2);
    
    expect(debouncer.getPendingUpdates()).toHaveLength(2);
    
    debouncer.cancelAllUpdates();
    expect(debouncer.getPendingUpdates()).toHaveLength(0);
  });

  it('should execute REV update after debounce time', async () => {
    const { updateFrontMatterValue } = await import('src/contacts/contactFrontmatter');
    
    debouncer.scheduleRevUpdate(mockFile);
    
    // Fast-forward time
    vi.advanceTimersByTime(100);
    
    // Wait for async operations to complete
    await vi.runAllTimersAsync();
    
    expect(updateFrontMatterValue).toHaveBeenCalledWith(
      mockFile,
      'REV',
      expect.any(String)
    );
  });
});