# Code Reuse Opportunities - Analysis Summary

This document summarizes the code reuse opportunities identified in `/tests` and the reusable components added to `/tests/fixtures`.

## Analysis Findings

### Patterns Identified Across Tests

**28 test files** were found using similar mock patterns:
- `mockApp` setup appears in 20+ files
- `mockSettings` setup appears in 18+ files  
- `mockFile` (TFile) creation appears in 30+ files
- `fs/promises` mocking appears in 8+ files
- Module-level mocks (Obsidian, ContactManagerUtils, etc.) appear in 15+ files

### Common Duplication Examples

#### 1. Mock App Setup (Repeated 20+ times)

**Before - Duplicated across files:**
```typescript
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
```

**After - Using fixture:**
```typescript
import { createMockApp } from '../fixtures';

mockApp = createMockApp();
```

#### 2. Mock Settings Setup (Repeated 18+ times)

**Before:**
```typescript
mockSettings = {
  contactsFolder: 'Contacts',
  defaultHashtag: '#Contact',
  vcfStorageMethod: 'vcf-folder',
  vcfFilename: 'contacts.vcf',
  vcfWatchFolder: '/test/vcf',
  vcfWatchEnabled: true,
  vcfWatchPollingInterval: 30,
  vcfWriteBackEnabled: false,
  vcfCustomizeIgnoreList: false,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'INFO'
};
```

**After:**
```typescript
import { createMockSettings } from '../fixtures';

mockSettings = createMockSettings();
```

#### 3. Mock TFile Creation (Repeated 30+ times)

**Before:**
```typescript
mockFile = { 
  basename: 'john-doe', 
  path: 'Contacts/john-doe.md',
  name: 'john-doe.md'
} as TFile;
```

**After:**
```typescript
import { createMockTFile } from '../fixtures';

mockFile = createMockTFile('john-doe');
```

#### 4. Multiple Files Creation

**Before:**
```typescript
const mockFiles = [
  { basename: 'contact1', path: 'Contacts/contact1.md', name: 'contact1.md' } as TFile,
  { basename: 'contact2', path: 'Contacts/contact2.md', name: 'contact2.md' } as TFile,
  { basename: 'contact3', path: 'Contacts/contact3.md', name: 'contact3.md' } as TFile
];
```

**After:**
```typescript
import { createMockTFiles } from '../fixtures';

const mockFiles = createMockTFiles(['contact1', 'contact2', 'contact3']);
```

#### 5. fs/promises Module Mock (Repeated 8+ times)

**Before:**
```typescript
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
```

**After:**
```typescript
import { createFsPromisesMock } from '../fixtures';

vi.mock('fs/promises', createFsPromisesMock);
```

#### 6. VCF Content Templates (New - enables reuse)

**Before - Creating VCF content manually:**
```typescript
const vcfContent = 'BEGIN:VCARD\nVERSION:4.0\nUID:test-123\nFN:Test\nEND:VCARD\n';
```

**After:**
```typescript
import { vcfTemplates } from '../fixtures';

const vcfContent = vcfTemplates.basic('test-123', 'Test');
const vcfWithEmail = vcfTemplates.withEmail('id', 'Name', 'email@test.com');
const vcfWithRelations = vcfTemplates.withRelationships('id', 'Name', [
  { type: 'spouse', value: 'name:Partner' }
]);
```

#### 7. Frontmatter Data (New - enables reuse)

**Before - Creating frontmatter manually:**
```typescript
const frontmatter = {
  UID: 'test-uid-123',
  FN: 'John Doe',
  EMAIL: 'john@example.com',
  REV: '20240315T120000Z'
};
```

**After:**
```typescript
import { createMockFrontmatter } from '../fixtures';

const fm = createMockFrontmatter.basic();
const fmWithRelations = createMockFrontmatter.withRelationships();
const fmCustom = createMockFrontmatter.basic({ EMAIL: 'custom@test.com' });
```

#### 8. Complete Setup (New - combines common mocks)

**Before - Setting up all three:**
```typescript
beforeEach(() => {
  mockApp = { /* 15 lines */ };
  mockSettings = { /* 12 lines */ };
  mockFile = { /* 4 lines */ };
});
```

**After:**
```typescript
import { setupCommonMocks } from '../fixtures';

beforeEach(() => {
  const { mockApp, mockSettings, mockFile } = setupCommonMocks();
});
```

#### 9. Test Case Batching (New utility)

**Before:**
```typescript
const testCases = ['test.vcf', 'TEST.VCF', 'Test.Vcf', 'contact.VCF'];

for (const fileName of testCases) {
  // 10+ lines of setup and assertions
}
```

**After:**
```typescript
import { runTestCases } from '../fixtures';

await runTestCases(testCases, (testCase) => {
  // Just the assertion logic
});
```

