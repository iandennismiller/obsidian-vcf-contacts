/**
 * Tests for TelephoneField
 */

import { describe, it, expect } from 'vitest';
import { TelephoneField } from '../../../../src/models/contactNote/entities/fields/TelephoneField';

describe('TelephoneField', () => {
  describe('Constructor', () => {
    it('should create with label and phone number', () => {
      const field = new TelephoneField('CELL', '555-123-4567');
      expect(field.getLabel()).toBe('CELL');
      expect(field.getValue()).toBe('555-123-4567');
    });
  });
  
  describe('fromFrontmatter()', () => {
    it('should create from frontmatter key and value', () => {
      const field = TelephoneField.fromFrontmatter('TEL.CELL', '555-123-4567');
      expect(field.getLabel()).toBe('CELL');
      expect(field.getValue()).toBe('555-123-4567');
    });
    
    it('should handle single-part key', () => {
      const field = TelephoneField.fromFrontmatter('TEL', '555-123-4567');
      expect(field.getLabel()).toBe('DEFAULT');
    });
    
    it('should handle nested keys', () => {
      const field = TelephoneField.fromFrontmatter('TEL.CELL.PRIMARY', '555-123-4567');
      expect(field.getLabel()).toBe('CELL.PRIMARY');
    });
  });
  
  describe('fromMarkdown()', () => {
    it('should parse from markdown format', () => {
      const field = TelephoneField.fromMarkdown('- Cell: 555-123-4567');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Cell');
      expect(field?.getValue()).toBe('555-123-4567');
    });
    
    it('should handle various label formats', () => {
      const field = TelephoneField.fromMarkdown('- Mobile Phone: (555) 123-4567');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Mobile Phone');
      expect(field?.getValue()).toBe('(555) 123-4567');
    });
    
    it('should handle international numbers', () => {
      const field = TelephoneField.fromMarkdown('- Work: +1-555-123-4567');
      expect(field).not.toBeNull();
      expect(field?.getValue()).toBe('+1-555-123-4567');
    });
    
    it('should return null for invalid format', () => {
      const field = TelephoneField.fromMarkdown('Invalid line');
      expect(field).toBeNull();
    });
    
    it('should return null for non-phone value', () => {
      const field = TelephoneField.fromMarkdown('- Email: test@example.com');
      expect(field).toBeNull();
    });
    
    it('should handle whitespace', () => {
      const field = TelephoneField.fromMarkdown('  -  Cell  :  555-123-4567  ');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Cell');
      expect(field?.getValue()).toBe('555-123-4567');
    });
  });
  
  describe('getType()', () => {
    it('should return TEL', () => {
      const field = new TelephoneField('CELL', '555-123-4567');
      expect(field.getType()).toBe('TEL');
    });
  });
  
  describe('validate()', () => {
    it('should validate correct phone number', () => {
      const field = new TelephoneField('CELL', '555-123-4567');
      const result = field.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate phone with parentheses', () => {
      const field = new TelephoneField('CELL', '(555) 123-4567');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate international phone', () => {
      const field = new TelephoneField('CELL', '+1-555-123-4567');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate phone with dots', () => {
      const field = new TelephoneField('CELL', '555.123.4567');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate phone with spaces', () => {
      const field = new TelephoneField('CELL', '555 123 4567');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should reject empty phone', () => {
      const field = new TelephoneField('CELL', '');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number cannot be empty');
    });
    
    it('should reject phone without digits', () => {
      const field = new TelephoneField('CELL', 'not-a-phone');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number must contain digits');
    });
    
    it('should reject phone with too few digits', () => {
      const field = new TelephoneField('CELL', '12');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number must have at least 3 digits');
    });
    
    it('should reject phone with invalid characters', () => {
      const field = new TelephoneField('CELL', '555-123-4567#ext');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number contains invalid characters');
    });
    
    it('should accept minimum viable phone', () => {
      const field = new TelephoneField('CELL', '123');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
  });
  
  describe('toFrontmatter()', () => {
    it('should convert to frontmatter format', () => {
      const field = new TelephoneField('CELL', '555-123-4567');
      const result = field.toFrontmatter();
      expect(result.key).toBe('TEL.CELL');
      expect(result.value).toBe('555-123-4567');
    });
    
    it('should handle various labels', () => {
      const field = new TelephoneField('WORK', '555-123-4567');
      const result = field.toFrontmatter();
      expect(result.key).toBe('TEL.WORK');
    });
  });
  
  describe('toMarkdown()', () => {
    it('should convert to markdown format', () => {
      const field = new TelephoneField('CELL', '555-123-4567');
      expect(field.toMarkdown()).toBe('- CELL: 555-123-4567');
    });
    
    it('should preserve label case', () => {
      const field = new TelephoneField('Mobile', '555-123-4567');
      expect(field.toMarkdown()).toBe('- Mobile: 555-123-4567');
    });
  });
  
  describe('getCleanedNumber()', () => {
    it('should remove all non-digit characters', () => {
      const field = new TelephoneField('CELL', '(555) 123-4567');
      expect(field.getCleanedNumber()).toBe('5551234567');
    });
    
    it('should handle international number', () => {
      const field = new TelephoneField('CELL', '+1-555-123-4567');
      expect(field.getCleanedNumber()).toBe('15551234567');
    });
    
    it('should handle phone with dots', () => {
      const field = new TelephoneField('CELL', '555.123.4567');
      expect(field.getCleanedNumber()).toBe('5551234567');
    });
  });
  
  describe('isMobile()', () => {
    it('should return true for MOBILE label', () => {
      const field = new TelephoneField('MOBILE', '555-123-4567');
      expect(field.isMobile()).toBe(true);
    });
    
    it('should return true for CELL label', () => {
      const field = new TelephoneField('CELL', '555-123-4567');
      expect(field.isMobile()).toBe(true);
    });
    
    it('should return true for CELLULAR label', () => {
      const field = new TelephoneField('CELLULAR', '555-123-4567');
      expect(field.isMobile()).toBe(true);
    });
    
    it('should be case-insensitive', () => {
      const field = new TelephoneField('cell', '555-123-4567');
      expect(field.isMobile()).toBe(true);
    });
    
    it('should return false for other labels', () => {
      const field = new TelephoneField('WORK', '555-123-4567');
      expect(field.isMobile()).toBe(false);
    });
  });
  
  describe('isInternational()', () => {
    it('should return true for number starting with +', () => {
      const field = new TelephoneField('CELL', '+1-555-123-4567');
      expect(field.isInternational()).toBe(true);
    });
    
    it('should return false for number without +', () => {
      const field = new TelephoneField('CELL', '555-123-4567');
      expect(field.isInternational()).toBe(false);
    });
    
    it('should handle whitespace before +', () => {
      const field = new TelephoneField('CELL', '  +1-555-123-4567');
      expect(field.isInternational()).toBe(true);
    });
  });
  
  describe('format()', () => {
    describe('US format', () => {
      it('should format 10-digit number', () => {
        const field = new TelephoneField('CELL', '5551234567');
        expect(field.format('us')).toBe('(555) 123-4567');
      });
      
      it('should format 11-digit number with country code', () => {
        const field = new TelephoneField('CELL', '15551234567');
        expect(field.format('us')).toBe('+1 (555) 123-4567');
      });
      
      it('should return original for non-standard length', () => {
        const field = new TelephoneField('CELL', '123');
        expect(field.format('us')).toBe('123');
      });
      
      it('should work with already formatted number', () => {
        const field = new TelephoneField('CELL', '(555) 123-4567');
        expect(field.format('us')).toBe('(555) 123-4567');
      });
    });
    
    describe('E.164 format', () => {
      it('should format to E.164', () => {
        const field = new TelephoneField('CELL', '555-123-4567');
        expect(field.format('e164')).toBe('+5551234567');
      });
      
      it('should handle already clean number', () => {
        const field = new TelephoneField('CELL', '15551234567');
        expect(field.format('e164')).toBe('+15551234567');
      });
    });
    
    describe('International format', () => {
      it('should format 10+ digit number internationally', () => {
        const field = new TelephoneField('CELL', '15551234567');
        expect(field.format('international')).toBe('+1 555 123 4567');
      });
      
      it('should return original for short number', () => {
        const field = new TelephoneField('CELL', '123');
        expect(field.format('international')).toBe('123');
      });
    });
    
    it('should default to US format', () => {
      const field = new TelephoneField('CELL', '5551234567');
      expect(field.format()).toBe('(555) 123-4567');
    });
  });
  
  describe('equals()', () => {
    it('should return true for same phone fields', () => {
      const field1 = new TelephoneField('CELL', '555-123-4567');
      const field2 = new TelephoneField('CELL', '555-123-4567');
      expect(field1.equals(field2)).toBe(true);
    });
    
    it('should return false for different numbers', () => {
      const field1 = new TelephoneField('CELL', '555-123-4567');
      const field2 = new TelephoneField('CELL', '555-123-9999');
      expect(field1.equals(field2)).toBe(false);
    });
  });
  
  describe('Round-trip Conversions', () => {
    it('should round-trip through frontmatter', () => {
      const original = new TelephoneField('CELL', '555-123-4567');
      const fm = original.toFrontmatter();
      const converted = TelephoneField.fromFrontmatter(fm.key, fm.value as string);
      expect(converted.equals(original)).toBe(true);
    });
    
    it('should round-trip through markdown', () => {
      const original = new TelephoneField('CELL', '555-123-4567');
      const md = original.toMarkdown();
      const converted = TelephoneField.fromMarkdown(md);
      expect(converted).not.toBeNull();
      expect(converted?.getValue()).toBe(original.getValue());
    });
  });
});
