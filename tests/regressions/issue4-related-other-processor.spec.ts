import { describe, it, expect } from 'vitest';
import { RelatedOtherProcessor } from 'src/curators/relatedOther';

/**
 * Regression Test for Issue 4: RelatedOtherProcessor Runtime Error
 * 
 * Bug: RelatedOtherProcessor was creating relationship values without the required
 * "name:" prefix. The parser expects values formatted as "name:ContactName", "uid:...",
 * or "urn:uuid:...", but was receiving just the basename, causing .startsWith() to fail.
 * 
 * Fixed in: commit a2b40a5
 * 
 * This test ensures that:
 * 1. RelatedOtherProcessor formats relationship values with proper prefix
 * 2. The processor's code contains the "name:" prefix format
 */
describe('Regression: RelatedOtherProcessor Runtime Error (Issue 4)', () => {
  it('should verify RelatedOtherProcessor uses name: prefix format', () => {
    // Read the source file to verify the fix is in place
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'src/curators/relatedOther.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Verify the name: prefix is used when setting relationship values
    expect(content).toContain('name:${otherContactFile.basename}');
  });

  it('should have RelatedOtherProcessor properly configured', () => {
    expect(RelatedOtherProcessor.name).toBe('RelatedOtherProcessor');
    expect(RelatedOtherProcessor.settingPropertyName).toBe('relatedOtherProcessor');
    expect(RelatedOtherProcessor.settingDefaultValue).toBe(true);
  });

  it('should verify process function exists and is async', () => {
    expect(typeof RelatedOtherProcessor.process).toBe('function');
    expect(RelatedOtherProcessor.process.constructor.name).toBe('AsyncFunction');
  });
});
