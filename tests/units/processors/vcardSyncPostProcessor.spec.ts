import { describe, it, expect } from 'vitest';
import { VcardSyncPostProcessor } from '../../../src/insights/processors/vcardSyncWrite';
import { RunType } from '../../../src/insights/insight.d';

describe('VcardSyncPostProcessor', () => {
  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(VcardSyncPostProcessor.name).toBe('VCard Sync Post Processor');
      expect(VcardSyncPostProcessor.runType).toBe(RunType.INPROVEMENT);
      expect(VcardSyncPostProcessor.settingPropertyName).toBe('vcardSyncPostProcessor');
      expect(VcardSyncPostProcessor.settingDescription).toContain('VCard Write Back');
      expect(VcardSyncPostProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof VcardSyncPostProcessor.process).toBe('function');
      expect(VcardSyncPostProcessor.process).toBeDefined();
    });
  });

  // TODO: Add more comprehensive tests with proper mocking setup
  // The processor has been verified to compile and integrate correctly
});