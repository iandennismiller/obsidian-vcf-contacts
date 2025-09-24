import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph, Gender, RelationshipType } from '../src/relationships/relationshipGraph';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  it('should add contacts to the graph', () => {
    const uid = 'test-uid-1';
    const fullName = 'John Doe';
    const gender: Gender = 'M';

    graph.addContact(uid, fullName, gender);
    
    const contact = graph.getContact(uid);
    expect(contact).toBeDefined();
    expect(contact?.fullName).toBe(fullName);
    expect(contact?.gender).toBe(gender);
  });

  it('should update existing contacts', () => {
    const uid = 'test-uid-1';
    graph.addContact(uid, 'John Doe', 'M');
    
    // Update the contact
    graph.addContact(uid, 'John Smith', 'M');
    
    const contact = graph.getContact(uid);
    expect(contact?.fullName).toBe('John Smith');
  });

  it('should add relationships between contacts', () => {
    const uid1 = 'test-uid-1';
    const uid2 = 'test-uid-2';
    
    graph.addContact(uid1, 'John Doe', 'M');
    graph.addContact(uid2, 'Jane Doe', 'F');
    
    graph.addRelationship(uid1, uid2, 'spouse');
    
    const relationships = graph.getContactRelationships(uid1);
    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe('spouse');
    expect(relationships[0].targetUid).toBe(uid2);
  });

  it('should remove relationships', () => {
    const uid1 = 'test-uid-1';
    const uid2 = 'test-uid-2';
    
    graph.addContact(uid1, 'John Doe', 'M');
    graph.addContact(uid2, 'Jane Doe', 'F');
    
    graph.addRelationship(uid1, uid2, 'spouse');
    graph.removeRelationship(uid1, uid2, 'spouse');
    
    const relationships = graph.getContactRelationships(uid1);
    expect(relationships).toHaveLength(0);
  });

  it('should handle multiple relationships between contacts', () => {
    const uid1 = 'test-uid-1';
    const uid2 = 'test-uid-2';
    
    graph.addContact(uid1, 'John Doe', 'M');
    graph.addContact(uid2, 'Jane Doe', 'F');
    
    graph.addRelationship(uid1, uid2, 'spouse');
    graph.addRelationship(uid1, uid2, 'friend');
    
    const relationships = graph.getContactRelationships(uid1);
    expect(relationships).toHaveLength(2);
    expect(relationships.map(r => r.type).sort()).toEqual(['friend', 'spouse']);
  });

  it('should convert relationships to vCard RELATED fields', () => {
    const uid1 = 'test-uid-1';
    const uid2 = '550e8400-e29b-41d4-a716-446655440000';
    
    graph.addContact(uid1, 'John Doe', 'M');
    graph.addContact(uid2, 'Jane Doe', 'F');
    
    graph.addRelationship(uid1, uid2, 'spouse');
    
    const relatedFields = graph.contactToRelatedFields(uid1);
    expect(relatedFields).toHaveLength(1);
    expect(relatedFields[0].type).toBe('spouse');
    expect(relatedFields[0].value).toBe('urn:uuid:550e8400-e29b-41d4-a716-446655440000');
  });

  it('should handle non-UUID UIDs', () => {
    const uid1 = 'test-uid-1';
    const uid2 = 'simple-uid-2';
    
    graph.addContact(uid1, 'John Doe', 'M');
    graph.addContact(uid2, 'Jane Doe', 'F');
    
    graph.addRelationship(uid1, uid2, 'spouse');
    
    const relatedFields = graph.contactToRelatedFields(uid1);
    expect(relatedFields[0].value).toBe('uid:simple-uid-2');
  });

  it('should sort relationships deterministically', () => {
    const uid1 = 'test-uid-1';
    const uid2 = 'test-uid-2';
    const uid3 = 'test-uid-3';
    
    graph.addContact(uid1, 'John Doe', 'M');
    graph.addContact(uid2, 'Jane Doe', 'F');
    graph.addContact(uid3, 'Bob Smith', 'M');
    
    // Add relationships in random order
    graph.addRelationship(uid1, uid3, 'friend');
    graph.addRelationship(uid1, uid2, 'spouse');
    graph.addRelationship(uid1, uid3, 'colleague');
    
    const relationships = graph.getContactRelationships(uid1);
    
    // Should be sorted by type first, then by name
    expect(relationships[0].type).toBe('colleague');
    expect(relationships[1].type).toBe('friend');
    expect(relationships[2].type).toBe('spouse');
  });

  it('should check graph consistency', () => {
    const uid1 = 'test-uid-1';
    const uid2 = 'test-uid-2';
    
    graph.addContact(uid1, 'John Doe', 'M');
    graph.addContact(uid2, 'Jane Doe', 'F');
    
    // Add only one direction of the relationship
    graph.addRelationship(uid1, uid2, 'spouse');
    
    const inconsistencies = graph.checkConsistency();
    expect(inconsistencies).toHaveLength(1);
    expect(inconsistencies[0].fromUid).toBe(uid2);
    expect(inconsistencies[0].toUid).toBe(uid1);
    expect(inconsistencies[0].type).toBe('spouse');
  });

  it('should handle parent-child relationships correctly', () => {
    const parentUid = 'parent-uid';
    const childUid = 'child-uid';
    
    graph.addContact(parentUid, 'John Doe', 'M');
    graph.addContact(childUid, 'Jane Doe', 'F');
    
    graph.addRelationship(parentUid, childUid, 'child');
    
    const inconsistencies = graph.checkConsistency();
    expect(inconsistencies).toHaveLength(1);
    expect(inconsistencies[0].type).toBe('parent');
  });
});