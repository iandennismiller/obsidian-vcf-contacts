# ContactNote Architecture Diagrams

## Current Architecture: Functional/Operations-Based

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        ContactNote                          │
│                     (Facade/Orchestrator)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Public API (53 methods)                             │   │
│  │  - getUID(), getFrontmatter(), parseRelatedSection() │   │
│  │  - updateFrontmatter(), syncRelationships()          │   │
│  │  - Delegates everything to operation classes         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │                       │
         ┌────────▼────────┐   ┌─────────▼──────────┐
         │  ContactData    │   │   Operations       │
         │   (440 LOC)     │   │   (10 classes)     │
         │                 │   │                    │
         │ - _frontmatter  │   │ Functional groups: │
         │ - _content      │   │ - Relationships    │
         │ - _gender       │   │ - Markdown         │
         │ - _uid          │   │ - Sync             │
         │ - _displayName  │   │ - Validation       │
         │                 │   │ - Revision         │
         │ All data        │   │ - UID              │
         │ centralized     │   │ - Advanced Rel     │
         │ here            │   │ - Contact Section  │
         └─────────────────┘   └────────────────────┘
```

### Operation Classes Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│                      ContactNote                             │
└───┬──────────────────────────────────────────────────────┬───┘
    │                                                      │
    │  Creates and holds references to:                   │
    │                                                      │
    ├─► ContactData ────────────────────────────────┐     │
    │                                                │     │
    ├─► RelationshipOperations ◄────────────────────┤     │
    │   (526 LOC)                                    │     │
    │   - parseRelatedSection()                      │     │
    │   - updateRelatedSectionInContent()            │     │
    │   - getGenderedRelationshipTerm()              │     │
    │                                                │     │
    ├─► MarkdownOperations ◄───────────────────────┤     │
    │   (211 LOC)                                    │     │
    │   - mdRender()                                 │     │
    │   - groupVCardFields()                         │     │
    │                                                │     │
    ├─► SyncOperations ◄───────────────────────────┤     │
    │   (396 LOC)                    │               │     │
    │   - syncRelatedListToFrontmatter()            │     │
    │   - syncFrontmatterToRelatedList()            │     │
    │   - performFullSync()                         │     │
    │   Depends on: RelationshipOperations ─────────┘     │
    │                                                      │
    ├─► ValidationOperations ◄───────────────────────────┤
    │   (238 LOC)                                          │
    │   - validateRequiredFields()                        │
    │   - validateEmail(), validatePhone()                │
    │                                                      │
    ├─► RevisionOperations ◄────────────────────────────┤
    │   (76 LOC)                                          │
    │   - updateRevisionTimestamp()                       │
    │                                                      │
    ├─► UIDOperations ◄─────────────────────────────────┤
    │   (263 LOC)                                          │
    │   - resolveContactByUID()                           │
    │   - detectUIDConflicts()                            │
    │                                                      │
    ├─► AdvancedRelationshipOperations ◄────────────────┤
    │   (402 LOC)                    │                    │
    │   - createBidirectionalRelationship()              │
    │   - removeBidirectionalRelationship()              │
    │   Depends on: RelationshipOperations ──────────────┘
    │                                                      │
    ├─► RelationshipHelpers ◄───────────────────────────┤
    │   (136 LOC)                                          │
    │   - getReciprocalRelationshipType()                 │
    │                                                      │
    └─► ContactSectionOperations ◄──────────────────────┘
        (810 LOC)
        - parseContactSection()
        - generateContactSection()
        - syncFrontmatterToContactSection()
```

### Data Flow: Reading a Relationship

```
User Code
   │
   └─► ContactNote.parseRelatedSection()
          │
          └─► RelationshipOperations.parseRelatedSection()
                 │
                 ├─► ContactData.getContent()
                 │      │
                 │      ├─► Check _content cache
                 │      ├─► If null, read from file
                 │      └─► Return content
                 │
                 ├─► BaseMarkdownSectionOperations.extractSection()
                 │      │
                 │      └─► Parse markdown with marked library
                 │
                 └─► Parse list items
                        │
                        └─► Return ParsedRelationship[]

Total files touched: 4
- ContactNote.ts
- RelationshipOperations.ts  
- ContactData.ts
- BaseMarkdownSectionOperations.ts
```

### Data Flow: Creating Bidirectional Relationship

