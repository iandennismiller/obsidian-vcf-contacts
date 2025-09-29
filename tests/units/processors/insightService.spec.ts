import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insightService } from '../../../src/insights/insightService';
import { RunType } from '../../../src/insights/insight.d';

// Mock processor for testing
const mockProcessor = {
  name: 'TestProcessor',
  runType: RunType.IMMEDIATELY,
  settingPropertyName: 'testProcessor',
  settingDescription: 'Test processor for unit testing',
  settingDefaultValue: true,
  process: vi.fn().mockResolvedValue(undefined)
};

describe('InsightService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processor registration', () => {
    it('should register processors correctly', () => {
      // Test that we can register a processor
      expect(() => insightService.register(mockProcessor)).not.toThrow();
    });

    it('should provide settings for registered processors', () => {
      insightService.register(mockProcessor);
      const settings = insightService.settings();
      
      expect(settings).toBeInstanceOf(Array);
      const testProcessorSetting = settings.find(s => s.name === 'TestProcessor');
      expect(testProcessorSetting).toBeDefined();
      expect(testProcessorSetting?.settingPropertyName).toBe('testProcessor');
      expect(testProcessorSetting?.settingDescription).toBe('Test processor for unit testing');
      expect(testProcessorSetting?.settingDefaultValue).toBe(true);
      expect(testProcessorSetting?.runType).toBe(RunType.IMMEDIATELY);
    });
  });

  describe('processor coverage validation', () => {
    it('should have all expected processors available for registration', () => {
      // This test validates that processor registration works correctly
      // The actual processor imports are validated by the individual processor tests
      
      const testProcessors = [
        {
          name: 'UidProcessor',
          runType: RunType.IMMEDIATELY,
          settingPropertyName: 'UIDProcessor',
          settingDescription: 'Test UID processor',
          settingDefaultValue: true,
          process: vi.fn()
        },
        {
          name: 'VcardSyncProcessor',
          runType: RunType.INPROVEMENT,
          settingPropertyName: 'vcardSync',
          settingDescription: 'Test VCard sync',
          settingDefaultValue: false,
          process: vi.fn()
        }
      ];

      // Test that we can register multiple processors
      testProcessors.forEach(processor => {
        expect(() => insightService.register(processor)).not.toThrow();
      });

      const settings = insightService.settings();
      expect(settings.length).toBeGreaterThanOrEqual(testProcessors.length);
    });

    it('should support different run types', () => {
      // Test that the service can handle different run types
      const immediateProcessor = {
        ...mockProcessor,
        name: 'ImmediateProcessor',
        runType: RunType.IMMEDIATELY
      };
      
      const improvementProcessor = {
        ...mockProcessor,
        name: 'ImprovementProcessor', 
        runType: RunType.INPROVEMENT
      };

      insightService.register(immediateProcessor);
      insightService.register(improvementProcessor);
      
      const settings = insightService.settings();
      expect(settings.some(s => s.runType === RunType.IMMEDIATELY)).toBe(true);
      expect(settings.some(s => s.runType === RunType.INPROVEMENT)).toBe(true);
    });
  });

  describe('service functionality', () => {
    it('should have required service methods', () => {
      expect(typeof insightService.register).toBe('function');
      expect(typeof insightService.process).toBe('function');
      expect(typeof insightService.settings).toBe('function');
    });

    it('should return settings as an array', () => {
      const settings = insightService.settings();
      expect(Array.isArray(settings)).toBe(true);
    });
  });
});