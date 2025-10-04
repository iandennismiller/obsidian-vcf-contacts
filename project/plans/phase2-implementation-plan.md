# Phase 2 Implementation Plan: Create Core Domain Models

## Executive Summary

This document provides a detailed implementation plan for **Phase 2** of the ContactNote refactoring: creating core domain models alongside the existing operations-based code. Per stakeholder feedback, we will **skip the adapter layer** (originally Phase 3) and proceed directly to gradual migration in Phase 3.

**Revised Phase Sequence**:
1. ✅ Phase 1: Analysis & Foundation - COMPLETE
2. 🎯 **Phase 2: Create Core Models** - THIS DOCUMENT (3-4 weeks)
3. Phase 3: Gradual Migration - Replace operations incrementally
4. Phase 4: Consolidation - Remove deprecated code

## Goals

1. Create concrete domain entity classes alongside existing operations
2. Implement full test coverage for new models
3. Ensure no breaking changes to existing code
4. Validate the model-based approach with working code
5. Establish patterns for remaining entity implementations

## Scope

### In Scope for Phase 2

**Core Entities to Implement**:
1. ✅ ContactField hierarchy (EmailField, TelephoneField, AddressField, UrlField)
2. ✅ Relationship and supporting types (RelationshipType, RelationshipReference)
3. ✅ MarkdownSection hierarchy (Frontmatter, RelatedSection, ContactSection)
4. ✅ Supporting value objects (UID, Gender, Revision)

**Key Deliverables**:
- Working entity classes with full functionality
- Comprehensive unit tests (80%+ coverage)
- Integration tests showing entities working together
- Documentation for each entity
- Performance benchmarks

### Out of Scope for Phase 2

- Modifying existing operation classes
- Migrating ContactNote to use new models
- Breaking changes to public APIs
- Removing any existing code
- Full Contact entity (will be implemented in Phase 3)

## Implementation Strategy

### Approach: Bottom-Up

Implement entities in order of dependency, from simplest to most complex:

```
Tier 1: Value Objects (Week 1)
├── Gender
├── UID
└── Revision

Tier 2: Field Entities (Week 2)
├── ContactField (abstract)
├── EmailField
├── TelephoneField
├── AddressField
└── UrlField

Tier 3: Relationship Entities (Week 2-3)
├── RelationshipType
├── RelationshipReference
└── Relationship

Tier 4: Document Entities (Week 3-4)
├── Frontmatter
├── MarkdownSection (abstract)
├── RelatedSection
└── ContactSection
```

### File Organization

New files will be created in: `/src/models/contactNote/entities/`

```
src/models/contactNote/
├── entities/                    # NEW: Domain models
│   ├── valueObjects/
│   │   ├── Gender.ts
│   │   ├── UID.ts
│   │   └── Revision.ts
│   ├── fields/
│   │   ├── ContactField.ts     # Abstract base
│   │   ├── EmailField.ts
│   │   ├── TelephoneField.ts
│   │   ├── AddressField.ts
│   │   └── UrlField.ts
│   ├── relationships/
│   │   ├── RelationshipType.ts
│   │   ├── RelationshipReference.ts
│   │   └── Relationship.ts
│   ├── document/
│   │   ├── Frontmatter.ts
│   │   ├── MarkdownSection.ts  # Abstract base
│   │   ├── RelatedSection.ts
│   │   └── ContactSection.ts
│   └── index.ts                # Entity exports
│
├── [existing files unchanged]  # All current operations remain
├── contactNote.ts
├── contactData.ts
├── relationshipOperations.ts
└── ...
```

## Detailed Implementation Tasks

### Week 1: Value Objects & Setup

#### Task 1.1: Project Setup (2 hours)
**Goal**: Set up entity directory structure and testing infrastructure

**Steps**:
1. Create `/src/models/contactNote/entities/` directory structure
2. Create test directories in `/tests/units/entities/`
3. Add entity exports to `/src/models/contactNote/entities/index.ts`
4. Update tsconfig if needed for new paths

**Acceptance Criteria**:
- [ ] Directory structure created
- [ ] Test infrastructure ready
- [ ] Build passes with no errors

**Files to Create**:
- `src/models/contactNote/entities/index.ts`
- `src/models/contactNote/entities/valueObjects/index.ts`
- `src/models/contactNote/entities/fields/index.ts`
- `src/models/contactNote/entities/relationships/index.ts`
- `src/models/contactNote/entities/document/index.ts`
- `tests/units/entities/` (directory)

---

#### Task 1.2: Gender Value Object (4 hours)
**Goal**: Implement Gender as an immutable value object

**Implementation**:
```typescript
// src/models/contactNote/entities/valueObjects/Gender.ts

/**
 * Gender value object for contact classification
 * Supports both modern and legacy formats for backward compatibility
 */
export class Gender {
  private readonly value: GenderValue;
  
  // Modern values
  static readonly UNKNOWN = new Gender('unknown');
  static readonly MALE = new Gender('male');
  static readonly FEMALE = new Gender('female');
  static readonly OTHER = new Gender('other');
  
  // Factory methods
  static fromString(value: string | null): Gender
  static fromLegacy(legacy: 'M' | 'F' | 'NB' | 'U' | null): Gender
  
  // Core methods
  getValue(): string
  isUnknown(): boolean
  equals(other: Gender): boolean
  
  // Legacy support
  toLegacyFormat(): 'M' | 'F' | 'NB' | 'U'
}

type GenderValue = 'unknown' | 'male' | 'female' | 'other';
```

