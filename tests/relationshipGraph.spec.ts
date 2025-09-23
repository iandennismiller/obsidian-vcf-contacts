import { describe, expect, it, beforeEach } from 'vitest';
import { RelationshipGraph, ContactNode, RelationshipEdge } from 'src/relationships/relationshipGraph';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  it('should add contacts to the graph', () => {
    const contact: ContactNode = {
      uid: 'test-uid-1',
      fullName: 'John Doe',
    };

    graph.addContact('john-doe', contact);
    
    expect(graph.hasContact('john-doe')).toBe(true);
    const allContacts = graph.getAllContacts();
    expect(allContacts.get('john-doe')).toEqual(contact);
  });

  it('should add relationships between contacts', () => {
    const john: ContactNode = { uid: 'john-uid', fullName: 'John Doe' };
    const jane: ContactNode = { uid: 'jane-uid', fullName: 'Jane Doe' };

    graph.addContact('john', john);
    graph.addContact('jane', jane);

    const relationship: RelationshipEdge = {
      kind: 'friend',
      genderless: 'friend'
    };

    graph.addRelationship('john', 'jane', relationship);

    const johnRelationships = graph.getRelationshipsForContact('john');
    expect(johnRelationships).toHaveLength(1);
    expect(johnRelationships[0].target).toBe('jane');
    expect(johnRelationships[0].relationship.kind).toBe('friend');
  });

  it('should remove relationships', () => {
    const john: ContactNode = { uid: 'john-uid', fullName: 'John Doe' };
    const jane: ContactNode = { uid: 'jane-uid', fullName: 'Jane Doe' };

    graph.addContact('john', john);
    graph.addContact('jane', jane);

    const relationship: RelationshipEdge = {
      kind: 'friend',
      genderless: 'friend'
    };

    graph.addRelationship('john', 'jane', relationship);
    expect(graph.getRelationshipsForContact('john')).toHaveLength(1);

    graph.removeRelationship('john', 'jane', 'friend');
    expect(graph.getRelationshipsForContact('john')).toHaveLength(0);
  });

  it('should find contacts by UID', () => {
    const john: ContactNode = { uid: 'john-uid', fullName: 'John Doe' };
    graph.addContact('john', john);

    const foundId = graph.findContact('john-uid');
    expect(foundId).toBe('john');
  });

  it('should find contacts by fullName', () => {
    const john: ContactNode = { uid: 'john-uid', fullName: 'John Doe' };
    graph.addContact('john', john);

    const foundId = graph.findContact('John Doe');
    expect(foundId).toBe('john');
  });

  it('should return null for non-existent contacts', () => {
    const foundId = graph.findContact('Non Existent');
    expect(foundId).toBeNull();
  });

  it('should clear all data', () => {
    const john: ContactNode = { uid: 'john-uid', fullName: 'John Doe' };
    graph.addContact('john', john);

    expect(graph.hasContact('john')).toBe(true);
    graph.clear();
    expect(graph.hasContact('john')).toBe(false);
  });

  it('should handle multiple relationships of different types', () => {
    const john: ContactNode = { uid: 'john-uid', fullName: 'John Doe' };
    const jane: ContactNode = { uid: 'jane-uid', fullName: 'Jane Doe' };

    graph.addContact('john', john);
    graph.addContact('jane', jane);

    const friendRelationship: RelationshipEdge = { kind: 'friend', genderless: 'friend' };
    const colleagueRelationship: RelationshipEdge = { kind: 'colleague', genderless: 'colleague' };

    graph.addRelationship('john', 'jane', friendRelationship);
    graph.addRelationship('john', 'jane', colleagueRelationship);

    const relationships = graph.getRelationshipsForContact('john');
    expect(relationships).toHaveLength(2);
    
    const kinds = relationships.map(r => r.relationship.kind).sort();
    expect(kinds).toEqual(['colleague', 'friend']);
  });
});