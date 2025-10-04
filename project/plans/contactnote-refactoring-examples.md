# ContactNote Refactoring: Concrete Examples

## Overview

This document provides concrete code examples comparing the **current functional/operations-based approach** with the **proposed model-based approach** to help visualize the refactoring.

## Example 1: Working with a Relationship

### Current Approach (Functional/Operations)

To understand and work with a relationship, you must interact with multiple operation classes:

```typescript
// Current: Scattered across multiple operations files

// In ContactNote.ts - facade methods
class ContactNote {
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    return this.relationshipOps.parseRelatedSection();
  }
  
  async updateRelatedSection(rels: { type: string; contactName: string }[]): Promise<void> {
    return this.relationshipOps.updateRelatedSectionInContent(rels);
  }
  
  async syncRelationships(): Promise<SyncResult> {
    return this.syncOps.syncRelatedListToFrontmatter();
  }
  
  async createBidirectionalRelationship(targetUID: string, type: string): Promise<void> {
    return this.advancedRelationshipOps.createBidirectionalRelationship(targetUID, type);
  }
  
  getGenderedTerm(type: string, gender: Gender): string {
    return this.relationshipOps.getGenderedRelationshipTerm(type, gender);
  }
  
  getReciprocalType(type: string, gender?: Gender): string | null {
    return this.relationshipHelpers.getReciprocalRelationshipType(type, gender);
  }
}

// In RelationshipOperations.ts - parsing and rendering
class RelationshipOperations {
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    // Parse markdown list items
    // Extract type and contact name
    // Return array of relationships
  }
  
  async updateRelatedSectionInContent(relationships: Array<{type: string; contactName: string}>): Promise<void> {
    // Generate markdown for Related section
    // Update content
  }
  
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    // Look up gender-specific term
  }
}

// In SyncOperations.ts - frontmatter synchronization
class SyncOperations {
  async syncRelatedListToFrontmatter(): Promise<SyncResult> {
    // Parse markdown relationships
    // Update frontmatter RELATED fields
    // Handle errors
  }
  
  async syncFrontmatterToRelatedList(): Promise<SyncResult> {
    // Parse frontmatter RELATED fields
    // Update markdown Related section
    // Handle errors
  }
}

// In AdvancedRelationshipOperations.ts - bidirectional relationships
class AdvancedRelationshipOperations {
  async createBidirectionalRelationship(targetUID: string, relationshipType: string): Promise<void> {
    // Resolve target contact
    // Add relationship to source
    // Add reciprocal relationship to target
    // Sync both contacts
  }
}

// In RelationshipHelpers.ts - utility functions
class RelationshipHelpers {
  getReciprocalRelationshipType(relationshipType: string, targetGender?: Gender): string | null {
    // Look up reciprocal relationship
  }
}

// Usage example: Add a bidirectional relationship
async function addSpouse(contact: ContactNote, spouseUID: string) {
  // Step 1: Create bidirectional relationship (touches 3 files internally)
  await contact.createBidirectionalRelationship(spouseUID, 'spouse');
  
  // Step 2: Verify relationship was added (touches 1 file)
  const relationships = await contact.parseRelatedSection();
  
  // Step 3: Sync to frontmatter (touches 2 files)
  await contact.syncRelationships();
}
```

**Problems:**
- Relationship logic scattered across 5+ files
- No single "Relationship" entity to reason about
- Hard to test relationship behavior in isolation
- Mixed abstraction levels (parsing + business logic)

### Proposed Approach (Model-Based)

With the model-based approach, Relationship is a first-class entity:

