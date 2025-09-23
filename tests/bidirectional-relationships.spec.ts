import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipGraph } from '../src/services/relationshipGraph';

describe('Bidirectional Relationship Propagation', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  describe('Reciprocal relationship types', () => {
    it('should return correct reciprocal for symmetric relationships', () => {
      expect(RelationshipGraph.getReciprocalRelationshipType('friend')).toBe('friend');
      expect(RelationshipGraph.getReciprocalRelationshipType('colleague')).toBe('colleague');
      expect(RelationshipGraph.getReciprocalRelationshipType('sibling')).toBe('sibling');
      expect(RelationshipGraph.getReciprocalRelationshipType('spouse')).toBe('spouse');
      
      console.log('✅ Symmetric relationships work correctly');
    });

    it('should return correct reciprocal for asymmetric relationships', () => {
      expect(RelationshipGraph.getReciprocalRelationshipType('parent')).toBe('child');
      expect(RelationshipGraph.getReciprocalRelationshipType('child')).toBe('parent');
      expect(RelationshipGraph.getReciprocalRelationshipType('auncle')).toBe('nibling');
      expect(RelationshipGraph.getReciprocalRelationshipType('nibling')).toBe('auncle');
      
      console.log('✅ Asymmetric relationships work correctly');
    });

    it('should return null for non-reciprocal relationships', () => {
      expect(RelationshipGraph.getReciprocalRelationshipType('mentor')).toBeNull();
      expect(RelationshipGraph.getReciprocalRelationshipType('boss')).toBeNull();
      
      console.log('✅ Non-reciprocal relationships handled correctly');
    });
  });

  describe('Bidirectional relationship addition', () => {
    it('should add reciprocal relationships automatically', () => {
      // Add a friend relationship
      graph.addRelationshipWithReciprocal('alice', 'bob', 'friend');
      
      // Check that both directions exist
      const aliceRelationships = graph.getContactRelationships('alice');
      const bobRelationships = graph.getContactRelationships('bob');
      
      expect(aliceRelationships).toHaveLength(1);
      expect(aliceRelationships[0]).toMatchObject({
        relationshipType: 'friend',
        sourceContact: 'alice',
        targetContact: 'bob'
      });
      
      expect(bobRelationships).toHaveLength(1);
      expect(bobRelationships[0]).toMatchObject({
        relationshipType: 'friend',
        sourceContact: 'bob',
        targetContact: 'alice'
      });
      
      console.log('✅ Bidirectional friend relationship created');
    });

    it('should add asymmetric reciprocal relationships', () => {
      // Add a parent-child relationship
      graph.addRelationshipWithReciprocal('mary', 'john', 'parent');
      
      // Check that both directions exist with correct types
      const maryRelationships = graph.getContactRelationships('mary');
      const johnRelationships = graph.getContactRelationships('john');
      
      expect(maryRelationships).toHaveLength(1);
      expect(maryRelationships[0]).toMatchObject({
        relationshipType: 'parent',
        sourceContact: 'mary',
        targetContact: 'john'
      });
      
      expect(johnRelationships).toHaveLength(1);
      expect(johnRelationships[0]).toMatchObject({
        relationshipType: 'child',
        sourceContact: 'john',
        targetContact: 'mary'
      });
      
      console.log('✅ Bidirectional parent-child relationship created');
    });

    it('should not add reciprocal for non-reciprocal relationships', () => {
      // Add a mentor relationship (no reciprocal expected)
      graph.addRelationshipWithReciprocal('senior', 'junior', 'mentor');
      
      // Check that only one direction exists
      const seniorRelationships = graph.getContactRelationships('senior');
      const juniorRelationships = graph.getContactRelationships('junior');
      
      expect(seniorRelationships).toHaveLength(1);
      expect(seniorRelationships[0]).toMatchObject({
        relationshipType: 'mentor',
        sourceContact: 'senior',
        targetContact: 'junior'
      });
      
      expect(juniorRelationships).toHaveLength(0);
      
      console.log('✅ Non-reciprocal relationships do not create backlinks');
    });
  });

  describe('Bidirectional relationship removal', () => {
    it('should remove reciprocal relationships automatically', () => {
      // Add and then remove a friend relationship
      graph.addRelationshipWithReciprocal('alice', 'bob', 'friend');
      graph.removeRelationshipWithReciprocal('alice', 'bob', 'friend');
      
      // Check that both directions are removed
      const aliceRelationships = graph.getContactRelationships('alice');
      const bobRelationships = graph.getContactRelationships('bob');
      
      expect(aliceRelationships).toHaveLength(0);
      expect(bobRelationships).toHaveLength(0);
      
      console.log('✅ Bidirectional relationship removal works');
    });
  });
});