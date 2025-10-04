import { describe, it, expect } from 'vitest';
import { RelatedSection } from '../../../../src/models/contactNote/entities/document/RelatedSection';
import { Relationship } from '../../../../src/models/contactNote/entities/relationships/Relationship';
import { RelationshipType } from '../../../../src/models/contactNote/entities/relationships/RelationshipType';
import { RelationshipReference } from '../../../../src/models/contactNote/entities/relationships/RelationshipReference';
import { UID } from '../../../../src/models/contactNote/entities/valueObjects/UID';

describe('RelatedSection', () => {
  describe('Factory methods', () => {
    it('should create section from markdown content', () => {
      const content = '- spouse [[Jane Doe]]\n- parent [[uid:123|Mom]]';
      const section = RelatedSection.fromMarkdown(content);

      expect(section.getName()).toBe('Related');
      expect(section.getLevel()).toBe(2);
      expect(section.getRelationships()).toHaveLength(2);
    });

    it('should create section from relationships', () => {
      const rel1 = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );
      const rel2 = Relationship.create(
        RelationshipType.fromString('parent'),
        RelationshipReference.fromUID(UID.fromString('contact-123'))
      );

      const section = RelatedSection.fromRelationships([rel1, rel2]);

      expect(section.getName()).toBe('Related');
      expect(section.getRelationships()).toHaveLength(2);
      expect(section.isEmpty()).toBe(false);
    });

    it('should create empty section', () => {
      const section = RelatedSection.empty();

      expect(section.getName()).toBe('Related');
      expect(section.getRelationships()).toHaveLength(0);
      expect(section.isEmpty()).toBe(true);
    });

    it('should allow custom section name and level', () => {
      const section = RelatedSection.empty('Relationships', 3);

      expect(section.getName()).toBe('Relationships');
      expect(section.getLevel()).toBe(3);
    });
  });

  describe('Parsing', () => {
    it('should parse simple relationship list', () => {
      const content = '- spouse [[Jane Doe]]\n- child [[John Doe]]';
      const section = RelatedSection.fromMarkdown(content);
      const relationships = section.getRelationships();

      expect(relationships).toHaveLength(2);
      expect(relationships[0].getType().toString()).toBe('spouse');
      expect(relationships[1].getType().toString()).toBe('child');
    });

    it('should parse relationships with UIDs', () => {
      const content = '- parent [[uid:123|Mom]]\n- sibling [[uid:456|Brother]]';
      const section = RelatedSection.fromMarkdown(content);
      const relationships = section.getRelationships();

      expect(relationships).toHaveLength(2);
      expect(relationships[0].getTarget().isUIDReference()).toBe(true);
      expect(relationships[1].getTarget().isUIDReference()).toBe(true);
    });

    it('should skip invalid relationship lines', () => {
      const content = '- spouse [[Jane Doe]]\nNot a relationship\n- parent [[Mom]]';
      const section = RelatedSection.fromMarkdown(content);

      expect(section.getRelationships()).toHaveLength(2);
    });

    it('should handle empty content', () => {
      const section = RelatedSection.fromMarkdown('');

      expect(section.getRelationships()).toHaveLength(0);
    });

    it('should handle content with only whitespace', () => {
      const section = RelatedSection.fromMarkdown('   \n  \n  ');

      expect(section.getRelationships()).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('should validate correct section', () => {
      const rel = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );
      const section = RelatedSection.fromRelationships([rel]);
      const result = section.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate relationships', () => {
      const rel1 = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );
      const rel2 = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );
      const section = RelatedSection.fromRelationships([rel1, rel2]);
      const result = section.validate();

      expect(result.warnings.some(w => w.includes('Duplicate'))).toBe(true);
    });

    it('should validate empty section', () => {
      const section = RelatedSection.empty();
      const result = section.validate();

      expect(result.isValid).toBe(true);
    });
  });

  describe('Relationship access', () => {
    it('should get all relationships', () => {
      const content = '- spouse [[Jane]]\n- child [[John]]\n- parent [[Mom]]';
      const section = RelatedSection.fromMarkdown(content);

      expect(section.getRelationships()).toHaveLength(3);
    });

    it('should get relationships by type', () => {
      const content = '- spouse [[Jane]]\n- child [[John]]\n- child [[Mary]]';
      const section = RelatedSection.fromMarkdown(content);
      const children = section.getRelationshipsByType('child');

      expect(children).toHaveLength(2);
      expect(children[0].getType().toString()).toBe('child');
    });

    it('should check if relationship exists', () => {
      const rel = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );
      const section = RelatedSection.fromRelationships([rel]);

      expect(section.hasRelationship(rel)).toBe(true);
    });

    it('should return false for non-existent relationship', () => {
      const section = RelatedSection.empty();
      const rel = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );

      expect(section.hasRelationship(rel)).toBe(false);
    });
  });

  describe('Relationship mutation', () => {
    it('should add relationship (immutable)', () => {
      const section = RelatedSection.empty();
      const rel = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );

      const newSection = section.addRelationship(rel);

      expect(section.getRelationships()).toHaveLength(0);
      expect(newSection.getRelationships()).toHaveLength(1);
      expect(newSection.hasRelationship(rel)).toBe(true);
    });

    it('should remove relationship (immutable)', () => {
      const rel = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );
      const section = RelatedSection.fromRelationships([rel]);

      const newSection = section.removeRelationship(rel);

      expect(section.getRelationships()).toHaveLength(1);
      expect(newSection.getRelationships()).toHaveLength(0);
    });
  });

  describe('Markdown conversion', () => {
    it('should convert to markdown with heading', () => {
      const rel = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromName('Jane Doe')
      );
      const section = RelatedSection.fromRelationships([rel]);
      const markdown = section.toMarkdown();

      expect(markdown).toContain('## Related');
      expect(markdown).toContain('- spouse [[Jane Doe]]');
    });

    it('should handle empty section', () => {
      const section = RelatedSection.empty();
      const markdown = section.toMarkdown();

      expect(markdown).toBe('## Related\n');
    });

    it('should use custom heading level', () => {
      const section = RelatedSection.empty('Relationships', 3);
      const markdown = section.toMarkdown();

      expect(markdown).toBe('### Relationships\n');
    });

    it('should preserve relationship order', () => {
      const content = '- spouse [[Jane]]\n- child [[John]]\n- parent [[Mom]]';
      const section = RelatedSection.fromMarkdown(content);
      const markdown = section.toMarkdown();

      expect(markdown.indexOf('spouse')).toBeLessThan(markdown.indexOf('child'));
      expect(markdown.indexOf('child')).toBeLessThan(markdown.indexOf('parent'));
    });
  });

  describe('Parsed relationships compatibility', () => {
    it('should get parsed relationships in old format', () => {
      const content = '- spouse [[Jane Doe]]\n- parent [[uid:123|Mom]]';
      const section = RelatedSection.fromMarkdown(content);
      const parsed = section.getParsedRelationships();

      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        type: 'spouse',
        contactName: 'Jane Doe',
        uid: undefined
      });
      expect(parsed[1].type).toBe('parent');
      expect(parsed[1].uid).toBe('123');
    });

    it('should handle UID-based relationships', () => {
      const rel = Relationship.create(
        RelationshipType.fromString('spouse'),
        RelationshipReference.fromUID(UID.fromString('contact-123'))
      );
      const section = RelatedSection.fromRelationships([rel]);
      const parsed = section.getParsedRelationships();

      expect(parsed[0].uid).toBe('contact-123');
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve data through markdown round-trip', () => {
      const content = '- spouse [[Jane Doe]]\n- child [[John Doe]]';
      const section1 = RelatedSection.fromMarkdown(content);
      const markdown = section1.toMarkdown();
      const section2 = RelatedSection.fromMarkdown(markdown.split('\n').slice(1).join('\n'));

      expect(section2.getRelationships()).toHaveLength(2);
      expect(section2.getRelationships()[0].getType().toString()).toBe('spouse');
      expect(section2.getRelationships()[1].getType().toString()).toBe('child');
    });
  });
});
