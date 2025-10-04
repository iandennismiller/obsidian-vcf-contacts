# Library Integration Specification

## Overview

The plugin leverages three key external libraries to provide robust, standards-compliant functionality. This architectural decision delegates complex parsing and generation tasks to well-maintained libraries, allowing the plugin to focus on Obsidian-specific integration.

## Markdown Processing: [marked](https://www.npmjs.com/package/marked)

The plugin uses the marked library for standard markdown parsing and rendering operations.

### Benefits

- **Reduced Complexity**: Eliminates custom markdown parsing utilities and edge case handling
- **Better Standards Compliance**: Follows CommonMark and GitHub Flavored Markdown specifications
- **Improved Performance**: Leverages a battle-tested, optimized parser
- **Lower Maintenance**: Delegates markdown syntax concerns to a well-maintained library

### Scope of marked Library Usage

The marked library handles:
- Standard markdown list parsing
- Heading extraction and hierarchy
- Whitespace normalization
- Line break handling
- All CommonMark and GFM syntax

### Scope of Custom Parsing

Custom parsing is limited to:
1. **Obsidian-Specific Syntax**: Wiki-links (`[[Contact Name]]`) which are not standard markdown
2. **Contact Semantics**: Pattern recognition for emails, phones, URLs, addresses
3. **Contact Display Formatting**: Converting between frontmatter and contact display formats

### Integration Points

- **Related Section**: marked parses the markdown structure; custom code extracts wiki-links and relationship types
- **Contact Section**: marked parses lists and headings; custom code extracts contact field data

**User Benefit**: More reliable markdown handling with fewer edge cases and better compatibility with standard markdown tools.

---

## vCard Processing: [vcard4](https://www.npmjs.com/package/vcard4)

The plugin uses the vcard4 library for all vCard 4.0 parsing, generation, and manipulation.

### Benefits

- **Full RFC 6350 Compliance**: Complete implementation of vCard 4.0 specification
- **Reduced Complexity**: Eliminates custom vCard parsing/generation utilities and edge case handling
- **Better Standards Compliance**: Follows vCard 4.0 spec exactly, including extensions (RFC 6474, RFC 8605, etc.)
- **Improved Reliability**: Leverages a battle-tested, spec-compliant parser and generator
- **Lower Maintenance**: Delegates vCard format concerns to a well-maintained library
- **Multiple Output Formats**: Supports standard vCard, XML vCard (RFC 6351), and jCard (RFC 7095)

### Scope of vcard4 Library Usage

The vcard4 library handles:
1. **vCard Parsing**: Reading and parsing vCard 4.0 files into structured objects
2. **vCard Generation**: Creating valid vCard 4.0 output from structured data
3. **Field Validation**: Ensuring all vCard fields comply with RFC 6350
4. **Structured Fields**: Parsing and generating complex fields (N, ADR, GENDER, etc.)
5. **Line Folding**: Proper handling of long lines per vCard specification
6. **Property Parameters**: TYPE, PREF, VALUE, and other vCard parameters
7. **Special Properties**: RELATED, PHOTO, GEO, and other vCard 4.0 properties

### Scope of Custom Integration

Custom code is limited to:
1. **Obsidian Frontmatter Mapping**: Converting between vCard properties and Obsidian YAML frontmatter
2. **UID Management**: Generating and tracking unique contact identifiers
3. **Relationship Extensions**: Custom RELATED field handling for bidirectional relationships
4. **File Operations**: Reading/writing VCF files and managing sync workflows

### Integration Points

- **VCF Import**: vcard4 parses VCF files; custom code maps to Obsidian frontmatter
- **VCF Export**: Custom code extracts frontmatter; vcard4 generates valid VCF output
- **Field Validation**: vcard4 ensures all exported data complies with RFC 6350

**User Benefit**: Full vCard 4.0 compliance ensures compatibility with all standards-compliant contact management systems.

---

## YAML Processing: [yaml](https://www.npmjs.com/package/yaml)

The plugin uses the yaml library for all YAML parsing, generation, and manipulation operations.

### Benefits

- **Full YAML 1.2 Compliance**: Complete implementation of YAML specification
- **Reduced Complexity**: Eliminates custom YAML parsing/generation utilities and edge case handling
- **Better Standards Compliance**: Follows YAML 1.2 spec exactly
- **Improved Reliability**: Leverages a battle-tested, spec-compliant parser and generator
- **Lower Maintenance**: Delegates YAML format concerns to a well-maintained library
- **Robust Error Handling**: Detailed error messages for malformed YAML

### Scope of yaml Library Usage

The yaml library handles:
1. **YAML Parsing**: Reading and parsing YAML frontmatter into JavaScript objects
2. **YAML Generation**: Creating valid YAML output from JavaScript objects
3. **Type Preservation**: Maintaining proper types (strings, numbers, booleans, null)
4. **Comment Handling**: Preserving comments when possible
5. **Multi-line Strings**: Proper handling of multi-line string values
6. **Special Characters**: Escaping and quoting as needed per YAML spec

### Scope of Custom Integration

Custom code is limited to:
1. **Frontmatter Extraction**: Identifying frontmatter boundaries in markdown files
2. **Validation**: Validating vCard field formats and constraints

### Integration Points

- **Frontmatter Parsing**: yaml parses frontmatter block into flat key-value pairs
- **Frontmatter Generation**: yaml generates YAML from flat key-value pairs
- **Validation**: yaml validates YAML syntax; custom code validates vCard field formats

**User Benefit**: More reliable YAML handling with fewer edge cases, better standards compliance, and improved compatibility with other tools that use YAML.

---

## Object Flattening: [flat](https://www.npmjs.com/package/flat)

The plugin uses the flat library to convert between hierarchical vCard structures and flat Obsidian frontmatter.

### Benefits

- **Standardized Flattening**: Industry-standard approach to flattening/unflattening nested objects
- **Reduced Complexity**: Eliminates custom key parsing and structure handling logic
- **Deterministic Keys**: Consistent dot-notation key format (e.g., `ADR.HOME.STREET`)
- **Bidirectional Conversion**: Reliable conversion between nested and flat representations
- **Lower Maintenance**: Delegates flattening logic to a well-maintained library

### Scope of flat Library Usage

The flat library handles:
1. **Object Flattening**: Converting nested vCard objects to flat key-value pairs
2. **Object Unflattening**: Converting flat frontmatter to nested vCard objects
3. **Delimiter Customization**: Using dot notation for hierarchical keys
4. **Safe Mode**: Handling special characters and edge cases

### Scope of Custom Integration

Custom code is limited to:
1. **vCard Property Mapping**: Converting between vcard4 property objects and flat frontmatter
2. **UID Management**: Generating and tracking unique contact identifiers
3. **Relationship Extensions**: Custom RELATED field handling for bidirectional relationships

### Integration Points

- **VCF Import**: vcard4 parses VCF → flat converts to frontmatter → yaml serializes
- **VCF Export**: yaml parses frontmatter → flat converts to nested object → vcard4 generates VCF
- **Consistency**: flat ensures consistent key format across all contact operations

**User Benefit**: Consistent, predictable frontmatter structure with simplified maintenance and fewer edge cases.

---

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

## Related Specifications

- [VCF Sync Specification](vcf-sync-spec.md)
- [Contact Section Specification](contact-section-spec.md)
- [Relationship Management Specification](relationship-management-spec.md)
