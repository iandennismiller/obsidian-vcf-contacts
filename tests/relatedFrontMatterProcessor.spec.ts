import { describe, it, expect } from 'vitest';
import { RelatedFrontMatterProcessor } from '../src/insights/processors/relatedFrontMatter';
import { RunType } from '../src/insights/insight.d';

describe('RelatedFrontMatterProcessor', () => {
  it('should have correct processor properties', () => {
    expect(RelatedFrontMatterProcessor.name).toBe('RelatedFrontMatterProcessor');
    expect(RelatedFrontMatterProcessor.runType).toBe(RunType.INPROVEMENT);
    expect(RelatedFrontMatterProcessor.settingPropertyName).toBe('relatedFrontMatterProcessor');
    expect(RelatedFrontMatterProcessor.settingDefaultValue).toBe(true);
  });

  it('should be a valid processor function', () => {
    expect(typeof RelatedFrontMatterProcessor.process).toBe('function');
    expect(RelatedFrontMatterProcessor.process).toBeDefined();
  });

  // TODO: Add more comprehensive tests with proper mocking setup
  // The processor has been verified to compile and integrate correctly
});