**Tests** (`tests/units/entities/valueObjects/Gender.spec.ts`):
- [ ] Create from string
- [ ] Create from legacy format
- [ ] Static constants work correctly
- [ ] Equality comparison
- [ ] Immutability (value cannot change)
- [ ] Invalid values handled appropriately
- [ ] Legacy format conversion

**Acceptance Criteria**:
- [ ] All tests pass (15+ test cases)
- [ ] 100% code coverage
- [ ] JSDoc comments complete
- [ ] No dependencies on operations classes

---

#### Task 1.3: UID Value Object (4 hours)
**Goal**: Implement UID as a validated value object

**Implementation**:
```typescript
// src/models/contactNote/entities/valueObjects/UID.ts

/**
 * UID (Unique Identifier) value object
 * Validates and normalizes contact identifiers
 */
export class UID {
  private readonly value: string;
  
  constructor(value: string)
  
  // Factory methods
  static generate(): UID
  static fromString(value: string): UID
  static fromUUID(uuid: string): UID
  static fromURN(urn: string): UID
  
  // Validation
  isValid(): boolean
  static validate(value: string): boolean
  
  // Formats
  getValue(): string
  toURN(): string  // urn:uuid:...
  toUUID(): string // Just the UUID part
  
  // Comparison
  equals(other: UID): boolean
  toString(): string
}
```

**Tests** (`tests/units/entities/valueObjects/UID.spec.ts`):
- [ ] Generate new UID
- [ ] Parse from string
- [ ] Parse from UUID
- [ ] Parse from URN format
- [ ] Validation (valid formats)
- [ ] Validation (invalid formats)
- [ ] Format conversions
- [ ] Equality comparison
- [ ] Immutability

**Acceptance Criteria**:
- [ ] All tests pass (20+ test cases)
- [ ] 100% code coverage
- [ ] Handles all UID formats from existing code
- [ ] Validation matches current UIDOperations.isValidUID()

---

#### Task 1.4: Revision Value Object (3 hours)
**Goal**: Implement Revision for timestamp tracking

**Implementation**:
```typescript
// src/models/contactNote/entities/valueObjects/Revision.ts

/**
 * Revision value object for tracking contact modifications
 */
export class Revision {
  private readonly timestamp: Date;
  
  constructor(timestamp: Date)
  
  // Factory methods
  static now(): Revision
  static fromString(dateString: string): Revision
  static fromTimestamp(timestamp: number): Revision
  
  // Access
  getTimestamp(): Date
  toISOString(): string
  
  // Comparison
  isNewerThan(other: Revision): boolean
  isOlderThan(other: Revision): boolean
  equals(other: Revision): boolean
  
  // Formatting
  toString(): string
  toFrontmatterValue(): string
}
```

**Tests** (`tests/units/entities/valueObjects/Revision.spec.ts`):
- [ ] Create from now
- [ ] Create from string
- [ ] Create from timestamp
- [ ] Comparison operations
- [ ] Format conversions
- [ ] Invalid date handling
- [ ] Immutability

**Acceptance Criteria**:
- [ ] All tests pass (12+ test cases)
- [ ] 100% code coverage
- [ ] ISO 8601 format support
- [ ] Compatible with existing revision format

---

### Week 2: Contact Field Entities

#### Task 2.1: ContactField Abstract Base (6 hours)
**Goal**: Create abstract base class for all contact fields

**Implementation**:
```typescript
// src/models/contactNote/entities/fields/ContactField.ts

/**
 * Abstract base class for contact data fields
 */
export abstract class ContactField {
  protected readonly label: string;
  protected readonly value: string;
  
  constructor(label: string, value: string)
  
  // Abstract methods (must be implemented by subclasses)
  abstract getType(): string;
  abstract validate(): ValidationResult;
  abstract toFrontmatter(): FrontmatterEntry | FrontmatterEntry[];
  abstract toMarkdown(): string;
  
  // Concrete methods (common to all fields)
  getLabel(): string
  getValue(): string
  equals(other: ContactField): boolean
  
  // Factory method (to be implemented in concrete classes)
  static fromFrontmatter?(key: string, value: any): ContactField;
  static fromMarkdown?(line: string): ContactField;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FrontmatterEntry {
  key: string;
  value: any;
}
```

**Tests** (`tests/units/entities/fields/ContactField.spec.ts`):
- [ ] Abstract class cannot be instantiated
- [ ] Common methods work correctly
- [ ] Subclass contract enforcement
- [ ] Equality comparison

**Acceptance Criteria**:
- [ ] All tests pass (8+ test cases)
- [ ] Well-documented abstract methods
- [ ] Clear interface for subclasses
- [ ] TypeScript types properly defined

---

#### Task 2.2: EmailField (4 hours)
**Goal**: Implement email field with validation

