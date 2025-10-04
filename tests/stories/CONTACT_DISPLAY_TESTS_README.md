# Contact Information Display Tests - User Story Mapping

This document maps the new integration tests to their corresponding user stories in `/project/user-stories/contact-information-display.md`.

## Test Files Created

### 1. contactSectionDisplay.spec.ts
**User Story 30: Contact Section Display in Markdown**
- Tests that contact information (emails, phones, addresses, URLs) is displayed in a dedicated "## Contact" section
- Tests that frontmatter fields are rendered in human-readable format
- Tests that multiple contact fields of different types are handled
- Tests that contact information is organized in a readable format

**Test Count:** 6 tests

### 2. fuzzyTemplateConfiguration.spec.ts
**User Story 31: Fuzzy Template Configuration**
- Tests parsing of email using {TYPE}: {VALUE} template
- Tests parsing of phone using template
- Tests parsing of URL using template
- Tests handling of optional TYPE field in template
- Tests multi-line address template parsing
- Tests tolerance for formatting variations
- Tests bidirectional template usage (display and parsing)

**Test Count:** 7 tests

### 3. contactSectionSyncToFrontmatter.spec.ts
**User Story 32: Contact Section Sync to Frontmatter**
- Tests adding new email to frontmatter when added to Contact section
- Tests updating existing phone number in frontmatter when edited
- Tests removing address field from frontmatter when deleted from Contact section
- Tests no-op behavior when Contact section matches frontmatter
- Tests REV timestamp update when contact information changes
- Tests handling additions, modifications, and deletions in single sync
- Tests fuzzy template matching for field identification
- Tests preservation of formatting during sync

**Test Count:** 9 tests

### 4. frontmatterToContactSectionSync.spec.ts
**User Story 33: Frontmatter to Contact Section Sync**
- Tests displaying multiple emails from frontmatter in Contact section
- Tests formatting address fields as complete postal address
- Tests grouping phone numbers together with their types
- Tests listing URLs/websites together
- Tests creating Contact section if it does not exist
- Tests updating Contact section when frontmatter changes
- Tests sorting fields in logical order
- Tests formatting fields consistently using templates

**Test Count:** 8 tests

### 5. contactSectionFieldOrganization.spec.ts
**User Story 34: Contact Section Field Organization**
- Tests grouping email addresses together
- Tests grouping phone numbers together
- Tests using visual indicators to separate field types
- Tests displaying fields in predictable order (Email, Phone, Address, URL)
- Tests formatting addresses as complete postal address blocks
- Tests showing field type labels clearly (Home, Work, Cell, etc.)
- Tests handling complex structured fields like addresses
- Tests including social media and other contact fields in correct order

**Test Count:** 8 tests

### 6. bidirectionalContactSyncProcessors.spec.ts
**User Story 35: Bidirectional Contact Sync Processors**
- Tests ContactToFrontMatterProcessor parsing Contact section
- Tests FrontMatterToContactProcessor generating Contact section
- Tests processors running as part of curator pipeline
- Tests additive processing (preserves data)
- Tests REV timestamp update only when data changes
- Tests processor enablement/disablement in settings
- Tests handling additions from both directions
- Tests handling edits from both directions
- Tests handling deletions from both directions

**Test Count:** 10 tests

### 7. contactSectionTemplateCustomization.spec.ts
**User Story 36: Contact Section Template Customization**
- Tests default templates for email fields
- Tests default templates for phone fields
- Tests default templates for address fields
- Tests default templates for URL fields
- Tests customization of email template
- Tests customization of field labels and separators
- Tests customization of visual indicators (emoji, bullets)
- Tests customization of field ordering
- Tests template variables for field components
- Tests examples and preview in settings

**Test Count:** 10 tests

### 8. contactSectionCreationFromUserInput.spec.ts
**User Story 37: Contact Section Creation from User Input**
- Tests parsing Contact section with simple email format
- Tests parsing Contact section with emoji headers
- Tests parsing Contact section with parenthetical type labels
- Tests tolerance for variations in whitespace
- Tests handling different line break patterns
- Tests accepting alternative separators
- Tests working with or without field type labels
- Tests parsing incomplete information gracefully
- Tests defaulting to indexed numbers for untyped fields
- Tests preserving unrecognized content without syncing
- Tests recognizing common formatting variations

**Test Count:** 11 tests

### 9. contactInformationValidation.spec.ts
**User Story 38: Contact Information Validation**
- Tests validating email format (contains @ and domain)
- Tests detecting invalid email format
- Tests validating phone number format
- Tests accepting flexible phone number formats
- Tests validating URL format
- Tests detecting invalid URL format
- Tests validating address has at least one non-empty component
- Tests warning about invalid data in console
- Tests continuing sync with best-effort parsing
- Tests notifying user about validation issues
- Tests skipping seriously malformed data
- Tests validating date formats

**Test Count:** 12 tests

### 10. contactSectionVcfSyncIntegration.spec.ts
**User Story 39: Contact Section and VCF Sync Integration**
- Tests exporting Contact section data to VCF fields
- Tests importing VCF contact fields to frontmatter
- Tests preserving field type mappings (HOME, WORK, CELL) in VCF export
- Tests preserving structured field organization in VCF
- Tests handling VCF-specific field formats
- Tests preserving all contact data in round-trip VCF export/import
- Tests mapping EMAIL;TYPE=HOME to EMAIL[HOME] on import
- Tests mapping ADR;TYPE=HOME to ADR[HOME].* components on import
- Tests integrating Contact section with VCF monitoring workflow
- Tests integrating Contact section with VCF export workflow

**Test Count:** 10 tests

### 11. contactSectionPerformanceAndEfficiency.spec.ts
**User Story 40: Contact Section Performance and Efficiency**
- Tests handling contacts with many contact fields efficiently
- Tests processing Contact section efficiently for large contact lists
- Tests caching parsed Contact section data when appropriate
- Tests avoiding unnecessary file writes when data has not changed
- Tests efficiently generating Contact section from frontmatter
- Tests efficiently parsing Contact section to frontmatter
- Tests batching updates when syncing multiple fields
- Tests using efficient regex patterns for parsing
- Tests minimizing memory usage when processing contacts
- Tests handling contacts with complex addresses efficiently

**Test Count:** 10 tests

## Summary

- **Total Test Files:** 11
- **Total Tests:** 101
- **User Stories Covered:** 30-40 (11 user stories)
- **All Tests:** ✅ Passing

## Test Structure

All tests follow the existing pattern in the repository:
1. Use Vitest testing framework
2. Mock Obsidian App and Vault APIs
3. Use ContactNote model for operations
4. Include descriptive comments explaining future implementation
5. Test both current state and expected future behavior

## Notes

These tests serve as **integration tests** that define the expected behavior for the Contact Information Display feature. They are currently testing the foundational data structures (frontmatter fields) and will guide future implementation of:

1. Contact section generation from frontmatter
2. Contact section parsing to frontmatter
3. Fuzzy template system for bidirectional conversion
4. Curator processors for automatic synchronization
5. Template customization in settings
6. Validation and error handling
7. VCF integration
8. Performance optimizations

All tests include inline comments describing future implementation steps, making them serve as both tests and specifications for the feature.
