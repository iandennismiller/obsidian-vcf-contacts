# Documentation Review - Phase 1: Specifications Cleanup

## Overview

This plan addresses the inconsistencies between the project specifications and the actual implementation, particularly regarding the use of third-party libraries and key notation formats.

## Problem Statement

The repository has evolved significantly with the integration of third-party libraries (vcard4, flat, marked, yaml), but the documentation has not kept pace. This creates confusion about:

1. Which behaviors are handled by libraries vs. custom code
2. The correct key notation format for RELATED fields
3. Redundant implementation details that are actually delegated to libraries

## Key Findings

### Critical Issue: Bracket Notation vs. Dot Notation

**Problem**: Specifications claim RELATED fields use dot notation (`RELATED.friend`), but the actual code uses bracket notation (`RELATED[friend]`).

**Evidence**:
- Source code in `src/models/contactNote/relationshipOperations.ts` uses `RELATED[type]` format
- Source code in `src/models/contactNote/syncOperations.ts` uses `RELATED[index:type]` format
- Tests in `tests/` directory use `RELATED[type]` format
- Demo data in `docs/demo-data/` may use various formats

**Root Cause**: The `flat` library is used for most fields (N, ADR, TEL, EMAIL) which creates dot notation like `N.GN`, `ADR.HOME.STREET`. However, RELATED fields use a custom implementation with bracket notation for compatibility with vCard TYPE parameters.

### Library Usage Analysis

#### ✅ Correctly Used Libraries

1. **vcard4** (`src/models/vcardFile/parsing.ts`, `generation.ts`)
   - Handles all VCF parsing and generation
   - Correctly documented in library-integration-spec.md

2. **flat** (`src/models/vcardFile/parsing.ts`, `generation.ts`)
   - Converts dot notation to nested objects for N, ADR, TEL, EMAIL, URL fields
   - Does NOT handle RELATED fields (custom implementation)
   - Partially incorrectly documented (claims to handle RELATED)

3. **marked** (`src/models/contactNote/relationshipOperations.ts`, `contactSectionOperations.ts`, `baseMarkdownSectionOperations.ts`)
   - Parses markdown structure for Related and Contact sections
   - Correctly documented in library-integration-spec.md and contact-section-spec.md

4. **yaml** (via Obsidian's parseYaml/stringifyYaml in `src/models/contactNote/contactData.ts`, `markdownOperations.ts`)
   - Handles frontmatter YAML parsing
   - Correctly documented in library-integration-spec.md

## Specifications to Update

### 1. library-integration-spec.md

**Issues**:
- Claims flat library handles RELATED fields with dot notation - INCORRECT
- Suggests arrays use numeric indices like `RELATED.friend.0` - INCORRECT

**Fixes Needed**:
- Remove claims about flat handling RELATED fields
- Clarify that flat is only used for N, ADR, TEL, EMAIL, URL fields
- Add note that RELATED uses custom bracket notation

### 2. relationship-management-spec.md

**Issues**:
- Line 114: "The flat library automatically handles array indexing using dot notation"
- Line 114: Examples show `RELATED.friend.0`, `RELATED.friend.1` - INCORRECT
- Throughout: Uses dot notation examples

**Fixes Needed**:
- Replace all `RELATED.type` with `RELATED[type]`
- Replace array examples: `RELATED.friend.0` → `RELATED[friend]`, `RELATED[1:friend]`
- Remove or correct references to flat library handling RELATED fields
- Document actual bracket notation format

### 3. contact-section-spec.md

**Issues**:
- Lines 290-317: Shows incorrect frontmatter mapping with dot notation
- Example: `EMAIL.WORK` should be `EMAIL[WORK]` (or keep dot notation for EMAIL but fix RELATED examples if present)
- Frontmatter examples mix correct and incorrect notation

**Fixes Needed**:
- Verify which fields actually use dot notation (N, ADR) vs bracket notation (with TYPE parameters)
- The actual implementation shows EMAIL and TEL can use both dot notation (via flat) AND bracket notation
- Clarify the dual notation support

### 4. vcard-format-spec.md

**Issues**:
- Lines showing RELATED field examples use dot notation
- Line 48: `RELATED.colleague: urn:uuid:jane-smith-uuid-here` - INCORRECT
- Lines 150, 235-238: More dot notation examples for RELATED
- Lines 257-262: Shows `RELATED.friend.0`, `RELATED.friend.1` - INCORRECT

**Fixes Needed**:
- Replace all RELATED dot notation with bracket notation
- Update all examples to use `RELATED[type]` format
- Update array examples to use `RELATED[type]`, `RELATED[1:type]` format
- Keep dot notation for N and ADR fields (correctly handled by flat)

### 5. Remove Redundant Implementation Details

Each spec currently describes low-level implementation details that are actually handled by the libraries. We should:

1. **Reference library behavior** instead of duplicating it
2. **Focus on integration points** between the plugin and libraries
3. **Document custom logic only** where the plugin adds unique behavior

**Example - Current (Redundant)**:
```markdown
The parser validates email format using regex pattern...
The parser normalizes phone numbers by removing formatting...
```

**Desired (Library-Focused)**:
```markdown
Email and phone validation is handled by the vcard4 library according to RFC 6350.
The plugin focuses on extracting these fields from markdown and syncing to frontmatter.
```

## Implementation Plan

### Phase 1.1: Create Comprehensive Plan (This Document)
- [x] Document findings
- [x] Identify all specification files needing updates
- [x] List specific issues and proposed fixes

### Phase 1.2: Fix library-integration-spec.md
- [ ] Remove incorrect flat library claims about RELATED fields
- [ ] Clarify flat is used for N, ADR, TEL, EMAIL, URL fields only
- [ ] Add section explaining bracket notation for RELATED

### Phase 1.3: Fix relationship-management-spec.md
- [ ] Replace all `RELATED.type` with `RELATED[type]`
- [ ] Fix array indexing examples from dot to bracket notation
- [ ] Remove/correct flat library references for RELATED
- [ ] Add technical note about custom bracket notation implementation

### Phase 1.4: Fix contact-section-spec.md
- [ ] Review and clarify field notation (dot vs bracket)
- [ ] Update frontmatter mapping examples
- [ ] Ensure consistency with actual implementation

### Phase 1.5: Fix vcard-format-spec.md
- [ ] Replace all RELATED dot notation examples
- [ ] Update to bracket notation throughout
- [ ] Keep dot notation for N and ADR (correct usage)

### Phase 1.6: Remove Redundant Details
- [ ] Review each spec for library-duplicated content
- [ ] Refocus on integration points and custom logic
- [ ] Simplify where possible

## Success Criteria

1. All RELATED field examples use bracket notation consistently
2. Specifications accurately describe which library handles which functionality
3. No redundant documentation of library-internal behavior
4. Clear distinction between library-handled and custom logic
5. Specifications align with actual source code implementation

## Related Issues

- Tests using old bracket notation with malformed RELATED.type keys
- Demo data may need review for consistency
- User-facing documentation (docs/) may need similar updates in Phase 2

## Notes

- The bracket notation `RELATED[type]` is actually YAML-compatible when quoted: `"RELATED[type]": value`
- This format maps cleanly to vCard TYPE parameters: `RELATED;TYPE=type:value`
- The dot notation would not work for this mapping without custom parsing
- The indexed format `RELATED[0:type]` handles multiple relationships of the same type
