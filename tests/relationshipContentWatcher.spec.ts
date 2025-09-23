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
    getAllContactIds: vi.fn(() => ['name:Alice Smith', 'name:Bob Wilson']),
    getContactNode: vi.fn((id) => {
      if (id === 'name:Alice Smith') {
        return { fullName: 'Alice Smith', uid: '12345' };
      }
      if (id === 'name:Bob Wilson') {
        return { fullName: 'Bob Wilson', uid: '67890' };
      }
      return null;
    }),
    syncAllContactsWithFrontMatter: vi.fn(),
    verifyAndAddMissingBacklinks: vi.fn()
  }
}));

vi.mock('src/util/revDebouncer', () => ({
  revDebouncer: {
    cancelAllUpdates: vi.fn()
  }
}));

vi.mock('src/util/relationshipMarkdown', () => ({
  findRelatedHeading: vi.fn((content) => {
    if (content.includes('## Related')) {
      return {
        found: true,
        content: '- friend [[Alice Smith]]\n- colleague [[Bob Wilson]]'
      };
    }
    return { found: false, content: '' };
  }),
  parseRelationshipList: vi.fn((content) => [
    { relationship: 'friend', contactName: 'Alice Smith' },
    { relationship: 'colleague', contactName: 'Bob Wilson' }
  ]),
  updateRelatedSection: vi.fn(),
  cleanupRelatedHeading: vi.fn()
}));

vi.mock('src/util/relationshipFrontMatter', () => ({
  parseRelatedFromFrontMatter: vi.fn(() => []),
  updateContactRelatedFrontMatter: vi.fn(),
  loadContactIntoGraph: vi.fn(() => 'name:Test Contact'),
  getContactUidFromFrontMatter: vi.fn(() => '12345'),
  getContactFullNameFromFrontMatter: vi.fn(() => 'Test Contact')
}));

describe('Relationship Content Watching', () => {
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
        read: vi.fn(() => Promise.resolve(`
# Test Contact

## Related

- friend [[Alice Smith]]
- colleague [[Bob Wilson]]
        `)),
        modify: vi.fn(),
        getMarkdownFiles: vi.fn(() => [
          { path: 'alice.md', name: 'alice.md' },
          { path: 'bob.md', name: 'bob.md' }
        ])
      },
      metadataCache: {
        getFileCache: vi.fn((file) => ({
          frontmatter: {
            FN: file.path.includes('alice') ? 'Alice Smith' : 'Bob Wilson',
            UID: file.path.includes('alice') ? '12345' : '67890'
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

  it('should register file modify event listener', () => {
    eventManager.start();

    expect(mockApp.vault.on).toHaveBeenCalledWith('modify', expect.any(Function));
  });

  it('should debounce file modifications to avoid excessive processing', async () => {
    const mockIsContactFile = vi.fn(() => true);
    const mockProcessRelatedListChanges = vi.fn();
    
    (eventManager as any).isContactFile = mockIsContactFile;
    (eventManager as any).processRelatedListChanges = mockProcessRelatedListChanges;

    const testFile = { path: 'test-contact.md', name: 'test-contact.md' };

    // Simulate rapid file modifications
    await (eventManager as any).handleFileModify(testFile);
    await (eventManager as any).handleFileModify(testFile);
    await (eventManager as any).handleFileModify(testFile);

    // Should not process immediately
    expect(mockProcessRelatedListChanges).not.toHaveBeenCalled();

    // Fast-forward past debounce time
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    // Should only process once after debounce
    expect(mockProcessRelatedListChanges).toHaveBeenCalledTimes(1);
    expect(mockProcessRelatedListChanges).toHaveBeenCalledWith(testFile);
  });

  it('should parse Related list and sync valid relationships to front matter', async () => {
    const mockIsContactFile = vi.fn(() => true);
    (eventManager as any).isContactFile = mockIsContactFile;

    const testFile = { path: 'test-contact.md', name: 'test-contact.md' };

    await (eventManager as any).processRelatedListChanges(testFile);

    const { updateContactRelatedFrontMatter } = await import('src/util/relationshipFrontMatter');
    expect(updateContactRelatedFrontMatter).toHaveBeenCalledWith(
      testFile,
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'friend',
          target: 'name:Alice Smith'
        }),
        expect.objectContaining({
          kind: 'colleague',
          target: 'name:Bob Wilson'
        })
      ])
    );
  });

  it('should find contact ID by name from graph and vault', async () => {
    const contactId = await (eventManager as any).findContactIdByName('Alice Smith');
    expect(contactId).toBe('name:Alice Smith');

    const unknownContactId = await (eventManager as any).findContactIdByName('Unknown Person');
    expect(unknownContactId).toBe(null);
  });

  it('should detect changes between current and updated relationships', () => {
    const current = [
      { kind: 'friend', target: 'name:Alice Smith', key: 'RELATED[friend]' }
    ];
    
    const updated = [
      { kind: 'friend', target: 'name:Alice Smith', key: '' },
      { kind: 'colleague', target: 'name:Bob Wilson', key: '' }
    ];

    const hasChanges = (eventManager as any).relationshipsChanged(current, updated);
    expect(hasChanges).toBe(true);

    // Test no changes
    const noChanges = (eventManager as any).relationshipsChanged(current, current);
    expect(noChanges).toBe(false);
  });

  it('should clean up debounce timers on stop', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    
    eventManager.start();
    
    // Simulate some pending timers
    (eventManager as any).modifyDebounceTimers.set('file1.md', 123);
    (eventManager as any).modifyDebounceTimers.set('file2.md', 456);
    
    eventManager.stop();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(456);
    expect((eventManager as any).modifyDebounceTimers.size).toBe(0);
  });
});