import { describe, it, expect } from 'vitest';
import { Relationship } from '../../../../src/models/contactNote/entities/relationships/Relationship';
import { RelationshipType } from '../../../../src/models/contactNote/entities/relationships/RelationshipType';
import { RelationshipReference } from '../../../../src/models/contactNote/entities/relationships/RelationshipReference';
import { Gender } from '../../../../src/models/contactNote/entities/valueObjects/Gender';
import { UID } from '../../../../src/models/contactNote/entities/valueObjects/UID';

describe('Relationship', () => {
  describe('creation', () => {
    it('should create relationship from type and target', () => {
      const type = RelationshipType.fromString('spouse');
      const target = RelationshipReference.fromName('John Doe');
      const rel = Relationship.create(type, target);
      
      expect(rel).toBeDefined();
      expect(rel.getType().equals(type)).toBe(true);
      expect(rel.getTarget().equals(target)).toBe(true);
    });
  });

  describe('parsing from markdown', () => {
    it('should parse simple relationship', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John Doe]]');
      
      expect(rel.getType().toString()).toBe('spouse');
      expect(rel.getTarget().getValue()).toBe('John Doe');
      expect(rel.getTarget().isNameReference()).toBe(true);
    });

    it('should parse without leading dash', () => {
      const rel = Relationship.fromMarkdown('spouse [[Jane Smith]]');
      
      expect(rel.getType().toString()).toBe('spouse');
      expect(rel.getTarget().getValue()).toBe('Jane Smith');
    });

    it('should parse UID-based relationship', () => {
      const rel = Relationship.fromMarkdown('- parent [[uid:123-456]]');
      
      expect(rel.getType().toString()).toBe('parent');
      expect(rel.getTarget().isUIDReference()).toBe(true);
      expect(rel.getTarget().getValue()).toBe('123-456');
    });

    it('should parse UID with display name', () => {
      const rel = Relationship.fromMarkdown('- child [[uid:789|Alice]]');
      
      expect(rel.getType().toString()).toBe('child');
      expect(rel.getTarget().isUIDReference()).toBe(true);
    });

    it('should handle gendered relationship types', () => {
      const rel1 = Relationship.fromMarkdown('- husband [[John]]');
      const rel2 = Relationship.fromMarkdown('- wife [[Jane]]');
      const rel3 = Relationship.fromMarkdown('- father [[Dad]]');
      
      expect(rel1.getType().toString()).toBe('husband');
      expect(rel2.getType().toString()).toBe('wife');
      expect(rel3.getType().toString()).toBe('father');
    });

    it('should handle extra whitespace', () => {
      const rel = Relationship.fromMarkdown('  -   spouse   [[John Doe]]  ');
      
      expect(rel.getType().toString()).toBe('spouse');
      expect(rel.getTarget().getValue()).toBe('John Doe');
    });

    it('should throw error for missing wikilink', () => {
      expect(() => Relationship.fromMarkdown('- spouse John Doe')).toThrow('wikilink');
    });

    it('should throw error for missing type', () => {
      expect(() => Relationship.fromMarkdown('- [[John Doe]]')).toThrow('type is required');
    });

    it('should throw error for empty string', () => {
      expect(() => Relationship.fromMarkdown('')).toThrow('non-empty string');
    });

    it('should throw error for non-string', () => {
      expect(() => Relationship.fromMarkdown(null as any)).toThrow('non-empty string');
    });
  });

  describe('parsing from frontmatter', () => {
    it('should parse frontmatter entry', () => {
      const rel = Relationship.fromFrontmatter({ key: 'spouse', value: 'John Doe' });
      
      expect(rel.getType().toString()).toBe('spouse');
      expect(rel.getTarget().getValue()).toBe('John Doe');
      expect(rel.getTarget().isNameReference()).toBe(true);
    });

    it('should parse UID-based frontmatter', () => {
      const rel = Relationship.fromFrontmatter({ key: 'parent', value: 'uid:123-456' });
      
      expect(rel.getType().toString()).toBe('parent');
      expect(rel.getTarget().isUIDReference()).toBe(true);
      expect(rel.getTarget().getValue()).toBe('123-456');
    });

    it('should parse gendered types', () => {
      const rel = Relationship.fromFrontmatter({ key: 'husband', value: 'uid:789' });
      
      expect(rel.getType().toString()).toBe('husband');
    });

    it('should throw error for missing key', () => {
      expect(() => Relationship.fromFrontmatter({ key: '', value: 'John' } as any)).toThrow('key and value');
    });

    it('should throw error for missing value', () => {
      expect(() => Relationship.fromFrontmatter({ key: 'spouse', value: '' } as any)).toThrow('key and value');
    });

    it('should throw error for null entry', () => {
      expect(() => Relationship.fromFrontmatter(null as any)).toThrow('key and value');
    });
  });

  describe('gendered terms', () => {
    it('should get gendered term for spouse', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John]]');
      
      expect(rel.getGenderedTerm(Gender.MALE)).toBe('husband');
      expect(rel.getGenderedTerm(Gender.FEMALE)).toBe('wife');
      expect(rel.getGenderedTerm(Gender.OTHER)).toBe('spouse');
    });

    it('should get gendered term for parent', () => {
      const rel = Relationship.fromMarkdown('- parent [[Mom]]');
      
      expect(rel.getGenderedTerm(Gender.MALE)).toBe('father');
      expect(rel.getGenderedTerm(Gender.FEMALE)).toBe('mother');
      expect(rel.getGenderedTerm(Gender.OTHER)).toBe('parent');
    });

    it('should preserve gendered input', () => {
      const rel = Relationship.fromMarkdown('- husband [[John]]');
      
      expect(rel.getGenderedTerm(Gender.MALE)).toBe('husband');
      expect(rel.getGenderedTerm(Gender.FEMALE)).toBe('wife');
    });

    it('should return same term for genderless relationships', () => {
      const rel = Relationship.fromMarkdown('- friend [[Bob]]');
      
      expect(rel.getGenderedTerm(Gender.MALE)).toBe('friend');
      expect(rel.getGenderedTerm(Gender.FEMALE)).toBe('friend');
    });
  });

  describe('reciprocal relationships', () => {
    it('should get reciprocal type for parent-child', () => {
      const parent = Relationship.fromMarkdown('- parent [[Child]]');
      const recipType = parent.getReciprocalType();
      
      expect(recipType.toString()).toBe('child');
    });

    it('should get reciprocal type for spouse', () => {
      const spouse = Relationship.fromMarkdown('- spouse [[Partner]]');
      const recipType = spouse.getReciprocalType();
      
      expect(recipType.toString()).toBe('spouse');
    });

    it('should create reciprocal relationship', () => {
      const parent = Relationship.fromMarkdown('- parent [[uid:child-123|Child]]');
      const parentRef = RelationshipReference.fromUID(UID.fromString('parent-456'));
      
      const reciprocal = parent.createReciprocal(parentRef);
      
      expect(reciprocal.getType().toString()).toBe('child');
      expect(reciprocal.getTarget().getValue()).toBe('parent-456');
    });

    it('should create reciprocal for symmetric relationship', () => {
      const friend = Relationship.fromMarkdown('- friend [[Alice]]');
      const myRef = RelationshipReference.fromName('Bob');
      
      const reciprocal = friend.createReciprocal(myRef);
      
      expect(reciprocal.getType().toString()).toBe('friend');
      expect(reciprocal.getTarget().getValue()).toBe('Bob');
    });
  });

  describe('validation', () => {
    it('should validate correct relationship', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John]]');
      const validation = rel.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should pass validation for any created relationship', () => {
      const type = RelationshipType.fromString('friend');
      const target = RelationshipReference.fromName('Bob');
      const rel = Relationship.create(type, target);
      
      const validation = rel.validate();
      expect(validation.isValid).toBe(true);
    });
  });

  describe('markdown conversion', () => {
    it('should convert to markdown with name reference', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John Doe]]');
      expect(rel.toMarkdown()).toBe('- spouse [[John Doe]]');
    });

    it('should convert to markdown with UID reference', () => {
      const rel = Relationship.fromMarkdown('- parent [[uid:123-456]]');
      expect(rel.toMarkdown()).toBe('- parent [[uid:123-456]]');
    });

    it('should convert with gendered term', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John]]');
      expect(rel.toMarkdown(Gender.MALE)).toBe('- husband [[John]]');
      expect(rel.toMarkdown(Gender.FEMALE)).toBe('- wife [[John]]');
    });

    it('should convert with display name', () => {
      const type = RelationshipType.fromString('parent');
      const target = RelationshipReference.fromUID(UID.fromString('123'));
      const rel = Relationship.create(type, target);
      
      expect(rel.toMarkdown(undefined, 'Mom')).toBe('- parent [[uid:123|Mom]]');
    });

    it('should convert with both gender and display name', () => {
      const type = RelationshipType.fromString('parent');
      const target = RelationshipReference.fromUID(UID.fromString('123'));
      const rel = Relationship.create(type, target);
      
      expect(rel.toMarkdown(Gender.FEMALE, 'Mom')).toBe('- mother [[uid:123|Mom]]');
    });
  });

  describe('frontmatter conversion', () => {
    it('should convert to frontmatter with name', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John Doe]]');
      const fm = rel.toFrontmatter();
      
      expect(fm.key).toBe('spouse');
      expect(fm.value).toBe('John Doe');
    });

    it('should convert to frontmatter with UID', () => {
      const rel = Relationship.fromMarkdown('- parent [[uid:123-456]]');
      const fm = rel.toFrontmatter();
      
      expect(fm.key).toBe('parent');
      expect(fm.value).toBe('uid:123-456');
    });

    it('should convert with gendered term', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John]]');
      const fm = rel.toFrontmatter(Gender.MALE);
      
      expect(fm.key).toBe('husband');
      expect(fm.value).toBe('John');
    });
  });

  describe('relationship classification', () => {
    it('should identify family relationships', () => {
      const spouse = Relationship.fromMarkdown('- spouse [[John]]');
      const parent = Relationship.fromMarkdown('- parent [[Mom]]');
      const child = Relationship.fromMarkdown('- child [[Kid]]');
      
      expect(spouse.isFamilyRelationship()).toBe(true);
      expect(parent.isFamilyRelationship()).toBe(true);
      expect(child.isFamilyRelationship()).toBe(true);
    });

    it('should identify non-family relationships', () => {
      const friend = Relationship.fromMarkdown('- friend [[Bob]]');
      const colleague = Relationship.fromMarkdown('- colleague [[Alice]]');
      
      expect(friend.isFamilyRelationship()).toBe(false);
      expect(colleague.isFamilyRelationship()).toBe(false);
    });

    it('should identify professional relationships', () => {
      const manager = Relationship.fromMarkdown('- manager [[Boss]]');
      const colleague = Relationship.fromMarkdown('- colleague [[Coworker]]');
      
      expect(manager.isProfessionalRelationship()).toBe(true);
      expect(colleague.isProfessionalRelationship()).toBe(true);
    });

    it('should identify non-professional relationships', () => {
      const spouse = Relationship.fromMarkdown('- spouse [[Partner]]');
      const friend = Relationship.fromMarkdown('- friend [[Buddy]]');
      
      expect(spouse.isProfessionalRelationship()).toBe(false);
      expect(friend.isProfessionalRelationship()).toBe(false);
    });
  });

  describe('equality', () => {
    it('should be equal for same type and target', () => {
      const rel1 = Relationship.fromMarkdown('- spouse [[John]]');
      const rel2 = Relationship.fromMarkdown('- spouse [[John]]');
      
      expect(rel1.equals(rel2)).toBe(true);
    });

    it('should be equal for gendered variations', () => {
      const husband = Relationship.fromMarkdown('- husband [[John]]');
      const wife = Relationship.fromMarkdown('- wife [[John]]');
      const spouse = Relationship.fromMarkdown('- spouse [[John]]');
      
      expect(husband.equals(spouse)).toBe(true);
      expect(wife.equals(spouse)).toBe(true);
      expect(husband.equals(wife)).toBe(true);
    });

    it('should not be equal for different types', () => {
      const spouse = Relationship.fromMarkdown('- spouse [[John]]');
      const friend = Relationship.fromMarkdown('- friend [[John]]');
      
      expect(spouse.equals(friend)).toBe(false);
    });

    it('should not be equal for different targets', () => {
      const rel1 = Relationship.fromMarkdown('- spouse [[John]]');
      const rel2 = Relationship.fromMarkdown('- spouse [[Jane]]');
      
      expect(rel1.equals(rel2)).toBe(false);
    });

    it('should handle null/undefined', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John]]');
      expect(rel.equals(null as any)).toBe(false);
      expect(rel.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return readable string representation', () => {
      const rel = Relationship.fromMarkdown('- spouse [[John Doe]]');
      expect(rel.toString()).toBe('spouse -> John Doe');
    });

    it('should work with UID references', () => {
      const rel = Relationship.fromMarkdown('- parent [[uid:123-456]]');
      expect(rel.toString()).toBe('parent -> 123-456');
    });

    it('should show gendered terms', () => {
      const rel = Relationship.fromMarkdown('- husband [[John]]');
      expect(rel.toString()).toBe('husband -> John');
    });
  });
});
