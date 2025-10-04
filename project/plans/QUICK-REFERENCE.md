# ContactNote Refactoring Quick Reference

## 📋 What is this?

A plan to refactor ContactNote from **functional organization** (code grouped by operations) to **model-based organization** (code grouped by domain entities).

## 🎯 Current Problem

To understand what a "Relationship" is, you must read **5 files** (~1,600 lines):
- RelationshipOperations.ts
- AdvancedRelationshipOperations.ts
- SyncOperations.ts
- RelationshipHelpers.ts
- ContactData.ts

## ✨ Proposed Solution

Put everything about Relationship in **1 file** (Relationship.ts, ~300 lines):
```typescript
class Relationship {
  // All relationship behavior here:
  - Parsing (fromMarkdown, fromFrontmatter)
  - Resolution (resolve by UID or name)
  - Display (gender-aware terms)
  - Reciprocal (automatic two-way relationships)
  - Validation (validate relationship data)
  - Serialization (toMarkdown, toFrontmatter)
}
```

## 📚 Planning Documents

| Document | What It Contains | Read When |
|----------|-----------------|-----------|
| **contactnote-refactoring-index.md** | Overview and navigation | Start here |
| **contactnote-model-refactoring.md** | Complete refactoring plan | Need full details |
| **contactnote-refactoring-examples.md** | Before/after code examples | Want to see code |
| **contactnote-architecture-diagrams.md** | Visual diagrams | Prefer visual understanding |

## 🔄 Migration Strategy

**4 Phases** (adapter layer skipped per stakeholder feedback):

1. ✅ **Analysis** - Understand current state (COMPLETE)
2. 🎯 **Create Models** - Add new entity classes alongside old code (3-4 weeks)
3. ⏳ **Gradual Migration** - Replace old code piece by piece
4. ⏳ **Consolidation** - Remove old operation classes

## 🎁 Key Benefits

| Benefit | Example |
|---------|---------|
| **Easier to understand** | Read Relationship.ts to understand relationships |
| **Easier to test** | `const rel = new Relationship('spouse', uid)` |
| **Easier to extend** | Add methods to Relationship class |
| **Better types** | Concrete types (Relationship) vs generic types |
| **Less code** | ~3,200 LOC vs ~5,386 LOC (40% reduction) |

## 🏗️ Domain Entities Identified

1. **Contact** - The contact itself (person/organization)
2. **Relationship** - Connection between contacts
3. **ContactField** - Individual fields (email, phone, address, URL)
4. **MarkdownDocument** - File structure (frontmatter + sections)
5. **Frontmatter** - YAML metadata
6. **UID** - Unique identifier
7. **Gender** - Gender classification
8. **Revision** - Timestamp tracking

## 📊 Metrics Comparison

| Metric | Current | Proposed | Change |
|--------|---------|----------|--------|
| Files | 17 | 12 | -29% |
| Total LOC | ~5,386 | ~3,200 | -40% |
| To understand Relationship | 5 files, 1,600 LOC | 1 file, 300 LOC | -80% |
| ContactNote size | 606 LOC | 200 LOC | -67% |

## 🧪 Testing Comparison

**Current** (must mock infrastructure):
```typescript
let contact: ContactNote;
let mockApp, mockSettings, mockFile;
// ... complex setup ...
const rels = await contact.parseRelatedSection();
```

**Proposed** (test directly):
```typescript
const rel = Relationship.fromMarkdown('spouse [[Jane]]');
expect(rel.getType()).toBe('spouse');
```

## 🚀 Next Steps

1. ✅ **Review** planning documents - COMPLETE
2. ✅ **Stakeholder approval** - APPROVED
3. ✅ **Create Phase 2 plan** - COMPLETE
4. 🎯 **Begin Phase 2 implementation** - START HERE
   - See `phase2-implementation-plan.md` for detailed tasks

## 💡 Key Insight

> Code should be organized around the **"things"** we're modeling  
> (Contact, Relationship, Field)  
> rather than the **"operations"** we perform  
> (parse, sync, validate)

---

**Status**: ✅ Approved - Phase 2 Ready  
**Next**: Begin Phase 2 implementation (see `phase2-implementation-plan.md`)  
**Duration**: 3-4 weeks
