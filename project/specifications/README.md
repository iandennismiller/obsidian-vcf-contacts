# Technical Specifications Index

This directory contains technical specifications for the VCF Contacts plugin. Specifications describe **how** the system implements features, while user stories describe **what** users want to accomplish.

## Specification Documents

### [Library Integration Specification](library-integration-spec.md)
Describes the integration of external libraries (marked, vcard4, yaml) and the separation of concerns between standard format handling and custom plugin logic.

**Key Topics:**
- Markdown processing with marked library
- vCard processing with vcard4 library
- YAML processing with yaml library
- Design philosophy and architecture

### [Relationship Management Specification](relationship-management-spec.md)
Comprehensive specification for managing bidirectional relationships between contacts using the vCard RELATED field.

**Key Topics:**
- The Related section in markdown
- RELATED field format in frontmatter
- Bidirectional synchronization
- Gender support and rendering
- Validation and consistency

### [Contact Section Specification](contact-section-spec.md)
Specification for the Contact section feature that displays contact information in human-readable markdown format.

**Key Topics:**
- Contact section format
- Contact list parsing
- Field type detection
- Kind/type prefix extraction
- Bidirectional sync between Contact section and frontmatter

### [VCF Sync Specification](vcf-sync-spec.md)
Describes synchronization between Obsidian contact notes and vCard (VCF) files.

**Key Topics:**
- Sync modes (single file, individual files, folder monitoring)
- Sync direction (Obsidian → VCF, VCF → Obsidian)
- Field mapping
- Conflict resolution
- Performance optimization

### [Gender Processing Specification](gender-processing-spec.md)
Specification for gender-aware relationship processing that stores genderless types internally but renders gendered terms.

**Key Topics:**
- Gender field format
- Genderless storage, gendered display
- Relationship type mappings
- Gender inference from relationship terms
- Bidirectional consistency

### [Curator Pipeline Specification](curator-pipeline-spec.md)
Describes the processor-based system for contact operations and how sequential execution prevents data loss.

**Key Topics:**
- Curator manager and processor coordination
- Processor types (IMMEDIATELY, UPCOMING, IMPROVEMENT)
- Sequential execution to prevent race conditions
- Standard processors
- State management and error handling

### [vCard Format Specification](vcard-format-spec.md)
Reference documentation for vCard 4.0 format and field mappings used by the plugin.

**Key Topics:**
- vCard 4.0 standard fields
- Custom extensions and parameters
- Obsidian frontmatter mapping
- Field validation rules

## Relationship to User Stories

| Specification | Related User Stories |
|--------------|---------------------|
| Library Integration | Architecture section (moved to specs) |
| Relationship Management | Stories 6-11b, 13, 14 |
| Contact Section | Stories 30-42 |
| VCF Sync | Stories 1-5, 15-17, 22, 39 |
| Gender Processing | Stories 13 |
| Curator Pipeline | Stories 24-26 |

## Specification Guidelines

When writing specifications:

1. **Focus on How**: Describe implementation details, not user needs
2. **Be Precise**: Include exact formats, algorithms, and rules
3. **Show Examples**: Provide code snippets and data examples
4. **Define Interfaces**: Specify APIs, methods, and data structures
5. **Link to User Stories**: Reference related user stories for context
6. **Update Tests**: Ensure test files reference the specification

## Related Documentation

- **User Stories**: See [/project/user-stories](../user-stories/) for what users want
- **Plans**: See [/project/plans](../plans/) for implementation planning
- **References**: See [/project/references](../references/) for 3rd-party library docs
- **User Guides**: See [/docs](../../docs/) for end-user documentation