```typescript
// Proposed: Centralized in Relationship.ts

class Relationship {
  private type: RelationshipType;
  private targetRef: RelationshipReference;
  private targetContact?: Contact;
  
  constructor(type: string, targetRef: string) {
    this.type = new RelationshipType(type);
    this.targetRef = new RelationshipReference(targetRef);
  }
  
  // Factory methods
  static fromMarkdown(line: string): Relationship {
    // Parse: "spouse [[John Doe]]" or "parent urn:uuid:123..."
    const parsed = this.parseMarkdownLine(line);
    return new Relationship(parsed.type, parsed.targetRef);
  }
  
  static fromFrontmatter(key: string, value: string): Relationship {
    // Parse: "RELATED.spouse: urn:uuid:123..." or "RELATED.parent: [[John]]"
    return new Relationship(key, value);
  }
  
  // Resolution
  async resolve(contactManager: ContactManager): Promise<Contact | null> {
    if (this.targetContact) return this.targetContact;
    
    if (this.targetRef.isUID()) {
      this.targetContact = await contactManager.findByUID(this.targetRef.getValue());
    } else {
      this.targetContact = await contactManager.findByName(this.targetRef.getValue());
    }
    
    return this.targetContact;
  }
  
  // Gender-aware display
  getDisplayTerm(sourceGender: Gender): string {
    return this.type.getGenderedTerm(sourceGender);
  }
  
  // Reciprocal relationship
  getReciprocal(sourceGender: Gender): Relationship {
    const reciprocalType = this.type.getReciprocal(sourceGender);
    // Use source contact's UID as target reference
    return new Relationship(reciprocalType, this.sourceUID);
  }
  
  // Serialization
  toMarkdown(useNames: boolean = true): string {
    const targetDisplay = useNames && this.targetContact 
      ? this.targetContact.getDisplayName()
      : this.targetRef.getValue();
    return `- ${this.type.getValue()} [[${targetDisplay}]]`;
  }
  
  toFrontmatter(): [string, string] {
    const key = `RELATED.${this.type.getValue()}`;
    const value = this.targetRef.toFrontmatterValue();
    return [key, value];
  }
  
  // Validation
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.type.isValid()) {
      errors.push('Invalid relationship type');
    }
    
    if (!this.targetRef.isValid()) {
      errors.push('Invalid target reference');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Supporting classes in same file
class RelationshipType {
  constructor(private type: string) {}
  
  getValue(): string { return this.type; }
  
  getGenderedTerm(gender: Gender): string {
    const genderMap = GENDERED_TERMS[this.type];
    if (!genderMap) return this.type;
    return genderMap[gender] || this.type;
  }
  
  getReciprocal(targetGender: Gender): string {
    const reciprocalMap = RECIPROCAL_TYPES[this.type];
    if (typeof reciprocalMap === 'string') {
      return reciprocalMap;
    }
    return reciprocalMap[targetGender] || reciprocalMap.default;
  }
  
  isValid(): boolean {
    return this.type.length > 0;
  }
}

class RelationshipReference {
  private refType: 'uid' | 'name';
  private value: string;
  
  constructor(ref: string) {
    const parsed = this.parse(ref);
    this.refType = parsed.type;
    this.value = parsed.value;
  }
  
  isUID(): boolean { return this.refType === 'uid'; }
  isName(): boolean { return this.refType === 'name'; }
  getValue(): string { return this.value; }
  
  toFrontmatterValue(): string {
    if (this.refType === 'uid') {
      return `urn:uuid:${this.value}`;
    }
    return `[[${this.value}]]`;
  }
  
  private parse(ref: string): { type: 'uid' | 'name', value: string } {
    if (ref.startsWith('urn:uuid:')) {
      return { type: 'uid', value: ref.replace('urn:uuid:', '') };
    }
    // Strip [[ ]] if present
    const cleaned = ref.replace(/[\[\]]/g, '');
    return { type: 'name', value: cleaned };
  }
  
  isValid(): boolean {
    return this.value.length > 0;
  }
}

// Usage example: Add a bidirectional relationship
async function addSpouse(contact: Contact, spouseUID: string) {
  // Step 1: Create relationships
  const relationship = new Relationship('spouse', spouseUID);
  
  // Step 2: Validate
  if (!relationship.validate().isValid) {
    throw new Error('Invalid relationship');
  }
  
  // Step 3: Add to contact
  contact.addRelationship(relationship);
  
  // Step 4: Create reciprocal (if bidirectional)
  const spouse = await relationship.resolve(contactManager);
  if (spouse) {
    const reciprocal = relationship.getReciprocal(contact.getGender());
    spouse.addRelationship(reciprocal);
    await spouse.save();
  }
  
  // Step 5: Save
  await contact.save();
}
```

