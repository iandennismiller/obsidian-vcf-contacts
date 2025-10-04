# Contact Data Management User Stories

Stories related to creating and managing individual contact data.

## 12. Contact Creation from Template

**As a user**, when I create a new contact note, I want it to follow a consistent template with proper frontmatter fields for UID, name, email, phone, and other vCard-standard fields.

**Test Location**: `tests/stories/contactCreation.spec.ts`

## 13. Gender-Aware Relationship Processing

**As a user**, I want the plugin to use gender information to create appropriate relationship labels so that relationships are displayed naturally (e.g., "mother" instead of "parent", "son" instead of "child") when gender is known.

**Test Location**: `tests/stories/genderAwareProcessing.spec.ts`

**Related Specifications**: [Gender Processing Specification](../specifications/gender-processing.md)

## 14. UID-Based Contact Linking

**As a user**, I want contacts to be linked by their unique UIDs rather than just names, so that contact name changes don't break relationships and I can reliably maintain my contact network.

**Test Location**: `tests/stories/uidBasedLinking.spec.ts`

**Related Specifications**: [Relationship Management Specification](../specifications/relationship-management.md)

## 15. Contact Metadata Sync

**As a user**, I want changes to contact metadata (name, email, phone, address) in my Obsidian notes to be reflected in the corresponding VCF files automatically.

**Test Location**: `tests/stories/metadataSync.spec.ts`

## 16. Contact Deduplication

**As a user**, when importing VCF files, I want the plugin to detect existing contacts by UID and update them rather than creating duplicates.

**Test Location**: `tests/stories/contactDeduplication.spec.ts`

## 17. Efficient VCF Updates

**As a user**, I expect VCFs will only be updated when the data actually changes, so that I don't see unnecessary file modifications that trigger syncing and version control noise.

**Test Location**: `tests/stories/efficientVcfUpdates.spec.ts`

**Related Specifications**: [VCF Sync Specification](../specifications/vcf-sync.md)

---

**Related Specifications**: 
- [VCF Sync Specification](../specifications/vcf-sync.md)
- [Gender Processing Specification](../specifications/gender-processing.md)
