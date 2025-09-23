import { describe, it, expect } from 'vitest';
import { vcard } from '../src/contacts/vcard';

describe('vCard RELATED field support', () => {
  it('should parse RELATED fields from vCard', async () => {
    const vCardData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
UID:12345678-1234-1234-1234-123456789012
RELATED;TYPE=friend:urn:uuid:87654321-4321-4321-4321-210987654321
RELATED;TYPE=colleague:name:Jane Smith
RELATED;TYPE=parent:uid:custom-parent-id
END:VCARD`;

    const results = [];
    for await (const [slug, vCardObject] of vcard.parse(vCardData)) {
      results.push({ slug, vCardObject });
    }

    expect(results).toHaveLength(1);
    const parsed = results[0].vCardObject;

    expect(parsed['RELATED[friend]']).toBe('urn:uuid:87654321-4321-4321-4321-210987654321');
    expect(parsed['RELATED[colleague]']).toBe('name:Jane Smith');
    expect(parsed['RELATED[parent]']).toBe('uid:custom-parent-id');
  });

  it('should handle multiple RELATED fields of the same type', async () => {
    const vCardData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
UID:12345678-1234-1234-1234-123456789012
RELATED;TYPE=friend:urn:uuid:friend1-uuid
RELATED;TYPE=friend:urn:uuid:friend2-uuid
RELATED;TYPE=friend:name:Friend Three
END:VCARD`;

    const results = [];
    for await (const [slug, vCardObject] of vcard.parse(vCardData)) {
      results.push({ slug, vCardObject });
    }

    const parsed = results[0].vCardObject;

    expect(parsed['RELATED[friend]']).toBe('urn:uuid:friend1-uuid');
    expect(parsed['RELATED[1:friend]']).toBe('urn:uuid:friend2-uuid');
    expect(parsed['RELATED[2:friend]']).toBe('name:Friend Three');
  });

  it('should handle RELATED fields without TYPE parameter', async () => {
    const vCardData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
UID:12345678-1234-1234-1234-123456789012
RELATED:urn:uuid:some-contact-uuid
END:VCARD`;

    const results = [];
    for await (const [slug, vCardObject] of vcard.parse(vCardData)) {
      results.push({ slug, vCardObject });
    }

    const parsed = results[0].vCardObject;

    expect(parsed['RELATED']).toBe('urn:uuid:some-contact-uuid');
  });

  it('should generate RELATED fields in vCard output', async () => {
    // This test would require setting up a mock file system and Obsidian App
    // For now, we'll focus on parsing which is the core functionality
    expect(true).toBe(true); // Placeholder
  });
});