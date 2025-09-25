import { describe, it, expect } from 'vitest';
import { RelationshipContentParser } from '../src/relationships/relationshipContentParser';

describe('RelationshipContentParser Integration', () => {
  let parser: RelationshipContentParser;

  beforeEach(() => {
    parser = new RelationshipContentParser();
  });

  describe('Markdown Related List Parsing', () => {
    it('should parse complex Related list with mixed relationship types', () => {
      const content = `---
FN: John Doe
UID: john-123
---

# John Doe

Some content about John.

## Related

- spouse [[Jane Smith]]
- child [[Bobby Doe]]
- child [[Alice Doe]]
- parent [[Mary Johnson]]
- sibling [[Bob Doe]]
- friend [[Charlie Brown]]

## Notes

Some notes about John.`;

      const result = parser.parseRelatedList(content);
      
      expect(result.sectionFound).toBe(true);
      expect(result.relationships).toHaveLength(6);
      
      // Check specific relationships
      expect(result.relationships).toEqual(expect.arrayContaining([
        { type: 'spouse', contactName: 'Jane Smith', impliedGender: undefined },
        { type: 'child', contactName: 'Bobby Doe', impliedGender: undefined },
        { type: 'child', contactName: 'Alice Doe', impliedGender: undefined },
        { type: 'parent', contactName: 'Mary Johnson', impliedGender: undefined },
        { type: 'sibling', contactName: 'Bob Doe', impliedGender: undefined },
        { type: 'friend', contactName: 'Charlie Brown', impliedGender: undefined }
      ]));
    });

    it('should handle gendered relationship terms correctly', () => {
      const content = `## Related

- father [[Dad]]
- mother [[Mom]]  
- son [[Boy Child]]
- daughter [[Girl Child]]
- brother [[Male Sibling]]
- sister [[Female Sibling]]
- uncle [[Uncle Bob]]
- aunt [[Aunt Mary]]
- nephew [[Nephew]]
- niece [[Niece]]
- grandfather [[Grandpa]]
- grandmother [[Grandma]]
- grandson [[Grandson]]
- granddaughter [[Granddaughter]]`;

      const result = parser.parseRelatedList(content);
      
      expect(result.relationships).toHaveLength(14);
      
      // Check that gendered terms are normalized correctly
      expect(result.relationships).toEqual(expect.arrayContaining([
        { type: 'parent', contactName: 'Dad', impliedGender: 'M' },
        { type: 'parent', contactName: 'Mom', impliedGender: 'F' },
        { type: 'child', contactName: 'Boy Child', impliedGender: 'M' },
        { type: 'child', contactName: 'Girl Child', impliedGender: 'F' },
        { type: 'sibling', contactName: 'Male Sibling', impliedGender: 'M' },
        { type: 'sibling', contactName: 'Female Sibling', impliedGender: 'F' },
        { type: 'auncle', contactName: 'Uncle Bob', impliedGender: 'M' },
        { type: 'auncle', contactName: 'Aunt Mary', impliedGender: 'F' },
        { type: 'nibling', contactName: 'Nephew', impliedGender: 'M' },
        { type: 'nibling', contactName: 'Niece', impliedGender: 'F' },
        { type: 'grandparent', contactName: 'Grandpa', impliedGender: 'M' },
        { type: 'grandparent', contactName: 'Grandma', impliedGender: 'F' },
        { type: 'grandchild', contactName: 'Grandson', impliedGender: 'M' },
        { type: 'grandchild', contactName: 'Granddaughter', impliedGender: 'F' }
      ]));
    });

    it('should ignore invalid relationship lines', () => {
      const content = `## Related

- spouse [[Valid Spouse]]
- invalid-relationship [[Should be ignored]]
- spouse  # Missing contact link
- [[Contact with no relationship]]
- not a list item
- colleague [[Valid Colleague]]`;

      const result = parser.parseRelatedList(content);
      
      expect(result.relationships).toHaveLength(2);
      expect(result.relationships).toEqual(expect.arrayContaining([
        { type: 'spouse', contactName: 'Valid Spouse', impliedGender: undefined },
        { type: 'colleague', contactName: 'Valid Colleague', impliedGender: undefined }
      ]));
    });
  });

  describe('Related List Generation', () => {
    it('should generate Related list with appropriate gender terms', () => {
      const relationships = [
        { type: 'parent' as const, targetName: 'John Father', targetGender: 'M' as const },
        { type: 'parent' as const, targetName: 'Jane Mother', targetGender: 'F' as const },
        { type: 'child' as const, targetName: 'Bob Son', targetGender: 'M' as const },
        { type: 'child' as const, targetName: 'Alice Daughter', targetGender: 'F' as const },
        { type: 'spouse' as const, targetName: 'Partner', targetGender: undefined },
        { type: 'friend' as const, targetName: 'Best Friend', targetGender: undefined }
      ];

      const content = parser.generateRelatedListContent(relationships);

      expect(content).toBe(`## Related
- daughter [[Alice Daughter]]
- son [[Bob Son]]
- friend [[Best Friend]]
- mother [[Jane Mother]]
- father [[John Father]]
- spouse [[Partner]]
`);
    });

    it('should handle empty relationships list', () => {
      const content = parser.generateRelatedListContent([]);
      expect(content).toBe('## Related\n\n');
    });
  });

  describe('Content Update', () => {
    it('should update existing Related section', () => {
      const originalContent = `---
FN: Test Person
---

# Test Person

## Related

- spouse [[Old Spouse]]
- child [[Old Child]]

## Notes

Some notes.`;

      const newRelationships = [
        { type: 'spouse' as const, targetName: 'New Spouse', targetGender: 'F' as const },
        { type: 'parent' as const, targetName: 'New Parent', targetGender: 'M' as const }
      ];

      const updatedContent = parser.updateRelatedSection(originalContent, newRelationships);

      expect(updatedContent).toContain('- spouse [[New Spouse]]'); // Uses neutral term when no gender
      expect(updatedContent).toContain('- father [[New Parent]]');
      expect(updatedContent).not.toContain('Old Spouse');
      expect(updatedContent).not.toContain('Old Child');
      
      // Should preserve other sections
      expect(updatedContent).toContain('# Test Person');
      expect(updatedContent).toContain('## Notes');
      expect(updatedContent).toContain('Some notes.');
    });

    it('should add Related section if it does not exist', () => {
      const originalContent = `---
FN: Test Person
---

# Test Person

## Notes

Some notes.`;

      const relationships = [
        { type: 'friend' as const, targetName: 'Best Friend', targetGender: undefined }
      ];

      const updatedContent = parser.updateRelatedSection(originalContent, relationships);

      expect(updatedContent).toContain('## Related');
      expect(updatedContent).toContain('- friend [[Best Friend]]');
      expect(updatedContent).toContain('Some notes.'); // Should preserve existing content
    });
  });

  describe('Contact Link Extraction', () => {
    it('should extract all contact links from content', () => {
      const content = `
This is a note about [[John Doe]] and his relationship with [[Jane Smith]].

## Related

- spouse [[Jane Smith]]
- child [[Bobby Doe]]

## Notes

Also mentions [[Charlie Brown]] and [[Alice Wonder]].
Multiple references to [[John Doe]] should only appear once.
`;

      const links = parser.extractContactLinks(content);
      
      expect(links).toHaveLength(5);
      expect(links).toEqual(expect.arrayContaining([
        'John Doe',
        'Jane Smith', 
        'Bobby Doe',
        'Charlie Brown',
        'Alice Wonder'
      ]));
    });

    it('should handle content with no links', () => {
      const content = 'This content has no contact links.';
      const links = parser.extractContactLinks(content);
      expect(links).toEqual([]);
    });
  });

  describe('Content Analysis', () => {
    it('should detect if content has Related section', () => {
      const contentWithRelated = `
## About

Some content.

## Related

- friend [[Someone]]

## Notes
`;

      const contentWithoutRelated = `
## About

Some content.

## Notes

No relationships here.
`;

      expect(parser.hasRelatedSection(contentWithRelated)).toBe(true);
      expect(parser.hasRelatedSection(contentWithoutRelated)).toBe(false);
    });

    it('should extract relationship terms used in content', () => {
      const content = `
## Related

- father [[Dad]]
- mother [[Mom]]
- friend [[Buddy]]
- invalid-term [[Someone]]
- colleague [[Worker]]
`;

      const terms = parser.extractRelationshipTerms(content);
      
      expect(terms).toEqual(expect.arrayContaining([
        'father',
        'mother', 
        'friend',
        'colleague'
      ]));
      
      // Should not include invalid terms
      expect(terms).not.toContain('invalid-term');
    });
  });
});