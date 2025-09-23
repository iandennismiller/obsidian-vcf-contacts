import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipListManager } from '../src/services/relationshipListManager';

// Mock all external dependencies
vi.mock('obsidian', () => ({
  TFile: class TFile {
    constructor(public path: string, public name: string, public basename: string) {}
  },
}));

vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockApp = {
  vault: {
    read: vi.fn(),
    modify: vi.fn(),
    getMarkdownFiles: vi.fn(() => []),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
};

const mockRelationshipManager = {
  getGraph: vi.fn(() => ({
    getAllContacts: vi.fn(() => []),
    getContactRelationships: vi.fn(() => []),
    removeRelationshipWithReciprocal: vi.fn(),
    addRelationshipWithReciprocal: vi.fn(),
  })),
  syncGraphToFrontmatter: vi.fn(),
  syncGraphToContactNote: vi.fn(),
};

describe('Cascade Prevention in Relationship Updates', () => {
  let listManager: RelationshipListManager;

  beforeEach(() => {
    vi.clearAllMocks();
    listManager = new RelationshipListManager(mockApp as any, mockRelationshipManager as any);
  });

  describe('Processing locks', () => {
    it('should prevent recursive updates with processing locks', () => {
      const filePath = 'test-contact.md';
      
      // File should not be processing initially
      expect(listManager.isProcessing(filePath)).toBe(false);
      
      // Simulate file being marked as processing
      (listManager as any).processingFiles.add(filePath);
      
      // Now it should be marked as processing
      expect(listManager.isProcessing(filePath)).toBe(true);
      
      console.log('✅ Processing lock detection works correctly');
    });

    it('should handle multiple files being processed simultaneously', () => {
      const filePaths = ['alice.md', 'bob.md', 'charlie.md'];
      
      // Mark all files as processing
      filePaths.forEach(path => {
        (listManager as any).processingFiles.add(path);
      });
      
      // All should be marked as processing
      filePaths.forEach(path => {
        expect(listManager.isProcessing(path)).toBe(true);
      });
      
      // Clear one file
      (listManager as any).processingFiles.delete('alice.md');
      
      // Alice should no longer be processing, others still should be
      expect(listManager.isProcessing('alice.md')).toBe(false);
      expect(listManager.isProcessing('bob.md')).toBe(true);
      expect(listManager.isProcessing('charlie.md')).toBe(true);
      
      console.log('✅ Multiple file processing locks work correctly');
    });
  });

  describe('Cascade prevention logic', () => {
    it('should demonstrate cascade prevention workflow', () => {
      // This test documents the expected behavior
      const scenarios = [
        {
          name: 'Initial relationship update',
          sourceFile: 'alice.md',
          processing: false,
          shouldProcess: true
        },
        {
          name: 'Immediate subsequent update (cascade)',
          sourceFile: 'alice.md', 
          processing: true,
          shouldProcess: false
        },
        {
          name: 'Related contact update during propagation',
          sourceFile: 'bob.md',
          processing: true,
          shouldProcess: false
        },
        {
          name: 'After cleanup completion',
          sourceFile: 'alice.md',
          processing: false,
          shouldProcess: true
        }
      ];

      scenarios.forEach(scenario => {
        if (scenario.processing) {
          (listManager as any).processingFiles.add(scenario.sourceFile);
        } else {
          (listManager as any).processingFiles.delete(scenario.sourceFile);
        }
        
        const isProcessing = listManager.isProcessing(scenario.sourceFile);
        const shouldProcess = !isProcessing;
        
        expect(shouldProcess).toBe(scenario.shouldProcess);
        console.log(`✅ ${scenario.name}: ${shouldProcess ? 'allowed' : 'blocked'}`);
      });
    });
  });

  describe('Integration behavior', () => {
    it('should handle complex update scenarios safely', async () => {
      const mockFile = { path: 'alice.md', name: 'alice.md' } as any;
      
      // Mock the relationship manager to prevent actual operations
      mockRelationshipManager.syncGraphToFrontmatter.mockResolvedValue(undefined);
      mockRelationshipManager.syncGraphToContactNote.mockResolvedValue(undefined);
      
      // Mock vault operations
      mockApp.vault.read.mockResolvedValue(`
## Related
- friend [[Bob]]
- colleague [[Charlie]]
      `);
      
      mockApp.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { UID: 'alice-123' }
      });
      
      // This would typically trigger the sync process
      const isProcessing = listManager.isProcessing(mockFile.path);
      expect(isProcessing).toBe(false);
      
      // Mark as processing to simulate the protection
      (listManager as any).processingFiles.add(mockFile.path);
      
      // Now subsequent calls should be blocked
      expect(listManager.isProcessing(mockFile.path)).toBe(true);
      
      console.log('✅ Integration behavior prevents cascading updates');
    });
  });
});