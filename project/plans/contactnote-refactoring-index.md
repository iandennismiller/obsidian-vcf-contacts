# ContactNote Refactoring: Planning Materials Index

## Overview

This directory contains comprehensive planning materials for refactoring the ContactNote model from a **functional/operations-based architecture** to a **model-based architecture** organized around domain entities.

## Quick Navigation

### 📋 Main Planning Document
**[contactnote-model-refactoring.md](./contactnote-model-refactoring.md)**
- Comprehensive refactoring plan
- Current state analysis
- Proposed target architecture
- Domain entity identification
- Migration strategy (revised to 4 phases)
- Risk assessment and mitigation
- Success criteria

**Read this first** to understand the overall vision and approach.

### 🎯 Phase 2 Implementation Plan ⭐ NEW
**[phase2-implementation-plan.md](./phase2-implementation-plan.md)**
- Detailed week-by-week implementation tasks
- 40+ specific implementation tasks with acceptance criteria
- Complete test strategy (200+ test cases)
- Performance benchmarking plan
- Documentation requirements
- Success criteria and validation

**Read this to implement Phase 2** (creating core domain models).

### 💡 Code Examples
**[contactnote-refactoring-examples.md](./contactnote-refactoring-examples.md)**
- Side-by-side code comparisons
- Current approach vs. proposed approach
- Example 1: Working with Relationships
- Example 2: Working with Contact Fields
- Example 3: Contact Lifecycle
- Example 4: Testing
- Migration path examples

**Read this second** to see concrete code examples of the transformation.

### 📊 Architecture Diagrams
**[contactnote-architecture-diagrams.md](./contactnote-architecture-diagrams.md)**
- Visual architecture diagrams (ASCII art)
- Current vs. proposed structure
- Data flow visualizations
- File organization comparison
- Benefits visualization

**Read this third** for visual understanding of the architectural changes.

## Problem Statement

ContactNote is currently organized **functionally** - code is grouped by the type of operations performed:
- RelationshipOperations
- SyncOperations
- ValidationOperations
- MarkdownOperations
- etc.

This makes it difficult to:
1. Understand what a "Relationship" or "ContactField" actually is
2. Test entity behavior in isolation
3. Extend entity functionality
4. Reason about entity lifecycle and state

## Proposed Solution

Refactor to a **model-based architecture** - code organized by domain entities:
- Contact (the contact itself)
- Relationship (connection between contacts)
- ContactField (email, phone, address, etc.)
- MarkdownDocument (file structure)
- Infrastructure services (storage, sync, validation)

## Key Documents at a Glance

| Document | Purpose | Length | Key Sections |
|----------|---------|--------|--------------|
| contactnote-model-refactoring.md | Main plan | 17,000 words | Current analysis, Proposed architecture, Migration strategy |
| contactnote-refactoring-examples.md | Code examples | 26,000 words | 4 major examples with before/after code |
| contactnote-architecture-diagrams.md | Visual diagrams | 26,000 words | Architecture diagrams, data flows, comparisons |

## Migration Strategy Summary

**NOTE**: Adapter layer (originally Phase 3) has been **skipped per stakeholder feedback**. We will proceed directly from model creation to gradual migration.

### Phase 1: Analysis & Foundation ✅ COMPLETE
- ✅ Analyze current structure
- ✅ Identify domain entities
- ✅ Design target architecture
- ✅ Create planning documents
- ✅ Stakeholder approval received

### Phase 2: Create Core Models 🎯 READY TO START (3-4 weeks)
- Create new model classes alongside existing operations
- Implement 15+ entity classes
- Write 200+ test cases
- No breaking changes
- Full test coverage for new models
- Performance benchmarking
- See `phase2-implementation-plan.md` for details

### Phase 3: Gradual Migration (Future)
- Migrate ContactNote methods one at a time
- Implement full Contact entity
- Deprecate old operation methods
- Incremental, can pause/rollback

### Phase 4: Consolidation (Future)
- Remove deprecated operation classes
- Simplify ContactNote
- Breaking changes (but code already using new APIs)

## Domain Entities Identified

### Core Entities
1. **Contact** - A person/organization with properties
2. **Relationship** - Connection between two contacts
3. **ContactField** - Individual data fields (email, phone, etc.)
4. **MarkdownDocument** - The file structure
5. **Frontmatter** - YAML metadata

### Supporting Entities
6. **UID** - Unique identifier
7. **Gender** - Gender classification
8. **Revision** - Timestamp tracking

## Benefits Summary

### Current Approach (Functional)
- ✅ Clear separation of operations
- ✅ Centralized caching
- ❌ Entity logic scattered across multiple files
- ❌ Hard to test entities in isolation
- ❌ Difficult to extend entity behavior

### Proposed Approach (Model-Based)
- ✅ One file per entity
- ✅ Easy to test entities directly
- ✅ Clear entity lifecycle
- ✅ Easy to extend entities
- ✅ Self-documenting structure
- ⚠️ Need to maintain caching performance

## Code Metrics

### Current Structure
- **Total LOC**: ~5,386
- **Files**: 17 TypeScript files
- **Main orchestrator**: ContactNote (606 LOC)
- **Largest operation**: ContactSectionOperations (810 LOC)
- **To understand Relationship**: Read 5 files, ~1,600 LOC

