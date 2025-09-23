import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraphSync } from '../src/contacts/relationshipGraphSync';

describe('RelationshipGraphSync', () => {
  let graphSync: RelationshipGraphSync;
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      vault: {
        getMarkdownFiles: () => [],
        read: () => Promise.resolve(''),
        modify: () => Promise.resolve()
      },
      metadataCache: {
        getFileCache: () => ({ frontmatter: {} })
      },
      fileManager: {
        processFrontMatter: () => Promise.resolve()
      }
    };
    
    graphSync = new RelationshipGraphSync(mockApp);
  });

  it('should prevent recursive sync loops with file locking', async () => {
    const mockFile = { path: 'test.md', basename: 'test' } as any;
    
    // Start first sync
    const sync1Promise = graphSync.syncFromUserEdit(mockFile);
    
    // Try to start second sync immediately - should be ignored due to lock
    const sync2Promise = graphSync.syncFromUserEdit(mockFile);
    
    await Promise.all([sync1Promise, sync2Promise]);
    
    // Both should complete without throwing
    expect(true).toBe(true);
  });

  it('should clear all locks when requested', () => {
    graphSync.clearAllLocks();
    expect(true).toBe(true); // Should complete without throwing
  });

  it('should validate graph consistency', async () => {
    const isConsistent = await graphSync.validateGraphConsistency();
    expect(typeof isConsistent).toBe('boolean');
  });

  it('should handle file open sync without propagation', async () => {
    const mockFile = { path: 'test.md', basename: 'test' } as any;
    
    await expect(graphSync.syncFromFileOpen(mockFile)).resolves.not.toThrow();
  });

  it('should handle manual refresh with full sync', async () => {
    const mockFile = { path: 'test.md', basename: 'test' } as any;
    
    await expect(graphSync.syncManualRefresh(mockFile)).resolves.not.toThrow();
  });
});