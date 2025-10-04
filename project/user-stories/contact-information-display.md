# Contact Information Display User Stories

Stories related to displaying and managing contact information in the Contact section.

## 30. Contact Section Display in Markdown

**As a user**, when I view a contact note, I want to see contact information like addresses, emails, and phone numbers displayed in a dedicated "## Contact" section in the markdown. This section should render the frontmatter fields (like `ADR[HOME].STREET`, `EMAIL[WORK]`, `TEL[CELL]`) in a human-readable format, making it easy to view contact details without parsing YAML frontmatter.

**Expected behavior:**
- Contact information appears under a `## Contact` heading
- Fields are formatted using a "fuzzy template" that defines both display and parsing rules
- The section is automatically generated from frontmatter fields
- The display is readable and well-organized
- Common fields like email, phone, and address are supported

**Example display:**
```markdown
## Contact

📧 Email
- Home: bruce.wayne@wayneenterprises.com
- Work: batman@batcave.org

📞 Phone
- Cell: +12125550000
- Batphone: +12125550001

🏠 Address (Home)
1007 Mountain Drive
Gotham, 10001
USA

🌐 Website
- Home: https://wayneenterprises.com/bruce
- Work: https://batcave.org/batman
```

**Test Location**: `tests/stories/contactSectionDisplay.spec.ts`

## 31. Fuzzy Template Configuration

**As a user**, I want the plugin to use a "fuzzy template" string that configures how contact information is displayed and parsed. The fuzzy template should:

- Define field mapping from frontmatter to display format
- Support pattern matching for parsing user edits back to frontmatter
- Be flexible enough to handle variations in formatting
- Work bidirectionally (display and parsing)
- Be configurable per field type (email, phone, address, etc.)

**Template syntax examples:**
- Email template: `{TYPE}: {VALUE}` matches "Home: email@example.com"
- Phone template: `{TYPE}: {VALUE}` matches "Cell: +1-555-0000"
- Address template: multi-line pattern with street, city, postal, country
- URL template: `{TYPE}: {VALUE}` matches "Work: https://example.com"

**Expected behavior:**
- Templates handle optional fields gracefully (e.g., missing TYPE)
- Fuzzy matching tolerates minor formatting variations
- Parsing extracts data back to frontmatter fields
- Display uses the same template to format output consistently

**Test Location**: `tests/stories/fuzzyTemplateConfiguration.spec.ts`

## 32. Contact Section Sync to Frontmatter

**As a user**, when I edit contact information in the "## Contact" section and save the note, I want those changes to automatically sync back to the frontmatter. Similar to how the Related list syncs relationships, the Contact section should:

- Parse edited contact information from markdown
- Update corresponding frontmatter fields
- Handle additions, modifications, and deletions
- Use fuzzy template matching to identify fields
- Update REV timestamp when changes are made
- Preserve formatting where possible

**Test scenarios:**
1. **Adding new email**: When I add "Personal: john@personal.com" to the Email section, the frontmatter should add `EMAIL[PERSONAL]: john@personal.com`
2. **Editing existing phone**: When I change "Cell: +1-555-0000" to "Cell: +1-555-9999", the frontmatter `TEL[CELL]` should update to the new number
3. **Removing address field**: When I delete the street address line, the corresponding `ADR[HOME].STREET` frontmatter field should be removed
4. **No-Op**: When the Contact section matches frontmatter exactly, no updates should occur
5. **REV Update**: When contact information changes, REV timestamp should update

**Test Location**: `tests/stories/contactSectionToFrontmatter.spec.ts`

## 33. Frontmatter to Contact Section Sync

**As a user**, when frontmatter contains contact fields like `EMAIL[HOME]`, `TEL[WORK]`, `ADR[HOME].STREET`, etc., I want those fields to automatically appear in the "## Contact" section. This curator processor should:

- Detect contact-related frontmatter fields
- Generate Contact section content using fuzzy templates
- Group fields by type (email, phone, address, etc.)
- Format fields consistently
- Handle multiple values of the same type (e.g., multiple emails)
- Sort fields in a logical order

**Expected behavior:**
- When a contact has `EMAIL[HOME]` and `EMAIL[WORK]` in frontmatter, both appear in the Email subsection
- When a contact has address fields, they're formatted as a complete postal address
- Phone numbers are grouped together with their types
- URLs/websites are listed together
- The section is created if it doesn't exist
- The section is updated if frontmatter changes

**Test Location**: `tests/stories/frontmatterToContactSection.spec.ts`

## 34. Contact Section Field Organization

