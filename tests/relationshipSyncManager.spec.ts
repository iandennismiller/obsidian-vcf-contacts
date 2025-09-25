import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipSyncManager } from '../src/relationships/relationshipSyncManager';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';

describe('RelationshipSyncManager', () => {
  let graph: RelationshipGraph;
  let syncManager: RelationshipSyncManager;
  let mockApp: any;

  beforeEach(() => {
    graph = new RelationshipGraph();
    
    // Mock Obsidian App
    mockApp = {
      metadataCache: {
        getFileCache: () => null
      },
      vault: {
        read: async () => '',
        modify: async () => {},
        getAbstractFileByPath: () => null
      }
    };
    
    syncManager = new RelationshipSyncManager(mockApp, graph);
  });

  describe('parseRelatedSection', () => {
    it('should parse Related section from markdown content', () => {
      const content = `---
title: Test Contact
---

Some content here.

## Related
- friend [[John Doe]]
- colleague [[Jane Smith]]
- father [[Bob Johnson]]

## Notes
Other notes here.
`;

      const relationships = syncManager.parseRelatedSection(content);
      
      expect(relationships).toHaveLength(3);
      expect(relationships[0]).toEqual({
        type: 'friend',
        contactName: 'John Doe'
      });
      expect(relationships[1]).toEqual({
        type: 'colleague',
        contactName: 'Jane Smith'
      });
      expect(relationships[2]).toEqual({
        type: 'parent',
        contactName: 'Bob Johnson',
        impliedGender: 'M'
      });
    });

    it('should handle case-insensitive Related heading', () => {
      const content = `## related
- friend [[John Doe]]
`;

      const relationships = syncManager.parseRelatedSection(content);
      expect(relationships).toHaveLength(1);
    });

    it('should handle different heading levels', () => {
      const content = `### Related
- friend [[John Doe]]
`;

      const relationships = syncManager.parseRelatedSection(content);
      expect(relationships).toHaveLength(1);
    });

    it('should return empty array when no Related section exists', () => {
      const content = `---
title: Test Contact
---

Some content without relationships.
`;

      const relationships = syncManager.parseRelatedSection(content);
      expect(relationships).toHaveLength(0);
    });

    it('should ignore non-relationship list items', () => {
      const content = `## Related
- friend [[John Doe]]
- This is not a relationship
- colleague [[Jane Smith]]
`;

      const relationships = syncManager.parseRelatedSection(content);
      expect(relationships).toHaveLength(2);
    });
  });

  describe('extractRelatedSection', () => {
    it('should extract the complete Related section', () => {
      const content = `## Related
- friend [[John Doe]]
- colleague [[Jane Smith]]

## Notes
Other content.
`;

      const section = syncManager.extractRelatedSection(content);
      expect(section).toBe(`## Related
- friend [[John Doe]]
- colleague [[Jane Smith]]`);
    });

    it('should return null when no Related section exists', () => {
      const content = `## Notes
Just some notes.
`;

      const section = syncManager.extractRelatedSection(content);
      expect(section).toBeNull();
    });
  });

  describe('updateGraphFromRelatedList', () => {
    beforeEach(() => {
      graph.addNode('person1', 'Alice');
      graph.addNode('person2', 'Bob');
      graph.addNode('person3', 'Charlie');
    });

    it('should update graph with relationships from parsed list', async () => {
      const relationships = [
        { type: 'friend' as any, contactName: 'Bob' },
        { type: 'colleague' as any, contactName: 'Charlie' }
      ];

      // Mock findOrCreateContactByName to return existing nodes
      const originalMethod = syncManager['findOrCreateContactByName'];
      syncManager['findOrCreateContactByName'] = async (name: string) => {
        if (name === 'Bob') return 'person2';
        if (name === 'Charlie') return 'person3';
        return null;
      };

      await syncManager.updateGraphFromRelatedList('person1', relationships);

      expect(graph.hasRelationship('person1', 'person2', 'friend')).toBe(true);
      expect(graph.hasRelationship('person1', 'person3', 'colleague')).toBe(true);

      // Restore original method
      syncManager['findOrCreateContactByName'] = originalMethod;
    });
  });
});