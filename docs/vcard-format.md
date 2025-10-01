# VCard Format Guide

## Understanding vCard (.vcf) Format

The VCF Contacts plugin uses the industry-standard vCard 4.0 format to store contact information. This ensures compatibility with virtually all contact management systems.

## What is vCard?

vCard is an electronic business card format that contains contact information in a standardized way. It's supported by:

- Email clients (Gmail, Outlook, Apple Mail)
- Phone contact apps (iOS Contacts, Android Contacts)
- CRM systems (Salesforce, HubSpot)
- Address book applications

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
EMAIL[1]: john.doe@example.com
TEL[1:CELL]: +1-555-123-4567
ORG: Acme Corporation
TITLE: Software Engineer
GENDER: M
REV: 20250125T103000Z
RELATED[colleague]: urn:uuid:jane-smith-uuid-here
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
| `EMAIL[1]` | Primary Email | `john@example.com` |
| `EMAIL[2:WORK]` | Work Email | `j.doe@company.com` |
| `TEL[1:CELL]` | Mobile Phone | `+1-555-123-4567` |
| `TEL[2:WORK]` | Work Phone | `+1-555-987-6543` |
| `TEL[3:HOME]` | Home Phone | `+1-555-111-2222` |

### 🏠 Address Information

| Field | Description | Example |
|-------|-------------|---------|
| `ADR[1:HOME].STREET` | Home Street | `123 Main St` |
| `ADR[1:HOME].CITY` | Home City | `Springfield` |
| `ADR[1:HOME].REGION` | Home State/Region | `IL` |
| `ADR[1:HOME].POSTAL` | Home ZIP/Postal | `62701` |
| `ADR[1:HOME].COUNTRY` | Home Country | `United States` |

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
| `SOCIALPROFILE[1:TWITTER]` | Twitter | `@johndoe` |
| `SOCIALPROFILE[2:LINKEDIN]` | LinkedIn | `linkedin.com/in/johndoe` |

### 🗂️ Organization & Metadata

| Field | Description | Example |
|-------|-------------|---------|
| `CATEGORIES` | Categories/Tags | `work,developer,friend` |
| `NOTE` | General Notes | `Met at conference` |
| `UID` | Unique Identifier (UUID format preferred) | `urn:uuid:12345678-1234-5678-9012-123456789012` |
| `REV` | Last Modified Timestamp | `20250925T141344Z` |

### Relationships

The RELATED field uses a special format to reference other contacts:

| Field | Description | Example |
|-------|-------------|---------|
| `RELATED[type]` | Relationship reference | `RELATED[friend]: urn:uuid:12345...` |
| | | `RELATED[colleague]: uid:custom-id` |
| | | `RELATED[sibling]: name:Jane Doe` |

## Field Indexing

For fields that can have multiple values (like phone numbers or emails), use index numbers:

```yaml
EMAIL[1]: primary@example.com      # Primary email
EMAIL[2:WORK]: work@company.com    # Work email
EMAIL[3:HOME]: home@personal.com   # Home email

TEL[1:CELL]: +1-555-123-4567      # Mobile
TEL[2:WORK]: +1-555-987-6543      # Work phone
TEL[3:HOME]: +1-555-111-2222      # Home phone
```

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
RELATED[friend]: urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
RELATED[colleague]: uid:some-custom-uid
RELATED[sibling]: name:Jane Doe
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

When you have multiple relationships of the same type (forming a set), the plugin uses indexed keys:

```yaml
RELATED[friend]: urn:uuid:first-friend-uuid       # First friend
RELATED[1:friend]: urn:uuid:second-friend-uuid    # Second friend
RELATED[2:friend]: name:Third Friend               # Third friend
```

The indexing follows this pattern:
- First item: `RELATED[type]`
- Second item: `RELATED[1:type]`
- Third item: `RELATED[2:type]`
- And so on...

**Important**: The order is deterministic - relationships are sorted first by key, then by value, ensuring consistent serialization and preventing unnecessary changes.

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

This ensures your contact data remains accessible and portable across different platforms and applications.