# Reference Documentation

This directory contains reference documentation for external libraries and APIs used by the VCF Contacts plugin.

## Contents

### vCard (`vcard/`)

VCard 4.0 specification and vcard4 library documentation:
- **rfc6350.txt**: RFC 6350 - vCard 4.0 specification
- **vcard4-js/**: Documentation for the vcard4 JavaScript library
  - Properties documentation (FN, N, EMAIL, TEL, ADR, etc.)
  - Value types documentation (TextType, DateTimeType, etc.)
  - Parameters documentation (TYPE, PREF, etc.)

**Usage**: The plugin uses the [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard 4.0 parsing and generation operations. This library fully implements RFC 6350 and handles all parsing edge cases, field validation, and structured field processing.

### Obsidian (`obsidian/`)

Obsidian plugin API TypeScript documentation:
- API interfaces and classes
- Plugin lifecycle methods
- Vault operations
- Events and callbacks
- UI components

**Usage**: Auto-generated documentation from the Obsidian TypeScript API. Reference this when working with Obsidian-specific functionality.

### Marked (`marked/`)

Marked markdown parser library documentation:
- Parsing API
- Rendering options
- Extension points

**Usage**: The plugin uses the [marked](https://www.npmjs.com/package/marked) library for standard markdown parsing operations. This eliminates custom regex patterns and provides robust, standards-compliant markdown handling.

### YAML (`yaml/`)

YAML parsing library documentation:
- Parsing and stringification API
- Type handling
- YAML 1.2 compliance

**Usage**: The plugin uses the [yaml](https://www.npmjs.com/package/yaml) library for all YAML parsing and generation operations, particularly for frontmatter handling.

## Related Documentation

- [Architecture](../docs/development/architecture.md) - Details on how these libraries are integrated
- [Development](../docs/development/) - Development documentation
- [Specifications](../docs/specifications.md) - Technical specifications

## External Links

- [vcard4 on npm](https://www.npmjs.com/package/vcard4)
- [marked on npm](https://www.npmjs.com/package/marked)
- [yaml on npm](https://www.npmjs.com/package/yaml)
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [RFC 6350 (vCard 4.0)](https://datatracker.ietf.org/doc/html/rfc6350)