**As a user**, I want contact information in the Contact section to be organized logically and consistently. The plugin should:

- Group similar fields together (all emails, all phones, all addresses)
- Use visual indicators (emoji or headers) to separate field types
- Display fields in a predictable order
- Handle complex structured fields like addresses
- Show field types/labels clearly (Home, Work, Cell, etc.)
- Format multi-line fields (like addresses) properly

**Field organization priority:**
1. Email addresses
2. Phone numbers
3. Physical addresses
4. Websites/URLs
5. Social media profiles
6. Other contact fields

**Structured field handling:**
- Addresses: Format as complete postal address block (street, locality, region, postal, country)
- Names: Show prefix, given, middle, family, suffix in readable format
- Dates: Display in user-friendly format (not ISO 8601)

**Test Location**: `tests/stories/contactFieldOrganization.spec.ts`

## 34a. Contact Section Before Related Section

**As a user**, I expect the Contact section to always appear before the Related section in contact notes. This ensures a consistent document structure where contact information (email, phone, address) is presented before relationship information. The plugin should:

- Place the Contact section before the Related section when both exist
- Maintain this ordering when adding new sections
- Preserve this ordering when updating existing sections
- Handle edge cases like missing sections gracefully

**Expected behavior:**
- When adding a Contact section to a note with an existing Related section, insert Contact before Related
- When adding a Related section to a note with an existing Contact section, insert Related after Contact
- When both sections exist and are out of order, maintain their current positions during updates (fixing ordering is a separate operation)
- The sections should appear in this order: frontmatter → body content → Contact section → Related section → hashtags

**Test Location**: `tests/stories/contactSectionOrdering.spec.ts`

## 35. Bidirectional Contact Sync Processors

**As a user**, I want two curator processors that maintain synchronization between the Contact section and frontmatter, similar to how Related list synchronization works:

**ContactToFrontMatterProcessor:**
- Processes Contact section markdown
- Parses contact information using fuzzy templates
- Updates frontmatter with parsed data
- Handles additions, edits, and deletions
- Updates REV when changes occur

**FrontMatterToContactProcessor:**
- Processes frontmatter contact fields
- Generates Contact section using fuzzy templates
- Adds missing contact information to markdown
- Formats data consistently
- Creates Contact section if missing

**Expected behavior:**
- Processors run as part of the curator pipeline
- Processing is additive and preserves data
- Changes flow bidirectionally
- REV timestamp updates only when data actually changes
- Processors can be enabled/disabled in settings

**Test Location**: `tests/stories/bidirectionalContactSync.spec.ts`

## 36. Contact Section Template Customization

**As a user**, I want to customize how contact information is displayed in the Contact section. The plugin should provide:

- Default fuzzy templates for common field types
- Settings to customize templates per field type
- Template variables for field components (TYPE, VALUE, etc.)
- Examples of template syntax in settings
- Preview of how templates affect display

**Customizable aspects:**
- Field labels and separators
- Multi-line field formatting (especially addresses)
- Visual indicators (emoji, bullets, etc.)
- Field ordering within each type
- Type label formatting (e.g., "Home", "(Home)", "[Home]")

**Settings interface:**
```
Contact Section Templates

Email Template:
{TYPE}: {VALUE}

Phone Template:
{TYPE}: {VALUE}

Address Template:
{STREET}
{LOCALITY}, {REGION} {POSTAL}
{COUNTRY}

URL Template:
{TYPE}: {VALUE}
```

**Test Location**: `tests/stories/contactTemplateCustomization.spec.ts`

## 37. Contact Section Creation from User Input

**As a user**, when I manually create or edit a Contact section in markdown, I want the plugin to recognize and parse it even if formatting isn't perfect. The fuzzy template matching should:

- Tolerate variations in whitespace
- Handle different line break patterns
- Accept alternative separators
- Work with or without field type labels
- Parse incomplete information gracefully

**Example variations that should all work:**
```markdown
## Contact
Email: john@example.com
john.work@company.com

## Contact
📧 Emails
Home: john@example.com
Work: john.work@company.com

## Contact
Email
- john@example.com (Home)
- john.work@company.com (Work)
```

**Expected behavior:**
- Fuzzy matching identifies contact fields from parsed markdown structure
- Missing type labels default to bare for first (EMAIL), then indexed (EMAIL[1], EMAIL[2])
- Extra whitespace is ignored
- Common formatting variations are recognized
- Unrecognized content is preserved but not synced

**Test Location**: `tests/stories/contactSectionUserInput.spec.ts`

