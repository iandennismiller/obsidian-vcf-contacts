# vCard Format Specification

## Overview

The plugin uses the vCard 4.0 format to store contact information, ensuring compatibility with virtually all contact management systems.

## What is vCard?

vCard is an electronic business card format containing contact information in a standardized way. It's supported by:

- Email clients (Gmail, Outlook, Apple Mail)
- Phone contact apps (iOS Contacts, Android Contacts)
- CRM systems (Salesforce, HubSpot)
- Address book applications

## File Structure

Each contact consists of:

1. **Markdown file** (e.g., `John Doe.md`) - The main contact note
2. **Frontmatter section** - Contains vCard-compliant contact data
3. **Content area** - Notes, links, and thoughts about the contact

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

Software engineer at Acme Corporation.

## Notes
- Met at tech conference 2024
- [[Project Alpha]] collaboration

## Related
- colleague [[Jane Smith]]
```

## Supported vCard Fields

### Basic Contact Information

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

### Communication

| Field | Description | Example |
|-------|-------------|---------|
| `EMAIL` | Primary Email | `john@example.com` |
| `EMAIL.WORK` | Work Email | `j.doe@company.com` |
| `TEL.CELL` | Mobile Phone | `+1-555-123-4567` |
| `TEL.WORK` | Work Phone | `+1-555-987-6543` |
| `TEL.HOME` | Home Phone | `+1-555-111-2222` |

### Address Information

| Field | Description | Example |
|-------|-------------|---------|
| `ADR.HOME.STREET` | Home Street | `123 Main St` |
| `ADR.HOME.CITY` | Home City | `Springfield` |
| `ADR.HOME.REGION` | Home State/Region | `IL` |
| `ADR.HOME.POSTAL` | Home ZIP/Postal | `62701` |
| `ADR.HOME.COUNTRY` | Home Country | `United States` |

### Professional Information

| Field | Description | Example |
|-------|-------------|---------|
| `ORG` | Organization | `Acme Corporation` |
| `TITLE` | Job Title | `Software Engineer` |
| `ROLE` | Professional Role | `Developer` |

### Important Dates

| Field | Description | Example |
|-------|-------------|---------|
| `BDAY` | Birthday | `1985-03-15` |
| `ANNIVERSARY` | Anniversary | `2010-06-20` |

### Online Presence

| Field | Description | Example |
|-------|-------------|---------|
| `URL` | Website | `https://johndoe.com` |
| `SOCIALPROFILE.TWITTER` | Twitter | `@johndoe` |
| `SOCIALPROFILE.LINKEDIN` | LinkedIn | `linkedin.com/in/johndoe` |

### Organization & Metadata

| Field | Description | Example |
|-------|-------------|---------|
| `CATEGORIES` | Categories/Tags | `work,developer,friend` |
| `NOTE` | General Notes | `Met at conference` |
| `UID` | Unique Identifier | `urn:uuid:12345678-1234-5678-9012-123456789012` |
| `REV` | Last Modified | `20250925T141344Z` |

### Relationships

| Field | Description | Example |
|-------|-------------|---------|
| `RELATED.type` | Single relationship | `RELATED.friend: urn:uuid:12345...` |
| | | `RELATED.colleague: uid:custom-id` |
| | | `RELATED.sibling: name:Jane Doe` |
| `RELATED.type.N` | Multiple relationships | `RELATED.friend.0: urn:uuid:12345...` |
| | | `RELATED.friend.1: urn:uuid:67890...` |

## Field Organization

### Multiple Values

For fields with multiple values, numeric indices are used:

```yaml
EMAIL.0: primary@example.com
EMAIL.1: work@company.com
EMAIL.2: home@personal.com

TEL.CELL.0: +1-555-123-4567
TEL.CELL.1: +1-555-000-0000
TEL.WORK: +1-555-987-6543
```

### Contact List Alternative

Instead of manual frontmatter entry, use the Contact List format in `## Contact` section:

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
3. Sync to frontmatter using dot notation

## Type Labels

Common type labels for categorizing information:

### Phone Types
- `CELL`, `MOBILE` - Mobile phone
- `WORK` - Work phone  
- `HOME` - Home phone
- `FAX` - Fax number

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

## Relationship Tracking

### RELATED Field Format

```yaml
RELATED.friend: urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
RELATED.colleague: uid:some-custom-uid
RELATED.sibling: name:Jane Doe
```

Three namespace formats:

1. **`urn:uuid:`** - Preferred when contact's UID is a valid UUID
2. **`uid:`** - When contact has non-UUID unique identifier
3. **`name:`** - When target contact doesn't exist yet (forward reference)

### Multiple Relationships of Same Type

```yaml
RELATED.friend.0: urn:uuid:first-friend-uuid
RELATED.friend.1: urn:uuid:second-friend-uuid
RELATED.friend.2: name:Third Friend
```

### Genderless Relationship Types

Relationship types are stored in genderless form:

- Use `parent` (not mother/father)
- Use `child` (not son/daughter)
- Use `sibling` (not brother/sister)
- Use `aunt-uncle` (rendered as aunt/uncle based on gender)

Gender is only applied when rendering the Related list based on the contact's GENDER field.

## Gender Support

vCard 4.0 GENDER field values:

```yaml
GENDER: M     # Male
GENDER: F     # Female  
GENDER: NB    # Non-binary
GENDER: U     # Unspecified
```

When GENDER is NB, U, blank, or not present, relationships render with genderless terms.
When GENDER is M or F, relationships render with gender-specific terms.

## Photo Support

```yaml
PHOTO: http://example.com/photo.jpg  # URL
PHOTO: /path/to/local/photo.jpg      # Local file
```

## Best Practices

1. **Use UIDs**: Always include a unique UID for each contact (UUID format preferred)
2. **Update REV**: Plugin automatically updates REV timestamps when contact data changes
3. **Consistent Naming**: Use consistent file naming matching contact display names
4. **Type Labels**: Use appropriate type labels for categorization
5. **Backup Data**: vCard format ensures data is portable
6. **Genderless Types**: Store relationship types in genderless form
7. **UID References**: Prefer `urn:uuid:` namespace for RELATED fields when UIDs are UUIDs

## Import/Export

The plugin can:

- **Import** from any vCard 4.0 compliant file
- **Export** to standard .vcf files compatible with other systems
- **Sync** bidirectionally with external contact sources

This ensures contact data remains accessible and portable across different platforms and applications.
