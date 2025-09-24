# VCard 4.0 RELATED Field Support - Implementation Guide

## Overview

This implementation adds comprehensive support for VCard 4.0 RELATED fields to the Obsidian VCF Contacts plugin, enabling users to store and manage their social network locally by projecting a social graph onto VCard files.

## Features

### 🔗 Relationship Management
- **Bidirectional Relationships**: Automatic synchronization of reciprocal relationships
- **Multiple Relationship Types**: Support for friends, family, colleagues, and custom relationship types
- **Gender-Aware Parsing**: Automatic gender inference from gendered terms (mother/father → parent + gender)
- **Consistency Checking**: Automatic detection and repair of missing reciprocal relationships

### 📝 Natural User Interface
- **Markdown Integration**: Manage relationships using natural markdown syntax in contact notes
- **Related Section**: Automatic "## Related" section in contact notes
- **Link Format**: Use Obsidian wiki-links: `- friend [[John Doe]]`
- **Real-time Sync**: Changes in the Related list automatically sync to front matter and other contacts

### 🔄 VCard Integration
- **Standards Compliant**: Full VCard 4.0 RELATED field support
- **Multiple Namespaces**: Support for `urn:uuid:`, `uid:`, and `name:` references
- **Import/Export**: Seamless import and export of relationships through VCard files
- **Backward Compatible**: Zero breaking changes to existing functionality

## Usage Examples

### Basic Relationship Management

In a contact note, simply add relationships to the Related section:

```markdown
---
UID: urn:uuid:12345678-1234-1234-1234-123456789abc
FN: John Doe
N.GN: John
N.FN: Doe
RELATED[friend]: urn:uuid:87654321-4321-4321-4321-cba987654321
RELATED[parent]: urn:uuid:11111111-1111-1111-1111-111111111111
---

## Related
- friend [[Jane Smith]]
- parent [[Robert Doe]]
- colleague [[Alice Johnson]]
```

### Gendered Relationship Terms

The system automatically handles gendered relationship terms:

```markdown
## Related
- mother [[Mary Doe]]      # → parent + Mary's gender set to female
- father [[Robert Doe]]    # → parent + Robert's gender set to male  
- sister [[Susan Doe]]     # → sibling + Susan's gender set to female
- friend [[John Smith]]    # → friend (no gender inference)
```

### VCard Export Example

The relationships are exported as standard VCard 4.0 RELATED fields:

```vcard
BEGIN:VCARD
VERSION:4.0
UID:urn:uuid:12345678-1234-1234-1234-123456789abc
FN:John Doe
N:Doe;John;;;
RELATED;TYPE=friend:urn:uuid:87654321-4321-4321-4321-cba987654321
RELATED;TYPE=parent:urn:uuid:11111111-1111-1111-1111-111111111111
RELATED;TYPE=colleague:name:Alice Johnson
END:VCARD
```

## Technical Architecture

### Core Components

1. **RelationshipGraphService**: Manages the relationship graph using Graphology
2. **RelationshipEventManager**: Handles UI events and synchronization
3. **Enhanced mdRender**: Generates Related sections in contact notes
4. **VCF Integration**: Parsing and generation of RELATED fields

### Event Flow

1. **File Open** → Front matter → Related list rendering
2. **User Edit** → Related list → Graph → Front matter → Propagate to related contacts
3. **File Close** → Debounced sync to prevent cascades
4. **VCard Import** → Parse RELATED fields → Update graph and notes

### Relationship Graph

- **Nodes**: Contacts identified by UID or full name
- **Edges**: Directed relationships with kind attribute
- **Multi-edges**: Multiple relationship types between same contacts
- **Consistency**: Automatic checking for missing reciprocal relationships

## API Reference

### RelationshipGraphService

```typescript
class RelationshipGraphService {
  // Parse gendered relationship terms
  parseRelationshipTerm(term: string): { kind: string; inferredGender?: 'male' | 'female' }
  
  // Add/update contact nodes
  addContact(contact: ContactNode): void
  
  // Manage relationships
  addRelationship(sourceUID: string, targetUID: string, kind: string): void
  removeRelationship(sourceUID: string, targetUID: string, kind: string): void
  
  // Query relationships
  getRelationships(uid: string): RelatedContact[]
  
  // Front matter integration
  relationshipsToFrontMatter(uid: string): [string, string][]
  frontMatterToGraph(uid: string, frontMatter: Record<string, any>): void
  
  // Consistency checking
  checkConsistency(): Array<{ sourceUID: string; targetUID: string; kind: string }>
}
```

### Supported Relationship Types

| Gendered Term | Base Kind | Reciprocal |
|---------------|-----------|------------|
| mother/father | parent | child |
| sister/brother | sibling | sibling |
| daughter/son | child | parent |
| aunt/uncle | auncle | nibling |
| wife/husband | spouse | spouse |
| girlfriend/boyfriend | partner | partner |
| friend | friend | friend |

## Performance & Safety Features

### Debouncing & Race Condition Prevention
- **1-second write-back debouncing** prevents excessive VCF file updates
- **Update flags** prevent infinite loops between file changes
- **Event debouncing** prevents UI cascade effects

### Memory Management
- **Proper cleanup** of event listeners and timers
- **Efficient graph operations** with minimal memory footprint
- **Lazy initialization** of relationship data

### Error Handling
- **Graceful degradation** when relationships can't be parsed
- **Missing contact handling** using name: namespace
- **Comprehensive logging** for debugging

## Testing

The implementation includes comprehensive tests covering:

- ✅ Relationship graph operations
- ✅ Gender inference and parsing  
- ✅ VCard RELATED field integration
- ✅ Front matter synchronization
- ✅ Consistency checking
- ✅ Complete workflow demonstrations

Run tests with: `npm run test -- relationships.spec.ts vcardRelated.spec.ts relationshipWorkflow.spec.ts`

## Configuration

No additional configuration is required. The feature works with existing plugin settings:

- **VCF Write-back**: Relationships are included in VCF exports when enabled
- **Contacts Folder**: Relationships sync within the configured contacts folder
- **REV Timestamps**: Relationship changes update REV fields appropriately

## Migration & Compatibility

This implementation is **fully backward compatible**:

- ✅ No breaking changes to existing functionality
- ✅ Existing contacts work without modification
- ✅ VCard files without RELATED fields continue to work
- ✅ New features are opt-in through usage

## Future Enhancements

Potential areas for future development:

1. **Relationship Visualization**: Graph view of contact relationships
2. **Smart Suggestions**: AI-powered relationship recommendations
3. **Bulk Operations**: Mass relationship import/export
4. **Custom Relationship Types**: User-defined relationship categories
5. **Relationship History**: Track relationship changes over time

## Support

This implementation follows the plugin's existing patterns and integrates seamlessly with current functionality. For issues or questions, refer to the comprehensive test suite and inline documentation.