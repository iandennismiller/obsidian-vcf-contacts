/**
 * Tests for UrlField
 */

import { describe, it, expect } from 'vitest';
import { UrlField } from '../../../../src/models/contactNote/entities/fields/UrlField';

describe('UrlField', () => {
  describe('Constructor', () => {
    it('should create with label and URL', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.getLabel()).toBe('WEBSITE');
      expect(field.getValue()).toBe('https://example.com');
    });
  });
  
  describe('fromFrontmatter()', () => {
    it('should create from frontmatter key and value', () => {
      const field = UrlField.fromFrontmatter('URL.WEBSITE', 'https://example.com');
      expect(field.getLabel()).toBe('WEBSITE');
      expect(field.getValue()).toBe('https://example.com');
    });
    
    it('should handle single-part key', () => {
      const field = UrlField.fromFrontmatter('URL', 'https://example.com');
      expect(field.getLabel()).toBe('DEFAULT');
    });
    
    it('should handle nested keys', () => {
      const field = UrlField.fromFrontmatter('URL.BLOG.PRIMARY', 'https://blog.example.com');
      expect(field.getLabel()).toBe('BLOG.PRIMARY');
    });
  });
  
  describe('fromMarkdown()', () => {
    it('should parse from markdown format', () => {
      const field = UrlField.fromMarkdown('- Website: https://example.com');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Website');
      expect(field?.getValue()).toBe('https://example.com');
    });
    
    it('should parse URL without protocol', () => {
      const field = UrlField.fromMarkdown('- Website: www.example.com');
      expect(field).not.toBeNull();
      expect(field?.getValue()).toBe('www.example.com');
    });
    
    it('should parse domain-only URL', () => {
      const field = UrlField.fromMarkdown('- Website: example.com');
      expect(field).not.toBeNull();
      expect(field?.getValue()).toBe('example.com');
    });
    
    it('should return null for invalid format', () => {
      const field = UrlField.fromMarkdown('Invalid line');
      expect(field).toBeNull();
    });
    
    it('should return null for non-URL value', () => {
      const field = UrlField.fromMarkdown('- Email: test@example.com');
      expect(field).toBeNull();
    });
    
    it('should handle whitespace', () => {
      const field = UrlField.fromMarkdown('  -  Website  :  https://example.com  ');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Website');
      expect(field?.getValue()).toBe('https://example.com');
    });
  });
  
  describe('getType()', () => {
    it('should return URL', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.getType()).toBe('URL');
    });
  });
  
  describe('validate()', () => {
    it('should validate correct URL with https', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate correct URL with http', () => {
      const field = new UrlField('WEBSITE', 'http://example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate URL with path', () => {
      const field = new UrlField('WEBSITE', 'https://example.com/path/to/page');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate URL without protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should validate www URL', () => {
      const field = new UrlField('WEBSITE', 'www.example.com');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should reject empty URL', () => {
      const field = new UrlField('WEBSITE', '');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL cannot be empty');
    });
    
    it('should reject invalid URL', () => {
      const field = new UrlField('WEBSITE', 'not a url');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
    });
  });
  
  describe('toFrontmatter()', () => {
    it('should convert to frontmatter format', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      const result = field.toFrontmatter();
      expect(result.key).toBe('URL.WEBSITE');
      expect(result.value).toBe('https://example.com');
    });
  });
  
  describe('toMarkdown()', () => {
    it('should convert to markdown format', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.toMarkdown()).toBe('- WEBSITE: https://example.com');
    });
  });
  
  describe('hasProtocol()', () => {
    it('should return true for URL with https', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.hasProtocol()).toBe(true);
    });
    
    it('should return true for URL with http', () => {
      const field = new UrlField('WEBSITE', 'http://example.com');
      expect(field.hasProtocol()).toBe(true);
    });
    
    it('should return false for URL without protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      expect(field.hasProtocol()).toBe(false);
    });
    
    it('should return false for www URL', () => {
      const field = new UrlField('WEBSITE', 'www.example.com');
      expect(field.hasProtocol()).toBe(false);
    });
  });
  
  describe('getProtocol()', () => {
    it('should return https', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.getProtocol()).toBe('https');
    });
    
    it('should return http', () => {
      const field = new UrlField('WEBSITE', 'http://example.com');
      expect(field.getProtocol()).toBe('http');
    });
    
    it('should return undefined for URL without protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      expect(field.getProtocol()).toBeUndefined();
    });
  });
  
  describe('getHostname()', () => {
    it('should get hostname from URL with protocol', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.getHostname()).toBe('example.com');
    });
    
    it('should get hostname from URL without protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      expect(field.getHostname()).toBe('example.com');
    });
    
    it('should get hostname from www URL', () => {
      const field = new UrlField('WEBSITE', 'www.example.com');
      expect(field.getHostname()).toBe('www.example.com');
    });
    
    it('should get hostname from subdomain URL', () => {
      const field = new UrlField('WEBSITE', 'https://blog.example.com');
      expect(field.getHostname()).toBe('blog.example.com');
    });
  });
  
  describe('getPath()', () => {
    it('should return undefined for URL without path', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.getPath()).toBeUndefined();
    });
    
    it('should get path from URL', () => {
      const field = new UrlField('WEBSITE', 'https://example.com/path/to/page');
      expect(field.getPath()).toBe('/path/to/page');
    });
    
    it('should get path from URL without protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com/about');
      expect(field.getPath()).toBe('/about');
    });
  });
  
  describe('isSecure()', () => {
    it('should return true for https URL', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.isSecure()).toBe(true);
    });
    
    it('should return false for http URL', () => {
      const field = new UrlField('WEBSITE', 'http://example.com');
      expect(field.isSecure()).toBe(false);
    });
    
    it('should return false for URL without protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      expect(field.isSecure()).toBe(false);
    });
  });
  
  describe('getFullUrl()', () => {
    it('should return URL with protocol unchanged', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.getFullUrl()).toBe('https://example.com');
    });
    
    it('should add https to URL without protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      expect(field.getFullUrl()).toBe('https://example.com');
    });
    
    it('should add custom protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      expect(field.getFullUrl('http')).toBe('http://example.com');
    });
  });
  
  describe('getWithoutProtocol()', () => {
    it('should remove https protocol', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.getWithoutProtocol()).toBe('example.com');
    });
    
    it('should remove http protocol', () => {
      const field = new UrlField('WEBSITE', 'http://example.com');
      expect(field.getWithoutProtocol()).toBe('example.com');
    });
    
    it('should return URL unchanged if no protocol', () => {
      const field = new UrlField('WEBSITE', 'example.com');
      expect(field.getWithoutProtocol()).toBe('example.com');
    });
  });
  
  describe('isSocialMedia()', () => {
    it('should detect Facebook', () => {
      const field = new UrlField('SOCIAL', 'https://facebook.com/profile');
      expect(field.isSocialMedia()).toBe(true);
    });
    
    it('should detect Twitter', () => {
      const field = new UrlField('SOCIAL', 'https://twitter.com/username');
      expect(field.isSocialMedia()).toBe(true);
    });
    
    it('should detect X (formerly Twitter)', () => {
      const field = new UrlField('SOCIAL', 'https://x.com/username');
      expect(field.isSocialMedia()).toBe(true);
    });
    
    it('should detect LinkedIn', () => {
      const field = new UrlField('SOCIAL', 'https://linkedin.com/in/username');
      expect(field.isSocialMedia()).toBe(true);
    });
    
    it('should detect GitHub', () => {
      const field = new UrlField('SOCIAL', 'https://github.com/username');
      expect(field.isSocialMedia()).toBe(true);
    });
    
    it('should detect Instagram', () => {
      const field = new UrlField('SOCIAL', 'https://instagram.com/username');
      expect(field.isSocialMedia()).toBe(true);
    });
    
    it('should return false for non-social media', () => {
      const field = new UrlField('WEBSITE', 'https://example.com');
      expect(field.isSocialMedia()).toBe(false);
    });
  });
  
  describe('equals()', () => {
    it('should return true for same URLs', () => {
      const field1 = new UrlField('WEBSITE', 'https://example.com');
      const field2 = new UrlField('WEBSITE', 'https://example.com');
      expect(field1.equals(field2)).toBe(true);
    });
    
    it('should return false for different URLs', () => {
      const field1 = new UrlField('WEBSITE', 'https://example.com');
      const field2 = new UrlField('WEBSITE', 'https://other.com');
      expect(field1.equals(field2)).toBe(false);
    });
  });
  
  describe('Round-trip Conversions', () => {
    it('should round-trip through frontmatter', () => {
      const original = new UrlField('WEBSITE', 'https://example.com');
      const fm = original.toFrontmatter();
      const converted = UrlField.fromFrontmatter(fm.key, fm.value as string);
      expect(converted.equals(original)).toBe(true);
    });
    
    it('should round-trip through markdown', () => {
      const original = new UrlField('WEBSITE', 'https://example.com');
      const md = original.toMarkdown();
      const converted = UrlField.fromMarkdown(md);
      expect(converted).not.toBeNull();
      expect(converted?.getValue()).toBe(original.getValue());
    });
  });
});
