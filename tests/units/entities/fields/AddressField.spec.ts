/**
 * Tests for AddressField
 */

import { describe, it, expect } from 'vitest';
import { AddressField, AddressComponents } from '../../../../src/models/contactNote/entities/fields/AddressField';

describe('AddressField', () => {
  describe('Constructor', () => {
    it('should create with label and address string', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.getLabel()).toBe('HOME');
      expect(field.getValue()).toBe('123 Main St, Springfield, IL 62701');
    });
    
    it('should create with components', () => {
      const components: AddressComponents = {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postal: '62701'
      };
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701', components);
      expect(field.getComponents()).toEqual(components);
    });
  });
  
  describe('fromFrontmatter()', () => {
    it('should create from frontmatter with string value', () => {
      const field = AddressField.fromFrontmatter('ADR.HOME', '123 Main St, Springfield, IL 62701');
      expect(field.getLabel()).toBe('HOME');
      expect(field.getValue()).toBe('123 Main St, Springfield, IL 62701');
    });
    
    it('should create from frontmatter with structured object', () => {
      const components: AddressComponents = {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postal: '62701'
      };
      const field = AddressField.fromFrontmatter('ADR.HOME', components);
      expect(field.getLabel()).toBe('HOME');
      expect(field.getValue()).toBe('123 Main St, Springfield, IL, 62701');
      expect(field.getComponents()).toEqual(components);
    });
    
    it('should handle single-part key', () => {
      const field = AddressField.fromFrontmatter('ADR', '123 Main St');
      expect(field.getLabel()).toBe('DEFAULT');
    });
    
    it('should handle nested keys', () => {
      const field = AddressField.fromFrontmatter('ADR.WORK.PRIMARY', '123 Main St');
      expect(field.getLabel()).toBe('WORK.PRIMARY');
    });
  });
  
  describe('fromMarkdown()', () => {
    it('should parse from markdown format', () => {
      const field = AddressField.fromMarkdown('- Home: 123 Main St, Springfield, IL 62701');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Home');
      expect(field?.getValue()).toBe('123 Main St, Springfield, IL 62701');
    });
    
    it('should handle various label formats', () => {
      const field = AddressField.fromMarkdown('- Work Office: 456 Business Rd');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Work Office');
      expect(field?.getValue()).toBe('456 Business Rd');
    });
    
    it('should return null for invalid format', () => {
      const field = AddressField.fromMarkdown('Invalid line');
      expect(field).toBeNull();
    });
    
    it('should handle whitespace', () => {
      const field = AddressField.fromMarkdown('  -  Home  :  123 Main St  ');
      expect(field).not.toBeNull();
      expect(field?.getLabel()).toBe('Home');
      expect(field?.getValue()).toBe('123 Main St');
    });
  });
  
  describe('Component parsing', () => {
    it('should parse street only', () => {
      const field = new AddressField('HOME', '123 Main St');
      const components = field.getComponents();
      expect(components.street).toBe('123 Main St');
      expect(components.city).toBeUndefined();
    });
    
    it('should parse street and city', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield');
      const components = field.getComponents();
      expect(components.street).toBe('123 Main St');
      expect(components.city).toBe('Springfield');
    });
    
    it('should parse street, city, and state with postal', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const components = field.getComponents();
      expect(components.street).toBe('123 Main St');
      expect(components.city).toBe('Springfield');
      expect(components.state).toBe('IL');
      expect(components.postal).toBe('62701');
    });
    
    it('should parse with ZIP+4 format', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701-1234');
      const components = field.getComponents();
      expect(components.postal).toBe('62701-1234');
    });
    
    it('should parse full address with country', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL, 62701, USA');
      const components = field.getComponents();
      expect(components.street).toBe('123 Main St');
      expect(components.city).toBe('Springfield');
      expect(components.state).toBe('IL');
      expect(components.postal).toBe('62701');
      expect(components.country).toBe('USA');
    });
  });
  
  describe('getType()', () => {
    it('should return ADR', () => {
      const field = new AddressField('HOME', '123 Main St');
      expect(field.getType()).toBe('ADR');
    });
  });
  
  describe('validate()', () => {
    it('should validate correct address', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const result = field.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate simple address', () => {
      const field = new AddressField('HOME', '123 Main St');
      const result = field.validate();
      expect(result.isValid).toBe(true);
    });
    
    it('should reject empty address', () => {
      const field = new AddressField('HOME', '');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address cannot be empty');
    });
    
    it('should reject too short address', () => {
      const field = new AddressField('HOME', 'AB');
      const result = field.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address is too short');
    });
  });
  
  describe('toFrontmatter()', () => {
    it('should convert to frontmatter format', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const result = field.toFrontmatter();
      expect(result.key).toBe('ADR.HOME');
      expect(result.value).toBe('123 Main St, Springfield, IL 62701');
    });
  });
  
  describe('toStructuredFrontmatter()', () => {
    it('should convert to structured frontmatter', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const result = field.toStructuredFrontmatter();
      expect(result.key).toBe('ADR.HOME');
      expect(result.value).toHaveProperty('street');
      expect(result.value).toHaveProperty('city');
    });
  });
  
  describe('toMarkdown()', () => {
    it('should convert to markdown format', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.toMarkdown()).toBe('- HOME: 123 Main St, Springfield, IL 62701');
    });
  });
  
  describe('Component getters', () => {
    it('should get street', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.getStreet()).toBe('123 Main St');
    });
    
    it('should get city', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.getCity()).toBe('Springfield');
    });
    
    it('should get state', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.getState()).toBe('IL');
    });
    
    it('should get postal', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.getPostal()).toBe('62701');
    });
    
    it('should get country', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL, 62701, USA');
      expect(field.getCountry()).toBe('USA');
    });
    
    it('should return undefined for missing components', () => {
      const field = new AddressField('HOME', '123 Main St');
      expect(field.getCity()).toBeUndefined();
      expect(field.getState()).toBeUndefined();
      expect(field.getPostal()).toBeUndefined();
      expect(field.getCountry()).toBeUndefined();
    });
  });
  
  describe('isUSAddress()', () => {
    it('should detect US address by postal code', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.isUSAddress()).toBe(true);
    });
    
    it('should detect US address with ZIP+4', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701-1234');
      expect(field.isUSAddress()).toBe(true);
    });
    
    it('should detect US address by country', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL, 62701, USA');
      expect(field.isUSAddress()).toBe(true);
    });
    
    it('should detect variations of US country name', () => {
      const field1 = new AddressField('HOME', '123 Main St, , , , US');
      expect(field1.isUSAddress()).toBe(true);
      
      const field2 = new AddressField('HOME', '123 Main St, , , , United States');
      expect(field2.isUSAddress()).toBe(true);
      
      const field3 = new AddressField('HOME', '123 Main St, , , , United States of America');
      expect(field3.isUSAddress()).toBe(true);
    });
    
    it('should return false for non-US address', () => {
      const field = new AddressField('HOME', '123 Main St, London, UK');
      expect(field.isUSAddress()).toBe(false);
    });
  });
  
  describe('formatSingleLine()', () => {
    it('should format as single line', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field.formatSingleLine()).toBe('123 Main St, Springfield, IL 62701');
    });
  });
  
  describe('formatMultiLine()', () => {
    it('should format as multi-line', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const formatted = field.formatMultiLine();
      expect(formatted).toContain('123 Main St');
      expect(formatted).toContain('Springfield, IL 62701');
    });
    
    it('should format with country', () => {
      const field = new AddressField('HOME', '123 Main St, Springfield, IL, 62701, USA');
      const formatted = field.formatMultiLine();
      const lines = formatted.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('123 Main St');
      expect(lines[1]).toContain('Springfield');
      expect(lines[2]).toBe('USA');
    });
    
    it('should handle simple address', () => {
      const field = new AddressField('HOME', '123 Main St');
      const formatted = field.formatMultiLine();
      expect(formatted).toBe('123 Main St');
    });
  });
  
  describe('equals()', () => {
    it('should return true for same addresses', () => {
      const field1 = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const field2 = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      expect(field1.equals(field2)).toBe(true);
    });
    
    it('should return false for different addresses', () => {
      const field1 = new AddressField('HOME', '123 Main St');
      const field2 = new AddressField('HOME', '456 Oak Ave');
      expect(field1.equals(field2)).toBe(false);
    });
  });
  
  describe('Round-trip Conversions', () => {
    it('should round-trip through frontmatter', () => {
      const original = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const fm = original.toFrontmatter();
      const converted = AddressField.fromFrontmatter(fm.key, fm.value as string);
      expect(converted.equals(original)).toBe(true);
    });
    
    it('should round-trip through markdown', () => {
      const original = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const md = original.toMarkdown();
      const converted = AddressField.fromMarkdown(md);
      expect(converted).not.toBeNull();
      expect(converted?.getValue()).toBe(original.getValue());
    });
    
    it('should round-trip through structured frontmatter', () => {
      const original = new AddressField('HOME', '123 Main St, Springfield, IL 62701');
      const fm = original.toStructuredFrontmatter();
      const converted = AddressField.fromFrontmatter(fm.key, fm.value as AddressComponents);
      expect(converted.getStreet()).toBe(original.getStreet());
      expect(converted.getCity()).toBe(original.getCity());
    });
  });
});
