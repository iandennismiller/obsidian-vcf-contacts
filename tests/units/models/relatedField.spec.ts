import { describe, it, expect } from 'vitest';
import { VcardFile } from '../../../src/models/vcardFile';

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
    for await (const [slug, record] of new VcardFile(vcardData).parse()) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    expect(record['RELATED[friend]']).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    expect(record['RELATED[colleague]']).toBe('uid:some-custom-uid');
    expect(record['RELATED[sibling]']).toBe('name:Jane Doe');
  });

  it('should handle indexed RELATED fields', async () => {
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
RELATED;TYPE=friend:name:Another Friend
END:VCARD`;

    const results = [];
    for await (const [slug, record] of new VcardFile(vcardData).parse()) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    expect(record['RELATED[friend]']).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    expect(record['RELATED[1:friend]']).toBe('name:Another Friend');
  });

  it('should handle multiple relationships of same kind (3 friends)', async () => {
    // According to spec: "A 3-element set would include RELATED[2:friend] ... and so on"
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:Social Person
RELATED;TYPE=friend:urn:uuid:friend-1-uid
RELATED;TYPE=friend:urn:uuid:friend-2-uid
RELATED;TYPE=friend:name:Friend Three
END:VCARD`;

    const results = [];
    for await (const [slug, record] of new VcardFile(vcardData).parse()) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    // Should use correct indexing: RELATED[friend], RELATED[1:friend], RELATED[2:friend]
    expect(record['RELATED[friend]']).toBe('urn:uuid:friend-1-uid');
    expect(record['RELATED[1:friend]']).toBe('urn:uuid:friend-2-uid');
    expect(record['RELATED[2:friend]']).toBe('name:Friend Three');
  });

  it('should handle multiple relationships of same kind (5 colleagues)', async () => {
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:Networker
RELATED;TYPE=colleague:urn:uuid:colleague-1
RELATED;TYPE=colleague:urn:uuid:colleague-2
RELATED;TYPE=colleague:urn:uuid:colleague-3
RELATED;TYPE=colleague:name:Colleague Four
RELATED;TYPE=colleague:name:Colleague Five
END:VCARD`;

    const results = [];
    for await (const [slug, record] of new VcardFile(vcardData).parse()) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    // Should handle 5 relationships of same type with proper indexing
    expect(record['RELATED[colleague]']).toBe('urn:uuid:colleague-1');
    expect(record['RELATED[1:colleague]']).toBe('urn:uuid:colleague-2');
    expect(record['RELATED[2:colleague]']).toBe('urn:uuid:colleague-3');
    expect(record['RELATED[3:colleague]']).toBe('name:Colleague Four');
    expect(record['RELATED[4:colleague]']).toBe('name:Colleague Five');
  });

  it('should maintain deterministic ordering for relationships of same kind', async () => {
    // According to spec: "First sort by key, then sort by value"
    const vcardData = `BEGIN:VCARD
VERSION:4.0
FN:Sorted Person
RELATED;TYPE=friend:name:Zebra Friend
RELATED;TYPE=friend:name:Apple Friend
RELATED;TYPE=friend:name:Middle Friend
END:VCARD`;

    const results = [];
    for await (const [slug, record] of new VcardFile(vcardData).parse()) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const { record } = results[0];
    
    // Should have 3 friends indexed properly
    expect(record['RELATED[friend]']).toBeDefined();
    expect(record['RELATED[1:friend]']).toBeDefined();
    expect(record['RELATED[2:friend]']).toBeDefined();
    
    // Keys should be in order
    const keys = Object.keys(record).filter(k => k.startsWith('RELATED[') && k.includes('friend'));
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe('RELATED[friend]');
    expect(keys[1]).toBe('RELATED[1:friend]');
    expect(keys[2]).toBe('RELATED[2:friend]');
  });
});