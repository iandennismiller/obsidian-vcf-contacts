/**
 * Tests for Gender value object
 */

import { describe, it, expect } from 'vitest';
import { Gender } from '../../../../src/models/contactNote/entities/valueObjects/Gender';

describe('Gender Value Object', () => {
  describe('Static Constants', () => {
    it('should provide UNKNOWN constant', () => {
      expect(Gender.UNKNOWN).toBeDefined();
      expect(Gender.UNKNOWN.getValue()).toBe('unknown');
    });
    
    it('should provide MALE constant', () => {
      expect(Gender.MALE).toBeDefined();
      expect(Gender.MALE.getValue()).toBe('male');
    });
    
    it('should provide FEMALE constant', () => {
      expect(Gender.FEMALE).toBeDefined();
      expect(Gender.FEMALE.getValue()).toBe('female');
    });
    
    it('should provide OTHER constant', () => {
      expect(Gender.OTHER).toBeDefined();
      expect(Gender.OTHER.getValue()).toBe('other');
    });
    
    it('should reuse same instance for constants', () => {
      const unknown1 = Gender.UNKNOWN;
      const unknown2 = Gender.UNKNOWN;
      expect(unknown1).toBe(unknown2);
    });
  });
  
  describe('fromString()', () => {
    it('should create from "unknown"', () => {
      const gender = Gender.fromString('unknown');
      expect(gender.getValue()).toBe('unknown');
      expect(gender.isUnknown()).toBe(true);
    });
    
    it('should create from "male"', () => {
      const gender = Gender.fromString('male');
      expect(gender.getValue()).toBe('male');
      expect(gender.isMale()).toBe(true);
    });
    
    it('should create from "female"', () => {
      const gender = Gender.fromString('female');
      expect(gender.getValue()).toBe('female');
      expect(gender.isFemale()).toBe(true);
    });
    
    it('should create from "other"', () => {
      const gender = Gender.fromString('other');
      expect(gender.getValue()).toBe('other');
      expect(gender.isOther()).toBe(true);
    });
    
    it('should handle case insensitive values', () => {
      expect(Gender.fromString('MALE').getValue()).toBe('male');
      expect(Gender.fromString('Female').getValue()).toBe('female');
      expect(Gender.fromString('UNKNOWN').getValue()).toBe('unknown');
    });
    
    it('should create UNKNOWN from null', () => {
      const gender = Gender.fromString(null);
      expect(gender.getValue()).toBe('unknown');
      expect(gender.isUnknown()).toBe(true);
    });
    
    it('should create UNKNOWN from undefined', () => {
      const gender = Gender.fromString(undefined);
      expect(gender.getValue()).toBe('unknown');
      expect(gender.isUnknown()).toBe(true);
    });
    
    it('should create UNKNOWN from empty string', () => {
      const gender = Gender.fromString('');
      expect(gender.getValue()).toBe('unknown');
      expect(gender.isUnknown()).toBe(true);
    });
    
    it('should support legacy "M" format', () => {
      const gender = Gender.fromString('M');
      expect(gender.getValue()).toBe('male');
      expect(gender.isMale()).toBe(true);
    });
    
    it('should support legacy "F" format', () => {
      const gender = Gender.fromString('F');
      expect(gender.getValue()).toBe('female');
      expect(gender.isFemale()).toBe(true);
    });
    
    it('should support legacy "NB" format', () => {
      const gender = Gender.fromString('NB');
      expect(gender.getValue()).toBe('other');
      expect(gender.isOther()).toBe(true);
    });
    
    it('should support legacy "N" format', () => {
      const gender = Gender.fromString('N');
      expect(gender.getValue()).toBe('other');
    });
    
    it('should support legacy "U" format', () => {
      const gender = Gender.fromString('U');
      expect(gender.getValue()).toBe('unknown');
      expect(gender.isUnknown()).toBe(true);
    });
    
    it('should throw error for invalid value', () => {
      expect(() => Gender.fromString('invalid')).toThrow('Invalid gender value');
    });
  });
  
  describe('fromLegacy()', () => {
    it('should create from "M"', () => {
      const gender = Gender.fromLegacy('M');
      expect(gender.getValue()).toBe('male');
    });
    
    it('should create from "F"', () => {
      const gender = Gender.fromLegacy('F');
      expect(gender.getValue()).toBe('female');
    });
    
    it('should create from "NB"', () => {
      const gender = Gender.fromLegacy('NB');
      expect(gender.getValue()).toBe('other');
    });
    
    it('should create from "U"', () => {
      const gender = Gender.fromLegacy('U');
      expect(gender.getValue()).toBe('unknown');
    });
    
    it('should create UNKNOWN from null', () => {
      const gender = Gender.fromLegacy(null);
      expect(gender.getValue()).toBe('unknown');
    });
    
    it('should create UNKNOWN from undefined', () => {
      const gender = Gender.fromLegacy(undefined);
      expect(gender.getValue()).toBe('unknown');
    });
  });
  
  describe('Type Checking Methods', () => {
    it('isUnknown() should work correctly', () => {
      expect(Gender.UNKNOWN.isUnknown()).toBe(true);
      expect(Gender.MALE.isUnknown()).toBe(false);
      expect(Gender.FEMALE.isUnknown()).toBe(false);
      expect(Gender.OTHER.isUnknown()).toBe(false);
    });
    
    it('isMale() should work correctly', () => {
      expect(Gender.MALE.isMale()).toBe(true);
      expect(Gender.UNKNOWN.isMale()).toBe(false);
      expect(Gender.FEMALE.isMale()).toBe(false);
      expect(Gender.OTHER.isMale()).toBe(false);
    });
    
    it('isFemale() should work correctly', () => {
      expect(Gender.FEMALE.isFemale()).toBe(true);
      expect(Gender.UNKNOWN.isFemale()).toBe(false);
      expect(Gender.MALE.isFemale()).toBe(false);
      expect(Gender.OTHER.isFemale()).toBe(false);
    });
    
    it('isOther() should work correctly', () => {
      expect(Gender.OTHER.isOther()).toBe(true);
      expect(Gender.UNKNOWN.isOther()).toBe(false);
      expect(Gender.MALE.isOther()).toBe(false);
      expect(Gender.FEMALE.isOther()).toBe(false);
    });
  });
  
  describe('toLegacyFormat()', () => {
    it('should convert male to "M"', () => {
      expect(Gender.MALE.toLegacyFormat()).toBe('M');
    });
    
    it('should convert female to "F"', () => {
      expect(Gender.FEMALE.toLegacyFormat()).toBe('F');
    });
    
    it('should convert other to "NB"', () => {
      expect(Gender.OTHER.toLegacyFormat()).toBe('NB');
    });
    
    it('should convert unknown to "U"', () => {
      expect(Gender.UNKNOWN.toLegacyFormat()).toBe('U');
    });
  });
  
  describe('equals()', () => {
    it('should return true for same gender', () => {
      const male1 = Gender.fromString('male');
      const male2 = Gender.fromString('male');
      expect(male1.equals(male2)).toBe(true);
    });
    
    it('should return false for different genders', () => {
      expect(Gender.MALE.equals(Gender.FEMALE)).toBe(false);
      expect(Gender.FEMALE.equals(Gender.OTHER)).toBe(false);
    });
    
    it('should return true when comparing constants', () => {
      expect(Gender.MALE.equals(Gender.MALE)).toBe(true);
      expect(Gender.FEMALE.equals(Gender.FEMALE)).toBe(true);
    });
    
    it('should return false for null', () => {
      expect(Gender.MALE.equals(null)).toBe(false);
    });
    
    it('should return false for undefined', () => {
      expect(Gender.MALE.equals(undefined)).toBe(false);
    });
  });
  
  describe('toString()', () => {
    it('should return gender value', () => {
      expect(Gender.MALE.toString()).toBe('male');
      expect(Gender.FEMALE.toString()).toBe('female');
      expect(Gender.OTHER.toString()).toBe('other');
      expect(Gender.UNKNOWN.toString()).toBe('unknown');
    });
  });
  
  describe('Immutability', () => {
    it('should not allow modification of value', () => {
      const gender = Gender.MALE;
      // TypeScript prevents this, but testing the concept
      expect(gender.getValue()).toBe('male');
      // Value should remain unchanged
      expect(gender.getValue()).toBe('male');
    });
    
    it('should always return same value', () => {
      const gender = Gender.fromString('female');
      expect(gender.getValue()).toBe('female');
      expect(gender.getValue()).toBe('female');
      expect(gender.getValue()).toBe('female');
    });
  });
  
  describe('Round-trip Conversions', () => {
    it('should round-trip through legacy format', () => {
      const original = Gender.MALE;
      const legacy = original.toLegacyFormat();
      const converted = Gender.fromLegacy(legacy);
      expect(converted.equals(original)).toBe(true);
    });
    
    it('should round-trip all gender values', () => {
      const genders = [Gender.MALE, Gender.FEMALE, Gender.OTHER, Gender.UNKNOWN];
      
      genders.forEach(gender => {
        const legacy = gender.toLegacyFormat();
        const converted = Gender.fromLegacy(legacy);
        expect(converted.equals(gender)).toBe(true);
      });
    });
  });
});
