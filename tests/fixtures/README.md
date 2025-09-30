# Test Fixtures Guide

This directory contains reusable test fixtures, mocks, and utilities to reduce code duplication across tests.

## Overview

The fixtures are organized into several modules:

- **mockFactories.ts** - Factory functions for creating mock objects (App, Settings, TFile, etc.)
- **fsPromisesMocks.ts** - Standardized mocks for Node.js fs/promises module
- **obsidianMocks.ts** - Module-level mocks for Obsidian API and common dependencies
- **testUtils.ts** - Utility functions for test setup and assertions
- **curatorMocks.ts** - Specialized mocks for curator tests (already existed)
- **index.ts** - Central export point for all fixtures

## Quick Start

### Basic Usage

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockApp, createMockSettings, createMockTFile } from '../fixtures';

describe('MyComponent', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let mockFile: TFile;

  beforeEach(() => {
    mockApp = createMockApp();
    mockSettings = createMockSettings();
    mockFile = createMockTFile('john-doe');
  });

  it('should work with mocks', () => {
    // Your test here
  });
});
```

### Using setupCommonMocks

For even simpler setup:

```typescript
import { setupCommonMocks } from '../fixtures';

beforeEach(() => {
  const { mockApp, mockSettings, mockFile } = setupCommonMocks({
    basename: 'test-contact',
    settings: { contactsFolder: 'MyContacts' }
  });
});
```

## Mock Factories

### Creating Mock TFile Objects

```typescript
import { createMockTFile, createMockTFiles } from '../fixtures';

// Single file
const file = createMockTFile('john-doe');
const fileWithPath = createMockTFile('john-doe', 'Custom/john-doe.md');

// Multiple files
const files = createMockTFiles(['john-doe', 'jane-doe', 'bob-smith']);
```

### Creating Mock App Objects

```typescript
import { createMockApp } from '../fixtures';

// Basic app
const app = createMockApp();

// App with custom vault behavior
const app = createMockApp({
  vault: {
    read: vi.fn().mockResolvedValue('custom content')
  }
});

// App with custom metadata
const app = createMockApp({
  metadataCache: {
    getFileCache: vi.fn().mockReturnValue({
      frontmatter: { UID: 'custom-uid' }
    })
  }
});
```

### Creating Mock Settings

```typescript
import { createMockSettings } from '../fixtures';

// Default settings
const settings = createMockSettings();

// Custom settings
const settings = createMockSettings({
  contactsFolder: 'MyContacts',
  vcfStorageMethod: 'vcf-folder'
});
```

### Creating Mock Frontmatter

```typescript
import { createMockFrontmatter } from '../fixtures';

// Basic contact
const fm = createMockFrontmatter.basic();

// Contact with relationships
const fm = createMockFrontmatter.withRelationships();

// Contact with gender
const fm = createMockFrontmatter.withGender('male');

// Custom overrides
const fm = createMockFrontmatter.basic({ 
  EMAIL: 'custom@example.com',
  TEL: '+9999999999'
});
```

### Creating Mock File Content

```typescript
import { createMockFileContent, createMockFrontmatter } from '../fixtures';

const content = createMockFileContent(
  createMockFrontmatter.basic(),
  '## Notes\nSome contact notes here'
);

// Result:
// ---
// UID: test-uid-123
// FN: John Doe
// EMAIL: john@example.com
// REV: 20240315T120000Z
// ---
//
// ## Notes
// Some contact notes here
```

## File System Mocks

### Mocking fs/promises

```typescript
import { vi } from 'vitest';
import { createFsPromisesMock, setupFsPromisesMockBehavior } from '../fixtures';

// At module level
vi.mock('fs/promises', createFsPromisesMock);

describe('VCF Operations', () => {
  let fsPromises: any;

  beforeEach(async () => {
    fsPromises = await import('fs/promises');
    
    // Setup common behaviors
    setupFsPromisesMockBehavior(fsPromises, {
      readFileContent: 'BEGIN:VCARD\nVERSION:4.0\nEND:VCARD',
      files: ['contact1.vcf', 'contact2.vcf']
    });
  });
});
```

### Using VCF Templates

```typescript
import { vcfTemplates } from '../fixtures';

// Basic VCF
const vcf = vcfTemplates.basic('my-uid', 'John Doe');

// VCF with email
const vcf = vcfTemplates.withEmail('my-uid', 'John Doe', 'john@example.com');

// VCF with relationships
const vcf = vcfTemplates.withRelationships('my-uid', 'John Doe', [
  { type: 'spouse', value: 'name:Jane Doe' },
  { type: 'child', value: 'name:Tommy Doe' }
]);

// Multiple contacts
const vcf = vcfTemplates.multiple([
  { uid: 'uid1', fn: 'Contact 1' },
  { uid: 'uid2', fn: 'Contact 2' }
]);
```

## Obsidian API Mocks

### Module-Level Mocks

```typescript
import { vi } from 'vitest';
import { createObsidianMock, createContactManagerUtilsMock } from '../fixtures';

