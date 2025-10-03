# Development Documentation

## Architecture Overview

The VCF Contacts plugin uses a model-based architecture with clear separation of concerns. The codebase is organized into domain models, each handling a specific aspect of contact management.

### Core Models

The plugin's architecture is organized under `src/models/`:

#### ContactManager (`src/models/contactManager/`)
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

#### ContactNote (`src/models/contactNote/`)
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

#### VcardFile (`src/models/vcardFile/`)
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

#### VcardManager (`src/models/vcardManager/`)
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

#### CuratorManager (`src/models/curatorManager/`)
Processor-based system for contact operations:
- **curatorManager.ts**: Coordinates processor execution

Responsibilities:
- Register and manage curator processors
- Execute processors in appropriate order
- Handle processor dependencies

### Curator Processors

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

### Key Design Principles

1. **Model-Based Organization**: Domain logic organized by models (Contact, VCard, Manager)
2. **Separation of Concerns**: Each model handles a specific domain
3. **Processor Pattern**: Data operations implemented as independent processors
4. **Write Queue System**: Prevents file system conflicts during batch operations
5. **Bidirectional Sync**: Maintains consistency between markdown and frontmatter
6. **UID-Based References**: Contact relationships use unique identifiers
7. **Library Integration**: 
   - **Markdown**: Uses [marked](https://www.npmjs.com/package/marked) library for standard markdown parsing/rendering, with custom handling only for Obsidian-specific features (wiki-links) and contact data semantics
   - **vCard**: Uses [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard 4.0 parsing/generation per RFC 6350, with custom code only for Obsidian frontmatter mapping

### Markdown Processing Architecture

As of version 2.2.0, the plugin uses the [marked](https://www.npmjs.com/package/marked) library for all standard markdown parsing operations. This migration eliminates custom regex patterns and provides robust, standards-compliant markdown handling.

#### BaseMarkdownSectionOperations

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

#### Classes Using BaseMarkdownSectionOperations

1. **MarkdownOperations** (`markdownOperations.ts`): General markdown rendering and section management
2. **RelationshipOperations** (`relationshipOperations.ts`): Relationship parsing from Related section
3. **ContactSectionOperations** (`contactSectionOperations.ts`): Contact field parsing and sync

#### Centralized Constants

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

### vCard Processing Architecture

As of version 2.2.0, the plugin uses the [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard 4.0 parsing and generation operations. This migration eliminates custom vCard parsing/generation utilities and provides robust, RFC 6350-compliant vCard handling.

#### VCard Integration Layer

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

#### vcard4 Usage Pattern

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

#### Benefits of vcard4 Integration

This architecture:
- **Eliminates custom parsing**: All vCard parsing edge cases handled by vcard4
- **Ensures spec compliance**: Full RFC 6350 implementation guaranteed
- **Improves reliability**: Battle-tested library with comprehensive test coverage
- **Reduces maintenance**: Delegates vCard format concerns to maintained library
- **Supports extensions**: Automatic support for vCard 4.0 extensions
- **Future-proof**: Can leverage vcard4 updates and new vCard features
- **Multiple formats**: Can generate XML vCard (RFC 6351) and jCard (RFC 7095) if needed

## Development Setup

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- TypeScript knowledge
- Familiarity with Obsidian plugin development

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/iandennismiller/obsidian-vcf-contacts.git
   cd obsidian-vcf-contacts
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the plugin**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Development build** (watch mode):
   ```bash
   npm run dev
   ```

### Project Structure

```
src/
├── models/
│   ├── contactManager/        # Contact collection management
│   │   ├── contactManager.ts
│   │   ├── contactManagerData.ts
│   │   ├── contactManagerUtils.ts
│   │   └── consistencyOperations.ts
│   ├── contactNote/           # Individual contact operations
│   │   ├── contactNote.ts
│   │   ├── contactData.ts
│   │   ├── relationshipOperations.ts
│   │   ├── syncOperations.ts
│   │   ├── markdownOperations.ts
│   │   └── types.ts
│   ├── vcardFile/             # VCF file operations
│   │   ├── vcardFile.ts
│   │   ├── parsing.ts
│   │   ├── generation.ts
│   │   ├── fileOperations.ts
│   │   └── types.ts
│   ├── vcardManager/          # VCF collection management
│   │   ├── vcardManager.ts
│   │   ├── vcardCollection.ts
│   │   ├── writeQueue.ts
│   │   └── fileOperations.ts
│   └── curatorManager/        # Processor coordination
│       └── curatorManager.ts
├── curators/                  # Data operation processors
│   ├── genderInferenceProcessor.ts
│   ├── genderRenderProcessor.ts
│   ├── relatedFrontMatterProcessor.ts
│   ├── relatedListProcessor.ts
│   ├── uidProcessor.ts
│   └── ...
├── plugin/                    # Plugin infrastructure
│   ├── services/
│   ├── settings/
│   └── ui/
├── interfaces/                # Type definitions
└── main.ts                    # Plugin entry point
```

## Key Concepts

### Relationship Management

The plugin provides comprehensive bidirectional relationship tracking:

```typescript
// Relationships are defined in markdown
## Related
- mother [[Jane Doe]]
- colleague [[John Smith]]

// And synchronized to frontmatter
RELATED[parent]: urn:uuid:jane-doe-uuid
RELATED[colleague]: urn:uuid:john-smith-uuid
```

Key features:
- **Bidirectional Sync**: Changes in one contact automatically update related contacts
- **Gender-Aware Terms**: Automatically converts relationship terms based on gender (e.g., parent → mother/father)
- **UID-Based References**: Uses unique identifiers to maintain relationships across name changes
- **Reciprocal Updates**: Adding "daughter [[Jane]]" to John automatically adds "father [[John]]" to Jane

### Curator Processors

The plugin uses a processor-based architecture for data operations:

```typescript
export interface CuratorProcessor {
  name: string;
  enabled: boolean;
  process(contact: Contact): Promise<void>;
}
```

Processors handle specific operations:
- Data validation and transformation
- Relationship synchronization
- Gender inference and rendering
- VCF format conversion
- UID management

### Contact Data Structure

```typescript
export type Contact = {
  file: TFile;
  data: Record<string, any>;
};
```

Contact data includes:
- Standard vCard fields (FN, N, EMAIL, TEL, etc.)
- Relationship references (RELATED fields)
- Metadata (UID, REV, VERSION)
- Custom fields

## Testing

### Test Organization

Tests are organized by component and user story:

```
tests/
├── units/                     # Unit tests for models and processors
│   ├── models/
│   │   ├── contactNote/
│   │   ├── vcardFile/
│   │   └── ...
│   ├── curators/
│   └── services/
├── stories/                   # User story integration tests
│   ├── bidirectionalRelationshipSync.spec.ts
│   ├── singleVcfFileSync.spec.ts
│   ├── individualVcfFolderSync.spec.ts
│   └── vcfDropImport.spec.ts
└── demo-data/                 # Tests using demo contact data
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode  
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

Tests use Vitest as the testing framework:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactNote } from '../src/models/contactNote';

describe('ContactNote', () => {
  let contactNote: ContactNote;

  beforeEach(() => {
    // Setup test fixtures
  });

  it('should parse relationships from markdown', async () => {
    // Test implementation
  });
});
```

### Testing Relationships

Relationship testing is a key focus:

```typescript
it('should add reciprocal relationships bidirectionally', async () => {
  // Add relationship in one contact
  await addRelationship(contact1, 'father', contact2);
  
  // Verify reciprocal relationship is added
  const relationships = await contact2.parseRelatedSection();
  expect(relationships).toContainEqual({
    type: 'child',
    contactName: contact1.basename
  });
});
```

## Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes following the coding standards
4. **Test** your changes: `npm test`
5. **Build** to ensure no errors: `npm run build`
6. **Commit** with clear messages: `git commit -m "Add feature X"`
7. **Push** to your fork: `git push origin feature/my-feature`
8. **Create** a Pull Request

### Coding Standards

- **TypeScript**: Use strict TypeScript with proper typing
- **ESLint**: Follow the configured ESLint rules
- **Comments**: Add JSDoc comments for public methods
- **Tests**: Include tests for new functionality
- **Model Organization**: Keep related functionality within appropriate models

### Architecture Guidelines

1. **Model-Based Organization**: Place functionality in appropriate domain models
2. **Processor Pattern**: Implement data operations as processors when possible
3. **Separation of Concerns**: Keep parsing, business logic, and UI separate
4. **Dependency Injection**: Use dependency injection for testability
5. **Error Handling**: Implement proper error handling and logging

## Plugin API

### Extending the Plugin

The plugin provides extension points through the processor system:

#### Custom Processors

Create custom curator processors:

```typescript
import { CuratorProcessor } from 'src/interfaces/CuratorProcessor';

export const MyCustomProcessor: CuratorProcessor = {
  name: "My Custom Processor",
  enabled: true,
  
  async process(contact: Contact): Promise<void> {
    // Your processing logic here
    // Access contact data via contact.file and contact.data
  }
};

// Register the processor
curatorManager.register(MyCustomProcessor);
```

#### Relationship Operations

Work with relationships programmatically:

```typescript
import { ContactNote } from 'src/models/contactNote';

// Parse relationships from a contact
const contactNote = new ContactNote(app, settings, file);
const relationships = await contactNote.parseRelatedSection();

// Add a relationship
await contactNote.addRelationship('friend', 'John Doe');

// Sync relationships bidirectionally
await contactManager.syncContactFile(file);
```

#### VCF Operations

Work with VCF files using the vcard4 library integration:

```typescript
import { VcardFile } from 'src/models/vcardFile';
import { parse } from 'vcard4';

// Parse a VCF file (uses vcard4 library internally)
const vcardFile = await VcardFile.fromFile(filePath);

// Iterate through parsed contacts
for await (const [slug, contact] of vcardFile.parse()) {
  console.log(`Contact: ${slug}`, contact);
}

// Generate VCF from Obsidian contact files (uses vcard4 library)
const result = await VcardFile.fromObsidianFiles([file], app);
console.log(result.vcards); // Valid vCard 4.0 string
console.log(result.errors);  // Any errors during generation

// Direct vcard4 library usage
const vcfContent = await readFile('contact.vcf');
const parsedCard = parse(vcfContent);
// Access parsed vCard properties
console.log(parsedCard.getProperty('FN'));
console.log(parsedCard.getProperty('EMAIL'));
```

**Note**: The plugin uses the [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard parsing and generation. The library fully implements RFC 6350 (vCard 4.0) and handles all parsing edge cases, field validation, and structured field processing. Custom code focuses on mapping between vcard4's data structures and Obsidian's frontmatter format.

## Deployment

### Building for Release

1. **Update version** in `manifest.json` and `package.json`
2. **Run tests**: `npm test`
3. **Check coverage**: `npm run test:coverage`
4. **Build**: `npm run build`
5. **Create release**: Tag and create GitHub release
6. **Publish**: Submit to Obsidian community plugins (if applicable)

### Release Checklist

- [ ] Version numbers updated
- [ ] Tests passing
- [ ] Coverage targets met
- [ ] Build successful
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Breaking changes noted
- [ ] Migration guide provided (if needed)

## Testing and Code Quality

### Running Tests

The plugin uses [Vitest](https://vitest.dev/) for unit testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Coverage

Coverage reports are generated in `./docs/coverage/` directory. The project maintains the following coverage standards:

**Current Coverage (as of latest update):**
- **Overall**: ~70% statements, ~60% branches, ~70% functions
- **Core Models**: 85%+ coverage target
- **Business Logic**: 70%+ coverage target
- **UI Components**: Excluded (browser/DOM dependent)

**Coverage by Module:**

High Coverage Modules (>85%):
- `src/models/contactManager/` - Contact collection management
- `src/models/vcardFile/` - VCF file operations  
- `src/models/curatorManager/` - Curator processor system
- `src/models/vcardManager/` - VCard folder monitoring

Medium Coverage Modules (60-85%):
- `src/models/contactNote/` - Individual contact operations
- `src/plugin/context/` - Shared context providers

Excluded from Coverage:
- `src/main.ts` - Plugin lifecycle (requires Obsidian runtime)
- `src/plugin/settings.ts` - Settings UI (requires Obsidian DOM)
- `src/plugin/services/syncWatcher.ts` - File system watcher (requires runtime)
- `src/plugin/ui/` - UI components (browser/DOM APIs)

### Writing Tests

Tests are organized by module structure:

```
tests/
├── units/              # Unit tests mirroring src/ structure
│   ├── models/
│   │   ├── contactManager/
│   │   ├── contactNote/
│   │   ├── vcardFile/
│   │   └── vcardManager/
│   ├── curators/
│   └── services/
├── stories/            # Integration tests for user stories
└── fixtures/           # Test data and utilities
```

**Test Patterns:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform expected behavior', () => {
    // Arrange
    const mockData = createMockData();
    
    // Act
    const result = myFunction(mockData);
    
    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

**Mocking Guidelines:**

1. **Mock External Dependencies**: Use `vi.mock()` for Obsidian APIs and file system
2. **Test Business Logic**: Focus tests on logic, not implementation details
3. **Use Test Fixtures**: Leverage shared fixtures for consistent test data
4. **Avoid Over-Mocking**: Test real implementations where possible

**Coverage Exclusions:**

Mark browser/DOM-dependent code with:
```typescript
/* istanbul ignore next */
// Explanation of why this code requires browser runtime
export function domDependentFunction() {
  // Implementation
}
```

### Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Release tags

Coverage reports are generated and can be viewed in the PR checks.

## Deployment

### Common Issues

1. **Build Errors**: Verify TypeScript version and dependencies are installed
2. **Test Failures**: Ensure test environment is properly configured
3. **Plugin Loading**: Verify manifest.json format
4. **Relationship Sync Issues**: Check that contacts have valid UIDs
5. **VCF Parse Errors**: Ensure VCF files follow vCard 4.0 format

### Debugging

1. **Console Logging**: Check Obsidian dev console (Ctrl+Shift+I)
2. **Test Debugging**: Run tests with `--reporter=verbose` flag
3. **Processor Debugging**: Add logging to individual processors
4. **Relationship Issues**: Use test fixtures to isolate problems

## Getting Help

- **Issues**: Report bugs on [GitHub Issues](https://github.com/iandennismiller/obsidian-vcf-contacts/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/iandennismiller/obsidian-vcf-contacts/discussions)

This documentation reflects the current model-based architecture and relationship-focused features of the VCF Contacts plugin.