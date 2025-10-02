# User Stories for Obsidian VCF Contacts Plugin

This document outlines user stories and use cases for managing contacts and relationships in Obsidian using vCard (VCF) files. Each story represents a specific need or workflow that users want to accomplish with this plugin.

## VCF File Management Stories

### 1. Single VCF File Synchronization
**As a user**, I store my vCard contacts in a single VCF file and I want to keep that file synced with my Obsidian contacts so that any changes in Obsidian are reflected in my VCF file and vice versa.

### 2. Individual VCF Files in Folder
**As a user**, I store my vCard contacts as individual VCF files in a folder and I want to keep that folder synced with my Obsidian contacts so that each contact corresponds to one VCF file.

### 3. VCF File Drop Import
**As a user**, when I drop a VCF file into my Obsidian vault, I want the plugin to automatically import the contacts into my contacts folder and place the VCF file in my watch folder for ongoing synchronization.

### 4. Automatic VCF Monitoring
**As a user**, I want the plugin to monitor my VCF watch folder for changes and automatically update my Obsidian contacts when VCF files are modified externally.

### 5. VCF Export from Obsidian
**As a user**, I want to export my Obsidian contacts to VCF format so I can share them with other applications or backup my contact data.

## Relationship Management Stories

### 6. Bidirectional Relationship Sync
**As a user**, when I edit the relationships listed under the "## Related" section on a contact note, I expect the plugin to update this contact's frontmatter and other related contacts' frontmatter and Related lists to reflect the new relationship. The relationship list is a markdown list where each item follows the format `- relationship_kind [[Contact Name]]`, using Obsidian's wiki-link syntax to reference other contacts.

### 7. Automatic Reverse Relationships
**As a user**, when I add "- father [[John Doe]]" to Jane's contact, I want John's contact to automatically get "- daughter [[Jane Doe]]" (or "- child [[Jane Doe]]" if gender is not specified) in his relationships. The plugin handles bidirectional synchronization, ensuring both contacts are updated.

### 8. Complex Family Relationships
**As a user**, I want to manage complex family relationships like "mother-in-law", "step-father", "adopted-daughter" and have the plugin understand and maintain these relationships bidirectionally.

### 9. Professional Relationships
**As a user**, I want to track professional relationships like "colleague", "boss", "employee", "client", "vendor" and have them properly categorized and synced.

### 10. Social Relationships
**As a user**, I want to manage social relationships like "friend", "neighbor", "classmate", "teammate" and maintain them across my contact network.

### 11. Incremental Relationship Management
**As a user**, I want to add relationships (one at a time) to a contact over the course of several plugin load/unload cycles, with the expectation that relationships in the front matter and vcards will be curated and consistent.

### 11a. Relationship De-duplication
**As a user**, when I have duplicate relationships in my Related list (including cases where the same relationship appears with both gendered and ungendered terms like "mother" and "parent"), I want the plugin to automatically de-duplicate them. When a relationship appears twice - once with a gendered term (like "mother", "father", "sister", "brother") and once with an ungendered term (like "parent", "sibling") - the plugin should keep only the gendered version and infer the contact's gender from it. The plugin should also remove exact duplicate relationships where the same relationship type and contact appear multiple times. This ensures my Related list and frontmatter stay clean and consistent without manual intervention.

### 11b. Relationship Sync Preservation
**As a user**, when I manually invoke contact processing and a relationship exists in the Related list but is missing from frontmatter, I expect the plugin to add the missing relationship to frontmatter, not delete it from the Related list. Similarly, when a relationship exists in frontmatter but is missing from the Related list, the plugin should add it to the Related list, not delete it from frontmatter. The sync operations should always be additive (merging), never destructive (replacing), ensuring that relationships are preserved across both representations.

## Contact Data Management Stories

### 12. Contact Creation from Template
**As a user**, when I create a new contact note, I want it to follow a consistent template with proper frontmatter fields for UID, name, email, phone, and other vCard-standard fields.

### 13. Gender-Aware Relationship Processing
**As a user**, I want the plugin to use gender information to create appropriate relationship labels (e.g., "son" vs "daughter" when rendering a "child" relationship). The plugin stores genderless relationship types internally (e.g., "parent", "child", "sibling") in frontmatter and vCard RELATED fields, but renders them with gender-specific terms in the Related list based on the GENDER field (M, F, NB, U). When I specify gendered terms like "mother", "father", "son", "daughter", the plugin infers the contact's gender and updates the GENDER field accordingly.

### 14. UID-Based Contact Linking
**As a user**, I want contacts to be linked by their unique UIDs rather than just names, so that contact name changes don't break relationships. In the frontmatter and vCard RELATED fields, relationships use the format `urn:uuid:` for valid UUID identifiers, `uid:` for non-UUID unique identifiers, or `name:` when the contact doesn't exist yet. However, in the Related list, contacts are always displayed using their human-readable names with Obsidian wiki-link syntax `[[Contact Name]]`.

### 15. Contact Metadata Sync
**As a user**, I want changes to contact metadata (name, email, phone, address) in my Obsidian notes to be reflected in the corresponding VCF files automatically.

### 16. Contact Deduplication
**As a user**, when importing VCF files, I want the plugin to detect existing contacts by UID and update them rather than creating duplicates.

