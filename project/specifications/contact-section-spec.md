# Contact List Parsing

## Overview

This specification covers contact list parsing in the Obsidian VCF Contacts plugin. The contact list parsing feature allows users to enter contact information using simple markdown list items, with automatic field type detection and optional kind/type labels.

**Architecture Note**: The plugin uses the [marked](https://www.npmjs.com/package/marked) library for standard markdown parsing operations. This approach:
- Reduces the need for custom markdown parsing utilities
- Eliminates edge cases related to markdown syntax (whitespace, line breaks, list formatting)
- Allows the plugin to focus on contact-specific data extraction
- Provides a well-tested, performant markdown parser

Custom parsing is limited to:
1. **Obsidian-specific syntax**: Wiki-style links (`[[Contact Name]]`)
2. **Contact data extraction**: Identifying emails, phone numbers, URLs from list item content
3. **Semantic interpretation**: Extracting type/kind labels and values from contact data

## Core Concepts

### The Contact Section

The Contact section is a dedicated markdown section in contact notes where users can view and edit contact information:

- **Heading**: `## Contact` (case-insensitive, depth-agnostic like Related section)
- **Format**: Markdown list items starting with `-`
- **Purpose**: Human-readable display and editing of contact fields
- **Sync**: Bidirectional sync with frontmatter fields

### Contact List Format

Contact information is entered as simple markdown list items:

```markdown
## Contact

- home 555-555-5555
- contact@example.com
- work contact@example.com
- 123 Some street
- 123 Some street, Town
- http://example.com
- personal http://example.com
```

Each line represents a single piece of contact information with:
1. **Optional kind/type prefix**: Labels like `home`, `work`, `personal`
2. **Contact value**: The actual email, phone, URL, or address

## Field Type Detection

### Detection Process

The parser leverages the marked library for markdown structure, then applies contact-specific pattern matching:

1. **Parse markdown structure** (handled by marked library):
   - Extract heading hierarchy
   - Parse list items from markdown
   - Normalize whitespace and line breaks
   - Handle various list formatting styles

2. **Extract contact data** (custom logic):
   - Clean the line: Remove list marker (`-`) and trim whitespace
   - Identify field type: Use pattern matching to determine type (EMAIL, TEL, URL, ADR)
   - Extract components: Separate optional kind prefix from value
   - Validate: Ensure the value matches the detected pattern
   - Create frontmatter key: Generate key like `EMAIL[WORK]` or bare `TEL` (first field) or indexed `TEL[1]` (second field)

**Benefit**: By delegating markdown parsing to marked, the plugin eliminates the need for custom handling of:
- Different list marker styles
- Inconsistent indentation
- Mixed whitespace (spaces vs tabs)
- Line break variations
- Nested list structures

### Pattern Detection Priority

Patterns are checked in this order (most specific first):

1. **Email**: Must contain `@` symbol with valid domain
2. **URL**: Valid domain structure with optional protocol
3. **Phone**: 7-15 digits with various formatting
4. **Address**: Remaining text (fallback for street addresses)

### Email Detection

**Pattern**: `/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/`

**Valid examples:**
- `contact@example.com`
- `user+tag@domain.co.uk`
- `first.last@company.com`

**Detection logic:**
```typescript
function isEmail(value: string): boolean {
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[...]/;
  return emailPattern.test(value.trim());
}
```

### Phone Number Detection

**Pattern**: Phone numbers with 7-15 digits after removing formatting characters

**Valid examples:**
- `555-555-5555`
- `(555) 123-4567`
- `+1-555-123-4567`
- `555 123 4567`

**Detection logic:**
```typescript
function isPhoneNumber(value: string): boolean {
  const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
  const phonePattern = /^[\+]?[0-9]{7,15}$/;
  return phonePattern.test(cleaned);
}
```

**Normalization:**
- 10-digit US numbers: Convert to `+1-XXX-XXX-XXXX`
- 11-digit starting with 1: Convert to `+1-XXX-XXX-XXXX`
- International: Keep existing `+` prefix
- Other: Add `+` prefix if >= 10 digits

### URL Detection

**Pattern**: Valid domain with optional protocol

**Valid examples:**
- `https://example.com`
- `www.example.com`
- `example.com`
- `http://subdomain.example.co.uk/path`

**Detection logic:**
```typescript
function isUrl(value: string): boolean {
  const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[...]/;
  return urlPattern.test(trimmed);
}
```

**Normalization:**
- Add `https://` if no protocol specified
- Preserve existing protocol
- Handle `www.` prefix correctly

### Address Detection

Addresses are detected by exclusion - if not email, URL, or phone, treat as address.

**Valid examples:**
- `123 Some street`
- `123 Some street, Town`
- `123 Main St, Springfield, IL 62701`

**Multi-line support:**
- Addresses can span multiple lines
- Parser groups consecutive address lines
- Components extracted: STREET, LOCALITY, REGION, POSTAL, COUNTRY

## Kind/Type Prefix Extraction

### General Method

For each detected field type, use separate methods to parse the line and extract the kind:

#### Email Line Parsing

```typescript
function parseEmailLine(line: string): { kind: string, value: string } {
  // Try to split on first space
  const parts = line.split(' ');
  
  // If we have 2+ parts and second part is valid email
  if (parts.length >= 2 && isEmail(parts.slice(1).join(' '))) {
    return {
      kind: parts[0],
      value: parts.slice(1).join(' ')
    };
  }
  
  // Whole line is email, auto-index
  return {
    kind: null, // Will be auto-indexed as 1, 2, 3...
    value: line
  };
}
```

#### Phone Line Parsing

```typescript
function parsePhoneLine(line: string): { kind: string, value: string } {
  const parts = line.split(' ');
  
  // Try parsing with first word as kind
  if (parts.length >= 2 && isPhoneNumber(parts.slice(1).join(' '))) {
    return {
      kind: parts[0],
      value: normalizePhoneNumber(parts.slice(1).join(' '))
    };
  }
  
  // Whole line is phone
  return {
    kind: null,
    value: normalizePhoneNumber(line)
  };
}
```

#### URL Line Parsing

```typescript
function parseUrlLine(line: string): { kind: string, value: string } {
  const parts = line.split(' ');
  
  // Check if first word is kind and rest is URL
  if (parts.length >= 2 && isUrl(parts.slice(1).join(' '))) {
    return {
      kind: parts[0],
      value: normalizeUrl(parts.slice(1).join(' '))
    };
  }
  
  // Whole line is URL
  return {
    kind: null,
    value: normalizeUrl(line)
  };
}
```

#### Address Line Parsing

Addresses are more complex due to multi-line support:

```typescript
function parseAddressLines(lines: string[]): { kind: string, components: AddressComponents } {
  // First line may have kind prefix
  const firstLine = lines[0];
  const parts = firstLine.split(' ');
  
  let kind = null;
  let addressLines = lines;
  
  // Check if first word looks like a kind (not a number)
  if (parts.length >= 2 && !/^\d/.test(parts[0])) {
    // Could be a kind
    const restOfLine = parts.slice(1).join(' ');
    if (restOfLine.length > 0) {
      kind = parts[0];
      addressLines = [restOfLine, ...lines.slice(1)];
    }
  }
  
  return {
    kind: kind,
    components: parseAddressComponents(addressLines)
  };
}
```

### Kind Label Flexibility

The kind/type prefix is **optional** and can be any string:

- **Supported kinds**: Any label the user wants
- **Common examples**: `home`, `work`, `personal`, `cell`, `mobile`, `vacation`
- **Custom examples**: `emergency`, `backup`, `temporary`, `old`
- **Case handling**: Converted to uppercase for frontmatter keys (e.g., `work` → `WORK`)

### Auto-Indexing

When no kind is specified, fields use bare keys for the first field, then indexed:

- First field without kind: bare `EMAIL`, `TEL`, `URL`, `ADR`
- Second field without kind: `EMAIL[1]`, `TEL[1]`, `URL[1]`, `ADR[1]`
- Third field without kind: `EMAIL[2]`, `TEL[2]`, etc.

## Frontmatter Mapping

### Key Format

Contact list items map to frontmatter keys using dot notation for structured fields.

**Technical Note**: The plugin uses the [flat](https://www.npmjs.com/package/flat) library to convert between hierarchical vCard structures and flat Obsidian frontmatter. This provides consistent, deterministic key formatting across all contact operations.

**With type parameter:**
```yaml
EMAIL.WORK: contact@example.com
TEL.HOME: +1-555-555-5555
URL.PERSONAL: http://example.com
```

**Without type (bare keys):**
```yaml
EMAIL: first@example.com
EMAIL[1]: second@example.com
EMAIL[2]: third@example.com
TEL: +1-555-111-1111
TEL[1]: +1-555-222-2222
```

**Address components:**
```yaml
ADR[HOME].STREET: 123 Some street
ADR[HOME].LOCALITY: Town
ADR[HOME].REGION: State
ADR[HOME].POSTAL: 12345
ADR[HOME].COUNTRY: USA
# First address without kind is bare:
ADR.STREET: 456 Main St
ADR.LOCALITY: Springfield
```

### Parsing Examples

#### Example 1: Email with Kind

**Input:**
```markdown
- work contact@example.com
```

**Processing:**
1. Detect type: EMAIL
2. Extract kind: `work`
3. Extract value: `contact@example.com`
4. Create key: `EMAIL[WORK]`

**Frontmatter:**
```yaml
EMAIL[WORK]: contact@example.com
```

#### Example 2: Phone without Kind

**Input:**
```markdown
- 555-555-5555
```

**Processing:**
1. Detect type: TEL
2. Extract kind: null (auto-index)
3. Normalize value: `+1-555-555-5555`
4. Create key: `TEL` (first phone field is bare)

**Frontmatter:**
```yaml
TEL: +1-555-555-5555
```

#### Example 3: URL with Kind

**Input:**
```markdown
- personal http://example.com
```

**Processing:**
1. Detect type: URL
2. Extract kind: `personal`
3. Extract value: `http://example.com`
4. Create key: `URL[PERSONAL]`

**Frontmatter:**
```yaml
URL[PERSONAL]: http://example.com
```

#### Example 4: Address with Components

**Input:**
```markdown
- 123 Some street, Town
```

**Processing:**
1. Detect type: ADR
2. Extract kind: null (auto-index)
3. Parse components:
   - STREET: `123 Some street`
   - LOCALITY: `Town`
4. Create keys: `ADR.STREET`, `ADR.LOCALITY` (first address is bare)

**Frontmatter:**
```yaml
ADR.STREET: 123 Some street
ADR.LOCALITY: Town
```

## Display and Emoji Prefixes

### Automatic Emoji Insertion

When displaying contact information, the parser automatically adds emoji prefixes:

- **Email**: 📧
- **Phone**: 📞
- **URL**: 🌐
- **Address**: 🏠

### Display Format

**Without kind:**
```markdown
📧 user@example.com
📞 +1-555-555-5555
🌐 http://example.com
```

**With kind:**
```markdown
📧 work contact@example.com
📞 home +1-555-555-5555
🌐 personal http://example.com
```

The emoji is added during rendering but not stored in frontmatter.

## Bidirectional Sync

### Contact Section to Frontmatter

**ContactToFrontMatterProcessor:**

1. Parse Contact section markdown
2. For each list item:
   - Detect field type
   - Extract kind and value
   - Create frontmatter key
   - Normalize value
3. Update frontmatter with new/changed fields
4. Update REV timestamp if changes made

### Frontmatter to Contact Section

**FrontMatterToContactProcessor:**

1. Read frontmatter contact fields
2. Group by field type
3. For each field:
   - Format with kind label
   - Add list marker `-`
   - Include emoji prefix
4. Generate Contact section markdown
5. Update note content

### Sync Behavior

- **Additive**: Sync operations add missing fields, preserve existing ones
- **REV updates**: Only update REV when data actually changes
- **Conflict resolution**: Frontmatter takes precedence in conflicts
- **Validation**: Warn about invalid formats, skip malformed data

## Integration with VCF Sync

Contact list data integrates with VCF sync:

1. **VCF Import**: VCF → Frontmatter → Contact Section (via FrontMatterToContactProcessor)
2. **VCF Export**: Contact Section → Frontmatter → VCF (via ContactToFrontMatterProcessor then VCF sync)
3. **Round-trip**: All contact data preserved through import/export cycle

### VCF Field Mapping

- `EMAIL` frontmatter → vCard `EMAIL` field
- `TEL` frontmatter → vCard `TEL` field
- `URL` frontmatter → vCard `URL` field
- `ADR` frontmatter → vCard `ADR` field (with components)

Kind labels map to vCard TYPE parameters:
- `EMAIL[WORK]` → `EMAIL;TYPE=WORK:...`
- `TEL[HOME]` → `TEL;TYPE=HOME:...`

## Validation and Error Handling

### Field Validation

**Email validation:**
- Must contain `@` symbol
- Valid domain format
- Warning: "Invalid email format"

**Phone validation:**
- 7-15 digits after normalization
- Valid formatting characters only
- Warning: "Invalid phone number format"

**URL validation:**
- Valid domain structure
- Optional protocol
- Warning: "Invalid URL format"

### Error Handling

- **Invalid format**: Log warning, skip field
- **Malformed data**: Preserve in markdown, don't sync to frontmatter
- **Missing fields**: Gracefully handle, no error
- **Duplicate fields**: Keep all, indexed appropriately

## Best Practices

1. **Use contact list format**: Recommended for flexibility and ease of use
2. **Add kind labels**: When multiple values of same type exist
3. **Consistent formatting**: Makes parsing more reliable (though marked handles most variations)
4. **Review sync changes**: Use confirmation modal when enabled
5. **Backup data**: Before enabling processors on existing vault

---

## Summary

These specifications define:

### Relationship Management
1. Projects a social graph onto vCard files via RELATED fields
2. Provides an intuitive markdown-based user interface via the Related section
3. Maintains bidirectional synchronization between markdown and front matter
4. Handles gender-aware relationship rendering
5. Ensures data consistency and efficient updates through deterministic ordering and REV management

### Contact List Parsing
1. Provides a simple, flexible format for entering contact information
2. Uses intelligent pattern matching to detect field types
3. Supports optional kind/type labels for categorization
4. Automatically normalizes and validates contact data
5. Maintains bidirectional sync with frontmatter fields
6. Integrates seamlessly with VCF import/export
7. Uses separate parsing methods for each field type
8. Extracts kind prefixes using a general method applicable to all field types
