# ContactNote Model Refactoring Plan

## Executive Summary

This document outlines a plan to refactor the ContactNote model from its current **functional/operational organization** to a more **concrete, model-based architecture**. The goal is to organize code around "things" (concrete models/entities) rather than "operations" (functional groups).

## Current State Analysis

### Overview

The ContactNote module currently follows a **functional organization pattern** where code is grouped by the type of operations performed rather than by the domain entities being modeled.

### Current Architecture (Functional/Operations-Based)

```
ContactNote (main orchestrator)
├── ContactData (centralized data store)
└── Operation Classes (functional groups):
    ├── RelationshipOperations
    ├── MarkdownOperations
    ├── SyncOperations
    ├── ValidationOperations
    ├── RevisionOperations
    ├── UIDOperations
    ├── AdvancedRelationshipOperations
    ├── RelationshipHelpers
    └── ContactSectionOperations
```

### File Analysis

| File | LOC | Classes | Purpose | Type |
|------|-----|---------|---------|------|
| `contactNote.ts` | 606 | 1 | Main orchestrator | Facade |
| `contactData.ts` | 440 | 1 | Centralized data store | Data Model |
| `contactSectionOperations.ts` | 810 | 1 | Contact section CRUD | Operations |
| `relationshipOperations.ts` | 526 | 1 | Relationship CRUD | Operations |
| `advancedRelationshipOperations.ts` | 402 | 1 | Advanced relationship ops | Operations |
| `syncOperations.ts` | 396 | 1 | Bidirectional sync | Operations |
| `baseMarkdownSectionOperations.ts` | 317 | 0 (abstract) | Markdown section base | Base Class |
| `uidOperations.ts` | 263 | 1 | UID resolution | Operations |
| `validationOperations.ts` | 238 | 1 | Data validation | Operations |
| `markdownOperations.ts` | 211 | 1 | Markdown rendering | Operations |
| `types.ts` | 169 | 0 | Type definitions | Types |
| `markdownConstants.ts` | 149 | 0 | Constants | Constants |
| `relationshipHelpers.ts` | 136 | 1 | Helper utilities | Helpers |
| `utilityFunctions.ts` | 136 | 0 | Utility functions | Utilities |
| `revisionOperations.ts` | 76 | 1 | Revision tracking | Operations |
| `fieldPatternDetection.ts` | 389 | 0 | Pattern matching | Utilities |
| `index.ts` | 122 | 0 | Module exports | Exports |

**Total**: ~5,386 lines of code

### Current Organization Characteristics

#### Strengths
1. **Clear separation of concerns** - Each operation class handles specific functionality
2. **Data locality** - ContactData centralizes data access and caching
3. **Dependency injection** - Operations receive ContactData, promoting testability
4. **Consistent patterns** - All operations follow similar structure
5. **Performance optimization** - Centralized caching reduces redundant file reads

#### Weaknesses (From Model Perspective)
1. **Functional grouping** - Code organized by "what it does" not "what it models"
2. **No domain entities** - Missing concrete models like Relationship, ContactField, Section, etc.
3. **Scattered entity logic** - Logic for a "Relationship" spans multiple operation classes
4. **Mixed abstractions** - Operations mix low-level (parsing) and high-level (business logic)
5. **No entity lifecycle** - Entities don't have clear creation, validation, persistence lifecycle
6. **Hard to reason about entities** - To understand a "Relationship" you must read multiple files

### Key Domain Entities Identified

Through analysis of the operations code, the following concrete domain entities emerge:

1. **Contact** - A person/organization with properties (name, email, phone, etc.)
2. **Relationship** - A connection between two contacts (spouse, parent, friend, etc.)
3. **ContactField** - A contact data field (EMAIL, TEL, ADR, URL)
4. **MarkdownSection** - A section in the markdown document (Related, Contact, Notes)
5. **Frontmatter** - The YAML metadata at the top of the file
6. **UID** - Unique identifier for a contact
7. **Gender** - Gender classification affecting relationship terms
8. **Revision** - Timestamp tracking for updates

## Problem Statement

The current functional organization makes it difficult to:

