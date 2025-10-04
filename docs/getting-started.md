# Getting Started

## Initial Setup

After installation, configure the plugin:

1. Go to **Settings → VCF Contacts**
2. Set your **Contacts Folder Location** to an existing folder in your vault
3. Optionally configure VCF folder watching (see below)

## Working with Relationships

The plugin's relationship management is its primary feature. Relationships are defined in a "## Related" section using markdown list syntax with Obsidian wiki-links.

### The Related Section

The plugin automatically manages a "## Related" heading in each contact note:
- The heading is case-insensitive ("## related", "## Related", "### RELATED" all work)
- The depth of the heading doesn't matter (## or ### or ####)
- If a contact doesn't have a Related section when opened, the plugin adds it when needed
- The plugin cleans up extra newlines and fixes capitalization automatically
- Only the Related section is managed; other headings and content are not touched

### Adding Relationships

In any contact note, add relationships as a markdown list under the "## Related" heading:

```markdown
---
FN: Jane Doe
UID: urn:uuid:jane-uuid
GENDER: F
---

## Related
- parent [[John Doe]]
- parent [[Mary Doe]]
- sibling [[Jack Doe]]
- friend [[Alice Smith]]
```

Each relationship follows the format: `- relationship_kind [[Contact Name]]`

### Automatic Reciprocal Updates

When you add a relationship, the plugin automatically creates the reciprocal relationship:

- Add "- father [[John Doe]]" to Jane's contact
- John's contact automatically gets "- child [[Jane Doe]]" (or "- daughter [[Jane Doe]]" if John's contact has Jane's GENDER set to F)

The reciprocal relationship is added to John's "## Related" section automatically.

### Gender-Aware Terms

The plugin uses gender information to render appropriate relationship terms in the Related list:

- "parent" is stored internally but renders as "mother" or "father" based on GENDER
- "child" renders as "son" or "daughter"  
- "sibling" renders as "sister" or "brother"
- "aunt-uncle" renders as "aunt" or "uncle"

When you type gendered terms like "mother", "father", "son", "daughter", the plugin:
1. Infers the target contact's gender and updates their GENDER field
2. Converts the relationship type to its genderless form for storage
3. Stores the genderless type in frontmatter and vCard RELATED fields

Gender values in frontmatter:
```yaml
GENDER: M    # Male - renders gendered terms as masculine
GENDER: F    # Female - renders gendered terms as feminine
GENDER: NB   # Non-binary - renders genderless terms
GENDER: U    # Unspecified - renders genderless terms
```

If GENDER is NB, U, blank, or not present, genderless terms are used.

### Relationship Types

Common relationship types (stored in genderless form):

**Family:**
- parent, child, sibling
- spouse, partner
- grandparent, grandchild
- aunt-uncle, niece-nephew
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

### Drop VCF Files

1. Drag the VCF onto Obsidian (the vcf itself is not saved in the vault)
2. The new contact will be created as a contact note

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

The plugin automatically exports contacts to VCF format when VCF sync is enabled:

**Single VCF File Mode:**
1. Enable "Single VCF File" in plugin settings
2. Set the VCF file path
3. All contacts are automatically exported to the VCF file
4. Updates sync in real-time as you edit contacts

**VCF Folder Mode:**
1. Enable "VCF Folder" in plugin settings  
2. Set the folder path
3. Each contact is exported as an individual VCF file
4. Files are named using the contact's UID
5. Updates sync automatically when contacts change

## Creating Contacts

### Manual Contact Creation

To create a new contact manually:

1. Create a new markdown file in your contacts folder
2. Add the required frontmatter fields:
   ```markdown
   ---
   UID: urn:uuid:generated-unique-id
   VERSION: "4.0"
   FN: Jane Doe
   N.GN: Jane
   N.FN: Doe
   ---
   
   ## Related
   
   #Contact
   ```
3. The plugin will automatically:
   - Generate a UID if missing
   - Add a Related section if needed
   - Validate and sync the contact data

### Import from VCF

Alternatively, import contacts from VCF files:

1. Place VCF file(s) in your configured VCF watch folder
2. The plugin automatically creates contact notes for each vCard
3. Contact files are created in your contacts folder with:
   - All vCard fields mapped to frontmatter
   - Automatic UID preservation
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
EMAIL: jane@example.com
TEL[CELL]: +1-555-123-4567
GENDER: F
REV: 20250925T141344Z
---

## Contact