// Mock Obsidian
vi.mock('obsidian', createObsidianMock);

// Mock ContactManagerUtils
vi.mock('../../../../src/models/contactManager/contactManagerUtils', 
  createContactManagerUtilsMock);

// Mock with custom behavior
vi.mock('obsidian', () => createObsidianMock({
  Notice: vi.fn().mockImplementation((msg) => console.log(msg))
}));
```

### Common Module Mocks

```typescript
import { createCommonModuleMocks } from '../fixtures';

const mocks = createCommonModuleMocks();

vi.mock('obsidian', mocks.obsidian);
vi.mock('path/to/contactManagerUtils', mocks.contactManagerUtils);
vi.mock('path/to/vcardFile', mocks.vcardFile);
vi.mock('path/to/contactNote', mocks.contactNote);
```

## Test Utilities

### Waiting and Timing

```typescript
import { wait, waitForCondition } from '../fixtures';

// Simple wait
await wait(100);

// Wait for condition
await waitForCondition(
  () => someValue === expectedValue,
  1000,  // timeout
  50     // polling interval
);
```

### Running Test Cases

```typescript
import { runTestCases } from '../fixtures';

const testCases = [
  { input: 'test.vcf', expected: true },
  { input: 'test.txt', expected: false },
  { input: 'contact.vcf', expected: true }
];

await runTestCases(testCases, (testCase) => {
  const result = isVcfFile(testCase.input);
  expect(result).toBe(testCase.expected);
});
```

### Mock Vault

```typescript
import { createMockVault } from '../fixtures';

const vault = createMockVault();

// Use like a real vault
await vault.create('test.md', 'content');
const content = await vault.read('test.md');
await vault.modify('test.md', 'new content');
expect(vault.exists('test.md')).toBe(true);
```

### Test Data Generators

```typescript
import { testDataGenerators } from '../fixtures';

const uid = testDataGenerators.uid('contact');
const email = testDataGenerators.email('john');
const phone = testDataGenerators.phone();
const timestamp = testDataGenerators.timestamp();

// Generate multiple contacts
const contacts = testDataGenerators.contacts(5, 'test-contact');
```

## Migration Guide

### Before (Duplicate Code)

```typescript
describe('MyTest', () => {
  let mockApp: Partial<App>;
  
  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any,
      workspace: {
        openFile: vi.fn(),
        getLeaf: vi.fn()
      } as any
    };
  });
});
```

### After (Using Fixtures)

```typescript
import { createMockApp } from '../fixtures';

describe('MyTest', () => {
  let mockApp: Partial<App>;
  
  beforeEach(() => {
    mockApp = createMockApp();
  });
});
```

## Best Practices

1. **Use factories instead of inline objects**: This ensures consistency and reduces duplication
2. **Customize only what you need**: All factories accept override parameters
3. **Use setupCommonMocks for simple cases**: When you need app, settings, and file together
4. **Leverage existing mocks first**: Check curatorMocks.ts for specialized curator mocks
5. **Add to fixtures when patterns repeat**: If you find yourself copying mock code, add it to fixtures

## Examples by Use Case

### Testing VCF Import

```typescript
import { vi } from 'vitest';
import { 
  createFsPromisesMock, 
  setupFsPromisesMockBehavior,
  vcfTemplates 
} from '../fixtures';

vi.mock('fs/promises', createFsPromisesMock);

describe('VCF Import', () => {
  let fsPromises: any;
  
  beforeEach(async () => {
    fsPromises = await import('fs/promises');
    setupFsPromisesMockBehavior(fsPromises, {
      readFileContent: vcfTemplates.basic('test-uid', 'Test Contact')
    });
  });
});
```

### Testing Contact Operations

```typescript
import { setupCommonMocks, createMockFrontmatter } from '../fixtures';

describe('Contact Operations', () => {
  beforeEach(() => {
    const { mockApp, mockSettings, mockFile } = setupCommonMocks();
    
    // Customize frontmatter for this test
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: createMockFrontmatter.withRelationships()
    });
  });
});
```

### Testing Error Scenarios

```typescript
import { createMockApp, createMockErrors } from '../fixtures';

it('should handle vault read errors', async () => {
  const app = createMockApp({
    vault: {
      read: vi.fn().mockRejectedValue(createMockErrors.vaultRead)
    }
  });
  
  await expect(readContact(app, file)).rejects.toThrow('Failed to read file');
});
```

## Adding New Fixtures

When adding new reusable components:

1. Add the function/constant to the appropriate module
2. Export it from that module
3. Re-export from index.ts
4. Document it in this README
5. Add JSDoc comments explaining usage

## Questions?

Refer to the existing test files for real-world usage examples, or check the JSDoc comments in each fixture module.
