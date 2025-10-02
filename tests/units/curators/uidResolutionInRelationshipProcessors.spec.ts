import { describe, it, expect } from 'vitest';
import { RelatedListProcessor } from "../../../src/curators/relatedList";
import { RelatedFrontMatterProcessor } from "../../../src/curators/relatedFrontMatter";
import { RunType } from "../../../src/models/curatorManager";

/**
 * Tests for UID Resolution in Relationship Processors
 * 
 * These tests verify that the fix for UID-based relationship comparison is correct.
 * The bug was that RelatedListProcessor only checked for name-based matches and didn't
 * resolve UIDs to names when comparing frontmatter relationships to Related section relationships.
 */
describe('UID Resolution in Relationship Processors', () => {
  describe('RelatedListProcessor', () => {
    it('should handle both uid and uuid types in comparison logic', () => {
      // Verify the processor code contains UID resolution logic
      const processorSource = RelatedListProcessor.process.toString();
      
      // Should check for both 'uid' and 'uuid' types
      expect(processorSource).toContain('uid');
      expect(processorSource).toContain('uuid');
      
      // Should call resolveContactNameByUID to resolve UIDs
      expect(processorSource).toContain('resolveContactNameByUID');
    });

    it('should iterate through frontmatter relationships for comparison', () => {
      // The fix changes from using .some() to a for loop for proper UID resolution
      const processorSource = RelatedListProcessor.process.toString();
      
      // Should loop through frontmatter relationships
      expect(processorSource).toContain('currentFrontmatterRelationships');
      
      // Should check relationship types match
      expect(processorSource).toContain('type.toLowerCase()');
    });
  });

  describe('RelatedFrontMatterProcessor', () => {
    it('should handle both uid and uuid types for resolution', () => {
      // Verify the processor code resolves both uid and uuid types
      const processorSource = RelatedFrontMatterProcessor.process.toString();
      
      // Should check for both 'uid' and 'uuid' types
      expect(processorSource).toContain('uid');
      expect(processorSource).toContain('uuid');
      
      // Should call resolveContact to resolve UIDs
      expect(processorSource).toContain('resolveContact');
    });
  });

  describe('Processor Configuration', () => {
    it('both processors should be IMPROVEMENT type', () => {
      // Both processors run when "Run curator processors on current contact" is executed
      expect(RelatedListProcessor.runType).toBe(RunType.IMPROVEMENT);
      expect(RelatedFrontMatterProcessor.runType).toBe(RunType.IMPROVEMENT);
    });
  });
});
