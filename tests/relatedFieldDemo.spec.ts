import { ContactNote } from 'src/contacts/contactNote';

// Create a test ContactNote instance for testing static methods
const createTestContactNote = () => new ContactNote(null as any, null as any, null as any);
import { describe, it, expect } from 'vitest';

describe('RELATED field markdown generation demo', () => {
  it('should demonstrate RELATED field processing for markdown', () => {
    // Sample frontmatter data that would come from VCard parsing
    const frontmatterData = {
      'FN': 'John Doe',
      'EMAIL[HOME]': 'john.doe@example.com',
      'RELATED[friend]': 'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af',
      'RELATED[colleague]': 'uid:jane-smith-001',
      'RELATED[1:colleague]': 'name:Bob Wilson',
      'RELATED[sibling]': 'name:Jane Doe',
      'UID': 'urn:uuid:12345678-1234-1234-1234-123456789012'
    };

    // Process RELATED fields like generateRelatedList would
    const relatedFields = Object.entries(frontmatterData)
      .filter(([key]) => key.startsWith('RELATED'));

    const relationships = relatedFields.map(([key, value]) => {
      const type = contactNote.extractRelationshipType(key);
      const parsed = contactNote.parseRelatedValue(value);
      const contact = parsed ? parsed.value : value;
      
      return { type, contact, originalValue: value };
    });

    // Sort by type then contact name
    relationships.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.contact.localeCompare(b.contact);
    });

    // Verify the expected relationships are extracted correctly
    expect(relationships).toHaveLength(4);
    
    const friendRelation = relationships.find(r => r.type === 'friend');
    expect(friendRelation).toEqual({
      type: 'friend',
      contact: '03a0e51f-d1aa-4385-8a53-e29025acd8af',
      originalValue: 'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af'
    });

    const colleagueRelations = relationships.filter(r => r.type === 'colleague');
    expect(colleagueRelations).toHaveLength(2);
    
    // Sort by contact name to match the expected order
    colleagueRelations.sort((a, b) => a.contact.localeCompare(b.contact));
    expect(colleagueRelations[0].contact).toBe('Bob Wilson');
    expect(colleagueRelations[1].contact).toBe('jane-smith-001');

    const siblingRelation = relationships.find(r => r.type === 'sibling');
    expect(siblingRelation?.contact).toBe('Jane Doe');

    // Generate markdown list items as would appear in the template
    const listItems = relationships.map(rel => 
      `- ${rel.type} [[${rel.contact}]]`
    );

    const expectedMarkdown = [
      '- colleague [[Bob Wilson]]',
      '- colleague [[jane-smith-001]]', 
      '- friend [[03a0e51f-d1aa-4385-8a53-e29025acd8af]]',
      '- sibling [[Jane Doe]]'
    ];

    expect(listItems).toEqual(expectedMarkdown);

    // Demonstrate the complete Related section
    const relatedSection = `\n## Related\n${listItems.join('\n')}\n`;
    
    expect(relatedSection).toBe(`
## Related
- colleague [[Bob Wilson]]
- colleague [[jane-smith-001]]
- friend [[03a0e51f-d1aa-4385-8a53-e29025acd8af]]
- sibling [[Jane Doe]]
`);
  });
});