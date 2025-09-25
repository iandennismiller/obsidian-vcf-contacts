import Graph from 'graphology';
import { TFile } from 'obsidian';

/**
 * Gender types as specified in vCard 4.0 GENDER field
 */
export type Gender = 'M' | 'F' | 'NB' | 'U' | '';

/**
 * Relationship types (genderless internally)
 */
export type RelationshipType = 
  | 'parent' | 'child' | 'sibling' | 'spouse' | 'friend' 
  | 'colleague' | 'relative' | 'auncle' | 'nibling' 
  | 'grandparent' | 'grandchild' | 'cousin' | 'partner';

/**
 * Node attributes for contacts in the relationship graph
 */
export interface ContactNode {
  uid: string;
  fullName: string;
  file?: TFile;
  gender?: Gender;
}

/**
 * Edge attributes for relationships
 */
export interface RelationshipEdge {
  type: RelationshipType;
}

/**
 * RELATED field value format for vCard
 */
export interface RelatedField {
  type: RelationshipType;
  value: string; // urn:uuid:<UUID>, uid:<UID>, or name:<Full Name>
}

/**
 * Relationship graph for managing contact relationships
 * Uses Graphology for efficient graph operations
 */
export class RelationshipGraph {
  private graph: Graph<ContactNode, RelationshipEdge>;

  constructor() {
    this.graph = new Graph<ContactNode, RelationshipEdge>({ type: 'directed' });
  }

  /**
   * Add a contact to the graph
   */
  addContact(uid: string, fullName: string, file?: TFile, gender?: Gender): void {
    if (this.graph.hasNode(uid)) {
      // Update existing node
      this.graph.setNodeAttribute(uid, 'uid', uid);
      this.graph.setNodeAttribute(uid, 'fullName', fullName);
      if (file !== undefined) this.graph.setNodeAttribute(uid, 'file', file);
      if (gender !== undefined) this.graph.setNodeAttribute(uid, 'gender', gender);
    } else {
      // Add new node
      this.graph.addNode(uid, { uid, fullName, file, gender });
    }
  }

  /**
   * Remove a contact from the graph
   */
  removeContact(uid: string): void {
    if (this.graph.hasNode(uid)) {
      this.graph.dropNode(uid);
    }
  }

  /**
   * Get contact by UID
   */
  getContact(uid: string): ContactNode | null {
    if (this.graph.hasNode(uid)) {
      return this.graph.getNodeAttributes(uid);
    }
    return null;
  }

  /**
   * Get all contacts
   */
  getAllContacts(): ContactNode[] {
    return this.graph.nodes().map(uid => this.graph.getNodeAttributes(uid));
  }

  /**
   * Add a relationship between two contacts
   */
  addRelationship(sourceUid: string, targetUid: string, type: RelationshipType): void {
    if (!this.graph.hasNode(sourceUid) || !this.graph.hasNode(targetUid)) {
      throw new Error(`One or both contacts not found: ${sourceUid}, ${targetUid}`);
    }

    if (sourceUid === targetUid) {
      throw new Error('Self-loops are not allowed');
    }

    // Check if edge already exists
    const edgeKey = `${sourceUid}-${type}-${targetUid}`;
    if (this.graph.hasDirectedEdge(sourceUid, targetUid)) {
      // Check if it's the same type
      const existingType = this.graph.getDirectedEdgeAttribute(sourceUid, targetUid, 'type');
      if (existingType === type) {
        return; // Edge already exists
      }
      // Drop existing edge to replace with new type
      this.graph.dropDirectedEdge(sourceUid, targetUid);
    }

    this.graph.addDirectedEdgeWithKey(edgeKey, sourceUid, targetUid, { type });
  }

  /**
   * Remove a relationship
   */
  removeRelationship(sourceUid: string, targetUid: string, type?: RelationshipType): void {
    if (this.graph.hasDirectedEdge(sourceUid, targetUid)) {
      if (!type || this.graph.getDirectedEdgeAttribute(sourceUid, targetUid, 'type') === type) {
        this.graph.dropDirectedEdge(sourceUid, targetUid);
      }
    }
  }

  /**
   * Get all relationships for a contact
   */
  getContactRelationships(uid: string): Array<{ type: RelationshipType; targetUid: string; targetName: string }> {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: Array<{ type: RelationshipType; targetUid: string; targetName: string }> = [];
    
    this.graph.forEachOutEdge(uid, (edge, attributes, source, target) => {
      const targetNode = this.graph.getNodeAttributes(target);
      relationships.push({
        type: attributes.type,
        targetUid: target,
        targetName: targetNode.fullName
      });
    });

    return relationships.sort((a, b) => a.targetName.localeCompare(b.targetName));
  }

  /**
   * Get all contacts that have a specific relationship to the given contact
   */
  getRelatedContacts(uid: string, type: RelationshipType): ContactNode[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const related: ContactNode[] = [];
    
    this.graph.forEachInEdge(uid, (edge, attributes, source) => {
      if (attributes.type === type) {
        related.push(this.graph.getNodeAttributes(source));
      }
    });

    return related.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /**
   * Convert contact relationships to vCard RELATED fields
   */
  contactToRelatedFields(uid: string): RelatedField[] {
    const relationships = this.getContactRelationships(uid);
    return relationships.map(rel => ({
      type: rel.type,
      value: this.formatRelatedValue(rel.targetUid, rel.targetName)
    }));
  }

  /**
   * Parse vCard RELATED fields and update graph
   */
  updateContactFromRelatedFields(uid: string, relatedFields: RelatedField[]): void {
    if (!this.graph.hasNode(uid)) {
      throw new Error(`Contact ${uid} not found in graph`);
    }

    // Remove all existing outbound relationships for this contact
    const outEdges = this.graph.outEdges(uid);
    outEdges.forEach(edge => this.graph.dropEdge(edge));

    // Add new relationships
    for (const field of relatedFields) {
      const targetUid = this.parseRelatedValue(field.value);
      if (targetUid && this.graph.hasNode(targetUid)) {
        this.addRelationship(uid, targetUid, field.type);
      }
    }
  }

  /**
   * Format a RELATED value for vCard
   */
  private formatRelatedValue(targetUid: string, targetName: string): string {
    // Prefer UID format if it looks like a UUID
    if (targetUid.includes('urn:uuid:') || targetUid.match(/^[0-9a-f-]{36}$/i)) {
      return targetUid.startsWith('urn:uuid:') ? targetUid : `urn:uuid:${targetUid}`;
    }
    // Use UID format for other UIDs
    if (targetUid !== targetName) {
      return `uid:${targetUid}`;
    }
    // Fall back to name format
    return `name:${targetName}`;
  }

  /**
   * Parse a RELATED value to extract UID or name
   */
  private parseRelatedValue(value: string): string | null {
    if (value.startsWith('urn:uuid:')) {
      return value.substring(9); // Remove 'urn:uuid:' prefix
    }
    if (value.startsWith('uid:')) {
      return value.substring(4); // Remove 'uid:' prefix
    }
    if (value.startsWith('name:')) {
      return value.substring(5); // Remove 'name:' prefix - this would need name-to-UID lookup
    }
    return null;
  }

  /**
   * Clear all relationships
   */
  clearAllRelationships(): void {
    this.graph.clearEdges();
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Get graph statistics
   */
  getStats(): { nodes: number; edges: number } {
    return {
      nodes: this.graph.order,
      edges: this.graph.size
    };
  }
}