```
User Code
   │
   └─► ContactNote.createBidirectionalRelationship(targetUID, type)
          │
          └─► AdvancedRelationshipOps.createBidirectionalRelationship()
                 │
                 ├─► UIDOperations.resolveContactByUID(targetUID)
                 │      │
                 │      └─► Scan vault for contact with UID
                 │
                 ├─► Get current relationships
                 │      │
                 │      └─► RelationshipOperations.parseRelatedSection()
                 │             │
                 │             └─► ContactData.getContent()
                 │
                 ├─► Add new relationship
                 │      │
                 │      └─► RelationshipOperations.updateRelatedSectionInContent()
                 │             │
                 │             └─► ContactData.setContent()
                 │
                 ├─► RelationshipHelpers.getReciprocalRelationshipType()
                 │      │
                 │      └─► Look up reciprocal type
                 │
                 ├─► Add reciprocal to target contact
                 │      │
                 │      └─► Create new ContactNote for target
                 │             │
                 │             └─► Repeat process for target
                 │
                 └─► SyncOperations.syncRelatedListToFrontmatter()
                        │
                        └─► Update frontmatter RELATED fields

Total files touched: 7
- ContactNote.ts
- AdvancedRelationshipOperations.ts
- UIDOperations.ts
- RelationshipOperations.ts
- RelationshipHelpers.ts
- SyncOperations.ts
- ContactData.ts
```

### Problem Visualization

```
To understand a "Relationship" entity:

┌─────────────────────────────────────────────────────────┐
│ Must read and understand:                               │
│                                                          │
│ 1. RelationshipOperations.ts (526 LOC)                  │
│    - How relationships are parsed                       │
│    - How they're rendered to markdown                   │
│    - Gender-aware term handling                         │
│                                                          │
│ 2. AdvancedRelationshipOperations.ts (402 LOC)          │
│    - Bidirectional relationship creation                │
│    - Relationship removal                               │
│                                                          │
│ 3. SyncOperations.ts (396 LOC)                          │
│    - Frontmatter synchronization                        │
│    - Markdown synchronization                           │
│                                                          │
│ 4. RelationshipHelpers.ts (136 LOC)                     │
│    - Reciprocal type lookup                             │
│    - Type conversion utilities                          │
│                                                          │
│ 5. ContactData.ts (partial)                             │
│    - Data storage and caching                           │
│                                                          │
│ Total: ~1,600 LOC across 5 files                        │
└─────────────────────────────────────────────────────────┘

The knowledge about "what a relationship is" is scattered!
```

---

## Proposed Architecture: Model-Based

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        ContactNote                          │
│                    (Lightweight Facade)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Minimal Public API                                  │   │
│  │  - Delegates to Contact model                        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Contact Model     │
                │  (Core Entity)      │
                └──────────┬──────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼─────┐
    │ Contact   │   │ Contact     │  │ Contact   │
    │ Fields    │   │Relationships│  │ Document  │
    │ Collection│   │ Collection  │  │           │
    └─────┬─────┘   └──────┬──────┘  └─────┬─────┘
          │                │                │
    ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼─────┐
    │Email      │   │Relationship │  │Frontmatter│
    │Telephone  │   │Model        │  │Section    │
    │Address    │   │             │  │Models     │
    │Url        │   │             │  │           │
    └───────────┘   └─────────────┘  └───────────┘
```

### Domain Models Organization

```
┌─────────────────────────────────────────────────────────────┐
│                     Domain Models Layer                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Contact.ts (Main Entity)                                   │
│  ├── ContactIdentity (UID, names)                           │
│  ├── ContactProfile (gender, classification)                │
│  ├── ContactRevision (timestamps)                           │
│  └── ContactFieldCollection                                 │
│                                                             │
│  ContactField.ts (Field Hierarchy)                          │
│  ├── EmailField                                             │
│  ├── TelephoneField                                         │
│  ├── AddressField                                           │
│  └── UrlField                                               │
│                                                             │
│  Relationship.ts (Relationship Entity)                      │
│  ├── RelationshipType (type, gender-aware terms)            │
│  ├── RelationshipReference (UID or name-based)              │
│  └── Methods: resolve, getReciprocal, validate, etc.        │
│                                                             │
│  MarkdownDocument.ts (Document Structure)                   │
│  ├── Frontmatter (YAML metadata)                            │
│  ├── RelatedSection (relationships list)                    │
│  ├── ContactSection (contact fields)                        │
│  └── NotesSection (free-form notes)                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FileStorage.ts (Read/write files)                          │
│  SyncCoordinator.ts (Orchestrate syncs)                     │
│  ValidationService.ts (Cross-entity validation)             │
│  ContactManager.ts (Contact collection management)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Relationship Model Detail

