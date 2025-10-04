/**
 * Tests for ContactField abstract base class
 */

import { describe, it, expect } from 'vitest';
import { ContactField, ValidationResult, FrontmatterEntry } from '../../../../src/models/contactNote/entities/fields/ContactField';

// Concrete test implementation
class TestField extends ContactField {
  getType(): string {
    return 'TEST';
  }
  
  validate(): ValidationResult {
    return { isValid: true, errors: [] };
  }
  
  toFrontmatter(): FrontmatterEntry {
    return { key: `TEST.${this.label}`, value: this.value };
  }
  
  toMarkdown(): string {
    return `- ${this.label}: ${this.value}`;
  }
}

describe('ContactField Abstract Base', () => {
  describe('Constructor', () => {
    it('should create field with label and value', () => {
      const field = new TestField('WORK', 'test-value');
      expect(field.getLabel()).toBe('WORK');
      expect(field.getValue()).toBe('test-value');
    });
  });
  
  describe('getLabel()', () => {
    it('should return the label', () => {
      const field = new TestField('HOME', 'value');
      expect(field.getLabel()).toBe('HOME');
    });
  });
  
  describe('getValue()', () => {
    it('should return the value', () => {
      const field = new TestField('WORK', 'test-value');
      expect(field.getValue()).toBe('test-value');
    });
  });
  
  describe('getType()', () => {
    it('should return type from concrete implementation', () => {
      const field = new TestField('WORK', 'value');
      expect(field.getType()).toBe('TEST');
    });
  });
  
  describe('equals()', () => {
    it('should return true for same type, label, and value', () => {
      const field1 = new TestField('WORK', 'value');
      const field2 = new TestField('WORK', 'value');
      expect(field1.equals(field2)).toBe(true);
    });
    
    it('should return false for different labels', () => {
      const field1 = new TestField('WORK', 'value');
      const field2 = new TestField('HOME', 'value');
      expect(field1.equals(field2)).toBe(false);
    });
    
    it('should return false for different values', () => {
      const field1 = new TestField('WORK', 'value1');
      const field2 = new TestField('WORK', 'value2');
      expect(field1.equals(field2)).toBe(false);
    });
    
    it('should return false for null', () => {
      const field = new TestField('WORK', 'value');
      expect(field.equals(null)).toBe(false);
    });
    
    it('should return false for undefined', () => {
      const field = new TestField('WORK', 'value');
      expect(field.equals(undefined)).toBe(false);
    });
  });
  
  describe('toString()', () => {
    it('should return string representation', () => {
      const field = new TestField('WORK', 'test-value');
      expect(field.toString()).toBe('TEST.WORK: test-value');
    });
  });
  
  describe('Abstract Methods', () => {
    it('should require getType() implementation', () => {
      const field = new TestField('WORK', 'value');
      expect(typeof field.getType).toBe('function');
      expect(field.getType()).toBe('TEST');
    });
    
    it('should require validate() implementation', () => {
      const field = new TestField('WORK', 'value');
      expect(typeof field.validate).toBe('function');
      const result = field.validate();
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
    });
    
    it('should require toFrontmatter() implementation', () => {
      const field = new TestField('WORK', 'value');
      expect(typeof field.toFrontmatter).toBe('function');
      const result = field.toFrontmatter();
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('value');
    });
    
    it('should require toMarkdown() implementation', () => {
      const field = new TestField('WORK', 'value');
      expect(typeof field.toMarkdown).toBe('function');
      expect(typeof field.toMarkdown()).toBe('string');
    });
  });
});