**Implementation**:
```typescript
// src/models/contactNote/entities/fields/EmailField.ts

export class EmailField extends ContactField {
  constructor(label: string, email: string)
  
  // Factory methods
  static fromFrontmatter(key: string, value: string): EmailField
  static fromMarkdown(line: string): EmailField
  
  // Implementation of abstract methods
  getType(): string  // Returns 'EMAIL'
  validate(): ValidationResult
  toFrontmatter(): FrontmatterEntry
  toMarkdown(): string
  
  // Email-specific methods
  getDomain(): string
  getLocalPart(): string
  isWorkEmail(): boolean
}
```

**Tests** (`tests/units/entities/fields/EmailField.spec.ts`):
- [ ] Create from constructor
- [ ] Parse from frontmatter (EMAIL.WORK: test@example.com)
- [ ] Parse from markdown (- Work: test@example.com)
- [ ] Validate valid emails
- [ ] Validate invalid emails (missing @, invalid domain, etc.)
- [ ] toFrontmatter() generates correct format
- [ ] toMarkdown() generates correct format
- [ ] getDomain() extracts domain
- [ ] getLocalPart() extracts local part
- [ ] isWorkEmail() identifies work emails

**Acceptance Criteria**:
- [ ] All tests pass (15+ test cases)
- [ ] 100% code coverage
- [ ] RFC 5322 email validation
- [ ] Compatible with existing email parsing

---

#### Task 2.3: TelephoneField (4 hours)
**Goal**: Implement telephone field with validation

**Implementation**:
```typescript
// src/models/contactNote/entities/fields/TelephoneField.ts

export class TelephoneField extends ContactField {
  constructor(label: string, number: string)
  
  // Factory methods
  static fromFrontmatter(key: string, value: string): TelephoneField
  static fromMarkdown(line: string): TelephoneField
  
  // Implementation
  getType(): string  // Returns 'TEL'
  validate(): ValidationResult
  toFrontmatter(): FrontmatterEntry
  toMarkdown(): string
  
  // Telephone-specific methods
  getCleanedNumber(): string  // Strip formatting
  isMobile(): boolean
  isInternational(): boolean
  format(style: 'us' | 'international' | 'e164'): string
}
```

**Tests** (`tests/units/entities/fields/TelephoneField.spec.ts`):
- [ ] Create from constructor
- [ ] Parse from frontmatter
- [ ] Parse from markdown
- [ ] Validate valid phone numbers (various formats)
- [ ] Validate invalid phone numbers
- [ ] Serialization (frontmatter and markdown)
- [ ] getCleanedNumber() removes formatting
- [ ] isMobile() identifies cell/mobile
- [ ] isInternational() detects +country codes
- [ ] format() applies different formatting styles

**Acceptance Criteria**:
- [ ] All tests pass (15+ test cases)
- [ ] 100% code coverage
- [ ] International number support
- [ ] Compatible with existing phone validation

---

#### Task 2.4: AddressField (6 hours)
**Goal**: Implement structured address field

**Implementation**:
```typescript
// src/models/contactNote/entities/fields/AddressField.ts

export interface AddressComponents {
  street?: string;
  locality?: string;    // City
  region?: string;      // State/Province
  postalCode?: string;
  country?: string;
}

export class AddressField extends ContactField {
  private readonly components: AddressComponents;
  
  constructor(label: string, components: AddressComponents)
  
  // Factory methods
  static fromFrontmatter(baseKey: string, frontmatter: Record<string, any>): AddressField
  static fromMarkdown(line: string): AddressField
  
  // Implementation
  getType(): string  // Returns 'ADR'
  validate(): ValidationResult
  toFrontmatter(): FrontmatterEntry[]  // Multiple entries
  toMarkdown(): string
  
  // Address-specific methods
  getStreet(): string | undefined
  getLocality(): string | undefined
  getRegion(): string | undefined
  getPostalCode(): string | undefined
  getCountry(): string | undefined
  isComplete(): boolean
  getComponents(): AddressComponents
  toSingleLine(): string
  toMultiLine(): string
}
```

**Tests** (`tests/units/entities/fields/AddressField.spec.ts`):
- [ ] Create from components
- [ ] Parse from frontmatter (nested structure)
- [ ] Parse from markdown (multi-line format)
- [ ] Validate complete address
- [ ] Validate partial address
- [ ] Validate empty address (should fail)
- [ ] toFrontmatter() generates nested structure
- [ ] toMarkdown() generates multi-line format
- [ ] Component getters
- [ ] isComplete() logic
- [ ] Single-line formatting
- [ ] Multi-line formatting

**Acceptance Criteria**:
- [ ] All tests pass (20+ test cases)
- [ ] 100% code coverage
- [ ] Handles partial addresses
- [ ] Compatible with vCard ADR structure

---

#### Task 2.5: UrlField (3 hours)
**Goal**: Implement URL field with validation

**Implementation**:
```typescript
// src/models/contactNote/entities/fields/UrlField.ts

export class UrlField extends ContactField {
  private readonly url: URL;  // Parsed URL object
  
  constructor(label: string, urlString: string)
  
  // Factory methods
  static fromFrontmatter(key: string, value: string): UrlField
  static fromMarkdown(line: string): UrlField
  
  // Implementation
  getType(): string  // Returns 'URL'
  validate(): ValidationResult
  toFrontmatter(): FrontmatterEntry
  toMarkdown(): string
  
  // URL-specific methods
  getDomain(): string
  getProtocol(): string
  isSecure(): boolean
  getPath(): string
  getQueryParams(): URLSearchParams
}
```

