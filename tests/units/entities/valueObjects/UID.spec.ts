/**
 * Tests for UID value object
 */

import { describe, it, expect } from 'vitest';
import { UID } from '../../../../src/models/contactNote/entities/valueObjects/UID';

describe('UID Value Object', () => {
  describe('generate()', () => {
    it('should generate a new UID', () => {
      const uid = UID.generate();
      expect(uid).toBeDefined();
      expect(uid.getValue()).toBeTruthy();
      expect(uid.getValue().length).toBeGreaterThan(0);
    });
    
    it('should generate unique UIDs', () => {
      const uid1 = UID.generate();
      const uid2 = UID.generate();
      expect(uid1.equals(uid2)).toBe(false);
    });
    
    it('should generate valid UUID format', () => {
      const uid = UID.generate();
      expect(uid.isUUID()).toBe(true);
      expect(uid.isValid()).toBe(true);
    });
    
    it('should generate UIDs in standard UUID format', () => {
      const uid = UID.generate();
      const value = uid.getValue();
      // UUID format: 8-4-4-4-12
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(value)).toBe(true);
    });
  });
  
  describe('fromString()', () => {
    it('should create from plain UUID string', () => {
      const uuidStr = '550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromString(uuidStr);
      expect(uid.getValue()).toBe(uuidStr);
    });
    
    it('should create from URN format', () => {
      const urn = 'urn:uuid:550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromString(urn);
      expect(uid.getValue()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
    
    it('should create from wikilink format', () => {
      const wikilink = '[[550e8400-e29b-41d4-a716-446655440000]]';
      const uid = UID.fromString(wikilink);
      expect(uid.getValue()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
    
    it('should create from custom UID format', () => {
      const customUid = 'contact-123-abc';
      const uid = UID.fromString(customUid);
      expect(uid.getValue()).toBe(customUid);
    });
    
    it('should handle leading/trailing whitespace', () => {
      const uuidStr = '  550e8400-e29b-41d4-a716-446655440000  ';
      const uid = UID.fromString(uuidStr);
      expect(uid.getValue()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
    
    it('should throw error for null', () => {
      expect(() => UID.fromString(null)).toThrow('UID cannot be empty');
    });
    
    it('should throw error for undefined', () => {
      expect(() => UID.fromString(undefined)).toThrow('UID cannot be empty');
    });
    
    it('should throw error for empty string', () => {
      expect(() => UID.fromString('')).toThrow('UID cannot be empty');
    });
    
    it('should throw error for whitespace only', () => {
      expect(() => UID.fromString('   ')).toThrow('UID cannot be empty');
    });
    
    it('should throw error for invalid characters', () => {
      expect(() => UID.fromString('invalid uid with spaces')).toThrow('Invalid UID format');
    });
    
    it('should throw error for too short UID', () => {
      expect(() => UID.fromString('ab')).toThrow('Invalid UID format');
    });
  });
  
  describe('fromUUID()', () => {
    it('should create from valid UUID', () => {
      const uuidStr = '550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromUUID(uuidStr);
      expect(uid.getValue()).toBe(uuidStr);
    });
    
    it('should handle uppercase UUID', () => {
      const uuidStr = '550E8400-E29B-41D4-A716-446655440000';
      const uid = UID.fromUUID(uuidStr);
      expect(uid.getValue()).toBe(uuidStr);
    });
    
    it('should throw error for invalid UUID format', () => {
      expect(() => UID.fromUUID('not-a-uuid')).toThrow('Invalid UUID format');
    });
    
    it('should throw error for UUID with wrong segment lengths', () => {
      expect(() => UID.fromUUID('550e8400-e29b-41d4-a716-4466554400')).toThrow('Invalid UUID format');
    });
  });
  
  describe('fromURN()', () => {
    it('should create from valid URN', () => {
      const urn = 'urn:uuid:550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromURN(urn);
      expect(uid.getValue()).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
    
    it('should throw error for non-URN format', () => {
      expect(() => UID.fromURN('550e8400-e29b-41d4-a716-446655440000')).toThrow('Invalid URN format');
    });
    
    it('should throw error for URN with invalid UUID', () => {
      expect(() => UID.fromURN('urn:uuid:not-a-uuid')).toThrow('Invalid UUID in URN');
    });
    
    it('should throw error for wrong URN prefix', () => {
      expect(() => UID.fromURN('urn:oid:550e8400-e29b-41d4-a716-446655440000')).toThrow('Invalid URN format');
    });
  });
  
  describe('validate()', () => {
    it('should validate UUID format', () => {
      expect(UID.validate('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });
    
    it('should validate custom UID format', () => {
      expect(UID.validate('contact-123')).toBe(true);
      expect(UID.validate('user_456')).toBe(true);
      expect(UID.validate('abc.def')).toBe(true);
    });
    
    it('should accept alphanumeric with dashes, underscores, dots', () => {
      expect(UID.validate('abc-123')).toBe(true);
      expect(UID.validate('abc_123')).toBe(true);
      expect(UID.validate('abc.123')).toBe(true);
      expect(UID.validate('abc-123_456.789')).toBe(true);
    });
    
    it('should require at least 3 characters', () => {
      expect(UID.validate('ab')).toBe(false);
      expect(UID.validate('abc')).toBe(true);
    });
    
    it('should reject empty string', () => {
      expect(UID.validate('')).toBe(false);
    });
    
    it('should reject null values', () => {
      expect(UID.validate(null as any)).toBe(false);
    });
    
    it('should reject whitespace only', () => {
      expect(UID.validate('   ')).toBe(false);
    });
    
    it('should reject invalid characters', () => {
      expect(UID.validate('abc 123')).toBe(false);
      expect(UID.validate('abc@123')).toBe(false);
      expect(UID.validate('abc#123')).toBe(false);
    });
  });
  
  describe('getValue()', () => {
    it('should return the UID value', () => {
      const uuidStr = '550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromString(uuidStr);
      expect(uid.getValue()).toBe(uuidStr);
    });
  });
  
  describe('toURN()', () => {
    it('should convert to URN format', () => {
      const uuidStr = '550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromString(uuidStr);
      expect(uid.toURN()).toBe('urn:uuid:550e8400-e29b-41d4-a716-446655440000');
    });
    
    it('should work with custom UIDs', () => {
      const uid = UID.fromString('contact-123');
      expect(uid.toURN()).toBe('urn:uuid:contact-123');
    });
  });
  
  describe('toUUID()', () => {
    it('should return UUID part', () => {
      const uuidStr = '550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromString(uuidStr);
      expect(uid.toUUID()).toBe(uuidStr);
    });
  });
  
  describe('isValid()', () => {
    it('should return true for valid UID', () => {
      const uid = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      expect(uid.isValid()).toBe(true);
    });
    
    it('should return true for custom UID', () => {
      const uid = UID.fromString('contact-123');
      expect(uid.isValid()).toBe(true);
    });
  });
  
  describe('isUUID()', () => {
    it('should return true for UUID format', () => {
      const uid = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      expect(uid.isUUID()).toBe(true);
    });
    
    it('should return false for custom UID format', () => {
      const uid = UID.fromString('contact-123');
      expect(uid.isUUID()).toBe(false);
    });
  });
  
  describe('equals()', () => {
    it('should return true for same UID value', () => {
      const uid1 = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      const uid2 = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      expect(uid1.equals(uid2)).toBe(true);
    });
    
    it('should return false for different UID values', () => {
      const uid1 = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      const uid2 = UID.fromString('550e8400-e29b-41d4-a716-446655440001');
      expect(uid1.equals(uid2)).toBe(false);
    });
    
    it('should handle comparison with URN-created UID', () => {
      const uid1 = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      const uid2 = UID.fromURN('urn:uuid:550e8400-e29b-41d4-a716-446655440000');
      expect(uid1.equals(uid2)).toBe(true);
    });
    
    it('should return false for null', () => {
      const uid = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      expect(uid.equals(null)).toBe(false);
    });
    
    it('should return false for undefined', () => {
      const uid = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      expect(uid.equals(undefined)).toBe(false);
    });
  });
  
  describe('toString()', () => {
    it('should return UID value', () => {
      const uuidStr = '550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromString(uuidStr);
      expect(uid.toString()).toBe(uuidStr);
    });
  });
  
  describe('Immutability', () => {
    it('should not allow modification of value', () => {
      const uid = UID.fromString('550e8400-e29b-41d4-a716-446655440000');
      const value1 = uid.getValue();
      const value2 = uid.getValue();
      expect(value1).toBe(value2);
    });
    
    it('should always return same value', () => {
      const uid = UID.fromString('contact-123');
      expect(uid.getValue()).toBe('contact-123');
      expect(uid.getValue()).toBe('contact-123');
      expect(uid.getValue()).toBe('contact-123');
    });
  });
  
  describe('Round-trip Conversions', () => {
    it('should round-trip through URN format', () => {
      const original = '550e8400-e29b-41d4-a716-446655440000';
      const uid = UID.fromString(original);
      const urn = uid.toURN();
      const converted = UID.fromURN(urn);
      expect(converted.getValue()).toBe(original);
    });
    
    it('should round-trip from various input formats', () => {
      const formats = [
        '550e8400-e29b-41d4-a716-446655440000',
        'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
        '[[550e8400-e29b-41d4-a716-446655440000]]'
      ];
      
      formats.forEach(format => {
        const uid = UID.fromString(format);
        expect(uid.getValue()).toBe('550e8400-e29b-41d4-a716-446655440000');
      });
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle mixed case UUID', () => {
      const uid = UID.fromString('550E8400-e29b-41D4-a716-446655440000');
      expect(uid.getValue()).toBe('550E8400-e29b-41D4-a716-446655440000');
      expect(uid.isValid()).toBe(true);
    });
    
    it('should preserve original case', () => {
      const original = '550E8400-E29B-41D4-A716-446655440000';
      const uid = UID.fromString(original);
      expect(uid.getValue()).toBe(original);
    });
    
    it('should handle custom UID with various valid characters', () => {
      const customId = 'contact-123_abc.def';
      const uid = UID.fromString(customId);
      expect(uid.getValue()).toBe(customId);
      expect(uid.isValid()).toBe(true);
    });
  });
});
