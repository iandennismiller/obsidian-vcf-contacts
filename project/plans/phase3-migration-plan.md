# Phase 3: Gradual Migration Implementation Plan

## Overview

Phase 3 focuses on **gradually migrating** from the operations-based architecture to the entity-based architecture. The approach is incremental, method-by-method replacement while maintaining backward compatibility throughout.

**Duration**: 4-6 weeks  
**Goal**: Replace operations code with entity-based implementations  
**Strategy**: Incremental, tested migration with no breaking changes

## Migration Principles

1. **Incremental**: Migrate one method/feature at a time
2. **Tested**: Each migration step must pass all tests
3. **Backward Compatible**: No breaking changes to public APIs
4. **Reversible**: Can revert any migration step if issues arise
5. **Performance Neutral**: Must maintain or improve performance

## Migration Strategy

### Approach: Inside-Out Migration

Start with the most isolated, leaf-level operations and work toward the core:

```
Phase 3 Migration Order:
1. Utility Functions (Week 1)
2. Field Operations (Week 2)
3. Relationship Operations (Week 3)
4. Section Operations (Week 4)
5. ContactNote Facade (Week 5-6)
```

### Migration Pattern

For each operation class:

1. **Identify entity equivalent** - Map operation to new entity
2. **Create wrapper methods** - Wrap entity methods in operation interface
3. **Update tests** - Ensure all tests pass
4. **Deprecate old code** - Mark for removal in Phase 4
5. **Document migration** - Update docs with new patterns

## Week 1: Utility Functions & Value Objects

### Goals
- Replace utility functions with entity methods
- Migrate gender operations to Gender entity
- Migrate UID operations to UID entity
- Migrate revision operations to Revision entity

### Tasks

#### Task 1.1: Gender Operations Migration (6 hours)
**Current**: Gender logic scattered in `relationshipOperations.ts` and `relationshipHelpers.ts`  
**Target**: Use `Gender` value object

**Migration**:
```typescript
// BEFORE (in relationshipOperations.ts)
inferGenderFromRelationship(relationshipType: string): Gender {
  const genderedTerms = {
    'husband': 'M', 'wife': 'F', 'father': 'M', 'mother': 'F', ...
  };
  return genderedTerms[relationshipType] || 'U';
}

// AFTER (using Gender entity)
inferGenderFromRelationship(relationshipType: string): Gender {
  const type = RelationshipType.fromString(relationshipType);
  return type.inferGender();
}
```

**Changes**:
- Update `relationshipOperations.ts` to use `Gender.fromLegacy()` and `Gender.fromString()`
- Update `relationshipHelpers.ts` to use `Gender` value object
- Replace all `'M' | 'F' | 'U' | 'NB'` string literals with `Gender` constants
- Update tests

**Acceptance Criteria**:
- All gender operations use Gender value object
- All tests pass
- No direct gender string comparisons remain

#### Task 1.2: UID Operations Migration (8 hours)
**Current**: `uidOperations.ts` class  
**Target**: Use `UID` value object

**Migration**:
```typescript
// BEFORE
class UIDOperations {
  static isValidUID(uid: string): boolean {
    return /^[a-zA-Z0-9\-_.]{3,}$/.test(uid);
  }
}

// AFTER
class UIDOperations {
  static isValidUID(uid: string): boolean {
    return UID.isValid(uid);
  }
}
```

**Changes**:
- Delegate `isValidUID()` to `UID.isValid()`
- Update `resolveContactByUID()` to use `UID` value object
- Update frontmatter UID handling to use `UID.fromString()`
- Update tests

**Acceptance Criteria**:
- UIDOperations becomes thin wrapper around UID entity
- All UID validation uses UID.isValid()
- All tests pass

#### Task 1.3: Revision Operations Migration (6 hours)
**Current**: `revisionOperations.ts` class  
**Target**: Use `Revision` value object

