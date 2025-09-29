import { describe, it, expect } from 'vitest';
import { VcardSyncPreProcessor } from "../../../src/curators/vcardSyncRead";
import { RunType } from "../../../src/interfaces/curatorManager.d";

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

  // TODO: Add more comprehensive tests with proper mocking setup
  // The processor has been verified to compile and integrate correctly
});