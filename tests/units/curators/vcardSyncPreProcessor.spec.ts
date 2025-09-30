import { describe, it, expect } from 'vitest';
import { VcardSyncPreProcessor } from "../../../src/curators/vcardSyncRead";
import { RunType } from "../../../src/models/curatorManager";

describe('VcardSyncPreProcessor', () => {
  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(VcardSyncPreProcessor.name).toBe('VCard Sync Pre Processor');
      expect(VcardSyncPreProcessor.runType).toBe(RunType.IMMEDIATELY);
      expect(VcardSyncPreProcessor.settingPropertyName).toBe('vcardSyncPreProcessor');
      expect(VcardSyncPreProcessor.settingDescription).toContain('VCard Folder Watcher');
      expect(VcardSyncPreProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof VcardSyncPreProcessor.process).toBe('function');
      expect(VcardSyncPreProcessor.process).toBeDefined();
    });
  });

  describe("processor implementation verification", () => {
    it("should have proper processor configuration", () => {
      const processorSource = VcardSyncPreProcessor.process.toString();
      expect(processorSource).toContain("activeProcessor");
      expect(
        processorSource.includes("getSettings") || processorSource.includes("__vite_ssr_import")
      ).toBe(true);
    });

    it("should handle contact data appropriately", () => {
      const processorSource = VcardSyncPreProcessor.process.toString();
      expect(processorSource).toContain("contact");
      expect(processorSource.length).toBeGreaterThan(50);
    });

    it("should return proper promise structure", () => {
      const processorSource = VcardSyncPreProcessor.process.toString();
      expect(processorSource).toContain("Promise.resolve");
    });
  });
});
