import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph, RelationshipType, Gender } from '../src/relationships/relationshipGraph';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  describe('Contact Management', () => {
    it('should add contacts to the graph', () => {
      graph.addContact('john-uid', 'John Doe', 'M');
      graph.addContact('jane-uid', 'Jane Smith', 'F');

      const contacts = graph.getAllContacts();
      expect(contacts).toHaveLength(2);
      expect(contacts.find(c => c.uid === 'john-uid')).toBeDefined();
      expect(contacts.find(c => c.uid === 'jane-uid')).toBeDefined();
    });

    it('should update existing contacts', () => {
      graph.addContact('john-uid', 'John Doe', 'M');
      graph.addContact('john-uid', 'John Smith', 'M'); // Update name

      const contact = graph.getContact('john-uid');
      expect(contact?.fullName).toBe('John Smith');
    });

    it('should remove contacts from the graph', () => {
      graph.addContact('john-uid', 'John Doe', 'M');
      expect(graph.getContact('john-uid')).toBeDefined();

      graph.removeContact('john-uid');
      expect(graph.getContact('john-uid')).toBeNull();
    });
  });

  describe('Relationship Management', () => {
    beforeEach(() => {
      graph.addContact('john-uid', 'John Doe', 'M');
      graph.addContact('jane-uid', 'Jane Smith', 'F');
    });

    it('should add relationships between contacts', () => {
      graph.addRelationship('john-uid', 'jane-uid', 'spouse');

      const johnRelationships = graph.getContactRelationships('john-uid');
      expect(johnRelationships).toHaveLength(1);
      expect(johnRelationships[0].type).toBe('spouse');
      expect(johnRelationships[0].targetUid).toBe('jane-uid');
    });

    it('should not add duplicate relationships', () => {
      graph.addRelationship('john-uid', 'jane-uid', 'spouse');
      graph.addRelationship('john-uid', 'jane-uid', 'spouse'); // Duplicate

      const relationships = graph.getContactRelationships('john-uid');
      expect(relationships).toHaveLength(1);
    });

    it('should remove relationships', () => {
      graph.addRelationship('john-uid', 'jane-uid', 'spouse');
      expect(graph.getContactRelationships('john-uid')).toHaveLength(1);

      graph.removeRelationship('john-uid', 'jane-uid', 'spouse');
      expect(graph.getContactRelationships('john-uid')).toHaveLength(0);
    });

    it('should support multiple relationship types between same contacts', () => {
      graph.addRelationship('john-uid', 'jane-uid', 'spouse');
      graph.addRelationship('john-uid', 'jane-uid', 'friend');

      const relationships = graph.getContactRelationships('john-uid');
      expect(relationships).toHaveLength(2);
      expect(relationships.map(r => r.type)).toEqual(expect.arrayContaining(['spouse', 'friend']));
    });
  });

  describe('Reciprocal Relationships', () => {
    beforeEach(() => {
      graph.addContact('parent-uid', 'Parent', 'F');
      graph.addContact('child-uid', 'Child', 'M');
    });

    it('should detect missing reciprocal relationships', () => {
      graph.addRelationship('parent-uid', 'child-uid', 'child');
      // Missing reciprocal: child -> parent (parent)

      const inconsistencies = graph.checkConsistency();
      expect(inconsistencies).toHaveLength(1);
      expect(inconsistencies[0]).toEqual({
        fromUid: 'child-uid',
        toUid: 'parent-uid',
        type: 'parent'
      });
    });

    it('should not report inconsistencies for bidirectional relationships', () => {
      graph.addRelationship('parent-uid', 'child-uid', 'child');
      graph.addRelationship('child-uid', 'parent-uid', 'parent');

      const inconsistencies = graph.checkConsistency();
      expect(inconsistencies).toHaveLength(0);
    });

    it('should handle symmetric relationships correctly', () => {
      graph.addContact('sibling1-uid', 'Sibling 1', 'M');
      graph.addContact('sibling2-uid', 'Sibling 2', 'F');

      graph.addRelationship('sibling1-uid', 'sibling2-uid', 'sibling');
      // Missing reciprocal: sibling2 -> sibling1 (sibling)

      const inconsistencies = graph.checkConsistency();
      expect(inconsistencies).toHaveLength(1);
      expect(inconsistencies[0]).toEqual({
        fromUid: 'sibling2-uid',
        toUid: 'sibling1-uid',
        type: 'sibling'
      });
    });
  });

  describe('vCard RELATED Fields', () => {
    beforeEach(() => {
      graph.addContact('john-uid', 'John Doe', 'M');
      graph.addContact('jane-uid', 'Jane Smith', 'F');
    });

    it('should convert relationships to vCard RELATED fields', () => {
      graph.addRelationship('john-uid', 'jane-uid', 'spouse');

      const relatedFields = graph.contactToRelatedFields('john-uid');
      expect(relatedFields).toHaveLength(1);
      expect(relatedFields[0].type).toBe('spouse');
      expect(relatedFields[0].value).toMatch(/^(urn:uuid:|uid:|name:)/);
    });

    it('should format UUID values correctly', () => {
      const uuidUid = '550e8400-e29b-41d4-a716-446655440000';
      graph.addContact(uuidUid, 'UUID Contact', 'F');
      graph.addRelationship('john-uid', uuidUid, 'friend');

      const relatedFields = graph.contactToRelatedFields('john-uid');
      expect(relatedFields[0].value).toBe(`urn:uuid:${uuidUid}`);
    });

    it('should format custom UID values correctly', () => {
      const customUid = 'custom-contact-123';
      graph.addContact(customUid, 'Custom Contact', 'M');
      graph.addRelationship('john-uid', customUid, 'colleague');

      const relatedFields = graph.contactToRelatedFields('john-uid');
      expect(relatedFields[0].value).toBe(`uid:${customUid}`);
    });
  });

  describe('Graph Statistics', () => {
    it('should provide accurate statistics', () => {
      expect(graph.getStats()).toEqual({ contacts: 0, relationships: 0 });

      graph.addContact('john-uid', 'John Doe', 'M');
      graph.addContact('jane-uid', 'Jane Smith', 'F');
      graph.addRelationship('john-uid', 'jane-uid', 'spouse');

      expect(graph.getStats()).toEqual({ contacts: 2, relationships: 1 });
    });

    it('should clear all relationships while keeping contacts', () => {
      graph.addContact('john-uid', 'John Doe', 'M');
      graph.addContact('jane-uid', 'Jane Smith', 'F');
      graph.addRelationship('john-uid', 'jane-uid', 'spouse');

      expect(graph.getStats()).toEqual({ contacts: 2, relationships: 1 });

      graph.clearAllRelationships();
      expect(graph.getStats()).toEqual({ contacts: 2, relationships: 0 });
    });
  });
});