### Proposed Structure
- **Total LOC**: ~3,200 (40% reduction through consolidation)
- **Files**: ~12 TypeScript files
- **Main facade**: ContactNote (200 LOC - much simpler)
- **Largest entity**: Contact (400 LOC)
- **To understand Relationship**: Read 1 file, ~300 LOC

## Example: Relationship Entity

### Current (Scattered)
```
RelationshipOperations.ts (526 LOC)
├── Parsing
└── Rendering

AdvancedRelationshipOperations.ts (402 LOC)
├── Bidirectional creation
└── Bidirectional removal

SyncOperations.ts (396 LOC)
├── Frontmatter sync
└── Markdown sync

RelationshipHelpers.ts (136 LOC)
└── Reciprocal types

Total: ~1,460 LOC across 4 files
```

### Proposed (Unified)
```
Relationship.ts (300 LOC)
├── class Relationship
│   ├── Factory methods (fromMarkdown, fromFrontmatter)
│   ├── Resolution (resolve, isResolved)
│   ├── Display (getDisplayTerm, inferTargetGender)
│   ├── Reciprocal (getReciprocal)
│   ├── Serialization (toMarkdown, toFrontmatter)
│   └── Validation (validate)
├── class RelationshipType
│   └── Gender-aware terms, reciprocals
└── class RelationshipReference
    └── UID vs name handling

Total: ~300 LOC in 1 file
```

## Testing Comparison

### Current: Must Mock Infrastructure
```typescript
describe('Relationship operations', () => {
  let contact: ContactNote;
  let mockApp: App;
  let mockSettings: ContactsPluginSettings;
  let mockFile: TFile;
  
  beforeEach(() => {
    mockApp = createMockApp();
    mockSettings = createMockSettings();
    mockFile = createMockFile();
    contact = new ContactNote(mockApp, mockSettings, mockFile);
  });
  
  it('should parse relationship', async () => {
    mockFile.vault.read = jest.fn().mockResolvedValue(`...`);
    const rels = await contact.parseRelatedSection();
    // assertions
  });
});
```

### Proposed: Test Entities Directly
```typescript
describe('Relationship', () => {
  it('should parse from markdown', () => {
    const rel = Relationship.fromMarkdown('spouse [[Jane Doe]]');
    expect(rel.getType()).toBe('spouse');
    expect(rel.getTargetName()).toBe('Jane Doe');
  });
  
  it('should validate correctly', () => {
    const rel = new Relationship('spouse', 'urn:uuid:123');
    expect(rel.validate().isValid).toBe(true);
  });
});
```

## Next Steps

1. **Review Planning Materials** ✅ COMPLETE
   - ✅ Main refactoring plan
   - ✅ Code examples document
   - ✅ Architecture diagrams
   
2. **Stakeholder Review** ✅ COMPLETE
   - ✅ Present to team
   - ✅ Gather feedback - APPROVED
   - ✅ Validate domain model - VALIDATED
   - ✅ Adapter layer skipped per feedback
   
3. **Phase 2 Planning** ✅ COMPLETE
   - ✅ Detailed implementation plan created
   - ✅ 40+ specific tasks defined
   - ✅ Test strategy established
   - ✅ 3-4 week timeline estimated
   
4. **Begin Phase 2 Implementation** 🎯 READY
   - [ ] Week 1: Value Objects (Gender, UID, Revision)
   - [ ] Week 2: Contact Fields (Email, Tel, Address, URL)
   - [ ] Week 3: Relationships (Type, Reference, Relationship)
   - [ ] Week 4: Document Entities (Frontmatter, Sections)
   - See `phase2-implementation-plan.md` for full details

## Questions to Answer

1. **Data Ownership**: Should models own data or reference shared store?
   - **Recommendation**: Models own data, repository pattern for persistence

2. **Caching**: How to maintain performance with models owning data?
   - **Recommendation**: Repository layer handles caching

3. **Migration Timeline**: How long to maintain backward compatibility?
   - **Recommendation**: 2-3 releases with deprecation warnings

4. **Testing**: When to write tests for new models?
   - **Recommendation**: Test-first for Phase 2

## Related Documentation

### Project Specifications
- `/project/specifications/relationship-management.md`
- `/project/specifications/contact-section.md`
- `/project/specifications/vcf-sync.md`

### User Stories
- `/project/user-stories/relationship-management.md`
- `/project/user-stories/contact-data-management.md`

### Development Docs
- `/docs/development.md`
- `/docs/architecture.md` (to be updated)

## Conclusion

This refactoring will transform ContactNote from organizing code by **operations** (what it does) to organizing by **entities** (what it models). The phased approach ensures we can:

- Deliver value incrementally
- Maintain backward compatibility
- Minimize risk
- Pause/rollback at any phase

The key insight: **Code should be organized around the "things" we're modeling (Contact, Relationship, Field) rather than the "operations" we perform (parse, sync, validate)**.

---

**Status**: Planning Complete, Awaiting Review  
**Created**: 2024  
**Next Phase**: Stakeholder review and prototype
