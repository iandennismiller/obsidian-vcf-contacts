import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipGraphService } from 'src/services/relationshipGraph';

describe('RelationshipGraphService', () => {
  let service: RelationshipGraphService;

  beforeEach(() => {
    service = new RelationshipGraphService();
  });

  it('should add and retrieve contact nodes', () => {
    const contact = {
      uid: '12345',
      fullName: 'John Doe',
      gender: 'male'
    };

    const contactId = service.generateContactId(contact);
    service.addContactNode(contactId, contact);

    const retrieved = service.getContactNode(contactId);
    expect(retrieved).toEqual(contact);
  });

  it('should generate correct contact IDs', () => {
    const uuidContact = {
      uid: '03a0e51f-d1aa-4385-8a53-e29025acd8af',
      fullName: 'UUID User'
    };
    expect(service.generateContactId(uuidContact)).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');

    const uidContact = {
      uid: 'some-id',
      fullName: 'UID User'
    };
    expect(service.generateContactId(uidContact)).toBe('uid:some-id');

    const nameContact = {
      uid: null,
      fullName: 'Name User'
    };
    expect(service.generateContactId(nameContact)).toBe('name:Name User');
  });

  it('should add and retrieve relationships', () => {
    const contact1 = { uid: '1', fullName: 'Alice' };
    const contact2 = { uid: '2', fullName: 'Bob' };

    const id1 = service.generateContactId(contact1);
    const id2 = service.generateContactId(contact2);

    service.addContactNode(id1, contact1);
    service.addContactNode(id2, contact2);

    service.addRelationship(id1, id2, 'friend');

    const relationships = service.getContactRelationships(id1);
    expect(relationships).toHaveLength(1);
    expect(relationships[0].kind).toBe('friend');
    expect(relationships[0].targetContactId).toBe(id2);
  });

  it('should parse contact references correctly', () => {
    const uuidRef = service.parseContactReference('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    expect(uuidRef).toEqual({ namespace: 'urn:uuid', value: '03a0e51f-d1aa-4385-8a53-e29025acd8af' });

    const uidRef = service.parseContactReference('uid:some-id');
    expect(uidRef).toEqual({ namespace: 'uid', value: 'some-id' });

    const nameRef = service.parseContactReference('name:John Doe');
    expect(nameRef).toEqual({ namespace: 'name', value: 'John Doe' });

    const invalid = service.parseContactReference('invalid:format');
    expect(invalid).toBeNull();
  });

  it('should provide graph statistics', () => {
    const contact1 = { uid: '1', fullName: 'Alice' };
    const contact2 = { uid: '2', fullName: 'Bob' };

    const id1 = service.generateContactId(contact1);
    const id2 = service.generateContactId(contact2);

    service.addContactNode(id1, contact1);
    service.addContactNode(id2, contact2);
    service.addRelationship(id1, id2, 'friend');

    const stats = service.getGraphStats();
    expect(stats.nodeCount).toBe(2);
    expect(stats.edgeCount).toBe(1);
  });
});