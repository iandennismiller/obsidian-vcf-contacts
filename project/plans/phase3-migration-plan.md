# Phase 3: Direct Migration Implementation Plan

## Overview

Phase 3 focuses on **directly replacing** the operations-based architecture with the entity-based architecture. The approach is incremental deletion and replacement of old code with new entity-based implementations.

**Duration**: 3-4 weeks  
**Goal**: Remove operations code and use entity-based implementations directly  
**Strategy**: Incremental, tested migration with direct replacement (no backward compatibility)

## Migration Principles

1. **Incremental**: Migrate one method/feature at a time
2. **Tested**: Each migration step must pass all tests
3. **Direct Replacement**: Delete old code and replace with entity methods (no wrapper layer)
4. **Reversible**: Can revert any migration step if issues arise via git
5. **Performance Neutral**: Must maintain or improve performance

## Migration Strategy

### Approach: Inside-Out Direct Replacement

Start with the most isolated, leaf-level operations and work toward the core:

```
Phase 3 Migration Order:
1. Utility Functions & Value Objects (Week 1)
2. Field Operations → Field Entities (Week 2)
3. Relationship Operations → Relationship Entities (Week 3)
4. Document Operations → Document Entities + ContactNote Cleanup (Week 4)
```

### Migration Pattern

For each operation class:

1. **Identify entity equivalent** - Map operation to new entity
2. **Update call sites** - Replace operation calls with entity method calls
3. **Delete old code** - Remove operation class methods/files
4. **Update tests** - Ensure all tests pass with new entity methods
5. **Document changes** - Update docs with new patterns

## Week 1: Value Objects Direct Replacement

### Goals
- **Delete** old utility functions and operations
- **Replace** with entity method calls directly
- Migrate gender, UID, and revision operations to value objects

### Tasks

#### Task 1.1: Gender Operations Replacement (6 hours)
**Current**: Gender logic scattered in `relationshipOperations.ts` and `relationshipHelpers.ts`  
**Target**: **Delete** old code and use `Gender` value object directly

**Migration**:
```typescript
// BEFORE (in relationshipOperations.ts)
inferGenderFromRelationship(relationshipType: string): Gender {
  const genderedTerms = {
    'husband': 'M', 'wife': 'F', 'father': 'M', 'mother': 'F', ...
  };
  return genderedTerms[relationshipType] || 'U';
}

// AFTER (DELETED - callers use entity directly)
// Call sites now use:
const type = RelationshipType.fromString(relationshipType);
const gender = type.inferGender();
```

**Changes**:
- **Delete** gender utility functions from `relationshipOperations.ts`
- **Delete** gender helper methods from `relationshipHelpers.ts`
- Update all call sites to use `Gender` entity directly
- Replace all `'M' | 'F' | 'U' | 'NB'` string literals with `Gender` constants
- Update tests to use entity methods

**Acceptance Criteria**:
- All old gender utility functions deleted
- All call sites use Gender entity directly
- All tests pass
- No direct gender string comparisons remain

#### Task 1.2: UID Operations Replacement (8 hours)
**Current**: `uidOperations.ts` class  
**Target**: **Delete** and use `UID` value object directly

**Migration**:
```typescript
// BEFORE
class UIDOperations {
  static isValidUID(uid: string): boolean {
    return /^[a-zA-Z0-9\-_.]{3,}$/.test(uid);
  }
  
  async resolveContactByUID(uid: string): Promise<TFile | null> {
    // ... complex logic
  }
}

// AFTER (UIDOperations class DELETED)
// Call sites now use:
if (UID.isValid(uidString)) {
  const uid = UID.fromString(uidString);
  // Use uid entity directly
}
```

**Changes**:
- **Delete** `UIDOperations` class entirely
- Update all call sites to use `UID.isValid()` directly
- Update `resolveContactByUID()` callers to use ContactManager method instead
- Update frontmatter UID handling to use `UID` entity
- **Delete** UID utility functions
- Update tests to use entity methods

**Acceptance Criteria**:
- `UIDOperations` class file deleted
- All UID validation uses `UID.isValid()` directly
- All tests pass
- No wrapper methods remain

