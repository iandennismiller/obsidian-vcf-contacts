/**
 * Unit tests for FieldGrouper utility
 */

import { describe, it, expect } from 'vitest';
import { FieldGrouper } from '../../../../src/models/contactNote/entities/fields/FieldGrouper';

describe('FieldGrouper', () => {
  describe('groupVCardFields', () => {
    it('should group fields by category', () => {
      const record = {
        'N.FN': 'Doe',
        'N.GN': 'John',
        'FN': 'John Doe',
        'EMAIL[WORK]': 'john@example.com',
        'TEL[CELL]': '555-1234',
        'ADR[HOME].STREET': '123 Main St',
        'ADR[HOME].LOCALITY': 'Springfield',
        'NOTE': 'Some notes',
        'BDAY': '1990-01-01'
      };

      const groups = FieldGrouper.groupVCardFields(record);

      expect(groups.name).toEqual({
        'N.FN': 'Doe',
        'N.GN': 'John',
        'FN': 'John Doe'
      });

      expect(groups.priority).toEqual({
        'EMAIL[WORK]': 'john@example.com',
        'TEL[CELL]': '555-1234',
        'BDAY': '1990-01-01'
      });

      expect(groups.address).toEqual({
        'ADR[HOME].STREET': '123 Main St',
        'ADR[HOME].LOCALITY': 'Springfield'
      });

      expect(groups.other).toEqual({
        'NOTE': 'Some notes'
      });
    });

    it('should handle empty record', () => {
      const groups = FieldGrouper.groupVCardFields({});

      expect(groups.name).toEqual({});
      expect(groups.priority).toEqual({});
      expect(groups.address).toEqual({});
      expect(groups.other).toEqual({});
    });

    it('should extract base key from bracket notation', () => {
      const record = {
        'EMAIL[WORK]': 'a@b.com',
        'EMAIL[HOME]': 'c@d.com',
        'TEL[0:CELL]': '111-2222'
      };

      const groups = FieldGrouper.groupVCardFields(record);

      expect(groups.priority).toEqual({
        'EMAIL[WORK]': 'a@b.com',
        'EMAIL[HOME]': 'c@d.com',
        'TEL[0:CELL]': '111-2222'
      });
    });
  });

  describe('sortNameItems', () => {
    it('should sort name fields in logical order', () => {
      const items = {
        'FN': 'John Doe',
        'N.FN': 'Doe',
        'N.GN': 'John',
        'N.SUFFIX': 'Jr.',
        'N.PREFIX': 'Mr.'
      };

      const sorted = FieldGrouper.sortNameItems(items);
      const keys = Object.keys(sorted);

      expect(keys).toEqual(['N.PREFIX', 'N.GN', 'N.FN', 'N.SUFFIX', 'FN']);
    });

    it('should handle partial name fields', () => {
      const items = {
        'N.GN': 'John',
        'N.FN': 'Doe'
      };

      const sorted = FieldGrouper.sortNameItems(items);
      const keys = Object.keys(sorted);

      expect(keys).toEqual(['N.GN', 'N.FN']);
    });

    it('should preserve non-standard name fields at end', () => {
      const items = {
        'FN': 'John Doe',
        'N.GN': 'John',
        'N.CUSTOM': 'Custom'
      };

      const sorted = FieldGrouper.sortNameItems(items);
      const keys = Object.keys(sorted);

      expect(keys).toEqual(['N.GN', 'FN', 'N.CUSTOM']);
    });
  });

  describe('sortedPriorityItems', () => {
    it('should sort priority fields in logical order', () => {
      const items = {
        'URL[WORK]': 'example.com',
        'EMAIL[WORK]': 'a@b.com',
        'TEL[CELL]': '555-1234',
        'GENDER': 'M',
        'BDAY': '1990-01-01'
      };

      const sorted = FieldGrouper.sortedPriorityItems(items);
      const keys = Object.keys(sorted);

      // EMAIL, TEL, BDAY, URL, ... GENDER (per priority order)
      expect(keys[0]).toBe('EMAIL[WORK]');
      expect(keys[1]).toBe('TEL[CELL]');
      expect(keys[2]).toBe('BDAY');
      expect(keys[3]).toBe('URL[WORK]');
      expect(keys[4]).toBe('GENDER');
    });

    it('should group multiple fields of same type together', () => {
      const items = {
        'EMAIL[WORK]': 'work@example.com',
        'TEL[CELL]': '555-1234',
        'EMAIL[HOME]': 'home@example.com',
        'TEL[WORK]': '555-5678'
      };

      const sorted = FieldGrouper.sortedPriorityItems(items);
      const keys = Object.keys(sorted);

      // All EMAIL fields should come before all TEL fields
      const emailIndices = keys.filter(k => k.startsWith('EMAIL')).map(k => keys.indexOf(k));
      const telIndices = keys.filter(k => k.startsWith('TEL')).map(k => keys.indexOf(k));

      expect(Math.max(...emailIndices)).toBeLessThan(Math.min(...telIndices));
    });

    it('should handle empty priority items', () => {
      const sorted = FieldGrouper.sortedPriorityItems({});
      expect(sorted).toEqual({});
    });
  });
});
