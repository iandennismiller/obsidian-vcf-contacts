# Contact Section Specification

## Overview

The Contact Section feature allows users to view and edit contact information in a human-readable markdown format. Contact information is entered as simple list items, with automatic field type detection and bidirectional synchronization with frontmatter.

## Core Concepts

### The Contact Section

- **Heading**: `## Contact` (case-insensitive, depth-agnostic)
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
- work 123 Some street, Town
- http://example.com
- personal http://example.com
```

Each line has:
1. **Optional kind/type prefix**: Labels like `home`, `work`, `personal`
2. **Contact value**: The actual email, phone, URL, or address

## Field Type Detection

### Detection Priority

Patterns are checked in this order (most specific first):

1. **Email**: Must contain `@` symbol with valid domain
2. **URL**: Valid domain structure with optional protocol
3. **Phone**: 7-15 digits with various formatting
4. **Address**: Remaining text (fallback for street addresses)

### Email Detection

**Valid examples:**
- `contact@example.com`
- `user+tag@domain.co.uk`
- `first.last@company.com`

### Phone Number Detection

**Valid examples:**
- `555-555-5555`
- `(555) 123-4567`
- `+1-555-123-4567`
- `555 123 4567`

**Normalization:**
- 10-digit US numbers: Convert to `+1-XXX-XXX-XXXX`
- 11-digit starting with 1: Convert to `+1-XXX-XXX-XXXX`
- International: Keep existing `+` prefix
- Other: Add `+` prefix if >= 10 digits

### URL Detection

**Valid examples:**
- `https://example.com`
- `www.example.com`
- `example.com`
- `http://subdomain.example.co.uk/path`

**Normalization:**
- Add `https://` if no protocol specified
- Preserve existing protocol

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

### Kind Label Flexibility

The kind/type prefix is **optional** and can be any string:

- **Supported kinds**: Any label the user wants
- **Common examples**: `home`, `work`, `personal`, `cell`, `mobile`, `vacation`
- **Custom examples**: `emergency`, `backup`, `temporary`, `old`
- **Case handling**: Converted to uppercase for frontmatter keys (e.g., `work` → `WORK`)

### Auto-Indexing

When no kind is specified, fields are indexed automatically:

- First field without kind: `EMAIL.0`, `TEL.0`, `URL.0`, `ADR.0`
- Second field without kind: `EMAIL.1`, `TEL.1`, `URL.1`, `ADR.1`
- Third field without kind: `EMAIL.2`, `TEL.2`, etc.

## Frontmatter Mapping

Contact list items map to frontmatter keys using dot notation for structured fields.

**With type parameter:**
```yaml
EMAIL.WORK: contact@example.com
TEL.HOME: +1-555-555-5555
URL.PERSONAL: http://example.com
```

**Without type (indexed):**
```yaml
EMAIL.0: first@example.com
EMAIL.1: second@example.com
EMAIL.2: third@example.com
TEL.0: +1-555-111-1111
TEL.1: +1-555-222-2222
```

**Address components:**
```yaml
ADR.HOME.STREET: 123 Some street
ADR.HOME.LOCALITY: Town
ADR.HOME.REGION: State
ADR.HOME.POSTAL: 12345
ADR.HOME.COUNTRY: USA
# Indexed address
ADR.0.STREET: 456 Main St
ADR.0.LOCALITY: Springfield
```

### Library Integration

Frontmatter handling uses the **yaml** library for parsing and generation:

- **Parsing**: `parseYaml()` converts YAML text to JavaScript objects
- **Generation**: `stringifyYaml()` converts objects to YAML text
- **Dot Notation**: The yaml library natively supports keys with dots (e.g., `EMAIL.WORK`)
- **Type Safety**: Preserves types (strings, numbers, booleans, null)

See [Library Integration Specification](library-integration.md#yaml-processing-yaml) for details.

## Display Format

### Automatic Emoji Prefixes

When displaying contact information, emoji prefixes are added:

- **Email**: 📧
- **Phone**: 📞
- **URL**: 🌐
- **Address**: 🏠

### Display Examples

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

### Sync Behavior

- **Additive**: Sync operations add missing fields, preserve existing ones
- **REV updates**: Only update REV when data actually changes
- **Conflict resolution**: Frontmatter takes precedence in conflicts
- **Validation**: Warn about invalid formats, skip malformed data

### Contact Section to Frontmatter

1. Parse Contact section markdown
2. For each list item:
   - Detect field type
   - Extract kind and value
   - Create frontmatter key
   - Normalize value
3. Update frontmatter with new/changed fields
4. Update REV timestamp if changes made

### Frontmatter to Contact Section

1. Read frontmatter contact fields
2. Group by field type
3. For each field:
   - Format with kind label
   - Add list marker `-`
   - Include emoji prefix
4. Generate Contact section markdown
5. Update note content

## Integration with VCF Sync

Contact list data integrates with VCF sync:

1. **VCF Import**: VCF → Frontmatter → Contact Section
2. **VCF Export**: Contact Section → Frontmatter → VCF
3. **Round-trip**: All contact data preserved through import/export cycle

### VCF Field Mapping

- `EMAIL` frontmatter → vCard `EMAIL` field
- `TEL` frontmatter → vCard `TEL` field
- `URL` frontmatter → vCard `URL` field
- `ADR` frontmatter → vCard `ADR` field (with components)

Kind labels map to vCard TYPE parameters:
- `EMAIL.WORK` → `EMAIL;TYPE=WORK:...`
- `TEL.HOME` → `TEL;TYPE=HOME:...`

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
3. **Consistent formatting**: Makes parsing more reliable
4. **Review sync changes**: Use confirmation modal when enabled
5. **Backup data**: Before enabling processors on existing vault