#### Task 1.3: Revision Operations Replacement (6 hours)
**Current**: `revisionOperations.ts` class  
**Target**: **Delete** and use `Revision` value object directly

**Migration**:
```typescript
// BEFORE
class RevisionOperations {
  async updateRevision(): Promise<void> {
    const now = new Date().toISOString();
    await this.contactData.updateFrontmatter('REV', now);
  }
}

// AFTER (RevisionOperations DELETED)
// Call sites now use:
const revision = Revision.now();
await frontmatter.set('REV', revision.toString());
```

**Changes**:
- **Delete** `RevisionOperations` class entirely
- Use `Revision.now()` for current timestamp at call sites
- Use `Revision.fromString()` for parsing at call sites
- Use `Revision.isNewerThan()` for comparisons
- Update tests to use entity methods directly

**Acceptance Criteria**:
- `RevisionOperations` class file deleted
- All revision operations use Revision entity directly
- All tests pass
- Revision comparison logic uses entity methods

## Week 2: Field Operations Direct Replacement

### Goals
- **Delete** ContactSectionOperations parsing with ContactField entities
- **Delete** field validation operations and use field entity validation
- **Delete** field rendering operations and use field entity toMarkdown()

### Tasks

#### Task 2.1: ContactField Parsing Replacement (10 hours)
**Current**: `contactSectionOperations.ts` parsing logic  
**Target**: **Delete** and use ContactField entities directly

**Migration**:
```typescript
// BEFORE
class ContactSectionOperations {
  parseContactFields(content: string): ParsedContactField[] {
    const lines = content.split('\n');
    const fields = [];
    for (const line of lines) {
      if (line.includes('@')) {
        fields.push({ type: 'EMAIL', value: extractEmail(line) });
      }
      // ... more parsing
    }
    return fields;
  }
}

// AFTER (ContactSectionOperations DELETED)
// Use ContactSection entity directly:
const section = ContactSection.fromMarkdown(content);
const fields = section.getFields(); // Returns ContactField[]
```

**Changes**:
- **Delete** `contactSectionOperations.ts` file entirely
- Update all call sites to use `ContactSection.fromMarkdown()`
- Use `ContactSection.getFields()` to access field entities
- Use `field.getType()`, `field.getValue()` for field access
- **Delete** old parsed format types
- Update tests to use entity methods

**Acceptance Criteria**:
- `contactSectionOperations.ts` file deleted
- Contact section parsing uses ContactSection entity
- All field types supported (EMAIL, TEL, ADR, URL)
- Old parsed format removed
- All tests pass

#### Task 2.2: Field Validation Replacement (6 hours)
**Current**: Validation in `contactSectionOperations.ts`  
**Target**: **Delete** and use `ContactField.validate()` directly

**Migration**:
```typescript
// BEFORE
class ContactSectionOperations {
  validateContactFields(fields: any[]): string[] {
    const errors = [];
    for (const field of fields) {
      if (field.type === 'EMAIL' && !isValidEmail(field.value)) {
        errors.push(`Invalid email: ${field.value}`);
      }
    }
    return errors;
  }
}

// AFTER (Method DELETED)
// Call sites now use:
const section = ContactSection.fromMarkdown(content);
const validationResult = section.validate();
const errors = validationResult.errors;
```

**Changes**:
- **Delete** `validateContactFields()` method
- Update call sites to use `ContactSection.validate()` directly
- Use field entity's `validate()` method
- **Delete** inline validation logic
- Update tests to use entity methods

**Acceptance Criteria**:
- All field validation methods deleted
- Validation delegated to ContactSection entity
- All tests pass

#### Task 2.3: Field Rendering Replacement (8 hours)
**Current**: `contactSectionOperations.ts` rendering methods  
**Target**: **Delete** and use `ContactSection.toMarkdown()` directly

**Migration**:
```typescript
// BEFORE
class ContactSectionOperations {
  async updateContactSectionInContent(contactSection: string): Promise<void> {
    const content = await this.contactData.getContent();
    // Complex regex replacement logic...
  }
}

// AFTER (Method DELETED, ContactSectionOperations DELETED)
// Call sites now use:
const section = ContactSection.fromMarkdown(contactSection);
const markdown = section.toMarkdown();
// Update content directly
```