```
┌─────────────────────────────────────────────────────────────┐
│                    Relationship.ts                          │
│                    (~300 LOC total)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  class Relationship {                                       │
│    - type: RelationshipType                                 │
│    - targetRef: RelationshipReference                       │
│    - targetContact?: Contact                                │
│                                                             │
│    // Factory methods                                       │
│    + static fromMarkdown(line: string): Relationship        │
│    + static fromFrontmatter(key, value): Relationship       │
│                                                             │
│    // Resolution                                            │
│    + async resolve(contactMgr): Promise<Contact | null>     │
│    + isResolved(): boolean                                  │
│                                                             │
│    // Display                                               │
│    + getDisplayTerm(sourceGender): string                   │
│    + inferTargetGender(): Gender | null                     │
│                                                             │
│    // Reciprocal                                            │
│    + getReciprocal(sourceGender): Relationship              │
│                                                             │
│    // Serialization                                         │
│    + toMarkdown(): string                                   │
│    + toFrontmatter(): [string, string]                      │
│                                                             │
│    // Validation                                            │
│    + validate(): ValidationResult                           │
│  }                                                          │
│                                                             │
│  class RelationshipType {                                   │
│    - type: string                                           │
│    + getGenderedTerm(gender): string                        │
│    + getReciprocal(targetGender): string                    │
│    + isValid(): boolean                                     │
│  }                                                          │
│                                                             │
│  class RelationshipReference {                              │
│    - refType: 'uid' | 'name'                                │
│    - value: string                                          │
│    + isUID(): boolean                                       │
│    + isName(): boolean                                      │
│    + getValue(): string                                     │
│    + toFrontmatterValue(): string                           │
│    + isValid(): boolean                                     │
│  }                                                          │
│                                                             │
│  // Constants                                               │
│  const GENDERED_TERMS = { ... }                             │
│  const RECIPROCAL_TYPES = { ... }                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Everything about relationships in ONE file!
All relationship behavior co-located with relationship data.
```

### Data Flow: Reading a Relationship (Model-Based)

```
User Code
   │
   └─► contact.getRelationships()
          │
          └─► Contact.relationships (property)
                 │
                 └─► Return Relationship[]

OR for fresh read:

User Code
   │
   └─► contact.reload()
          │
          ├─► MarkdownDocument.fromFile(file)
          │      │
          │      ├─► Read file content
          │      ├─► Parse frontmatter
          │      └─► Parse sections
          │
          └─► RelatedSection.parseRelationships()
                 │
                 └─► relationships.map(line => Relationship.fromMarkdown(line))

Total files touched: 3
- Contact.ts
- MarkdownDocument.ts
- Relationship.ts

Much simpler!
```

### Data Flow: Creating Bidirectional Relationship (Model-Based)

```
User Code
   │
   └─► contact.addBidirectionalRelationship(targetUID, type)
          │
          └─► Contact.addBidirectionalRelationship()
                 │
                 ├─► Create relationship
                 │      │
                 │      └─► relationship = new Relationship(type, targetUID)
                 │
                 ├─► Validate
                 │      │
                 │      └─► relationship.validate()
                 │
                 ├─► Resolve target
                 │      │
                 │      └─► targetContact = await relationship.resolve(contactManager)
                 │
                 ├─► Add to self
                 │      │
                 │      └─► this.relationships.add(relationship)
                 │
                 ├─► Create reciprocal
                 │      │
                 │      └─► reciprocal = relationship.getReciprocal(this.gender)
                 │
                 ├─► Add to target
                 │      │
                 │      └─► targetContact.relationships.add(reciprocal)
                 │
                 ├─► Save both
                 │      │
                 │      ├─► await this.save()
                 │      └─► await targetContact.save()
                 │
                 └─► Done

Total files touched: 3
- Contact.ts (main logic)
- Relationship.ts (entity)
- ContactManager.ts (resolution)

Much cleaner!
```

### Comparison: File Organization