1. **Understand entity behavior** - Relationship logic is spread across:
   - `RelationshipOperations` (parsing, rendering)
   - `AdvancedRelationshipOperations` (bidirectional sync)
   - `SyncOperations` (frontmatter sync)
   - `RelationshipHelpers` (reciprocal types)

2. **Reason about entity state** - No clear entity lifecycle or state management

3. **Maintain entity invariants** - Validation scattered across operations

4. **Test entities** - Must test through operations rather than testing entities directly

5. **Extend entity behavior** - Adding a feature requires touching multiple operation classes

## Proposed Target State: Model-Based Organization

### Vision

Organize code around **concrete domain models** that represent the "things" in the system, with each model encapsulating:
- Its data structure
- Its behavior (methods that manipulate that data)
- Its validation rules
- Its lifecycle (creation, persistence, etc.)

### Proposed Architecture

```
ContactNote (main orchestrator)
└── Domain Models:
    ├── Contact (the contact itself)
    │   ├── ContactIdentity (UID, names)
    │   ├── ContactProfile (gender, classification)
    │   ├── ContactRevision (timestamps)
    │   └── ContactFields (collection of fields)
    │
    ├── ContactField (individual data field)
    │   ├── EmailField
    │   ├── TelephoneField
    │   ├── AddressField
    │   └── UrlField
    │
    ├── Relationship (connection between contacts)
    │   ├── RelationshipType (spouse, parent, etc.)
    │   ├── RelationshipReference (UID or name-based)
    │   └── RelationshipGender (gender-aware terms)
    │
    ├── MarkdownDocument (the file structure)
    │   ├── Frontmatter (YAML metadata)
    │   ├── MarkdownSection (generic section)
    │   ├── RelatedSection (relationships list)
    │   ├── ContactSection (contact fields)
    │   └── NotesSection (free-form notes)
    │
    └── Infrastructure:
        ├── FileStorage (read/write operations)
        ├── SyncCoordinator (orchestrate syncs)
        └── ValidationService (cross-entity validation)
```

### Key Differences

| Aspect | Current (Functional) | Proposed (Model-Based) |
|--------|---------------------|------------------------|
| Organization | By operation type | By domain entity |
| Primary classes | Operation classes | Entity/Model classes |
| Data location | Centralized ContactData | Each model owns its data |
| Behavior location | Operation methods | Model methods |
| Abstraction level | Mixed | Clear entity/infrastructure separation |
| Testability | Test operations | Test entities directly |
| Entity understanding | Read multiple files | One file per entity |

## Detailed Proposed Structure

### 1. Contact Model (`Contact.ts`)

**Responsibility**: Represents a complete contact with all its properties

```typescript
class Contact {
  private identity: ContactIdentity;
  private profile: ContactProfile;
  private fields: ContactFieldCollection;
  private relationships: RelationshipCollection;
  private revision: ContactRevision;
  
  // Factory methods
  static fromFile(file: TFile): Promise<Contact>
  static fromVCard(vcf: VCardData): Contact
  
  // Core behavior
  getDisplayName(): string
  getUID(): string
  addField(field: ContactField): void
  removeField(fieldId: string): void
  addRelationship(rel: Relationship): void
  removeRelationship(relId: string): void
  
  // Persistence
  save(): Promise<void>
  toMarkdown(): string
  toVCard(): VCardData
  
  // Validation
  validate(): ValidationResult
}
```

### 2. ContactField Model (`ContactField.ts`)

**Responsibility**: Represents individual contact data fields

```typescript
abstract class ContactField {
  protected type: string;
  protected label: string;
  protected value: string;
  
  abstract validate(): ValidationResult
  abstract toFrontmatter(): [string, string]
  abstract toMarkdown(): string
}

class EmailField extends ContactField {
  constructor(label: string, email: string)
  validate(): ValidationResult // Email-specific validation
  toFrontmatter(): [string, string] // EMAIL.WORK: email@example.com
  toMarkdown(): string // - Work: email@example.com
}

class TelephoneField extends ContactField { /* ... */ }
class AddressField extends ContactField { /* ... */ }
class UrlField extends ContactField { /* ... */ }
```

### 3. Relationship Model (`Relationship.ts`)

**Responsibility**: Represents a relationship between two contacts

