/**
 * @fileoverview Simple integration tests for the core relationship functionality
 */

import { describe, expect, it } from 'vitest';
import { 
  parseRelationshipMarkdown,
  renderRelationshipMarkdown,
  getComplementRelationship,
  parseRelatedField,
  formatRelatedField
} from '../src/contacts/relationships';

describe('End-to-End Relationship Processing', () => {
  it('should handle complete relationship flow from vCard to markdown and back', () => {
    // 1. Parse a RELATED field from vCard format
    const vCardValue = 'urn:uuid:12345-abcde-67890';
    const relationshipType = 'friend';
    
    const parsedRelation = parseRelatedField(vCardValue, relationshipType);
    expect(parsedRelation).toEqual({
      uid: '12345-abcde-67890',
      type: 'friend'
    });

    // 2. Render as markdown
    const contactName = 'Jane Smith';
    const currentContactName = 'John Doe';
    const markdown = renderRelationshipMarkdown(contactName, relationshipType, currentContactName);
    expect(markdown).toBe('- [[Jane Smith]] is a friend of John Doe');

    // 3. Parse back from markdown
    const parsedMarkdown = parseRelationshipMarkdown(markdown);
    expect(parsedMarkdown).toEqual({
      contactName: 'Jane Smith',
      relationshipType: 'friend'
    });

    // 4. Format back to vCard
    if (parsedRelation) {
      const formattedUID = formatRelatedField(parsedRelation.uid);
      expect(formattedUID).toBe('urn:uuid:12345-abcde-67890');
    }
  });

  it('should handle bidirectional relationships correctly', () => {
    // Test parent-child relationship
    const parentType = 'parent';
    const childType = getComplementRelationship(parentType);
    expect(childType).toBe('child');

    // Test symmetric relationship  
    const friendType = 'friend';
    const friendComplement = getComplementRelationship(friendType);
    expect(friendComplement).toBe('friend');

    // Render both sides of the relationship
    const parentMarkdown = renderRelationshipMarkdown('Bob Johnson', 'parent', 'Alice Johnson');
    const childMarkdown = renderRelationshipMarkdown('Alice Johnson', 'child', 'Bob Johnson');
    
    expect(parentMarkdown).toBe('- [[Bob Johnson]] is a parent of Alice Johnson');
    expect(childMarkdown).toBe('- [[Alice Johnson]] is a child of Bob Johnson');
  });

  it('should handle complex relationship scenarios', () => {
    const relationships = [
      { type: 'spouse', person: 'Mary Wilson', current: 'John Wilson' },
      { type: 'child', person: 'Tommy Wilson', current: 'John Wilson' },
      { type: 'child', person: 'Sally Wilson', current: 'John Wilson' },
      { type: 'parent', person: 'Robert Wilson', current: 'John Wilson' },
      { type: 'friend', person: 'Dave Smith', current: 'John Wilson' }
    ];

    const markdownLines = relationships.map(rel => 
      renderRelationshipMarkdown(rel.person, rel.type, rel.current)
    );

    expect(markdownLines).toEqual([
      '- [[Mary Wilson]] is a spouse of John Wilson',
      '- [[Tommy Wilson]] is a child of John Wilson',
      '- [[Sally Wilson]] is a child of John Wilson',
      '- [[Robert Wilson]] is a parent of John Wilson',
      '- [[Dave Smith]] is a friend of John Wilson'
    ]);

    // Test parsing all back
    const parsedRelationships = markdownLines.map(line => parseRelationshipMarkdown(line));
    
    expect(parsedRelationships).toEqual([
      { contactName: 'Mary Wilson', relationshipType: 'spouse' },
      { contactName: 'Tommy Wilson', relationshipType: 'child' },
      { contactName: 'Sally Wilson', relationshipType: 'child' },
      { contactName: 'Robert Wilson', relationshipType: 'parent' },
      { contactName: 'Dave Smith', relationshipType: 'friend' }
    ]);
  });

  it('should handle edge cases in relationship processing', () => {
    // Test names with special characters
    const specialName = "O'Connor, Sean-Michael Jr.";
    const markdown = renderRelationshipMarkdown(specialName, 'colleague', 'Jane Doe');
    expect(markdown).toBe("- [[O'Connor, Sean-Michael Jr.]] is a colleague of Jane Doe");
    
    const parsed = parseRelationshipMarkdown(markdown);
    expect(parsed?.contactName).toBe("O'Connor, Sean-Michael Jr.");
    expect(parsed?.relationshipType).toBe('colleague');

    // Test articles (a vs an)
    const uncleMarkdown = renderRelationshipMarkdown('Uncle Bob', 'uncle', 'Little Tim');
    expect(uncleMarkdown).toBe('- [[Uncle Bob]] is an uncle of Little Tim');

    const friendMarkdown = renderRelationshipMarkdown('Friend Joe', 'friend', 'Little Tim');
    expect(friendMarkdown).toBe('- [[Friend Joe]] is a friend of Little Tim');
  });
});

