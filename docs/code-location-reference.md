# Code Location Reference for Marked Migration

This document provides specific file locations and line numbers for all refactoring opportunities identified in the marked library migration analysis.

## Quick Navigation

- [Heading Detection Code](#heading-detection-code)
- [Section Extraction Code](#section-extraction-code)
- [List Parsing Code](#list-parsing-code)
- [Repeated Constants](#repeated-constants)
- [Test Files](#test-files)

---

## Heading Detection Code

### File: `src/models/contactNote/markdownOperations.ts`

**Line 210:** Section heading detection
```typescript
const sectionRegex = /#### ([^\n]+)\n([\s\S]*?)(?=\n#### |$)/g;
```
**Replacement:** Use `marked.lexer()` to get heading tokens with `depth === 4`

**Line 226:** Section heading in regex for update
```typescript
const sectionRegex = new RegExp(`#### ${sectionName}\\n[\\s\\S]*?(?=\\n#### |$)`, 'g');
```
**Replacement:** Use marked to parse, find heading token, update content

**Line 228:** Section template string
```typescript
const newSection = `#### ${sectionName}\n${newContent}`;
```
**Replacement:** Use constant from `HEADING_LEVELS.SUBSECTION`

### File: `src/models/contactNote/contactSectionOperations.ts`

**Line 130-131:** Contact section heading detection
```typescript
// Matches any heading level (##, ###, ####, etc.) with "Contact" in any case
const contactSectionMatch = content.match(/(^|\n)(#{2,})\s*contact\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
```
**Replacement:** Use `marked.lexer()` to find heading with text "Contact" (case-insensitive)

**Line 151:** Field type header detection
```typescript
const headerMatch = line.match(/^(?:[\p{Emoji}\uFE0F]+\s*)?(Email|Emails|Phone|Phones|Address|Addresses|Website|Websites|URL)s?$/ui);
```
**Keep:** This is domain-specific field type detection

### File: `src/models/contactNote/relationshipOperations.ts`

**Line 35-36:** Related section heading detection
```typescript
// Matches any heading level (##, ###, ####, etc.) with "Related" in any case
const relatedSectionMatch = content.match(/(^|\n)(#{2,})\s*related\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
```
**Replacement:** Use `marked.lexer()` to find heading with text "Related" (case-insensitive)

---

## Section Extraction Code

### File: `src/models/contactNote/markdownOperations.ts`

**Lines 205-219:** Extract markdown sections
```typescript
async extractMarkdownSections(): Promise<Map<string, string>> {
  const content = await this.contactData.getContent();
  const sections = new Map<string, string>();

  // Split content into sections based on headers
  const sectionRegex = /#### ([^\n]+)\n([\s\S]*?)(?=\n#### |$)/g;
  let match;

  while ((match = sectionRegex.exec(content)) !== null) {
    const [, sectionName, sectionContent] = match;
    sections.set(sectionName.trim(), sectionContent.trim());
  }

  return sections;
}
```
**Replacement:** Use marked lexer to extract tokens, group by heading

### File: `src/models/contactNote/contactSectionOperations.ts`

**Lines 125-139:** Parse contact section
```typescript
async parseContactSection(): Promise<ParsedContactField[]> {
  const content = await this.contactData.getContent();
  const fields: ParsedContactField[] = [];

  // Find the Contact section - case-insensitive and depth-agnostic
  const contactSectionMatch = content.match(/(^|\n)(#{2,})\s*contact\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
  if (!contactSectionMatch) {
    return fields;
  }

  const contactContent = contactSectionMatch[3];
  // ... rest of parsing
}
```
**Replacement:** Use marked to find Contact heading, extract following tokens

### File: `src/models/contactNote/relationshipOperations.ts`

**Lines 30-46:** Parse related section
```typescript
async parseRelatedSection(): Promise<ParsedRelationship[]> {
  const content = await this.contactData.getContent();
  const relationships: ParsedRelationship[] = [];

  // Find the Related section - case-insensitive and depth-agnostic
  const relatedSectionMatch = content.match(/(^|\n)(#{2,})\s*related\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
  if (!relatedSectionMatch) {
    return relationships;
  }

  const relatedContent = relatedSectionMatch[3];
  const lines = relatedContent.split('\n').filter(line => line.trim());
  // ... rest of parsing
}
```
**Replacement:** Use marked to find Related heading, extract list tokens

---

## List Parsing Code

### File: `src/models/contactNote/relationshipOperations.ts`

**Lines 48-98:** Parse relationship list items
```typescript
for (const line of lines) {
  // Parse different formats (in order of preference):
  const match1 = line.match(/^-\s*(\w+)\s+\[\[([^\]]+)\]\]/); // type [[Name]]
  const match2 = line.match(/^-\s*([^:]+):\s*\[\[([^\]]+)\]\]/); // type: [[Name]]
  const match3 = line.match(/^-\s*\[\[([^\]]+)\]\]\s*\(([^)]+)\)/); // [[Name]] (type)
  const match4 = line.match(/^-\s*([^:]+):\s*(.+)$/); // type: Name
  
  if (match1) {
    // ...
  } else if (match2) {
    // ...
  }
  // ... etc
}
```
**Replacement:** Use marked list tokens to get clean item text (without `-`), keep wiki-link parsing

### File: `src/models/contactNote/contactSectionOperations.ts`

**Lines 176-220:** Parse contact field lines
```typescript
// Try old format first: "- Label: Value" or "Label: Value"
const colonMatch = line.match(/^-?\s*([^:]+):\s*(.+)$/);
if (colonMatch) {
  const [, label, value] = colonMatch;
  fields.push({ fieldType: currentFieldType, fieldLabel: label.trim(), value: value.trim() });
} else {
  // Try new format: "Label value" (space-separated, no colon)
  const spaceMatch = line.match(/^([A-Za-z]+)\s+(.+)$/);
  if (spaceMatch) {
    // ...
  } else {
    // Try without label (just "- value" or bare value)
    const simpleMatch = line.match(/^-\s*(.+)$/);
    // ...
  }
}
```
**Partial Replacement:** Use marked list tokens for list structure, keep field format parsing

**Lines 249-295:** Auto-detect untagged fields
```typescript
const lines2 = contactContent.split('\n');
for (let i = 0; i < lines2.length; i++) {
  const line = lines2[i].trim();
  if (!line) continue;
  
  // Skip lines that start with dash (already parsed above)
  if (line.startsWith('-')) {
    continue;
  }
  
  // Try to identify field type from the value
  const detectedType = identifyFieldType(line);
  // ...
}
```
**Replacement:** Parse with marked first, then apply field detection to non-list content

---

## Repeated Constants

### Section Heading Strings

**File: `src/models/contactNote/markdownOperations.ts`**
- Line 46: `#### Notes\n`
- Line 153: `## Related\n`
- Line 156: `## Related\n`

**File: `src/models/contactNote/relationshipOperations.ts`**
- Line 366: `## Related\n`

**File: `src/models/contactNote/contactSectionOperations.ts`**
- Line 393: `## Contact`
- Line 395: `## Contact`

**Replacement:** Create constants
```typescript
const SECTION_HEADINGS = {
  NOTES: `${HEADING_LEVELS.SUBSECTION} ${SECTION_NAMES.NOTES}\n`,
  RELATED: `${HEADING_LEVELS.SECTION} ${SECTION_NAMES.RELATED}\n`,
  CONTACT: `${HEADING_LEVELS.SECTION} ${SECTION_NAMES.CONTACT}\n`,
};
```

### VCard Field Types

**File: `src/models/contactNote/markdownOperations.ts`**
- Line 52: `["N", "FN"]`
- Line 53-55: `["EMAIL", "TEL", "BDAY", "URL", "ORG", "TITLE", "ROLE", "PHOTO", "RELATED", "GENDER"]`
- Line 57: `["ADR"]`

**File: `src/models/contactNote/contactSectionOperations.ts`**
- Lines 71-98: Field type templates with `EMAIL`, `TEL`, `URL`, `ADR`
- Line 161-169: Field type name mapping

**Replacement:** Create centralized constants
```typescript
export const VCARD_FIELD_TYPES = {
  EMAIL: 'EMAIL',
  TEL: 'TEL',
  // ... etc
};

export const FIELD_GROUPS = {
  NAME: ['N', 'FN'],
  PRIORITY: ['EMAIL', 'TEL', 'BDAY', 'URL', 'ORG', 'TITLE', 'ROLE', 'PHOTO', 'RELATED', 'GENDER'],
  ADDRESS: ['ADR'],
};
```

### Field Display Info

**File: `src/models/contactNote/contactSectionOperations.ts`**
- Lines 75-98: Icons and display names
```typescript
EMAIL: { icon: '📧', displayName: 'Email' }
TEL: { icon: '📞', displayName: 'Phone' }
URL: { icon: '🌐', displayName: 'Website' }
ADR: { icon: '🏠', displayName: 'Address' }
```

**Replacement:** Move to constants file

### Frontmatter Delimiters

**Multiple files:**
- `'---\n'` appears 5+ times
- `'\n---\n'` appears 3+ times
- `'---'` appears 10+ times

**Replacement:** Create constants
```typescript
export const FRONTMATTER = {
  DELIMITER: '---',
  START: '---\n',
  END: '\n---\n',
};
```

### Wiki-Link Patterns

**File: `src/models/contactNote/relationshipOperations.ts`**
- Line 56: `/\[\[([^\]]+)\]\]/`
- Line 58: `/\[\[([^\]]+)\]\]/`
- Line 59: `/\[\[([^\]]+)\]\]/`

**Multiple other files:**
- Pattern appears 4+ times total

**Replacement:** Create constant
```typescript
export const PATTERNS = {
  WIKI_LINK: /\[\[([^\]]+)\]\]/,
  WIKI_LINK_GLOBAL: /\[\[([^\]]+)\]\]/g,
};
```

---

## Test Files

### Tests to Remove (Markdown Edge Cases)

**File: `tests/units/models/contactNote/markdownOperations.spec.ts`**

- Lines 229-285: `extractMarkdownSections` tests
  - Whitespace handling
  - Multiple paragraphs
  - Varying whitespace amounts

**File: `tests/units/models/contactNote/contactSectionOperations.spec.ts`**

- List parsing edge cases (estimated lines 100-200)
- Whitespace variations
- Different list marker styles

**File: `tests/units/models/contactNote/relationshipOperations.spec.ts`**

- Heading level variations (estimated lines 50-100)
- List format variations

### Tests to Keep (Domain Logic)

**File: `tests/units/models/contactNote/fieldPatternDetection.spec.ts`**

- All tests - domain-specific pattern detection

**File: `tests/units/models/contactNote/contactSectionOperations.spec.ts`**

- Contact field type detection tests
- Field validation tests
- Template rendering tests

**File: `tests/units/models/contactNote/relationshipOperations.spec.ts`**

- Wiki-link extraction tests
- Relationship type parsing tests
- Gender-aware relationship term tests

### Test Helpers to Replace

**File: `tests/stories/curatorPipelineIntegration.spec.ts`**

**Lines 120-150:** Manual frontmatter extraction
```typescript
function extractFrontmatter(content: string): Record<string, any> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};
  
  const yamlContent = frontmatterMatch[1];
  // Use yaml.parse() from yaml library instead of manual parsing
  const frontmatter = parse(yamlContent);
  return frontmatter;
}
```
**Replacement:** Use yaml library's parse() function for YAML parsing

**Lines 165-181:** Manual Related section extraction
```typescript
function extractRelatedSection(content: string): string[] {
  const relatedMatch = content.match(/#### Related\n([\s\S]*?)(?:\n#{2,}|\n\n#|$)/i);
  if (!relatedMatch) return [];
  
  const relatedContent = relatedMatch[1].trim();
  const relationships = relatedContent
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim());
  
  return relationships;
}
```
**Replacement:** Use marked to find Related section, extract list tokens

---

## Implementation Priority

### Phase 1: High-Value, Low-Risk (Week 1)

1. **Create constants file** (`markdownConstants.ts`)
   - No code changes, just organization
   - Zero risk, immediate benefit

2. **Replace `extractMarkdownSections()`** in `markdownOperations.ts`
   - Single method, clear scope
   - High test coverage
   - Demonstrates marked usage

3. **Update test helpers** in `curatorPipelineIntegration.spec.ts`
   - Reduces test code duplication
   - Improves test reliability

### Phase 2: Medium-Value, Medium-Risk (Week 2)

4. **Replace section detection** in `contactSectionOperations.ts`
   - Lines 130-139
   - Keep field parsing logic

5. **Replace section detection** in `relationshipOperations.ts`
   - Lines 35-46
   - Keep wiki-link parsing

6. **Replace list parsing structure**
   - Use marked for list detection
   - Keep domain-specific content parsing

### Phase 3: Cleanup (Week 3)

7. **Remove markdown edge case tests**
   - Remove whitespace tests
   - Remove heading variation tests
   - Add marked integration tests

8. **Consolidate classes** (optional)
   - Create base class or service
   - Reduce duplication

---

## Code Metrics by File

| File | Lines | Regex Count | Potential Reduction |
|------|-------|-------------|---------------------|
| `markdownOperations.ts` | 247 | ~15 | 50-70 lines |
| `contactSectionOperations.ts` | 734 | ~30 | 100-150 lines |
| `relationshipOperations.ts` | ~200 | ~20 | 50-80 lines |
| `utilityFunctions.ts` | 170 | ~10 | 20-30 lines |
| **Total** | **~1,350** | **~75** | **220-330 lines** |

**Note:** These are conservative estimates. Actual reduction may be higher with class consolidation.

---

## Verification Checklist

After each refactoring step:

- [ ] All existing tests pass
- [ ] Demo data files parse correctly
- [ ] Performance is similar or better
- [ ] Code coverage maintained or improved
- [ ] Documentation updated
- [ ] No breaking changes to public API

---

## References

- **Main Analysis:** `docs/marked-migration-analysis.md`
- **Quick Reference:** `docs/refactoring-opportunities.md`
- **Marked Documentation:** `reference/marked/`
- **Contact List Parsing Spec:** `docs/contact-list-parsing-spec.md`
