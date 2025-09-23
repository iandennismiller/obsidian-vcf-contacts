import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelationshipManager } from '../src/services/relationshipManager';

// Mock all external dependencies
vi.mock('obsidian', () => ({
  TFile: class TFile {
    constructor(public path: string, public name: string, public basename: string) {}
  },
  parseYaml: vi.fn(),
  stringifyYaml: vi.fn(),
}));

vi.mock('../src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => mockApp),
}));

vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/contacts/contactFrontmatter', () => ({
  getFrontmatterFromFiles: vi.fn(() => Promise.resolve([])),
  updateFrontMatterValue: vi.fn(),
}));

const mockApp = {
  vault: {
    read: vi.fn(),
    modify: vi.fn(),
    getMarkdownFiles: vi.fn(() => []),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
};

describe('RelationshipManager REV Optimization', () => {
  let relationshipManager: RelationshipManager;

  beforeEach(() => {
    vi.clearAllMocks();
    relationshipManager = new RelationshipManager(mockApp as any);
  });

  describe('haveRelatedFieldsChanged', () => {
    it('should return false when no changes', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = { 'RELATED[friend]': 'urn:uuid:123' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(false);
    });

    it('should return true when field value changed', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = { 'RELATED[friend]': 'urn:uuid:456' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return true when field added', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = { 
        'RELATED[friend]': 'urn:uuid:123', 
        'RELATED[colleague]': 'urn:uuid:789' 
      };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return true when field removed', () => {
      const existing = { 
        'RELATED[friend]': 'urn:uuid:123', 
        'RELATED[colleague]': 'urn:uuid:789' 
      };
      const newFields = { 'RELATED[friend]': 'urn:uuid:123' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return false when both are empty', () => {
      const existing = {};
      const newFields = {};
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(false);
    });

    it('should return true when going from empty to having fields', () => {
      const existing = {};
      const newFields = { 'RELATED[friend]': 'urn:uuid:123' };
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });

    it('should return true when going from having fields to empty', () => {
      const existing = { 'RELATED[friend]': 'urn:uuid:123' };
      const newFields = {};
      
      const result = (relationshipManager as any).haveRelatedFieldsChanged(existing, newFields);
      expect(result).toBe(true);
    });
  });

  describe('REV timestamp update behavior', () => {
    it('should demonstrate that REV is only updated when RELATED fields change', () => {
      // This test documents the expected behavior that REV timestamp
      // should only be updated when RELATED fields actually change
      
      const testCases = [
        {
          name: 'No changes',
          existing: { 'RELATED[friend]': 'urn:uuid:123' },
          newFields: { 'RELATED[friend]': 'urn:uuid:123' },
          shouldUpdateREV: false
        },
        {
          name: 'Value changed',
          existing: { 'RELATED[friend]': 'urn:uuid:123' },
          newFields: { 'RELATED[friend]': 'urn:uuid:456' },
          shouldUpdateREV: true
        },
        {
          name: 'Field added',
          existing: { 'RELATED[friend]': 'urn:uuid:123' },
          newFields: { 'RELATED[friend]': 'urn:uuid:123', 'RELATED[colleague]': 'urn:uuid:789' },
          shouldUpdateREV: true
        }
      ];

      testCases.forEach(testCase => {
        const hasChanges = (relationshipManager as any).haveRelatedFieldsChanged(
          testCase.existing, 
          testCase.newFields
        );
        
        expect(hasChanges).toBe(testCase.shouldUpdateREV);
        console.log(`✅ ${testCase.name}: REV should ${testCase.shouldUpdateREV ? '' : 'not '}be updated`);
      });
    });
  });
});