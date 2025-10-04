import { describe, it, expect } from 'vitest';
import { RelationshipType } from '../../../../src/models/contactNote/entities/relationships/RelationshipType';
import { Gender } from '../../../../src/models/contactNote/entities/valueObjects/Gender';

describe('RelationshipType', () => {
  describe('creation', () => {
    it('should create from valid string', () => {
      const type = RelationshipType.fromString('spouse');
      expect(type).toBeDefined();
      expect(type.toString()).toBe('spouse');
    });

    it('should normalize to lowercase', () => {
      const type = RelationshipType.fromString('SPOUSE');
      expect(type.toString()).toBe('spouse');
    });

    it('should trim whitespace', () => {
      const type = RelationshipType.fromString('  spouse  ');
      expect(type.toString()).toBe('spouse');
    });

    it('should throw error for empty string', () => {
      expect(() => RelationshipType.fromString('')).toThrow('non-empty string');
    });

    it('should throw error for whitespace only', () => {
      expect(() => RelationshipType.fromString('   ')).toThrow('non-empty string');
    });

    it('should throw error for non-string', () => {
      expect(() => RelationshipType.fromString(null as any)).toThrow('non-empty string');
      expect(() => RelationshipType.fromString(undefined as any)).toThrow('non-empty string');
    });
  });

  describe('neutral type conversion', () => {
    it('should return neutral form for gendered terms', () => {
      expect(RelationshipType.fromString('husband').getNeutralType()).toBe('spouse');
      expect(RelationshipType.fromString('wife').getNeutralType()).toBe('spouse');
      expect(RelationshipType.fromString('father').getNeutralType()).toBe('parent');
      expect(RelationshipType.fromString('mother').getNeutralType()).toBe('parent');
      expect(RelationshipType.fromString('son').getNeutralType()).toBe('child');
      expect(RelationshipType.fromString('daughter').getNeutralType()).toBe('child');
    });

    it('should return same value for already neutral terms', () => {
      expect(RelationshipType.fromString('spouse').getNeutralType()).toBe('spouse');
      expect(RelationshipType.fromString('parent').getNeutralType()).toBe('parent');
      expect(RelationshipType.fromString('child').getNeutralType()).toBe('child');
    });

    it('should return same value for custom terms', () => {
      expect(RelationshipType.fromString('custom').getNeutralType()).toBe('custom');
    });
  });

  describe('gendered term conversion', () => {
    it('should convert spouse to gendered terms', () => {
      const spouse = RelationshipType.fromString('spouse');
      expect(spouse.getGenderedTerm(Gender.MALE)).toBe('husband');
      expect(spouse.getGenderedTerm(Gender.FEMALE)).toBe('wife');
      expect(spouse.getGenderedTerm(Gender.OTHER)).toBe('spouse');
      expect(spouse.getGenderedTerm(Gender.UNKNOWN)).toBe('spouse');
    });

    it('should convert parent to gendered terms', () => {
      const parent = RelationshipType.fromString('parent');
      expect(parent.getGenderedTerm(Gender.MALE)).toBe('father');
      expect(parent.getGenderedTerm(Gender.FEMALE)).toBe('mother');
      expect(parent.getGenderedTerm(Gender.OTHER)).toBe('parent');
    });

    it('should convert child to gendered terms', () => {
      const child = RelationshipType.fromString('child');
      expect(child.getGenderedTerm(Gender.MALE)).toBe('son');
      expect(child.getGenderedTerm(Gender.FEMALE)).toBe('daughter');
      expect(child.getGenderedTerm(Gender.OTHER)).toBe('child');
    });

    it('should handle gendered input correctly', () => {
      const husband = RelationshipType.fromString('husband');
      expect(husband.getGenderedTerm(Gender.MALE)).toBe('husband');
      expect(husband.getGenderedTerm(Gender.FEMALE)).toBe('wife');
    });

    it('should return same term for genderless relationships', () => {
      const friend = RelationshipType.fromString('friend');
      expect(friend.getGenderedTerm(Gender.MALE)).toBe('friend');
      expect(friend.getGenderedTerm(Gender.FEMALE)).toBe('friend');
      expect(friend.getGenderedTerm(Gender.OTHER)).toBe('friend');
    });

    it('should return same term for custom relationships', () => {
      const custom = RelationshipType.fromString('mentor');
      expect(custom.getGenderedTerm(Gender.MALE)).toBe('mentor');
      expect(custom.getGenderedTerm(Gender.FEMALE)).toBe('mentor');
    });
  });

  describe('gender inference', () => {
    it('should infer male gender from gendered terms', () => {
      expect(RelationshipType.fromString('husband').inferGender()?.equals(Gender.MALE)).toBe(true);
      expect(RelationshipType.fromString('father').inferGender()?.equals(Gender.MALE)).toBe(true);
      expect(RelationshipType.fromString('son').inferGender()?.equals(Gender.MALE)).toBe(true);
      expect(RelationshipType.fromString('brother').inferGender()?.equals(Gender.MALE)).toBe(true);
    });

    it('should infer female gender from gendered terms', () => {
      expect(RelationshipType.fromString('wife').inferGender()?.equals(Gender.FEMALE)).toBe(true);
      expect(RelationshipType.fromString('mother').inferGender()?.equals(Gender.FEMALE)).toBe(true);
      expect(RelationshipType.fromString('daughter').inferGender()?.equals(Gender.FEMALE)).toBe(true);
      expect(RelationshipType.fromString('sister').inferGender()?.equals(Gender.FEMALE)).toBe(true);
    });

    it('should return null for neutral terms', () => {
      expect(RelationshipType.fromString('spouse').inferGender()).toBeNull();
      expect(RelationshipType.fromString('parent').inferGender()).toBeNull();
      expect(RelationshipType.fromString('child').inferGender()).toBeNull();
    });

    it('should return null for genderless terms', () => {
      expect(RelationshipType.fromString('friend').inferGender()).toBeNull();
      expect(RelationshipType.fromString('colleague').inferGender()).toBeNull();
    });
  });

  describe('relationship classification', () => {
    it('should identify family relationships', () => {
      expect(RelationshipType.fromString('spouse').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('parent').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('child').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('sibling').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('husband').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('wife').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('father').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('mother').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('uncle').isFamilyRelationship()).toBe(true);
      expect(RelationshipType.fromString('aunt').isFamilyRelationship()).toBe(true);
    });

    it('should identify non-family relationships', () => {
      expect(RelationshipType.fromString('friend').isFamilyRelationship()).toBe(false);
      expect(RelationshipType.fromString('colleague').isFamilyRelationship()).toBe(false);
      expect(RelationshipType.fromString('manager').isFamilyRelationship()).toBe(false);
    });

    it('should identify professional relationships', () => {
      expect(RelationshipType.fromString('colleague').isProfessionalRelationship()).toBe(true);
      expect(RelationshipType.fromString('manager').isProfessionalRelationship()).toBe(true);
      expect(RelationshipType.fromString('assistant').isProfessionalRelationship()).toBe(true);
    });

    it('should identify non-professional relationships', () => {
      expect(RelationshipType.fromString('spouse').isProfessionalRelationship()).toBe(false);
      expect(RelationshipType.fromString('friend').isProfessionalRelationship()).toBe(false);
    });
  });

  describe('reciprocal relationships', () => {
    it('should get reciprocal for parent-child', () => {
      const parent = RelationshipType.fromString('parent');
      const child = RelationshipType.fromString('child');
      
      expect(parent.getReciprocal().equals(child)).toBe(true);
      expect(child.getReciprocal().equals(parent)).toBe(true);
    });

    it('should get reciprocal for spouse', () => {
      const spouse = RelationshipType.fromString('spouse');
      expect(spouse.getReciprocal().equals(spouse)).toBe(true);
    });

    it('should get reciprocal for sibling', () => {
      const sibling = RelationshipType.fromString('sibling');
      expect(sibling.getReciprocal().equals(sibling)).toBe(true);
    });

    it('should get reciprocal for grandparent-grandchild', () => {
      const grandparent = RelationshipType.fromString('grandparent');
      const grandchild = RelationshipType.fromString('grandchild');
      
      expect(grandparent.getReciprocal().equals(grandchild)).toBe(true);
      expect(grandchild.getReciprocal().equals(grandparent)).toBe(true);
    });

    it('should get reciprocal for manager-employee', () => {
      const manager = RelationshipType.fromString('manager');
      const employee = RelationshipType.fromString('employee');
      
      expect(manager.getReciprocal().toString()).toBe('employee');
      expect(employee.getReciprocal().toString()).toBe('manager');
    });

    it('should return same type for unknown reciprocals', () => {
      const custom = RelationshipType.fromString('mentor');
      expect(custom.getReciprocal().toString()).toBe('mentor');
    });
  });

  describe('equality', () => {
    it('should be equal to same type', () => {
      const type1 = RelationshipType.fromString('spouse');
      const type2 = RelationshipType.fromString('spouse');
      expect(type1.equals(type2)).toBe(true);
    });

    it('should be equal for gendered variations', () => {
      const husband = RelationshipType.fromString('husband');
      const wife = RelationshipType.fromString('wife');
      const spouse = RelationshipType.fromString('spouse');
      
      expect(husband.equals(wife)).toBe(true);
      expect(husband.equals(spouse)).toBe(true);
      expect(wife.equals(spouse)).toBe(true);
    });

    it('should not be equal to different types', () => {
      const spouse = RelationshipType.fromString('spouse');
      const friend = RelationshipType.fromString('friend');
      expect(spouse.equals(friend)).toBe(false);
    });

    it('should handle null/undefined', () => {
      const type = RelationshipType.fromString('spouse');
      expect(type.equals(null as any)).toBe(false);
      expect(type.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the type string', () => {
      expect(RelationshipType.fromString('spouse').toString()).toBe('spouse');
      expect(RelationshipType.fromString('parent').toString()).toBe('parent');
      expect(RelationshipType.fromString('friend').toString()).toBe('friend');
    });

    it('should return gendered form if that was input', () => {
      expect(RelationshipType.fromString('husband').toString()).toBe('husband');
      expect(RelationshipType.fromString('father').toString()).toBe('father');
    });
  });
});
