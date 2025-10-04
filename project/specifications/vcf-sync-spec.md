# VCF Sync Specification

## Overview

This specification covers the synchronization between Obsidian contact notes and vCard (VCF) files.

## Sync Modes

### Single VCF File Mode

All contacts are stored in a single VCF file:
- Changes to any contact trigger a full file rewrite
- All contacts in the file are re-synced on plugin load
- REV field tracking prevents unnecessary updates

### Individual VCF Files Mode

Each contact has its own VCF file:
- Contact UID maps to filename (e.g., `{UID}.vcf`)
- Only changed contacts update their respective files
- More efficient for large contact databases
- Better for version control systems

### VCF Folder Monitoring

The plugin can monitor a folder for VCF file changes:
- File system watcher detects external modifications
- Changed VCF files trigger contact note updates
- New VCF files create new contact notes
- Deleted VCF files can optionally delete contact notes

## Sync Direction

### Obsidian → VCF Export

When contact notes change:
1. Parse frontmatter to extract vCard fields
2. Use vcard4 library to generate compliant VCF
3. Write to configured VCF location
4. Only write if data actually changed (check REV field)

### VCF → Obsidian Import

When VCF files change:
1. Use vcard4 library to parse VCF file
2. Map vCard fields to frontmatter format
3. Update or create contact note
4. Preserve existing markdown content
5. Update REV field to reflect import time

## Field Mapping

The plugin maps between vCard fields and Obsidian frontmatter:

### Standard Fields
- `FN` → `FN` (Full Name)
- `N` → `N.GN`, `N.FN`, etc. (Name components)
- `EMAIL` → `EMAIL`, `EMAIL[HOME]`, etc.
- `TEL` → `TEL`, `TEL[CELL]`, etc.
- `ADR` → `ADR.STREET`, `ADR.LOCALITY`, etc.
- `UID` → `UID` (Unique identifier)
- `REV` → `REV` (Revision timestamp)
- `GENDER` → `GENDER` (Gender field)

### Relationship Fields
- `RELATED` → `RELATED[type]` with UID-based values
- Bidirectional sync ensures reciprocal relationships

## Conflict Resolution

When both Obsidian and VCF have changes:
- REV field determines which is newer
- User can configure conflict resolution strategy:
  - Obsidian wins (default)
  - VCF wins
  - Ask user (modal dialog)
  - Merge (attempt to combine changes)

## Error Handling

The sync process handles various error conditions:
- Malformed VCF files (logged, skipped)
- Missing UID fields (generate new UID)
- Invalid frontmatter (validation warnings)
- File system errors (retry with backoff)
- Network errors for remote VCF sources

## Performance

Sync operations are optimized for efficiency:
- Only sync changed contacts (REV field tracking)
- Batch operations for multiple contacts
- Debounce file system events
- Background processing to avoid blocking UI
- Progress indicators for long operations

## Related Specifications

- [vCard Format Specification](vcard-format-spec.md)
- [Library Integration Specification](library-integration-spec.md)
- [Relationship Management Specification](relationship-management-spec.md)
