// @vitest-skip - Deprecated: This test was for individual utility modules that have been consolidated into ContactNote
import.meta.env.VITEST_SKIP = true;
import { describe, it, expect } from 'vitest';
import { formatRelatedValue, parseRelatedValue, extractRelationshipType } from 'src/util/relatedFieldUtils';

describe('relatedFieldUtils', () => {
  describe('formatRelatedValue', () => {
    it('should format UUID as urn:uuid:', () => {
      const uid = '03a0e51f-d1aa-4385-8a53-e29025acd8af';
      const name = 'John Doe';
      const result = formatRelatedValue(uid, name);
      expect(result).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    });

    it('should format non-UUID as uid:', () => {
      const uid = 'some-custom-uid';
      const name = 'John Doe';
      const result = formatRelatedValue(uid, name);
      expect(result).toBe('uid:some-custom-uid');
    });

    it('should format name when no UID', () => {
      const uid = '';
      const name = 'John Doe';
      const result = formatRelatedValue(uid, name);
      expect(result).toBe('name:John Doe');
    });

    it('should handle uppercase UUID', () => {
      const uid = '03A0E51F-D1AA-4385-8A53-E29025ACD8AF';
      const name = 'John Doe';
      const result = formatRelatedValue(uid, name);
      expect(result).toBe('urn:uuid:03A0E51F-D1AA-4385-8A53-E29025ACD8AF');
    });
  });

  describe('parseRelatedValue', () => {
    it('should parse urn:uuid: format', () => {
      const value = 'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af';
      const result = parseRelatedValue(value);
      expect(result).toEqual({
        type: 'uuid',
        value: '03a0e51f-d1aa-4385-8a53-e29025acd8af'
      });
    });

    it('should parse uid: format', () => {
      const value = 'uid:some-custom-uid';
      const result = parseRelatedValue(value);
      expect(result).toEqual({
        type: 'uid',
        value: 'some-custom-uid'
      });
    });

    it('should parse name: format', () => {
      const value = 'name:John Doe';
      const result = parseRelatedValue(value);
      expect(result).toEqual({
        type: 'name',
        value: 'John Doe'
      });
    });

    it('should return null for invalid format', () => {
      const value = 'invalid-format';
      const result = parseRelatedValue(value);
      expect(result).toBeNull();
    });
  });

  describe('extractRelationshipType', () => {
    it('should extract simple type from RELATED[friend]', () => {
      const key = 'RELATED[friend]';
      const result = extractRelationshipType(key);
      expect(result).toBe('friend');
    });

    it('should extract indexed type from RELATED[1:colleague]', () => {
      const key = 'RELATED[1:colleague]';
      const result = extractRelationshipType(key);
      expect(result).toBe('colleague');
    });

    it('should return "related" for plain RELATED key', () => {
      const key = 'RELATED';
      const result = extractRelationshipType(key);
      expect(result).toBe('related');
    });

    it('should handle empty brackets', () => {
      const key = 'RELATED[]';
      const result = extractRelationshipType(key);
      expect(result).toBe('related');
    });
  });
});