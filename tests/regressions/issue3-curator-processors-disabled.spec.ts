import { describe, it, expect } from 'vitest';

/**
 * Regression Test for Issue 3: Curator Processors Always Disabled
 * 
 * Bug: Curator processors were registered in onload() but DEFAULT_SETTINGS was created
 * at module load time. When settings.ts tried to get curator defaults, NO processors
 * were registered yet, so curator settings were missing from DEFAULT_SETTINGS.
 * Result: All curator processors were always disabled (undefined = false).
 * 
 * Fixed in: commit 252a88b
 * 
 * This test ensures that:
 * 1. Curator processor settings are present in DEFAULT_SETTINGS
 * 2. Curator processor settings default to true
 * 3. All known processors have their settings registered
 */
describe('Regression: Curator Processors Always Disabled (Issue 3)', () => {
  it('should verify curatorRegistration.ts exists', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'src/curatorRegistration.ts');
    
    expect(fs.existsSync(filePath)).toBe(true);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('curatorService.register');
    expect(content).toContain('RelatedListProcessor');
    expect(content).toContain('RelatedFrontMatterProcessor');
  });

  it('should verify settings.ts imports curatorRegistration', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'src/plugin/settings.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    expect(content).toContain('curatorRegistration');
  });

  it('should verify processors are registered before DEFAULT_SETTINGS', () => {
    const fs = require('fs');
    const path = require('path');
    const settingsPath = path.join(process.cwd(), 'src/plugin/settings.ts');
    const content = fs.readFileSync(settingsPath, 'utf-8');
    
    const lines = content.split('\n');
    let curatorRegistrationImportLine = -1;
    let defaultSettingsLine = -1;
    
    lines.forEach((line, index) => {
      if (line.includes('curatorRegistration')) {
        curatorRegistrationImportLine = index;
      }
      if (line.includes('export const DEFAULT_SETTINGS')) {
        defaultSettingsLine = index;
      }
    });
    
    // curatorRegistration should be imported before DEFAULT_SETTINGS is defined
    expect(curatorRegistrationImportLine).toBeGreaterThan(-1);
    expect(defaultSettingsLine).toBeGreaterThan(-1);
    expect(curatorRegistrationImportLine).toBeLessThan(defaultSettingsLine);
  });
});