**Migration**:
```typescript
// BEFORE
async updateRevision(): Promise<void> {
  const now = new Date().toISOString();
  await this.contactData.updateFrontmatter('REV', now);
}

// AFTER
async updateRevision(): Promise<void> {
  const revision = Revision.now();
  await this.contactData.updateFrontmatter('REV', revision.toString());
}
```

**Changes**:
- Use `Revision.now()` for current timestamp
- Use `Revision.fromString()` for parsing
- Use `Revision.isNewerThan()` for comparisons
- Update tests

**Acceptance Criteria**:
- All revision operations use Revision value object
- All tests pass
- Revision comparison logic uses entity methods

## Week 2: Field Operations Migration

### Goals
- Replace ContactSection parsing with ContactField entities
- Migrate field validation to field entities
- Update field rendering to use field entities

### Tasks

#### Task 2.1: ContactField Parsing Migration (10 hours)
**Current**: `contactSectionOperations.ts` parsing logic  
**Target**: Use ContactField entities (`EmailField`, `TelephoneField`, `AddressField`, `UrlField`)

**Migration**:
```typescript
// BEFORE
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

// AFTER
parseContactFields(content: string): ContactField[] {
  const lines = content.split('\n');
  const fields: ContactField[] = [];
  for (const line of lines) {
    if (line.includes('@')) {
      const email = EmailField.fromMarkdown(line);
      if (email) fields.push(email);
    }
    // ... use other field factory methods
  }
  return fields;
}
```

**Changes**:
- Update `parseContactFields()` to return `ContactField[]` instead of `ParsedContactField[]`
- Use `EmailField.fromMarkdown()`, `TelephoneField.fromMarkdown()`, etc.
- Update field grouping logic to use `field.getType()`
- Maintain backward compatibility with old parsed format
- Update tests

**Acceptance Criteria**:
- Contact section parsing uses ContactField entities
- All field types supported (EMAIL, TEL, ADR, URL)
- Backward compatible with existing parsed format
- All tests pass

#### Task 2.2: Field Validation Migration (6 hours)
**Current**: Validation in `contactSectionOperations.ts`  
**Target**: Use `ContactField.validate()`

**Migration**:
```typescript
// BEFORE
validateContactFields(fields: any[]): string[] {
  const errors = [];
  for (const field of fields) {
    if (field.type === 'EMAIL' && !isValidEmail(field.value)) {
      errors.push(`Invalid email: ${field.value}`);
    }
  }
  return errors;
}

// AFTER
validateContactFields(fields: ContactField[]): string[] {
  const errors = [];
  for (const field of fields) {
    const result = field.validate();
    if (!result.isValid) {
      errors.push(...result.errors);
    }
  }
  return errors;
}
```

**Changes**:
- Delegate validation to `ContactField.validate()`
- Remove inline validation logic
- Update tests

**Acceptance Criteria**:
- All field validation delegated to entities
- Validation errors maintain same format
- All tests pass

#### Task 2.3: ContactSection Entity Integration (8 hours)
**Current**: `contactSectionOperations.ts` methods  
**Target**: Use `ContactSection` entity

**Migration**:
```typescript
// BEFORE
async updateContactSectionInContent(contactSection: string): Promise<void> {
  const content = await this.contactData.getContent();
  // Complex regex replacement logic...
}

// AFTER
async updateContactSectionInContent(contactSection: string): Promise<void> {
  const content = await this.contactData.getContent();
  const section = ContactSection.parse('Contact', 2, contactSection);
  const newContent = content.replace(/## Contact[\s\S]*?(?=\n##|$)/, section.toMarkdown());
  await this.contactData.updateContent(newContent);
}
```

**Changes**:
- Use `ContactSection.parse()` for parsing
- Use `ContactSection.create()` for creating sections
- Use `section.toMarkdown()` for rendering
- Maintain section update logic in operations wrapper
- Update tests

**Acceptance Criteria**:
- ContactSection entity handles parsing and rendering
- Section update logic uses entity methods
- All tests pass

## Week 3: Relationship Operations Migration