```typescript
class Relationship {
  private type: RelationshipType;
  private targetRef: RelationshipReference;
  private targetContact?: Contact;
  
  constructor(type: string, targetRef: string | UID)
  
  // Resolution
  async resolve(contactManager: ContactManager): Promise<Contact>
  isResolved(): boolean
  
  // Gender-aware display
  getDisplayTerm(sourceGender: Gender): string
  inferTargetGender(): Gender | null
  
  // Reciprocal
  getReciprocal(sourceGender: Gender): Relationship
  
  // Serialization
  toFrontmatter(): [string, string]
  toMarkdown(): string
  
  // Validation
  validate(): ValidationResult
}

class RelationshipType {
  constructor(type: string)
  getGenderedTerm(gender: Gender): string
  inferGender(): Gender | null
  getReciprocal(targetGender: Gender): RelationshipType
}

class RelationshipReference {
  constructor(value: string)
  isUID(): boolean
  isName(): boolean
  getValue(): string
  parse(): { type: 'uid' | 'name', value: string }
}
```

### 4. MarkdownDocument Model (`MarkdownDocument.ts`)

**Responsibility**: Represents the markdown file structure

```typescript
class MarkdownDocument {
  private frontmatter: Frontmatter;
  private sections: Map<string, MarkdownSection>;
  
  constructor(content: string)
  
  // Access
  getFrontmatter(): Frontmatter
  getSection(name: string): MarkdownSection | null
  
  // Manipulation
  updateSection(section: MarkdownSection): void
  removeSection(name: string): void
  
  // Serialization
  toMarkdown(): string
}

class Frontmatter {
  private data: Record<string, any>;
  
  get(key: string): any
  set(key: string, value: any): void
  delete(key: string): void
  
  toYAML(): string
  toObject(): Record<string, any>
}

class MarkdownSection {
  name: string;
  level: number;
  content: string;
  
  toMarkdown(): string
}

class RelatedSection extends MarkdownSection {
  private relationships: Relationship[];
  
  parseRelationships(): Relationship[]
  setRelationships(rels: Relationship[]): void
  toMarkdown(): string
}

class ContactSection extends MarkdownSection {
  private fields: ContactField[];
  
  parseFields(): ContactField[]
  setFields(fields: ContactField[]): void
  toMarkdown(): string
}
```

### 5. Infrastructure Services

#### FileStorage (`FileStorage.ts`)

```typescript
class FileStorage {
  private app: App;
  private file: TFile;
  
  async readContent(): Promise<string>
  async writeContent(content: string): Promise<void>
  getFile(): TFile
}
```

#### SyncCoordinator (`SyncCoordinator.ts`)

```typescript
class SyncCoordinator {
  async syncFrontmatterToMarkdown(contact: Contact): Promise<SyncResult>
  async syncMarkdownToFrontmatter(contact: Contact): Promise<SyncResult>
  async performBidirectionalSync(contact: Contact): Promise<SyncResult>
}
```

## Migration Strategy

### Phase 1: Analysis & Foundation (This Document)
- ✅ Analyze current structure
- ✅ Identify domain entities
- ✅ Design target architecture
- [ ] Review and validate design with stakeholders

### Phase 2: Create Core Models (No Breaking Changes)
1. Create new model classes alongside existing operations
2. Implement basic entity models:
   - `ContactField` and subtypes
   - `Relationship` and related types
   - `MarkdownSection` and subtypes
3. Add comprehensive tests for new models
4. **No changes to existing code** - just additions

### Phase 3: Adapter Layer (Backward Compatible)
1. Create adapters that wrap new models with old operation interfaces
2. Implement factory methods to create models from existing data
3. Add integration tests showing old and new working together
4. **Still backward compatible**

### Phase 4: Gradual Migration (Incremental)
1. Migrate ContactNote methods one at a time to use new models
2. Deprecate old operation methods
3. Update tests to use new models
4. **Incremental, can pause/rollback at any point**

### Phase 5: Consolidation (Breaking Changes)
1. Remove deprecated operation classes
2. Simplify ContactNote to just coordinate models
3. Update all external references
4. **Breaking changes, but code is already using new APIs**

