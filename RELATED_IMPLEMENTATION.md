# vCard 4.0 RELATED Field Support with Relationship Graph

This implementation adds comprehensive support for vCard 4.0 RELATED fields, enabling users to build and maintain their own social network locally within Obsidian.

## Features Implemented

### 1. vCard 4.0 RELATED Field Support
- **Parsing**: Automatically parses RELATED fields from vCard files
- **Generation**: Generates RELATED fields when exporting to vCard format
- **Namespaces**: Supports `urn:uuid:`, `name:`, and `uid:` namespaces for contact references
- **Multiple Relations**: Handles multiple relationships of the same type between contacts

### 2. Relationship Graph with Graphology
- **Directed Graph**: Uses Graphology library for efficient relationship management
- **Node Identification**: Contacts identified by UID (preferred) or full name as fallback
- **Edge Attributes**: Relationships stored as directed edges with type attributes
- **Multiple Relations**: Supports multiple relationship types between same contacts

### 3. Front Matter Integration
- **Indexed Arrays**: Uses Obsidian-compatible notation like `RELATED[friend]`, `RELATED[1:friend]`
- **Automatic Sorting**: Relationships sorted by value for consistency
- **REV Timestamp**: Automatically updates REV field when relationships change
- **Gender Support**: Parses GENDER field and infers gender from relationship types

### 4. Obsidian Note Integration
- **Related Section**: Automatically manages "## Related" sections in contact notes
- **Markdown Lists**: Parses lists like `- friend [[Contact Name]]`
- **Bidirectional Sync**: Changes in markdown sync to front matter and vice versa
- **Event Handling**: Responds to file open/close and modification events

### 5. Consistency & Graph Operations
- **Backlink Checking**: Ensures relationship consistency across contacts
- **Propagation**: Updates both contacts when relationships change
- **Debouncing**: Prevents excessive sync operations
- **VCF Drop Support**: Handles VCF files dropped into the vault

## Usage Examples

### vCard with RELATED Fields
```vcf
BEGIN:VCARD
VERSION:4.0
FN:John Doe
UID:john-doe-123
RELATED;TYPE=friend:urn:uuid:jane-smith-456
RELATED;TYPE=colleague:name:Bob Wilson
RELATED;TYPE=parent:uid:mary-doe-789
END:VCARD
```

### Front Matter Representation
```yaml
---
FN: John Doe
UID: john-doe-123
RELATED[friend]: urn:uuid:jane-smith-456
RELATED[colleague]: name:Bob Wilson
RELATED[parent]: uid:mary-doe-789
REV: 20240323T120000Z
---
```

### Markdown Related Section
```markdown
# John Doe

## Related

- colleague [[Bob Wilson]]
- friend [[Jane Smith]]
- parent [[Mary Doe]]

## Notes
...
```

### Gender Inference
When a user adds a relationship like "mother" or "father", the system:
1. Infers the gender of the related contact
2. Updates the related contact's GENDER field in front matter
3. Stores the relationship using the genderless type ("parent")
4. Updates REV timestamps for both contacts

## Technical Architecture

### Core Classes

1. **RelationshipGraph**: Manages the graph structure using Graphology
2. **RelationshipManager**: Handles bidirectional mapping between vCard, graph, and front matter
3. **RelationshipListManager**: Manages markdown Related sections
4. **RelationshipEventManager**: Handles Obsidian events for real-time sync

### Data Flow

```
vCard RELATED fields ↔ RelationshipGraph ↔ Front Matter ↔ Markdown Lists
```

### Event Handling

- **File Open**: Sync front matter → Related list
- **File Close**: Sync Related list → front matter
- **File Modify**: Debounced sync of Related list changes
- **VCF Drop**: Process and integrate new VCF files

## Benefits

1. **Local Social Network**: Build and maintain relationships locally
2. **Standard Compliance**: Uses vCard 4.0 standard for interoperability
3. **Obsidian Integration**: Native support for Obsidian's linking and front matter
4. **Real-time Sync**: Automatic synchronization between all representations
5. **Consistency**: Ensures relationship data stays consistent across contacts
6. **Extensible**: Easy to add new relationship types and behaviors

## Implementation Notes

### Minimal Changes Strategy
- New functionality added as separate modules
- Existing vCard parsing extended without breaking changes
- Event handling isolated to prevent interference with existing features
- Optional gender inference doesn't disrupt existing workflows

### Performance Considerations
- Debounced sync operations prevent excessive updates
- Graph operations are efficient with Graphology
- Event handlers only process contact files
- Incremental updates rather than full rebuilds

### Error Handling
- Graceful fallbacks when contacts don't exist
- Robust parsing of malformed relationship data
- Comprehensive logging for debugging
- Isolation prevents relationship errors from affecting other plugin features

This implementation provides a solid foundation for relationship management while maintaining compatibility with existing plugin functionality.