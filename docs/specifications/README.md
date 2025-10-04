# Technical Specifications

This directory contains technical specifications for the VCF Contacts plugin. Specifications describe **what** the system does and the **outcomes** it achieves, without prescribing implementation details.

## Specification Documents

### [Contact Section Specification](contact-section.md)
Describes the Contact section feature that displays contact information in human-readable markdown format.

**Key Topics:**
- Contact section format and syntax
- Field type detection rules
- Kind/type prefix extraction
- Bidirectional sync between Contact section and frontmatter
- Display formatting with emoji prefixes
- Integration with VCF sync

### [Relationship Management Specification](relationship-management.md)
Specification for managing bidirectional relationships between contacts using the vCard RELATED field.

**Key Topics:**
- The Related section in markdown
- RELATED field format in frontmatter
- Bidirectional synchronization
- Gender support and rendering
- Validation and consistency rules
- REV field management

### [VCF Sync Specification](vcf-sync.md)
Describes synchronization between Obsidian contact notes and vCard (VCF) files.

**Key Topics:**
- Sync modes (single file, individual files, folder monitoring)
- Sync direction (Obsidian → VCF, VCF → Obsidian)
- Field mapping between vCard and frontmatter
- Conflict resolution strategies
- Performance optimization

### [Gender Processing Specification](gender-processing.md)
Specification for gender-aware relationship processing that stores genderless types internally but renders gendered terms.

**Key Topics:**
- Gender field format
- Genderless storage, gendered display
- Relationship type mappings by gender
- Gender inference from relationship terms
- Bidirectional consistency

### [Library Integration Specification](library-integration.md)
Describes the integration of external libraries and the separation of concerns between standard format handling and custom plugin logic.

**Key Topics:**
- Markdown processing with marked library
- vCard processing with vcard4 library
- YAML processing with yaml library
- Object flattening with flat library
- Design philosophy and architecture

### [Curator Pipeline Specification](curator-pipeline.md)
Describes the processor-based system for contact operations and how sequential execution prevents data loss.

**Key Topics:**
- Curator manager and processor coordination
- Processor types (IMMEDIATELY, UPCOMING, IMPROVEMENT)
- Sequential execution to prevent race conditions
- Standard processors
- State management and error handling

### [vCard Format Specification](vcard-format.md)
Reference documentation for vCard 4.0 format and field mappings used by the plugin.

**Key Topics:**
- vCard 4.0 standard fields
- Field organization and dot notation
- Obsidian frontmatter mapping
- Type labels and categorization
- Best practices

## Specification Guidelines

When writing specifications:

1. **Focus on Outcomes**: Describe what the system does, not how it does it
2. **Be Precise**: Include exact formats, rules, and expected behaviors
3. **Avoid Implementation Details**: No code examples or implementation specifics
4. **Show Data Examples**: Provide input/output examples and data formats
5. **Define Interfaces**: Specify data structures and field formats
6. **Link to Related Specs**: Reference other specifications for context

## Related Documentation

- **User Stories**: See [/project/user-stories](../../project/user-stories/) for what users want to accomplish
- **Plans**: See [/project/plans](../../project/plans/) for implementation planning
- **References**: See [/project/references](../../project/references/) for 3rd-party library docs
- **User Guides**: See [/docs](../) for end-user documentation
- **Development Guide**: See [/docs/development](../development/) for development instructions

## Note on Code Examples

These specifications intentionally avoid code examples to focus on outcomes and behaviors rather than implementation details. The development guide and inline code comments provide implementation guidance.