**Tests** (`tests/units/entities/fields/UrlField.spec.ts`):
- [ ] Create from valid URL
- [ ] Create from invalid URL (should throw)
- [ ] Parse from frontmatter
- [ ] Parse from markdown
- [ ] Validate HTTPS URLs
- [ ] Validate HTTP URLs
- [ ] Serialization
- [ ] getDomain()
- [ ] getProtocol()
- [ ] isSecure()
- [ ] getPath()
- [ ] getQueryParams()

**Acceptance Criteria**:
- [ ] All tests pass (15+ test cases)
- [ ] 100% code coverage
- [ ] URL validation using native URL class
- [ ] Handles various URL formats

---

### Week 3: Relationship Entities

#### Task 3.1: RelationshipType (6 hours)
**Goal**: Implement relationship type with gender awareness

**Implementation**:
```typescript
// src/models/contactNote/entities/relationships/RelationshipType.ts

/**
 * Relationship type with gender-aware term handling
 */
export class RelationshipType {
  private readonly type: string;
  
  constructor(type: string)
  
  // Factory methods
  static fromString(type: string): RelationshipType
  
  // Core methods
  getValue(): string
  isValid(): boolean
  
  // Gender-aware display
  getGenderedTerm(gender: Gender): string
  inferGender(): Gender | null
  
  // Reciprocal relationships
  getReciprocal(targetGender: Gender): RelationshipType
  hasReciprocal(): boolean
  
  // Comparison
  equals(other: RelationshipType): boolean
  toString(): string
  
  // Type checking
  isFamilial(): boolean
  isProfessional(): boolean
  isSymmetric(): boolean  // e.g., spouse, friend, colleague
}

// Constants for gendered terms and reciprocals
const GENDERED_TERMS: Record<string, Record<string, string>>;
const RECIPROCAL_TYPES: Record<string, string | Record<string, string>>;
```

**Tests** (`tests/units/entities/relationships/RelationshipType.spec.ts`):
- [ ] Create from string
- [ ] Validation (valid types)
- [ ] Validation (empty/invalid types)
- [ ] getGenderedTerm() for various genders
- [ ] inferGender() from gendered terms
- [ ] getReciprocal() for symmetric types
- [ ] getReciprocal() for asymmetric types with gender
- [ ] hasReciprocal() detection
- [ ] isFamilial() classification
- [ ] isProfessional() classification
- [ ] isSymmetric() detection
- [ ] Equality comparison

**Acceptance Criteria**:
- [ ] All tests pass (25+ test cases)
- [ ] 100% code coverage
- [ ] All relationship types from RelationshipHelpers supported
- [ ] Gender-aware terms match current behavior

---

#### Task 3.2: RelationshipReference (4 hours)
**Goal**: Implement relationship target reference (UID or name)

**Implementation**:
```typescript
// src/models/contactNote/entities/relationships/RelationshipReference.ts

export type ReferenceType = 'uid' | 'name';

/**
 * Reference to a contact (by UID or name)
 */
export class RelationshipReference {
  private readonly refType: ReferenceType;
  private readonly value: string;
  
  constructor(reference: string)
  
  // Factory methods
  static fromUID(uid: UID): RelationshipReference
  static fromName(name: string): RelationshipReference
  static fromString(ref: string): RelationshipReference
  
  // Type checking
  isUID(): boolean
  isName(): boolean
  getType(): ReferenceType
  
  // Access
  getValue(): string
  getUID(): UID | null  // If this is a UID reference
  getName(): string | null  // If this is a name reference
  
  // Serialization
  toFrontmatterValue(): string  // urn:uuid:... or [[name]]
  toMarkdownValue(): string
  
  // Validation
  isValid(): boolean
  
  // Comparison
  equals(other: RelationshipReference): boolean
}
```

**Tests** (`tests/units/entities/relationships/RelationshipReference.spec.ts`):
- [ ] Create from UID
- [ ] Create from name
- [ ] Parse urn:uuid: format
- [ ] Parse [[name]] format
- [ ] Parse plain string
- [ ] isUID() detection
- [ ] isName() detection
- [ ] getValue() returns correct value
- [ ] getUID() for UID references
- [ ] getName() for name references
- [ ] toFrontmatterValue() formatting
- [ ] toMarkdownValue() formatting
- [ ] Validation
- [ ] Equality comparison

**Acceptance Criteria**:
- [ ] All tests pass (18+ test cases)
- [ ] 100% code coverage
- [ ] Handles all reference formats from existing code
- [ ] Parses both UID and name references

---

#### Task 3.3: Relationship (8 hours)
**Goal**: Implement complete relationship entity

