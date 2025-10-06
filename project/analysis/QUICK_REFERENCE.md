# Quick Reference: ContactNote.ts Refactoring

This quick reference provides the essential information for refactoring `contactNote.ts`.

## At a Glance

| Metric | Value |
|--------|-------|
| Current lines | 2,361 |
| Target lines | ~200 |
| Reduction needed | 91.5% |
| Methods to refactor | 49 |
| Entity classes available | 20 |
| Estimated timeline | 4-6 weeks |
| **Feasibility** | **✅ YES** |

## Common Refactoring Patterns

### Pattern 1: Simple Delegation

```typescript
// Before
method(param: string): ReturnType {
  // ... 20+ lines of logic
  return result;
}

// After  
method(param: string): ReturnType {
  return Entity.operation(param);
}
```

### Pattern 2: Entity Composition

```typescript
// Before
async method(): Promise<Result> {
  const data = await this.getData();
  // ... complex transformation logic
  return processedData;
}

// After
async method(): Promise<Result> {
  const entity = Entity.fromData(await this.getData());
  return entity.process();
}
```

### Pattern 3: Immutable Chaining

```typescript
// Before
async method(key: string, value: string): Promise<void> {
  const obj = await this.getObject();
  obj[key] = value;
  obj.REV = generateTimestamp();
  await this.save(obj);
}

// After
async method(key: string, value: string): Promise<void> {
  let entity = await this.getEntity();
  entity = entity.set(key, value).set('REV', Revision.now());
  await this.saveEntity(entity);
}
```

## Entity Quick Reference

### Value Objects

```typescript
// UID
UID.generate()                    // New UID
UID.fromString(value)             // Parse UID
uid.getValue()                    // Get string value
uid.toURN()                       // Format as URN
uid.isUUID()                      // Check if UUID format

// Gender
Gender.fromString(value)          // Parse gender
Gender.MALE, Gender.FEMALE        // Constants
gender.isMale()                   // Check gender
gender.toLegacyFormat()           // For compatibility

// Revision  
Revision.now()                    // Current timestamp
Revision.fromString(value)        // Parse timestamp
rev.toISOString()                 // ISO format
rev.toVCFFormat()                 // VCard format
```

### Document Entities

```typescript
// Frontmatter
Frontmatter.fromYAML(yaml)        // Parse YAML
Frontmatter.fromObject(obj)       // From object
fm.get(key)                       // Get value
fm.set(key, value)                // Set value (returns new)
fm.delete(key)                    // Delete (returns new)
fm.toYAML()                       // Serialize
fm.validate()                     // Validate

// RelatedSection
RelatedSection.fromMarkdown(md)   // Parse section
RelatedSection.fromRelationships(rels) // Create from rels
section.getRelationships()        // Get all relationships
section.toMarkdown()              // Generate markdown

// ContactSection
ContactSection.fromMarkdown(md)   // Parse section
ContactSection.fromFields(fields) // Create from fields
section.getFields()               // Get all fields
section.toMarkdown()              // Generate markdown
```

### Relationship Entities

```typescript
// Relationship
Relationship.fromMarkdown(md)     // Parse markdown
Relationship.fromFrontmatter(fm)  // Parse frontmatter
rel.getType()                     // Get type
rel.getTarget()                   // Get target reference
rel.toMarkdown()                  // Generate markdown

// RelationshipType
RelationshipType.fromString(type) // Parse type
type.getNeutralType()             // Gender-neutral form
type.getGenderedTerm(gender)      // Gender-specific term
type.getReciprocal()              // Reciprocal type
type.equals(other)                // Compare types

// RelationshipReference
RelationshipReference.fromUID(uid)      // UID-based ref
RelationshipReference.fromName(name)    // Name-based ref
RelationshipReference.fromString(str)   // Parse any format
ref.getType()                           // Get ref type
ref.getValue()                          // Get value
ref.isUIDReference()                    // Check type
```

### Field Entities

```typescript
// ContactField (base)
ContactField.fromFrontmatterEntry(key, value)

// EmailField
EmailField.fromFrontmatter(key, value)
email.getValue()
email.validate()

// TelephoneField
TelephoneField.fromFrontmatter(key, value)
tel.getValue()
tel.validate()

// UrlField
UrlField.fromFrontmatter(key, value)
url.getValue()
url.validate()

// AddressField
AddressField.fromFrontmatter(key, value)
addr.getComponents()
addr.validate()
```

## Top 10 Methods to Refactor First

These provide the biggest impact:

1. **updateRelatedSectionInContent** (105 → 8 lines, 92% reduction)
2. **parseFrontmatterRelationships** (136 → ~20 lines, 85% reduction)
3. **upgradeNameBasedRelationshipsToUID** (100 → ~20 lines, 80% reduction)
4. **validateRequiredFields** (97 → 5 lines, 95% reduction)
5. **getRelationships** (85 → ~15 lines, 82% reduction)
6. **syncRelatedListToFrontmatter** (80 → ~20 lines, 75% reduction)
7. **syncFrontmatterToRelatedList** (79 → ~20 lines, 75% reduction)
8. **bulkUpdateRelationshipUIDs** (74 → ~15 lines, 80% reduction)
9. **updateRelationshipUID** (68 → ~12 lines, 82% reduction)
10. **identifyInvalidFrontmatterFields** (65 → ~10 lines, 85% reduction)

