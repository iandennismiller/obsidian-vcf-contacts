Here's the API specification for the Relationship Management plugin, summarizing all classes and their key methods:

### **API Specification**

#### **1. VCardManager**
Manages vCard 4.0 data, including parsing and storing relationships.

**Methods:**
- `parseVCard(frontMatter: Record<string, any>): VCard`
  Parses Obsidian front matter into a structured `VCard` object.
- `addOrUpdateVCard(uid: string, vcard: VCard): void`
  Adds or updates a vCard in the manager.
- `getVCard(uidOrName: string): VCard | undefined`
  Retrieves a vCard by UID or name (fallback).
- `addRelationship(uid: string, type: string, targetId: string): void`
  Adds a relationship to a vCard.
- `removeRelationship(uid: string, type: string, targetId: string): void`
  Removes a relationship from a vCard.
- `exportToFrontMatter(uid: string): Record<string, any>`
  Exports a vCard to Obsidian front matter format.

---

#### **2. ObsidianContactManager**
Manages Obsidian notes as contacts, including front matter and markdown content.

**Methods:**
- `loadContact(filePath: string): Promise<ContactNote | null>`
  Loads a contact note from the vault.
- `saveContact(contact: ContactNote): Promise<void>`
  Saves changes to a contact note.
- `parseRelatedList(content: string): RelatedListItem[]`
  Parses the "## Related" list from markdown.
- `syncRelatedList(contact: ContactNote): Promise<void>`
  Syncs the Related list with the vCard's `RELATED` fields.
- `updateFrontMatter(contact: ContactNote): Promise<void>`
  Updates the front matter with changes from the vCard.

---

#### **3. RelationshipGraph**
Models the social network as a directed graph with nodes (contacts) and edges (relationships).

**Methods:**
- `addNode(uid: string, name?: string): void`
  Adds a node to the graph.
- `removeNode(uid: string): void`
  Removes a node from the graph.
- `addEdge(source: string, target: string, kind: string): void`
  Adds a relationship edge.
- `removeEdge(source: string, target: string, kind: string): void`
  Removes a relationship edge.
- `hasRelationship(source: string, target: string, kind: string): boolean`
  Checks if a relationship exists.
- `getRelationships(nodeId: string): Record<string, string[]>`
  Gets all relationships for a node.
- `getNodes(): string[]`
  Gets all nodes in the graph.

---

#### **4. GenderManager**
Handles gender-specific relationship types and encoding/decoding.

**Methods:**
- `encodeToGenderless(kind: string, targetGender?: Gender): GenderlessKind`
  Encodes a gendered relationship type to the genderless form.
- `decodeToGendered(genderlessKind: GenderlessKind, targetGender?: Gender): string`
  Decodes a genderless relationship type to the appropriate form.
- `inferGenderFromRelationship(sourceKind: string, targetGender?: Gender): { inferredGender?: Gender, genderedKind?: string }`
  Infers the target contact's gender from a relationship.

---

#### **5. RelationshipManager**
Orchestrates the other classes to ensure bidirectional consistency.

**Methods:**
- `initializeGraph(): Promise<void>`
  Initializes the graph from all contacts.
- `addRelationship(update: RelationshipUpdate): Promise<void>`
  Adds a relationship (updates graph, front matter, and markdown).
- `removeRelationship(update: RelationshipUpdate): Promise<void>`
  Removes a relationship.
- `checkConsistency(): Promise<ConsistencyCheckResult>`
  Checks for consistency issues (e.g., missing backlinks).
- `fixConsistency(): Promise<void>`
  Fixes consistency issues (e.g., adds missing backlinks).

---

#### **6. UserEventManager**
Handles Obsidian plugin events (e.g., initialization, file close).

**Methods:**
- `onPluginLoad(): Promise<void>`
  Initializes the plugin by loading contacts and building the graph.
- `onFileClose(file: TFile): Promise<void>`
  Handles file close events to sync changes for the closed contact.

---

### **Data Structures**
- `VCard`: Represents a vCard with UID, name, gender, and relationships.
- `RelatedField`: Represents a relationship in the vCard (type + target ID).
- `ContactNote`: Represents an Obsidian note with file path, front matter, and content.
- `RelatedListItem`: Represents a relationship in the markdown list (type + target name).
- `RelationshipUpdate`: Describes a relationship change (source, target, kind).

---

### **Integration Notes**
- The `RelationshipManager` coordinates the other classes to ensure changes are propagated bidirectionally.
- The `UserEventManager` triggers syncs when the plugin loads or a contact note is closed.
- Gender-specific rendering is handled by the `GenderManager` while storing relationships in a genderless form.

This API provides a clean separation of concerns, with each class focusing on a specific aspect of the relationship management system.
