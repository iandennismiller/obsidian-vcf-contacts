# Relationship Management Implementation - Demo

This document demonstrates the key features of the relationship management system implemented for the Obsidian VCF Contacts plugin.

## Core Features

### 1. Gender-Aware Relationship Parsing

The system can parse gendered relationship terms and infer gender information:

```typescript
import { parseGenderedTerm } from 'src/relationships/relationshipUtils';

// Parses gendered terms and extracts implied gender
parseGenderedTerm('father') // → { type: 'parent', gender: 'M' }
parseGenderedTerm('mother') // → { type: 'parent', gender: 'F' }
parseGenderedTerm('sister') // → { type: 'sibling', gender: 'F' }
parseGenderedTerm('parent') // → { type: 'parent' } (no gender)
```

### 2. Markdown Related List Parsing

The system can extract and parse Related sections from markdown contact files:

```markdown
## Related

- father [[John Doe]]
- mother [[Jane Smith]]
- friend [[Best Friend]]
- sister [[Sarah Doe]]
```

This gets parsed into structured relationships with inferred gender:
- `father [[John Doe]]` → `parent` relationship with implied gender `M`
- `mother [[Jane Smith]]` → `parent` relationship with implied gender `F`
- `sister [[Sarah Doe]]` → `sibling` relationship with implied gender `F`

### 3. Front Matter Synchronization

The system maintains relationships in the YAML front matter using vCard 4.0 RELATED fields:

```yaml
---
UID: john-doe-123
FN: John Doe
RELATED[parent]: urn:uuid:jane-smith-456
RELATED[1:parent]: urn:uuid:robert-doe-789
RELATED[friend]: name:Best Friend
GENDER: M
REV: 2023-12-07T10:30:00Z
---
```

Key features:
- **Indexed arrays**: `RELATED[parent]`, `RELATED[1:parent]`, `RELATED[2:parent]`
- **Namespace support**: `urn:uuid:`, `uid:`, `name:` prefixes
- **Automatic sorting**: Relationships sorted by type, then by value
- **REV timestamp**: Updated automatically when relationships change

### 4. Relationship Graph Operations

The system uses a graph data structure to manage relationships efficiently:

```typescript
import { RelationshipGraph } from 'src/relationships/relationshipGraph';

const graph = new RelationshipGraph();

// Add contacts
graph.addContact('john-uid', 'John Doe', 'M');
graph.addContact('jane-uid', 'Jane Doe', 'F');

// Add relationships (directed edges)
graph.addRelationship('john-uid', 'jane-uid', 'spouse');
graph.addRelationship('jane-uid', 'john-uid', 'spouse');

// Query relationships
const johnRelationships = graph.getContactRelationships('john-uid');
// → [{ type: 'spouse', targetUid: 'jane-uid', targetName: 'Jane Doe' }]
```

### 5. Bidirectional Synchronization

The system maintains consistency between three representations:

1. **Markdown Related Lists** (user-friendly editing)
2. **Front Matter RELATED Fields** (vCard 4.0 standard)
3. **Relationship Graph** (efficient querying and consistency)

Changes in any representation automatically propagate to the others.

### 6. Obsidian Commands

The system provides three Obsidian commands:

- **"Rebuild Relationship Graph"**: Reconstructs the entire graph from contact files
- **"Sync All Relationships"**: Performs comprehensive sync across all contacts
- **"Check Relationship Consistency"**: Validates and repairs inconsistencies

### 7. Event-Driven Synchronization

The system responds to file changes automatically:

- When a contact file is modified, it parses the Related list
- Updates are debounced to prevent excessive processing
- Global locking prevents race conditions
- Changes propagate to related contacts automatically

## Usage Example

### Step 1: Edit a contact's Related list

In your contact file `John Doe.md`:

```markdown
# John Doe

## Related

- wife [[Jane Doe]]
- son [[Tommy Doe]]
- daughter [[Sarah Doe]]
- friend [[Best Friend]]
```

### Step 2: System automatically processes the changes

1. Parses the relationships and infers gender from `wife`, `son`, `daughter`
2. Updates John's front matter with RELATED fields
3. Updates Jane's, Tommy's, and Sarah's records with reciprocal relationships
4. Creates contact stub for "Best Friend" if it doesn't exist
5. Updates all REV timestamps

### Step 3: Front matter is updated

```yaml
---
UID: john-doe-123
FN: John Doe
RELATED[friend]: name:Best Friend
RELATED[child]: urn:uuid:sarah-doe-456
RELATED[1:child]: urn:uuid:tommy-doe-789
RELATED[spouse]: urn:uuid:jane-doe-012
REV: 2023-12-07T10:30:00Z
---
```

### Step 4: Related contacts are updated

Jane Doe's front matter automatically gets updated:

```yaml
---
UID: jane-doe-012
FN: Jane Doe
GENDER: F
RELATED[spouse]: urn:uuid:john-doe-123
REV: 2023-12-07T10:30:00Z
---
```

## Technical Architecture

- **RelationshipGraph**: Core graph data structure using Graphology
- **RelationshipManager**: Main orchestrator coordinating all components
- **RelationshipSyncManager**: Handles sync between graph, front matter, and markdown
- **RelationshipEventHandler**: Manages event lifecycle and provides global locking
- **RelationshipContentParser**: Parses and manipulates Related sections
- **ContactUtils**: Handles contact resolution and file management
- **RelationshipSet**: Utility for consistent relationship ordering

The system is designed to be robust, efficient, and user-friendly while maintaining data integrity across all representations.