## 38. Contact Information Validation

**As a user**, I want the plugin to validate contact information when syncing from the Contact section to frontmatter. The plugin should:

- Validate email format (basic pattern matching)
- Validate phone number format (flexible patterns)
- Validate URL format
- Check for required fields in structured data (e.g., addresses)
- Warn about invalid data without blocking sync

**Validation rules:**
- Email: Contains @ symbol and domain
- Phone: Contains digits and optional country code/formatting
- URL: Valid URL scheme (http://, https://)
- Address: At least one non-empty component
- Dates: Valid date format

**Expected behavior:**
- Invalid data generates warnings in console
- Sync continues with best-effort parsing
- User is notified about validation issues
- Seriously malformed data may be skipped

**Test Location**: `tests/stories/contactValidation.spec.ts`

## 38a. Remove Invalid Frontmatter Fields

**As a user**, I want to automatically clean up invalid contact fields from frontmatter so I can fix data quality issues caused by accidentally entering bad data. The plugin should provide:

- Command to remove invalid fields from current contact
- Command to remove invalid fields from all contacts
- Validation of EMAIL, TEL, and URL field formats (NOT date fields)
- Preview modal showing fields that will be removed (when confirmation is enabled)
- Configuration setting to control whether confirmation is required
- Notification showing number of invalid fields removed

**Validation rules for removal:**
- EMAIL fields must contain @ symbol and domain (e.g., user@domain.com)
- TEL fields must contain at least some digits (7+ characters)
- URL fields must start with http:// or https://
- Date fields (BDAY, REV, ANNIVERSARY) are NOT validated and will remain even if invalid

**Configuration:**
- Setting: "Confirm before removing invalid fields"
- When enabled: Shows preview modal before removing fields
- When disabled: Removes fields immediately without confirmation

**Expected behavior:**
- Command identifies invalid fields and shows count
- If confirmation is enabled, modal shows preview with field details and reasons
- User can confirm or cancel the removal
- Invalid fields are removed from frontmatter only after confirmation (if enabled)
- File is saved with cleaned frontmatter
- Notice confirms number of fields removed
- Valid fields are preserved unchanged

**Example scenario:**
1. User accidentally enters `EMAIL[HOME]: not-an-email` in frontmatter
2. User runs "Remove invalid frontmatter fields from current contact" command
3. Plugin identifies the invalid email field
4. If confirmation enabled: Modal shows "EMAIL[HOME]: not-an-email - Invalid email format (must contain @ and domain)"
5. User clicks "Remove Invalid Fields" to confirm
6. Plugin removes `EMAIL[HOME]` from frontmatter
7. Plugin saves the file and shows "Removed 1 invalid field(s)"

**Test Location**: `tests/stories/removeInvalidFields.spec.ts`

## 39. Contact Section and VCF Sync Integration

**As a user**, when I export contacts to VCF format or import from VCF files, I expect the Contact section to be synchronized properly. The plugin should:

- Export Contact section data to VCF fields
- Import VCF contact fields to Contact section (via frontmatter)
- Maintain field type mappings (HOME, WORK, CELL, etc.)
- Preserve structured field organization
- Handle VCF-specific field formats

**Expected behavior:**
- VCF export includes all contact fields from frontmatter
- VCF import populates frontmatter, triggering Contact section creation
- Field types are preserved (e.g., `EMAIL;TYPE=HOME` maps to `EMAIL[HOME]`)
- Structured fields like ADR are properly mapped
- Round-trip VCF export/import preserves all contact data

**Test Location**: `tests/stories/contactVcfSync.spec.ts`

## 40. Contact Section Performance and Efficiency

**As a user**, I expect the Contact section sync to be efficient and not slow down my editing experience. The plugin should:

- Parse Contact section only when changed
- Use incremental updates where possible
- Cache parsed templates
- Minimize file writes
- Process only affected contacts

**Performance expectations:**
- Contact section parsing completes in < 100ms for typical contacts
- Frontmatter updates occur only when data changes
- Large contact lists (100+ contacts) don't cause lag
- Sync operations don't block the UI

**Test Location**: `tests/stories/contactSectionPerformance.spec.ts`

## 41. Contact Template Customization

**As a user**, I want to customize how the Contact section displays information by editing a template string in my plugin settings so that I can control the appearance and content of contact information in an open-ended, flexible way. The plugin should allow me to:

- Edit a template string that controls the entire Contact section format
- Use template variables to control which fields are displayed and how
- Control field ordering through template structure
- Customize icons, labels, and formatting through the template
- Show first field only or all fields using template directives

**Configuration interface:**
- A dedicated "Contact Section Template" section in plugin settings
- A large text area for editing the template string
- Documentation of available template variables directly in the UI
- A "Reset to Default" button to restore the default template
- Immediate application of changes to Contact sections

**Template Variables:**

*Field Type Sections:*
- `{{#EMAIL}}...{{/EMAIL}}` - Email fields section
- `{{#TEL}}...{{/TEL}}` - Phone fields section
- `{{#ADR}}...{{/ADR}}` - Address fields section
- `{{#URL}}...{{/URL}}` - Website fields section

*Field Display Control:*
- `{{#FIRST}}...{{/FIRST}}` - Show only first field of this type
- `{{#ALL}}...{{/ALL}}` - Show all fields of this type

*Field Data:*
- `{{LABEL}}` - Field label (e.g., Home, Work, Cell) in title case
- `{{VALUE}}` - Field value

*Address Components:*
- `{{STREET}}` - Street address
- `{{LOCALITY}}` - City/locality
- `{{REGION}}` - State/region
- `{{POSTAL}}` - Postal/zip code
- `{{COUNTRY}}` - Country

*Whitespace Control:*
- Add `-` suffix to closing tags (e.g., `{{/EMAIL-}}`) for tight whitespace control
- Hyphen trims leading/trailing whitespace from section content and adds exactly one newline after
- Without hyphen: `{{/EMAIL}}` preserves all template whitespace
- With hyphen: `{{/EMAIL-}}` trims whitespace and normalizes to single newline
- Use hyphen for clean, compact output without extra blank lines

**Default template:**
```
## Contact

{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
{{#TEL-}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}
{{#ADR-}}
🏠 Address
{{#FIRST}}({{LABEL}})
{{STREET}}
{{LOCALITY}}, {{REGION}} {{POSTAL}}
{{COUNTRY}}

{{/FIRST}}
{{/ADR-}}
{{#URL-}}
🌐 Website
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/URL-}}
```

**Expected behavior:**
- When I edit the template string, changes apply to all Contact sections
- Field type sections (EMAIL, TEL, etc.) only render if fields exist
- FIRST directive shows only the first field, ALL directive shows all fields
- Labels are automatically formatted to title case (e.g., "WORK" → "Work")
- Numeric indices are stripped from labels (e.g., "1:WORK" → "Work")
- Hyphen suffix on tags removes trailing newlines unconditionally
- Invalid template syntax is handled gracefully
- Settings are persisted across Obsidian restarts

**Advanced customization examples:**
- Show all emails: Change `{{#FIRST}}` to `{{#ALL}}` in EMAIL section
- Remove icons: Delete the emoji characters from each section
- Change field order: Reorder the field type sections in the template
- Custom formatting: Add your own text, bullets, or formatting around variables
- Hide field types: Remove entire field type sections from the template
- Multi-line formats: Use newlines and spacing to control layout
- Precise spacing: Use hyphen suffix to control where newlines appear

**Test Location**: `tests/stories/contactTemplateCustomization.spec.ts`

## 42. Contact List Parsing

**As a user**, I want a simple, flexible way to enter contact information in a Contact section using markdown list items so that I don't need to follow rigid templates and the plugin can automatically detect what type of information each line contains.

**User Experience:**

I can enter contact information as simple list items:
```markdown
## Contact

- home 555-555-5555
- contact@example.com
- work contact@example.com
- 123 Some street
- 123 Some street, Town
- http://example.com
- personal http://example.com
```

**Expected Behavior:**

The plugin should:
1. **Auto-detect field types** - Use pattern matching to identify if a line is an email, phone, URL, or address
2. **Extract optional kind prefixes** - Parse optional labels like `home`, `work`, `personal` before the value
3. **Insert emoji prefixes automatically** - Add appropriate emojis (📧, 📞, 🌐, 🏠) when displaying
4. **Sync to frontmatter** - Create frontmatter keys using format `FIELDTYPE[KIND]: value`

**Detection Examples:**

All examples from the user input above produce the following results:

- `- home 555-555-5555`
  - Detects as: TEL (phone)
  - Kind: home
  - Frontmatter: `TEL[HOME]: +1-555-555-5555` (normalized)
  - Display: `📞 home +1-555-555-5555`

- `- contact@example.com`
  - Detects as: EMAIL
  - Kind: null (no prefix)
  - Frontmatter: `EMAIL: contact@example.com`
  - Display: `📧 contact@example.com`

- `- work contact@example.com`
  - Detects as: EMAIL
  - Kind: work
  - Frontmatter: `EMAIL[WORK]: contact@example.com`
  - Display: `📧 work contact@example.com`

- `- 123 Some street`
  - Detects as: ADR (address)
  - Kind: null (no prefix)
  - Frontmatter: `ADR.STREET: 123 Some street`
  - Display: `🏠 123 Some street`

- `- 123 Some street, Town`
  - Detects as: ADR (address)
  - Kind: null (no prefix)
  - Frontmatter: `ADR.STREET: 123 Some street`, `ADR.LOCALITY: Town`
  - Display: `🏠 123 Some street, Town`

- `- http://example.com`
  - Detects as: URL
  - Kind: null (no prefix)
  - Frontmatter: `URL: http://example.com`
  - Display: `🌐 http://example.com`

- `- personal http://example.com`
  - Detects as: URL
  - Kind: personal
  - Frontmatter: `URL[PERSONAL]: http://example.com`
  - Display: `🌐 personal http://example.com`

**Supported Kinds:**

The "kind" prefix is optional and can be any label the user wants:
- **Email**: home, work, personal, vacation, etc.
- **Phone**: home, work, cell, mobile, fax, etc.
- **URL**: home, work, personal, etc.
- **Address**: home, work, etc.

If no kind is specified, fields use bare keys for the first field (e.g., `EMAIL`, `TEL`), then indexed for subsequent fields (e.g., `EMAIL[1]`, `EMAIL[2]`).

**Implementation Details:**

The plugin provides a general-purpose parsing method and field-specific parsers:

**Core Function:**
- **`parseContactListItem(line: string): ParsedContactLine`**
  - General parser that auto-detects field type and extracts optional kind prefix
  - Returns: `{ fieldType: 'EMAIL' | 'TEL' | 'URL' | 'ADR' | null, kind: string | null, value: string }`
  - Handles list markers (strips `-` prefix automatically)
  - Uses smart detection logic (see below)

**Field-Specific Parsers:**
- **`parseEmailLine(line: string): { kind: string | null; value: string }`**
  - Parses email lines with optional kind prefix
  - Normalizes email to lowercase
  - Returns empty if line is not an email

- **`parsePhoneLine(line: string): { kind: string | null; value: string }`**
  - Parses phone lines with optional kind prefix
  - Normalizes phone numbers to international format (e.g., `+1-555-123-4567`)
  - Returns empty if line is not a phone number

- **`parseUrlLine(line: string): { kind: string | null; value: string }`**
  - Parses URL lines with optional kind prefix
  - Normalizes URLs by adding protocol if missing (defaults to `https://`)
  - Returns empty if line is not a URL

- **`parseAddressLine(line: string): { kind: string | null; value: string }`**
  - Parses address lines with optional kind prefix
  - Extracts kind only when value starts with a digit (typical for addresses)
  - Returns empty if line is not an address

**Smart Detection Logic:**

The parser uses a priority-based approach for reliable field type detection:

1. **Check whole line first**: If the entire line matches EMAIL/TEL/URL pattern → no kind prefix
   - Example: `contact@example.com` → EMAIL with no kind

2. **Try removing first word**: If removing the first word reveals EMAIL/TEL/URL → first word is the kind
   - Example: `work contact@example.com` → EMAIL with kind "work"
   - Example: `home 555-555-5555` → TEL with kind "home"

3. **Address handling**: For addresses (ADR), extract kind only if:
   - First word is alphabetic (potential kind label)
   - AND value part starts with a digit (typical for addresses like "123 Main St")
   - Example: `home 123 Main St` → ADR with kind "home"
   - Example: `some random text` → ADR with no kind (whole line is value)

4. **Fallback**: Unidentifiable text is treated as address (ADR) type

**Benefits:**

- No rigid template required
- Easy to read and write
- Flexible - works with or without kind labels
- Auto-detection reduces errors
- Parser is forgiving of formatting variations
- Consistent with markdown list conventions
- Separate methods allow custom processing per field type
- Normalization ensures consistent data format

**Integration:**

This parsing method works within the existing Contact Section Sync feature:
- ContactToFrontMatterProcessor uses `parseContactListItem()` for parsing
- FrontMatterToContactProcessor generates this format for display
- Bidirectional sync maintains consistency
- Works alongside other Contact section formats
- All functions exported from `src/models/contactNote` module

**Test Location**: `tests/stories/contactListParsing.spec.ts`

---

**Related Specifications**: 
- [Contact Section Specification](../specifications/contact-section-spec.md)
