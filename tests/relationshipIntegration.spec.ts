import { describe, expect, it, beforeEach } from 'vitest';
import { RelationshipService } from 'src/relationships/relationshipService';
import { TFile } from 'obsidian';

describe('Relationship Integration Tests', () => {
  let relationshipService: RelationshipService;
  
  beforeEach(() => {
    relationshipService = new RelationshipService();
  });

  it('should handle complete relationship workflow', async () => {
    // Mock contacts data
    const johnContact = {
      file: { basename: 'John Doe', path: '/contacts/John Doe.md' } as TFile,
      data: {
        FN: 'John Doe',
        UID: 'john-uid-123',
        GENDER: 'M',
        VERSION: '4.0'
      }
    };

    const janeContact = {
      file: { basename: 'Jane Smith', path: '/contacts/Jane Smith.md' } as TFile,
      data: {
        FN: 'Jane Smith',
        UID: 'jane-uid-456',
        GENDER: 'F',
        VERSION: '4.0'
      }
    };

    const bobContact = {
      file: { basename: 'Bob Doe', path: '/contacts/Bob Doe.md' } as TFile,
      data: {
        FN: 'Bob Doe',
        UID: 'bob-uid-789',
        GENDER: 'M',
        VERSION: '4.0'
      }
    };

    // Initialize relationship graph with contacts
    await relationshipService.initializeFromContacts([johnContact, janeContact, bobContact]);

    // Verify contacts are in the graph
    const graph = relationshipService.getGraph();
    expect(graph.hasContact('john-uid-123')).toBe(true);
    expect(graph.hasContact('jane-uid-456')).toBe(true);
    expect(graph.hasContact('bob-uid-789')).toBe(true);

    // Add some relationships
    graph.addRelationship('john-uid-123', 'jane-uid-456', {
      kind: 'friend',
      genderless: 'friend'
    });

    graph.addRelationship('john-uid-123', 'bob-uid-789', {
      kind: 'brother',
      genderless: 'sibling'
    });

    graph.addRelationship('bob-uid-789', 'john-uid-123', {
      kind: 'brother',
      genderless: 'sibling'
    });

    // Test relationship queries
    const johnRelationships = graph.getRelationshipsForContact('john-uid-123');
    expect(johnRelationships).toHaveLength(2);
    
    const friendRelationship = johnRelationships.find(r => r.relationship.kind === 'friend');
    expect(friendRelationship).toBeDefined();
    expect(friendRelationship!.targetNode.fullName).toBe('Jane Smith');

    const siblingRelationship = johnRelationships.find(r => r.relationship.kind === 'brother');
    expect(siblingRelationship).toBeDefined();
    expect(siblingRelationship!.targetNode.fullName).toBe('Bob Doe');

    // Test bidirectional relationships
    const bobRelationships = graph.getRelationshipsForContact('bob-uid-789');
    expect(bobRelationships).toHaveLength(1);
    expect(bobRelationships[0].targetNode.fullName).toBe('John Doe');
  });

  it('should handle relationship type normalization', () => {
    const graph = relationshipService.getGraph();
    
    // Add contacts
    graph.addContact('john', {
      uid: 'john-uid',
      fullName: 'John Doe'
    });
    
    graph.addContact('jane', {
      uid: 'jane-uid',
      fullName: 'Jane Doe'
    });

    // Add a gendered relationship
    graph.addRelationship('john', 'jane', {
      kind: 'father',
      genderless: 'parent'
    });

    const relationships = graph.getRelationshipsForContact('john');
    expect(relationships).toHaveLength(1);
    expect(relationships[0].relationship.kind).toBe('father');
    expect(relationships[0].relationship.genderless).toBe('parent');
  });

  it('should handle contact removal', () => {
    const graph = relationshipService.getGraph();
    
    // Add contacts
    graph.addContact('john', { uid: 'john-uid', fullName: 'John Doe' });
    graph.addContact('jane', { uid: 'jane-uid', fullName: 'Jane Doe' });
    
    // Add relationship
    graph.addRelationship('john', 'jane', {
      kind: 'friend',
      genderless: 'friend'
    });

    // Verify relationship exists
    expect(graph.getRelationshipsForContact('john')).toHaveLength(1);

    // Remove contact
    graph.removeContact('jane');

    // Verify contact and relationships are gone
    expect(graph.hasContact('jane')).toBe(false);
    expect(graph.getRelationshipsForContact('john')).toHaveLength(0);
  });

  it('should find contacts by UID and fullName', () => {
    const graph = relationshipService.getGraph();
    
    graph.addContact('node1', {
      uid: 'unique-id-123',
      fullName: 'John Doe'
    });

    // Find by UID
    expect(graph.findContact('unique-id-123')).toBe('node1');
    
    // Find by fullName
    expect(graph.findContact('John Doe')).toBe('node1');
    
    // Not found
    expect(graph.findContact('Non Existent')).toBeNull();
  });
});