### Goals
- Replace relationship parsing with Relationship entities
- Migrate relationship rendering to entity methods
- Update bidirectional sync to use entities

### Tasks

#### Task 3.1: Relationship Parsing Migration (10 hours)
**Current**: `relationshipOperations.ts` parsing methods  
**Target**: Use `Relationship.fromMarkdown()` and `Relationship.fromFrontmatter()`

**Migration**:
```typescript
// BEFORE
async parseRelatedSection(): Promise<ParsedRelationship[]> {
  const content = await this.contactData.getContent();
  // Complex regex and parsing logic...
  return relationships;
}

// AFTER
async parseRelatedSection(): Promise<Relationship[]> {
  const content = await this.contactData.getContent();
  const section = RelatedSection.parse('Related', 2, extractRelatedContent(content));
  return section.getRelationships();
}
```

**Changes**:
- Use `Relationship.fromMarkdown()` for parsing markdown relationships
- Use `Relationship.fromFrontmatter()` for parsing frontmatter relationships
- Update return types to use `Relationship` entity
- Maintain backward compatibility with old parsed format
- Update tests

**Acceptance Criteria**:
- All relationship parsing uses Relationship entity
- Both markdown and frontmatter formats supported
- Backward compatible with existing code
- All tests pass

#### Task 3.2: RelatedSection Entity Integration (8 hours)
**Current**: `relationshipOperations.ts` section update methods  
**Target**: Use `RelatedSection` entity

**Migration**:
```typescript
// BEFORE
async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
  // Complex section manipulation...
}

// AFTER
async updateRelatedSectionInContent(relationships: Relationship[]): Promise<void> {
  const section = RelatedSection.create('Related', 2, relationships);
  const content = await this.contactData.getContent();
  const newContent = replaceSectionInContent(content, 'Related', section.toMarkdown());
  await this.contactData.updateContent(newContent);
}
```

**Changes**:
- Use `RelatedSection.create()` for creating sections
- Use `section.toMarkdown()` for rendering
- Update section replacement logic
- Update tests

**Acceptance Criteria**:
- RelatedSection entity handles section creation and rendering
- Section update uses entity methods
- All tests pass

#### Task 3.3: Gender-Aware Term Migration (6 hours)
**Current**: `relationshipOperations.ts` gender methods  
**Target**: Use `RelationshipType.getGenderedTerm()`

**Migration**:
```typescript
// BEFORE
getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
  const genderMap = {
    'spouse': { M: 'husband', F: 'wife', U: 'spouse' },
    // ... many more mappings
  };
  return genderMap[relationshipType]?.[contactGender] || relationshipType;
}

// AFTER
getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
  const type = RelationshipType.fromString(relationshipType);
  return type.getGenderedTerm(contactGender);
}
```

**Changes**:
- Delegate to `RelationshipType.getGenderedTerm()`
- Remove inline gender mapping logic
- Update tests

**Acceptance Criteria**:
- All gender-aware term conversion uses RelationshipType
- All relationship types supported
- All tests pass

#### Task 3.4: Bidirectional Sync Migration (10 hours)
**Current**: `syncOperations.ts` and `advancedRelationshipOperations.ts`  
**Target**: Use `Relationship.createReciprocal()`

**Migration**:
```typescript
// BEFORE
async createBidirectionalRelationship(
  sourceContact: ContactNote,
  targetContact: ContactNote,
  relationshipType: string
): Promise<void> {
  // Complex reciprocal relationship creation...
}

// AFTER
async createBidirectionalRelationship(
  sourceContact: ContactNote,
  targetContact: ContactNote,
  relationship: Relationship
): Promise<void> {
  const sourceRef = RelationshipReference.fromUID(sourceContact.getUID());
  const reciprocal = relationship.createReciprocal(sourceRef);
  // Add reciprocal to target contact
}
```

**Changes**:
- Use `Relationship.createReciprocal()` for creating reverse relationships
- Use `Relationship.getReciprocalType()` for type mapping
- Update sync operations to use entity methods
- Update tests

