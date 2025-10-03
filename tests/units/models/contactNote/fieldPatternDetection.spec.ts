import { describe, it, expect } from 'vitest';
import {
  isEmail,
  isPhoneNumber,
  isPostalCode,
  isUrl,
  identifyFieldType,
  normalizePhoneNumber,
  normalizePostalCode,
  normalizeUrl,
  normalizeFieldValue,
  parseContactListItem,
  parseEmailLine,
  parsePhoneLine,
  parseUrlLine,
  parseAddressLine
} from '../../../../src/models/contactNote/fieldPatternDetection';

describe('Field Pattern Detection', () => {
  describe('isEmail', () => {
    it('should detect valid email addresses', () => {
      expect(isEmail('user@example.com')).toBe(true);
      expect(isEmail('john.doe@company.co.uk')).toBe(true);
      expect(isEmail('test+tag@domain.com')).toBe(true);
      expect(isEmail('user_name@sub.domain.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isEmail('not-an-email')).toBe(false);
      expect(isEmail('@example.com')).toBe(false);
      expect(isEmail('user@')).toBe(false);
      expect(isEmail('user @example.com')).toBe(false);
    });
  });

  describe('isPhoneNumber', () => {
    it('should detect US phone numbers in various formats', () => {
      expect(isPhoneNumber('+1-555-123-4567')).toBe(true);
      expect(isPhoneNumber('(555) 123-4567')).toBe(true);
      expect(isPhoneNumber('555-123-4567')).toBe(true);
      expect(isPhoneNumber('555 123 4567')).toBe(true);
      expect(isPhoneNumber('555.123.4567')).toBe(true);
      expect(isPhoneNumber('5551234567')).toBe(true);
    });

    it('should detect international phone numbers', () => {
      expect(isPhoneNumber('+86-10-1234-5678')).toBe(true);
      expect(isPhoneNumber('+44 20 7123 4567')).toBe(true);
      expect(isPhoneNumber('+33 1 23 45 67 89')).toBe(true);
      expect(isPhoneNumber('+971-4-123-4567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isPhoneNumber('123')).toBe(false); // Too short
      expect(isPhoneNumber('not-a-phone')).toBe(false);
      expect(isPhoneNumber('123-abc-4567')).toBe(false);
    });
  });

  describe('isPostalCode', () => {
    it('should detect US ZIP codes', () => {
      expect(isPostalCode('12345')).toBe(true);
      expect(isPostalCode('12345-6789')).toBe(true);
    });

    it('should detect Canadian postal codes', () => {
      expect(isPostalCode('K1A 0B1')).toBe(true);
      expect(isPostalCode('K1A0B1')).toBe(true);
    });

    it('should detect UK postcodes', () => {
      expect(isPostalCode('SW1A 1AA')).toBe(true);
      expect(isPostalCode('M1 1AE')).toBe(true);
      expect(isPostalCode('B33 8TH')).toBe(true);
    });

    it('should detect generic postal codes', () => {
      expect(isPostalCode('75001')).toBe(true); // France
      expect(isPostalCode('10115')).toBe(true); // Germany
    });

    it('should reject invalid postal codes', () => {
      expect(isPostalCode('1')).toBe(false); // Too short
      expect(isPostalCode('TOOLONGPOSTALCODE')).toBe(false); // Too long
    });
  });

  describe('isUrl', () => {
    it('should detect valid URLs', () => {
      expect(isUrl('https://example.com')).toBe(true);
      expect(isUrl('http://www.example.com')).toBe(true);
      expect(isUrl('www.example.com')).toBe(true);
      expect(isUrl('example.com')).toBe(true);
      expect(isUrl('subdomain.example.com')).toBe(true);
      expect(isUrl('https://example.com/path/to/page')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isUrl('not a url')).toBe(false);
      expect(isUrl('just-text')).toBe(false);
      expect(isUrl('http://')).toBe(false);
    });
  });

  describe('identifyFieldType', () => {
    it('should identify email addresses', () => {
      expect(identifyFieldType('john@example.com')).toBe('EMAIL');
      expect(identifyFieldType('user.name@company.co.uk')).toBe('EMAIL');
    });

    it('should identify phone numbers', () => {
      expect(identifyFieldType('+1-555-123-4567')).toBe('TEL');
      expect(identifyFieldType('(555) 123-4567')).toBe('TEL');
    });

    it('should identify URLs', () => {
      expect(identifyFieldType('https://example.com')).toBe('URL');
      expect(identifyFieldType('www.example.com')).toBe('URL');
      expect(identifyFieldType('example.com')).toBe('URL');
    });

    it('should return null for unidentifiable values', () => {
      expect(identifyFieldType('random text')).toBe(null);
      expect(identifyFieldType('')).toBe(null);
      expect(identifyFieldType('   ')).toBe(null);
    });

    it('should prioritize email over URL when both could match', () => {
      // Some patterns could match both - email should win
      expect(identifyFieldType('user@domain.com')).toBe('EMAIL');
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize US phone numbers', () => {
      expect(normalizePhoneNumber('(555) 123-4567')).toBe('+1-555-123-4567');
      expect(normalizePhoneNumber('555-123-4567')).toBe('+1-555-123-4567');
      expect(normalizePhoneNumber('555.123.4567')).toBe('+1-555-123-4567');
      expect(normalizePhoneNumber('5551234567')).toBe('+1-555-123-4567');
      expect(normalizePhoneNumber('15551234567')).toBe('+1-555-123-4567');
    });

    it('should preserve international format', () => {
      expect(normalizePhoneNumber('+86-10-1234-5678')).toBe('+861012345678');
      expect(normalizePhoneNumber('+44 20 7123 4567')).toBe('+442071234567');
    });

    it('should handle short numbers', () => {
      expect(normalizePhoneNumber('1234567')).toBe('1234567'); // Too short for formatting
    });
  });

  describe('normalizePostalCode', () => {
    it('should normalize US ZIP codes', () => {
      expect(normalizePostalCode('123456789')).toBe('12345-6789');
      expect(normalizePostalCode('12345-6789')).toBe('12345-6789');
      expect(normalizePostalCode('12345')).toBe('12345');
    });

    it('should normalize Canadian postal codes', () => {
      expect(normalizePostalCode('K1A0B1')).toBe('K1A 0B1');
      expect(normalizePostalCode('k1a0b1')).toBe('K1A 0B1');
    });

    it('should normalize UK postcodes', () => {
      expect(normalizePostalCode('SW1A1AA')).toBe('SW1A 1AA');
      expect(normalizePostalCode('M11AE')).toBe('M1 1AE');
    });
  });

  describe('normalizeUrl', () => {
    it('should add https:// to URLs without protocol', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
      expect(normalizeUrl('subdomain.example.com')).toBe('https://subdomain.example.com');
    });

    it('should add https:// to www URLs', () => {
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
    });

    it('should preserve existing protocol', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    });
  });

  describe('normalizeFieldValue', () => {
    it('should normalize phone numbers', () => {
      expect(normalizeFieldValue('555-123-4567', 'TEL')).toBe('+1-555-123-4567');
    });

    it('should normalize URLs', () => {
      expect(normalizeFieldValue('example.com', 'URL')).toBe('https://example.com');
    });

    it('should normalize email addresses', () => {
      expect(normalizeFieldValue('User@Example.COM', 'EMAIL')).toBe('user@example.com');
    });

    it('should trim unknown field types', () => {
      expect(normalizeFieldValue('  some text  ', 'OTHER')).toBe('some text');
    });
  });

  describe('parseContactListItem', () => {
    describe('email detection', () => {
      it('should parse email without kind', () => {
        const result = parseContactListItem('contact@example.com');
        expect(result.fieldType).toBe('EMAIL');
        expect(result.kind).toBeNull();
        expect(result.value).toBe('contact@example.com');
      });

      it('should parse email with kind prefix', () => {
        const result = parseContactListItem('work contact@example.com');
        expect(result.fieldType).toBe('EMAIL');
        expect(result.kind).toBe('work');
        expect(result.value).toBe('contact@example.com');
      });

      it('should parse email with colon-separated kind', () => {
        const result = parseContactListItem('HOME: test@example.com');
        expect(result.fieldType).toBe('EMAIL');
        expect(result.kind).toBe('HOME');
        expect(result.value).toBe('test@example.com');
      });

      it('should parse email with different kind prefixes', () => {
        const result1 = parseContactListItem('home user@example.com');
        expect(result1.kind).toBe('home');
        expect(result1.value).toBe('user@example.com');

        const result2 = parseContactListItem('personal jane@domain.com');
        expect(result2.kind).toBe('personal');
        expect(result2.value).toBe('jane@domain.com');
      });

      it('should handle email with list marker and colon', () => {
        const result = parseContactListItem('- HOME: contact@example.com');
        expect(result.fieldType).toBe('EMAIL');
        expect(result.kind).toBe('HOME');
        expect(result.value).toBe('contact@example.com');
      });

      it('should handle email with list marker', () => {
        const result = parseContactListItem('- work contact@example.com');
        expect(result.fieldType).toBe('EMAIL');
        expect(result.kind).toBe('work');
        expect(result.value).toBe('contact@example.com');
      });
    });

    describe('phone detection', () => {
      it('should parse phone without kind', () => {
        const result = parseContactListItem('555-555-5555');
        expect(result.fieldType).toBe('TEL');
        expect(result.kind).toBeNull();
        expect(result.value).toBe('555-555-5555');
      });

      it('should parse phone with kind prefix', () => {
        const result = parseContactListItem('home 555-555-5555');
        expect(result.fieldType).toBe('TEL');
        expect(result.kind).toBe('home');
        expect(result.value).toBe('555-555-5555');
      });

      it('should parse phone with colon-separated kind', () => {
        const result = parseContactListItem('CELL: 555-555-5555');
        expect(result.fieldType).toBe('TEL');
        expect(result.kind).toBe('CELL');
        expect(result.value).toBe('555-555-5555');
      });

      it('should parse different phone formats with kind', () => {
        const result1 = parseContactListItem('cell (555) 123-4567');
        expect(result1.fieldType).toBe('TEL');
        expect(result1.kind).toBe('cell');
        expect(result1.value).toBe('(555) 123-4567');

        const result2 = parseContactListItem('work +1-555-987-6543');
        expect(result2.fieldType).toBe('TEL');
        expect(result2.kind).toBe('work');
        expect(result2.value).toBe('+1-555-987-6543');
      });
    });

    describe('URL detection', () => {
      it('should parse URL without kind', () => {
        const result = parseContactListItem('http://example.com');
        expect(result.fieldType).toBe('URL');
        expect(result.kind).toBeNull();
        expect(result.value).toBe('http://example.com');
      });

      it('should parse URL with kind prefix', () => {
        const result = parseContactListItem('personal http://example.com');
        expect(result.fieldType).toBe('URL');
        expect(result.kind).toBe('personal');
        expect(result.value).toBe('http://example.com');
      });

      it('should parse URL with colon-separated kind', () => {
        const result = parseContactListItem('WORK: https://company.com');
        expect(result.fieldType).toBe('URL');
        expect(result.kind).toBe('WORK');
        expect(result.value).toBe('https://company.com');
      });

      it('should parse domain without protocol', () => {
        const result1 = parseContactListItem('example.com');
        expect(result1.fieldType).toBe('URL');
        expect(result1.kind).toBeNull();
        expect(result1.value).toBe('example.com');

        const result2 = parseContactListItem('work www.company.com');
        expect(result2.fieldType).toBe('URL');
        expect(result2.kind).toBe('work');
        expect(result2.value).toBe('www.company.com');
      });
    });

    describe('address detection', () => {
      it('should parse address without kind', () => {
        const result = parseContactListItem('123 Some street');
        expect(result.fieldType).toBe('ADR');
        expect(result.kind).toBeNull();
        expect(result.value).toBe('123 Some street');
      });

      it('should parse address with city', () => {
        const result = parseContactListItem('123 Some street, Town');
        expect(result.fieldType).toBe('ADR');
        expect(result.kind).toBeNull();
        expect(result.value).toBe('123 Some street, Town');
      });

      it('should parse address with kind prefix', () => {
        const result = parseContactListItem('home 123 Main St');
        expect(result.fieldType).toBe('ADR');
        expect(result.kind).toBe('home');
        expect(result.value).toBe('123 Main St');
      });

      it('should treat unidentifiable text as address', () => {
        const result = parseContactListItem('some random text');
        expect(result.fieldType).toBe('ADR');
        expect(result.kind).toBeNull();
        expect(result.value).toBe('some random text');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const result = parseContactListItem('');
        expect(result.fieldType).toBeNull();
        expect(result.kind).toBeNull();
        expect(result.value).toBe('');
      });

      it('should handle whitespace only', () => {
        const result = parseContactListItem('   ');
        expect(result.fieldType).toBeNull();
        expect(result.kind).toBeNull();
        expect(result.value).toBe('');
      });

      it('should strip list markers', () => {
        const result = parseContactListItem('- contact@example.com');
        expect(result.fieldType).toBe('EMAIL');
        expect(result.value).toBe('contact@example.com');
      });

      it('should handle single word as address', () => {
        const result = parseContactListItem('SingleWord');
        expect(result.fieldType).toBe('ADR');
        expect(result.value).toBe('SingleWord');
      });
    });
  });

  describe('parseEmailLine', () => {
    it('should parse email without kind', () => {
      const result = parseEmailLine('contact@example.com');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('contact@example.com');
    });

    it('should parse email with kind', () => {
      const result = parseEmailLine('work contact@example.com');
      expect(result.kind).toBe('work');
      expect(result.value).toBe('contact@example.com');
    });

    it('should return empty for non-email lines', () => {
      const result = parseEmailLine('555-555-5555');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('');
    });
  });

  describe('parsePhoneLine', () => {
    it('should parse phone without kind and normalize', () => {
      const result = parsePhoneLine('555-123-4567');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('+1-555-123-4567');
    });

    it('should parse phone with kind and normalize', () => {
      const result = parsePhoneLine('home 555-555-5555');
      expect(result.kind).toBe('home');
      expect(result.value).toBe('+1-555-555-5555');
    });

    it('should return empty for non-phone lines', () => {
      const result = parsePhoneLine('contact@example.com');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('');
    });
  });

  describe('parseUrlLine', () => {
    it('should parse URL without kind and normalize', () => {
      const result = parseUrlLine('example.com');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('https://example.com');
    });

    it('should parse URL with kind and normalize', () => {
      const result = parseUrlLine('personal http://example.com');
      expect(result.kind).toBe('personal');
      expect(result.value).toBe('http://example.com');
    });

    it('should preserve protocol when present', () => {
      const result = parseUrlLine('work https://company.com');
      expect(result.kind).toBe('work');
      expect(result.value).toBe('https://company.com');
    });

    it('should return empty for non-URL lines', () => {
      const result = parseUrlLine('contact@example.com');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('');
    });
  });

  describe('parseAddressLine', () => {
    it('should parse address without kind', () => {
      const result = parseAddressLine('123 Some street');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('123 Some street');
    });

    it('should parse address with kind', () => {
      const result = parseAddressLine('home 123 Main St');
      expect(result.kind).toBe('home');
      expect(result.value).toBe('123 Main St');
    });

    it('should parse full address', () => {
      const result = parseAddressLine('123 Some street, Town');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('123 Some street, Town');
    });

    it('should return empty for non-address lines', () => {
      const result = parseAddressLine('contact@example.com');
      expect(result.kind).toBeNull();
      expect(result.value).toBe('');
    });
  });
});
