# Getting Started

## Initial Setup

After installation, configure the plugin:

1. Go to **Settings → VCF Contacts**
2. Set your **Contacts Folder Location** to an existing folder in your vault
3. Optionally configure VCF folder watching (see below)

## Working with Relationships

The plugin's relationship management is its primary feature. Relationships are defined in a "Related" section using markdown list syntax.

### Adding Relationships

In any contact note, add a "Related" section:

```markdown
---
FN: Jane Doe
UID: urn:uuid:jane-uuid
---

## Related
- father [[John Doe]]
- mother [[Mary Doe]]
- sibling [[Jack Doe]]
- friend [[Alice Smith]]
```

### Automatic Reciprocal Updates

When you add a relationship, the plugin automatically creates the reciprocal relationship:

- Add "father [[John Doe]]" to Jane's contact
- John's contact automatically gets "child [[Jane Doe]]" (or "daughter [[Jane Doe]]" if gender is set)

### Gender-Aware Terms

The plugin converts relationship terms based on contact gender:

- "parent" becomes "mother" or "father"
- "child" becomes "son" or "daughter"  
- "sibling" becomes "sister" or "brother"

Set gender in frontmatter:
```yaml
GENDER: M    # Male
GENDER: F    # Female
```

### Relationship Types

Common relationship types:

**Family:**
- parent, child, sibling
- spouse, partner
- grandparent, grandchild
- aunt, uncle, niece, nephew
- cousin

**Professional:**
- colleague, coworker
- boss, manager, employee
- assistant

**Social:**
- friend, acquaintance
- neighbor, teammate
- classmate

## Importing Contacts

### Import VCF Files

1. Open the plugin interface
2. Click **Import VCF**
3. Select a `.vcf` file (single contact or database export)
4. Fill in required fields if prompted (Given Name, Family Name)

### VCF Folder Watching

Automatically import contacts from an external folder:

1. Go to **Settings → VCF Contacts**
2. Configure **VCF Watch Folder**: Path to folder containing VCF files
   - Example: `/Users/username/Documents/Contacts` (macOS)
   - Example: `C:\Users\username\Documents\Contacts` (Windows)
3. Enable **VCF Folder Watching**
4. Set **Polling Interval** (default: 30 seconds)

How it works:
- Plugin periodically scans the folder for `.vcf` files
- New contacts (by UID) are automatically imported
- Existing contacts are updated if VCF has newer REV timestamp
- File renames are handled when contact names change
- Relationships in imported VCF files are synced automatically

## Exporting Contacts

Export contacts to VCF format:

1. Select a contact or open the plugin interface
2. Click **Export VCF**
3. Choose save location
4. File is generated in standard vCard 4.0 format

## Creating Contacts

### New Contact

1. Open the plugin interface
2. Click **New Contact**
3. Fill in basic information (name, email, phone)
4. Contact file is created in your contacts folder with:
   - Automatic UID generation
   - Proper frontmatter structure
   - Empty Related section for adding relationships

### Contact Template

Each contact follows this structure:

```markdown
---
UID: urn:uuid:generated-unique-id
VERSION: "4.0"
FN: Jane Doe
N.GN: Jane
N.FN: Doe
EMAIL[1]: jane@example.com
TEL[1:CELL]: +1-555-123-4567
GENDER: F
REV: 2024-01-15T10:30:00Z
---

## Related

#Contact
```

## Data Synchronization

### Frontmatter and Markdown Sync

The plugin maintains bidirectional synchronization:

**Markdown to Frontmatter:**
- Relationships in the "Related" section sync to RELATED fields in frontmatter
- Changes are propagated to related contacts

**Frontmatter to Markdown:**
- RELATED fields in frontmatter appear in the "Related" section
- Gender information affects relationship term rendering

### Consistency Operations

The plugin ensures data consistency:

- Validates that all relationships are reciprocal
- Updates contact references when names change
- Maintains UID-based references for reliability
- Detects and reports orphaned relationships

## Advanced Usage

### UID-Based Contact References

Contacts are linked by unique identifiers (UIDs) rather than names. This ensures:

- Relationships persist when contact names change
- No broken links from renamed contacts
- Reliable contact references in VCF exports

UIDs are stored in frontmatter:
```yaml
UID: urn:uuid:12345678-1234-5678-9012-123456789012
```

### Revision Timestamps

The REV field tracks when contacts were last modified:

```yaml
REV: 2024-01-15T10:30:00Z
```

Used for:
- Conflict resolution during sync
- Determining which version is newer
- Maintaining data consistency across systems

## Next Steps

- Review [Feature Overview](features.md) for comprehensive capabilities
- Consult [VCard Format Guide](vcard-format.md) for field reference
- See [User Stories](user-stories.md) for usage scenarios
- Check [Development Guide](development.md) to extend the plugin