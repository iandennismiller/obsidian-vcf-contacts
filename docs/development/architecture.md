# Architecture

The VCF Contacts plugin uses a model-based architecture with clear separation of concerns. The codebase is organized into domain models, each handling a specific aspect of contact management.

## Core Models

The plugin's architecture is organized under `src/models/`:

### ContactManager (`src/models/contactManager/`)
Manages the collection of contact notes in the vault:
- **contactManager.ts**: Main interface for contact collection operations
- **contactManagerData.ts**: Contact caching and data access
- **contactManagerUtils.ts**: Utility functions for contact file operations
- **consistencyOperations.ts**: Ensures data consistency across contacts

Responsibilities:
- Contact file detection and scanning
- UID-based contact lookup and caching
- Bidirectional relationship synchronization
- Contact collection consistency operations

### ContactNote (`src/models/contactNote/`)
Manages individual contact note operations:
- **contactNote.ts**: Main ContactNote class with core functionality
- **contactData.ts**: Contact data access and manipulation
- **relationshipOperations.ts**: Relationship parsing and management
- **syncOperations.ts**: Synchronization between markdown and frontmatter
- **markdownOperations.ts**: Markdown rendering and section management
- **types.ts**: Type definitions for contact operations

Responsibilities:
- Individual contact CRUD operations
- Relationship parsing from markdown and frontmatter
- Gender-aware relationship term processing
- Frontmatter and markdown synchronization
- Related section rendering

### VcardFile (`src/models/vcardFile/`)
Handles VCF file operations and integration with the vcard4 library:
- **vcardFile.ts**: Main VCardFile class
- **parsing.ts**: Integration with vcard4 parser, converting to Obsidian frontmatter
- **generation.ts**: Integration with vcard4 generator, converting from Obsidian frontmatter
- **fileOperations.ts**: File system operations for VCF files
- **types.ts**: VCard-specific type definitions

Responsibilities:
- Integration with vcard4 library for parsing/generation (vCard 4.0 format per RFC 6350)
- Conversion between vcard4 parsed objects and Obsidian frontmatter format
- Conversion between Obsidian frontmatter and vcard4 property objects
- File system operations (read, write, list VCF files)

**Technical Note**: The vcard4 library handles all vCard 4.0 parsing, generation, field validation, structured field handling, and line folding per RFC 6350. Custom code focuses only on mapping between vcard4's data structures and Obsidian's frontmatter format.

### VcardManager (`src/models/vcardManager/`)
Manages collections of VCF files:
- **vcardManager.ts**: Main manager for VCF collections
- **vcardCollection.ts**: Collection management logic
- **writeQueue.ts**: Queued write operations to prevent conflicts
- **fileOperations.ts**: Batch file operations

Responsibilities:
- VCF collection management
- Write queue system for controlled file operations
- Batch processing of VCF files
- Coordination between multiple VCF file operations

### CuratorManager (`src/models/curatorManager/`)
Processor-based system for contact operations:
- **curatorManager.ts**: Coordinates processor execution

Responsibilities:
- Register and manage curator processors
- Execute processors in appropriate order
- Handle processor dependencies

## Curator Processors

The plugin uses a processor-based architecture for data operations (`src/curators/`). Each processor handles a specific aspect of contact data management:

- **genderInferenceProcessor**: Infers gender from relationship terms
- **genderRenderProcessor**: Renders gender-aware relationship terms
- **relatedFrontMatterProcessor**: Syncs relationships to frontmatter
- **relatedListProcessor**: Syncs relationships to Related section
- **relatedNamespaceUpgradeProcessor**: Migrates old relationship formats
- **relatedOtherProcessor**: Handles special relationship types
- **uidProcessor**: Manages contact UIDs
- **vcardSyncPreProcessor**: Prepares contacts for VCF sync
- **vcardSyncPostProcessor**: Finalizes VCF sync operations

## Key Design Principles

