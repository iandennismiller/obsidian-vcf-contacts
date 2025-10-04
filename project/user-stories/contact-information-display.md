# Contact Information Display User Stories

Stories related to displaying and managing contact information in the Contact section.

## 30. Contact Section Display in Markdown

**As a user**, when I view a contact note, I want to see contact information like addresses, emails, and phone numbers displayed in a dedicated "Contact" section so that I can easily view contact details without parsing YAML frontmatter.

**Test Location**: `tests/stories/contactSectionDisplay.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md)

## 31. Fuzzy Template Configuration

**As a user**, I want the plugin to use flexible templates for displaying and parsing contact information so that minor formatting variations are tolerated and the sync process is forgiving.

**Test Location**: `tests/stories/fuzzyTemplateConfiguration.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md)

## 32. Contact Section Sync to Frontmatter

**As a user**, when I edit contact information in the Contact section and save the note, I want those changes to automatically sync back to the frontmatter so that my data stays consistent.

**Test Location**: `tests/stories/contactSectionToFrontmatter.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md#contact-section-to-frontmatter)

## 33. Frontmatter to Contact Section Sync

**As a user**, when frontmatter contains contact fields, I want those fields to automatically appear in the Contact section so that I can view and edit contact information in markdown.

**Test Location**: `tests/stories/frontmatterToContactSection.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md#frontmatter-to-contact-section)

## 34. Contact Section Field Organization

**As a user**, I want contact information in the Contact section to be organized logically and consistently so that I can easily find the information I need.

**Test Location**: `tests/stories/contactFieldOrganization.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md#display-format)

## 34a. Contact Section Before Related Section

**As a user**, I expect the Contact section to always appear before the Related section in contact notes so that I see basic contact information before relationship information.

**Test Location**: `tests/stories/contactSectionOrdering.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md)

## 35. Bidirectional Contact Sync Processors

**As a user**, I want curator processors to maintain synchronization between the Contact section and frontmatter so that changes flow bidirectionally and my data stays consistent.

**Test Location**: `tests/stories/bidirectionalContactSync.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md#bidirectional-sync)

## 37. Contact Section Creation from User Input

**As a user**, when I manually create or edit a Contact section in markdown, I want the plugin to recognize and parse it even if formatting isn't perfect, so that I have flexibility in how I enter data.

**Test Location**: `tests/stories/contactSectionUserInput.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md)

## 38. Contact Information Validation

**As a user**, I want the plugin to validate contact information when syncing so that I'm warned about invalid data without blocking the sync process.

**Test Location**: `tests/stories/contactValidation.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md#validation-and-error-handling)

## 38a. Remove Invalid Frontmatter Fields

**As a user**, I want to automatically clean up invalid contact fields from frontmatter so that I can fix data quality issues without manual editing.

**Test Location**: `tests/stories/removeInvalidFields.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md#validation-and-error-handling)

## 39. Contact Section and VCF Sync Integration

**As a user**, when I export contacts to VCF format or import from VCF files, I expect the Contact section to be synchronized properly so that contact information flows through the entire system.

**Test Location**: `tests/stories/contactVcfSync.spec.ts`

**Related Specifications**: 
- [Contact Section Specification](../specifications/contact-section.md#integration-with-vcf-sync)
- [VCF Sync Specification](../specifications/vcf-sync.md)

## 40. Contact Section Performance and Efficiency

**As a user**, I expect the Contact section sync to be efficient and not slow down my editing experience, even with large contact lists.

**Test Location**: `tests/stories/contactSectionPerformance.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md)

## 42. Contact List Parsing

**As a user**, I want a simple way to enter contact information in a Contact section using markdown list items so that the plugin can automatically detect field types without requiring rigid templates.

**Test Location**: `tests/stories/contactListParsing.spec.ts`

**Related Specifications**: [Contact Section Specification](../specifications/contact-section.md#contact-list-format)

---

**Related Specifications**: 
- [Contact Section Specification](../specifications/contact-section.md)
