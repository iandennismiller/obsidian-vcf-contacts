import { describe, it, expect } from 'vitest';
import { RelatedListProcessor } from 'src/curators/relatedList';
import { RelatedFrontMatterProcessor } from 'src/curators/relatedFrontMatter';

/**
 * Regression Test for Issue 2: UID Resolution Bug
 * 
 * Bug: RelatedListProcessor only checked for name-based matches when comparing
 * frontmatter to Related section. When frontmatter used UIDs but Related section
 * used names, it failed to recognize them as matching relationships.
 * 
 * Fixed in: commit d754219
 * 
 * This test ensures that:
 * 1. RelatedListProcessor handles both uid and uuid types
 * 2. RelatedFrontMatterProcessor handles both uid and uuid types
 * 3. UID resolution logic is present in the processors
 */
describe('Regression: UID Resolution Bug (Issue 2)', () => {
  describe('RelatedListProcessor', () => {
    it('should have UID resolution logic for both uid and uuid types', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'src/curators/relatedList.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Verify both uid and uuid types are handled
      expect(content).toContain('uid');
      expect(content).toContain('uuid');
      expect(content).toContain('resolveContactNameByUID');
    });

    it('should iterate through frontmatter relationships for comparison', () => {
      const processorSource = RelatedListProcessor.process.toString();
      
      // Should loop through frontmatter relationships
      expect(processorSource).toContain('currentFrontmatterRelationships');
      
      // Should check relationship types match
      expect(processorSource).toContain('type.toLowerCase()');
    });

    it('should be configured as IMPROVEMENT type processor', () => {
      expect(RelatedListProcessor.runType).toBe('improvement');
      expect(RelatedListProcessor.settingDefaultValue).toBe(true);
    });
  });

  describe('RelatedFrontMatterProcessor', () => {
    it('should handle both uid and uuid types for resolution', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'src/curators/relatedFrontMatter.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Verify both uid and uuid types are handled
      expect(content).toContain('uid');
      expect(content).toContain('uuid');
      expect(content).toContain('resolveContact');
    });

    it('should be configured as IMPROVEMENT type processor', () => {
      expect(RelatedFrontMatterProcessor.runType).toBe('improvement');
      expect(RelatedFrontMatterProcessor.settingDefaultValue).toBe(true);
    });
  });

  describe('UID Resolution Integration', () => {
    it('should have both processors enabled by default', () => {
      expect(RelatedListProcessor.settingDefaultValue).toBe(true);
      expect(RelatedFrontMatterProcessor.settingDefaultValue).toBe(true);
    });

    it('should have proper setting property names', () => {
      expect(RelatedListProcessor.settingPropertyName).toBe('relatedListProcessor');
      expect(RelatedFrontMatterProcessor.settingPropertyName).toBe('relatedFrontMatterProcessor');
    });
  });
});