**Benefits:**
- All relationship logic in one file (`Relationship.ts`)
- Can test Relationship in isolation
- Clear entity with well-defined behavior
- Self-documenting structure
- Easy to extend (just add methods to Relationship)

## Example 2: Working with Contact Fields

### Current Approach (Functional/Operations)

Contact field logic is primarily in `ContactSectionOperations`:

```typescript
// Current: In ContactSectionOperations.ts (810 lines)

class ContactSectionOperations extends BaseMarkdownSectionOperations {
  // Parse Contact section
  async parseContactSection(): Promise<ParsedContactField[]> {
    const section = await this.extractSection(SECTION_NAMES.CONTACT);
    if (!section) return [];
    
    const fields: ParsedContactField[] = [];
    const lines = section.split('\n');
    
    for (const line of lines) {
      const field = this.parseContactLine(line);
      if (field) fields.push(field);
    }
    
    return fields;
  }
  
  // Parse individual line
  private parseContactLine(line: string): ParsedContactField | null {
    // Complex parsing logic for different field types
    // EMAIL, TEL, ADR, URL each have different formats
    // Returns generic ParsedContactField
  }
  
  // Generate Contact section
  async generateContactSection(frontmatter: Record<string, any>): Promise<string> {
    // Extract fields from frontmatter
    // Group by type
    // Format for display
    // Return markdown string
  }
  
  // Sync from frontmatter to Contact section
  async syncFrontmatterToContactSection(): Promise<void> {
    // Parse frontmatter
    // Generate Contact section
    // Update content
  }
  
  // Sync from Contact section to frontmatter
  async syncContactSectionToFrontmatter(): Promise<void> {
    // Parse Contact section
    // Update frontmatter fields
    // Write back
  }
  
  // Validate fields
  validateContactFields(fields: any[]): string[] {
    // Validate each field type
    // Different rules for EMAIL, TEL, ADR, URL
  }
}

// Usage: Add an email address
async function addEmail(contact: ContactNote, email: string, label: string) {
  // Get current frontmatter
  const fm = await contact.getFrontmatter();
  
  // Manually construct the key
  const key = `EMAIL.${label}`;
  
  // Set in frontmatter
  fm[key] = email;
  await contact.updateFrontmatter(fm);
  
  // Sync to Contact section
  const ops = contact.contactSectionOps;
  await ops.syncFrontmatterToContactSection();
}
```

**Problems:**
- No EmailField, TelephoneField, etc. entities
- Validation logic mixed with parsing logic
- Hard to extend with new field types
- Testing requires full ContactNote setup

### Proposed Approach (Model-Based)

