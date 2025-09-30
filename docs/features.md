# Feature Overview

## Core Capabilities

### Relationship Management

The plugin's primary focus is on tracking and managing relationships between contacts:

#### Bidirectional Relationship Tracking
- Define relationships in a markdown "Related" section using familiar wiki-link syntax
- Automatic reciprocal relationship creation (adding "father [[John]]" to Jane automatically adds "child [[Jane]]" to John)
- Gender-aware relationship terms (parent → mother/father, child → son/daughter)
- Support for complex relationship types: family, professional, and social

#### Relationship Synchronization
- Bidirectional sync between markdown "Related" section and vCard RELATED fields
- Changes in one contact automatically propagate to related contacts
- UID-based references maintain relationship integrity across contact name changes
- Consistency validation ensures all relationships are reciprocal

#### Supported Relationship Types
- **Family**: parent, child, sibling, spouse, partner, cousin, grandparent, grandchild, aunt, uncle, niece, nephew
- **Professional**: colleague, boss, employee, manager, coworker, assistant
- **Social**: friend, neighbor, acquaintance, teammate, classmate
- **Custom**: Define your own relationship types

### VCF Import/Export

Standard vCard format support for interoperability:

- **vCard 4.0 Compliance**: Full support for the latest vCard standard
- **Import**: Create contacts from .vcf files (single contacts or entire databases)
- **Export**: Generate standard .vcf files for use in other applications
- **Batch Operations**: Process multiple contacts simultaneously
- **Name Extraction**: Automatic file naming from contact data
- **Smart Updates**: Revision timestamp comparison for conflict resolution

### Folder Watching

Background monitoring of external VCF folders:

- **Automatic Synchronization**: Detects and imports new VCF files
- **Change Detection**: Updates contacts when VCF files are modified
- **Duplicate Prevention**: Uses UID tracking to avoid duplicate contacts
- **Intelligent Updates**: Only processes new or modified files
- **Cross-Platform**: Works with any local filesystem folder
- **Configurable Polling**: Adjust scan frequency to your needs

### Contact Data Management

Standard vCard field support:

#### Basic Information
- Names (Given, Family, Middle, Prefix, Suffix)
- Phone numbers (Multiple types: Mobile, Home, Work)
- Email addresses (Multiple addresses with type labels)
- Organization information (Company, Department, Title)

#### Addresses
- Complete address support (Street, City, State, ZIP, Country)
- Multiple address types (Home, Work, Other)
- International format support

#### Metadata
- Birthday and anniversary tracking
- Categories and tags
- Unique identifiers (UID) for contact linking
- Revision timestamps (REV) for sync operations
- Gender information for relationship processing

#### Online Presence
- Website URLs
- Social media profiles
- Custom online presence fields

## Technical Features

### Data Consistency

Automated consistency operations:

- **UID Management**: Automatic UID generation and validation
- **Relationship Validation**: Ensures all relationships are reciprocal
- **Frontmatter Sync**: Keeps frontmatter and markdown in sync
- **Name Change Handling**: Updates all references when contact names change
- **Orphan Detection**: Identifies and reports broken relationship references

### Processor Architecture

Extensible processor system for data operations:

- **Gender Inference**: Automatically infers gender from relationship terms
- **Gender Rendering**: Converts generic terms to gender-specific terms
- **Relationship Sync**: Synchronizes relationships between contacts
- **UID Processing**: Manages unique identifiers
- **VCF Sync**: Handles VCF file synchronization
- **Namespace Migration**: Upgrades old data formats

### Write Queue System

Controlled file operations:

- **Queue Management**: Prevents file system conflicts during batch operations
- **Sequential Processing**: Ensures operations complete in order
- **Error Handling**: Robust error handling for file operations
- **Status Tracking**: Monitor operation progress

## Integration Capabilities

### External Applications

Interoperability with standard tools:

- **Email Clients**: Compatible with Gmail, Outlook, Apple Mail
- **Phone Systems**: Works with iOS Contacts, Android Contacts
- **CRM Systems**: Import/export with Salesforce, HubSpot
- **Address Books**: Standard vCard format support

### Obsidian Integration

Leverages Obsidian features:

- **Wiki Links**: Use standard Obsidian link syntax for relationships
- **Frontmatter**: Contact data stored in YAML frontmatter
- **Search**: Full integration with Obsidian search
- **Tags**: Standard tag support for categorization
- **Backlinks**: Relationship references appear in backlinks

### Version Control

Git-friendly design:

- **Plain Text**: All data stored as markdown files
- **Readable Diffs**: Changes are human-readable in diffs
- **Merge-Friendly**: Conflicts are manageable
- **Portable**: Easy to backup and migrate