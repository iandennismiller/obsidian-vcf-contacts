# Event-Driven Relationship Syncing and VCF Drop Handling

This document describes the implementation of proper directional flow for relationship syncing and VCF file drop handling.

## Relationship Syncing Flow

### 1. File Open Event (frontmatter → Related list)
When a contact note is opened:
- Triggered by: `active-leaf-change` event when switching to a contact file
- Direction: **frontmatter → Related list**
- Method: `syncFromFrontMatter()`
- Process:
  1. Parse RELATED fields from frontmatter (namespace format)
  2. Update relationship graph
  3. Render Related markdown section based on graph

### 2. File Close Event (Related list → frontmatter)  
When a contact note is closed/switched away from:
- Triggered by: `active-leaf-change` event when switching away from a contact file
- Direction: **Related list → frontmatter**
- Method: `syncFromMarkdown()`
- Process:
  1. Parse Related section from markdown
  2. Update relationship graph from parsed relationships
  3. Update frontmatter with namespace format values
  4. Propagate changes to affected contacts

## VCF File Drop Handling

When a VCF file is dropped into the Obsidian vault:

### 1. Detection
- Triggered by: `vault.on('create')` event
- Checks if dropped file has `.vcf` extension
- Ignores files already in the configured VCF folder

### 2. Processing Logic
1. **Read VCF content** from dropped file
2. **Check if VCF exists** in target VCF folder path
3. **If exists**:
   - Compare content with existing file
   - If different: Update existing VCF and sync changes to contact note
   - If same: Log that no changes needed
4. **If doesn't exist**:
   - Create new VCF in target folder
   - Parse and create/update corresponding contact note
5. **Clean up**: Remove dropped VCF from vault

### 3. Contact Note Updates
- Parse VCF content using existing vCard parser
- For each contact in VCF:
  - If contact note exists: Compare and update different fields
  - If contact note doesn't exist: Create new contact note
- Updates preserve existing relationships and other frontmatter

## Implementation Details

### New Methods Added

#### RelationshipService
- `syncFromFrontMatter()` - Sync frontmatter to markdown (file open)
- `syncFromMarkdown()` - Sync markdown to frontmatter (file close)

#### Main Plugin
- `onFileOpen()` - Handle file open events for relationships
- `onFileCreate()` - Handle file creation including VCF drops
- `handleVCFDrop()` - Process VCF file drops
- `updateContactFromVCF()` - Update contact notes from VCF content

### Event Flow
```
File Open → syncFromFrontMatter() → Update Related section
File Close → syncFromMarkdown() → Update frontmatter + propagate
VCF Drop → handleVCFDrop() → Move to VCF folder + update contacts → Remove original
```

### Error Handling
- All operations wrapped in try-catch blocks
- Comprehensive logging for debugging
- Graceful degradation on errors
- Preservation of existing data

This implementation ensures proper bidirectional syncing while maintaining data integrity and providing clear user feedback through the logging system.