```typescript
// Proposed: ContactField.ts and subtypes

abstract class ContactField {
  constructor(
    protected label: string,
    protected value: string
  ) {}
  
  abstract getType(): string;
  abstract validate(): ValidationResult;
  abstract toFrontmatter(): [string, string];
  abstract toMarkdown(): string;
  
  getLabel(): string { return this.label; }
  getValue(): string { return this.value; }
  setValue(value: string): void { this.value = value; }
}

class EmailField extends ContactField {
  constructor(label: string, email: string) {
    super(label, email);
  }
  
  getType(): string {
    return 'EMAIL';
  }
  
  validate(): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(this.value);
    
    return {
      isValid,
      errors: isValid ? [] : ['Invalid email format']
    };
  }
  
  toFrontmatter(): [string, string] {
    return [`EMAIL.${this.label}`, this.value];
  }
  
  toMarkdown(): string {
    return `- ${this.label}: ${this.value}`;
  }
  
  // Email-specific methods
  getDomain(): string {
    return this.value.split('@')[1];
  }
  
  isWorkEmail(): boolean {
    return this.label.toLowerCase() === 'work';
  }
}

class TelephoneField extends ContactField {
  constructor(label: string, number: string) {
    super(label, number);
  }
  
  getType(): string {
    return 'TEL';
  }
  
  validate(): ValidationResult {
    // Phone number validation
    const cleaned = this.value.replace(/[\s\-\(\)\.]/g, '');
    const isValid = /^[\+]?[0-9]{7,15}$/.test(cleaned);
    
    return {
      isValid,
      errors: isValid ? [] : ['Invalid phone number format']
    };
  }
  
  toFrontmatter(): [string, string] {
    return [`TEL.${this.label}`, this.value];
  }
  
  toMarkdown(): string {
    return `- ${this.label}: ${this.value}`;
  }
  
  // Telephone-specific methods
  format(style: 'us' | 'international'): string {
    // Format phone number based on style
  }
  
  isMobile(): boolean {
    return ['CELL', 'MOBILE'].includes(this.label.toUpperCase());
  }
}

class AddressField extends ContactField {
  private street?: string;
  private city?: string;
  private state?: string;
  private postal?: string;
  private country?: string;
  
  constructor(label: string, components: AddressComponents) {
    super(label, AddressField.formatAddress(components));
    this.street = components.street;
    this.city = components.city;
    this.state = components.state;
    this.postal = components.postal;
    this.country = components.country;
  }
  
  getType(): string {
    return 'ADR';
  }
  
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.street && !this.city) {
      errors.push('Address must have at least street or city');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  toFrontmatter(): [string, string][] {
    const entries: [string, string][] = [];
    const base = `ADR.${this.label}`;
    
    if (this.street) entries.push([`${base}.STREET`, this.street]);
    if (this.city) entries.push([`${base}.LOCALITY`, this.city]);
    if (this.state) entries.push([`${base}.REGION`, this.state]);
    if (this.postal) entries.push([`${base}.POSTAL`, this.postal]);
    if (this.country) entries.push([`${base}.COUNTRY`, this.country]);
    
    return entries;
  }
  
  toMarkdown(): string {
    const parts: string[] = [];
    if (this.street) parts.push(this.street);
    if (this.city && this.state && this.postal) {
      parts.push(`${this.city}, ${this.state} ${this.postal}`);
    } else if (this.city) {
      parts.push(this.city);
    }
    if (this.country) parts.push(this.country);
    
    return `- ${this.label}:\n  ${parts.join('\n  ')}`;
  }
  
  private static formatAddress(components: AddressComponents): string {
    // Combine components into single string
  }
  
  // Address-specific methods
  getStreet(): string | undefined { return this.street; }
  getCity(): string | undefined { return this.city; }
  isComplete(): boolean {
    return !!(this.street && this.city && this.state && this.postal);
  }
}

class UrlField extends ContactField {
  getType(): string {
    return 'URL';
  }
  
  validate(): ValidationResult {
    try {
      new URL(this.value);
      return { isValid: true, errors: [] };
    } catch {
      return { isValid: false, errors: ['Invalid URL format'] };
    }
  }
  
  toFrontmatter(): [string, string] {
    return [`URL.${this.label}`, this.value];
  }
  
  toMarkdown(): string {
    return `- ${this.label}: ${this.value}`;
  }
  
  // URL-specific methods
  getDomain(): string {
    return new URL(this.value).hostname;
  }
  
  isSecure(): boolean {
    return this.value.startsWith('https://');
  }
}

// Factory for creating fields
class ContactFieldFactory {
  static fromFrontmatter(key: string, value: string): ContactField {
    const [type, label] = key.split('.');
    
    switch (type) {
      case 'EMAIL':
        return new EmailField(label, value);
      case 'TEL':
        return new TelephoneField(label, value);
      case 'URL':
        return new UrlField(label, value);
      case 'ADR':
        // Parse address components
        return new AddressField(label, this.parseAddressComponents(key, value));
      default:
        throw new Error(`Unknown field type: ${type}`);
    }
  }
  
  static fromMarkdown(line: string): ContactField {
    const type = identifyFieldType(line);
    const parsed = parseContactListItem(line);
    
    switch (type) {
      case 'EMAIL':
        return new EmailField(parsed.label, parsed.value);
      case 'TEL':
        return new TelephoneField(parsed.label, parsed.value);
      case 'URL':
        return new UrlField(parsed.label, parsed.value);
      case 'ADR':
        return new AddressField(parsed.label, parsed.components);
      default:
        throw new Error(`Unknown field type: ${type}`);
    }
  }
}

// Usage: Add an email address
async function addEmail(contact: Contact, email: string, label: string) {
  // Create field
  const emailField = new EmailField(label, email);
  
  // Validate
  const validation = emailField.validate();
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // Add to contact
  contact.addField(emailField);
  
  // Save (handles frontmatter + markdown sync automatically)
  await contact.save();
}

// Testing is much easier
describe('EmailField', () => {
  it('should validate email format', () => {
    const field = new EmailField('WORK', 'test@example.com');
    const result = field.validate();
    expect(result.isValid).toBe(true);
  });
  
  it('should reject invalid email', () => {
    const field = new EmailField('WORK', 'not-an-email');
    const result = field.validate();
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid email format');
  });
  
  it('should extract domain', () => {
    const field = new EmailField('WORK', 'john@company.com');
    expect(field.getDomain()).toBe('company.com');
  });
});
```