### 17. Efficient VCF Updates
**As a user**, I expect VCFs will only be updated when the data actually changes; the plugin should ensure vcard and front matter are always sorted to prevent relationships, which inherently have no "order," from shuffling around chaotically when refreshed. Specifically, when mapping relationships to frontmatter, the plugin sorts first by key, then by value, creating a deterministic ordering for serialization. The REV field is only updated when frontmatter actually changes.

## Advanced Workflow Stories

### 18. Bulk Contact Operations
**As a user**, I want to perform bulk operations like syncing all contacts, validating all relationships, or updating all VCF files from my Obsidian contacts at once.

### 19. Contact Validation and Integrity
**As a user**, I want the plugin to validate that all relationship references point to existing contacts and warn me about broken links or missing contacts.

### 20. Selective Field Synchronization  
**As a user**, I want to control which fields sync between Obsidian and VCF files, so I can keep some information private to Obsidian while sharing basic contact info via VCF.

### 21. Contact History and Versioning
**As a user**, I want to track when contact information was last updated (REV field) and maintain version consistency between Obsidian and VCF files. The REV field is a timestamp in the format `20250925T141344Z` that indicates when the information most recently changed. The plugin automatically updates REV whenever frontmatter changes, but only if the data actually changed, preventing unnecessary updates.

### 22. Integration Workflows
**As a user**, I want to integrate this plugin with my existing contact management workflow, including address books, CRM systems, and mobile devices that support vCard import/export.

### 23. Configurable Folder and Filename Settings
**As a user**, I want to control the folder or filename in the configuration settings; the rest of the plugin should make reference to these values as appropriate. When I select the VCF Folder storage method and enable the "Customize Ignore List" toggle, I expect to see input fields for specifying UIDs and filenames to ignore during sync. These ignore list settings should become visible immediately when I enable the customization toggle, without requiring any other settings to be enabled first.

### 24. Manual Relationship Synchronization
**As a user**, I want a command to manually trigger relationship synchronization across all contacts, ensuring that all bidirectional relationships are consistent and properly propagated through the graph.

### 25. Manual Curator Processor Execution
**As a user**, when I manually invoke the command "Run curator processors on current contact" and there are items in the Related list that are not in the front matter, **I expect** that the missing relationships will be added to the frontmatter. The processor should:

- Parse relationships from the Related markdown section
- Compare with existing frontmatter relationships
- Identify missing relationships accurately
- Resolve contact names to UIDs for proper references
- Update only when changes are needed
- Update REV timestamp appropriately
- Return meaningful feedback about changes made

**Test scenarios:**
1. **Adding Missing Relationships**: When a contact has relationships in the Related section but not in frontmatter, the processor should add both missing relationships to frontmatter using proper UID-based references (e.g., `urn:uuid:jane-uid-456`) and update the REV timestamp
2. **Partial Sync**: When a contact has one relationship in frontmatter and two in the Related section, only the missing relationship should be added to frontmatter
3. **No-Op**: When Related section and frontmatter are already in sync, the processor should return `undefined` (no action needed)
4. **REV Timestamp Update**: When relationships are added, the REV timestamp should be updated to the current time
5. **No Related Section**: When a contact has no Related section, the processor should return `undefined` gracefully

### 26. Curator Pipeline Integration and Sequential Execution
**As a user**, I expect the curator processing pipeline to maintain data integrity throughout all processing steps. When multiple curator processors run on the same contact:

- Each processor's changes should be preserved and not overwritten by other processors
- Processors should run sequentially (not concurrently) to prevent race conditions
- State changes should flow correctly between processors
- The final state should include changes from all processors
- No data should be lost due to concurrent writes

**Expected behavior:**
- When Processor A adds `RELATED[friend]` to frontmatter and Processor B adds `TEST_FIELD`, the final frontmatter should contain both changes
- If processors run concurrently and overwrite each other's changes, this is a **bug** that causes users to see changes appear then disappear
- The pipeline should be deterministic - running processors multiple times on the same contact should produce stable results
- Existing RELATED keys should be preserved when new relationships are added
- The system should handle contacts with no initial RELATED frontmatter correctly on the first run (not requiring multiple runs)

**Test Location**: `tests/stories/curatorPipelineIntegration.spec.ts`

## Technical Stories

### 27. Error Handling and Recovery
**As a user**, when sync operations fail or encounter errors, I want clear error messages and guidance on how to resolve conflicts between Obsidian and VCF data.

### 28. Performance with Large Contact Lists  
**As a user**, I want the plugin to handle large contact databases (hundreds or thousands of contacts) efficiently without slowing down Obsidian.

### 29. Backup and Restore
**As a user**, I want confidence that my contact data is safe, with the ability to backup and restore both Obsidian contacts and VCF files if something goes wrong.

## Contact Information Display Stories

### 30. Contact Section Display in Markdown
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

### 31. Fuzzy Template Configuration
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

### 32. Contact Section Sync to Frontmatter
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

### 33. Frontmatter to Contact Section Sync
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

### 34. Contact Section Field Organization
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

### 35. Bidirectional Contact Sync Processors
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

### 36. Contact Section Template Customization
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

### 37. Contact Section Creation from User Input
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
- Fuzzy matching identifies contact fields
- Missing type labels default to indexed numbers (EMAIL[1], EMAIL[2])
- Extra whitespace is ignored
- Common formatting variations are recognized
- Unrecognized content is preserved but not synced

### 38. Contact Information Validation
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

### 39. Contact Section and VCF Sync Integration
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

### 40. Contact Section Performance and Efficiency
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
- Template compilation is cached and reused