## Reusable Components Added

### Mock Factories (`mockFactories.ts`)
- `createMockTFile()` - Single TFile mock
- `createMockTFiles()` - Multiple TFile mocks
- `createMockApp()` - Obsidian App mock with all common methods
- `createMockSettings()` - ContactsPluginSettings with defaults
- `createMockFrontmatter.*` - Frontmatter data templates
- `createMockFileContent()` - Complete markdown file with frontmatter
- `createMockTFileClass()` - Mock TFile class for inheritance
- `createMockErrors` - Common error objects
- `setupCommonMocks()` - App + Settings + File together

### File System Mocks (`fsPromisesMocks.ts`)
- `createFsPromisesMock()` - Standard fs/promises mock configuration
- `setupFsPromisesMockBehavior()` - Configure mock behaviors
- `resetFsPromisesMocks()` - Clean state between tests
- `vcfTemplates.*` - VCF content templates (basic, withEmail, withPhone, withRelationships, multiple, malformed)

### Obsidian API Mocks (`obsidianMocks.ts`)
- `createObsidianMock()` - Module-level Obsidian mock
- `createPluginUtilsMock()` - Plugin utilities
- `createContactManagerUtilsMock()` - ContactManagerUtils
- `createVcardFileMock()` - VcardFile module
- `createContactNoteMock()` - ContactNote module
- `createCuratorServiceMock()` - Curator service
- `createInsightServiceMock()` - Insight service
- `createSharedSettingsContextMock()` - Settings context
- `createCommonModuleMocks()` - All common mocks together

### Test Utilities (`testUtils.ts`)
- `wait()` - Simple delay utility
- `waitForCondition()` - Poll until condition is true
- `createSpy()` - Enhanced spy with helpers
- `withRetry()` - Retry flaky tests
- `runTestCases()` - Batch test runner
- `deepClone()` - Deep clone for test data
- `expectToContain()` - Assertion helper
- `createMockVault()` - In-memory vault for integration tests
- `testDataGenerators.*` - Generate UIDs, emails, phones, timestamps, contacts
- `mockConsole()` - Capture console output
- `createTestTimeout()` - Timeout helper

## Files That Can Benefit

The following test files have patterns that could use the new fixtures:

### High Priority (Most Duplication)
1. `tests/units/models/contactNote/contactData.spec.ts` - mockApp, mockSettings, mockFile
2. `tests/units/models/contactManager/consistencyOperations.spec.ts` - mockApp, mockFiles array, mockSettings
3. `tests/units/models/vcardFile/generation.spec.ts` - mockApp with custom metadata
4. `tests/units/services/vcfDropHandler.spec.ts` - fs/promises, MockTFile class, mockApp
5. `tests/stories/vcfExportFromObsidian.spec.ts` - mockApp, mockFile repeated many times
6. `tests/units/models/contactManager/contactManagerUtils.spec.ts` - mockApp, mockSettings

### Medium Priority
7. `tests/units/models/contactNote/revisionOperations.spec.ts`
8. `tests/units/models/contactNote/relationshipOperations.spec.ts`
9. `tests/units/models/contactNote/markdownOperations.spec.ts`
10. `tests/units/models/contactManager/contactManagerData.spec.ts`
11. `tests/units/models/vcardManager/vcardManager.spec.ts`
12. `tests/units/models/vcardFile/vcardFile.spec.ts`

### Story Tests
13-22. Various story tests in `tests/stories/` using similar patterns

## Benefits of Using Fixtures

1. **Reduced Duplication**: ~500+ lines of repeated mock setup code can be replaced
2. **Consistency**: All tests use the same mock configurations
3. **Maintainability**: Changes to mock structure only need updating in one place
4. **Readability**: Tests focus on what they're testing, not mock setup
5. **Discoverability**: JSDoc comments and README provide guidance
6. **Extensibility**: Easy to add new fixtures as patterns emerge
7. **Type Safety**: Full TypeScript support with proper types

## Usage Statistics

- **7 new fixture files** created
- **80+ reusable functions/constants** added
- **28+ test files** can benefit from fixtures
- **670 tests** still passing (including 17 new example tests)
- **~1,700 lines** of reusable code and documentation

## Next Steps for Adoption

While the fixtures are ready to use, existing tests were not modified to keep changes minimal. Teams can:

1. **Immediate use**: New tests should use fixtures from day one
2. **Gradual migration**: Update existing tests as they're modified
3. **Focused refactor**: Pick a subsystem (e.g., contactNote tests) and update together
4. **Reference**: See `tests/fixtures/example.spec.ts` for usage patterns

## Documentation

See `/tests/fixtures/README.md` for:
- Quick start guide
- Detailed API documentation
- Usage examples by scenario
- Migration guide with before/after
- Best practices
