# Refactoring Opportunities Summary

This document provides a quick reference for refactoring opportunities identified in the marked library migration analysis.

## Quick Stats

- **Lines of code in /src/models/contactNote:** 4,494
- **Regex operations in contactNote:** ~94
- **Estimated code reduction:** 300-450 lines (6-10%)
- **Estimated test reduction:** 15-20 tests

---

## 1. Methods to Replace with Marked

### High Priority

| Current Method | File | Lines | Replacement |
|---------------|------|-------|-------------|
| `extractMarkdownSections()` | markdownOperations.ts | 205-219 | Use marked.lexer() to extract heading tokens |
| Contact section regex | contactSectionOperations.ts | 130-139 | Use marked tokens to find heading by text |
| Related section regex | relationshipOperations.ts | 36-40 | Use marked tokens to find heading by text |
| `updateMarkdownSection()` | markdownOperations.ts | 224-246 | Use marked to parse, update tokens, re-render |

### Medium Priority

| Current Method | File | Lines | Replacement |
|---------------|------|-------|-------------|
| List parsing in Related section | relationshipOperations.ts | 48-98 | Use marked list tokens, keep wiki-link parsing |
| List parsing in Contact section | contactSectionOperations.ts | 176-220 | Use marked list tokens, keep field detection |
| Line splitting and trimming | Multiple files | Various | Use marked's normalized token text |

### Low Priority (Keep for Now)

| Current Method | File | Reason |
|---------------|------|--------|
| Wiki-link parsing | relationshipOperations.ts | Obsidian-specific, not standard markdown |
| Field pattern detection | fieldPatternDetection.ts | Domain-specific business logic |
| Gender-aware relationship terms | Various | Domain-specific business logic |

---

## 2. Classes to Refactor

### Option A: Consolidate into Single Service

**Create:** `MarkdownParsingService`

**Consolidates:**
- `markdownOperations.ts` - General markdown operations
- Parts of `contactSectionOperations.ts` - Section detection
- Parts of `relationshipOperations.ts` - Section detection

**Keeps Separate:**
- `ContactFieldParser` - Domain-specific contact field parsing
- `RelationshipParser` - Domain-specific relationship parsing
- `fieldPatternDetection.ts` - Pattern detection logic

### Option B: Extract Common Base Class

**Create:** `BaseMarkdownSectionOperations`

**Contains:**
- `extractSection(name: string)` using marked
- `updateSection(name: string, content: string)` using marked
- `getAllSections()` using marked

**Extends:**
- `ContactSectionOperations` - Contact-specific logic
- `RelationshipOperations` - Relationship-specific logic

---

## 3. Constants to Centralize

### Create: `markdownConstants.ts`

```typescript
// Section names
SECTION_NAMES = { NOTES: 'Notes', RELATED: 'Related', CONTACT: 'Contact' }

// Heading levels  
HEADING_LEVELS = { SECTION: '##', SUBSECTION: '####' }

// VCard field types
VCARD_FIELD_TYPES = { EMAIL: 'EMAIL', TEL: 'TEL', URL: 'URL', ADR: 'ADR', ... }

// Field display info
FIELD_DISPLAY = {
  EMAIL: { icon: '📧', name: 'Email' },
  TEL: { icon: '📞', name: 'Phone' },
  ...
}

// Obsidian-specific patterns (NOT handled by marked)
REGEX_PATTERNS = {
  WIKI_LINK: /\[\[([^\]]+)\]\]/,
  RELATIONSHIP_FORMATS: { ... },
  FIELD_FORMATS: { ... }
}
```

### Repeated Strings Found

| String | Occurrences | Files |
|--------|-------------|-------|
| `'## Related\n'` | 3 | markdownOperations.ts, relationshipOperations.ts |
| `'#### Notes\n'` | 2 | markdownOperations.ts |
| `'## Contact'` | 2 | contactSectionOperations.ts |
| `'---\n'` (frontmatter) | 5+ | Multiple files |
| `'EMAIL'`, `'TEL'`, `'URL'`, `'ADR'` | 20+ | Multiple files |
| `/(^|\n)(#{2,})\s*...\s*\n/i` | 3 | Different variations in 3 files |
| `/\[\[([^\]]+)\]\]/` | 4+ | Multiple files |

---

## 4. Tests to Remove/Simplify

### Tests to Remove After Migration

**File:** `markdownOperations.spec.ts`

- [ ] Whitespace handling in section extraction
- [ ] Different heading level variations
- [ ] Line break normalization tests
- [ ] Section boundary detection edge cases

**File:** `contactSectionOperations.spec.ts`

- [ ] List marker variations (`-`, `*`, `1.`)
- [ ] Nested list handling
- [ ] Whitespace in list items

**File:** `relationshipOperations.spec.ts`

- [ ] Heading level detection tests
- [ ] List format variation tests

### Tests to Keep (Domain Logic)

**Keep these - they test business rules, not markdown parsing:**

- [x] Email pattern detection
- [x] Phone number pattern detection
- [x] URL pattern detection
- [x] Wiki-link extraction
- [x] Relationship type parsing
- [x] Gender-aware relationship terms
- [x] VCard field mapping
- [x] Contact field validation

### Test Helpers to Refactor

**File:** `tests/stories/curatorPipelineIntegration.spec.ts`

```typescript
// Lines 120-150: Replace with marked-based extraction
function extractFrontmatter(content: string): Record<string, any>

// Lines 165-181: Replace with marked-based extraction  
function extractRelatedSection(content: string): string[]
```

---

## 5. Specific Regex Patterns to Replace

### Heading Detection (Replace with marked.lexer)

