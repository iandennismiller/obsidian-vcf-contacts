# User Stories for Obsidian VCF Contacts Plugin

## VCF File Management

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

## Relationship Management

### 6. Bidirectional Relationship Sync

**As a user**, when I edit the relationships in my contact notes, I expect the changes to propagate to related contacts so that my contact network stays consistent.

### 7. Automatic Reverse Relationships

**As a user**, when I add a relationship to one contact, I want the reverse relationship to automatically appear on the related contact so that my contact network is bidirectionally consistent without manual effort.

### 8. Complex Family Relationships

**As a user**, I want to manage complex family relationships like "mother-in-law", "step-father", "adopted-daughter" and have the plugin understand and maintain these relationships bidirectionally.

### 9. Professional Relationships

**As a user**, I want to track professional relationships like "colleague", "boss", "employee", "client", "vendor" and have them properly categorized and synced.

### 10. Social Relationships

**As a user**, I want to manage social relationships like "friend", "neighbor", "classmate", "teammate" and maintain them across my contact network.

### 11. Incremental Relationship Management

**As a user**, I want to add relationships (one at a time) to a contact over the course of several plugin load/unload cycles, with the expectation that relationships in the front matter and vcards will be curated and consistent.

### 11a. Relationship De-duplication

**As a user**, when I have duplicate relationships in my Related list, I want the plugin to automatically clean them up so that my contact data stays organized without manual intervention.

### 11b. Relationship Sync Preservation

**As a user**, when the plugin syncs relationships, I expect it to preserve existing relationships in both frontmatter and the Related list rather than delete them, so that I don't lose data during synchronization.

## Contact Data Management

### 12. Contact Creation from Template

**As a user**, when I create a new contact note, I want it to follow a consistent template with proper frontmatter fields for UID, name, email, phone, and other vCard-standard fields.

### 13. Gender-Aware Relationship Processing

**As a user**, I want the plugin to use gender information to create appropriate relationship labels so that relationships are displayed naturally (e.g., "mother" instead of "parent", "son" instead of "child") when gender is known.

### 14. UID-Based Contact Linking

**As a user**, I want contacts to be linked by their unique UIDs rather than just names, so that contact name changes don't break relationships and I can reliably maintain my contact network.

### 15. Contact Metadata Sync

**As a user**, I want changes to contact metadata (name, email, phone, address) in my Obsidian notes to be reflected in the corresponding VCF files automatically.

### 16. Contact Deduplication

**As a user**, when importing VCF files, I want the plugin to detect existing contacts by UID and update them rather than creating duplicates.

### 17. Efficient VCF Updates

**As a user**, I expect VCFs will only be updated when the data actually changes, so that I don't see unnecessary file modifications that trigger syncing and version control noise.

## Advanced Workflows

### 18. Bulk Contact Operations

**As a user**, I want to perform bulk operations like syncing all contacts, validating all relationships, or updating all VCF files from my Obsidian contacts at once.

### 19. Contact Validation and Integrity

**As a user**, I want the plugin to validate that all relationship references point to existing contacts and warn me about broken links or missing contacts.

### 20. Selective Field Synchronization

**As a user**, I want to control which fields sync between Obsidian and VCF files, so I can keep some information private to Obsidian while sharing basic contact info via VCF.

### 21. Contact History and Versioning

**As a user**, I want to track when contact information was last updated so that I can see the freshness of my contact data and maintain version consistency between Obsidian and VCF files.

### 22. Integration Workflows

**As a user**, I want to integrate this plugin with my existing contact management workflow, including address books, CRM systems, and mobile devices that support vCard import/export.

### 23. Configurable Folder and Filename Settings

**As a user**, I want to control where my VCF files are stored and configure which files to ignore during sync, so that I can organize my contacts in a way that fits my workflow.

### 24. Manual Relationship Synchronization

**As a user**, I want a command to manually trigger relationship synchronization across all contacts, ensuring that all bidirectional relationships are consistent and properly propagated through the graph.

### 25. Manual Curator Processor Execution

**As a user**, when I manually invoke curator processors on a contact, I expect missing relationships from the Related section to be added to frontmatter so that my contact data stays consistent.

### 26. Curator Pipeline Integration and Sequential Execution

**As a user**, I expect the curator processing pipeline to maintain data integrity so that when multiple processors run, all changes are preserved and I don't lose data.

## Technical Requirements

### 27. Error Handling and Recovery

**As a user**, when sync operations fail or encounter errors, I want clear error messages and guidance on how to resolve conflicts between Obsidian and VCF data.

### 28. Performance with Large Contact Lists

**As a user**, I want the plugin to handle large contact databases (hundreds or thousands of contacts) efficiently without slowing down Obsidian.

### 29. Backup and Restore

**As a user**, I want confidence that my contact data is safe, with the ability to backup and restore both Obsidian contacts and VCF files if something goes wrong.

## Contact Information Display

### 30. Contact Section Display in Markdown

**As a user**, when I view a contact note, I want to see contact information like addresses, emails, and phone numbers displayed in a dedicated "Contact" section so that I can easily view contact details without parsing YAML frontmatter.

### 31. Fuzzy Template Configuration

**As a user**, I want the plugin to use flexible templates for displaying and parsing contact information so that minor formatting variations are tolerated and the sync process is forgiving.

### 32. Contact Section Sync to Frontmatter

**As a user**, when I edit contact information in the Contact section and save the note, I want those changes to automatically sync back to the frontmatter so that my data stays consistent.

### 33. Frontmatter to Contact Section Sync

**As a user**, when frontmatter contains contact fields, I want those fields to automatically appear in the Contact section so that I can view and edit contact information in markdown.

### 34. Contact Section Field Organization

**As a user**, I want contact information in the Contact section to be organized logically and consistently so that I can easily find the information I need.

### 34a. Contact Section Before Related Section

**As a user**, I expect the Contact section to always appear before the Related section in contact notes so that I see basic contact information before relationship information.

### 35. Bidirectional Contact Sync Processors

**As a user**, I want curator processors to maintain synchronization between the Contact section and frontmatter so that changes flow bidirectionally and my data stays consistent.

### 37. Contact Section Creation from User Input

**As a user**, when I manually create or edit a Contact section in markdown, I want the plugin to recognize and parse it even if formatting isn't perfect, so that I have flexibility in how I enter data.

### 38. Contact Information Validation

**As a user**, I want the plugin to validate contact information when syncing so that I'm warned about invalid data without blocking the sync process.

### 38a. Remove Invalid Frontmatter Fields

**As a user**, I want to automatically clean up invalid contact fields from frontmatter so that I can fix data quality issues without manual editing.

### 39. Contact Section and VCF Sync Integration

**As a user**, when I export contacts to VCF format or import from VCF files, I expect the Contact section to be synchronized properly so that contact information flows through the entire system.

### 40. Contact Section Performance and Efficiency

**As a user**, I expect the Contact section sync to be efficient and not slow down my editing experience, even with large contact lists.

### 42. Contact List Parsing

**As a user**, I want a simple way to enter contact information in a Contact section using markdown list items so that the plugin can automatically detect field types without requiring rigid templates.

## External Integration

### 43. vdirsyncer Configuration Integration

**As a user**, I want to configure vdirsyncer from within Obsidian so that I can set up bidirectional CardDAV synchronization without leaving my knowledge base environment.

**Context**: vdirsyncer is an open source utility that enables vCard files to be bidirectionally synced via CardDAV. The plugin provides a quality-of-life improvement by allowing users to view and edit the vdirsyncer config file from within Obsidian.
