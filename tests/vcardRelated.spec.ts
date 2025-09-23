import { describe, expect, it } from 'vitest';
import { vcard } from 'src/contacts/vcard';

describe('vCard RELATED field support', () => {
  it('should parse RELATED field with TYPE parameter', async () => {
    const vcfData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
RELATED;TYPE=friend:Jane Smith
RELATED;TYPE=spouse:Mary Doe
END:VCARD`;

    const results: any[] = [];
    for await (const [slug, vCardObject] of vcard.parse(vcfData)) {
      if (slug) {
        results.push(vCardObject);
      }
    }

    expect(results).toHaveLength(1);
    const parsedVCard = results[0];
    
    expect(parsedVCard['RELATED[friend]']).toBe('Jane Smith');
    expect(parsedVCard['RELATED[spouse]']).toBe('Mary Doe');
  });

  it('should parse RELATED field without TYPE parameter', async () => {
    const vcfData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
RELATED:Jane Smith
END:VCARD`;

    const results: any[] = [];
    for await (const [slug, vCardObject] of vcard.parse(vcfData)) {
      if (slug) {
        results.push(vCardObject);
      }
    }

    expect(results).toHaveLength(1);
    const parsedVCard = results[0];
    
    expect(parsedVCard['RELATED[related]']).toBe('Jane Smith');
  });

  it('should serialize RELATED fields to vCard format', async () => {
    const mockApp = {
      metadataCache: {
        getFileCache: () => ({
          frontmatter: {
            FN: 'John Doe',
            UID: '03a0e51f-d1aa-4385-8a53-e29025acd8af',
            'RELATED[friend]': 'urn:uuid:456e8400-e29b-41d4-a716-446655440000',
            'RELATED[spouse]': 'name:Mary Doe',
            VERSION: '4.0'
          }
        })
      }
    };

    const mockFile = { basename: 'John Doe' } as any;
    
    const { vcards } = await vcard.toString([mockFile], mockApp as any);
    
    expect(vcards).toContain('RELATED;TYPE=friend:urn:uuid:456e8400-e29b-41d4-a716-446655440000');
    expect(vcards).toContain('RELATED;TYPE=spouse:name:Mary Doe');
  });

  it('should handle multiple RELATED fields of the same type', async () => {
    const vcfData = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
RELATED;TYPE=friend:Jane Smith
RELATED;TYPE=friend:Bob Johnson
END:VCARD`;

    const results: any[] = [];
    for await (const [slug, vCardObject] of vcard.parse(vcfData)) {
      if (slug) {
        results.push(vCardObject);
      }
    }

    expect(results).toHaveLength(1);
    const parsedVCard = results[0];
    
    // The parser should handle indexing for duplicate keys
    expect(parsedVCard['RELATED[friend]']).toBe('Jane Smith');
    expect(parsedVCard['RELATED[1:friend]']).toBe('Bob Johnson');
  });
});