**Acceptance Criteria**:
- Bidirectional sync uses Relationship entity
- Reciprocal relationships correctly created
- All tests pass

## Week 4: Document Entity Integration

### Goals
- Replace frontmatter operations with Frontmatter entity
- Integrate Frontmatter with ContactData
- Update section operations to use entity methods

### Tasks

#### Task 4.1: Frontmatter Entity Integration (10 hours)
**Current**: `contactData.ts` frontmatter methods  
**Target**: Use `Frontmatter` entity

**Migration**:
```typescript
// BEFORE (in ContactData)
async getFrontmatter(): Promise<Record<string, any> | null> {
  if (this._frontmatter !== null) return this._frontmatter;
  const cache = this.app.metadataCache.getFileCache(this.file);
  if (cache?.frontmatter) {
    this._frontmatter = cache.frontmatter;
    return this._frontmatter;
  }
  // ... file reading fallback
}

// AFTER
async getFrontmatter(): Promise<Frontmatter> {
  if (this._frontmatter !== null) return this._frontmatter;
  const cache = this.app.metadataCache.getFileCache(this.file);
  if (cache?.frontmatter) {
    this._frontmatter = Frontmatter.fromObject(cache.frontmatter);
    return this._frontmatter;
  }
  // ... file reading fallback using Frontmatter.fromYAML()
}
```

**Changes**:
- Change `_frontmatter` type from `Record<string, any>` to `Frontmatter`
- Use `Frontmatter.fromObject()` for cache data
- Use `Frontmatter.fromYAML()` for file data
- Update all frontmatter access to use entity methods (`get()`, `getFlat()`)
- Update frontmatter updates to use immutable operations
- Update tests

**Acceptance Criteria**:
- ContactData stores Frontmatter entity instead of raw object
- All frontmatter access uses entity methods
- Immutability maintained
- All tests pass

#### Task 4.2: Frontmatter Convenience Methods (6 hours)
**Current**: Direct frontmatter property access  
**Target**: Use `Frontmatter.getUID()`, `getName()`, etc.

**Migration**:
```typescript
// BEFORE
async getUID(): Promise<string | null> {
  const fm = await this.getFrontmatter();
  return fm?.UID || null;
}

// AFTER
async getUID(): Promise<UID | null> {
  const fm = await this.getFrontmatter();
  const uid = fm.getUID();
  return uid ? UID.fromString(uid) : null;
}
```

**Changes**:
- Use `frontmatter.getUID()`, `getName()`, `getGender()`, `getRevision()`
- Update return types to use value objects where appropriate
- Update tests

**Acceptance Criteria**:
- Convenience methods use Frontmatter entity methods
- Type-safe access with value objects
- All tests pass

#### Task 4.3: Section Rendering Consolidation (8 hours)
**Current**: Section rendering scattered across operations  
**Target**: Centralized using MarkdownSection entities

**Migration**:
- Consolidate Related section rendering in RelatedSection
- Consolidate Contact section rendering in ContactSection
- Remove redundant rendering logic from operations
- Update tests

**Acceptance Criteria**:
- All section rendering uses entity `toMarkdown()` methods
- No duplicate rendering logic
- All tests pass

## Week 5-6: ContactNote Facade Refactoring

### Goals
- Simplify ContactNote by delegating to entities
- Remove redundant operation classes
- Update public API to be entity-based

### Tasks

#### Task 5.1: ContactNote API Simplification (12 hours)
**Current**: ContactNote delegates to 9 operation classes  
**Target**: ContactNote delegates to entities

**Migration**:
```typescript
// BEFORE
class ContactNote {
  private relationshipOps: RelationshipOperations;
  private markdownOps: MarkdownOperations;
  // ... 7 more operation classes

  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    return this.relationshipOps.parseRelatedSection();
  }
}

// AFTER
class ContactNote {
  private frontmatter: Frontmatter | null = null;
  private relatedSection: RelatedSection | null = null;
  private contactSection: ContactSection | null = null;

  async getRelationships(): Promise<Relationship[]> {
    if (!this.relatedSection) {
      const content = await this.getContent();
      this.relatedSection = this.parseRelatedSection(content);
    }
    return this.relatedSection.getRelationships();
  }
}
```

