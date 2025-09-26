import { describe, it, expect } from 'vitest';
import { vcard } from 'src/contacts/vcard';
import { mdRender } from 'src/contacts/contactMdTemplate';

describe('RELATED field support', () => {
  it('should parse RELATED fields from VCard', async () => {
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
RELATED;TYPE=colleague:uid:some-custom-uid
RELATED;TYPE=sibling:name:Jane Doe
END:VCARD`;

    const results = [];
    for await (const [slug, record] of vcard.parse(vcardData)) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    expect(record['RELATED[friend]']).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    expect(record['RELATED[colleague]']).toBe('uid:some-custom-uid');
    expect(record['RELATED[sibling]']).toBe('name:Jane Doe');
  });

  it('should generate Related section in markdown template', () => {
    const record = {
      'FN': 'John Doe',
      'RELATED[friend]': 'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af',
      'RELATED[colleague]': 'uid:some-custom-uid',
      'RELATED[sibling]': 'name:Jane Doe'
    };

    const result = mdRender(record, '#Contact');
    
    expect(result).toContain('## Related');
    expect(result).toContain('- friend [[03a0e51f-d1aa-4385-8a53-e29025acd8af]]');
    expect(result).toContain('- colleague [[some-custom-uid]]');
    expect(result).toContain('- sibling [[Jane Doe]]');
  });

  it('should handle indexed RELATED fields', async () => {
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
RELATED;TYPE=friend:name:Another Friend
END:VCARD`;

    const results = [];
    for await (const [slug, record] of vcard.parse(vcardData)) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    expect(record['RELATED[friend]']).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    expect(record['RELATED[1:friend]']).toBe('name:Another Friend');
  });

  it('should not show Related section when no RELATED fields', () => {
    const record = {
      'FN': 'John Doe',
      'EMAIL[HOME]': 'john@example.com'
    };

    const result = mdRender(record, '#Contact');
    
    expect(result).not.toContain('## Related');
  });
});