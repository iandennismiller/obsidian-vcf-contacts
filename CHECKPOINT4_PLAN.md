# Checkpoint 4: Core ContactNote ~200 LOC Refactoring Plan

## Goal
Extract methods from ContactNote (currently 2,313 LOC) to separate entity files, leaving a clean ~200 LOC core that delegates to entities.

## Method Categories (49 public methods total)

### Core File/Data Access (Keep in ContactNote - ~50 LOC)
- constructor
- getFile()
- getUID()
- getDisplayName()
- getContent()
- getFrontmatter()
- invalidateCache()

### Gender Operations → genderOperations.ts (~100 LOC)
- parseGender()
- getGender()
- updateGender()
- getGenderedRelationshipTerm()
- inferGenderFromRelationship()
- convertToGenderlessType()

### Frontmatter Operations → frontmatterOperations.ts (~100 LOC)
- updateFrontmatterValue()
- updateMultipleFrontmatterValues()
- identifyInvalidFrontmatterFields()
- removeFieldsFromFrontmatter()

### Relationship Parsing → relationshipParsing.ts (~300 LOC)
- parseRelatedSection()
- parseFrontmatterRelationships()
- parseRelatedValue()
- extractRelationshipType()

### Relationship Resolution → relationshipResolution.ts (~300 LOC)
- findContactByName()
- resolveContact()
- resolveContactByUID()
- resolveContactFileByUID()
- resolveContactNameByUID()
- resolveRelationshipTarget()

### Relationship Formatting → relationshipFormatting.ts (~200 LOC)
- formatRelatedValue()
- updateRelatedSectionInContent()

### Relationship Sync → relationshipSync.ts (~400 LOC)
- syncRelatedListToFrontmatter()
- syncFrontmatterToRelatedList()
- performFullSync()
- validateRelationshipConsistency()

### Advanced Relationship Operations → relationshipAdvanced.ts (~400 LOC)
- getRelationships()
- processReverseRelationships()
- upgradeNameBasedRelationshipsToUID()
- detectUIDConflicts()
- updateRelationshipUID()

### Validation Operations → validationOperations.ts (~150 LOC)
- validateRequiredFields()
- validateEmail()
- validatePhoneNumber()
- validateDate()
- sanitizeInput()
- validateContactFields()

### Revision Operations → revisionOperations.ts (~100 LOC)
- getCacheStatus()
- generateRevTimestamp()
- parseRevDate()
- shouldUpdateFromVcard()

### Contact Section Operations → contactSectionOps.ts (~200 LOC)
- parseContactSection()
- generateContactSection()
- updateContactSectionInContent()

## Target Structure

```typescript
// contactNote.ts (~200 LOC)
export class ContactNote {
  private app: App;
  private settings: ContactsPluginSettings;
  private contactData: ContactData;
  
  // Entity delegates
  private genderOps: GenderOperations;
  private frontmatterOps: FrontmatterOperations;
  private relationshipParsing: RelationshipParsing;
  private relationshipResolution: RelationshipResolution;
  // ... etc
  
  constructor() { /* init all */ }
  
  // Core methods (7)
  getFile() { return this.contactData.getFile(); }
  // ... delegate all others
}
```

## Implementation Steps

1. Create genderOperations.ts
2. Create frontmatterOperations.ts
3. Create relationshipParsing.ts
4. Create relationshipResolution.ts
5. Create relationshipFormatting.ts
6. Create relationshipSync.ts
7. Create relationshipAdvanced.ts
8. Create validationOperations.ts (reuse name)
9. Create revisionOperations.ts (reuse name)
10. Update contactNote.ts to delegate
11. Update index.ts exports
12. Test and verify

## Expected Outcome

- contactNote.ts: ~200 LOC (core + delegation)
- 9 entity files: ~2,100 LOC total
- Same functionality, cleaner architecture
- Each entity file focused on specific concern
