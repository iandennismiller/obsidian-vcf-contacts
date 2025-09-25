import { describe, test, expect, beforeEach } from 'vitest';
import { RelationshipGraph, RelationshipType, Gender } from '../src/relationships/relationshipGraph';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  describe('Contact Management', () => {
    test('should add contacts to the graph', () => {
      graph.addContact('uid1', 'John Doe', undefined, 'M');
      graph.addContact('uid2', 'Jane Smith', undefined, 'F');

      const contact1 = graph.getContact('uid1');
      const contact2 = graph.getContact('uid2');

      expect(contact1).toEqual({
        uid: 'uid1',
        fullName: 'John Doe',
        file: undefined,
        gender: 'M'
      });

      expect(contact2).toEqual({
        uid: 'uid2',
        fullName: 'Jane Smith',
        file: undefined,
        gender: 'F'
      });
    });

    test('should update existing contacts', () => {
      graph.addContact('uid1', 'John Doe', undefined, 'M');
      graph.addContact('uid1', 'John David Doe', undefined, 'M');

      const contact = graph.getContact('uid1');
      expect(contact?.fullName).toBe('John David Doe');
    });

    test('should remove contacts from the graph', () => {
      graph.addContact('uid1', 'John Doe', undefined, 'M');
      expect(graph.getContact('uid1')).not.toBeNull();

      graph.removeContact('uid1');
      expect(graph.getContact('uid1')).toBeNull();
    });

    test('should get all contacts', () => {
      graph.addContact('uid1', 'John Doe', undefined, 'M');
      graph.addContact('uid2', 'Jane Smith', undefined, 'F');

      const contacts = graph.getAllContacts();
      expect(contacts).toHaveLength(2);
      expect(contacts.map(c => c.uid)).toContain('uid1');
      expect(contacts.map(c => c.uid)).toContain('uid2');
    });
  });

  describe('Relationship Management', () => {
    beforeEach(() => {
      graph.addContact('john', 'John Doe', undefined, 'M');
      graph.addContact('jane', 'Jane Smith', undefined, 'F');
      graph.addContact('bob', 'Bob Johnson', undefined, 'M');
    });

    test('should add relationships between contacts', () => {
      graph.addRelationship('john', 'jane', 'friend');
      
      const relationships = graph.getContactRelationships('john');
      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toEqual({
        type: 'friend',
        targetUid: 'jane',
        targetName: 'Jane Smith'
      });
    });

    test('should prevent self-loops', () => {
      expect(() => {
        graph.addRelationship('john', 'john', 'friend');
      }).toThrow('Self-loops are not allowed');
    });

    test('should throw error for non-existent contacts', () => {
      expect(() => {
        graph.addRelationship('john', 'nonexistent', 'friend');
      }).toThrow('One or both contacts not found');
    });

    test('should not duplicate relationships', () => {
      graph.addRelationship('john', 'jane', 'friend');
      graph.addRelationship('john', 'jane', 'friend');
      
      const relationships = graph.getContactRelationships('john');
      expect(relationships).toHaveLength(1);
    });

    test('should replace relationship type', () => {
      graph.addRelationship('john', 'jane', 'friend');
      graph.addRelationship('john', 'jane', 'colleague');
      
      const relationships = graph.getContactRelationships('john');
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('colleague');
    });

    test('should remove relationships', () => {
      graph.addRelationship('john', 'jane', 'friend');
      graph.removeRelationship('john', 'jane', 'friend');
      
      const relationships = graph.getContactRelationships('john');
      expect(relationships).toHaveLength(0);
    });

    test('should get related contacts', () => {
      graph.addRelationship('jane', 'john', 'friend');
      graph.addRelationship('bob', 'john', 'friend');
      
      const friends = graph.getRelatedContacts('john', 'friend');
      expect(friends).toHaveLength(2);
      expect(friends.map(c => c.uid)).toContain('jane');
      expect(friends.map(c => c.uid)).toContain('bob');
    });

    test('should sort relationships alphabetically', () => {
      graph.addContact('zara', 'Zara Wilson', undefined, 'F');
      graph.addContact('adam', 'Adam Brown', undefined, 'M');
      
      graph.addRelationship('john', 'zara', 'friend');
      graph.addRelationship('john', 'adam', 'friend');
      
      const relationships = graph.getContactRelationships('john');
      expect(relationships[0].targetName).toBe('Adam Brown');
      expect(relationships[1].targetName).toBe('Zara Wilson');
    });
  });

  describe('vCard Integration', () => {
    beforeEach(() => {
      graph.addContact('john', 'John Doe', undefined, 'M');
      graph.addContact('jane', 'Jane Smith', undefined, 'F');
    });

    test('should convert to vCard RELATED fields', () => {
      graph.addRelationship('john', 'jane', 'friend');
      
      const relatedFields = graph.contactToRelatedFields('john');
      expect(relatedFields).toHaveLength(1);
      expect(relatedFields[0]).toEqual({
        type: 'friend',
        value: 'uid:jane'
      });
    });

    test('should handle UUID-like UIDs', () => {
      graph.removeContact('jane');
      graph.addContact('550e8400-e29b-41d4-a716-446655440000', 'Jane Smith', undefined, 'F');
      graph.addRelationship('john', '550e8400-e29b-41d4-a716-446655440000', 'friend');
      
      const relatedFields = graph.contactToRelatedFields('john');
      expect(relatedFields[0].value).toBe('urn:uuid:550e8400-e29b-41d4-a716-446655440000');
    });

    test('should update from vCard RELATED fields', () => {
      const relatedFields = [
        { type: 'friend' as RelationshipType, value: 'uid:jane' }
      ];
      
      graph.updateContactFromRelatedFields('john', relatedFields);
      
      const relationships = graph.getContactRelationships('john');
      expect(relationships).toHaveLength(1);
      expect(relationships[0].targetUid).toBe('jane');
    });

    test('should clear existing relationships when updating', () => {
      graph.addRelationship('john', 'jane', 'friend');
      
      const relatedFields: { type: RelationshipType; value: string }[] = [];
      graph.updateContactFromRelatedFields('john', relatedFields);
      
      const relationships = graph.getContactRelationships('john');
      expect(relationships).toHaveLength(0);
    });
  });

  describe('Graph Statistics', () => {
    test('should provide correct statistics', () => {
      expect(graph.getStats()).toEqual({ nodes: 0, edges: 0 });
      
      graph.addContact('john', 'John Doe', undefined, 'M');
      graph.addContact('jane', 'Jane Smith', undefined, 'F');
      expect(graph.getStats()).toEqual({ nodes: 2, edges: 0 });
      
      graph.addRelationship('john', 'jane', 'friend');
      expect(graph.getStats()).toEqual({ nodes: 2, edges: 1 });
    });

    test('should clear all relationships', () => {
      graph.addContact('john', 'John Doe', undefined, 'M');
      graph.addContact('jane', 'Jane Smith', undefined, 'F');
      graph.addRelationship('john', 'jane', 'friend');
      
      graph.clearAllRelationships();
      expect(graph.getStats()).toEqual({ nodes: 2, edges: 0 });
    });

    test('should clear entire graph', () => {
      graph.addContact('john', 'John Doe', undefined, 'M');
      graph.addContact('jane', 'Jane Smith', undefined, 'F');
      graph.addRelationship('john', 'jane', 'friend');
      
      graph.clear();
      expect(graph.getStats()).toEqual({ nodes: 0, edges: 0 });
    });
  });
});