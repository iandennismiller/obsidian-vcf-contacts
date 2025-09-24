import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../src/services/relationshipGraph';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  describe('Basic Contact Management', () => {
    it('should add contacts to the graph', () => {
      graph.addContact('uid1', 'John Doe', 'M');
      graph.addContact('uid2', 'Jane Smith', 'F');
      
      const relationships1 = graph.getContactRelationships('uid1', 'John Doe');
      expect(relationships1).toEqual([]);
    });

    it('should handle contacts without UID', () => {
      graph.addContact('', 'John Doe');
      const relationships = graph.getContactRelationships('', 'John Doe');
      expect(relationships).toEqual([]);
    });
  });

  describe('Relationship Management', () => {
    beforeEach(() => {
      graph.addContact('uid1', 'John Doe', 'M');
      graph.addContact('uid2', 'Jane Smith', 'F');
      graph.addContact('uid3', 'Bob Johnson', 'M');
    });

    it('should add friendship relationships', () => {
      graph.addRelationship('uid1', 'John Doe', 'uid2', 'Jane Smith', 'friend');
      
      const johnRelationships = graph.getContactRelationships('uid1', 'John Doe');
      expect(johnRelationships).toHaveLength(1);
      expect(johnRelationships[0]).toMatchObject({
        targetUid: 'uid2',
        targetName: 'Jane Smith',
        relationshipKind: 'friend'
      });
    });

    it('should handle gendered relationships and infer gender', () => {
      graph.addRelationship('uid1', 'John Doe', 'uid2', 'Jane Smith', 'mother');
      
      const johnRelationships = graph.getContactRelationships('uid1', 'John Doe');
      // Since Jane Smith has gender 'F', it should render as 'mother'
      expect(johnRelationships[0].relationshipKind).toBe('mother');
      
      // But if we create a contact without specified gender and add as parent, 
      // it should render generically
      graph.addContact('uid4', 'Pat Johnson'); // No gender specified
      graph.addRelationship('uid1', 'John Doe', 'uid4', 'Pat Johnson', 'parent');
      
      const updatedRelationships = graph.getContactRelationships('uid1', 'John Doe');
      const patRelationship = updatedRelationships.find(r => r.targetName === 'Pat Johnson');
      expect(patRelationship?.relationshipKind).toBe('parent');
    });

    it('should handle auncle relationship rendering', () => {
      graph.addRelationship('uid1', 'John Doe', 'uid2', 'Jane Smith', 'aunt');
      
      const relationships = graph.getContactRelationships('uid1', 'John Doe');
      expect(relationships[0].relationshipKind).toBe('aunt');
    });

    it('should remove relationships', () => {
      graph.addRelationship('uid1', 'John Doe', 'uid2', 'Jane Smith', 'friend');
      expect(graph.getContactRelationships('uid1', 'John Doe')).toHaveLength(1);
      
      graph.removeRelationship('uid1', 'John Doe', 'uid2', 'Jane Smith', 'friend');
      expect(graph.getContactRelationships('uid1', 'John Doe')).toHaveLength(0);
    });

    it('should return relationships in the order they were added', () => {
      graph.addRelationship('uid1', 'John Doe', 'uid2', 'Jane Smith', 'friend');
      graph.addRelationship('uid1', 'John Doe', 'uid3', 'Bob Johnson', 'colleague');
      
      const relationships = graph.getContactRelationships('uid1', 'John Doe');
      expect(relationships).toHaveLength(2);
      // Sorting is now handled by consolidated functions in contactMdTemplate
      expect(relationships[0].relationshipKind).toBe('friend'); // First added
      expect(relationships[1].relationshipKind).toBe('colleague'); // Second added
    });
  });

  describe('Consistency Checking', () => {
    beforeEach(() => {
      graph.addContact('uid1', 'Parent', 'M');
      graph.addContact('uid2', 'Child', 'F');
    });

    it('should detect missing reciprocal relationships', () => {
      graph.addRelationship('uid1', 'Parent', 'uid2', 'Child', 'child');
      
      const inconsistencies = graph.checkConsistency();
      expect(inconsistencies).toHaveLength(1);
      expect(inconsistencies[0]).toMatchObject({
        fromUid: 'uid2',
        fromName: 'Child',
        toUid: 'uid1',
        toName: 'Parent',
        missingRelationshipKind: 'parent'
      });
    });

    it('should not report inconsistencies when reciprocal relationships exist', () => {
      graph.addRelationship('uid1', 'Parent', 'uid2', 'Child', 'child');
      graph.addRelationship('uid2', 'Child', 'uid1', 'Parent', 'parent');
      
      const inconsistencies = graph.checkConsistency();
      expect(inconsistencies).toHaveLength(0);
    });
  });

  describe('Relationship References', () => {
    it('should create urn:uuid reference for valid UUIDs', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      graph.addContact(validUUID, 'John Doe');
      graph.addRelationship('uid1', 'Jane', validUUID, 'John Doe', 'friend');
      
      const relationships = graph.getContactRelationships('uid1', 'Jane');
      expect(relationships[0].reference.namespace).toBe('urn:uuid');
    });

    it('should create uid reference for non-UUID UIDs', () => {
      graph.addContact('custom-uid-123', 'John Doe');
      graph.addRelationship('uid1', 'Jane', 'custom-uid-123', 'John Doe', 'friend');
      
      const relationships = graph.getContactRelationships('uid1', 'Jane');
      expect(relationships[0].reference.namespace).toBe('uid');
    });

    it('should create name reference when no UID', () => {
      graph.addContact('', 'John Doe');
      graph.addRelationship('uid1', 'Jane', '', 'John Doe', 'friend');
      
      const relationships = graph.getContactRelationships('uid1', 'Jane');
      expect(relationships[0].reference.namespace).toBe('name');
    });
  });
});