## Benefits of Model-Based Organization

### 1. Better Separation of Concerns
- Each model handles one type of entity
- Clear boundaries between entities
- Infrastructure separated from domain logic

### 2. Improved Understandability
- To understand a Relationship, read `Relationship.ts`
- Entity behavior co-located with entity data
- Self-documenting structure

### 3. Easier Testing
- Test entities in isolation
- Mock dependencies at model boundaries
- Test entity invariants directly

### 4. Better Extensibility
- Add features to entities without touching infrastructure
- Extend entities through inheritance
- Plugin architecture becomes easier

### 5. Stronger Type Safety
- Entities have well-defined types
- Type system enforces entity invariants
- Compile-time checking of entity usage

### 6. Clearer Lifecycle
- Entities have clear creation/validation/persistence steps
- State management localized to entities
- Easier to reason about entity state

## Risks & Mitigations

### Risk 1: Large Refactoring
**Mitigation**: Phased approach, backward compatibility until Phase 5

### Risk 2: Performance Regression
**Mitigation**: 
- Keep ContactData caching approach
- Benchmark before/after
- Profile critical paths

### Risk 3: Breaking Existing Code
**Mitigation**:
- Adapter layer maintains old APIs
- Deprecation warnings before removal
- Comprehensive test coverage

### Risk 4: Team Learning Curve
**Mitigation**:
- Clear documentation
- Side-by-side examples (old vs new)
- Gradual rollout

### Risk 5: Incomplete Migration
**Mitigation**:
- Each phase delivers value
- Can pause between phases
- Backward compatibility prevents "stuck in middle" state

## Success Criteria

1. **Entity Clarity**: Any entity can be understood by reading one file
2. **Test Directness**: Can test entity behavior without operation wrappers
3. **Code Organization**: File structure mirrors domain structure
4. **Maintainability**: Adding features requires touching fewer files
5. **No Regression**: All existing tests pass
6. **Performance**: No significant performance degradation

## Open Questions

1. **Data Ownership**: Should models own their data or reference shared data store?
   - **Recommendation**: Models own data, use repository pattern for persistence

2. **Caching Strategy**: How to maintain current caching performance?
   - **Recommendation**: Repository layer handles caching, models are data objects

3. **Backward Compatibility Timeline**: How long to maintain old APIs?
   - **Recommendation**: 2-3 releases with deprecation warnings

4. **Migration Order**: Which entities to migrate first?
   - **Recommendation**: Start with ContactField (simplest), then Relationship, then Contact

5. **Testing Strategy**: When to write tests for new models?
   - **Recommendation**: Test-first for new models (Phase 2)

## Next Steps

1. **Review this plan** with team and stakeholders
2. **Validate domain model design** - Are these the right entities?
3. **Prototype one entity** (ContactField) to validate approach
4. **Estimate effort** for each phase
5. **Create detailed Phase 2 plan** with specific tasks
6. **Set up benchmark suite** to track performance
7. **Update architecture documentation** to reflect new design

## References

### Related Documents
- `/project/specifications/` - Current technical specifications
- `/project/user-stories/` - User requirements
- `/docs/development.md` - Development guide

### Design Patterns
- **Domain-Driven Design (DDD)**: Organizing around domain entities
- **Repository Pattern**: Separating persistence from domain logic
- **Factory Pattern**: Creating complex entity objects
- **Strategy Pattern**: Different field types implementing common interface

### Similar Refactorings
- Martin Fowler's "Refactoring" - Moving from Procedural to Object-Oriented
- Eric Evans' "Domain-Driven Design" - Ubiquitous Language and Entities
- Robert Martin's "Clean Architecture" - Separation of Concerns

## Conclusion

This refactoring will transform ContactNote from a functional, operations-based organization to a model-based architecture centered on concrete domain entities. The phased approach ensures we can deliver value incrementally while maintaining backward compatibility and minimizing risk.

The key insight is: **Code should be organized around the "things" we're modeling (Contact, Relationship, Field) rather than the "operations" we perform (parse, sync, validate)**.

---

**Document Status**: Draft for Review  
**Created**: 2024  
**Authors**: GitHub Copilot Agent  
**Next Review**: After stakeholder feedback
