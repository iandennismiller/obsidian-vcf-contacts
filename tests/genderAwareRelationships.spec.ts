import { describe, it, expect, vi } from 'vitest';
import { VCFile as vcard } from 'src/contacts/VCFile';
import { mdRender } from 'src/contacts/contactNote';
import { type Gender } from 'src/contacts/genderUtils';

// Mock obsidian module with all required exports
vi.mock('obsidian', () => ({
  stringifyYaml: (obj: any) => {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  },
  Modal: vi.fn(),
  Notice: vi.fn()
}));

describe('GENDER field and gender-aware relationships', () => {
  it('should parse GENDER field from VCard', async () => {
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
GENDER:M
RELATED;TYPE=parent:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
END:VCARD`;

    const results = [];
  for await (const [slug, record] of vcard.parseVCardData(vcardData)) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    expect(record['GENDER']).toBe('M');
    expect(record['RELATED[parent]']).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
  });

  it('should render gender-aware relationship terms with gender lookup', () => {
    const record = {
      'FN': 'Jane Doe',
      'GENDER': 'F',
      'RELATED[parent]': 'urn:uuid:parent-uuid-123',
      'RELATED[auncle]': 'name:Alex Smith',
      'RELATED[child]': 'uid:child-123',
      'RELATED[sibling]': 'name:Robin Doe',
      'RELATED[friend]': 'name:Best Friend'
    };

    // Mock gender lookup function
    const genderLookup = (contactRef: string): Gender => {
      if (contactRef === 'parent-uuid-123') return 'F'; // mother
      if (contactRef === 'Alex Smith') return 'M'; // uncle
      if (contactRef === 'child-123') return 'F'; // daughter
      if (contactRef === 'Robin Doe') return 'NB'; // sibling (genderless)
      return null; // friend (genderless anyway)
    };

    const result = mdRender(record, '#Contact', genderLookup);
    
    // Check that gendered terms are used
    expect(result).toContain('- daughter [[child-123]]');
    expect(result).toContain('- friend [[Best Friend]]');
    expect(result).toContain('- mother [[parent-uuid-123]]');
    expect(result).toContain('- sibling [[Robin Doe]]'); // Non-binary gender
    expect(result).toContain('- uncle [[Alex Smith]]');
  });

  it('should use genderless terms when no gender lookup is provided', () => {
    const record = {
      'FN': 'John Doe',
      'RELATED[parent]': 'name:Parent Name',
      'RELATED[auncle]': 'name:Auncle Name'
    };

    const result = mdRender(record, '#Contact');
    
    // Should use original relationship terms without gender lookup
    expect(result).toContain('- parent [[Parent Name]]');
    expect(result).toContain('- auncle [[Auncle Name]]');
  });

  it('should handle GENDER field in frontmatter', () => {
    const record = {
      'FN': 'Test Person',
      'GENDER': 'NB',
      'EMAIL[HOME]': 'test@example.com'
    };

    const result = mdRender(record, '#Contact');
    
    // GENDER should appear in frontmatter
    expect(result).toContain('GENDER: NB');
  });

  it('should parse various GENDER field values', async () => {
    const genderTests = [
      { input: 'M', expected: 'M' },
      { input: 'F', expected: 'F' },
      { input: 'NB', expected: 'NB' },
      { input: 'U', expected: 'U' },
      { input: '', expected: '' }
    ];

    for (const test of genderTests) {
      const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:Test Person
${test.input ? `GENDER:${test.input}` : ''}
END:VCARD`;

      const results = [];
  for await (const [slug, record] of vcard.parseVCardData(vcardData)) {
        results.push({ slug, record });
      }

      expect(results).toHaveLength(1);
      const { record } = results[0];
      
      if (test.input) {
        expect(record['GENDER']).toBe(test.expected);
      } else {
        expect(record['GENDER']).toBeUndefined();
      }
    }
  });

  it('should gracefully handle gender lookup errors', () => {
    const record = {
      'FN': 'Test Person',
      'RELATED[parent]': 'name:Unknown Parent'
    };

    // Gender lookup that throws an error
    const faultyGenderLookup = (contactRef: string): Gender => {
      throw new Error('Lookup failed');
    };

    const result = mdRender(record, '#Contact', faultyGenderLookup);
    
    // Should fall back to original relationship term
    expect(result).toContain('- parent [[Unknown Parent]]');
  });
});