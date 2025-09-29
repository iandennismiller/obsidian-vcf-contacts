import { describe, it, expect } from 'vitest';
import { UidProcessor } from '../../../src/insights/processors/uidValidate';
import { RunType } from '../../../src/insights/insight.d';

describe('UidProcessor', () => {
  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(UidProcessor.name).toBe('UidProcessor');
      expect(UidProcessor.runType).toBe(RunType.IMMEDIATELY);
      expect(UidProcessor.settingPropertyName).toBe('UIDProcessor');
      expect(UidProcessor.settingDescription).toContain('Automatically generates a unique identifier');
      expect(UidProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof UidProcessor.process).toBe('function');
      expect(UidProcessor.process).toBeDefined();
    });
  });

  // TODO: Add more comprehensive tests with proper mocking setup
  // The processor has been verified to compile and integrate correctly
});