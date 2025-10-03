# Testing

## Test Organization

Tests are organized by component and user story:

```
tests/
├── units/                     # Unit tests for models and processors
│   ├── models/
│   │   ├── contactNote/
│   │   ├── vcardFile/
│   │   └── ...
│   ├── curators/
│   └── services/
├── stories/                   # User story integration tests
│   ├── bidirectionalRelationshipSync.spec.ts
│   ├── singleVcfFileSync.spec.ts
│   ├── individualVcfFolderSync.spec.ts
│   └── vcfDropImport.spec.ts
└── demo-data/                 # Tests using demo contact data
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode  
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests use Vitest as the testing framework:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactNote } from '../src/models/contactNote';

describe('ContactNote', () => {
  let contactNote: ContactNote;

  beforeEach(() => {
    // Setup test fixtures
  });

  it('should parse relationships from markdown', async () => {
    // Test implementation
  });
});
```

## Testing Relationships

Relationship testing is a key focus:

```typescript
it('should add reciprocal relationships bidirectionally', async () => {
  // Add relationship in one contact
  await addRelationship(contact1, 'father', contact2);
  
  // Verify reciprocal relationship is added
  const relationships = await contact2.parseRelatedSection();
  expect(relationships).toContainEqual({
    type: 'child',
    contactName: contact1.basename
  });
});
```

## Code Coverage

Coverage reports are generated in `./docs/coverage/` directory. The project maintains the following coverage standards:

**Current Coverage (as of latest update):**
- **Overall**: ~70% statements, ~60% branches, ~70% functions
- **Core Models**: 85%+ coverage target
- **Business Logic**: 70%+ coverage target
- **UI Components**: Excluded (browser/DOM dependent)

**Coverage by Module:**

High Coverage Modules (>85%):
- `src/models/contactManager/` - Contact collection management
- `src/models/vcardFile/` - VCF file operations  
- `src/models/curatorManager/` - Curator processor system
- `src/models/vcardManager/` - VCard folder monitoring

Medium Coverage Modules (60-85%):
- `src/models/contactNote/` - Individual contact operations
- `src/plugin/context/` - Shared context providers

Excluded from Coverage:
- `src/main.ts` - Plugin lifecycle (requires Obsidian runtime)
- `src/plugin/settings.ts` - Settings UI (requires Obsidian DOM)
- `src/plugin/services/syncWatcher.ts` - File system watcher (requires runtime)
- `src/plugin/ui/` - UI components (browser/DOM APIs)

## Writing Tests

Tests are organized by module structure:

```
tests/
├── units/              # Unit tests mirroring src/ structure
│   ├── models/
│   │   ├── contactManager/
│   │   ├── contactNote/
│   │   ├── vcardFile/
│   │   └── vcardManager/
│   ├── curators/
│   └── services/
├── stories/            # Integration tests for user stories
└── fixtures/           # Test data and utilities
```

**Test Patterns:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform expected behavior', () => {
    // Arrange
    const mockData = createMockData();
    
    // Act
    const result = myFunction(mockData);
    
    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

**Mocking Guidelines:**

1. **Mock External Dependencies**: Use `vi.mock()` for Obsidian APIs and file system
2. **Test Business Logic**: Focus tests on logic, not implementation details
3. **Use Test Fixtures**: Leverage shared fixtures for consistent test data
4. **Avoid Over-Mocking**: Test real implementations where possible

**Coverage Exclusions:**

Mark browser/DOM-dependent code with:
```typescript
/* istanbul ignore next */
// Explanation of why this code requires browser runtime
export function domDependentFunction() {
  // Implementation
}
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Release tags

Coverage reports are generated and can be viewed in the PR checks.