**Implementation**:
```typescript
// src/models/contactNote/entities/relationships/Relationship.ts

/**
 * Relationship entity representing connection between contacts
 */
export class Relationship {
  private readonly type: RelationshipType;
  private readonly targetRef: RelationshipReference;
  private resolvedContact?: Contact;  // Cached resolution
  
  constructor(type: RelationshipType | string, targetRef: RelationshipReference | string)
  
  // Factory methods
  static fromMarkdown(line: string): Relationship
  static fromFrontmatter(key: string, value: string): Relationship
  
  // Core access
  getType(): RelationshipType
  getTargetReference(): RelationshipReference
  getTargetName(): string
  
  // Resolution (requires ContactManager - will be implemented in Phase 3)
  async resolve(contactManager: any): Promise<Contact | null>
  isResolved(): boolean
  getResolvedContact(): Contact | null
  
  // Display
  getDisplayTerm(sourceGender: Gender): string
  inferTargetGender(): Gender | null
  
  // Reciprocal
  getReciprocal(sourceGender: Gender, sourceUID: UID): Relationship
  
  // Serialization
  toMarkdown(useResolvedName?: boolean): string
  toFrontmatter(): FrontmatterEntry
  
  // Validation
  validate(): ValidationResult
  
  // Comparison
  equals(other: Relationship): boolean
  hasSameTarget(other: Relationship): boolean
}
```

**Tests** (`tests/units/entities/relationships/Relationship.spec.ts`):
- [ ] Create from constructor (string values)
- [ ] Create from constructor (object values)
- [ ] Parse from markdown: "spouse [[Jane Doe]]"
- [ ] Parse from markdown: "parent urn:uuid:..."
- [ ] Parse from frontmatter: "RELATED.spouse: [[Jane]]"
- [ ] Parse from frontmatter: "RELATED.parent: urn:uuid:..."
- [ ] getType() returns RelationshipType
- [ ] getTargetReference() returns RelationshipReference
- [ ] getTargetName() extracts name
- [ ] getDisplayTerm() with different genders
- [ ] inferTargetGender() from gendered types
- [ ] getReciprocal() creates correct reciprocal
- [ ] toMarkdown() formatting
- [ ] toFrontmatter() formatting
- [ ] validate() accepts valid relationships
- [ ] validate() rejects invalid relationships
- [ ] equals() comparison
- [ ] hasSameTarget() comparison

**Acceptance Criteria**:
- [ ] All tests pass (30+ test cases)
- [ ] 100% code coverage
- [ ] Handles all relationship formats from existing code
- [ ] Compatible with current relationship parsing

---

### Week 4: Document Entities

#### Task 4.1: Frontmatter (6 hours)
**Goal**: Implement frontmatter as an entity

**Implementation**:
```typescript
// src/models/contactNote/entities/document/Frontmatter.ts

/**
 * Frontmatter entity representing YAML metadata
 */
export class Frontmatter {
  private readonly data: Record<string, any>;
  
  constructor(data?: Record<string, any>)
  
  // Factory methods
  static fromYAML(yamlString: string): Frontmatter
  static fromObject(obj: Record<string, any>): Frontmatter
  static empty(): Frontmatter
  
  // Access
  get(key: string): any
  getFlat(key: string): any  // Using dot notation (EMAIL.WORK)
  has(key: string): boolean
  hasFlat(key: string): boolean
  
  // Mutation (returns new Frontmatter - immutable pattern)
  set(key: string, value: any): Frontmatter
  setFlat(key: string, value: any): Frontmatter
  delete(key: string): Frontmatter
  deleteFlat(key: string): Frontmatter
  merge(other: Frontmatter): Frontmatter
  
  // Serialization
  toYAML(): string
  toObject(): Record<string, any>
  toFlatObject(): Record<string, any>
  
  // Querying
  getKeys(): string[]
  getFlatKeys(): string[]
  isEmpty(): boolean
  
  // Validation
  validate(): ValidationResult
  
  // Specific field access (convenience methods)
  getUID(): UID | null
  getName(): string | null
  getGender(): Gender | null
  getRevision(): Revision | null
}
```

**Tests** (`tests/units/entities/document/Frontmatter.spec.ts`):
- [ ] Create empty
- [ ] Create from object
- [ ] Parse from YAML string
- [ ] get() retrieves values
- [ ] getFlat() with dot notation
- [ ] has() checks existence
- [ ] set() creates new instance (immutability)
- [ ] setFlat() with dot notation
- [ ] delete() removes key
- [ ] merge() combines frontmatters
- [ ] toYAML() generates valid YAML
- [ ] toObject() returns clean object
- [ ] toFlatObject() flattens nested structure
- [ ] getKeys() lists keys
- [ ] Convenience methods (getUID, getName, etc.)
- [ ] Validation

**Acceptance Criteria**:
- [ ] All tests pass (25+ test cases)
- [ ] 100% code coverage
- [ ] Immutable operations
- [ ] Compatible with yaml and flat libraries

---

#### Task 4.2: MarkdownSection Base (4 hours)
**Goal**: Create abstract base for markdown sections

**Implementation**:
```typescript
// src/models/contactNote/entities/document/MarkdownSection.ts

/**
 * Abstract base class for markdown sections
 */
export abstract class MarkdownSection {
  protected readonly name: string;
  protected readonly level: number;
  protected readonly content: string;
  
  constructor(name: string, level: number, content: string)
  
  // Abstract methods
  abstract parse(): any;  // Parse section content
  abstract toMarkdown(): string;  // Render to markdown
  
  // Concrete methods
  getName(): string
  getLevel(): number
  getContent(): string
  getHeading(): string  // e.g., "## Related"
  
  // Validation
  abstract validate(): ValidationResult;
  
  // Factory
  static fromContent(name: string, level: number, content: string): MarkdownSection;
}
```

