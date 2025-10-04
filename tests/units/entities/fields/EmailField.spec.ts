/**
 * Tests for EmailField
 */

import { describe, it, expect } from 'vitest';
import { EmailField } from '../../../../src/models/contactNote/entities/fields/EmailField';

describe('EmailField', () => {
  describe('Constructor', () => {
    it('should create with label and email', () => {
      const field = new EmailField('WORK', 'test@example.com');
      expect(field.getLabel()).toBe('WORK');
      expect(field.getValue()).toBe('test@example.com');
    });
  });
  
  describe('fromFrontmatter()', () => {
    it('should create from frontmatter key and value', () => {
      const field = EmailField.fromFrontmatter('EMAIL.WORK', 'test@example.com');
      expect(field.getLabel()).toBe('WORK');
      expect(field.getValue()).toBe('test@example.com');
    });
    
    it('should handle single-part key', () => {
      const field = EmailField.fromFrontmatter('EMAIL', 'test@example.com');
      expect(field.getLabel()).toBe('DEFAULT');
    });
    
    it('should handle nested keys', () => {
      const field = EmailField.fromFrontmatter('EMAIL.WORK.PRIMARY', 'test@example.com');
      expect(field.getLabel()).toBe('WORK.PRIMARY');
    });
  });
  
  describe('fromMarkdown()', () => {
    it('should parse from markdown format', () => {
      const field = EmailField.fromMarkdown('- Work: test@example.com');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Work');
      expect(field?.getValue()).toBe('test@example.com');
    });
    
    it('should handle various label formats', () => {
      const field = EmailField.fromMarkdown('- Personal Email: user@domain.com');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Personal Email');
      expect(field?.getValue()).toBe('user@domain.com');
    });
    
    it('should return null for invalid format', () => {
      const field = EmailField.fromMarkdown('Invalid line');
      expect(field).toBeNull();
    });
    
    it('should return null for non-email value', () => {
      const field = EmailField.fromMarkdown('- Phone: 555-1234');
      expect(field).toBeNull();
    });
    
    it('should handle whitespace', () => {
      const field = EmailField.fromMarkdown('  -  Work  :  test@example.com  ');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Work');
      expect(field?.getValue()).toBe('test@example.com');
    });
  });
  
  describe('getType()', () => {
    it('should return EMAIL', () => {
      const field = new EmailField('WORK', 'test@example.com');
      expect(field.getType()).toBe('EMAIL');
    });
  });
  
  describe('validate()', () => {
    it('should validate correct email', () => {
      const field = new EmailField('WORK', 'test@example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate email with subdomains', () => {
      const field = new EmailField('WORK', 'user@mail.example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate email with special characters', () => {
      const field = new EmailField('WORK', 'user+tag@example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate email with dots', () => {
      const field = new EmailField('WORK', 'first.last@example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should reject empty email', () => {
      const field = new EmailField('WORK', '');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email address cannot be empty');
    });
    
    it('should reject email without @', () => {
      const field = new EmailField('WORK', 'notanemail.com');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });
    
    it('should reject email without domain', () => {
      const field = new EmailField('WORK', 'user@');
      const result = field.validate();
      expect(result.isValid).toBe(false);
    });
    
    it('should reject email with spaces', () => {
      const field = new EmailField('WORK', 'user @example.com');
      const result = field.validate();
      expect(result.isValid).toBe(false);
    });
    
    it('should reject email with invalid characters', () => {
      const field = new EmailField('WORK', 'user<>@example.com');
      const result = field.validate();
      expect(result.isValid).toBe(false);
    });
  });
  
  describe('toFrontmatter()', () => {
    it('should convert to frontmatter format', () => {
      const field = new EmailField('WORK', 'test@example.com');
      const result = field.toFrontmatter();
      expect(result.key).toBe('EMAIL.WORK');
      expect(result.value).toBe('test@example.com');
    });
    
    it('should handle various labels', () => {
      const field = new EmailField('HOME', 'personal@example.com');
      const result = field.toFrontmatter();
      expect(result.key).toBe('EMAIL.HOME');
    });
  });
  
  describe('toMarkdown()', () => {
    it('should convert to markdown format', () => {
      const field = new EmailField('WORK', 'test@example.com');
      expect(field.toMarkdown()).toBe('- WORK: test@example.com');
    });
    
    it('should preserve label case', () => {
      const field = new EmailField('Personal', 'user@example.com');
      expect(field.toMarkdown()).toBe('- Personal: user@example.com');
    });
  });
  
  describe('getDomain()', () => {
    it('should extract domain', () => {
      const field = new EmailField('WORK', 'test@example.com');
      expect(field.getDomain()).toBe('example.com');
    });
    
    it('should handle subdomain', () => {
      const field = new EmailField('WORK', 'user@mail.example.com');
      expect(field.getDomain()).toBe('mail.example.com');
    });
    
    it('should return empty for invalid email', () => {
      const field = new EmailField('WORK', 'notanemail');
      expect(field.getDomain()).toBe('');
    });
    
    it('should handle multiple @ signs (use last one)', () => {
      const field = new EmailField('WORK', 'user@host@example.com');
      expect(field.getDomain()).toBe('example.com');
    });
  });
  
  describe('getLocalPart()', () => {
    it('should extract local part', () => {
      const field = new EmailField('WORK', 'test@example.com');
      expect(field.getLocalPart()).toBe('test');
    });
    
    it('should handle complex local part', () => {
      const field = new EmailField('WORK', 'first.last+tag@example.com');
      expect(field.getLocalPart()).toBe('first.last+tag');
    });
    
    it('should return full value if no @ sign', () => {
      const field = new EmailField('WORK', 'notanemail');
      expect(field.getLocalPart()).toBe('notanemail');
    });
  });
  
  describe('isWorkEmail()', () => {
    it('should return true for WORK label', () => {
      const field = new EmailField('WORK', 'test@example.com');
      expect(field.isWorkEmail()).toBe(true);
    });
    
    it('should be case-insensitive', () => {
      const field = new EmailField('work', 'test@example.com');
      expect(field.isWorkEmail()).toBe(true);
    });
    
    it('should return false for other labels', () => {
      const field = new EmailField('HOME', 'test@example.com');
      expect(field.isWorkEmail()).toBe(false);
    });
  });
  
  describe('equals()', () => {
    it('should return true for same email fields', () => {
      const field1 = new EmailField('WORK', 'test@example.com');
      const field2 = new EmailField('WORK', 'test@example.com');
      expect(field1.equals(field2)).toBe(true);
    });
    
    it('should return false for different emails', () => {
      const field1 = new EmailField('WORK', 'test1@example.com');
      const field2 = new EmailField('WORK', 'test2@example.com');
      expect(field1.equals(field2)).toBe(false);
    });
  });
  
  describe('Round-trip Conversions', () => {
    it('should round-trip through frontmatter', () => {
      const original = new EmailField('WORK', 'test@example.com');
      const fm = original.toFrontmatter();
      const converted = EmailField.fromFrontmatter(fm.key, fm.value as string);
      expect(converted.equals(original)).toBe(true);
    });
    
    it('should round-trip through markdown', () => {
      const original = new EmailField('WORK', 'test@example.com');
      const md = original.toMarkdown();
      const converted = EmailField.fromMarkdown(md);
      expect(converted).not.toBeNull();
      expect(converted?.getValue()).toBe(original.getValue());
    });
  });
});
