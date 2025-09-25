import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../src/relationships/relationshipGraph';
import { RelationshipType } from '../src/relationships/types';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  describe('Node Management', () => {
    it('should add a node to the graph', () => {
      const uid = 'test-uid-123';
      const fullName = 'John Doe';
      const gender = 'M';

      graph.addNode(uid, fullName, gender);

      const node = graph.getNode(uid);
      expect(node).toBeDefined();
      expect(node?.uid).toBe(uid);
      expect(node?.fullName).toBe(fullName);
      expect(node?.gender).toBe(gender);
    });

    it('should update an existing node', () => {
      const uid = 'test-uid-123';
      graph.addNode(uid, 'John Doe');
      graph.addNode(uid, 'John Smith', 'M');

      const node = graph.getNode(uid);
      expect(node?.fullName).toBe('John Smith');
      expect(node?.gender).toBe('M');
    });

    it('should remove a node from the graph', () => {
      const uid = 'test-uid-123';
      graph.addNode(uid, 'John Doe');
      
      expect(graph.getNode(uid)).toBeDefined();
      
      graph.removeNode(uid);
      
      expect(graph.getNode(uid)).toBeNull();
    });
  });

  describe('Relationship Management', () => {
    beforeEach(() => {
      graph.addNode('person1', 'Alice');
      graph.addNode('person2', 'Bob');
    });

    it('should add a relationship between two nodes', () => {
      graph.addRelationship('person1', 'person2', 'friend');

      expect(graph.hasRelationship('person1', 'person2', 'friend')).toBe(true);
    });

    it('should not add duplicate relationships', () => {
      graph.addRelationship('person1', 'person2', 'friend');
      graph.addRelationship('person1', 'person2', 'friend');

      const relationships = graph.getContactRelationships('person1');
      expect(relationships.length).toBe(1);
    });

    it('should remove a relationship', () => {
      graph.addRelationship('person1', 'person2', 'friend');
      expect(graph.hasRelationship('person1', 'person2', 'friend')).toBe(true);

      graph.removeRelationship('person1', 'person2', 'friend');
      expect(graph.hasRelationship('person1', 'person2', 'friend')).toBe(false);
    });

    it('should get all relationships for a contact', () => {
      graph.addNode('person3', 'Charlie');
      
      graph.addRelationship('person1', 'person2', 'friend');
      graph.addRelationship('person1', 'person3', 'colleague');

      const relationships = graph.getContactRelationships('person1');
      expect(relationships).toHaveLength(2);
      
      // Should be sorted by type then by name
      expect(relationships[0].type).toBe('colleague');
      expect(relationships[1].type).toBe('friend');
    });

    it('should throw error when adding relationship to non-existent node', () => {
      expect(() => {
        graph.addRelationship('person1', 'non-existent', 'friend');
      }).toThrow();
    });
  });

  describe('Related Fields', () => {
    beforeEach(() => {
      graph.addNode('uuid-person', 'Alice', undefined);
      graph.addNode('12345678-1234-1234-1234-123456789abc', 'Bob with UUID', undefined);
    });

    it('should convert relationships to vCard RELATED fields', () => {
      graph.addRelationship('uuid-person', '12345678-1234-1234-1234-123456789abc', 'friend');

      const relatedFields = graph.contactToRelatedFields('uuid-person');
      expect(relatedFields).toHaveLength(1);
      expect(relatedFields[0].type).toBe('friend');
      expect(relatedFields[0].value).toBe('urn:uuid:12345678-1234-1234-1234-123456789abc');
    });

    it('should use uid format for non-UUID identifiers', () => {
      graph.addNode('non-uuid-id', 'Charlie'); // Add the missing node
      graph.addRelationship('uuid-person', 'non-uuid-id', 'colleague');

      const relatedFields = graph.contactToRelatedFields('uuid-person');
      expect(relatedFields[0].value).toBe('uid:non-uuid-id');
    });
  });

  describe('Consistency Checking', () => {
    beforeEach(() => {
      graph.addNode('person1', 'Alice');
      graph.addNode('person2', 'Bob');
      graph.addNode('person3', 'Charlie');
    });

    it('should detect missing reciprocals', () => {
      graph.addRelationship('person1', 'person2', 'friend');
      // Missing reciprocal: person2 -> person1 (friend)

      // Debug: check if the relationship was actually added
      expect(graph.hasRelationship('person1', 'person2', 'friend')).toBe(true);
      expect(graph.hasRelationship('person2', 'person1', 'friend')).toBe(false);

      const consistency = graph.checkConsistency();
      expect(consistency.missingReciprocals).toHaveLength(1);
      expect(consistency.missingReciprocals[0]).toMatchObject({
        sourceUid: 'person1',
        targetUid: 'person2',
        relationshipType: 'friend',
        reciprocalType: 'friend'
      });
    });

    it('should handle parent-child reciprocals correctly', () => {
      graph.addRelationship('person1', 'person2', 'parent');

      const consistency = graph.checkConsistency();
      expect(consistency.missingReciprocals).toHaveLength(1);
      expect(consistency.missingReciprocals[0].reciprocalType).toBe('child');
    });
  });

  describe('Statistics', () => {
    it('should return correct graph statistics', () => {
      expect(graph.getStats()).toEqual({ nodes: 0, edges: 0 });

      graph.addNode('person1', 'Alice');
      graph.addNode('person2', 'Bob');
      expect(graph.getStats()).toEqual({ nodes: 2, edges: 0 });

      graph.addRelationship('person1', 'person2', 'friend');
      expect(graph.getStats()).toEqual({ nodes: 2, edges: 1 });
    });

    it('should clear all data', () => {
      graph.addNode('person1', 'Alice');
      graph.addNode('person2', 'Bob');
      graph.addRelationship('person1', 'person2', 'friend');

      graph.clear();
      expect(graph.getStats()).toEqual({ nodes: 0, edges: 0 });
    });
  });
});