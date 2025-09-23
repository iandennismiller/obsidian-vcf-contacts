# RELATED Field Implementation Summary

This document summarizes the implementation of vCard 4.0 RELATED field support and relationship graph functionality for the Obsidian VCF Contacts plugin.

## Overview

The implementation adds comprehensive support for managing contact relationships through:
- vCard 4.0 RELATED field parsing and serialization
- A directed graph data structure using Graphology library
- Bidirectional synchronization between graph, frontmatter, and markdown
- Gendered relationship handling with automatic normalization
- Event-driven updates when relationships change

## Components Implemented

### 1. Core Graph Infrastructure (`src/relationships/`)

#### `relationshipGraph.ts`
- **RelationshipGraph**: Main graph class using Graphology directed multi-graph
- **ContactNode**: Interface for storing contact metadata (UID, fullName, file reference)
- **RelationshipEdge**: Interface for relationship metadata (kind, genderless form)
- Supports multiple relationships between the same contacts
- Provides methods for adding/removing contacts and relationships
- Includes contact lookup by UID or fullName

#### `relationshipMapping.ts`
- **RELATIONSHIP_MAPPING**: Maps gendered relationships to genderless forms
- **GENDERED_RELATIONSHIPS**: Maps genderless forms to gendered variants
- Utility functions for normalizing and rendering relationships
- Gender inference from relationship types
- Supports family, romantic, and social relationship categories

#### `frontMatterSync.ts`
- **parseRelatedFromFrontMatter()**: Extracts RELATED fields from frontmatter
- **relationshipsToFrontMatter()**: Converts relationships to frontmatter format
- **syncContactToFrontMatter()**: Updates contact frontmatter from graph
- **syncFrontMatterToGraph()**: Updates graph from contact frontmatter
- Handles array indexing for multiple relationships of same type

#### `markdownParser.ts`
- **parseRelatedSection()**: Extracts relationships from markdown ## Related heading
- **renderRelatedSection()**: Generates markdown from relationships
- **updateRelatedSection()**: Updates Related section in markdown content
- **cleanupRelatedHeadings()**: Removes duplicate headings, fixes capitalization
- Supports both wiki-link and plain text relationship formats

#### `relationshipService.ts`
- **RelationshipService**: Main orchestrator class
- Initializes graph from existing contacts
- Handles bidirectional synchronization
- Manages event-driven updates
- Propagates changes to affected contacts
- Includes gender inference and updating

### 2. vCard Integration

#### Updated `src/contacts/vcard/shared/vcard.d.ts`
- Added `RELATED = "Related Person"` to VCardSupportedKey enum

#### Updated `src/contacts/vcard/parse.ts`
- Added RELATED field parsing with TYPE parameter support
- Handles both `RELATED;TYPE=friend:John Doe` and `RELATED:John Doe` formats
- Uses automatic indexing for multiple relationships of same type

#### Updated `src/contacts/vcard/toString.ts`
- Existing renderSingleKey function handles RELATED fields correctly
- Converts `RELATED[friend]` frontmatter to `RELATED;TYPE=friend:John Doe` vCard format

### 3. Plugin Integration

#### Updated `src/main.ts`
- Added RelationshipService instance to main plugin class
- Initialization from existing contacts on plugin load
- Event listeners for file modify, delete, and active file changes
- Automatic relationship synchronization when files are edited

## Frontmatter Format

Relationships are stored in frontmatter using indexed keys with namespace values:

```yaml
# Single relationship with UUID
RELATED[friend]: urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af

# Multiple relationships of same type
RELATED[friend]: urn:uuid:456e8400-e29b-41d4-a716-446655440000
RELATED[1:friend]: name:Bob Johnson
RELATED[2:friend]: uid:custom-id-123

# Different relationship types
RELATED[parent]: urn:uuid:789e8400-e29b-41d4-a716-446655440000
RELATED[sibling]: name:Jane Doe
RELATED[colleague]: uid:work-id-456
```

### Namespace Format

The values use specific namespace formats to unambiguously identify contacts:

- **`urn:uuid:`** - Used when the contact has a valid UUID as UID
- **`uid:`** - Used when the contact has a UID that's not blank and unique but not a valid UUID  
- **`name:`** - Used when the other contact note doesn't exist in Obsidian yet or has no UID

## Markdown Format

Relationships are displayed in a standardized Related section:

```markdown
## Related

- friend [[John Doe]]
- parent [[Mary Doe]]
- sibling [[Jane Doe]]
- colleague [[Mike Smith]]
```

## vCard Format

Relationships are exported as RELATED fields with namespace values:

```
RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
RELATED;TYPE=parent:name:Mary Doe
RELATED;TYPE=sibling:uid:custom-id-123
RELATED;TYPE=colleague:urn:uuid:456e8400-e29b-41d4-a716-446655440000
```

## Relationship Mappings

### Gendered to Genderless
- father/mother → parent
- son/daughter → child
- brother/sister → sibling
- aunt/uncle → auncle
- niece/nephew → nibbling
- husband/wife → spouse
- boyfriend/girlfriend → partner

### Social Relationships
- friend, colleague, neighbor, mentor, etc. → no change

## Event Handling

The system hooks into Obsidian events to maintain consistency:

1. **File Modifications**: Updates relationship graph when contact files change
2. **File Deletions**: Removes contacts and their relationships from graph
3. **Active File Changes**: Syncs relationships when switching between files
4. **Bidirectional Updates**: Changes to one contact propagate to related contacts

## Testing

Comprehensive test suite with 47 total tests:
- **relationshipGraph.spec.ts**: Core graph functionality (8 tests)
- **relationshipMapping.spec.ts**: Relationship type handling (13 tests)
- **markdownParser.spec.ts**: Markdown parsing and rendering (18 tests)
- **vcardRelated.spec.ts**: vCard RELATED field support (4 tests)
- **relationshipIntegration.spec.ts**: End-to-end workflow (4 tests)

## Dependencies

- **graphology**: Core graph data structure library
- **@types/graphology**: TypeScript definitions (attempted, not available)

## Configuration

No additional configuration required. The system:
- Uses existing contactsFolder setting
- Integrates with existing file watching
- Respects existing vCard field handling
- Works with current frontmatter processing

## Gender Handling

The system intelligently handles gendered relationships:
1. Stores relationships in genderless form internally
2. Renders relationships based on target contact's GENDER field
3. Infers gender from gendered relationship terms
4. Updates contact GENDER field when inferred from relationships

## Future Enhancements

Potential areas for extension:
1. Relationship validation rules (e.g., mutual parent-child relationships)
2. Relationship suggestions based on existing connections
3. Visual relationship graph display
4. Import/export of relationship data
5. Relationship statistics and analytics
6. Custom relationship types configuration

## Files Modified

- `package.json` - Added graphology dependency
- `src/contacts/vcard/shared/vcard.d.ts` - Added RELATED enum
- `src/contacts/vcard/parse.ts` - Added RELATED field parsing
- `src/main.ts` - Integrated RelationshipService with plugin

## Files Added

- `src/relationships/` - Complete relationship management module
- `tests/relationshipGraph.spec.ts` - Graph functionality tests
- `tests/relationshipMapping.spec.ts` - Relationship mapping tests
- `tests/markdownParser.spec.ts` - Markdown parsing tests
- `tests/vcardRelated.spec.ts` - vCard integration tests
- `tests/relationshipIntegration.spec.ts` - End-to-end tests
- `MANUAL_TESTING_RELATED.md` - Manual testing guide

This implementation provides a solid foundation for managing contact relationships while maintaining compatibility with existing vCard standards and Obsidian workflows.