```
Current (Functional):                Proposed (Model-Based):

src/models/contactNote/              src/models/contactNote/
├── contactNote.ts (606)             ├── ContactNote.ts (200)  ← Simplified facade
├── contactData.ts (440)             ├── Contact.ts (400)      ← Core entity
│                                    │
├── relationshipOperations.ts (526)  ├── Relationship.ts (300) ← Entity + logic
├── advancedRelationshipOps.ts (402) │
├── syncOperations.ts (396)          │
├── relationshipHelpers.ts (136)     │
│   ↑ Scattered relationship logic   │   ↑ Unified relationship entity
│                                    │
├── contactSectionOperations.ts(810) ├── ContactField.ts (500) ← Field hierarchy
│   ↑ Mixed field logic              │   ├── EmailField
│                                    │   ├── TelephoneField
│                                    │   ├── AddressField
│                                    │   └── UrlField
│                                    │   ↑ Each field type is concrete
│                                    │
├── markdownOperations.ts (211)      ├── MarkdownDocument.ts (400)
├── baseMarkdownSectionOps.ts (317)  │   ├── Frontmatter
│   ↑ Mixed markdown operations      │   ├── RelatedSection
│                                    │   ├── ContactSection
│                                    │   └── NotesSection
│                                    │   ↑ Document structure as entities
│                                    │
├── validationOperations.ts (238)    ├── Infrastructure/
├── revisionOperations.ts (76)       │   ├── FileStorage.ts (100)
├── uidOperations.ts (263)           │   ├── SyncCoordinator.ts (200)
│   ↑ Scattered infrastructure       │   ├── ValidationService.ts (150)
│                                    │   └── Repository.ts (200)
│                                    │   ↑ Clean infrastructure layer
│                                    │
├── types.ts (169)                   ├── types.ts (169)
├── markdownConstants.ts (149)       ├── constants.ts (149)
├── utilityFunctions.ts (136)        ├── utils.ts (136)
├── fieldPatternDetection.ts (389)   │   ↑ Shared utilities
│                                    │
└── index.ts (122)                   └── index.ts (122)

Total: ~5,386 LOC                    Total: ~3,200 LOC
17 files                             12 files
Functional grouping                  Entity-based grouping
```

### Benefits Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                  Current Problems                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  To understand "Relationship":                              │
│  ┌──────────────────────────────────────┐                  │
│  │ Read 5 files                         │                  │
│  │ ~1,600 LOC                            │                  │
│  │ Follow cross-file dependencies       │                  │
│  │ Mixed abstraction levels             │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  To test relationship parsing:                              │
│  ┌──────────────────────────────────────┐                  │
│  │ Mock App, Settings, File             │                  │
│  │ Create ContactNote                   │                  │
│  │ Mock file content                    │                  │
│  │ Call parseRelatedSection()           │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  To add new field type:                                     │
│  ┌──────────────────────────────────────┐                  │
│  │ Modify ContactSectionOperations      │                  │
│  │ Add parsing logic                    │                  │
│  │ Add rendering logic                  │                  │
│  │ Add validation logic                 │                  │
│  │ Update 810-line file                 │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                          ↓ REFACTOR ↓

┌─────────────────────────────────────────────────────────────┐
│                  Proposed Solutions                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  To understand "Relationship":                              │
│  ┌──────────────────────────────────────┐                  │
│  │ Read 1 file: Relationship.ts         │                  │
│  │ ~300 LOC                              │                  │
│  │ All logic in one place               │                  │
│  │ Clear entity structure               │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  To test relationship parsing:                              │
│  ┌──────────────────────────────────────┐                  │
│  │ const rel = Relationship             │                  │
│  │   .fromMarkdown('spouse [[Jane]]');  │                  │
│  │ expect(rel.getType())                │                  │
│  │   .toBe('spouse');                   │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  To add new field type:                                     │
│  ┌──────────────────────────────────────┐                  │
│  │ Create new file: SocialField.ts      │                  │
│  │ Extend ContactField                  │                  │
│  │ Implement: validate(), toMarkdown()  │                  │
│  │ Register in factory                  │                  │
│  │ ~50 LOC, no changes to existing code │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Summary

### Current Architecture
- **Organization**: Functional/Operations-based
- **Pros**: Clear separation of operations, centralized caching
- **Cons**: Entity logic scattered, hard to reason about entities, difficult testing

### Proposed Architecture
- **Organization**: Domain model-based
- **Pros**: One file per entity, easy testing, clear entity lifecycle, extensible
- **Migration**: Phased approach, backward compatible until final phase

### Key Insight
```
Current:  Code organized by "what it DOES" (operations)
Proposed: Code organized by "what it IS" (entities)

This makes the code:
- Easier to understand (one entity = one file)
- Easier to test (test entities directly)
- Easier to extend (add to entities, not operations)
- More maintainable (change entity in one place)
```
