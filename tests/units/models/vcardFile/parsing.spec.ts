import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCardParser } from '../../../../src/models/vcardFile/parsing';

describe('VCardParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parse', () => {
    it('should parse a single VCard', async () => {
      const vcardContent = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
N:Doe;John;;;
EMAIL:john@example.com
TEL:+1-555-123-4567
END:VCARD`;

      const results = [];
      for await (const [slug, record] of VCardParser.parse(vcardContent)) {
        results.push({ slug, record });
      }
      
      expect(results).toHaveLength(1);
      expect(results[0].record.UID).toBe('john-doe-123');
      expect(results[0].record.FN).toBe('John Doe');
      expect(results[0].record['N.FN']).toBe('Doe');
      expect(results[0].record['N.GN']).toBe('John');
      expect(results[0].record.EMAIL).toBe('john@example.com');
      expect(results[0].record.TEL).toBe('+1-555-123-4567');
    });

    it('should parse multiple VCards', async () => {
      const vcardContent = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
EMAIL:john@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:jane-doe-456
FN:Jane Doe
EMAIL:jane@example.com
END:VCARD`;

      const results = [];
      for await (const [slug, record] of VCardParser.parse(vcardContent)) {
        results.push({ slug, record });
      }
      
      expect(results).toHaveLength(2);
      expect(results[0].record.UID).toBe('john-doe-123');
      expect(results[1].record.UID).toBe('jane-doe-456');
    });

    it('should handle VCards with relationships', async () => {
      const vcardContent = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
RELATED;TYPE=spouse:urn:uuid:jane-doe-456
RELATED;TYPE=child:name:Tommy Doe
END:VCARD`;

      const results = [];
      for await (const [slug, record] of VCardParser.parse(vcardContent)) {
        results.push({ slug, record });
      }
      
      expect(results).toHaveLength(1);
      expect(results[0].record['RELATED[spouse]']).toBe('urn:uuid:jane-doe-456');
      expect(results[0].record['RELATED[child]']).toBe('name:Tommy Doe');
    });

    it('should handle empty or invalid VCard content', async () => {
      const results = [];
      for await (const [slug, record] of VCardParser.parse('')) {
        results.push({ slug, record });
      }
      
      expect(results).toEqual([]);
    });
  });

  describe('photoLineFromV3toV4', () => {
    it('should convert V3 photo lines to V4 format', () => {
      const v3Line = 'PHOTO;ENCODING=BASE64;JPEG:data';
      const result = VCardParser.photoLineFromV3toV4(v3Line);
      
      expect(result).toBe('data:image/jpeg;base64,data');
    });

    it('should handle various photo formats', () => {
      const testCases = [
        {
          input: 'PHOTO;ENCODING=BASE64;PNG:pngdata',
          expected: 'data:image/png;base64,pngdata'
        },
        {
          input: 'PHOTO;ENCODING=BASE64;GIF:gifdata', 
          expected: 'data:image/gif;base64,gifdata'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(VCardParser.photoLineFromV3toV4(input)).toBe(expected);
      });
    });
  });
});