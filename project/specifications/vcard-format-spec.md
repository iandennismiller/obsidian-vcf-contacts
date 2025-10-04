# VCard Format Guide

## Understanding vCard (.vcf) Format

The VCF Contacts plugin uses the industry-standard vCard 4.0 format to store contact information. This ensures compatibility with virtually all contact management systems.

**Technical Foundation**: The plugin uses the [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard parsing and generation. This library fully implements RFC 6350 (vCard 4.0) and ensures spec compliance, proper field validation, and compatibility with all vCard 4.0 extensions.

## What is vCard?

vCard is an electronic business card format that contains contact information in a standardized way. It's supported by:

- Email clients (Gmail, Outlook, Apple Mail)
- Phone contact apps (iOS Contacts, Android Contacts)
- CRM systems (Salesforce, HubSpot)
- Address book applications

**vCard 4.0 Compliance**: The plugin leverages the vcard4 library which fully implements:
- RFC 6350 (vCard 4.0) - Core specification
- RFC 6351 (XML vCard) - XML representation
- RFC 7095 (jCard) - JSON representation
- RFC 6474, RFC 8605, RFC 6715, RFC 6868, RFC 6473, RFC 7852 - vCard extensions

## File Structure

Each contact in your vault consists of:

1. **Markdown file** (e.g., `John Doe.md`) - The main contact note
2. **Frontmatter section** - Contains vCard-compliant contact data
3. **Content area** - Your notes, links, and thoughts about the contact

## Example Contact Format

```markdown
---
UID: urn:uuid:12345678-1234-5678-9012-123456789012
VERSION: "4.0"
FN: John Doe
N.GN: John
N.FN: Doe
EMAIL: john.doe@example.com
TEL.CELL: +1-555-123-4567
ORG: Acme Corporation
TITLE: Software Engineer
GENDER: M
REV: 20250125T103000Z
RELATED.colleague: urn:uuid:jane-smith-uuid-here
---

# John Doe

Software engineer at Acme Corporation. Specializes in backend development.

## Notes
- Met at tech conference 2024
- Interested in AI/ML projects
- [[Project Alpha]] collaboration

## Related
- colleague [[Jane Smith]]
```

## Supported vCard Fields

### 📞 Basic Contact Information

| Field | Description | Example |
|-------|-------------|---------|
| `FN` | Full/Display Name | `John Doe` |
| `N.GN` | Given Name (First) | `John` |
| `N.FN` | Family Name (Last) | `Doe` |
| `N.MN` | Middle Name | `Michael` |
| `N.PREFIX` | Name Prefix | `Mr.` |
| `N.SUFFIX` | Name Suffix | `Jr.` |
| `NICKNAME` | Nickname | `Johnny` |
| `GENDER` | Gender | `M` |

### 📧 Communication

| Field | Description | Example |
|-------|-------------|---------|
| `EMAIL` | Primary Email | `john@example.com` |
| `EMAIL.WORK` | Work Email | `j.doe@company.com` |
| `TEL.CELL` | Mobile Phone | `+1-555-123-4567` |
| `TEL.WORK` | Work Phone | `+1-555-987-6543` |
| `TEL.HOME` | Home Phone | `+1-555-111-2222` |

**Contact List Input:**
You can also enter contact information using the Contact List format in the `## Contact` section:

```markdown
## Contact

- contact@example.com
- work j.doe@company.com
- cell 555-123-4567
- work 555-987-6543
```

The parser automatically detects field types and syncs to frontmatter using the appropriate field names and kind labels.

### 🏠 Address Information

| Field | Description | Example |
|-------|-------------|---------|
| `ADR.HOME.STREET` | Home Street | `123 Main St` |
| `ADR.HOME.CITY` | Home City | `Springfield` |
| `ADR.HOME.REGION` | Home State/Region | `IL` |
| `ADR.HOME.POSTAL` | Home ZIP/Postal | `62701` |
| `ADR.HOME.COUNTRY` | Home Country | `United States` |

### 🏢 Professional Information

| Field | Description | Example |
|-------|-------------|---------|
| `ORG` | Organization | `Acme Corporation` |
| `TITLE` | Job Title | `Software Engineer` |
| `ROLE` | Professional Role | `Developer` |

### 📅 Important Dates

| Field | Description | Example |
|-------|-------------|---------|
| `BDAY` | Birthday | `1985-03-15` |
| `ANNIVERSARY` | Anniversary | `2010-06-20` |

### 🌐 Online Presence

| Field | Description | Example |
|-------|-------------|---------|
| `URL` | Website | `https://johndoe.com` |
| `SOCIALPROFILE.TWITTER` | Twitter | `@johndoe` |
| `SOCIALPROFILE.LINKEDIN` | LinkedIn | `linkedin.com/in/johndoe` |

### 🗂️ Organization & Metadata

| Field | Description | Example |
|-------|-------------|---------|
| `CATEGORIES` | Categories/Tags | `work,developer,friend` |
| `NOTE` | General Notes | `Met at conference` |
| `UID` | Unique Identifier (UUID format preferred) | `urn:uuid:12345678-1234-5678-9012-123456789012` |
| `REV` | Last Modified Timestamp | `20250925T141344Z` |

### Relationships

The RELATED field uses dot notation to reference other contacts:

| Field | Description | Example |
|-------|-------------|---------|
| `RELATED.type` | Relationship reference | `RELATED.friend: urn:uuid:12345...` |
| | | `RELATED.colleague: uid:custom-id` |
| | | `RELATED.sibling: name:Jane Doe` |

## Field Organization

**Technical Note**: The plugin uses the [flat](https://www.npmjs.com/package/flat) library to convert between hierarchical vCard structures and flat Obsidian frontmatter. This ensures consistent dot notation for all structured fields.

### Multiple Values

For fields that can have multiple values (like phone numbers or emails), the flat library automatically creates array indices:

```yaml
EMAIL.0: primary@example.com      # First email
EMAIL.1: work@company.com         # Second email
EMAIL.2: home@personal.com        # Third email

# With type parameters:
TEL.CELL.0: +1-555-123-4567       # First mobile
TEL.CELL.1: +1-555-000-0000       # Second mobile
TEL.WORK: +1-555-987-6543         # Work phone
TEL.HOME: +1-555-111-2222         # Home phone
```

### Contact List Alternative

Instead of manually entering frontmatter fields, you can use the Contact List format in the `## Contact` section:

```markdown
## Contact

- primary@example.com
- work work@company.com
- home home@personal.com
- cell 555-123-4567
- work 555-987-6543
```

The parser will:
1. Auto-detect field types (email, phone, URL, address)
2. Extract optional kind labels (`work`, `home`, `cell`, etc.)
3. Sync to frontmatter using dot notation (e.g., `EMAIL.WORK`, `TEL.CELL`)
4. Use the flat library to ensure consistent key formatting

This provides a more user-friendly way to enter contact information without worrying about exact frontmatter syntax.

## Type Labels

Common type labels for categorizing information:

### Phone Types

- `CELL`, `MOBILE` - Mobile phone
- `WORK` - Work phone  
- `HOME` - Home phone
- `FAX` - Fax number
- `PAGER` - Pager

### Email Types

- `WORK` - Work email
- `HOME` - Personal email
- `OTHER` - Other email

### Address Types

- `HOME` - Home address
- `WORK` - Work address
- `OTHER` - Other address

### URL Types

- `WORK` - Work website
- `HOME` - Personal website
- `OTHER` - Other website

## Advanced Features

### Relationship Tracking

The plugin supports relationship tracking between contacts using the vCard 4.0 RELATED field:

#### RELATED Field Format

```yaml
RELATED.friend: urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
RELATED.colleague: uid:some-custom-uid
RELATED.sibling: name:Jane Doe
```

The RELATED field value uses three possible namespace formats:

1. **`urn:uuid:`** - Preferred format when the contact's UID is a valid UUID
   - Example: `urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af`
   - Used for unambiguous reference to contacts by their UUID

2. **`uid:`** - Used when the contact has a unique identifier that is not a valid UUID
   - Example: `uid:custom-identifier-123`
   - Used when UID exists and is unique but doesn't follow UUID format

3. **`name:`** - Used when the target contact doesn't exist in Obsidian yet
   - Example: `name:First Last`
   - Allows forward references to contacts not yet created

#### Multiple Relationships of the Same Type

When you have multiple relationships of the same type (forming a set), the flat library automatically creates array indices:

```yaml
RELATED.friend.0: urn:uuid:first-friend-uuid        # First friend
RELATED.friend.1: urn:uuid:second-friend-uuid       # Second friend
RELATED.friend.2: name:Third Friend                  # Third friend
```

**Important**: The flat library ensures deterministic ordering by sorting keys alphabetically, preventing unnecessary changes when relationships are refreshed.

#### Genderless Relationship Types

Relationship types are stored in their genderless form in frontmatter, vCard files, and the relationship graph:

- Use `parent` (not mother/father)
- Use `child` (not son/daughter)
- Use `sibling` (not brother/sister)
- Use `aunt-uncle` (rendered as aunt/uncle based on gender)

Gender is only applied when rendering the Related list in markdown based on the contact's GENDER field.

### Gender Support

The plugin supports the vCard 4.0 GENDER field with four values:

```yaml
GENDER: M     # Male
GENDER: F     # Female  
GENDER: NB    # Non-binary
GENDER: U     # Unspecified (or Unknown)
```

When GENDER is NB, U, blank, or not present, the plugin renders relationships using genderless terms:
- `parent` (instead of mother/father)
- `child` (instead of son/daughter)
- `sibling` (instead of brother/sister)
- `aunt-uncle` (instead of aunt/uncle)

When GENDER is M or F, relationships are rendered with gender-specific terms in the Related list.

### Photo Support

```yaml
PHOTO: http://example.com/photo.jpg  # URL
PHOTO: /path/to/local/photo.jpg      # Local file
```

## Best Practices

1. **Use UIDs**: Always include a unique UID for each contact (UUID format preferred)
2. **Update REV**: The plugin automatically updates REV timestamps when contact data changes
3. **Consistent Naming**: Use consistent file naming conventions matching contact display names
4. **Type Labels**: Use appropriate type labels for categorization
5. **Backup Data**: The vCard format ensures your data is portable
6. **Genderless Types**: Store relationship types in genderless form in frontmatter and vCard files
7. **UID References**: Prefer `urn:uuid:` namespace for RELATED fields when UIDs are UUIDs

## Import/Export

The plugin can:

- **Import** from any vCard 4.0 compliant file
- **Export** to standard .vcf files compatible with other systems
- **Sync** bidirectionally with external contact sources

**Technical Implementation**: Import and export operations use the vcard4 library:
- **Parsing**: The `parse()` function from vcard4 handles all vCard file parsing, including edge cases like line folding, structured fields, and property parameters
- **Generation**: The `VCARD` class and property constructors from vcard4 generate spec-compliant vCard 4.0 output
- **Validation**: vcard4 ensures all fields comply with RFC 6350, preventing invalid vCard files
- **Compatibility**: Generated vCard files work with any RFC 6350-compliant contact management system

This ensures your contact data remains accessible and portable across different platforms and applications.