# Feature Overview

## Core Capabilities

### Relationship Management

The plugin's primary focus is on tracking and managing relationships between contacts:

#### Bidirectional Relationship Tracking
- Define relationships in a markdown "## Related" section using familiar wiki-link syntax
- Each relationship is a list item: `- relationship_kind [[Contact Name]]`
- Automatic reciprocal relationship creation (adding "- father [[John]]" to Jane automatically adds "- child [[Jane]]" to John)
- Gender-aware relationship terms (parent → mother/father, child → son/daughter based on GENDER field)
- Support for complex relationship types: family, professional, and social
- The Related heading is case-insensitive and depth-agnostic (works with "## related", "### Related", etc.)

#### Relationship Synchronization
- Bidirectional sync between markdown "## Related" section and vCard RELATED fields
- Changes in one contact automatically propagate to related contacts
- UID-based references maintain relationship integrity across contact name changes
- Consistency validation ensures all relationships are reciprocal
- Plugin automatically adds "## Related" heading to contacts that need it
- Cleans up extra newlines and manages heading formatting automatically
- Genderless relationship types stored in frontmatter/vCard, gender applied only when rendering Related list

#### Supported Relationship Types
- **Family**: parent, child, sibling, spouse, partner, cousin, grandparent, grandchild, aunt-uncle, niece-nephew
- **Professional**: colleague, boss, employee, manager, coworker, assistant
- **Social**: friend, neighbor, acquaintance, teammate, classmate
- **Custom**: Define your own relationship types
- All types stored in genderless form internally, rendered with gender when displaying in Related list

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

#### Contact Section Parsing
- **Contact List Format**: Simple markdown list items for entering contact information
- **Auto-detection**: Automatically identifies field types (email, phone, URL, address)
- **Optional kind labels**: Add prefixes like `home`, `work`, `personal` to categorize fields
- **Flexible parsing**: Works with or without kind labels - if omitted, fields are auto-indexed
- **Pattern matching**: Uses intelligent regex patterns to detect field types
- **Emoji prefixes**: Automatically adds emojis (📧, 📞, 🌐, 🏠) when displaying
- **Bidirectional sync**: Changes in Contact section sync to frontmatter and vice versa

**Example Contact List:**
```markdown
## Contact

- home 555-555-5555
- contact@example.com
- work contact@example.com
- 123 Some street, Town
- personal http://example.com
```

**Parsing behavior:**
- `work contact@example.com` → `EMAIL[WORK]: contact@example.com`
- `home 555-555-5555` → `TEL[HOME]: +1-555-555-5555` (normalized)
- `personal http://example.com` → `URL[PERSONAL]: http://example.com`

#### Metadata
- Birthday and anniversary tracking
- Categories and tags
- Unique identifiers (UID) for contact linking - UUID format preferred
- Revision timestamps (REV) automatically updated when data changes
- Gender information (M, F, NB, U) for relationship processing

#### Online Presence
- Website URLs
- Social media profiles
- Custom online presence fields

## Technical Features

### Data Consistency

Automated consistency operations:

- **UID Management**: Automatic UID generation (UUID format preferred) and validation
- **Relationship Validation**: Ensures all relationships are reciprocal
- **Frontmatter Sync**: Keeps frontmatter and markdown in sync, only updating REV when data actually changes
- **Name Change Handling**: Updates all references when contact names change
- **Orphan Detection**: Identifies and reports broken relationship references
- **Deterministic Ordering**: Relationships sorted by key then value for consistent serialization

### Processor Architecture

Extensible processor system for data operations:

- **Gender Inference**: Automatically infers gender from gendered relationship terms (mother → F, father → M)
- **Gender Rendering**: Converts genderless terms to gender-specific terms for display in Related list
- **Relationship Sync**: Synchronizes relationships between contacts bidirectionally
- **UID Processing**: Manages unique identifiers with UUID format preference
- **VCF Sync**: Handles VCF file synchronization with REV timestamp management
- **Namespace Migration**: Upgrades old data formats to current standards

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