**Benefits:**
- Each field type is a concrete entity
- Type-specific validation and behavior
- Easy to test in isolation
- Easy to add new field types (just extend ContactField)
- Self-documenting code

## Example 3: Contact Lifecycle

### Current Approach

```typescript
// Current: Scattered lifecycle management

// Creating a contact
const file = app.vault.getAbstractFileByPath('Contacts/John Doe.md');
const contact = new ContactNote(app, settings, file);

// Reading data
const uid = await contact.getUID();
const name = await contact.getDisplayName();
const frontmatter = await contact.getFrontmatter();
const relationships = await contact.parseRelatedSection();

// Modifying data
const newFm = { ...frontmatter, EMAIL: { WORK: 'new@example.com' } };
await contact.updateFrontmatter(newFm);
await contact.syncFrontmatterToContactSection();

// Saving (implicit through operations)
// No clear save() method - operations modify file directly
```

### Proposed Approach

```typescript
// Proposed: Clear lifecycle

// Creating a new contact
const contact = await Contact.create({
  name: 'John Doe',
  uid: 'john-doe-123'
});

// Or loading existing
const contact = await Contact.fromFile(file);

// Reading data (immutable access)
const uid = contact.getUID();
const name = contact.getDisplayName();
const relationships = contact.getRelationships();
const email = contact.getField('EMAIL', 'WORK');

// Modifying data (mutable operations)
contact.addField(new EmailField('WORK', 'new@example.com'));
contact.addRelationship(new Relationship('spouse', spouseUID));
contact.setGender('male');

// Validation
const validation = contact.validate();
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}

// Saving (explicit, handles all syncing internally)
await contact.save();

// Deleting
await contact.delete();
```

**Benefits:**
- Clear lifecycle: create → modify → validate → save
- Explicit operations vs. implicit side effects
- Validation before save
- Easier to reason about state changes

## Example 4: Testing

### Current Approach

```typescript
// Current: Must set up entire ContactNote infrastructure

describe('Relationship operations', () => {
  let contact: ContactNote;
  let mockApp: App;
  let mockSettings: ContactsPluginSettings;
  let mockFile: TFile;
  
  beforeEach(() => {
    // Complex setup
    mockApp = createMockApp();
    mockSettings = createMockSettings();
    mockFile = createMockFile();
    contact = new ContactNote(mockApp, mockSettings, mockFile);
  });
  
  it('should parse relationship from markdown', async () => {
    // Must mock file content
    mockFile.vault.read = jest.fn().mockResolvedValue(`
---
FN: Test Contact
---
## Related
- spouse [[Jane Doe]]
    `);
    
    const relationships = await contact.parseRelatedSection();
    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe('spouse');
  });
});
```

### Proposed Approach