```typescript
// contactSectionOperations.ts:131
/(^|\n)(#{2,})\s*contact\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i

// relationshipOperations.ts:36
/(^|\n)(#{2,})\s*related\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i

// markdownOperations.ts:210
/#### ([^\n]+)\n([\s\S]*?)(?=\n#### |$)/g
```

### Section Content Extraction (Replace with marked.lexer)

```typescript
// Multiple files
/([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/
```

### List Item Detection (Replace with marked.lexer)

```typescript
// relationshipOperations.ts:56-59
/^-\s*(\w+)\s+\[\[([^\]]+)\]\]/  // Keep wiki-link part
/^-\s*([^:]+):\s*\[\[([^\]]+)\]\]/  // Keep wiki-link part
/^-\s*\[\[([^\]]+)\]\]\s*\(([^)]+)\)/  // Keep wiki-link part
/^-\s*([^:]+):\s*(.+)$/  // Keep for plain text fallback

// contactSectionOperations.ts:180-200
/^-?\s*([^:]+):\s*(.+)$/  // Keep for field parsing
/^([A-Za-z]+)\s+(.+)$/  // Keep for field parsing
/^-\s*(.+)$/  // Replace with marked
```

### Patterns to Keep (Obsidian-Specific)

```typescript
// Wiki-links - NOT standard markdown
/\[\[([^\]]+)\]\]/g

// These are domain-specific and can't be replaced by marked:
- Email patterns
- Phone patterns  
- URL patterns
- Field label/value patterns
```

---

## 6. Migration Checklist

### Phase 1: Setup

- [ ] Add marked to package.json dependencies
- [ ] Create `src/models/contactNote/markdownConstants.ts`
- [ ] Create `src/models/contactNote/markedUtils.ts`
- [ ] Write integration tests for marked utilities

### Phase 2: Refactor Core Operations

- [ ] Update `extractMarkdownSections()` in markdownOperations.ts
- [ ] Update section detection in contactSectionOperations.ts
- [ ] Update section detection in relationshipOperations.ts
- [ ] Update `updateMarkdownSection()` in markdownOperations.ts
- [ ] Run tests after each change

### Phase 3: Replace List Parsing

- [ ] Update list parsing in relationshipOperations.ts
- [ ] Update list parsing in contactSectionOperations.ts
- [ ] Keep domain-specific parsing logic
- [ ] Run tests after each change

### Phase 4: Consolidate Constants

- [ ] Move section names to constants
- [ ] Move heading levels to constants
- [ ] Move field types to constants
- [ ] Move repeated regex patterns to constants
- [ ] Update all references

### Phase 5: Update Tests

- [ ] Remove markdown edge case tests
- [ ] Add marked integration tests
- [ ] Update test helpers to use marked
- [ ] Verify all tests pass

### Phase 6: Documentation

- [ ] Update development.md with marked usage
- [ ] Document what marked handles vs. custom parsing
- [ ] Update architecture documentation
- [ ] Add code examples

---

## 7. Quick Reference: What Uses Marked vs. Custom

### Use Marked For:

- ✅ Heading detection and hierarchy
- ✅ List structure parsing (unordered, ordered, nested)
- ✅ Paragraph parsing
- ✅ Whitespace normalization
- ✅ Line break handling
- ✅ Section extraction by heading

### Keep Custom Parsing For:

- ⚠️ Wiki-links `[[Contact Name]]` (Obsidian-specific)
- ⚠️ Email pattern detection (domain logic)
- ⚠️ Phone pattern detection (domain logic)
- ⚠️ URL pattern detection (domain logic)
- ⚠️ Relationship type parsing (domain logic)
- ⚠️ VCard field mapping (domain logic)
- ⚠️ Gender-aware terms (domain logic)

---

## 8. Expected Benefits

### Code Quality

- **Reduced complexity:** Remove ~94 regex operations
- **Better maintainability:** Use well-tested library
- **Standards compliance:** CommonMark/GFM support
- **Fewer edge cases:** Marked handles them

### Code Size

- **Remove:** 300-450 lines of parsing code
- **Add:** ~100 lines of marked integration
- **Net reduction:** 200-350 lines (4-8%)

### Testing

- **Remove:** 15-20 markdown edge case tests
- **Add:** 5-10 marked integration tests
- **Net reduction:** 10-15 tests

### Performance

- **Similar or better:** Marked is optimized
- **May need caching:** For frequently parsed content
- **Benchmark:** Test with large files

---

## 9. Risk Mitigation

### Backward Compatibility

- ✅ Test with all demo data files
- ✅ Test with existing user content
- ✅ Verify edge cases still work
- ✅ Document any breaking changes

### Performance

- ✅ Benchmark on large files (1000+ lines)
- ✅ Profile marked parsing overhead
- ✅ Add caching if needed
- ✅ Monitor memory usage

### Obsidian Compatibility

- ✅ Test in Obsidian environment
- ✅ Verify no conflicts with Obsidian API
- ✅ Test plugin still loads correctly
- ✅ Verify settings still work

---

## 10. Next Steps

### Immediate (This Week)

1. Review this analysis with team
2. Create proof of concept for section extraction
3. Benchmark performance
4. Test with demo data

### Short-term (This Sprint)

1. Implement Phase 1 (setup)
2. Implement Phase 2 (core operations)
3. Create constants file
4. Update primary tests

### Long-term (Next Sprint)

1. Complete remaining phases
2. Update all documentation
3. Performance optimization if needed
4. Release with migration notes

---

## Contact

For questions about this refactoring plan, please review the full analysis in `docs/marked-migration-analysis.md`.
