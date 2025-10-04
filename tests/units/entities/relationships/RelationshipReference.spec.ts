import { describe, it, expect } from 'vitest';
import { RelationshipReference, ReferenceType } from '../../../../src/models/contactNote/entities/relationships/RelationshipReference';
import { UID } from '../../../../src/models/contactNote/entities/valueObjects/UID';

describe('RelationshipReference', () => {
  describe('creation from UID', () => {
    it('should create UID-based reference', () => {
      const uid = UID.generate();
      const ref = RelationshipReference.fromUID(uid);
      
      expect(ref).toBeDefined();
      expect(ref.getType()).toBe(ReferenceType.UID);
      expect(ref.isUIDReference()).toBe(true);
      expect(ref.isNameReference()).toBe(false);
      expect(ref.getUID()?.equals(uid)).toBe(true);
    });

    it('should store UID value correctly', () => {
      const uid = UID.fromString('123-456-789');
      const ref = RelationshipReference.fromUID(uid);
      
      expect(ref.getValue()).toBe('123-456-789');
    });
  });

  describe('creation from name', () => {
    it('should create name-based reference', () => {
      const ref = RelationshipReference.fromName('John Doe');
      
      expect(ref).toBeDefined();
      expect(ref.getType()).toBe(ReferenceType.NAME);
      expect(ref.isNameReference()).toBe(true);
      expect(ref.isUIDReference()).toBe(false);
      expect(ref.getUID()).toBeNull();
      expect(ref.getValue()).toBe('John Doe');
    });

    it('should trim whitespace from name', () => {
      const ref = RelationshipReference.fromName('  Jane Smith  ');
      expect(ref.getValue()).toBe('Jane Smith');
    });

    it('should throw error for empty name', () => {
      expect(() => RelationshipReference.fromName('')).toThrow('non-empty string');
    });

    it('should throw error for whitespace only', () => {
      expect(() => RelationshipReference.fromName('   ')).toThrow('non-empty string');
    });

    it('should throw error for non-string', () => {
      expect(() => RelationshipReference.fromName(null as any)).toThrow('non-empty string');
    });
  });

  describe('parsing from string', () => {
    it('should parse plain wikilink as name', () => {
      const ref = RelationshipReference.fromString('[[John Doe]]');
      expect(ref.isNameReference()).toBe(true);
      expect(ref.getValue()).toBe('John Doe');
    });

    it('should parse UID wikilink format', () => {
      const ref = RelationshipReference.fromString('[[uid:123-456-789]]');
      expect(ref.isUIDReference()).toBe(true);
      expect(ref.getValue()).toBe('123-456-789');
    });

    it('should parse UID wikilink with display name', () => {
      const ref = RelationshipReference.fromString('[[uid:123-456|John Doe]]');
      expect(ref.isUIDReference()).toBe(true);
      expect(ref.getValue()).toBe('123-456');
    });

    it('should parse URN wikilink format', () => {
      const uidValue = UID.generate().toString();
      const ref = RelationshipReference.fromString(`[[urn:uuid:${uidValue}]]`);
      expect(ref.isUIDReference()).toBe(true);
    });

    it('should parse URN wikilink with display name', () => {
      const uidValue = UID.generate().toString();
      const ref = RelationshipReference.fromString(`[[urn:uuid:${uidValue}|Jane Smith]]`);
      expect(ref.isUIDReference()).toBe(true);
    });

    it('should parse raw UID format', () => {
      const ref = RelationshipReference.fromString('uid:123-456-789');
      expect(ref.isUIDReference()).toBe(true);
      expect(ref.getValue()).toBe('123-456-789');
    });

    it('should parse raw URN format', () => {
      const uidValue = UID.generate().toString();
      const ref = RelationshipReference.fromString(`urn:uuid:${uidValue}`);
      expect(ref.isUIDReference()).toBe(true);
    });

    it('should parse plain UUID as UID', () => {
      const uuid = UID.generate().toString();
      const ref = RelationshipReference.fromString(uuid);
      expect(ref.isUIDReference()).toBe(true);
      expect(ref.getValue()).toBe(uuid);
    });

    it('should parse custom UID format', () => {
      const ref = RelationshipReference.fromString('contact-123');
      expect(ref.isUIDReference()).toBe(true);
      expect(ref.getValue()).toBe('contact-123');
    });

    it('should fall back to name for non-UID strings', () => {
      const ref = RelationshipReference.fromString('John Doe');
      expect(ref.isNameReference()).toBe(true);
      expect(ref.getValue()).toBe('John Doe');
    });

    it('should throw error for empty string', () => {
      expect(() => RelationshipReference.fromString('')).toThrow('non-empty string');
    });

    it('should throw error for whitespace only', () => {
      expect(() => RelationshipReference.fromString('   ')).toThrow('non-empty string');
    });
  });

  describe('wikilink conversion', () => {
    it('should convert UID reference to wikilink', () => {
      const uid = UID.fromString('123-456');
      const ref = RelationshipReference.fromUID(uid);
      
      expect(ref.toWikilink()).toBe('[[uid:123-456]]');
    });

    it('should convert UID reference to wikilink with display name', () => {
      const uid = UID.fromString('123-456');
      const ref = RelationshipReference.fromUID(uid);
      
      expect(ref.toWikilink('John Doe')).toBe('[[uid:123-456|John Doe]]');
    });

    it('should convert name reference to simple wikilink', () => {
      const ref = RelationshipReference.fromName('Jane Smith');
      expect(ref.toWikilink()).toBe('[[Jane Smith]]');
    });

    it('should ignore display name for name references', () => {
      const ref = RelationshipReference.fromName('Jane Smith');
      expect(ref.toWikilink('Other Name')).toBe('[[Jane Smith]]');
    });
  });

  describe('frontmatter conversion', () => {
    it('should convert UID reference to frontmatter format', () => {
      const uid = UID.fromString('123-456');
      const ref = RelationshipReference.fromUID(uid);
      
      expect(ref.toFrontmatter()).toBe('uid:123-456');
    });

    it('should convert name reference to plain name', () => {
      const ref = RelationshipReference.fromName('John Doe');
      expect(ref.toFrontmatter()).toBe('John Doe');
    });
  });

  describe('equality', () => {
    it('should be equal for same UID', () => {
      const uid = UID.fromString('123-456');
      const ref1 = RelationshipReference.fromUID(uid);
      const ref2 = RelationshipReference.fromUID(uid);
      
      expect(ref1.equals(ref2)).toBe(true);
    });

    it('should be equal for same name (case-insensitive)', () => {
      const ref1 = RelationshipReference.fromName('John Doe');
      const ref2 = RelationshipReference.fromName('john doe');
      
      expect(ref1.equals(ref2)).toBe(true);
    });

    it('should be equal for same name with different whitespace', () => {
      const ref1 = RelationshipReference.fromName('John Doe');
      const ref2 = RelationshipReference.fromName('  John Doe  ');
      
      expect(ref1.equals(ref2)).toBe(true);
    });

    it('should not be equal for different UIDs', () => {
      const ref1 = RelationshipReference.fromUID(UID.fromString('123'));
      const ref2 = RelationshipReference.fromUID(UID.fromString('456'));
      
      expect(ref1.equals(ref2)).toBe(false);
    });

    it('should not be equal for different names', () => {
      const ref1 = RelationshipReference.fromName('John Doe');
      const ref2 = RelationshipReference.fromName('Jane Smith');
      
      expect(ref1.equals(ref2)).toBe(false);
    });

    it('should not be equal for UID vs name', () => {
      const ref1 = RelationshipReference.fromUID(UID.fromString('123'));
      const ref2 = RelationshipReference.fromName('123');
      
      expect(ref1.equals(ref2)).toBe(false);
    });

    it('should handle null/undefined', () => {
      const ref = RelationshipReference.fromName('John Doe');
      expect(ref.equals(null as any)).toBe(false);
      expect(ref.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return value for UID reference', () => {
      const uid = UID.fromString('123-456');
      const ref = RelationshipReference.fromUID(uid);
      expect(ref.toString()).toBe('123-456');
    });

    it('should return value for name reference', () => {
      const ref = RelationshipReference.fromName('John Doe');
      expect(ref.toString()).toBe('John Doe');
    });
  });
});
