import { describe, it, expect, vi } from 'vitest';
import { VCFile as vcard } from 'src/contacts/VCFile';
import { mdRender } from 'src/contacts/contactNote';
import { parseGender, type Gender } from 'src/contacts/genderUtils';

// Mock obsidian
vi.mock('obsidian', () => ({
  stringifyYaml: (obj: any) => {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  },
  Modal: vi.fn(),
  Notice: vi.fn()
}));

describe('Complete GENDER and RELATED field demo', () => {
  it('should demonstrate the complete gender-aware relationship workflow', async () => {
    // Sample VCard with GENDER and various RELATED fields
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:Jane Smith
N:Smith;Jane;;;
EMAIL;TYPE=HOME:jane.smith@example.com
GENDER:F
RELATED;TYPE=parent:urn:uuid:father-uuid-123
RELATED;TYPE=auncle:name:Alex Johnson
RELATED;TYPE=child:uid:daughter-id-456
RELATED;TYPE=sibling:name:Robin Smith
RELATED;TYPE=spouse:uid:husband-id-789
RELATED;TYPE=friend:name:Best Friend Ever
UID:urn:uuid:jane-smith-uuid-2023
END:VCARD`;

    // Parse the VCard
    const results = [];
  for await (const [slug, record] of vcard.parseVCardData(vcardData)) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    // Verify GENDER field is parsed
    expect(record['GENDER']).toBe('F');
    
    // Verify RELATED fields are parsed with genderless terms
    expect(record['RELATED[parent]']).toBe('urn:uuid:father-uuid-123');
    expect(record['RELATED[auncle]']).toBe('name:Alex Johnson');
    expect(record['RELATED[child]']).toBe('uid:daughter-id-456');
    expect(record['RELATED[sibling]']).toBe('name:Robin Smith');
    expect(record['RELATED[spouse]']).toBe('uid:husband-id-789');
    expect(record['RELATED[friend]']).toBe('name:Best Friend Ever');

    // Create a gender lookup function that simulates looking up related contacts
    const genderLookup = (contactRef: string): Gender => {
      // Simulate gender lookup for related contacts
      if (contactRef === 'father-uuid-123') return 'M';  // father
      if (contactRef === 'Alex Johnson') return 'F';     // aunt
      if (contactRef === 'daughter-id-456') return 'F';  // daughter
      if (contactRef === 'Robin Smith') return 'NB';     // sibling (non-binary)
      if (contactRef === 'husband-id-789') return 'M';   // husband
      return null; // friend (no gender specification needed)
    };

    // Generate markdown with gender-aware rendering
    const markdown = mdRender(record, '#Contact', genderLookup);
    
    // Verify frontmatter contains GENDER and genderless relationship terms
    expect(markdown).toContain('GENDER: F');
    expect(markdown).toContain('RELATED[parent]: urn:uuid:father-uuid-123');
    expect(markdown).toContain('RELATED[auncle]: name:Alex Johnson');
    
    // Verify Related section uses gender-aware display terms
    expect(markdown).toContain('## Related');
    expect(markdown).toContain('- aunt [[Alex Johnson]]');        // auncle + F = aunt
    expect(markdown).toContain('- daughter [[daughter-id-456]]'); // child + F = daughter
    expect(markdown).toContain('- father [[father-uuid-123]]');   // parent + M = father
    expect(markdown).toContain('- friend [[Best Friend Ever]]');  // friend stays friend
    expect(markdown).toContain('- husband [[husband-id-789]]');   // spouse + M = husband
    expect(markdown).toContain('- sibling [[Robin Smith]]');      // sibling + NB = sibling

    console.log('Generated markdown:', markdown);
  });

  it('should demonstrate parsing various GENDER field formats', () => {
    const genderTests = [
      { input: 'M', expected: 'M' },
      { input: 'F', expected: 'F' },
      { input: 'NB', expected: 'NB' },
      { input: 'U', expected: 'U' },
      { input: 'MALE', expected: 'M' },
      { input: 'female', expected: 'F' },
      { input: 'Non-Binary', expected: 'NB' },
      { input: 'unspecified', expected: 'U' },
      { input: '', expected: null },
      { input: 'invalid', expected: null }
    ];

    genderTests.forEach(test => {
      const result = parseGender(test.input);
      expect(result).toBe(test.expected);
    });
  });
});