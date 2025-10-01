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
UID: 12345678-1234-5678-9012-123456789012
VERSION: "4.0"
FN: John Doe
N.GN: John
N.FN: Doe
EMAIL[1]: john.doe@example.com
TEL[1:CELL]: +1-555-123-4567
ORG: Acme Corporation
TITLE: Software Engineer
REV: 2024-01-15T10:30:00Z
---

# John Doe

Software engineer at Acme Corporation. Specializes in backend development.

## Notes
- Met at tech conference 2024
- Interested in AI/ML projects
- [[Project Alpha]] collaboration

## Related
- [[Jane Smith]] - Colleague at Acme Corp
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
| `UID` | Unique Identifier (e.g. UUID) | `12345...` |
| `REV` | Last Modified | `2024-01-15T10:30:00Z` |

### Relationships

| Field | Description | Example |
|-------|-------------|---------|
| `RELATED` | Categories/Tags | `RELATED;TYPE=friend:urn:uuid:12345...` |

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

The plugin supports relationship tracking between contacts:

```yaml
RELATED[1:SPOUSE]: name:Jane Doe
RELATED[FRIEND]: name:Bob Smith
RELATED[1:FRIEND]: name:Alice Johnson
```

### Gender Support

```yaml
GENDER: M    # Male
GENDER: F    # Female  
GENDER: NB    # Non-binary
GENDER: N    # Not specified
```

### Photo Support

```yaml
PHOTO: http://example.com/photo.jpg  # URL
PHOTO: /path/to/local/photo.jpg      # Local file
```

## Best Practices

1. **Use UIDs**: Always include a unique UID for each contact
2. **Update REV**: Keep revision timestamps current for sync
3. **Consistent Naming**: Use consistent file naming conventions
4. **Type Labels**: Use appropriate type labels for categorization
5. **Backup Data**: The vCard format ensures your data is portable

## Import/Export

The plugin can:

- **Import** from any vCard 4.0 compliant file
- **Export** to standard .vcf files compatible with other systems
- **Sync** bidirectionally with external contact sources

This ensures your contact data remains accessible and portable across different platforms and applications.