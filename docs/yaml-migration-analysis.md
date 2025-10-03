# YAML Library Migration Analysis

## Executive Summary

This document analyzes the codebase to identify methods, classes, and tests that can be replaced or removed when migrating to the [yaml](https://www.npmjs.com/package/yaml) library for YAML parsing and generation operations.

**Status:** Planning Stage - No Implementation Yet  
**Date:** January 2025

---

## Current State: YAML Operations in `/src/models`

### 1. Primary YAML Usage: `ContactData` Class

**Location:** `/src/models/contactNote/contactData.ts` (367 lines)

#### Methods Using Obsidian's YAML Functions

##### `getFrontmatter()` - Lines 78-119
**Current Implementation:**
```typescript
async getFrontmatter(): Promise<Record<string, any> | null> {
  // Try metadata cache first
  const cache = this.app.metadataCache.getFileCache(this.file);
  if (cache?.frontmatter) {
    this._frontmatter = cache.frontmatter;
    return this._frontmatter;
  }
  
  // Fallback: parse from content
  const content = await this.getContent();
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    this._frontmatter = parseYaml(match[1]) || {};  // ← Uses Obsidian's parseYaml
  }
  return this._frontmatter;
}
```

**Can Be Replaced:** ✅ YES
- Replace `parseYaml(match[1])` with `parse(match[1])` from yaml library
- Keep metadata cache optimization for performance
- Keep fallback pattern for reliability

**Refactoring Opportunity:**
- Simplify error handling with yaml library's built-in error messages
- Remove `|| {}` fallback since yaml library handles empty/null better

---

##### `saveFrontmatter()` - Lines 202-255
**Current Implementation:**
```typescript
private async saveFrontmatter(frontmatter: Record<string, any>): Promise<void> {
  // Separate RELATED fields from other frontmatter
  const relatedFields: Record<string, any> = {};
  const otherFields: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key.startsWith('RELATED')) {
      relatedFields[key] = value;
    } else {
      otherFields[key] = value;
    }
  }
  
  // Use Obsidian's stringifyYaml for non-RELATED fields
  let frontmatterYaml = stringifyYaml(otherFields);  // ← Uses Obsidian's stringifyYaml
  
  // Manually add RELATED fields with properly quoted keys
  for (const [key, value] of Object.entries(relatedFields)) {
    const quotedKey = key.includes('[') && key.includes(']') ? `"${key}"` : key;
    frontmatterYaml += `${quotedKey}: ${value}\n`;
  }
  
  // ... update content with new frontmatter
}
```

**Can Be Replaced:** ✅ YES
- Replace `stringifyYaml(otherFields)` with `stringify(frontmatter)` from yaml library
- **REMOVE** manual RELATED field handling - yaml library handles bracket keys correctly
- **REMOVE** manual key quoting logic
- **REMOVE** field separation logic

**Major Simplification:**
```typescript
// After migration - MUCH SIMPLER
private async saveFrontmatter(frontmatter: Record<string, any>): Promise<void> {
  const frontmatterYaml = stringify(frontmatter);
  // ... update content with new frontmatter
}
```

**Lines Removed:** ~30 lines of complex logic

---

##### `updateFrontmatterValue()` - Lines 124-148
**Current Implementation:**
```typescript
async updateFrontmatterValue(key: string, value: string, skipRevUpdate = false): Promise<void> {
  const frontmatter = await this.getFrontmatter();
  if (!frontmatter) return;

  // Update the value
  frontmatter[key] = value;

  // Update REV if not skipped
  if (!skipRevUpdate) {
    frontmatter.REV = this.generateRevTimestamp();
  }

  await this.saveFrontmatter(frontmatter);
}
```

**Can Be Replaced:** ✅ PARTIAL
- Method logic stays the same
- Benefits from simplified `saveFrontmatter()` using yaml library
- No direct changes needed to this method

---

##### `removeFrontmatterValue()` - Lines 150-198
**Current Implementation:**
```typescript
async removeFrontmatterValue(key: string, skipRevUpdate = false): Promise<void> {
  const frontmatter = await this.getFrontmatter();
  if (!frontmatter) return;

  const hasKey = key in frontmatter;
  const relatedKeys = Object.keys(frontmatter).filter(k => k.startsWith('RELATED'));
  
  // ... complex logic to handle RELATED fields
  
  if (changed) {
    await this.saveFrontmatter(frontmatter);
  }
}
```

**Can Be Replaced:** ✅ PARTIAL
- Method logic stays the same
- Benefits from simplified `saveFrontmatter()` using yaml library
- Complex RELATED handling stays (it's business logic, not YAML parsing)

---

### 2. Secondary YAML Usage: `MarkdownOperations` Class

**Location:** `/src/models/contactNote/markdownOperations.ts`

#### Methods Using Obsidian's YAML Functions

##### `mdRender()` - Line 55
**Current Implementation:**
```typescript
return `---\n${stringifyYaml(frontmatter)}---\n${HEADING_LEVELS.SUBSECTION} ${SECTION_NAMES.NOTES}\n...`;
```

**Can Be Replaced:** ✅ YES
- Replace `stringifyYaml(frontmatter)` with `stringify(frontmatter)` from yaml library
- One-line change

---

### 3. Custom YAML Utility: `parseKey()` Function

**Location:** `/src/models/contactNote/utilityFunctions.ts` - Lines 14-42

**Current Implementation:**
```typescript
export function parseKey(key: string): ParsedKey {
  const match = key.match(/^([^.[]+)(?:\[([^\]]*)\])?(?:\.(.+))?$/);
  if (!match) {
    return { key };
  }

  const [, baseKey, indexOrType, subkey] = match;
  
  // Check if the bracket contains a number (index) or type
  let index: string | undefined;
  let type: string | undefined;
  
  if (indexOrType) {
    if (indexOrType.includes(':')) {
      [index, type] = indexOrType.split(':', 2);
    } else if (/^\d+$/.test(indexOrType)) {
      index = indexOrType;
    } else {
      type = indexOrType;
    }
  }

  return {
    key: baseKey,
    index,
    type,
    subkey
  };
}
```

**Can Be Replaced:** ❌ NO - KEEP THIS
- This is **NOT** YAML parsing - it's custom key format interpretation
- Handles custom bracket notation: `RELATED[friend]`, `RELATED[1:friend]`
- Handles dotted subfields: `ADR[HOME].STREET`, `N.GN`
- Required for Obsidian's flat frontmatter constraint
- Used extensively throughout the codebase

**Usage:** 
- Used by relationship operations to parse RELATED keys
- Used by vCard conversion to parse structured fields
- Part of domain logic, not YAML parsing

---

## Refactoring Opportunities

### Opportunity 1: Simplify `ContactData.saveFrontmatter()`

**Current Complexity:** 54 lines (lines 202-255)  
**After Migration:** ~15-20 lines  
**Lines Removed:** ~30-35 lines

**What Can Be Removed:**
1. ❌ RELATED field separation logic (lines 206-216)
2. ❌ Manual key quoting for brackets (lines 227-230)
3. ❌ Manual field concatenation (lines 226-231)
4. ❌ Complex newline handling (lines 222-236)

**Why:** The yaml library natively handles:
- Keys with brackets without needing quotes
- Proper escaping and quoting automatically
- Correct YAML formatting and newlines

---

### Opportunity 2: Remove Obsidian YAML Dependency

**Current Imports:**
```typescript
import { TFile, App, parseYaml, stringifyYaml } from 'obsidian';
```

**After Migration:**
```typescript
import { TFile, App } from 'obsidian';
import { parse, stringify } from 'yaml';
```

**Files Affected:**
- `/src/models/contactNote/contactData.ts`
- `/src/models/contactNote/markdownOperations.ts`

---

### Opportunity 3: No Class Merging or Removal

**Analysis:** After reviewing the codebase:
- ✅ `ContactData` class should **REMAIN** - it's not just YAML parsing, it's contact data management with caching
- ✅ `parseKey()` function should **REMAIN** - it's custom key interpretation, not YAML parsing
- ✅ No classes can be merged as a result of YAML migration
- ✅ No methods can be completely removed (only simplified)

---

## Test Refactoring Opportunities

### Tests That Can Be Removed

#### 1. Manual YAML Parsing Tests

**Location:** Multiple test files with `extractFrontmatter()` helper functions

##### Test Helper: `extractFrontmatter()` in Integration Tests

**File:** `/tests/stories/curatorPipelineIntegration.spec.ts` - Lines 119-146

**Current Implementation:**
```typescript
function extractFrontmatter(content: string): Record<string, any> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};

  const yaml = frontmatterMatch[1];
  const frontmatter: any = {};
  const lines = yaml.split('\n');
  lines.forEach(line => {
    // Match quoted keys with brackets: "key": value
    const quotedMatch = line.match(/^"([^"]+)":\s*(.+)$/);
    if (quotedMatch) {
      const key = quotedMatch[1].trim();
      const value = quotedMatch[2].trim();
      frontmatter[key] = value;
      return;
    }
    
    // Fallback for unquoted keys: key: value
    const unquotedMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (unquotedMatch) {
      const key = unquotedMatch[1].trim();
      const value = unquotedMatch[2].trim();
      frontmatter[key] = value;
    }
  });
  return frontmatter;
}
```

**Can Be Replaced:** ✅ YES
- Replace entire function with 3 lines using yaml library:
```typescript
function extractFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? parse(match[1]) : {};
}
```

**Impact:**
- Lines removed: ~25 lines per test file
- Files affected: 2 files (`curatorPipelineIntegration.spec.ts`, `consistencyOperations.spec.ts`)
- Total lines removed: ~50 lines
- Test reliability improved (no manual parsing edge cases)

---

##### Test Helper: Manual Parsing in Demo Data Tests

**File:** `/tests/demo-data/markdown-parsing.spec.ts` - Lines 34-74

**Current Implementation:**
```typescript
it('should parse frontmatter from all demo markdown files', async () => {
  for (const filename of markdownFiles) {
    const filePath = path.join(demoMarkdownPath, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch).toBeTruthy();
    
    const frontmatterLines = frontmatterMatch![1].split('\n');
    const frontmatter: Record<string, any> = {};
    
    // Parse YAML-like frontmatter manually for test
    frontmatterLines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        
        // Handle quoted values
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        frontmatter[key] = value;
      }
    });
    
    // Verify parsed data...
  }
});
```

**Can Be Replaced:** ✅ YES
- Replace manual parsing with yaml library:
```typescript
it('should parse frontmatter from all demo markdown files', async () => {
  for (const filename of markdownFiles) {
    const filePath = path.join(demoMarkdownPath, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    expect(match).toBeTruthy();
    
    const frontmatter = parse(match![1]);
    
    // Verify parsed data...
  }
});
```

**Impact:**
- Lines removed: ~25 lines
- Test reliability improved
- No edge case handling needed

---

#### 2. YAML Edge Case Tests That Can Be Removed

**Analysis:** After reviewing tests, the following observations:

1. **No dedicated YAML parsing edge case tests found** ✅
   - The codebase doesn't have tests specifically for YAML edge cases
   - Manual parsing in test helpers is for convenience, not testing YAML parsing
   - All edge case handling would be delegated to yaml library

2. **`parseKey()` tests MUST REMAIN** ❌
   - These test custom key format interpretation (brackets, dots)
   - NOT YAML parsing tests
   - Examples:
     - `/tests/demo-data/markdown-parsing.spec.ts` - Lines 131-171 (parseKey tests)
     - `/tests/units/models/contactNote/contactNote.spec.ts` - Lines 927-960 (parseKey tests)

---

### Tests to Update (Not Remove)

#### Test Helper Usage

**Files with `extractFrontmatter()` helper:**
1. `/tests/stories/curatorPipelineIntegration.spec.ts` (20+ usages)
2. `/tests/units/models/contactManager/consistencyOperations.spec.ts` (5 usages)

**Action:** Replace helper function implementation, keep all tests using it

**Files with inline manual parsing:**
1. `/tests/demo-data/markdown-parsing.spec.ts` (1 test)

**Action:** Replace manual parsing with yaml library call

---

## Migration Impact Summary

### Code Changes

| File | Current Lines | Lines Removed | Lines Added | Net Change |
|------|---------------|---------------|-------------|------------|
| `contactData.ts` | 367 | ~35 | ~5 | -30 |
| `markdownOperations.ts` | ~200 | 1 | 1 | 0 |
| **Total** | **~567** | **~36** | **~6** | **-30** |

### Test Changes

| File | Current Lines | Lines Removed | Lines Added | Net Change |
|------|---------------|---------------|-------------|------------|
| `curatorPipelineIntegration.spec.ts` | ~850 | ~25 | ~3 | -22 |
| `consistencyOperations.spec.ts` | ~400 | ~25 | ~3 | -22 |
| `markdown-parsing.spec.ts` | ~200 | ~25 | ~3 | -22 |
| **Total** | **~1450** | **~75** | **~9** | **-66** |

### Overall Impact

- **Total lines removed:** ~111 lines
- **Total lines added:** ~15 lines
- **Net reduction:** ~96 lines
- **Complexity reduction:** Significant (removes manual YAML parsing, quoting logic, field separation)
- **Test reliability:** Improved (delegates edge cases to yaml library)

---

## What Will NOT Change

### 1. `parseKey()` Function - MUST REMAIN

**Why:**
- Not YAML parsing - it's custom key format interpretation
- Handles Obsidian-specific flat frontmatter constraint
- Parses custom bracket notation: `RELATED[friend]`, `RELATED[1:friend]`
- Parses dotted subfields: `ADR[HOME].STREET`, `N.GN`
- Core business logic for vCard field mapping

### 2. Custom Indexing Logic - MUST REMAIN

**Why:**
- Obsidian requires flat frontmatter (no nested objects)
- Custom indexing pattern required: `RELATED[friend]`, `RELATED[1:friend]`
- yaml library parses these as flat keys (correct)
- Custom code still needed to generate and interpret the pattern

### 3. All Business Logic Methods - REMAIN UNCHANGED

**Methods that stay:**
- `updateFrontmatterValue()` - business logic, not YAML parsing
- `removeFrontmatterValue()` - business logic, not YAML parsing
- All relationship operations - domain logic
- All vCard conversion operations - domain logic

---

## Recommendations

### Phase 1: Replace YAML Operations

1. ✅ Add yaml library to package.json: `npm install yaml`
2. ✅ Replace `parseYaml()` with `parse()` in `contactData.ts`
3. ✅ Replace `stringifyYaml()` with `stringify()` in `contactData.ts`
4. ✅ Replace `stringifyYaml()` with `stringify()` in `markdownOperations.ts`
5. ✅ Update imports to use yaml library

### Phase 2: Simplify `saveFrontmatter()`

1. ✅ Remove RELATED field separation logic
2. ✅ Remove manual key quoting logic
3. ✅ Remove manual field concatenation
4. ✅ Simplify to single `stringify()` call
5. ✅ Test with existing test suite

### Phase 3: Update Test Helpers

1. ✅ Replace `extractFrontmatter()` in `curatorPipelineIntegration.spec.ts`
2. ✅ Replace `extractFrontmatter()` in `consistencyOperations.spec.ts`
3. ✅ Replace manual parsing in `markdown-parsing.spec.ts`
4. ✅ Verify all tests still pass

### Phase 4: Cleanup

1. ✅ Remove unused manual parsing code
2. ✅ Update documentation
3. ✅ Add migration notes to changelog

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking frontmatter format | Low | High | Extensive testing with demo data |
| yaml library parse differences | Low | Medium | Test edge cases with current data |
| RELATED key quoting changes | Low | Medium | yaml handles brackets natively |
| Performance regression | Very Low | Low | yaml library is performant |

---

## Success Criteria

- ✅ All existing tests pass with yaml library
- ✅ Demo data files parse correctly
- ✅ Frontmatter format unchanged for users
- ✅ RELATED keys still work with brackets
- ✅ No performance regression
- ✅ Code complexity reduced
- ✅ Test code simplified

---

## Questions for Review

1. ✅ Should we keep metadata cache optimization in `getFrontmatter()`?
   - **Recommendation:** Yes, keep for performance
   
2. ✅ Should we validate yaml library handles bracket keys correctly?
   - **Recommendation:** Yes, test before migration
   
3. ✅ Should we add yaml library error handling?
   - **Recommendation:** Yes, yaml has better error messages than Obsidian's parseYaml

---

## Conclusion

The migration to yaml library will:
- **Reduce code complexity** by ~96 lines
- **Simplify** `saveFrontmatter()` from 54 to ~20 lines
- **Improve test reliability** by using standard library
- **Maintain compatibility** with existing frontmatter format
- **Preserve all business logic** (parseKey, custom indexing)
- **NOT require** class merging or removal

The migration is **low risk** with **high value** for maintainability.