**Changes**:
- Replace operation class instances with entity caching
- Update methods to work with entities
- Maintain backward compatibility with wrapper methods
- Update tests

**Acceptance Criteria**:
- ContactNote simplified to work with entities
- Operation classes become optional/deprecated
- All tests pass
- Public API maintains compatibility

#### Task 5.2: Deprecation Markers (4 hours)
**Current**: No deprecation warnings  
**Target**: Mark old operations for removal

**Changes**:
- Add `@deprecated` JSDoc tags to operation classes
- Add deprecation warnings in operation methods
- Document migration path in deprecation messages
- Update tests to suppress deprecation warnings

**Acceptance Criteria**:
- All operation classes marked deprecated
- Clear migration guidance in deprecation messages
- Tests pass with deprecation warnings suppressed

#### Task 5.3: Documentation Updates (8 hours)
**Current**: Documentation describes operations-based architecture  
**Target**: Documentation describes entity-based architecture

**Changes**:
- Update `/docs/development.md` with entity-based patterns
- Add migration guide for consumers
- Update code examples to use entities
- Update architecture diagrams

**Acceptance Criteria**:
- Documentation reflects new entity-based architecture
- Migration guide available
- Examples updated

## Testing Strategy

### Test Coverage Requirements

- **100% test pass rate** at all times
- **No reduction in coverage** during migration
- **Performance benchmarks** must not regress

### Testing Approach

1. **Run tests after each task** - Ensure no regressions
2. **Add integration tests** - Test entity interactions
3. **Performance testing** - Benchmark critical paths
4. **Backward compatibility tests** - Ensure old code still works

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

1. **Incremental Migration**: Migrate one operation at a time
2. **Parallel Operation**: Keep old code working alongside new code
3. **Comprehensive Testing**: Test each migration step thoroughly
4. **Rollback Plan**: Can revert any migration step if issues arise
5. **Performance Monitoring**: Benchmark before and after each change

## Success Criteria

### Phase 3 Complete When:

- ✅ All operations delegated to entities
- ✅ All tests passing (560+ tests)
- ✅ No performance regressions
- ✅ Documentation updated
- ✅ Deprecation warnings in place
- ✅ Code coverage maintained at 100%

### Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Test Pass Rate | 100% | npm test |
| Code Coverage | 100% | npm run test:coverage |
| Performance | No regression | Benchmark suite |
| LOC Reduction | 30%+ | Line count comparison |
| Operation Classes Deprecated | 9/9 | Deprecation tags added |

## Next Steps After Phase 3

After Phase 3 completion, proceed to **Phase 4: Consolidation**:

- Remove deprecated operation classes
- Clean up wrapper methods
- Final documentation pass
- Performance optimization
- Code cleanup

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Utility & Value Objects | Gender, UID, Revision migrations |
| 2 | Field Operations | ContactField entity integration |
| 3 | Relationship Operations | Relationship entity integration |
| 4 | Document Entities | Frontmatter, Section integration |
| 5-6 | ContactNote Facade | API simplification, deprecations |

**Total Duration**: 5-6 weeks  
**Total Tasks**: 15+ migration tasks  
**Total Tests**: 560+ (all passing)

## Conclusion

Phase 3 represents the critical migration from operations to entities. By following an incremental, tested approach, we can safely migrate the codebase while maintaining backward compatibility and test coverage.

The key to success is:
1. **Small steps** - Migrate one method at a time
2. **Continuous testing** - Test after every change
3. **Maintain compatibility** - Keep old code working
4. **Monitor performance** - Ensure no regressions
5. **Document progress** - Track what's migrated

After Phase 3, the codebase will be ready for Phase 4 consolidation and cleanup.
