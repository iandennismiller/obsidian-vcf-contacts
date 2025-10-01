# Regression Tests

This directory contains regression tests for bugs that have been fixed in the codebase. Each test file corresponds to a specific issue that was identified and resolved.

## Purpose

Regression tests ensure that once a bug is fixed, it doesn't resurface in future changes. These tests:
- Document the original bug and its fix
- Verify the fix remains in place
- Serve as living documentation of known issues and their resolutions

## Test Files

### issue1-plugin-context.spec.ts
**Bug**: Settings context was never initialized during plugin load  
**Error**: "Plugin context has not been set"  
**Fixed in**: commit 9c7b558  
**Tests**:
- Settings context initialization
- Context retrieval after initialization
- Context clearing
- Error handling when context not set

### issue2-uid-resolution.spec.ts
**Bug**: RelatedListProcessor only checked name-based matches, missing UID-based relationships  
**Error**: Incorrectly reporting "No curator actions needed" when relationships existed in different formats  
**Fixed in**: commit d754219  
**Tests**:
- UID resolution logic in RelatedListProcessor
- UUID type handling in both processors
- Proper iteration and comparison logic

### issue3-curator-processors-disabled.spec.ts
**Bug**: Curator processors were always disabled due to initialization order  
**Error**: Processors never ran because settings were undefined  
**Fixed in**: commit 252a88b  
**Tests**:
- Curator settings present in DEFAULT_SETTINGS
- All processor settings default to true
- Settings are properly initialized at module load time

### issue4-related-other-processor.spec.ts
**Bug**: RelatedOtherProcessor created relationship values without required "name:" prefix  
**Error**: "t.startsWith is not a function"  
**Fixed in**: commit a2b40a5  
**Tests**:
- Proper formatting with "name:" prefix
- Processor configuration
- Process function structure

### issue5-non-string-related-values.spec.ts
**Bug**: parseFrontmatterRelationships cast values to strings without type checking  
**Error**: "t.startsWith is not a function" when RELATED fields contained non-string values  
**Fixed in**: commit afe1f75  
**Tests**:
- Type guards before string operations
- Removal of unsafe type casts
- Informative warning messages

## Running Regression Tests

Run all regression tests:
```bash
npm test tests/regressions
```

Run a specific regression test:
```bash
npm test tests/regressions/issue1-plugin-context.spec.ts
```

## Adding New Regression Tests

When fixing a bug:
1. Create a new test file: `issueN-description.spec.ts`
2. Document the bug, error, and fix commit
3. Write tests that verify the fix remains in place
4. Update this README with the new test information
