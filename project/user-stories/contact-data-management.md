# Contact Data Management User Stories

Stories related to creating and managing individual contact data.

## 12. Contact Creation from Template

**As a user**, when I create a new contact note, I want it to follow a consistent template with proper frontmatter fields for UID, name, email, phone, and other vCard-standard fields.

**Test Location**: `tests/stories/contactCreation.spec.ts`

## 13. Gender-Aware Relationship Processing

**As a user**, I want the plugin to use gender information to create appropriate relationship labels (e.g., "son" vs "daughter" when rendering a "child" relationship). The plugin stores genderless relationship types internally (e.g., "parent", "child", "sibling") in frontmatter and vCard RELATED fields, but renders them with gender-specific terms in the Related list based on the GENDER field (M, F, NB, U). When I specify gendered terms like "mother", "father", "son", "daughter", the plugin infers the contact's gender and updates the GENDER field accordingly.

**Test Location**: `tests/stories/genderAwareProcessing.spec.ts`

## 14. UID-Based Contact Linking

**As a user**, I want contacts to be linked by their unique UIDs rather than just names, so that contact name changes don't break relationships. In the frontmatter and vCard RELATED fields, relationships use the format `urn:uuid:` for valid UUID identifiers, `uid:` for non-UUID unique identifiers, or `name:` when the contact doesn't exist yet. However, in the Related list, contacts are always displayed using their human-readable names with Obsidian wiki-link syntax `[[Contact Name]]`.

**Test Location**: `tests/stories/uidBasedLinking.spec.ts`

## 15. Contact Metadata Sync

**As a user**, I want changes to contact metadata (name, email, phone, address) in my Obsidian notes to be reflected in the corresponding VCF files automatically.

**Test Location**: `tests/stories/metadataSync.spec.ts`

## 16. Contact Deduplication

**As a user**, when importing VCF files, I want the plugin to detect existing contacts by UID and update them rather than creating duplicates.

**Test Location**: `tests/stories/contactDeduplication.spec.ts`

## 17. Efficient VCF Updates

**As a user**, I expect VCFs will only be updated when the data actually changes; the plugin should ensure vcard and front matter are always sorted to prevent relationships, which inherently have no "order," from shuffling around chaotically when refreshed. Specifically, when mapping relationships to frontmatter, the plugin sorts first by key, then by value, creating a deterministic ordering for serialization. The REV field is only updated when frontmatter actually changes.

**Test Location**: `tests/stories/efficientVcfUpdates.spec.ts`

---

**Related Specifications**: 
- [VCF Sync Specification](../specifications/vcf-sync-spec.md)
- [Gender Processing Specification](../specifications/gender-processing-spec.md)
