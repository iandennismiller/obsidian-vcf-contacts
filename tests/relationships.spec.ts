/**
 * @fileoverview Tests for VCard RELATED field support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraphService } from '../src/relationships/relationshipGraph';

describe('VCard RELATED field support', () => {
  describe('RelationshipGraphService', () => {
    let service: RelationshipGraphService;

    beforeEach(() => {
      service = new RelationshipGraphService();
    });

    it('should parse gendered relationship terms correctly', () => {
      const mother = service.parseRelationshipTerm('mother');
      expect(mother.kind).toBe('parent');
      expect(mother.inferredGender).toBe('female');

      const father = service.parseRelationshipTerm('father');
      expect(father.kind).toBe('parent');
      expect(father.inferredGender).toBe('male');

      const friend = service.parseRelationshipTerm('friend');
      expect(friend.kind).toBe('friend');
      expect(friend.inferredGender).toBeUndefined();
    });

    it('should add and retrieve relationships', () => {
      const uid1 = 'urn:uuid:12345678-1234-1234-1234-123456789abc';
      const uid2 = 'urn:uuid:87654321-4321-4321-4321-cba987654321';

      service.addContact({ uid: uid1, name: 'John Doe' });
      service.addContact({ uid: uid2, name: 'Jane Doe' });
      
      service.addRelationship(uid1, uid2, 'friend');

      const relationships = service.getRelationships(uid1);
      expect(relationships).toHaveLength(1);
      expect(relationships[0].kind).toBe('friend');
      expect(relationships[0].targetUID).toBe(uid2);
    });

    it('should convert relationships to front matter format', () => {
      const uid1 = 'urn:uuid:12345678-1234-1234-1234-123456789abc';
      const uid2 = 'urn:uuid:87654321-4321-4321-4321-cba987654321';
      const uid3 = 'name:Missing Person';

      service.addContact({ uid: uid1, name: 'John Doe' });
      service.addRelationship(uid1, uid2, 'friend');
      service.addRelationship(uid1, uid3, 'friend');
      service.addRelationship(uid1, uid2, 'colleague');

      const frontMatterEntries = service.relationshipsToFrontMatter(uid1);
      
      // Should have both colleague and friend entries, with friend having multiple entries
      expect(frontMatterEntries.length).toBeGreaterThan(0);
      
      const relatedKeys = frontMatterEntries.map(([key]) => key);
      expect(relatedKeys).toContain('RELATED[colleague]');
      expect(relatedKeys.some(k => k.startsWith('RELATED[') && k.includes('friend'))).toBe(true);
    });

    it('should parse front matter to graph correctly', () => {
      const uid1 = 'urn:uuid:12345678-1234-1234-1234-123456789abc';
      const frontMatter = {
        'UID': uid1,
        'RELATED[friend]': 'urn:uuid:87654321-4321-4321-4321-cba987654321',
        'RELATED[1:friend]': 'name:Missing Person',
        'RELATED[parent]': 'urn:uuid:11111111-1111-1111-1111-111111111111'
      };

      service.frontMatterToGraph(uid1, frontMatter);
      const relationships = service.getRelationships(uid1);

      expect(relationships).toHaveLength(3);
      
      const kinds = relationships.map(r => r.kind);
      expect(kinds).toContain('friend');
      expect(kinds).toContain('parent');
    });

    it('should check consistency and find missing reciprocals', () => {
      const uid1 = 'urn:uuid:12345678-1234-1234-1234-123456789abc';
      const uid2 = 'urn:uuid:87654321-4321-4321-4321-cba987654321';

      service.addContact({ uid: uid1, name: 'John Doe' });
      service.addContact({ uid: uid2, name: 'Jane Doe' });
      
      // Add a parent->child relationship without reciprocal
      service.addRelationship(uid1, uid2, 'child');

      const missingReciprocals = service.checkConsistency();
      expect(missingReciprocals).toHaveLength(1);
      expect(missingReciprocals[0].sourceUID).toBe(uid2);
      expect(missingReciprocals[0].targetUID).toBe(uid1);
      expect(missingReciprocals[0].kind).toBe('parent');
    });
  });
});