**Changes**:
- **Delete** `updateContactSectionInContent()` method
- **Delete** entire `ContactSectionOperations` class
- Use `ContactSection.toMarkdown()` at call sites
- Update content replacement to use entity rendering
- Update tests

**Acceptance Criteria**:
- `ContactSectionOperations` file completely deleted
- ContactSection entity handles all parsing/rendering
- All tests pass

## Week 3: Relationship Operations Direct Replacement

### Goals
- **Delete** relationship parsing operations and use Relationship entities
- **Delete** relationship rendering operations and use entity methods
- **Delete** bidirectional sync operations and use entity methods

### Tasks

#### Task 3.1: Relationship Parsing Replacement (10 hours)
**Current**: `relationshipOperations.ts` parsing methods  
**Target**: **DELETE** and use `Relationship.fromMarkdown()` and `RelatedSection` directly

**Migration**:
```typescript
// BEFORE
class RelationshipOperations {
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    const content = await this.contactData.getContent();
    // Complex regex and parsing logic...
    return relationships;
  }
}

// AFTER (RelationshipOperations parsing methods DELETED)
// Call sites now use:
const section = RelatedSection.fromMarkdown(content);
const relationships = section.getRelationships(); // Returns Relationship[]
```

**Changes**:
- **Delete** `parseRelatedSection()` method
- **Delete** `parseFrontmatterRelationships()` method
- Update all call sites to use `RelatedSection.fromMarkdown()`
- Use `Relationship.fromFrontmatter()` directly where needed
- **Delete** old parsed format types
- Update tests to use entity methods

**Acceptance Criteria**:
- All relationship parsing methods deleted
- All parsing uses RelatedSection/Relationship entities
- Old parsed format types removed
- All tests pass

#### Task 3.2: RelatedSection Direct Replacement (8 hours)
**Current**: `relationshipOperations.ts` section update methods  
**Target**: **DELETE** and use `RelatedSection` entity directly

**Migration**:
```typescript
// BEFORE
class RelationshipOperations {
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    // Complex section manipulation...
  }
}

// AFTER (Method DELETED)
// Call sites now use:
const section = RelatedSection.create('Related', 2, relationships);
const markdown = section.toMarkdown();
// Update content directly
```

**Changes**:
- **Delete** `updateRelatedSectionInContent()` method
- Use `RelatedSection.toMarkdown()` at call sites
- **Delete** section manipulation logic
- Update tests

**Acceptance Criteria**:
- RelatedSection update methods deleted
- RelatedSection entity handles all rendering
- All tests pass
- RelatedSection entity handles section creation and rendering
- Section update uses entity methods
- All tests pass

#### Task 3.3: Gender-Aware Term Replacement (6 hours)
**Current**: `relationshipOperations.ts` gender methods  
**Target**: **DELETE** and use `RelationshipType.getGenderedTerm()` directly

**Migration**:
```typescript
// BEFORE
class RelationshipOperations {
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    const genderMap = {
      'spouse': { M: 'husband', F: 'wife', U: 'spouse' },
      // ... many more mappings
    };
    return genderMap[relationshipType]?.[contactGender] || relationshipType;
  }
}

// AFTER (Method DELETED)
// Call sites now use:
const type = RelationshipType.fromString(relationshipType);
const genderedTerm = type.getGenderedTerm(contactGender);
```

**Changes**:
- **Delete** `getGenderedRelationshipTerm()` method
- **Delete** inline gender mapping logic
- Update call sites to use `RelationshipType.getGenderedTerm()` directly
- Update tests to use entity methods

**Acceptance Criteria**:
- Gender-aware term methods deleted
- All call sites use RelationshipType directly
- All tests pass

#### Task 3.4: Bidirectional Sync Replacement (10 hours)
**Current**: `syncOperations.ts` and `advancedRelationshipOperations.ts`  
**Target**: **DELETE** and use `Relationship.createReciprocal()` directly