1. **Model-Based Organization**: Domain logic organized by models (Contact, VCard, Manager)
2. **Separation of Concerns**: Each model handles a specific domain
3. **Processor Pattern**: Data operations implemented as independent processors
4. **Write Queue System**: Prevents file system conflicts during batch operations
5. **Bidirectional Sync**: Maintains consistency between markdown and frontmatter
6. **UID-Based References**: Contact relationships use unique identifiers
7. **Library Integration**: 
   - **Markdown**: Uses [marked](https://www.npmjs.com/package/marked) library for standard markdown parsing/rendering, with custom handling only for Obsidian-specific features (wiki-links) and contact data semantics
   - **vCard**: Uses [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard 4.0 parsing/generation per RFC 6350, with custom code only for Obsidian frontmatter mapping
   - **YAML**: Uses [yaml](https://www.npmjs.com/package/yaml) library for all YAML parsing/generation, with custom code only for Obsidian constraints (flat structure, custom key formats)

## Markdown Processing Architecture

As of version 2.2.0, the plugin uses the [marked](https://www.npmjs.com/package/marked) library for all standard markdown parsing operations. This migration eliminates custom regex patterns and provides robust, standards-compliant markdown handling.

### BaseMarkdownSectionOperations

All markdown operations extend from `BaseMarkdownSectionOperations` (`src/models/contactNote/baseMarkdownSectionOperations.ts`), which provides:

**Core Methods:**
- `extractSection(sectionName)`: Extract content from a named section
- `updateSection(sectionName, content)`: Update or create a section
- `extractAllSections()`: Get all sections as structured data
- `extractMarkdownSections()`: Get sections as a Map (for backward compatibility with tests)

**What Marked Library Handles:**
- Heading detection and hierarchy (`##`, `###`, `####`, etc.)
- List structure parsing (ordered, unordered, nested)
- Whitespace normalization
- Line break handling
- Paragraph and block-level element parsing

**Custom Parsing (Domain-Specific):**
- **Wiki-Links**: Obsidian's `[[Contact Name]]` syntax
- **Contact Semantics**: Email/phone/URL pattern detection and extraction
- **Relationship Types**: Gender-aware relationship term processing
- **VCard Mapping**: Contact field type identification and frontmatter conversion

### Classes Using BaseMarkdownSectionOperations

1. **MarkdownOperations** (`markdownOperations.ts`): General markdown rendering and section management
2. **RelationshipOperations** (`relationshipOperations.ts`): Relationship parsing from Related section
3. **ContactSectionOperations** (`contactSectionOperations.ts`): Contact field parsing and sync

### Centralized Constants

All markdown-related constants are centralized in `markdownConstants.ts`:
- `SECTION_NAMES`: Standardized section names (Notes, Related, Contact)
- `HEADING_LEVELS`: Heading depth definitions
- `VCARD_FIELD_TYPES`: VCard field type constants
- `FIELD_DISPLAY`: Field display information (icons, labels)
- `REGEX_PATTERNS`: Reusable regex patterns for wiki-links and fields

This architecture:
- **Reduces complexity**: ~70 custom regex patterns eliminated
- **Improves maintainability**: Single source of truth for markdown operations
- **Enhances reliability**: Battle-tested marked library handles edge cases
- **Future-proof**: Can leverage marked library updates and extensions

## vCard Processing Architecture

As of version 2.2.0, the plugin uses the [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard 4.0 parsing and generation operations. This migration eliminates custom vCard parsing/generation utilities and provides robust, RFC 6350-compliant vCard handling.

### VCard Integration Layer

The VcardFile model (`src/models/vcardFile/`) integrates with vcard4 through specialized components:

**Core Components:**
- `VCardParser` (`parsing.ts`): Integrates vcard4 parser, converts to Obsidian frontmatter
- `VCardGenerator` (`generation.ts`): Integrates vcard4 generator, converts from Obsidian frontmatter
- `VCardFileOperations` (`fileOperations.ts`): File I/O for VCF files

**What vcard4 Library Handles:**
- **Full RFC 6350 Compliance**: Complete vCard 4.0 specification implementation
- **Parsing**: Reading and parsing vCard files into structured objects
- **Generation**: Creating valid vCard 4.0 output from structured data
- **Field Validation**: Ensuring fields comply with RFC 6350
- **Structured Fields**: Parsing complex fields (N, ADR, GENDER, etc.)
- **Line Folding/Unfolding**: Proper handling of long lines per spec
- **Property Parameters**: TYPE, PREF, VALUE, and other vCard parameters
- **Special Properties**: RELATED, PHOTO, GEO, and all vCard 4.0 properties
- **Extensions**: RFC 6474, RFC 8605, RFC 6715, RFC 6868, RFC 6473, RFC 7852

**Custom Integration Code (Obsidian-Specific):**
- **Frontmatter Mapping**: Converting between vcard4 parsed objects and Obsidian YAML frontmatter
- **UID Management**: Generating and tracking unique contact identifiers
- **Relationship Extensions**: Custom RELATED field handling for bidirectional relationships
- **File Sync Coordination**: Managing sync between Obsidian notes and VCF files

### vcard4 Usage Pattern

```typescript
import { parse, VCARD, FNProperty, TextType } from 'vcard4';

// Parsing vCard files
const vcardContent = await readVCFFile('contact.vcf');
const parsedCard = parse(vcardContent);
// parsedCard contains structured vCard data with properties, groups, etc.

// Generating vCard files
const fn = new FNProperty([], new TextType("John Doe"));
const card = new VCARD([fn, /* other properties */]);
const vcfContent = card.repr(); // Returns valid vCard 4.0 string
```

### Benefits of vcard4 Integration

This architecture:
- **Eliminates custom parsing**: All vCard parsing edge cases handled by vcard4
- **Ensures spec compliance**: Full RFC 6350 implementation guaranteed
- **Improves reliability**: Battle-tested library with comprehensive test coverage
- **Reduces maintenance**: Delegates vCard format concerns to maintained library
- **Supports extensions**: Automatic support for vCard 4.0 extensions
- **Future-proof**: Can leverage vcard4 updates and new vCard features
- **Multiple formats**: Can generate XML vCard (RFC 6351) and jCard (RFC 7095) if needed

## YAML Processing Architecture

As of version 2.3.0, the plugin uses the [yaml](https://www.npmjs.com/package/yaml) library for all YAML parsing and generation operations. This migration eliminates custom YAML parsing/generation utilities and provides robust, YAML 1.2-compliant handling.

### YAML Integration Layer

The YAML processing is integrated throughout the codebase wherever frontmatter is parsed or generated:

**Core Usage:**
- `ContactData` (`contactData.ts`): Uses yaml library for frontmatter parsing and generation
- `ContactNote` (`contactNote.ts`): Delegates YAML operations to yaml library
- Test utilities: Uses yaml library instead of manual parsing

**What yaml Library Handles:**
- **Full YAML 1.2 Compliance**: Complete YAML specification implementation
- **Parsing**: Reading and parsing YAML strings into JavaScript objects
- **Generation**: Creating valid YAML output from JavaScript objects
- **Type Preservation**: Maintaining proper types (strings, numbers, booleans, null)
- **Comment Handling**: Preserving comments when possible
- **Multi-line Strings**: Proper handling of multi-line string values
- **Special Characters**: Automatic escaping and quoting as needed per YAML spec
- **Anchors and Aliases**: Full support for YAML references
- **Custom Tags**: Support for YAML tags if needed

**Custom Integration Code (Obsidian-Specific):**
- **Flat Structure Enforcement**: Ensures frontmatter remains flat (non-nested) as required by Obsidian
- **Object Flattening/Unflattening**: Uses the [flat](https://www.npmjs.com/package/flat) library to convert between hierarchical vCard structures and flat frontmatter
- **vCard Property Mapping**: Converts between vcard4 property objects and flat frontmatter fields
- **Frontmatter Boundary Detection**: Identifies YAML frontmatter delimiters (`---`) in markdown

### yaml Usage Pattern

```typescript
import { parse, stringify } from 'yaml';
import { flatten, unflatten } from 'flat';

// Parsing YAML frontmatter
const frontmatterContent = extractFrontmatter(markdownContent);
const frontmatter = parse(frontmatterContent);
// frontmatter is a JavaScript object with all parsed fields

// Converting to nested object for vCard processing
const nested = unflatten(frontmatter, { delimiter: '.' });

// Generating YAML frontmatter from nested object
const nested = {
  UID: 'uuid-123',
  FN: 'John Doe',
  EMAIL: {
    WORK: 'john@example.com'
  },
  RELATED: {
    friend: 'urn:uuid:jane-456'
  }
};
const frontmatter = flatten(nested, { delimiter: '.' });
const yamlContent = stringify(frontmatter);
// yamlContent is valid YAML string with dot notation keys
```

### Benefits of yaml + flat Integration

This architecture:
- **Eliminates custom parsing**: All YAML parsing edge cases handled by yaml library
- **Standardized flattening**: Industry-standard approach using flat library
- **Ensures spec compliance**: Full YAML 1.2 and vCard 4.0 implementation guaranteed
- **Improves reliability**: Battle-tested libraries with comprehensive test coverage
- **Reduces maintenance**: Delegates format concerns to maintained libraries
- **Better type handling**: Automatic type inference and preservation
- **Consistent behavior**: Same YAML handling as other YAML-based tools
- **Deterministic ordering**: flat library ensures consistent key ordering

### Obsidian Constraints

**Important**: Obsidian's frontmatter has specific constraints:
1. **Flat Structure**: Keys and values may not be nested; all keys must be at the root level
2. **String Keys**: All keys are strings (though values can be various types)
3. **Dot Notation**: Hierarchical data represented through dot notation

The plugin maintains these constraints using the flat library:
- Single values: `EMAIL: john@example.com`
- Structured fields: `EMAIL.WORK: john@example.com`
- Array values: `RELATED.friend.0: urn:uuid:jane-456`, `RELATED.friend.1: urn:uuid:bob-789`
- Nested structures: `ADR.HOME.STREET: 123 Main St`

The flat library handles conversion between nested objects and dot notation, while yaml handles YAML serialization.
