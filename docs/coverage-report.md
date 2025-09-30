# Code Coverage Report

## Overview

This document provides a comprehensive overview of the test coverage for the Obsidian VCF Contacts plugin.

**Last Updated**: December 2024

## Current Coverage Statistics

| Metric | Coverage | Target |
|--------|----------|--------|
| Statements | 69.74% | 70%+ |
| Branches | 60.17% | 60%+ |
| Functions | 70.96% | 70%+ |
| Lines | 70.08% | 70%+ |

**Status**: ✅ Meeting or approaching all coverage targets

## Coverage by Module

### High Coverage Modules (85%+)

| Module | Statements | Branches | Functions | Status |
|--------|-----------|----------|-----------|--------|
| `src/models/contactManager/` | 88.4% | 72.45% | 92.47% | ✅ Excellent |
| `src/models/vcardFile/` | 90.72% | 73.33% | 98.18% | ✅ Excellent |
| `src/models/curatorManager/` | 95.77% | 94.44% | 90.47% | ✅ Excellent |
| `src/models/vcardManager/` | 83.64% | 82.35% | 78.84% | ✅ Good |
| `src/plugin/context/` | 100% | 100% | 100% | ✅ Perfect |

**Analysis**: Core business logic modules have excellent coverage, ensuring reliability of contact management, VCF operations, and curator processing.

### Medium Coverage Modules (60-85%)

| Module | Statements | Branches | Functions | Notes |
|--------|-----------|----------|-----------|-------|
| `src/models/contactNote/` | 75.4% | 59.38% | 74.6% | Good overall coverage |
| - contactData.ts | 73.21% | 40.32% | 77.77% | Some edge cases uncovered |
| - contactNote.ts | 62.23% | 50.17% | 60.86% | Complex integration logic |
| - syncOperations.ts | **96.33%** | 90.47% | 100% | Recently improved |
| - markdownOperations.ts | **96.77%** | 87.5% | 100% | Recently improved |
| - relationshipOperations.ts | 85.43% | 78.94% | 92.85% | Good coverage |

**Analysis**: ContactNote module has solid coverage with recent improvements to sync and markdown operations. The lower branch coverage in contactData.ts is due to complex conditional logic that is partially covered by integration tests.

### Low/Excluded Coverage (0-50%)

| Module | Coverage | Exclusion Reason |
|--------|----------|------------------|
| `src/main.ts` | 0% | Plugin lifecycle - requires Obsidian runtime |
| `src/plugin/settings.ts` | 0% | Settings UI - requires Obsidian DOM APIs |
| `src/plugin/services/syncWatcher.ts` | 0% | File watcher - requires file system and runtime |
| `src/plugin/ui/avatarActions.ts` | 0% | Browser Image/Canvas APIs |
| `src/plugin/ui/fileOperations.ts` | 0% | Browser file picker APIs |
| `src/plugin/ui/FolderSuggest.ts` | 0% | Obsidian UI components |
| `src/plugin/services/dropHandler.ts` | 69.84% | Partially testable, some DOM interactions |

**Analysis**: These modules are intentionally excluded from coverage as they depend on:
- Obsidian plugin runtime environment
- Browser DOM APIs (file picker, canvas, etc.)
- File system operations
- User interaction flows

All excluded modules are marked with `/* istanbul ignore next */` comments.

## Test Organization

```
tests/
├── units/              # Unit tests (662 tests)
│   ├── models/         # Model layer tests
│   ├── curators/       # Curator processor tests
│   ├── services/       # Service layer tests
│   └── context.spec.ts # Context provider tests
├── stories/            # Integration tests (user stories)
├── fixtures/           # Shared test data
└── setup/              # Test configuration
```

## Recent Improvements

### December 2024 Coverage Implementation

1. **ContactNote syncOperations.ts**
   - Before: 53.21% → After: 96.33%
   - Added 20 comprehensive tests
   - Covers bidirectional sync, validation, error handling

2. **ContactNote markdownOperations.ts**
   - Before: 62.36% → After: 96.77%
   - Added 20 tests for rendering and section management
   - Covers gender-aware relationships, field sorting

3. **VcardManager vcardManager.ts**
   - Before: 56.3% → After: 73.1%
   - Added 8 tests for folder scanning
   - Covers file filtering and change detection

4. **Plugin Context sharedSettingsContext.ts**
   - Before: 70.58% → After: 100%
   - Added 2 tests for updateSettings
   - Complete coverage of context API

**Overall Impact**: +4.62% statement coverage, +4.63% branch coverage

## Coverage Maintenance

### Running Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open docs/coverage/index.html
```

### Coverage Targets

- **Critical Modules** (contactManager, vcardFile, curatorManager): 85%+
- **Business Logic** (contactNote, vcardManager): 70%+
- **Utilities and Helpers**: 80%+
- **UI and Runtime Code**: Excluded

### Adding New Code

When adding new code:

1. Write tests alongside implementation
2. Target 80%+ coverage for new modules
3. Update this document if adding new modules
4. Mark runtime-dependent code with `/* istanbul ignore next */`

## Test Quality Standards

### What We Test

✅ **Business Logic**
- Contact CRUD operations
- VCF parsing and generation
- Relationship synchronization
- Data validation and consistency
- Curator processors

✅ **Edge Cases**
- Empty/null values
- Malformed data
- Error conditions
- Boundary conditions

✅ **Integration Points**
- Module interactions
- Data flow between components
- Cache consistency

### What We Don't Test

❌ **Runtime Dependencies**
- Plugin lifecycle events
- Obsidian API calls
- File system operations
- Browser DOM manipulation
- User interactions

❌ **Implementation Details**
- Private method internals
- Performance optimizations
- Exact error messages

## Continuous Improvement

### Next Steps for Coverage

1. **ContactNote.ts Core Module** (62.23%)
   - Add tests for complex relationship scenarios
   - Cover remaining edge cases in file operations

2. **ContactData.ts** (73.21%, low branch coverage)
   - Add tests for conditional paths
   - Cover error handling scenarios

3. **DropHandler.ts** (69.84%)
   - Add more tests for VCF file handling
   - Cover edge cases in file processing

### Contributing

When contributing code:

1. Maintain or improve module coverage
2. Write tests for new features before implementation (TDD)
3. Update coverage documentation when adding modules
4. Review coverage report in CI/CD pipeline

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Istanbul Coverage](https://istanbul.js.org/)
- [Testing Best Practices](./development.md#testing-and-code-quality)

---

**Note**: Coverage is a tool for finding untested code, not a guarantee of correctness. High coverage with poor test quality is less valuable than lower coverage with thorough, meaningful tests. Focus on testing behavior and edge cases, not just achieving percentage targets.