**Total from top 10:** ~889 lines → ~145 lines (744 lines saved, 84% reduction)

## Refactoring Checklist

### Before You Start
- [ ] Read the Summary document
- [ ] Review the Mapping document  
- [ ] Study the Examples document
- [ ] Run all tests (baseline)
- [ ] Create feature branch

### For Each Method
- [ ] Identify the entity to use
- [ ] Write test for current behavior
- [ ] Replace implementation with entity
- [ ] Run tests
- [ ] Verify return values match
- [ ] Test edge cases
- [ ] Update method documentation

### After Refactoring
- [ ] All tests pass
- [ ] No performance regression
- [ ] Documentation updated
- [ ] Create PR with clear description
- [ ] Request code review

## Common Pitfalls

### ❌ Don't: Change method signatures
```typescript
// Bad
async getGender(): Promise<GenderEntity> { ... }
```

### ✅ Do: Keep signatures, convert internally
```typescript
// Good
async getGender(): Promise<Gender> {
  return Gender.fromString(...).toLegacyFormat();
}
```

### ❌ Don't: Remove error handling
```typescript
// Bad
method() {
  return Entity.operation(); // May throw
}
```

### ✅ Do: Maintain error handling
```typescript
// Good
method() {
  try {
    return Entity.operation();
  } catch (error) {
    return null; // Or appropriate fallback
  }
}
```

### ❌ Don't: Forget caching
```typescript
// Bad - loses performance
async getGender(): Promise<Gender> {
  const fm = await this.getFrontmatter();
  return Gender.fromString(fm.GENDER).toLegacyFormat();
}
```

### ✅ Do: Maintain caching
```typescript
// Good - keeps performance
async getGender(): Promise<Gender> {
  if (this._gender === null) {
    const fm = await this.getFrontmatter();
    this._gender = Gender.fromString(fm.GENDER).toLegacyFormat();
  }
  return this._gender;
}
```

## Testing Guidelines

### Unit Tests
```typescript
describe('refactored method', () => {
  it('should behave identically to original', async () => {
    const result = await contactNote.method(input);
    expect(result).toEqual(expectedOutput);
  });
  
  it('should handle edge cases', async () => {
    const result = await contactNote.method(edgeCase);
    expect(result).toBeDefined();
  });
});
```

### Integration Tests
```typescript
describe('method integration', () => {
  it('should work with other methods', async () => {
    await contactNote.method1();
    const result = await contactNote.method2();
    expect(result).toMatchSnapshot();
  });
});
```

## Performance Considerations

### Entity Creation Overhead
- ✅ **Minimal** - Entities are lightweight
- ✅ **Optimized** - Entities use efficient patterns
- ✅ **Cacheable** - Results can be cached

### Memory Usage
- ✅ **Better** - Immutable entities reduce memory leaks
- ✅ **Controlled** - Clear object lifecycle
- ✅ **Garbage collected** - Old instances released

## Documentation Standards

### Method Documentation
```typescript
/**
 * Get the contact's gender
 * 
 * Uses Gender entity for parsing and validation.
 * 
 * @returns Gender value or null if not set
 * @example
 * const gender = await contact.getGender();
 */
async getGender(): Promise<Gender> {
  // Implementation using Gender entity
}
```

### Deprecation Tags
```typescript
/**
 * Parse gender value
 * 
 * @deprecated Use Gender.fromString() directly
 * @see Gender.fromString
 */
parseGender(value: string): Gender {
  return Gender.fromString(value).toLegacyFormat();
}
```

## Support Resources

### Documentation
- **Summary:** `project/analysis/contactNote-refactoring-summary.md`
- **Mapping:** `project/analysis/contactNote-refactoring-mapping.md`
- **Examples:** `project/analysis/contactNote-refactoring-examples.md`
- **This Guide:** `project/analysis/QUICK_REFERENCE.md`

### Code References
- **Entities:** `src/models/contactNote/entities/`
- **Current ContactNote:** `src/models/contactNote/contactNote.ts`
- **Tests:** `tests/units/models/contactNote/`

### Getting Help
1. Check the relevant analysis document
2. Review entity source code
3. Look at existing tests
4. Ask the team
5. Create an issue if needed

## Quick Wins

Start with these easy refactorings to build confidence:

1. **parseGender** - Simple delegation (25 → 3 lines)
2. **formatRelatedValue** - Direct entity use (10 → 1 line)
3. **generateRevTimestamp** - Already using entity (no change)
4. **extractRelationshipType** - Simple delegation (8 → 2 lines)

These provide immediate value with minimal risk.

---

**Remember:** The goal is not just to reduce lines, but to improve code quality, maintainability, and testability. Take your time, test thoroughly, and refactor incrementally.
