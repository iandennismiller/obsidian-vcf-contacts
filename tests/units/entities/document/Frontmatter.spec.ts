import { describe, it, expect } from 'vitest';
import { Frontmatter } from '../../../../src/models/contactNote/entities/document/Frontmatter';
import { UID } from '../../../../src/models/contactNote/entities/valueObjects/UID';
import { Gender } from '../../../../src/models/contactNote/entities/valueObjects/Gender';
import { Revision } from '../../../../src/models/contactNote/entities/valueObjects/Revision';

describe('Frontmatter', () => {
  describe('Factory Methods', () => {
    it('should create empty frontmatter', () => {
      const fm = Frontmatter.empty();
      expect(fm.isEmpty()).toBe(true);
      expect(fm.getKeys()).toEqual([]);
    });

    it('should create from object', () => {
      const fm = Frontmatter.fromObject({ UID: '123', FN: 'John Doe' });
      expect(fm.get('UID')).toBe('123');
      expect(fm.get('FN')).toBe('John Doe');
      expect(fm.isEmpty()).toBe(false);
    });

    it('should create from YAML string', () => {
      const yaml = 'UID: test-123\nFN: Jane Doe';
      const fm = Frontmatter.fromYAML(yaml);
      expect(fm.get('UID')).toBe('test-123');
      expect(fm.get('FN')).toBe('Jane Doe');
    });

    it('should throw error for invalid YAML', () => {
      expect(() => Frontmatter.fromYAML('invalid: yaml: structure:')).toThrow('Invalid YAML');
    });

    it('should throw error for array YAML', () => {
      expect(() => Frontmatter.fromYAML('- item1\n- item2')).toThrow('YAML must parse to an object');
    });
  });

  describe('Access Methods', () => {
    it('should get values by key', () => {
      const fm = Frontmatter.fromObject({ UID: '123', FN: 'Test' });
      expect(fm.get('UID')).toBe('123');
      expect(fm.get('FN')).toBe('Test');
    });

    it('should return undefined for missing keys', () => {
      const fm = Frontmatter.empty();
      expect(fm.get('missing')).toBeUndefined();
    });

    it('should get nested values with dot notation', () => {
      const fm = Frontmatter.fromObject({ EMAIL: { WORK: 'work@example.com' } });
      expect(fm.getFlat('EMAIL.WORK')).toBe('work@example.com');
    });

    it('should return undefined for missing nested keys', () => {
      const fm = Frontmatter.fromObject({ EMAIL: {} });
      expect(fm.getFlat('EMAIL.WORK')).toBeUndefined();
    });

    it('should check if key exists', () => {
      const fm = Frontmatter.fromObject({ UID: '123' });
      expect(fm.has('UID')).toBe(true);
      expect(fm.has('missing')).toBe(false);
    });

    it('should check if nested key exists', () => {
      const fm = Frontmatter.fromObject({ EMAIL: { WORK: 'test@example.com' } });
      expect(fm.hasFlat('EMAIL.WORK')).toBe(true);
      expect(fm.hasFlat('EMAIL.HOME')).toBe(false);
    });
  });

  describe('Mutation Methods', () => {
    it('should set value and return new instance', () => {
      const fm1 = Frontmatter.empty();
      const fm2 = fm1.set('UID', '123');
      
      expect(fm1.get('UID')).toBeUndefined();
      expect(fm2.get('UID')).toBe('123');
      expect(fm1).not.toBe(fm2);
    });

    it('should set nested value with dot notation', () => {
      const fm1 = Frontmatter.empty();
      const fm2 = fm1.setFlat('EMAIL.WORK', 'work@example.com');
      
      expect(fm2.getFlat('EMAIL.WORK')).toBe('work@example.com');
      expect(fm1.getFlat('EMAIL.WORK')).toBeUndefined();
    });

    it('should delete key and return new instance', () => {
      const fm1 = Frontmatter.fromObject({ UID: '123', FN: 'Test' });
      const fm2 = fm1.delete('UID');
      
      expect(fm1.has('UID')).toBe(true);
      expect(fm2.has('UID')).toBe(false);
      expect(fm2.has('FN')).toBe(true);
    });

    it('should delete nested key with dot notation', () => {
      const fm1 = Frontmatter.fromObject({ EMAIL: { WORK: 'test@example.com', HOME: 'home@example.com' } });
      const fm2 = fm1.deleteFlat('EMAIL.WORK');
      
      expect(fm1.getFlat('EMAIL.WORK')).toBe('test@example.com');
      expect(fm2.getFlat('EMAIL.WORK')).toBeUndefined();
      expect(fm2.getFlat('EMAIL.HOME')).toBe('home@example.com');
    });

    it('should handle delete of non-existent path', () => {
      const fm1 = Frontmatter.empty();
      const fm2 = fm1.deleteFlat('EMAIL.WORK');
      
      expect(fm1).toEqual(fm2);
    });

    it('should merge frontmatters', () => {
      const fm1 = Frontmatter.fromObject({ UID: '123', FN: 'John' });
      const fm2 = Frontmatter.fromObject({ FN: 'Jane', GENDER: 'Female' });
      const merged = fm1.merge(fm2);
      
      expect(merged.get('UID')).toBe('123');
      expect(merged.get('FN')).toBe('Jane'); // fm2 wins
      expect(merged.get('GENDER')).toBe('Female');
    });
  });

  describe('Serialization', () => {
    it('should convert to YAML', () => {
      const fm = Frontmatter.fromObject({ UID: '123', FN: 'Test' });
      const yaml = fm.toYAML();
      
      expect(yaml).toContain('UID');
      expect(yaml).toContain('123');
      expect(yaml).toContain('FN');
      expect(yaml).toContain('Test');
    });

    it('should convert to object', () => {
      const original = { UID: '123', FN: 'Test' };
      const fm = Frontmatter.fromObject(original);
      const obj = fm.toObject();
      
      expect(obj).toEqual(original);
      expect(obj).not.toBe(original); // Should be a clone
    });

    it('should convert to flat object', () => {
      const fm = Frontmatter.fromObject({ 
        UID: '123',
        EMAIL: { WORK: 'work@example.com', HOME: 'home@example.com' }
      });
      const flat = fm.toFlatObject();
      
      expect(flat['UID']).toBe('123');
      expect(flat['EMAIL.WORK']).toBe('work@example.com');
      expect(flat['EMAIL.HOME']).toBe('home@example.com');
    });
  });

  describe('Querying', () => {
    it('should get all keys', () => {
      const fm = Frontmatter.fromObject({ UID: '123', FN: 'Test', GENDER: 'Male' });
      const keys = fm.getKeys();
      
      expect(keys).toHaveLength(3);
      expect(keys).toContain('UID');
      expect(keys).toContain('FN');
      expect(keys).toContain('GENDER');
    });

    it('should get flat keys', () => {
      const fm = Frontmatter.fromObject({ 
        UID: '123',
        EMAIL: { WORK: 'work@example.com', HOME: 'home@example.com' }
      });
      const keys = fm.getFlatKeys();
      
      expect(keys).toContain('UID');
      expect(keys).toContain('EMAIL.WORK');
      expect(keys).toContain('EMAIL.HOME');
    });

    it('should check if empty', () => {
      const empty = Frontmatter.empty();
      const notEmpty = Frontmatter.fromObject({ UID: '123' });
      
      expect(empty.isEmpty()).toBe(true);
      expect(notEmpty.isEmpty()).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate valid frontmatter', () => {
      const fm = Frontmatter.fromObject({ UID: '123' });
      const result = fm.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Convenience Methods', () => {
    it('should get UID', () => {
      const fm = Frontmatter.fromObject({ UID: 'test-123' });
      const uid = fm.getUID();
      
      expect(uid).toBeInstanceOf(UID);
      expect(uid?.toString()).toBe('test-123');
    });

    it('should return null for missing UID', () => {
      const fm = Frontmatter.empty();
      expect(fm.getUID()).toBeNull();
    });

    it('should return null for invalid UID', () => {
      const fm = Frontmatter.fromObject({ UID: 'x' }); // Too short
      expect(fm.getUID()).toBeNull();
    });

    it('should get name', () => {
      const fm = Frontmatter.fromObject({ FN: 'John Doe' });
      expect(fm.getName()).toBe('John Doe');
    });

    it('should return null for missing name', () => {
      const fm = Frontmatter.empty();
      expect(fm.getName()).toBeNull();
    });

    it('should get gender', () => {
      const fm = Frontmatter.fromObject({ GENDER: 'Male' });
      const gender = fm.getGender();
      
      expect(gender).toBeInstanceOf(Gender);
      expect(gender?.equals(Gender.MALE)).toBe(true);
    });

    it('should return null for missing gender', () => {
      const fm = Frontmatter.empty();
      expect(fm.getGender()).toBeNull();
    });

    it('should get revision from string', () => {
      const fm = Frontmatter.fromObject({ REV: '2024-01-01T00:00:00Z' });
      const rev = fm.getRevision();
      
      expect(rev).toBeInstanceOf(Revision);
    });

    it('should get revision from timestamp', () => {
      const timestamp = Date.now();
      const fm = Frontmatter.fromObject({ REV: timestamp });
      const rev = fm.getRevision();
      
      expect(rev).toBeInstanceOf(Revision);
    });

    it('should return null for missing revision', () => {
      const fm = Frontmatter.empty();
      expect(fm.getRevision()).toBeNull();
    });
  });

  describe('Utility', () => {
    it('should have string representation', () => {
      const fm = Frontmatter.fromObject({ UID: '123', FN: 'Test' });
      const str = fm.toString();
      
      expect(str).toContain('Frontmatter');
      expect(str).toContain('2');
    });

    it('should check equality', () => {
      const fm1 = Frontmatter.fromObject({ UID: '123', FN: 'Test' });
      const fm2 = Frontmatter.fromObject({ UID: '123', FN: 'Test' });
      const fm3 = Frontmatter.fromObject({ UID: '456' });
      
      expect(fm1.equals(fm2)).toBe(true);
      expect(fm1.equals(fm3)).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should not modify original on set', () => {
      const original = Frontmatter.fromObject({ UID: '123' });
      const modified = original.set('FN', 'Test');
      
      expect(original.has('FN')).toBe(false);
      expect(modified.has('FN')).toBe(true);
    });

    it('should not modify original on delete', () => {
      const original = Frontmatter.fromObject({ UID: '123', FN: 'Test' });
      const modified = original.delete('FN');
      
      expect(original.has('FN')).toBe(true);
      expect(modified.has('FN')).toBe(false);
    });

    it('should not modify original on merge', () => {
      const fm1 = Frontmatter.fromObject({ UID: '123' });
      const fm2 = Frontmatter.fromObject({ FN: 'Test' });
      const merged = fm1.merge(fm2);
      
      expect(fm1.has('FN')).toBe(false);
      expect(merged.has('FN')).toBe(true);
    });
  });
});
