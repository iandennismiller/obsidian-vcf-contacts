# Project Plans Summary

## Active Plans

### 1. ContactNote Model Refactoring 📋 PLANNING
**File**: `contactnote-model-refactoring.md`  
**Status**: Analysis and Planning Phase  
**Goal**: Refactor ContactNote from functional/operations-based to model-based architecture

**Key Documents**:
- `contactnote-model-refactoring.md` - Comprehensive refactoring plan
- `contactnote-refactoring-examples.md` - Code examples comparing approaches
- `contactnote-architecture-diagrams.md` - Architecture diagrams and visualizations

**Objective**: Transform ContactNote from organizing code by operations (RelationshipOperations, SyncOperations, etc.) to organizing code by domain entities (Relationship, ContactField, Contact, etc.).

**Current State**:
- ✅ Comprehensive analysis of existing structure completed
- ✅ Identified 8 core domain entities
- ✅ Designed proposed model-based architecture
- ✅ Created migration strategy with 5 phases
- [ ] Stakeholder review pending
- [ ] Prototype implementation pending

**Benefits**:
- Better code organization around "things" not "operations"
- Easier testing (test entities directly, not through operations)
- Clearer entity lifecycle and behavior
- Better extensibility (add features to entities)
- Self-documenting structure (one file per entity)

### 2. Frontmatter YAML Migration ✅ COMPLETE
**File**: `frontmatter-yaml-migration.md`  
**Status**: All 3 Phases Complete  
**Goal**: Eliminate manual regex parsing of frontmatter in favor of the YAML library

**Key Finding**: Production code already uses YAML correctly! The opportunity was in simplifying test code.

**Completed Work**:
- ✅ Phase 1: Comprehensive analysis and planning
- ✅ Phase 2: Replaced 15 instances of manual parsing (~195 line reduction)
- ✅ Phase 3: Updated documentation and added library references

**Results**:
- Simplified test code from ~250 lines of regex to ~15 lines using `parseYaml()`
- Enhanced specifications with yaml/flat library references
- Added JSDoc comments explaining library usage in source code
- All tests now use same robust parsing as production code

### 3. Documentation Dot Notation Update ✅ COMPLETE
**File**: `documentation-dot-notation-update.md`  
**Status**: Complete  
**Goal**: Update all documentation to use YAML-compatible dot notation

## Overview

This directory contains implementation plans for multi-phase projects and migrations.

## Frontmatter Strategy

The project uses a **YAML-first approach** for frontmatter handling:

1. **Libraries Used**:
   - `yaml` (v2.8.1): Parse and stringify YAML content
   - `flat` (v6.0.1): Flatten/unflatten objects with dot notation

2. **Current Pattern** (Production Code):
   ```typescript
   // ✅ CORRECT: Extract YAML block with regex, parse with yaml library
   const match = content.match(/^---\n([\s\S]*?)\n---/);
   const frontmatter = parseYaml(match[1]) ?? {};
   
   // ✅ CORRECT: Generate frontmatter with yaml library
   const yaml = stringifyYaml(frontmatter);
   const newContent = `---\n${yaml}---\n${body}`;
   ```

3. **Dot Notation** (Standard):
   - Use `RELATED.spouse` instead of `RELATED[spouse]`
   - Use `EMAIL.WORK` instead of `EMAIL[WORK]`
   - The `flat` library handles this automatically

4. **Migration Goal**:
   - Source code: ✅ Already using YAML library correctly
   - Test code: ❌ Still has manual parsing → needs migration to `parseYaml()`

See `frontmatter-yaml-migration.md` for detailed analysis.

## What Changed

### Old Notation (Bracket Style - DEPRECATED)
```yaml
RELATED[spouse]: urn:uuid:12345...
RELATED[child]: urn:uuid:aaaaa...
RELATED[1:child]: urn:uuid:bbbbb...
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
ADR[HOME].STREET: 123 Main St
```

### New Notation (Dot Style - CURRENT)
```yaml
RELATED.spouse: urn:uuid:12345...
RELATED.child.0: urn:uuid:aaaaa...
RELATED.child.1: urn:uuid:bbbbb...
EMAIL.WORK: john@work.com
TEL.CELL: +1-555-1234
ADR.HOME.STREET: 123 Main St
```

## Why This Matters

1. **Standards Compliance**: Dot notation is the standard YAML approach for nested structures
2. **Library Compatibility**: The `yaml` and `flat` libraries naturally support dot notation
3. **Consistency**: All demo data files already use dot notation
4. **User Experience**: Users see documentation that matches the actual frontmatter format

## Files Updated

### Specifications (`project/specifications/`)
- ✅ `relationship-management.md` - Array indexing examples
- ✅ `contact-section.md` - All field examples and parsing documentation
- ✅ `vcf-sync.md` - Field mapping examples
- ✅ `gender-processing.md` - Relationship examples
- ✅ `vcard-format.md` - RELATED field table and examples

### User Documentation (`docs/`)
- ✅ `docs/demo-data/README.md` - Examples in feature documentation
- ✅ `docs/development/setup.md` - Code examples

### Planning Documents (`project/plans/`)
- ✅ `documentation-dot-notation-update.md` - This update's planning and tracking

## Verification

### Automated Checks
```bash
# No bracket notation in specifications
grep -r "RELATED\[" project/specifications --include="*.md" | wc -l
# Result: 0

# No bracket notation in user docs
grep -r "RELATED\[" docs --include="*.md" | wc -l
# Result: 0

# Library references present
grep -i "flat library\|vcard4 library\|yaml library\|marked library" project/specifications/*.md | wc -l
# Result: 21+
```

### Manual Verification
- ✅ All RELATED examples use dot notation (RELATED.friend.0)
- ✅ All EMAIL examples use dot notation (EMAIL.WORK)
- ✅ All TEL examples use dot notation (TEL.CELL)
- ✅ All ADR examples use dot notation (ADR.HOME.STREET)
- ✅ All specifications reference appropriate libraries
- ✅ Demo data files confirm the format is correct

## Benefits

1. **Reduced Confusion**: Single notation style throughout documentation
2. **Better Onboarding**: New users see consistent examples
3. **Library Alignment**: Documentation reflects library capabilities
4. **Maintainability**: Specs reference library behavior, not implementation details

## Library References

The documentation now properly attributes functionality to these libraries:

- **yaml** (v2.8.1): YAML parsing and generation with dot notation support
- **flat** (v6.0.1): Object flattening/unflattening for nested structures
- **vcard4** (v4.0.2): vCard 4.0 parsing and generation (RFC 6350 compliant)
- **marked** (v12.0.0): Markdown parsing for Related and Contact sections

## Testing Recommendations

While this PR focused on documentation, implementers should verify:
1. The code properly uses dot notation when generating frontmatter
2. The yaml library's stringify function is used for frontmatter generation
3. The flat library handles array indexing automatically
4. No manual bracket notation generation remains in the codebase

## Future Work

The code analysis (documented in the planning file) revealed that some implementation code still generates bracket notation. A future PR could:
1. Update `syncOperations.ts` to use dot notation
2. Remove bracket notation generation from `relationshipOperations.ts`
3. Let the yaml/flat libraries handle all key formatting naturally

However, this documentation update provides the foundation by establishing the correct notation standard.
