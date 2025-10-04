/**
 * Tests for Revision value object
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Revision } from '../../../../src/models/contactNote/entities/valueObjects/Revision';

describe('Revision Value Object', () => {
  describe('now()', () => {
    it('should create with current timestamp', () => {
      const before = Date.now();
      const revision = Revision.now();
      const after = Date.now();
      
      const timestamp = revision.getTimestamp().getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
    
    it('should create different timestamps when called multiple times', () => {
      const rev1 = Revision.now();
      // Small delay to ensure different timestamps
      const delay = () => new Promise(resolve => setTimeout(resolve, 10));
      return delay().then(() => {
        const rev2 = Revision.now();
        expect(rev1.equals(rev2)).toBe(false);
      });
    });
  });
  
  describe('fromString()', () => {
    it('should create from ISO 8601 string', () => {
      const isoString = '2024-01-15T10:30:00.000Z';
      const revision = Revision.fromString(isoString);
      expect(revision.toISOString()).toBe(isoString);
    });
    
    it('should create from date string', () => {
      const dateString = '2024-01-15';
      const revision = Revision.fromString(dateString);
      expect(revision.getTimestamp()).toBeInstanceOf(Date);
    });
    
    it('should handle various date formats', () => {
      const formats = [
        '2024-01-15T10:30:00.000Z',
        '2024-01-15T10:30:00Z',
        '2024-01-15',
        'January 15, 2024'
      ];
      
      formats.forEach(format => {
        const revision = Revision.fromString(format);
        expect(revision.getTimestamp()).toBeInstanceOf(Date);
      });
    });
    
    it('should throw error for empty string', () => {
      expect(() => Revision.fromString('')).toThrow('Revision date string cannot be empty');
    });
    
    it('should throw error for whitespace only', () => {
      expect(() => Revision.fromString('   ')).toThrow('Revision date string cannot be empty');
    });
    
    it('should throw error for invalid date string', () => {
      expect(() => Revision.fromString('invalid-date')).toThrow('Invalid date string');
    });
  });
  
  describe('fromTimestamp()', () => {
    it('should create from Unix timestamp', () => {
      const timestamp = 1705315800000; // 2024-01-15T10:30:00.000Z
      const revision = Revision.fromTimestamp(timestamp);
      expect(revision.getTimestamp().getTime()).toBe(timestamp);
    });
    
    it('should create from zero timestamp', () => {
      const revision = Revision.fromTimestamp(0);
      expect(revision.getTimestamp().getTime()).toBe(0);
    });
    
    it('should throw error for negative timestamp', () => {
      expect(() => Revision.fromTimestamp(-1000)).toThrow('Invalid timestamp: must be non-negative');
    });
    
    it('should throw error for NaN', () => {
      expect(() => Revision.fromTimestamp(NaN)).toThrow('Invalid timestamp: must be a number');
    });
    
    it('should throw error for non-number', () => {
      expect(() => Revision.fromTimestamp('123' as any)).toThrow('Invalid timestamp: must be a number');
    });
  });
  
  describe('fromDate()', () => {
    it('should create from Date object', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const revision = Revision.fromDate(date);
      expect(revision.getTimestamp().getTime()).toBe(date.getTime());
    });
    
    it('should throw error for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      expect(() => Revision.fromDate(invalidDate)).toThrow('Invalid date: Date object is invalid');
    });
    
    it('should throw error for non-Date object', () => {
      expect(() => Revision.fromDate('2024-01-15' as any)).toThrow('Invalid date: must be a Date object');
    });
  });
  
  describe('getTimestamp()', () => {
    it('should return Date object', () => {
      const revision = Revision.now();
      const timestamp = revision.getTimestamp();
      expect(timestamp).toBeInstanceOf(Date);
    });
    
    it('should return defensive copy', () => {
      const revision = Revision.now();
      const timestamp1 = revision.getTimestamp();
      const timestamp2 = revision.getTimestamp();
      
      // Should be different objects
      expect(timestamp1).not.toBe(timestamp2);
      // But with same value
      expect(timestamp1.getTime()).toBe(timestamp2.getTime());
    });
    
    it('should not allow modification through returned Date', () => {
      const revision = Revision.now();
      const timestamp = revision.getTimestamp();
      const originalTime = timestamp.getTime();
      
      // Try to modify the returned Date
      timestamp.setFullYear(2000);
      
      // Original revision should be unchanged
      expect(revision.getTimestamp().getTime()).toBe(originalTime);
    });
  });
  
  describe('toISOString()', () => {
    it('should return ISO 8601 string', () => {
      const isoString = '2024-01-15T10:30:00.000Z';
      const revision = Revision.fromString(isoString);
      expect(revision.toISOString()).toBe(isoString);
    });
    
    it('should match Date.toISOString() format', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const revision = Revision.fromDate(date);
      expect(revision.toISOString()).toBe(date.toISOString());
    });
  });
  
  describe('Comparison Methods', () => {
    let older: Revision;
    let newer: Revision;
    
    beforeEach(() => {
      older = Revision.fromString('2024-01-15T10:00:00.000Z');
      newer = Revision.fromString('2024-01-15T11:00:00.000Z');
    });
    
    describe('isNewerThan()', () => {
      it('should return true when this is newer', () => {
        expect(newer.isNewerThan(older)).toBe(true);
      });
      
      it('should return false when this is older', () => {
        expect(older.isNewerThan(newer)).toBe(false);
      });
      
      it('should return false when equal', () => {
        const same = Revision.fromString('2024-01-15T10:00:00.000Z');
        expect(older.isNewerThan(same)).toBe(false);
      });
    });
    
    describe('isOlderThan()', () => {
      it('should return true when this is older', () => {
        expect(older.isOlderThan(newer)).toBe(true);
      });
      
      it('should return false when this is newer', () => {
        expect(newer.isOlderThan(older)).toBe(false);
      });
      
      it('should return false when equal', () => {
        const same = Revision.fromString('2024-01-15T10:00:00.000Z');
        expect(older.isOlderThan(same)).toBe(false);
      });
    });
    
    describe('equals()', () => {
      it('should return true for same timestamp', () => {
        const rev1 = Revision.fromString('2024-01-15T10:00:00.000Z');
        const rev2 = Revision.fromString('2024-01-15T10:00:00.000Z');
        expect(rev1.equals(rev2)).toBe(true);
      });
      
      it('should return false for different timestamps', () => {
        expect(older.equals(newer)).toBe(false);
      });
      
      it('should return false for null', () => {
        expect(older.equals(null)).toBe(false);
      });
      
      it('should return false for undefined', () => {
        expect(older.equals(undefined)).toBe(false);
      });
    });
    
    describe('diff()', () => {
      it('should return positive when this is newer', () => {
        const diff = newer.diff(older);
        expect(diff).toBeGreaterThan(0);
        expect(diff).toBe(3600000); // 1 hour in ms
      });
      
      it('should return negative when this is older', () => {
        const diff = older.diff(newer);
        expect(diff).toBeLessThan(0);
        expect(diff).toBe(-3600000);
      });
      
      it('should return zero when equal', () => {
        const same = Revision.fromString('2024-01-15T10:00:00.000Z');
        expect(older.diff(same)).toBe(0);
      });
    });
  });
  
  describe('toString()', () => {
    it('should return ISO 8601 string', () => {
      const isoString = '2024-01-15T10:30:00.000Z';
      const revision = Revision.fromString(isoString);
      expect(revision.toString()).toBe(isoString);
    });
    
    it('should match toISOString()', () => {
      const revision = Revision.now();
      expect(revision.toString()).toBe(revision.toISOString());
    });
  });
  
  describe('toFrontmatterValue()', () => {
    it('should return ISO 8601 string', () => {
      const isoString = '2024-01-15T10:30:00.000Z';
      const revision = Revision.fromString(isoString);
      expect(revision.toFrontmatterValue()).toBe(isoString);
    });
  });
  
  describe('toDisplayString()', () => {
    it('should return human-readable string', () => {
      const revision = Revision.now();
      const display = revision.toDisplayString();
      expect(display).toBeTruthy();
      expect(typeof display).toBe('string');
    });
  });
  
  describe('toMilliseconds()', () => {
    it('should return Unix timestamp', () => {
      const timestamp = 1705315800000;
      const revision = Revision.fromTimestamp(timestamp);
      expect(revision.toMilliseconds()).toBe(timestamp);
    });
    
    it('should match Date.getTime()', () => {
      const date = new Date();
      const revision = Revision.fromDate(date);
      expect(revision.toMilliseconds()).toBe(date.getTime());
    });
  });
  
  describe('Immutability', () => {
    it('should not allow modification of internal timestamp', () => {
      const revision = Revision.now();
      const timestamp1 = revision.getTimestamp();
      const time1 = timestamp1.getTime();
      
      // Try to modify
      timestamp1.setFullYear(2000);
      
      // Should be unchanged
      const timestamp2 = revision.getTimestamp();
      expect(timestamp2.getTime()).toBe(time1);
    });
    
    it('should always return same value', () => {
      const revision = Revision.fromString('2024-01-15T10:30:00.000Z');
      expect(revision.toISOString()).toBe('2024-01-15T10:30:00.000Z');
      expect(revision.toISOString()).toBe('2024-01-15T10:30:00.000Z');
      expect(revision.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });
  });
  
  describe('Round-trip Conversions', () => {
    it('should round-trip through ISO string', () => {
      const original = Revision.now();
      const isoString = original.toISOString();
      const converted = Revision.fromString(isoString);
      expect(converted.equals(original)).toBe(true);
    });
    
    it('should round-trip through timestamp', () => {
      const original = Revision.now();
      const timestamp = original.toMilliseconds();
      const converted = Revision.fromTimestamp(timestamp);
      expect(converted.equals(original)).toBe(true);
    });
    
    it('should round-trip through Date object', () => {
      const original = Revision.now();
      const date = original.getTimestamp();
      const converted = Revision.fromDate(date);
      expect(converted.equals(original)).toBe(true);
    });
  });
});
