## 🔗 vCard Relationships – VCF Contacts Obsidian Plugin

The VCF Contacts plugin provides comprehensive relationship management capabilities, allowing you to create, manage, and synchronize personal and professional connections between contacts using the vCard 4.0 RELATED field standard.

This document covers the relationship system architecture, supported relationship types, and usage patterns within the plugin.

---

### 📚 Table of Contents

- [🔗 vCard Relationships – VCF Contacts Obsidian Plugin](#-vcard-relationships--vcf-contacts-obsidian-plugin)
    - [📚 Table of Contents](#-table-of-contents)
    - [🏗️ Architecture Overview](#️-architecture-overview)
    - [🏷️ Supported Relationship Types](#️-supported-relationship-types)
        - [👪 Family Relationships](#-family-relationships)
        - [💼 Professional Relationships](#-professional-relationships)
        - [👥 Social Relationships](#-social-relationships)
    - [📊 Relationship Graph Management](#-relationship-graph-management)
        - [📍 Core Graph Operations](#-core-graph-operations)
        - [🔄 Relationship Consistency](#-relationship-consistency)
        - [🎯 Reciprocal Relationships](#-reciprocal-relationships)
    - [📋 vCard RELATED Field Format](#-vcard-related-field-format)
        - [💾 Field Value Formats](#-field-value-formats)
        - [📤 Export Format](#-export-format)
    - [🔄 Synchronization System](#-synchronization-system)
        - [📄 Related List Format](#-related-list-format)
        - [🔀 Sync Operations](#-sync-operations)
    - [⚙️ Gender-Aware Relationships](#️-gender-aware-relationships)
        - [🎭 Gendered Terms](#-gendered-terms)
        - [📝 List Item Formatting](#-list-item-formatting)
    - [🎯 Usage Examples](#-usage-examples)
        - [📝 Basic Relationship Creation](#-basic-relationship-creation)
        - [👪 Family Network Example](#-family-network-example)
        - [💼 Professional Network Example](#-professional-network-example)
    - [🔧 API Reference](#-api-reference)
        - [RelationshipGraph](#relationshipgraph)
        - [RelationshipManager](#relationshipmanager)
        - [RelationshipSyncManager](#relationshipsyncmanager)

---

### 🏗️ Architecture Overview

The relationship system is built around several key components:

- **RelationshipGraph**: Core graph data structure using [Graphology](https://graphology.github.io/) for efficient relationship management
- **RelationshipManager**: High-level orchestrator coordinating between different relationship modules
- **RelationshipSyncManager**: Handles synchronization between Related lists, frontmatter, and the relationship graph
- **RelationshipContentParser**: Parses relationship data from markdown content and frontmatter
- **RelationshipSet**: Manages RELATED frontmatter fields with consistent serialization/deserialization

The system maintains relationships in multiple formats simultaneously:
1. **Markdown Related Lists**: Human-readable relationship lists in contact notes
2. **Frontmatter RELATED Fields**: vCard 4.0 compliant fields for import/export
3. **Graph Structure**: Efficient in-memory graph for complex relationship queries

---

### 🏷️ Supported Relationship Types

The plugin supports comprehensive relationship types that are internally stored in genderless form but can be displayed with gender-appropriate terms.

#### 👪 Family Relationships

| **Type** | **Description** | **Reciprocal** |
|----------|----------------|----------------|
| `parent` | Parent relationship | `child` |
| `child` | Child relationship | `parent` |
| `sibling` | Sibling relationship | `sibling` |
| `spouse` | Spouse/Partner relationship | `spouse` |
| `partner` | Domestic partner | `partner` |
| `grandparent` | Grandparent relationship | `grandchild` |
| `grandchild` | Grandchild relationship | `grandparent` |
| `auncle` | Aunt/Uncle (gender-neutral) | `nibling` |
| `nibling` | Nephew/Niece (gender-neutral) | `auncle` |
| `cousin` | Cousin relationship | `cousin` |

#### 💼 Professional Relationships

| **Type** | **Description** |
|----------|----------------|
| `colleague` | Professional colleague |
| `relative` | General relative |

#### 👥 Social Relationships

| **Type** | **Description** |
|----------|----------------|
| `friend` | Friend relationship |

---

### 📊 Relationship Graph Management

The relationship system uses a directed graph structure to maintain relationships between contacts, supporting multiple relationship types between the same contacts.

#### 📍 Core Graph Operations

```typescript
// Add contacts to the graph
graph.addContact(uid: string, fullName: string, gender?: Gender, file?: TFile)

// Create relationships
graph.addRelationship(fromUid: string, toUid: string, type: RelationshipType)

// Query relationships
graph.getContactRelationships(uid: string)
graph.getRelatedContacts(uid: string, type: RelationshipType)

// Remove relationships
graph.removeRelationship(fromUid: string, toUid: string, type: RelationshipType)
```

#### 🔄 Relationship Consistency

The system automatically detects and reports missing reciprocal relationships:

```typescript
// Check for missing reciprocal relationships
const inconsistencies = graph.checkConsistency();
// Returns: [{ fromUid: string, toUid: string, type: RelationshipType }]
```

For example, if John is marked as Jane's spouse, but Jane is not marked as John's spouse, the system will detect this inconsistency.

#### 🎯 Reciprocal Relationships

The system understands reciprocal relationship types:

- `parent` ↔ `child`
- `grandparent` ↔ `grandchild` 
- `auncle` ↔ `nibling`
- `spouse` ↔ `spouse`
- `sibling` ↔ `sibling`
- `cousin` ↔ `cousin`
- `friend` ↔ `friend`
- `colleague` ↔ `colleague`
- `partner` ↔ `partner`
- `relative` ↔ `relative`

---

### 📋 vCard RELATED Field Format

Relationships are stored in frontmatter using vCard 4.0 RELATED field format for maximum compatibility.

#### 💾 Field Value Formats

The system supports three value formats:

1. **UUID Format**: `urn:uuid:550e8400-e29b-41d4-a716-446655440000`
   - Used when the contact has a valid UUID
   
2. **UID Format**: `uid:custom-contact-id`
   - Used for custom contact identifiers
   
3. **Name Format**: `name:John Doe`
   - Fallback when no UID is available

#### 📤 Export Format

Frontmatter example:
```yaml
---
FN: Jane Doe
"RELATED.SPOUSE[1]": "urn:uuid:550e8400-e29b-41d4-a716-446655440000"
"RELATED.CHILD[1]": "uid:child-contact-123"
"RELATED.PARENT[1]": "name:Mary Smith"
---
```

---

### 🔄 Synchronization System

The plugin maintains synchronization between three relationship representations:

1. **Related Lists** in markdown content
2. **RELATED fields** in frontmatter  
3. **Graph relationships** in memory

#### 📄 Related List Format

Related lists appear in contact notes as:

```markdown
## Related

- spouse [[John Smith]]
- child [[Sarah Doe]]
- parent [[Mary Johnson]]
```

#### 🔀 Sync Operations

Key synchronization methods:

```typescript
// Merge Related list to frontmatter
syncManager.mergeRelatedListToFrontmatter(file, relationships)

// Update frontmatter from graph
syncManager.updateFrontmatterFromGraph(file, uid)

// Sync frontmatter to Related list
syncManager.syncFrontmatterToRelatedList(file)
```

---

### ⚙️ Gender-Aware Relationships

The system supports gender-aware relationship display while maintaining genderless internal storage.

#### 🎭 Gendered Terms

Examples of gender-specific relationship terms:

| **Relationship** | **Male** | **Female** | **Neutral** |
|------------------|----------|------------|-------------|
| `parent` | father | mother | parent |
| `child` | son | daughter | child |
| `sibling` | brother | sister | sibling |
| `grandparent` | grandfather | grandmother | grandparent |
| `grandchild` | grandson | granddaughter | grandchild |
| `auncle` | uncle | aunt | auncle |
| `nibling` | nephew | niece | nibling |

#### 📝 List Item Formatting

```typescript
// Format relationship based on target gender
formatRelationshipListItem(
  relationshipType: RelationshipType,
  contactName: string,
  targetGender?: Gender
): string

// Examples:
formatRelationshipListItem('child', 'John', 'M')  // "- son [[John]]"
formatRelationshipListItem('child', 'Jane', 'F')  // "- daughter [[Jane]]"
formatRelationshipListItem('child', 'Alex')       // "- child [[Alex]]"
```

---

### 🎯 Usage Examples

#### 📝 Basic Relationship Creation

```typescript
// Add contacts to graph
graph.addContact('john-uid', 'John Smith', 'M');
graph.addContact('jane-uid', 'Jane Smith', 'F');

// Create spouse relationship
graph.addRelationship('john-uid', 'jane-uid', 'spouse');

// Query relationships
const johnRelationships = graph.getContactRelationships('john-uid');
// Returns: [{ type: 'spouse', targetUid: 'jane-uid', targetName: 'Jane Smith' }]
```

#### 👪 Family Network Example

```typescript
// Family structure: John & Jane (spouses), with children Sarah and Mike
graph.addContact('john-uid', 'John Smith', 'M');
graph.addContact('jane-uid', 'Jane Smith', 'F');
graph.addContact('sarah-uid', 'Sarah Smith', 'F');
graph.addContact('mike-uid', 'Mike Smith', 'M');

// Spouse relationships
graph.addRelationship('john-uid', 'jane-uid', 'spouse');
graph.addRelationship('jane-uid', 'john-uid', 'spouse');

// Parent-child relationships
graph.addRelationship('john-uid', 'sarah-uid', 'child');
graph.addRelationship('sarah-uid', 'john-uid', 'parent');
graph.addRelationship('jane-uid', 'sarah-uid', 'child');
graph.addRelationship('sarah-uid', 'jane-uid', 'parent');

// Sibling relationships
graph.addRelationship('sarah-uid', 'mike-uid', 'sibling');
graph.addRelationship('mike-uid', 'sarah-uid', 'sibling');
```

#### 💼 Professional Network Example

```typescript
// Professional relationships
graph.addContact('alice-uid', 'Alice Johnson', 'F');
graph.addContact('bob-uid', 'Bob Wilson', 'M');

// Colleague relationship
graph.addRelationship('alice-uid', 'bob-uid', 'colleague');
graph.addRelationship('bob-uid', 'alice-uid', 'colleague');

// Multiple relationship types between same contacts
graph.addRelationship('alice-uid', 'bob-uid', 'friend');
graph.addRelationship('bob-uid', 'alice-uid', 'friend');
```

---

### 🔧 API Reference

#### RelationshipGraph

Core graph management class:

```typescript
class RelationshipGraph {
  // Contact management
  addContact(uid: string, fullName: string, gender?: Gender, file?: TFile): void
  removeContact(uid: string): void
  getContact(uid: string): ContactNode | null

  // Relationship management
  addRelationship(fromUid: string, toUid: string, type: RelationshipType): void
  removeRelationship(fromUid: string, toUid: string, type: RelationshipType): void
  
  // Queries
  getContactRelationships(uid: string): Array<{type: RelationshipType, targetUid: string, targetName: string}>
  getRelatedContacts(uid: string, type: RelationshipType): ContactNode[]
  
  // vCard integration
  contactToRelatedFields(uid: string): RelatedField[]
  updateContactFromRelatedFields(uid: string, relatedFields: RelatedField[]): void
  
  // Consistency checking
  checkConsistency(): Array<{fromUid: string, toUid: string, type: RelationshipType}>
}
```

#### RelationshipManager

High-level relationship orchestration:

```typescript
class RelationshipManager {
  // Main operations coordinated across modules
  // Handles UI interactions and file updates
}
```

#### RelationshipSyncManager

Synchronization between different relationship formats:

```typescript
class RelationshipSyncManager {
  // Sync operations
  mergeRelatedListToFrontmatter(file: TFile, relationships: Array<{type: RelationshipType, contactName: string, impliedGender?: Gender}>): Promise<void>
  updateFrontmatterFromGraph(file: TFile, uid: string): Promise<void>
  syncFrontmatterToRelatedList(file: TFile): Promise<void>
}
```

---

The relationship system provides a robust foundation for managing complex personal and professional networks while maintaining full compatibility with vCard 4.0 standards and Obsidian's markdown-based approach.