```typescript
// Proposed: Test entities directly

describe('Relationship', () => {
  it('should parse from markdown format', () => {
    const rel = Relationship.fromMarkdown('spouse [[Jane Doe]]');
    
    expect(rel.getType()).toBe('spouse');
    expect(rel.getTargetName()).toBe('Jane Doe');
  });
  
  it('should validate correctly', () => {
    const valid = new Relationship('spouse', 'urn:uuid:123');
    expect(valid.validate().isValid).toBe(true);
    
    const invalid = new Relationship('', '');
    expect(invalid.validate().isValid).toBe(false);
  });
  
  it('should get gendered term', () => {
    const rel = new Relationship('parent', 'urn:uuid:123');
    expect(rel.getDisplayTerm('male')).toBe('father');
    expect(rel.getDisplayTerm('female')).toBe('mother');
  });
  
  it('should serialize to markdown', () => {
    const rel = new Relationship('spouse', 'Jane Doe');
    expect(rel.toMarkdown()).toBe('- spouse [[Jane Doe]]');
  });
});

describe('EmailField', () => {
  it('should validate email format', () => {
    const field = new EmailField('WORK', 'test@example.com');
    expect(field.validate().isValid).toBe(true);
  });
  
  it('should extract domain', () => {
    const field = new EmailField('WORK', 'john@company.com');
    expect(field.getDomain()).toBe('company.com');
  });
});

// Integration test with Contact
describe('Contact', () => {
  it('should manage fields', () => {
    const contact = new Contact({ name: 'Test', uid: '123' });
    
    const email = new EmailField('WORK', 'test@example.com');
    contact.addField(email);
    
    expect(contact.getFields()).toHaveLength(1);
    expect(contact.getField('EMAIL', 'WORK')).toBe(email);
  });
  
  it('should validate all fields', () => {
    const contact = new Contact({ name: 'Test', uid: '123' });
    contact.addField(new EmailField('WORK', 'invalid'));
    
    const validation = contact.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Invalid email format');
  });
});
```

**Benefits:**
- Unit tests for entities, no infrastructure needed
- Fast tests (no file I/O mocking)
- Clear test intent
- Easy to write comprehensive test suites

## Summary of Key Differences

| Aspect | Current (Functional) | Proposed (Model-Based) |
|--------|---------------------|------------------------|
| **Organization** | By operation type | By domain entity |
| **Classes** | Operations classes | Entity/Model classes |
| **To understand a Relationship** | Read 5 files | Read 1 file (Relationship.ts) |
| **To add email** | Manipulate frontmatter | `contact.addField(new EmailField(...))` |
| **Testing** | Mock entire infrastructure | Test entities directly |
| **Validation** | Scattered in operations | In entity methods |
| **Extensibility** | Add methods to operations | Add methods to entities |
| **Type Safety** | Generic types | Specific entity types |
| **Code Discovery** | Follow method calls | Follow entity hierarchy |

## Migration Path Example

### Step 1: Create Relationship Model (No Breaking Changes)

```typescript
// Add new Relationship.ts alongside existing code
// Old code continues working unchanged
```

### Step 2: Add Adapter (Backward Compatible)

```typescript
// In RelationshipOperations.ts
class RelationshipOperations {
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    // NEW: Use Relationship model internally
    const section = await this.extractSection('Related');
    const lines = section.split('\n');
    const relationships = lines
      .map(line => Relationship.fromMarkdown(line))
      .filter(rel => rel !== null);
    
    // Convert to old format for backward compatibility
    return relationships.map(rel => ({
      type: rel.getType(),
      contactName: rel.getTargetName(),
      // ... other fields
    }));
  }
}
```

### Step 3: Migrate Callers (Incremental)

```typescript
// Update ContactNote methods one at a time
class ContactNote {
  // NEW API (coexists with old)
  async getRelationships(): Promise<Relationship[]> {
    const section = await this.markdownDocument.getSection('Related');
    return section.parseRelationships();
  }
  
  // OLD API (still works, delegates to new)
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    const relationships = await this.getRelationships();
    return relationships.map(rel => rel.toOldFormat());
  }
}
```

### Step 4: Deprecate Old APIs

```typescript
/**
 * @deprecated Use getRelationships() instead
 */
async parseRelatedSection(): Promise<ParsedRelationship[]> {
  console.warn('parseRelatedSection is deprecated, use getRelationships');
  return this.getRelationships().then(rels => rels.map(r => r.toOldFormat()));
}
```

### Step 5: Remove Old Code

```typescript
// After all callers migrated, remove deprecated methods
// Remove old operation classes
// Clean up
```

## Conclusion

The model-based approach provides:
1. **Better organization** - Code organized by domain entities
2. **Easier testing** - Test entities in isolation
3. **Clearer intent** - Self-documenting entity models
4. **Better extensibility** - Add features to entities
5. **Stronger typing** - Concrete entity types
6. **Easier reasoning** - One file per entity

The migration can be done incrementally without breaking changes, reducing risk while delivering continuous value.
