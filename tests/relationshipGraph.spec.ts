import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph, GENDERED_RELATIONSHIPS } from '../src/services/relationshipGraph';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  it('should add contacts to the graph', () => {
    graph.addContact('contact1', { name: 'John Doe' });
    graph.addContact('contact2', { name: 'Jane Doe' });

    const contacts = graph.getAllContacts();
    expect(contacts).toContain('contact1');
    expect(contacts).toContain('contact2');
    expect(contacts).toHaveLength(2);
  });

  it('should add relationships between contacts', () => {
    graph.addContact('contact1');
    graph.addContact('contact2');
    
    graph.addRelationship('contact1', 'contact2', 'friend');

    const relationships = graph.getContactRelationships('contact1');
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toEqual({
      relationshipType: 'friend',
      sourceContact: 'contact1',
      targetContact: 'contact2'
    });
  });

  it('should handle multiple relationship types between same contacts', () => {
    graph.addContact('contact1');
    graph.addContact('contact2');
    
    graph.addRelationship('contact1', 'contact2', 'friend');
    graph.addRelationship('contact1', 'contact2', 'colleague');

    const relationships = graph.getContactRelationships('contact1');
    expect(relationships).toHaveLength(1); // DirectedGraph allows one edge per direction
    // The second relationship should overwrite the first
    expect(relationships[0].relationshipType).toBe('colleague');
  });

  it('should check if relationships exist', () => {
    graph.addContact('contact1');
    graph.addContact('contact2');
    graph.addRelationship('contact1', 'contact2', 'friend');

    expect(graph.hasRelationship('contact1', 'contact2', 'friend')).toBe(true);
    expect(graph.hasRelationship('contact1', 'contact2', 'enemy')).toBe(false);
    expect(graph.hasRelationship('contact2', 'contact1', 'friend')).toBe(false);
  });

  it('should get incoming relationships', () => {
    graph.addContact('contact1');
    graph.addContact('contact2');
    graph.addRelationship('contact1', 'contact2', 'friend');

    const incomingRels = graph.getIncomingRelationships('contact2');
    expect(incomingRels).toHaveLength(1);
    expect(incomingRels[0]).toEqual({
      relationshipType: 'friend',
      sourceContact: 'contact1',
      targetContact: 'contact2'
    });
  });

  it('should remove relationships', () => {
    graph.addContact('contact1');
    graph.addContact('contact2');
    graph.addRelationship('contact1', 'contact2', 'friend');

    expect(graph.hasRelationship('contact1', 'contact2', 'friend')).toBe(true);
    
    graph.removeRelationship('contact1', 'contact2', 'friend');
    
    expect(graph.hasRelationship('contact1', 'contact2', 'friend')).toBe(false);
  });

  it('should remove contacts and all their relationships', () => {
    graph.addContact('contact1');
    graph.addContact('contact2');
    graph.addContact('contact3');
    
    graph.addRelationship('contact1', 'contact2', 'friend');
    graph.addRelationship('contact3', 'contact1', 'colleague');

    graph.removeContact('contact1');

    expect(graph.getAllContacts()).not.toContain('contact1');
    expect(graph.getContactRelationships('contact1')).toHaveLength(0);
    expect(graph.getIncomingRelationships('contact2')).toHaveLength(0);
  });

  it('should serialize and deserialize graph', () => {
    graph.addContact('contact1', { name: 'John' });
    graph.addContact('contact2', { name: 'Jane' });
    graph.addRelationship('contact1', 'contact2', 'friend');

    const serialized = graph.serialize();
    
    const newGraph = new RelationshipGraph();
    newGraph.deserialize(serialized);

    expect(newGraph.getAllContacts()).toEqual(graph.getAllContacts());
    expect(newGraph.getContactRelationships('contact1')).toEqual(
      graph.getContactRelationships('contact1')
    );
  });

  describe('relationship type normalization', () => {
    it('should normalize gendered relationship types', () => {
      expect(RelationshipGraph.normalizeRelationshipType('mother')).toBe('parent');
      expect(RelationshipGraph.normalizeRelationshipType('father')).toBe('parent');
      expect(RelationshipGraph.normalizeRelationshipType('aunt')).toBe('auncle');
      expect(RelationshipGraph.normalizeRelationshipType('uncle')).toBe('auncle');
      expect(RelationshipGraph.normalizeRelationshipType('friend')).toBe('friend');
    });

    it('should extract gender from relationship types', () => {
      expect(RelationshipGraph.getGenderFromRelationship('mother')).toBe('F');
      expect(RelationshipGraph.getGenderFromRelationship('father')).toBe('M');
      expect(RelationshipGraph.getGenderFromRelationship('sister')).toBe('F');
      expect(RelationshipGraph.getGenderFromRelationship('brother')).toBe('M');
      expect(RelationshipGraph.getGenderFromRelationship('friend')).toBeNull();
    });
  });

  it('should clear all data', () => {
    graph.addContact('contact1');
    graph.addContact('contact2');
    graph.addRelationship('contact1', 'contact2', 'friend');

    graph.clear();

    expect(graph.getAllContacts()).toHaveLength(0);
  });
});