**Migration**:
```typescript
// BEFORE
class AdvancedRelationshipOperations {
  async createBidirectionalRelationship(
    sourceContact: ContactNote,
    targetContact: ContactNote,
    relationshipType: string
  ): Promise<void> {
    // Complex reciprocal relationship creation...
  }
}

// AFTER (Class and methods DELETED)
// Call sites now use:
const sourceRef = RelationshipReference.fromUID(sourceContact.getUID());
const reciprocal = relationship.createReciprocal(sourceRef);
await targetContact.addRelationship(reciprocal);
```

**Changes**:
- **Delete** `AdvancedRelationshipOperations` class entirely
- **Delete** bidirectional sync wrapper methods
- Use `Relationship.createReciprocal()` at call sites
- Use `Relationship.getReciprocalType()` directly
- Update tests

**Acceptance Criteria**:
- `AdvancedRelationshipOperations` file deleted
- Sync operations use Relationship entity directly
- All tests pass

## Week 4: Final Operations Deletion & ContactNote Cleanup

### Goals
- **DELETE** remaining operation classes entirely
- Simplify ContactNote to thin facade over entities
- **DELETE** ContactData intermediary layer
- Update all tests to use entities directly

### Tasks

#### Task 4.1: Delete Remaining Operation Classes (8 hours)
**Current**: Multiple operation class files  
**Target**: **DELETE** all operation class files

**Files to Delete**:
- `relationshipOperations.ts` - DELETED (use Relationship entities)
- `markdownOperations.ts` - DELETED (use Section entities)
- `syncOperations.ts` - DELETED (use entity methods directly)
- `validationOperations.ts` - DELETED (use entity validate() methods)
- `relationshipHelpers.ts` - DELETED (functionality in entities)

**Migration**:
```typescript
// BEFORE
class ContactNote {
  private relationshipOps: RelationshipOperations;
  private markdownOps: MarkdownOperations;
  private syncOps: SyncOperations;
  
  async parseRelatedSection() {
    return this.relationshipOps.parseRelatedSection();
  }
}

// AFTER (All operation classes DELETED)
class ContactNote {
  async getRelationships(): Promise<Relationship[]> {
    const content = await this.getContent();
    const section = RelatedSection.fromMarkdown(content);
    return section.getRelationships();
  }
}
```

**Changes**:
- **Delete** all operation class files
- Update ContactNote methods to use entities directly
- **Delete** operation class imports
- Update tests

**Acceptance Criteria**:
- All operation class files deleted
- ContactNote methods use entities directly
- All tests pass

#### Task 4.2: Delete ContactData Intermediary (10 hours)
**Current**: `contactData.ts` caches frontmatter and content  
**Target**: **DELETE** ContactData, use Frontmatter and TFile directly

**Migration**:
```typescript
// BEFORE
class ContactNote {
  private contactData: ContactData;
  
  async getFrontmatter() {
    return this.contactData.getFrontmatter();
  }
}

// AFTER (ContactData DELETED)
class ContactNote {
  private frontmatter: Frontmatter | null = null;
  
  async getFrontmatter(): Promise<Frontmatter> {
    if (!this.frontmatter) {
      const content = await this.app.vault.read(this.file);
      this.frontmatter = Frontmatter.fromYAML(content);
    }
    return this.frontmatter;
  }
}
```

**Changes**:
- **Delete** `contactData.ts` file entirely
- Move frontmatter caching directly into ContactNote
- Use `Frontmatter` entity for metadata
- Use TFile directly for file operations
- **Delete** ContactData type
- Update tests

**Acceptance Criteria**:
- `contactData.ts` file deleted
- ContactNote uses entities and TFile directly
- Caching logic preserved where needed
- All tests pass
#### Task 4.3: ContactNote Simplification (10 hours)
**Current**: ContactNote delegates to 9+ operation classes  
**Target**: ContactNote becomes thin facade over entities

