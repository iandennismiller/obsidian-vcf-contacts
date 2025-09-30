
# VCF Contacts Plugin for Obsidian

Manage contacts in Obsidian using the vCard 4.0 standard format. This plugin integrates contact data with your knowledge base, enabling relationship tracking and bidirectional synchronization with external contact management systems.

## Documentation

- [Installation Guide](docs/installation.md)
- [Getting Started](docs/getting-started.md)
- [Feature Overview](docs/features.md)
- [VCard Format Guide](docs/vcard-format.md)
- [Development](docs/development.md)
- [User Stories](docs/user-stories.md)

## Core Features

- **vCard 4.0 Standard**: Full compliance with vCard format for interoperability
- **Relationship Management**: Bidirectional relationship tracking between contacts with automatic reciprocal updates
- **Folder Watching**: Monitor external VCF folders and automatically sync changes
- **Import/Export**: Standard VCF file import and export functionality
- **UID-Based Linking**: Contact references use unique identifiers to maintain integrity across name changes
- **Gender-Aware Processing**: Automatic relationship term conversion based on contact gender

## Architecture

The plugin uses a modular architecture organized around core models:

- **ContactManager**: Collection-level operations and contact file management
- **ContactNote**: Individual contact operations, relationships, and markdown rendering
- **VcardFile**: VCF file parsing, generation, and validation
- **VcardManager**: VCF collection management with write queue system
- **CuratorManager**: Processor-based system for contact data operations

## Relationship Features

The plugin provides comprehensive relationship tracking capabilities:

- Define relationships in a "Related" section using markdown list syntax
- Automatic bidirectional relationship synchronization
- Gender-aware relationship terms (e.g., mother/father, son/daughter)
- Support for standard relationship types: family, professional, and social
- Relationships stored in vCard RELATED fields for standards compliance

## Support

- [Report Issues](https://github.com/iandennismiller/obsidian-vcf-contacts/issues)
- [Discussions](https://github.com/iandennismiller/obsidian-vcf-contacts/discussions)
- [Development Guide](docs/development.md)

## License

MIT License. See [LICENSE](LICENSE) for details.