**Tests** (`tests/units/entities/document/MarkdownSection.spec.ts`):
- [ ] Abstract class cannot be instantiated
- [ ] Common methods work in subclasses
- [ ] getHeading() generates correct markdown heading
- [ ] Subclass contract enforcement

**Acceptance Criteria**:
- [ ] All tests pass (6+ test cases)
- [ ] Clear interface for subclasses
- [ ] Heading level handling (##, ###, etc.)

---

#### Task 4.3: RelatedSection (6 hours)
**Goal**: Implement Related section with relationship parsing

**Implementation**:
```typescript
// src/models/contactNote/entities/document/RelatedSection.ts

/**
 * Related section containing relationships
 */
export class RelatedSection extends MarkdownSection {
  private relationships: Relationship[];
  
  constructor(relationships: Relationship[], level?: number)
  
  // Factory methods
  static fromMarkdown(content: string, level?: number): RelatedSection
  static fromRelationships(relationships: Relationship[], level?: number): RelatedSection
  static empty(level?: number): RelatedSection
  
  // Implementation of abstract methods
  parse(): Relationship[]
  toMarkdown(): string
  validate(): ValidationResult
  
  // Relationship access
  getRelationships(): Relationship[]
  hasRelationships(): boolean
  getRelationshipCount(): number
  
  // Relationship manipulation (returns new instance)
  addRelationship(rel: Relationship): RelatedSection
  removeRelationship(rel: Relationship): RelatedSection
  setRelationships(rels: Relationship[]): RelatedSection
  
  // Queries
  findByType(type: string): Relationship[]
  findByTarget(targetRef: RelationshipReference): Relationship | null
  hasType(type: string): boolean
}
```

**Tests** (`tests/units/entities/document/RelatedSection.spec.ts`):
- [ ] Create empty
- [ ] Create from relationships
- [ ] Parse from markdown (various formats)
- [ ] parse() extracts relationships
- [ ] toMarkdown() generates correct format
- [ ] validate() checks relationships
- [ ] getRelationships() returns all
- [ ] addRelationship() adds new (immutable)
- [ ] removeRelationship() removes (immutable)
- [ ] setRelationships() replaces all
- [ ] findByType() filters
- [ ] findByTarget() locates specific
- [ ] hasType() checks existence
- [ ] Empty section handling
- [ ] Multiple relationships of same type

**Acceptance Criteria**:
- [ ] All tests pass (20+ test cases)
- [ ] 100% code coverage
- [ ] Immutable operations
- [ ] Handles all relationship formats

---

#### Task 4.4: ContactSection (6 hours)
**Goal**: Implement Contact section with field parsing

**Implementation**:
```typescript
// src/models/contactNote/entities/document/ContactSection.ts

/**
 * Contact section containing contact fields
 */
export class ContactSection extends MarkdownSection {
  private fields: ContactField[];
  
  constructor(fields: ContactField[], level?: number)
  
  // Factory methods
  static fromMarkdown(content: string, level?: number): ContactSection
  static fromFields(fields: ContactField[], level?: number): ContactSection
  static fromFrontmatter(frontmatter: Frontmatter, level?: number): ContactSection
  static empty(level?: number): ContactSection
  
  // Implementation
  parse(): ContactField[]
  toMarkdown(): string
  validate(): ValidationResult
  
  // Field access
  getFields(): ContactField[]
  hasFields(): boolean
  getFieldCount(): number
  
  // Field manipulation (returns new instance)
  addField(field: ContactField): ContactSection
  removeField(field: ContactField): ContactSection
  setFields(fields: ContactField[]): ContactSection
  
  // Queries
  findByType(type: string): ContactField[]
  findByLabel(label: string): ContactField | null
  getEmails(): EmailField[]
  getTelephones(): TelephoneField[]
  getAddresses(): AddressField[]
  getUrls(): UrlField[]
  
  // Grouping (for display)
  groupByType(): Map<string, ContactField[]>
}
```

**Tests** (`tests/units/entities/document/ContactSection.spec.ts`):
- [ ] Create empty
- [ ] Create from fields
- [ ] Create from frontmatter
- [ ] Parse from markdown
- [ ] parse() extracts fields
- [ ] toMarkdown() generates correct format
- [ ] validate() checks all fields
- [ ] getFields() returns all
- [ ] addField() adds new (immutable)
- [ ] removeField() removes (immutable)
- [ ] setFields() replaces all
- [ ] findByType() filters
- [ ] findByLabel() locates specific
- [ ] Type-specific getters
- [ ] groupByType() organizes fields
- [ ] Empty section handling
- [ ] Multiple fields of same type

**Acceptance Criteria**:
- [ ] All tests pass (25+ test cases)
- [ ] 100% code coverage
- [ ] Immutable operations
- [ ] Compatible with existing Contact section format

---

### Week 4: Integration & Documentation

#### Task 4.5: Integration Tests (8 hours)
**Goal**: Test entities working together

**Tests to Create**:

1. **Field Integration** (`tests/units/entities/integration/fields.spec.ts`):
   - [ ] Create all field types and serialize to frontmatter
   - [ ] Parse frontmatter and create all field types
   - [ ] Round-trip: frontmatter → fields → frontmatter
   - [ ] Round-trip: markdown → fields → markdown

2. **Relationship Integration** (`tests/units/entities/integration/relationships.spec.ts`):
   - [ ] Create relationships with all reference types
   - [ ] Relationship with RelationshipType and RelationshipReference
   - [ ] Round-trip: markdown → relationship → markdown
   - [ ] Round-trip: frontmatter → relationship → frontmatter
   - [ ] Reciprocal relationship creation

3. **Section Integration** (`tests/units/entities/integration/sections.spec.ts`):
   - [ ] RelatedSection with multiple relationships
   - [ ] ContactSection with multiple fields
   - [ ] Section → markdown → parse → section
   - [ ] Empty sections handle correctly

4. **Document Integration** (`tests/units/entities/integration/document.spec.ts`):
   - [ ] Frontmatter + RelatedSection + ContactSection
   - [ ] Complete document round-trip
   - [ ] Field changes reflected in sections
   - [ ] Relationship changes reflected in sections

**Acceptance Criteria**:
- [ ] All integration tests pass (40+ test cases)
- [ ] Tests demonstrate entities working together
- [ ] No dependencies on operation classes
- [ ] Round-trip conversions work correctly

---

#### Task 4.6: Performance Benchmarks (6 hours)
**Goal**: Establish baseline performance metrics

**Benchmarks to Create** (`tests/performance/entities/`):

1. **Field Parsing** (`field-parsing.bench.ts`):
   - Parse 1000 email fields from markdown
   - Parse 1000 email fields from frontmatter
   - Serialize 1000 email fields to markdown
   - Serialize 1000 email fields to frontmatter

2. **Relationship Parsing** (`relationship-parsing.bench.ts`):
   - Parse 1000 relationships from markdown
   - Parse 1000 relationships from frontmatter
   - Create 1000 reciprocal relationships

3. **Section Operations** (`section-operations.bench.ts`):
   - Parse RelatedSection with 100 relationships
   - Parse ContactSection with 100 fields
   - Render sections to markdown

4. **Memory Usage** (`memory-usage.bench.ts`):
   - Create 10,000 field instances
   - Create 10,000 relationship instances
   - Measure memory footprint

**Acceptance Criteria**:
- [ ] Benchmarks run successfully
- [ ] Results documented
- [ ] Performance comparable or better than operations
- [ ] No memory leaks detected

---

#### Task 4.7: Documentation (8 hours)
**Goal**: Document all entities comprehensively

**Documentation to Create**:

1. **Entity Reference** (`docs/development/entities.md`):
   - Overview of entity architecture
   - Entity hierarchy diagrams
   - Design patterns used (Value Objects, Entities, etc.)
   - Best practices for using entities

2. **API Documentation**:
   - JSDoc comments for all public methods (already in code)
   - Generate API docs with TypeDoc
   - Publish to docs site

3. **Migration Guide** (`docs/development/entity-migration-guide.md`):
   - How to use new entities
   - Examples for common operations
   - Comparison with old operations approach
   - FAQ for developers

4. **Entity Examples** (`docs/examples/entities/`):
   - Working with fields
   - Working with relationships
   - Working with sections
   - Complete document operations

**Acceptance Criteria**:
- [ ] All entities have JSDoc comments
- [ ] Reference documentation complete
- [ ] API docs generated
- [ ] Migration guide published
- [ ] Examples tested and working

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage for all entity code
- **Integration Tests**: 50+ test cases showing entities working together
- **Performance Tests**: Benchmarks for all critical operations

### Test Organization

```
tests/
├── units/
│   └── entities/
│       ├── valueObjects/
│       │   ├── Gender.spec.ts
│       │   ├── UID.spec.ts
│       │   └── Revision.spec.ts
│       ├── fields/
│       │   ├── ContactField.spec.ts
│       │   ├── EmailField.spec.ts
│       │   ├── TelephoneField.spec.ts
│       │   ├── AddressField.spec.ts
│       │   └── UrlField.spec.ts
│       ├── relationships/
│       │   ├── RelationshipType.spec.ts
│       │   ├── RelationshipReference.spec.ts
│       │   └── Relationship.spec.ts
│       ├── document/
│       │   ├── Frontmatter.spec.ts
│       │   ├── MarkdownSection.spec.ts
│       │   ├── RelatedSection.spec.ts
│       │   └── ContactSection.spec.ts
│       └── integration/
│           ├── fields.spec.ts
│           ├── relationships.spec.ts
│           ├── sections.spec.ts
│           └── document.spec.ts
└── performance/
    └── entities/
        ├── field-parsing.bench.ts
        ├── relationship-parsing.bench.ts
        ├── section-operations.bench.ts
        └── memory-usage.bench.ts
```

### Testing Tools

- **Vitest**: Unit and integration testing
- **Benchmark.js** or **Vitest bench**: Performance testing
- **TypeScript**: Type checking as part of tests
- **Coverage**: Istanbul/c8 for coverage reports

---

## Success Criteria

### Code Quality
- [ ] All tests pass (200+ test cases total)
- [ ] 80%+ code coverage on entities
- [ ] No TypeScript errors
- [ ] ESLint passes with no warnings
- [ ] All public methods have JSDoc comments

### Functionality
- [ ] All entities can be created and validated
- [ ] Round-trip conversions work (markdown ↔ entities ↔ frontmatter)
- [ ] Integration tests demonstrate entities working together
- [ ] Performance meets or exceeds current implementation

### Documentation
- [ ] All entities documented
- [ ] Migration guide complete
- [ ] API documentation generated
- [ ] Examples provided and tested

### No Breaking Changes
- [ ] No modifications to existing operation classes
- [ ] No changes to ContactNote public API
- [ ] All existing tests still pass
- [ ] Plugin builds and runs successfully

---

## Risk Management

### Risk 1: Performance Regression
**Likelihood**: Medium  
**Impact**: High  
**Mitigation**:
- Run benchmarks early (Week 2)
- Compare with current implementation
- Optimize hot paths if needed
- Consider caching strategies

### Risk 2: Incomplete Coverage
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**:
- Track coverage from day 1
- Set coverage gates in CI
- Review coverage reports weekly
- Add tests for edge cases

### Risk 3: Design Flaws
**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**:
- Start with simplest entities (value objects)
- Review design after Week 1
- Prototype Contact entity integration early
- Be willing to refactor if needed

### Risk 4: Scope Creep
**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**:
- Stick to defined scope
- Defer Contact entity to Phase 3
- No modifications to existing code
- Track tasks daily

---

## Dependencies & Constraints

### External Dependencies
- `yaml`: YAML parsing (already in use)
- `flat`: Object flattening (already in use)
- `marked`: Markdown parsing (already in use)
- `vitest`: Testing framework (already in use)

### Internal Dependencies
- No dependencies on operation classes
- Can reference shared types and constants
- Can use utility functions (marked, parseYaml, etc.)

### Constraints
- No breaking changes to existing code
- Must maintain backward compatibility
- All entities must be immutable or use immutable patterns
- Performance must be comparable or better

---

## Validation & Review

### Weekly Checkpoints

**Week 1 Review**:
- [ ] Value objects complete and tested
- [ ] Coverage >80% on value objects
- [ ] Performance benchmarks baseline established
- [ ] Design review: Are patterns working?

**Week 2 Review**:
- [ ] All field entities complete and tested
- [ ] Integration tests for fields passing
- [ ] Coverage >80% on fields
- [ ] Review: Field hierarchy working well?

**Week 3 Review**:
- [ ] Relationship entities complete and tested
- [ ] Integration tests for relationships passing
- [ ] Coverage >80% on relationships
- [ ] Review: Gender-aware logic correct?

**Week 4 Review**:
- [ ] Document entities complete and tested
- [ ] All integration tests passing
- [ ] Performance benchmarks complete
- [ ] Documentation complete
- [ ] Final review: Ready for Phase 3?

### Final Phase 2 Validation

Before proceeding to Phase 3:
- [ ] All acceptance criteria met
- [ ] 200+ test cases passing
- [ ] 80%+ coverage on entity code
- [ ] Performance benchmarks satisfactory
- [ ] Documentation complete
- [ ] No breaking changes to existing code
- [ ] Stakeholder sign-off

---

## Deliverables Summary

### Code Deliverables
1. ✅ 15+ entity class files
2. ✅ 200+ unit tests
3. ✅ 40+ integration tests
4. ✅ 4 performance benchmarks
5. ✅ Complete test coverage reports

### Documentation Deliverables
1. ✅ Entity reference documentation
2. ✅ API documentation (TypeDoc)
3. ✅ Migration guide
4. ✅ Code examples
5. ✅ This implementation plan

### Quality Deliverables
1. ✅ 80%+ code coverage
2. ✅ All tests passing
3. ✅ No TypeScript errors
4. ✅ ESLint passing
5. ✅ Performance benchmarks

---

## Next Steps After Phase 2

Once Phase 2 is complete, we will proceed to **Phase 3: Gradual Migration**:

1. **Week 1-2**: Migrate ContactNote methods to use new entities
   - Start with simple methods (getUID, getGender, etc.)
   - Replace operation class calls with entity methods
   - Maintain backward compatibility

2. **Week 3-4**: Implement Contact entity
   - Create Contact class using all the entities from Phase 2
   - Integrate with ContactManager
   - Add Contact tests

3. **Week 5-6**: Replace operation class usage
   - Deprecate operation classes
   - Update all callers to use entities
   - Add deprecation warnings

4. **Week 7-8**: Testing and refinement
   - Comprehensive testing
   - Performance optimization
   - Documentation updates

Then **Phase 4: Consolidation** will remove deprecated code.

---

## Appendix: Design Patterns Used

### Value Objects
- **Gender**, **UID**, **Revision**
- Immutable
- Equality by value
- No identity

### Entities
- **ContactField** subtypes, **Relationship**, **MarkdownSection** subtypes
- Identity (by content or type)
- Mutable state (but using immutable operations pattern)
- Rich behavior

### Factory Methods
- `static fromMarkdown()`, `static fromFrontmatter()`
- Encapsulate complex construction
- Named constructors for clarity

### Immutable Operations
- Methods return new instances instead of mutating
- Example: `frontmatter.set(key, value)` returns new Frontmatter
- Prevents side effects
- Easier to reason about

### Template Method
- **ContactField** and **MarkdownSection** as abstract bases
- Define algorithm structure
- Subclasses implement specific steps

---

**Status**: Ready for Implementation  
**Duration**: 3-4 weeks  
**Team Size**: 1-2 developers  
**Next Review**: After Week 1 completion
