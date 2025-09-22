import { describe, it, expect } from 'vitest';

// Test utility functions for VCF watcher
describe('VCF Watcher Utilities', () => {
  describe('filename sanitization', () => {
    // Test the sanitization logic that would be used in the VCF watcher
    function sanitizeFileName(input: string): string {
      const illegalRe = /[\/\?<>\\:\*\|"]/g;
      const controlRe = /[\x00-\x1f\x80-\x9f]/g;
      const reservedRe = /^\.+$/;
      const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
      const windowsTrailingRe = /[\. ]+$/;
      const multipleSpacesRe = /\s+/g;
      
      return input
        .replace(illegalRe, ' ')
        .replace(controlRe, ' ')
        .replace(reservedRe, ' ')
        .replace(windowsReservedRe, ' ')
        .replace(windowsTrailingRe, ' ')
        .replace(multipleSpacesRe, " ")
        .trim();
    }

    it('should replace illegal characters with spaces', () => {
      const result = sanitizeFileName('file/name?with<illegal>chars\\in:it*and|"quotes"');
      expect(result).toBe('file name with illegal chars in it and quotes');
    });

    it('should handle control characters', () => {
      const result = sanitizeFileName('file\x00name\x1f');
      expect(result).toBe('file name');
    });

    it('should handle reserved names', () => {
      expect(sanitizeFileName('...')).toBe('');
      expect(sanitizeFileName('CON')).toBe('');
      expect(sanitizeFileName('con.txt')).toBe('');
      expect(sanitizeFileName('PRN')).toBe('');
      expect(sanitizeFileName('COM1')).toBe('');
    });

    it('should remove trailing dots and spaces', () => {
      expect(sanitizeFileName('filename... ')).toBe('filename');
      expect(sanitizeFileName('filename.   ')).toBe('filename');
    });

    it('should collapse multiple spaces', () => {
      expect(sanitizeFileName('file    name   with   spaces')).toBe('file name with spaces');
    });

    it('should handle empty strings', () => {
      expect(sanitizeFileName('')).toBe('');
      expect(sanitizeFileName('   ')).toBe('');
    });

    it('should handle normal names unchanged', () => {
      expect(sanitizeFileName('John Doe')).toBe('John Doe');
      expect(sanitizeFileName('Jane Smith-Jones')).toBe('Jane Smith-Jones');
    });
  });

  describe('name assembly from VCard fields', () => {
    function assembleNameFromFields(record: any): string | null {
      // Try to assemble name from N fields
      const nameComponents = [
        record["N.PREFIX"],
        record["N.GN"],
        record["N.MN"], 
        record["N.FN"],
        record["N.SUFFIX"]
      ].filter(component => component && component.trim());

      if (nameComponents.length > 0) {
        return nameComponents.join(' ');
      }

      // Try other fields that might contain a name
      if (record.ORG) {
        return record.ORG;
      }

      return null;
    }

    it('should assemble name from N fields', () => {
      const record = {
        "N.PREFIX": "Dr.",
        "N.GN": "John",
        "N.MN": "Q",
        "N.FN": "Doe",
        "N.SUFFIX": "Jr."
      };
      expect(assembleNameFromFields(record)).toBe('Dr. John Q Doe Jr.');
    });

    it('should handle partial N fields', () => {
      const record = {
        "N.GN": "John",
        "N.FN": "Doe"
      };
      expect(assembleNameFromFields(record)).toBe('John Doe');
    });

    it('should fallback to ORG field', () => {
      const record = {
        "ORG": "Acme Corporation"
      };
      expect(assembleNameFromFields(record)).toBe('Acme Corporation');
    });

    it('should filter out empty/whitespace components', () => {
      const record = {
        "N.PREFIX": "",
        "N.GN": "John",
        "N.MN": "   ",
        "N.FN": "Doe",
        "N.SUFFIX": ""
      };
      expect(assembleNameFromFields(record)).toBe('John Doe');
    });

    it('should return null when no name data available', () => {
      const record = {};
      expect(assembleNameFromFields(record)).toBeNull();
    });

    it('should prefer N fields over ORG', () => {
      const record = {
        "N.GN": "John",
        "N.FN": "Doe",
        "ORG": "Acme Corporation"
      };
      expect(assembleNameFromFields(record)).toBe('John Doe');
    });
  });

  describe('UUID generation', () => {
    function generateUUID(): string {
      return 'urn:uuid:' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    it('should generate UUIDs with correct format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });

    it('should have correct version number (4)', () => {
      const uuid = generateUUID();
      // The '4' in UUID v4 is at position 14 in the standard UUID format
      // In 'urn:uuid:xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' format, it's at position 23
      const versionChar = uuid.charAt(23);
      expect(versionChar).toBe('4');
    });
  });

  describe('filename generation strategy', () => {
    function sanitizeFileName(input: string): string {
      const illegalRe = /[\/\?<>\\:\*\|"]/g;
      const controlRe = /[\x00-\x1f\x80-\x9f]/g;
      const reservedRe = /^\.+$/;
      const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
      const windowsTrailingRe = /[\. ]+$/;
      const multipleSpacesRe = /\s+/g;
      
      return input
        .replace(illegalRe, ' ')
        .replace(controlRe, ' ')
        .replace(reservedRe, ' ')
        .replace(windowsReservedRe, ' ')
        .replace(windowsTrailingRe, ' ')
        .replace(multipleSpacesRe, " ")
        .trim();
    }

    function assembleNameFromFields(record: any): string | null {
      const nameComponents = [
        record["N.PREFIX"],
        record["N.GN"],
        record["N.MN"], 
        record["N.FN"],
        record["N.SUFFIX"]
      ].filter(component => component && component.trim());

      if (nameComponents.length > 0) {
        return nameComponents.join(' ');
      }

      if (record.ORG) {
        return record.ORG;
      }

      return null;
    }

    function generateFilename(record: any, slug?: string): string {
      let filename: string;

      if (slug) {
        filename = slug + '.md';
      } else if (record.FN) {
        filename = sanitizeFileName(record.FN) + '.md';
      } else {
        const assembledName = assembleNameFromFields(record);
        if (assembledName) {
          filename = sanitizeFileName(assembledName) + '.md';
        } else {
          // Fallback to UID
          const uid = record.UID || 'urn:uuid:unknown';
          filename = uid.replace('urn:uuid:', '') + '.md';
        }
      }

      return filename;
    }

    it('should prefer slug when available', () => {
      const record = { FN: 'John Doe', UID: 'urn:uuid:123' };
      const slug = 'john-doe';
      expect(generateFilename(record, slug)).toBe('john-doe.md');
    });

    it('should use FN field when slug not available', () => {
      const record = { FN: 'John Doe', UID: 'urn:uuid:123' };
      expect(generateFilename(record)).toBe('John Doe.md');
    });

    it('should assemble name from N fields when FN not available', () => {
      const record = { 
        "N.GN": 'John',
        "N.FN": 'Doe',
        UID: 'urn:uuid:123'
      };
      expect(generateFilename(record)).toBe('John Doe.md');
    });

    it('should use ORG when name fields not available', () => {
      const record = { 
        ORG: 'Acme Corp',
        UID: 'urn:uuid:123'
      };
      expect(generateFilename(record)).toBe('Acme Corp.md');
    });

    it('should fallback to UID when no name data available', () => {
      const record = { UID: 'urn:uuid:abc-123-def' };
      expect(generateFilename(record)).toBe('abc-123-def.md');
    });

    it('should sanitize filenames', () => {
      const record = { FN: 'John/Doe<test>', UID: 'urn:uuid:123' };
      expect(generateFilename(record)).toBe('John Doe test.md');
    });
  });
});