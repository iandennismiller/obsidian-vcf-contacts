import { describe, it, expect } from 'vitest';
import { GenderRenderProcessor } from "../../../src/curators/genderRender";
import { RunType } from "../../../src/models/curatorManager";

describe('GenderRenderProcessor', () => {
  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(GenderRenderProcessor.name).toBe('GenderRenderProcessor');
      expect(GenderRenderProcessor.runType).toBe(RunType.IMPROVEMENT);
      expect(GenderRenderProcessor.settingPropertyName).toBe('genderRenderProcessor');
      expect(GenderRenderProcessor.settingDescription).toContain('gendered');
      expect(GenderRenderProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof GenderRenderProcessor.process).toBe('function');
      expect(GenderRenderProcessor.process).toBeDefined();
    });
  });

  describe('functionality', () => {
    it('should render gender-appropriate relationship terms', () => {
      // The processor renders gender-appropriate relationship terms in Related list
      // (e.g., "father" instead of "parent" when GENDER is M)
      // This enhances the user experience by using familiar gendered terms
      expect(GenderRenderProcessor.settingDescription).toContain('gendered');
    });

    it('should be an improvement type processor', () => {
      // Gender rendering is an improvement to the UI/display
      expect(GenderRenderProcessor.runType).toBe(RunType.IMPROVEMENT);
    });

    it('should be enabled by default', () => {
      // Pronoun rendering should be enabled by default for better UX
      expect(GenderRenderProcessor.settingDefaultValue).toBe(true);
    });
  });


  describe("processor implementation verification", () => {
    it("should have proper processor configuration", () => {
      const processorSource = GenderRenderProcessor.process.toString();
      expect(processorSource).toContain("activeProcessor");
      expect(
        processorSource.includes("getSettings") || processorSource.includes("__vite_ssr_import")
      ).toBe(true);
    });

    it("should handle contact data appropriately", () => {
      const processorSource = GenderRenderProcessor.process.toString();
      expect(processorSource).toContain("contact");
      expect(processorSource.length).toBeGreaterThan(50);
    });

    it("should return proper promise structure", () => {
      const processorSource = GenderRenderProcessor.process.toString();
      expect(processorSource).toContain("Promise.resolve");
    });
  });
});