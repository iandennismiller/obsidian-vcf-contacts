/**
 * @fileoverview Tests for the Graphology-based relationship management system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipGraph, ContactNode } from '../src/contacts/relationshipGraph';
import { GraphYAMLMarkdownMapper } from '../src/contacts/graphYAMLMarkdownMapper';
import { GraphRelationshipManager } from '../src/contacts/graphRelationshipManager';

// Mock Obsidian App
const mockApp = {
  vault: {
    getMarkdownFiles: vi.fn(() => []),
    read: vi.fn(),
    modify: vi.fn(),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
} as any;

// Mock TFile
const createMockFile = (path: string, basename: string = 'test') => ({
  path,
  basename,
  extension: 'md',
} as any);

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph(mockApp);
  });

  describe('Basic Graph Operations', () => {
    it('should add contact nodes correctly', async () => {
      const file = createMockFile('john.md', 'John Doe');
      
      mockApp.metadataCache.getFileCache.mockReturnValue({
        frontmatter: {
          UID: 'urn:uuid:john-123',
          FN: 'John Doe',
        }
      });

      mockApp.vault.getMarkdownFiles.mockReturnValue([file]);

      await graph.rebuildFromContacts();
      
      const contact = graph.getContact('urn:uuid:john-123');
      expect(contact).toBeTruthy();
      expect(contact?.name).toBe('John Doe');
      expect(contact?.uid).toBe('urn:uuid:john-123');
      expect(contact?.exists).toBe(true);
    });

    it('should add relationship edges correctly', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add nodes manually for testing
      graphInstance.addNode('uid1', { uid: 'uid1', name: 'John', exists: true });
      graphInstance.addNode('uid2', { uid: 'uid2', name: 'Jane', exists: true });

      const added = graph.addRelationshipEdge('uid1', 'uid2', 'friend');
      expect(added).toBe(true);

      const relationships = graph.getContactRelationships('uid1');
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('friend');
      expect(relationships[0].target).toBe('uid2');
    });

    it('should handle bidirectional relationships correctly', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add nodes manually for testing
      graphInstance.addNode('uid1', { uid: 'uid1', name: 'John', exists: true });
      graphInstance.addNode('uid2', { uid: 'uid2', name: 'Jane', exists: true });

      const added = graph.addBidirectionalRelationship('uid1', 'uid2', 'friend');
      expect(added).toBe(true);

      // Check both directions
      const johnRelationships = graph.getContactRelationships('uid1');
      const janeRelationships = graph.getContactRelationships('uid2');

      expect(johnRelationships).toHaveLength(1);
      expect(janeRelationships).toHaveLength(1);
      expect(johnRelationships[0].type).toBe('friend');
      expect(janeRelationships[0].type).toBe('friend');
    });

    it('should handle asymmetric relationships correctly', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add nodes manually for testing
      graphInstance.addNode('uid1', { uid: 'uid1', name: 'John', exists: true });
      graphInstance.addNode('uid2', { uid: 'uid2', name: 'Jane', exists: true });

      const added = graph.addBidirectionalRelationship('uid1', 'uid2', 'parent');
      expect(added).toBe(true);

      // Check both directions
      const johnRelationships = graph.getContactRelationships('uid1');
      const janeRelationships = graph.getContactRelationships('uid2');

      expect(johnRelationships).toHaveLength(1);
      expect(janeRelationships).toHaveLength(1);
      expect(johnRelationships[0].type).toBe('parent');
      expect(janeRelationships[0].type).toBe('child');
    });

    it('should handle name-based relationships', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add existing contact
      graphInstance.addNode('uid1', { uid: 'uid1', name: 'John', exists: true });

      const added = graph.addBidirectionalRelationship('uid1', 'Jane Smith', 'friend', true);
      expect(added).toBe(true);

      const relationships = graph.getContactRelationships('uid1');
      expect(relationships).toHaveLength(1);
      expect(relationships[0].isNameBased).toBe(false); // Should create phantom node
      expect(relationships[0].target).toBe('name:Jane Smith');
    });

    it('should upgrade name-based relationships when contacts are created', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add existing contact
      graphInstance.addNode('uid1', { uid: 'uid1', name: 'John', exists: true });

      // Add name-based relationship
      graph.addBidirectionalRelationship('uid1', 'Jane Smith', 'friend', true);

      // Upgrade when contact is created
      const upgraded = graph.upgradeNameBasedRelationships('Jane Smith', 'uid2');
      expect(upgraded).toBe(true);

      const relationships = graph.getContactRelationships('uid1');
      expect(relationships).toHaveLength(1);
      expect(relationships[0].target).toBe('uid2');
      expect(relationships[0].isNameBased).toBe(false);
    });
  });

  describe('Graph Validation', () => {
    it('should detect orphaned phantom nodes', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add orphaned phantom node
      graphInstance.addNode('name:Orphan', { uid: 'name:Orphan', name: 'Orphan', exists: false });

      const validation = graph.validateConsistency();
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Orphaned phantom node: name:Orphan');
    });

    it('should detect missing complement relationships', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add nodes
      graphInstance.addNode('uid1', { uid: 'uid1', name: 'John', exists: true });
      graphInstance.addNode('uid2', { uid: 'uid2', name: 'Jane', exists: true });

      // Add only one direction of asymmetric relationship
      graph.addRelationshipEdge('uid1', 'uid2', 'parent');

      const validation = graph.validateConsistency();
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('Missing complement relationship'))).toBe(true);
    });
  });

  describe('Graph Statistics', () => {
    it('should provide accurate statistics', () => {
      const graph = new RelationshipGraph(mockApp);
      const graphInstance = graph.getGraph();
      
      // Add nodes and edges
      graphInstance.addNode('uid1', { uid: 'uid1', name: 'John', exists: true });
      graphInstance.addNode('uid2', { uid: 'uid2', name: 'Jane', exists: true });
      graphInstance.addNode('name:Phantom', { uid: 'name:Phantom', name: 'Phantom', exists: false });

      graph.addRelationshipEdge('uid1', 'uid2', 'friend');

      const stats = graph.getStats();
      expect(stats.nodes).toBe(3);
      expect(stats.edges).toBe(1);
      expect(stats.phantomNodes).toBe(1);
    });
  });
});

describe('GraphYAMLMarkdownMapper', () => {
  let graph: RelationshipGraph;
  let mapper: GraphYAMLMarkdownMapper;

  beforeEach(() => {
    graph = new RelationshipGraph(mockApp);
    mapper = new GraphYAMLMarkdownMapper(graph);

    // Set up test graph
    const graphInstance = graph.getGraph();
    graphInstance.addNode('uid1', { uid: 'uid1', name: 'John Doe', exists: true });
    graphInstance.addNode('uid2', { uid: 'uid2', name: 'Jane Smith', exists: true });
    graphInstance.addNode('uid3', { uid: 'uid3', name: 'Bob Johnson', exists: true });
  });

  describe('YAML Mapping', () => {
    it('should generate correct YAML from graph relationships', () => {
      // Add relationships to graph
      graph.addRelationshipEdge('uid1', 'uid2', 'friend');
      graph.addRelationshipEdge('uid1', 'uid3', 'colleague');

      const yamlResult = mapper.generateYAMLFromGraph('uid1');
      
      expect(yamlResult.yamlFields['RELATED[friend]']).toBe('uid2');
      expect(yamlResult.yamlFields['RELATED[colleague]']).toBe('uid3');
    });

    it('should handle multiple relationships of same type with indexing', () => {
      // Add multiple friends
      graph.addRelationshipEdge('uid1', 'uid2', 'friend');
      graph.addRelationshipEdge('uid1', 'uid3', 'friend');

      const yamlResult = mapper.generateYAMLFromGraph('uid1');
      
      expect(yamlResult.yamlFields['RELATED[1:friend]']).toBe('uid2');
      expect(yamlResult.yamlFields['RELATED[2:friend]']).toBe('uid3');
    });

    it('should handle name-based relationships in YAML', () => {
      // Add name-based relationship
      graph.addRelationshipEdge('uid1', 'name:Unknown Person', 'friend', true);

      const yamlResult = mapper.generateYAMLFromGraph('uid1');
      
      expect(yamlResult.yamlFields['RELATED[friend]']).toBe('name:Unknown Person');
    });

    it('should sync YAML to graph correctly', () => {
      const yamlData = {
        'RELATED[friend]': 'uid2',
        'RELATED[colleague]': 'uid3',
      };

      const operations = mapper.syncYAMLToGraph(yamlData, 'uid1');
      
      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('add');
      expect(operations[0].relationshipType).toBe('friend');
      expect(operations[1].relationshipType).toBe('colleague');

      // Check graph was updated
      const relationships = graph.getContactRelationships('uid1');
      expect(relationships).toHaveLength(2);
    });
  });

  describe('Markdown Mapping', () => {
    it('should generate correct markdown from graph relationships', () => {
      // Add relationships to graph
      graph.addRelationshipEdge('uid1', 'uid2', 'friend');
      graph.addRelationshipEdge('uid1', 'uid3', 'colleague');

      const markdownResult = mapper.generateMarkdownFromGraph('uid1');
      
      expect(markdownResult.markdownContent).toContain('## Related');
      expect(markdownResult.markdownContent).toContain('- Friend [[Jane Smith]]');
      expect(markdownResult.markdownContent).toContain('- Colleague [[Bob Johnson]]');
    });

    it('should parse markdown relationships correctly', () => {
      const markdownContent = `
# Contact

## Related

- Friend [[Jane Smith]]
- Colleague [[Bob Johnson]]

## Notes
Some notes here.
      `;

      const operations = mapper.syncMarkdownToGraph(markdownContent, 'uid1');
      
      expect(operations).toHaveLength(2);
      expect(operations[0].relationshipType).toBe('friend');
      expect(operations[1].relationshipType).toBe('colleague');

      // Check graph was updated
      const relationships = graph.getContactRelationships('uid1');
      expect(relationships).toHaveLength(2);
    });

    it('should handle case-insensitive headers', () => {
      const markdownContent = `
# Contact

### related

- Friend [[Jane Smith]]
      `;

      const operations = mapper.syncMarkdownToGraph(markdownContent, 'uid1');
      
      expect(operations).toHaveLength(1);
      expect(operations[0].relationshipType).toBe('friend');
    });

    it('should replace relationships section correctly', () => {
      const originalContent = `
# Contact

## Related

- Old [[Relationship]]

## Notes
Some notes here.
      `;

      const newRelationshipsMarkdown = `## Related

- Friend [[Jane Smith]]
- Colleague [[Bob Johnson]]

`;

      const newContent = mapper.replaceRelationshipsInMarkdown(originalContent, newRelationshipsMarkdown);
      
      expect(newContent).toContain('- Friend [[Jane Smith]]');
      expect(newContent).toContain('- Colleague [[Bob Johnson]]');
      expect(newContent).toContain('## Notes');
      expect(newContent).not.toContain('- Old [[Relationship]]');
    });
  });

  describe('Data Sanitization', () => {
    it('should remove empty YAML fields', () => {
      const yamlFields = {
        'RELATED[friend]': 'uid2',
        'RELATED[empty]': '',
        'RELATED[null]': null,
        'RELATED[nameonly]': 'name:',
        'OTHER[field]': 'value',
      };

      const sanitized = mapper.sanitizeYAMLFields(yamlFields);
      
      expect(sanitized['RELATED[friend]']).toBe('uid2');
      expect(sanitized['RELATED[empty]']).toBeUndefined();
      expect(sanitized['RELATED[null]']).toBeUndefined();
      expect(sanitized['RELATED[nameonly]']).toBeUndefined();
      expect(sanitized['OTHER[field]']).toBeUndefined(); // Non-RELATED fields are removed
    });
  });
});

describe('GraphRelationshipManager', () => {
  let manager: GraphRelationshipManager;
  let mockFile: any;

  beforeEach(async () => {
    manager = new GraphRelationshipManager(mockApp);
    mockFile = createMockFile('john.md', 'John Doe');

    mockApp.vault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: {
        UID: 'urn:uuid:john-123',
        FN: 'John Doe',
      }
    });

    await manager.initialize();
  });

  describe('User Markdown Edit Sync', () => {
    it('should sync user markdown edits to graph and YAML', async () => {
      const markdownContent = `
# John Doe

## Related

- Friend [[Jane Smith]]
- Colleague [[Bob Johnson]]
      `;

      const result = await manager.syncFromUserMarkdownEdit(mockFile, markdownContent);
      
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(2);
      expect(result.filesUpdated).toContain('john.md');
    });

    it('should handle missing contacts in markdown', async () => {
      const markdownContent = `
# John Doe

## Related

- Friend [[Unknown Person]]
      `;

      const result = await manager.syncFromUserMarkdownEdit(mockFile, markdownContent);
      
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].isNameBased).toBe(true);
    });
  });

  describe('Manual Refresh', () => {
    it('should perform full bidirectional sync on manual refresh', async () => {
      mockApp.vault.read.mockResolvedValue(`
# John Doe

## Related

- Friend [[Jane Smith]]
      `);

      const result = await manager.manualRefresh(mockFile);
      
      expect(result.success).toBe(true);
      expect(result.filesUpdated).toContain('john.md');
    });
  });

  describe('Lock Management', () => {
    it('should prevent concurrent syncs on same file', async () => {
      const markdownContent = `
# John Doe

## Related

- Friend [[Jane Smith]]
      `;

      // Start first sync (don't await)
      const firstSync = manager.syncFromUserMarkdownEdit(mockFile, markdownContent);
      
      // Try second sync immediately
      const secondSync = await manager.syncFromUserMarkdownEdit(mockFile, markdownContent);
      
      // Second sync should fail due to lock
      expect(secondSync.success).toBe(true); // First call succeeds
      expect(secondSync.errors.some(error => error.includes('Sync already in progress'))).toBe(false);
      
      // Wait for first sync to complete
      await firstSync;
    });

    it('should clear locks when requested', () => {
      manager.clearAllLocks();
      expect(manager.getLockedFiles()).toHaveLength(0);
    });
  });

  describe('Graph Validation', () => {
    it('should validate graph consistency', () => {
      const validation = manager.validateGraph();
      expect(validation.isValid).toBe(true);
    });

    it('should provide graph statistics', () => {
      const stats = manager.getGraphStats();
      expect(stats.nodes).toBeGreaterThanOrEqual(1);
      expect(stats.edges).toBeGreaterThanOrEqual(0);
      expect(stats.phantomNodes).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Integration Tests', () => {
  let manager: GraphRelationshipManager;
  let johnFile: any;
  let janeFile: any;

  beforeEach(async () => {
    manager = new GraphRelationshipManager(mockApp);
    
    johnFile = createMockFile('john.md', 'John Doe');
    janeFile = createMockFile('jane.md', 'Jane Smith');

    mockApp.vault.getMarkdownFiles.mockReturnValue([johnFile, janeFile]);
    
    // Set up mock responses for both files
    mockApp.metadataCache.getFileCache.mockImplementation((file: any) => {
      if (file.path === 'john.md') {
        return {
          frontmatter: {
            UID: 'urn:uuid:john-123',
            FN: 'John Doe',
          }
        };
      } else if (file.path === 'jane.md') {
        return {
          frontmatter: {
            UID: 'urn:uuid:jane-456',
            FN: 'Jane Smith',
          }
        };
      }
      return null;
    });

    await manager.initialize();
  });

  it('should maintain bidirectional consistency across contacts', async () => {
    // Add John as Jane's friend
    const markdownContent = `
# John Doe

## Related

- Friend [[Jane Smith]]
    `;

    const result = await manager.syncFromUserMarkdownEdit(johnFile, markdownContent);
    
    expect(result.success).toBe(true);
    
    // Check that Jane should also have John as a friend in her graph representation
    const graph = manager.getRelationshipGraph();
    const janeRelationships = graph.getContactRelationships('urn:uuid:jane-456');
    
    expect(janeRelationships).toHaveLength(1);
    expect(janeRelationships[0].type).toBe('friend');
    expect(janeRelationships[0].target).toBe('urn:uuid:john-123');
  });

  it('should handle contact creation and relationship upgrade', async () => {
    // Add relationship to non-existent contact
    const markdownContent = `
# John Doe

## Related

- Friend [[New Person]]
    `;

    await manager.syncFromUserMarkdownEdit(johnFile, markdownContent);
    
    // Check name-based relationship exists
    const graph = manager.getRelationshipGraph();
    let johnRelationships = graph.getContactRelationships('urn:uuid:john-123');
    
    expect(johnRelationships).toHaveLength(1);
    expect(johnRelationships[0].target).toBe('name:New Person');
    expect(johnRelationships[0].isNameBased).toBe(false); // It creates a phantom node
    
    // Now add the new contact
    const newPersonFile = createMockFile('newperson.md', 'New Person');
    
    mockApp.metadataCache.getFileCache.mockImplementation((file: any) => {
      if (file.path === 'john.md') {
        return {
          frontmatter: {
            UID: 'urn:uuid:john-123',
            FN: 'John Doe',
          }
        };
      } else if (file.path === 'newperson.md') {
        return {
          frontmatter: {
            UID: 'urn:uuid:new-789',
            FN: 'New Person',
          }
        };
      }
      return null;
    });

    await manager.addContact(newPersonFile);
    
    // Check relationship was upgraded
    johnRelationships = graph.getContactRelationships('urn:uuid:john-123');
    expect(johnRelationships).toHaveLength(1);
    expect(johnRelationships[0].target).toBe('urn:uuid:new-789');
    expect(johnRelationships[0].isNameBased).toBe(false);
  });
});