# Relationship Management Feature

This document describes the new relationship management feature that enables storing and managing social networks within your contact system.

## Overview

The relationship system allows you to:
- Define relationships between contacts using vCard 4.0 RELATED fields
- Manage relationships through markdown "Related" sections in contact notes
- Automatically sync relationships bidirectionally
- Infer gender from relationship terms
- Maintain a relationship graph using Graphology
- Handle VCF file drops with relationship data

## User Interface

### Related Section in Contact Notes

Each contact note can have a "Related" section that lists relationships:

```markdown
## Related

- friend [[John Doe]]
- parent [[Jane Smith]]
- brother [[Bob Jones]]
```

### Supported Relationship Types

The system supports gendered and neutral relationship terms:

- **Family**: parent/father/mother, child/son/daughter, sibling/brother/sister, auncle/aunt/uncle
- **Social**: friend, spouse/husband/wife
- **Custom**: Any custom relationship type

## Technical Implementation

### vCard 4.0 RELATED Fields

Relationships are stored in front matter using vCard 4.0 format:

```yaml
RELATED[friend]: urn:uuid:12345678-1234-4234-a234-123456789abc
RELATED[1:friend]: name:John Doe
RELATED[parent]: uid:custom-uid-123
```

### Namespace Support

Three namespaces are supported for contact references:
- `urn:uuid:` - Standard UUID format
- `uid:` - Custom UID format  
- `name:` - Contact name fallback

### Gender Inference

When gendered relationship terms are used (father, mother, son, daughter, etc.), the system automatically infers and updates the gender of the related contact.

### Bidirectional Sync

Relationships are automatically synchronized bidirectionally:
- Adding "father [[John]]" to contact A adds "child [[Contact A]]" to John's contact
- Changes in the Related markdown section sync to front matter
- Front matter changes sync to the Related section

## Event Handling

The system hooks into Obsidian events:
- **File Open**: Syncs FROM front matter TO Related section
- **File Focus Loss**: Syncs FROM Related section TO front matter  
- **File Modification**: Watches for Related section changes (debounced)

## Commands

New Obsidian commands are available:

- **Sync All Relationships**: Forces a consistency check across all contacts

## Architecture

### Core Components

1. **RelationshipGraph**: Manages the relationship graph using Graphology
2. **RelationshipSync**: Handles bidirectional synchronization 
3. **RelationshipEventHandler**: Manages Obsidian event handling
4. **MarkdownRelated**: Parses and formats markdown Related sections
5. **RelatedFieldUtils**: Handles vCard RELATED field parsing/formatting
6. **VCFDropHandler**: Processes dropped VCF files with relationships

### Data Flow

```
Markdown Related Section ←→ Relationship Graph ←→ Front Matter RELATED Fields
                                     ↓
                                VCF Files
```

## Race Condition Prevention

The system includes several mechanisms to prevent cascading updates:
- Debounced synchronization (configurable delay)
- Sync-in-progress tracking per contact
- Event cascade prevention flags
- REV timestamp management

## Consistency Guarantees

- Missing reciprocal relationships are automatically added
- Graph state is kept consistent with front matter
- Startup consistency check ensures data integrity
- Deterministic ordering in front matter arrays

## Usage Examples

### Basic Friendship

Contact A:
```markdown
## Related
- friend [[Contact B]]
```

This automatically creates the reciprocal relationship in Contact B's Related section.

### Family Relationships with Gender Inference

```markdown
## Related
- father [[Robert Smith]]
- mother [[Mary Smith]]
- sister [[Sarah Jones]]
```

The system automatically sets:
- Robert Smith's gender to M
- Mary Smith's gender to F  
- Sarah Jones's gender to F
- Adds reciprocal child relationships

### Custom Relationships

```markdown
## Related
- colleague [[Work Friend]]
- mentor [[Boss Person]]
```

Custom relationship types are supported and sync bidirectionally.

## Configuration

The relationship system respects existing plugin settings:
- VCF folder path for file drops
- Logging level for debugging
- Contact folder location

## Future Enhancements

Potential future improvements:
- Relationship type validation
- Relationship history tracking
- Advanced graph queries and visualization
- Relationship strength/frequency metrics
- Import/export of relationship data