- jane@example.com
- cell 555-123-4567

## Related

#Contact
```

**Key Fields:**
- **UID**: Unique identifier in UUID format (preferred) with `urn:uuid:` prefix
- **REV**: Revision timestamp in format `YYYYMMDDTHHMMSSZ` - automatically updated when data changes
- **GENDER**: M, F, NB, or U for relationship rendering

## Managing Contact Information

### Contact Section (Recommended)

The plugin supports a flexible Contact List format for entering contact information:

```markdown
## Contact

- home 555-555-5555
- contact@example.com
- work contact@example.com
- 123 Some street, Town
- personal http://example.com
```

**How it works:**
- Each line is a markdown list item starting with `-`
- The parser automatically detects field types (email, phone, URL, address)
- You can optionally prefix lines with kind labels like `home`, `work`, `personal`
- Changes sync bidirectionally between Contact section and frontmatter
- Emoji prefixes (📧, 📞, 🌐, 🏠) are added automatically when displaying

**Detection examples:**
- `- work contact@example.com` → `EMAIL.WORK: contact@example.com`
- `- home 555-555-5555` → `TEL.HOME: +1-555-555-5555` (normalized)
- `- personal http://example.com` → `URL.PERSONAL: http://example.com`
- Fields without kind use bare keys for first field: `EMAIL`, `TEL`, `URL`, `ADR`
- Additional fields of same type use array indexing: `EMAIL.0`, `EMAIL.1`, etc.

See the [Contact List Parsing Specification](specifications.md#contact-list-parsing) for complete details.

### Direct Frontmatter Editing

You can also edit contact fields directly in frontmatter using dot notation:

```yaml
EMAIL: first@email.com
EMAIL.0: second@email.com
EMAIL.HOME: jane@example.com
EMAIL.WORK: jane.work@company.com
TEL.CELL: +1-555-123-4567
URL.PERSONAL: https://jane.example.com
ADR.HOME.STREET: 123 Main St
ADR.HOME.LOCALITY: Springfield
ADR.HOME.POSTAL: 62701
```

Changes in frontmatter automatically sync to the Contact section.

**Note on structure**: The plugin uses the [flat](https://www.npmjs.com/package/flat) library to convert between hierarchical vCard structures and flat Obsidian frontmatter, ensuring consistent dot notation for all fields.

## Data Synchronization

### Frontmatter and Markdown Sync

The plugin maintains bidirectional synchronization between the Related list and frontmatter:

**Markdown to Frontmatter:**
- Relationships in the "## Related" section sync to RELATED fields in frontmatter
- Format: `RELATED.type: urn:uuid:target-uid` or `uid:custom-id` or `name:Contact Name`
- Multiple relationships of same type use array indexing: `RELATED.friend.0`, `RELATED.friend.1`, etc.
- Changes propagate to related contacts automatically
- Genderless types stored in frontmatter

**Frontmatter to Markdown:**
- RELATED fields in frontmatter appear in the "## Related" section
- UID references (`urn:uuid:`, `uid:`) are resolved to contact names for display
- Gender information affects relationship term rendering
- Format in markdown: `- relationship_kind [[Contact Name]]`

The plugin ensures both representations stay synchronized and updates the REV field only when data actually changes.

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

UIDs are stored in frontmatter using UUID format (preferred):
```yaml
UID: urn:uuid:12345678-1234-5678-9012-123456789012
```

In RELATED fields, three namespace formats are used:
- `urn:uuid:` - For valid UUID identifiers (preferred)
- `uid:` - For non-UUID unique identifiers
- `name:` - For contacts that don't exist yet

In the Related list, all contacts are displayed with their human-readable names using Obsidian wiki-links: `[[Contact Name]]`

### Revision Timestamps

The REV field tracks when contacts were last modified:

```yaml
REV: 20250925T141344Z
```

Format: `YYYYMMDDTHHMMSSZ` (e.g., September 25, 2025 at 14:13:44 UTC)

The plugin automatically updates REV whenever frontmatter changes, but only if the data actually changed. This prevents unnecessary updates and ensures efficient synchronization.

Used for:
- Conflict resolution during sync
- Determining which version is newer
- Maintaining data consistency across systems

## Next Steps

- Review [Feature Overview](features.md) for comprehensive capabilities
- Consult [VCard Format Guide](vcard-format.md) for field reference
- See [User Stories](user-stories.md) for usage scenarios
- Check [Development Guide](development/) to extend the plugin