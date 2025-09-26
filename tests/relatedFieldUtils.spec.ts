import { describe, it, expect } from 'vitest';
import { ContactNote } from 'src/contacts/contactNote';

// Create a test ContactNote instance for testing static methods
const createTestContactNote = () => new ContactNote(null as any, null as any, null as any);

describe('relatedFieldUtils', () => {
  describe('formatRelatedValue', () => {
    it('should format UUID as urn:uuid:', () => {
      const contactNote = createTestContactNote();
      const uid = '03a0e51f-d1aa-4385-8a53-e29025acd8af';
      const name = 'John Doe';
      const result = contactNote.formatRelatedValue(uid, name);
      expect(result).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    });

    it('should format non-UUID as uid:', () => {
      const contactNote = createTestContactNote();
      const uid = 'some-custom-uid';
      const name = 'John Doe';
      const result = contactNote.formatRelatedValue(uid, name);
      expect(result).toBe('uid:some-custom-uid');
    });

    it('should format name when no UID', () => {
      const contactNote = createTestContactNote();
      const uid = '';
      const name = 'John Doe';
      const result = contactNote.formatRelatedValue(uid, name);
      expect(result).toBe('name:John Doe');
    });

    it('should handle uppercase UUID', () => {
      const contactNote = createTestContactNote();
      const uid = '03A0E51F-D1AA-4385-8A53-E29025ACD8AF';
      const name = 'John Doe';
      const result = contactNote.formatRelatedValue(uid, name);
      expect(result).toBe('urn:uuid:03A0E51F-D1AA-4385-8A53-E29025ACD8AF');
    });
  });

  describe('parseRelatedValue', () => {
    it('should parse urn:uuid: format', () => {
      const contactNote = createTestContactNote();
      const value = 'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af';
      const result = contactNote.parseRelatedValue(value);
      expect(result).toEqual({ type: 'uuid', value: '03a0e51f-d1aa-4385-8a53-e29025acd8af' });
    });

    it('should parse uid: format', () => {
      const contactNote = createTestContactNote();
      const value = 'uid:some-custom-uid';
      const result = contactNote.parseRelatedValue(value);
      expect(result).toEqual({ type: 'uid', value: 'some-custom-uid' });
    });

    it('should parse name: format', () => {
      const contactNote = createTestContactNote();
      const value = 'name:John Doe';
      const result = contactNote.parseRelatedValue(value);
      expect(result).toEqual({ type: 'name', value: 'John Doe' });
    });

    it('should return null for invalid format', () => {
      const contactNote = createTestContactNote();
      const value = 'invalid-format';
      const result = contactNote.parseRelatedValue(value);
      expect(result).toBe(null);
    });
  });

  describe('extractRelationshipType', () => {
    it('should extract type from RELATED[type] format', () => {
      const contactNote = createTestContactNote();
      const key = 'RELATED[parent]';
      const result = contactNote.extractRelationshipType(key);
      expect(result).toBe('parent');
    });

    it('should extract type from RELATED[index:type] format', () => {
      const contactNote = createTestContactNote();
      const key = 'RELATED[1:child]';
      const result = contactNote.extractRelationshipType(key);
      expect(result).toBe('child');
    });

    it('should return "related" for plain RELATED', () => {
      const contactNote = createTestContactNote();
      const key = 'RELATED';
      const result = contactNote.extractRelationshipType(key);
      expect(result).toBe('related');
    });

    it('should handle case insensitivity', () => {
      const contactNote = createTestContactNote();
      const key = 'RELATED[PARENT]';
      const result = contactNote.extractRelationshipType(key);
      expect(result).toBe('PARENT');
    });
  });
});