describe('Relationship Section Processing', () => {
  it('should extract and replace relationships section correctly', () => {
    const originalContent = `---
FN: John Doe
N.GN: John
N.FN: Doe
---

#### Notes
Some personal notes here.

## Relationships

- [[Old Friend]] is a friend of John Doe
- [[Former Boss]] is a manager of John Doe

More content here.

#Contact #Work
`;

    const newRelationships = `## Relationships

- [[New Friend]] is a friend of John Doe
- [[Current Boss]] is a manager of John Doe
- [[Spouse]] is a spouse of John Doe

`;

    // Test extraction - get the actual full relationships section
    const relationshipsStart = originalContent.indexOf('## Relationships');
    const relationshipsEnd = originalContent.indexOf('\nMore content');
    const relationshipsSection = originalContent.substring(relationshipsStart, relationshipsEnd);
    
    expect(relationshipsSection).toContain('- [[Old Friend]] is a friend of John Doe');
    expect(relationshipsSection).toContain('- [[Former Boss]] is a manager of John Doe');

    // Test replacement
    const relationshipsSectionRegex = /^## Relationships\s*\n[\s\S]*?(?=\nMore content)/m;
    const updatedContent = originalContent.replace(relationshipsSectionRegex, newRelationships.trim());
    expect(updatedContent).toContain('- [[New Friend]] is a friend of John Doe');
    expect(updatedContent).toContain('- [[Current Boss]] is a manager of John Doe');
    expect(updatedContent).toContain('- [[Spouse]] is a spouse of John Doe');
    expect(updatedContent).not.toContain('- [[Old Friend]] is a friend of John Doe');
    expect(updatedContent).toContain('#### Notes');
    expect(updatedContent).toContain('#Contact #Work');
  });

  it('should insert relationships section when none exists', () => {
    const contentWithoutRelationships = `---
FN: Jane Smith
---

#### Notes
Some notes

#Contact #Friend
`;

    const relationshipsSection = `## Relationships

- [[John Doe]] is a friend of Jane Smith

`;

    // Insert before hashtags
    const hashtagMatch = contentWithoutRelationships.match(/\n(#\w+[\s#\w]*)\s*$/);
    expect(hashtagMatch).toBeTruthy();
    
    if (hashtagMatch) {
      const hashtagStart = hashtagMatch.index!;
      const updatedContent = contentWithoutRelationships.slice(0, hashtagStart) + 
        '\n\n' + relationshipsSection + 
        contentWithoutRelationships.slice(hashtagStart);
      
      expect(updatedContent).toContain('## Relationships');
      expect(updatedContent).toContain('- [[John Doe]] is a friend of Jane Smith');
      expect(updatedContent).toContain('#Contact #Friend');
      
      // Verify order is maintained
      const relationshipsIndex = updatedContent.indexOf('## Relationships');
      const hashtagIndex = updatedContent.indexOf('#Contact #Friend');
      expect(relationshipsIndex).toBeLessThan(hashtagIndex);
    }
  });
});