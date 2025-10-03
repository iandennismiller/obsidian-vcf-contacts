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
  normalizeFieldValue
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
});
