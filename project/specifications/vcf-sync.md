# VCF Sync Specification

## Overview

This specification covers synchronization between Obsidian contact notes and vCard (VCF) files.

## Sync Modes

### Single VCF File Mode

All contacts stored in a single VCF file:
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
2. Generate compliant VCF
3. Write to configured VCF location
4. Only write if data actually changed (check REV field)

### VCF → Obsidian Import

When VCF files change:
1. Parse VCF file
2. Map vCard fields to frontmatter format
3. Update or create contact note
4. Preserve existing markdown content
5. Update REV field to reflect import time

## Field Mapping

### Standard Fields

- `FN` → `FN` (Full Name)
- `N` → `N.GN`, `N.FN`, etc. (Name components)
- `EMAIL` → `EMAIL.WORK`, `EMAIL.HOME`, `EMAIL.0`, etc.
- `TEL` → `TEL.CELL`, `TEL.WORK`, `TEL.0`, etc.
- `ADR` → `ADR.HOME.STREET`, `ADR.WORK.LOCALITY`, etc.
- `UID` → `UID` (Unique identifier)
- `REV` → `REV` (Revision timestamp)
- `GENDER` → `GENDER` (Gender field)

### Relationship Fields

- `RELATED` → `RELATED.type`, `RELATED.type.0`, etc. with UID-based values
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

## Performance Optimization

Sync operations are optimized for efficiency:
- Only sync changed contacts (REV field tracking)
- Batch operations for multiple contacts
- Debounce file system events
- Background processing to avoid blocking UI
- Progress indicators for long operations

### Deterministic Ordering

To prevent unnecessary updates from data reordering:

**Frontmatter Ordering:**
- Relationships sorted first by key, then by value
- Creates deterministic YAML serialization
- Prevents shuffling of inherently unordered data

**VCF Field Ordering:**
- vCard fields ordered consistently
- RELATED fields maintain stable order
- Enables byte-for-byte comparison

**REV Field Updates:**
- Only update REV when content actually changes
- Compare normalized representations
- Reduces unnecessary sync triggers
- Minimizes version control noise
