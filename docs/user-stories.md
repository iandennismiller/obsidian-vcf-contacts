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
**As a user**, when I edit the relationships listed under the "Related list" section on a contact note, I expect the plugin to update this contact's frontmatter and other related contacts' frontmatter and Related lists to reflect the new relationship.

### 7. Automatic Reverse Relationships
**As a user**, when I add "father: [[John Doe]]" to Jane's contact, I want John's contact to automatically get "daughter: [[Jane Doe]]" in his relationships.

### 8. Complex Family Relationships
**As a user**, I want to manage complex family relationships like "mother-in-law", "step-father", "adopted-daughter" and have the plugin understand and maintain these relationships bidirectionally.

### 9. Professional Relationships
**As a user**, I want to track professional relationships like "colleague", "boss", "employee", "client", "vendor" and have them properly categorized and synced.

### 10. Social Relationships
**As a user**, I want to manage social relationships like "friend", "neighbor", "classmate", "teammate" and maintain them across my contact network.

## Contact Data Management Stories

### 11. Contact Creation from Template
**As a user**, when I create a new contact note, I want it to follow a consistent template with proper frontmatter fields for UID, name, email, phone, and other vCard-standard fields.

### 12. Gender-Aware Relationship Processing
**As a user**, I want the plugin to use gender information to create appropriate relationship labels (e.g., "son" vs "daughter" when adding a "child" relationship).

### 13. UID-Based Contact Linking
**As a user**, I want contacts to be linked by their unique UIDs rather than just names, so that contact name changes don't break relationships.

### 14. Contact Metadata Sync
**As a user**, I want changes to contact metadata (name, email, phone, address) in my Obsidian notes to be reflected in the corresponding VCF files automatically.

### 15. Contact Deduplication
**As a user**, when importing VCF files, I want the plugin to detect existing contacts by UID and update them rather than creating duplicates.

## Advanced Workflow Stories

### 16. Bulk Contact Operations
**As a user**, I want to perform bulk operations like syncing all contacts, validating all relationships, or updating all VCF files from my Obsidian contacts at once.

### 17. Contact Validation and Integrity
**As a user**, I want the plugin to validate that all relationship references point to existing contacts and warn me about broken links or missing contacts.

### 18. Selective Field Synchronization  
**As a user**, I want to control which fields sync between Obsidian and VCF files, so I can keep some information private to Obsidian while sharing basic contact info via VCF.

### 19. Contact History and Versioning
**As a user**, I want to track when contact information was last updated (REV field) and maintain version consistency between Obsidian and VCF files.

### 20. Integration Workflows
**As a user**, I want to integrate this plugin with my existing contact management workflow, including address books, CRM systems, and mobile devices that support vCard import/export.

## Technical Stories

### 21. Error Handling and Recovery
**As a user**, when sync operations fail or encounter errors, I want clear error messages and guidance on how to resolve conflicts between Obsidian and VCF data.

### 22. Performance with Large Contact Lists  
**As a user**, I want the plugin to handle large contact databases (hundreds or thousands of contacts) efficiently without slowing down Obsidian.

### 23. Backup and Restore
**As a user**, I want confidence that my contact data is safe, with the ability to backup and restore both Obsidian contacts and VCF files if something goes wrong.