**Migration**:
```typescript
// BEFORE
class ContactNote {
  private contactData: ContactData;
  private relationshipOps: RelationshipOperations;
  private markdownOps: MarkdownOperations;
  private syncOps: SyncOperations;
  private validationOps: ValidationOperations;
  // ... 5+ more operation classes

  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    return this.relationshipOps.parseRelatedSection();
  }
}

// AFTER (All operation classes DELETED)
class ContactNote {
  private app: App;
  private settings: ContactsPluginSettings;
  private file: TFile;
  
  // Cached entities
  private frontmatter: Frontmatter | null = null;
  private relatedSection: RelatedSection | null = null;
  private contactSection: ContactSection | null = null;

  async getRelationships(): Promise<Relationship[]> {
    if (!this.relatedSection) {
      const content = await this.getContent();
      this.relatedSection = RelatedSection.fromMarkdown(content);
    }
    return this.relatedSection.getRelationships();
  }
  
  async getFields(): Promise<ContactField[]> {
    if (!this.contactSection) {
      const content = await this.getContent();
      this.contactSection = ContactSection.fromMarkdown(content);
    }
    return this.contactSection.getFields();
  }
}
```

**Changes**:
- **Delete** all operation class properties
- Add entity caching properties
- Rewrite all methods to use entities directly
- Simplify ContactNote to ~200 LOC (from 606 LOC)
- Update tests to use new entity-based API

**Acceptance Criteria**:
- ContactNote.ts reduced to ~200 LOC
- All operation classes deleted
- All methods use entities directly
- All tests pass

## Testing Strategy

### Test Coverage Requirements

- **100% test pass rate** at all times
- **No reduction in coverage** during migration
- **Performance must not regress**

### Testing Approach

1. **Run tests after each task** - Ensure no regressions
2. **Update tests incrementally** - Change tests as code changes
3. **Delete old tests** - Remove tests for deleted operation classes
4. **Add entity integration tests** - Test entity interactions

### Test Organization

```
tests/
├── units/
│   ├── entities/          # Entity unit tests (already exist)
│   ├── operations/        # Operation tests (maintain during migration)
│   └── integration/       # New integration tests
└── performance/           # Performance benchmarks
```

## Risk Management

### Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking changes to public API | High | Medium | Maintain wrapper methods during migration |
| Performance regression | High | Low | Benchmark critical paths, optimize if needed |
| Test failures during migration | Medium | Medium | Incremental migration, test after each step |
| Complexity of bidirectional sync | High | Medium | Thorough testing, staged rollout |
| Incomplete migration | Medium | Low | Clear task checklist, weekly checkpoints |

### Mitigation Strategies

1. **Incremental Deletion**: Delete one operation class at a time
2. **Immediate Replacement**: Update call sites as we delete
3. **Comprehensive Testing**: Test each deletion step thoroughly
4. **Git Rollback**: Can revert any deletion if issues arise via git
5. **Performance Monitoring**: Benchmark before and after each change

## Success Criteria

### Phase 3 Complete When:

- ✅ All operation classes deleted
- ✅ All tests passing (560+ tests)
- ✅ No performance regressions
- ✅ ContactNote simplified to ~200 LOC
- ✅ Code coverage maintained at 100%
- ✅ 40% LOC reduction achieved

### Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Test Pass Rate | 100% | npm test |
| Code Coverage | 100% | npm run test:coverage |
| Performance | No regression | Benchmark suite |
| LOC Reduction | 40% | Line count: 5,386 → 3,200 |
| Files Deleted | 10+ | Operation class files removed |
| ContactNote Size | ~200 LOC | Down from 606 LOC |

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Value Objects | Delete Gender/UID/Revision operations |
| 2 | Field Operations | Delete ContactSectionOperations |
| 3 | Relationship Operations | Delete Relationship/Sync operations |
| 4 | Final Cleanup | Delete ContactData, simplify ContactNote |

**Total Duration**: 3-4 weeks  
**Total Tasks**: 12 deletion/replacement tasks  
**Total Tests**: 560+ (all passing)  
**No Phase 4 needed** - Migration complete after Phase 3

## Conclusion

Phase 3 represents the final migration from operations to entities through direct deletion and replacement. By removing old code immediately and updating call sites to use entities, we achieve a clean, entity-based architecture.

The key to success is:
1. **Delete, don't wrap** - Remove old code immediately
2. **Update call sites** - Replace with entity method calls  
3. **Continuous testing** - Test after every deletion
4. **Git for safety** - Use git to rollback if needed
5. **Document progress** - Track what's deleted

After Phase 3, the codebase will be fully migrated to the entity-based architecture with all operation classes deleted and ContactNote simplified to a thin facade.
