# Library Integration Specification

## Overview

The plugin leverages external libraries to provide robust, standards-compliant functionality. This delegates complex parsing and generation tasks to well-maintained libraries, allowing the plugin to focus on Obsidian-specific integration.

## Markdown Processing: marked

The plugin uses the marked library for standard markdown parsing and rendering.

### Benefits

- Reduced complexity: Eliminates custom markdown parsing utilities
- Better standards compliance: Follows CommonMark and GitHub Flavored Markdown
- Improved performance: Leverages a battle-tested, optimized parser
- Lower maintenance: Delegates markdown syntax concerns to library

### Scope of marked Library Usage

The marked library handles:
- Standard markdown list parsing
- Heading extraction and hierarchy
- Whitespace normalization
- Line break handling
- All CommonMark and GFM syntax

### Scope of Custom Parsing

Custom parsing is limited to:
1. **Obsidian-Specific Syntax**: Wiki-links (`[[Contact Name]]`)
2. **Contact Semantics**: Pattern recognition for emails, phones, URLs, addresses
3. **Contact Display Formatting**: Converting between frontmatter and contact display formats

### Integration Points

- **Related Section**: marked parses markdown structure; custom code extracts wiki-links and relationship types
- **Contact Section**: marked parses lists and headings; custom code extracts contact field data

## vCard Processing: vcard4

The plugin uses the vcard4 library for all vCard 4.0 parsing, generation, and manipulation.

### Benefits

- Full RFC 6350 compliance: Complete implementation of vCard 4.0 specification
- Reduced complexity: Eliminates custom vCard parsing/generation utilities
- Better standards compliance: Follows vCard 4.0 spec exactly
- Improved reliability: Leverages battle-tested, spec-compliant parser
- Lower maintenance: Delegates vCard format concerns to library
- Multiple output formats: Supports standard vCard, XML vCard, and jCard

### Scope of vcard4 Library Usage

The vcard4 library handles:
1. vCard parsing: Reading and parsing vCard 4.0 files
2. vCard generation: Creating valid vCard 4.0 output
3. Field validation: Ensuring all vCard fields comply with RFC 6350
4. Structured fields: Parsing complex fields (N, ADR, GENDER, etc.)
5. Line folding: Proper handling of long lines
6. Property parameters: TYPE, PREF, VALUE, and other parameters
7. Special properties: RELATED, PHOTO, GEO, and other vCard 4.0 properties

### Scope of Custom Integration

Custom code is limited to:
1. Obsidian frontmatter mapping: Converting between vCard properties and YAML frontmatter
2. UID management: Generating and tracking unique contact identifiers
3. Relationship extensions: Custom RELATED field handling for bidirectional relationships
4. File operations: Reading/writing VCF files and managing sync workflows

### Integration Points

- **VCF Import**: vcard4 parses VCF files; custom code maps to Obsidian frontmatter
- **VCF Export**: Custom code extracts frontmatter; vcard4 generates valid VCF output
- **Field Validation**: vcard4 ensures all exported data complies with RFC 6350

## YAML Processing: yaml

The plugin uses the yaml library for all YAML parsing, generation, and manipulation.

### Benefits

- Full YAML 1.2 compliance: Complete implementation of YAML specification
- Reduced complexity: Eliminates custom YAML parsing/generation utilities
- Better standards compliance: Follows YAML 1.2 spec exactly
- Improved reliability: Leverages battle-tested parser
- Lower maintenance: Delegates YAML format concerns to library
- Robust error handling: Detailed error messages for malformed YAML

### Scope of yaml Library Usage

The yaml library handles:
1. YAML parsing: Reading and parsing YAML frontmatter
2. YAML generation: Creating valid YAML output
3. Type preservation: Maintaining proper types (strings, numbers, booleans, null)
4. Comment handling: Preserving comments when possible
5. Multi-line strings: Proper handling of multi-line values
6. Special characters: Escaping and quoting as needed
7. Arrays and nested objects: Full support for YAML data structures
8. Dot notation: Natively supports keys with dots (e.g., `RELATED.friend`)

### Scope of Custom Integration

Custom code is limited to:
1. Frontmatter extraction: Identifying frontmatter boundaries in markdown files
2. Validation: Validating vCard field formats and constraints

### Integration Points

- **Frontmatter Parsing**: Regex extracts YAML block; yaml parses into structured data
- **Frontmatter Generation**: yaml generates YAML from structured data
- **Validation**: yaml validates YAML syntax; custom code validates vCard field formats

### Migration to YAML Library

The codebase has migrated from manual string parsing to using the yaml library:

**Before (Manual Parsing):**
```typescript
const lines = yaml.split('\n');
lines.forEach(line => {
  const match = line.match(/^"?([^":]+)"?:\s*(.+)$/);
  if (match) {
    frontmatter[match[1].trim()] = match[2].trim();
  }
});
```

**After (Using yaml Library):**
```typescript
import { parse as parseYaml } from 'yaml';
const frontmatter = parseYaml(yaml) ?? {};
```

**Benefits of Migration:**
- Handles quoted keys automatically
- Handles arrays and nested objects
- Handles multi-line values
- Handles YAML comments
- Reduced from ~15 lines to ~1 line per instance
- Consistent with production code patterns
- More robust edge case handling

## Object Flattening: flat

The plugin uses the flat library to convert between hierarchical vCard structures and flat Obsidian frontmatter.

### Benefits

- Standardized flattening: Industry-standard approach to nested object handling
- Reduced complexity: Eliminates custom key parsing and structure handling
- Deterministic keys: Consistent dot-notation key format (e.g., `ADR.HOME.STREET`)
- Bidirectional conversion: Reliable conversion between nested and flat representations
- Lower maintenance: Delegates flattening logic to library

### Scope of flat Library Usage

The flat library handles:
1. Object flattening: Converting nested vCard objects to flat key-value pairs
2. Object unflattening: Converting flat frontmatter to nested vCard objects
3. Delimiter customization: Using dot notation for hierarchical keys
4. Safe mode: Handling special characters and edge cases

### Scope of Custom Integration

Custom code is limited to:
1. vCard property mapping: Converting between vcard4 property objects and flat frontmatter
2. UID management: Generating and tracking unique contact identifiers
3. Relationship extensions: Custom RELATED field handling

### Integration Points

- **VCF Import**: vcard4 parses VCF → flat converts to frontmatter → yaml serializes
- **VCF Export**: yaml parses frontmatter → flat converts to nested object → vcard4 generates VCF
- **Consistency**: flat ensures consistent key format across all operations

## Design Philosophy

The plugin follows a clear separation of concerns:

1. **Standard Format Handling**: Delegated to specialized libraries (marked, vcard4, yaml, flat)
2. **Obsidian Integration**: Handled by custom plugin code
3. **Domain Logic**: Contact and relationship management in custom code

This architecture ensures:
- **Maintainability**: Updates to format specifications handled by library maintainers
- **Reliability**: Battle-tested libraries handle edge cases
- **Focus**: Plugin code focuses on unique Obsidian integration needs
- **Compatibility**: Standards compliance ensures interoperability with other tools

### Library Stack

1. **marked**: Standard markdown parsing
2. **vcard4**: vCard 4.0 parsing and generation
3. **yaml**: YAML parsing and generation
4. **flat**: Object flattening/unflattening for vCard ↔ frontmatter conversion
