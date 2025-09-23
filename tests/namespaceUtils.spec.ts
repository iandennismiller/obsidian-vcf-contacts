import { describe, expect, it } from 'vitest';
import { 
  isValidUUID, 
  parseNamespaceValue, 
  createNamespaceValue, 
  extractDisplayName, 
  findContactByNamespace 
} from 'src/relationships/namespaceUtils';

describe('namespaceUtils', () => {
  describe('isValidUUID', () => {
    it('should recognize valid UUIDs', () => {
      expect(isValidUUID('03a0e51f-d1aa-4385-8a53-e29025acd8af')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('03a0e51f-d1aa-4385-8a53-e29025acd8a')).toBe(false); // too short
      expect(isValidUUID('03a0e51f-d1aa-4385-8a53-e29025acd8aff')).toBe(false); // too long
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('parseNamespaceValue', () => {
    it('should parse urn:uuid namespace', () => {
      const result = parseNamespaceValue('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
      expect(result).toEqual({
        type: 'urn:uuid',
        identifier: '03a0e51f-d1aa-4385-8a53-e29025acd8af'
      });
    });

    it('should parse uid namespace', () => {
      const result = parseNamespaceValue('uid:custom-id-123');
      expect(result).toEqual({
        type: 'uid',
        identifier: 'custom-id-123'
      });
    });

    it('should parse name namespace', () => {
      const result = parseNamespaceValue('name:John Doe');
      expect(result).toEqual({
        type: 'name',
        identifier: 'John Doe'
      });
    });

    it('should return null for invalid formats', () => {
      expect(parseNamespaceValue('invalid:format')).toBeNull();
      expect(parseNamespaceValue('John Doe')).toBeNull();
      expect(parseNamespaceValue('')).toBeNull();
    });
  });

  describe('createNamespaceValue', () => {
    it('should create urn:uuid namespace for valid UUIDs', () => {
      const result = createNamespaceValue('03a0e51f-d1aa-4385-8a53-e29025acd8af', 'John Doe', true);
      expect(result).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    });

    it('should create uid namespace for non-UUID UIDs', () => {
      const result = createNamespaceValue('custom-id-123', 'John Doe', true);
      expect(result).toBe('uid:custom-id-123');
    });

    it('should create name namespace when contact does not exist', () => {
      const result = createNamespaceValue('03a0e51f-d1aa-4385-8a53-e29025acd8af', 'John Doe', false);
      expect(result).toBe('name:John Doe');
    });

    it('should create name namespace when no UID is provided', () => {
      const result = createNamespaceValue(undefined, 'John Doe', true);
      expect(result).toBe('name:John Doe');
    });

    it('should create name namespace for empty UID', () => {
      const result = createNamespaceValue('', 'John Doe', true);
      expect(result).toBe('name:John Doe');
    });

    it('should create name namespace for whitespace-only UID', () => {
      const result = createNamespaceValue('   ', 'John Doe', true);
      expect(result).toBe('name:John Doe');
    });
  });

  describe('extractDisplayName', () => {
    it('should extract name from name namespace', () => {
      const result = extractDisplayName('name:John Doe');
      expect(result).toBe('John Doe');
    });

    it('should return original value for uid namespace', () => {
      const result = extractDisplayName('uid:custom-id-123');
      expect(result).toBe('uid:custom-id-123');
    });

    it('should return original value for urn:uuid namespace', () => {
      const result = extractDisplayName('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
      expect(result).toBe('urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af');
    });

    it('should return original value for invalid namespace', () => {
      const result = extractDisplayName('John Doe');
      expect(result).toBe('John Doe');
    });
  });

  describe('findContactByNamespace', () => {
    const mockGetContactByUid = (uid: string) => {
      const contacts: Record<string, any> = {
        '03a0e51f-d1aa-4385-8a53-e29025acd8af': { fullName: 'John Doe', uid: '03a0e51f-d1aa-4385-8a53-e29025acd8af' },
        'custom-id-123': { fullName: 'Jane Smith', uid: 'custom-id-123' }
      };
      return contacts[uid] || null;
    };

    const mockGetContactByName = (name: string) => {
      const contacts: Record<string, any> = {
        'John Doe': { fullName: 'John Doe', uid: '03a0e51f-d1aa-4385-8a53-e29025acd8af' },
        'Jane Smith': { fullName: 'Jane Smith', uid: 'custom-id-123' },
        'Unknown Person': { fullName: 'Unknown Person' }
      };
      return contacts[name] || null;
    };

    it('should find contact by urn:uuid namespace', () => {
      const result = findContactByNamespace(
        'urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af',
        mockGetContactByUid,
        mockGetContactByName
      );
      expect(result).toEqual({
        fullName: 'John Doe',
        uid: '03a0e51f-d1aa-4385-8a53-e29025acd8af'
      });
    });

    it('should find contact by uid namespace', () => {
      const result = findContactByNamespace(
        'uid:custom-id-123',
        mockGetContactByUid,
        mockGetContactByName
      );
      expect(result).toEqual({
        fullName: 'Jane Smith',
        uid: 'custom-id-123'
      });
    });

    it('should find contact by name namespace', () => {
      const result = findContactByNamespace(
        'name:John Doe',
        mockGetContactByUid,
        mockGetContactByName
      );
      expect(result).toEqual({
        fullName: 'John Doe',
        uid: '03a0e51f-d1aa-4385-8a53-e29025acd8af'
      });
    });

    it('should return null for invalid namespace', () => {
      const result = findContactByNamespace(
        'invalid:format',
        mockGetContactByUid,
        mockGetContactByName
      );
      expect(result).toBeNull();
    });

    it('should return null when contact not found', () => {
      const result = findContactByNamespace(
        'name:Non Existent',
        mockGetContactByUid,
        mockGetContactByName
      );
      expect(result).toBeNull();
    });
  });
});