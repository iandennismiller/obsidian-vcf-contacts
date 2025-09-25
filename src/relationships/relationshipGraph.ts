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
  gender?: Gender;
  file?: TFile;
}

/**
 * Edge attributes for relationships
 */
export interface RelationshipEdge {
  type: RelationshipType;
  created: Date;
}

/**
 * RELATED field value format for vCard
 */
export interface RelatedField {
  type: RelationshipType;
  value: string; // urn:uuid:..., name:..., or uid:...
}

/**
 * Relationship graph for managing contact relationships
 * Uses Graphology for efficient graph operations
 */
export class RelationshipGraph {
  private graph: Graph<ContactNode, RelationshipEdge>;

  constructor() {
    this.graph = new Graph<ContactNode, RelationshipEdge>({ multi: true });
  }

  /**
   * Add a contact to the graph
   */
  addContact(uid: string, fullName: string, gender?: Gender, file?: TFile): void {
    if (this.graph.hasNode(uid)) {
      // Update existing node
      this.graph.mergeNodeAttributes(uid, { fullName, gender, file });
    } else {
      // Add new node
      this.graph.addNode(uid, { uid, fullName, gender, file });
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
    if (!this.graph.hasNode(uid)) {
      return null;
    }
    return this.graph.getNodeAttributes(uid);
  }

  /**
   * Get all contacts in the graph
   */
  getAllContacts(): ContactNode[] {
    return this.graph.nodes().map(uid => this.graph.getNodeAttributes(uid));
  }

  /**
   * Add a relationship between two contacts
   */
  addRelationship(fromUid: string, toUid: string, type: RelationshipType): void {
    if (!this.graph.hasNode(fromUid) || !this.graph.hasNode(toUid)) {
      throw new Error(`Both contacts must exist in the graph. From: ${fromUid}, To: ${toUid}`);
    }

    // Check if relationship already exists
    const existingEdges = this.graph.edges(fromUid, toUid);
    for (const edge of existingEdges) {
      if (this.graph.getEdgeAttribute(edge, 'type') === type) {
        return; // Relationship already exists
      }
    }

    this.graph.addDirectedEdge(fromUid, toUid, {
      type,
      created: new Date()
    });
  }

  /**
   * Remove a relationship between two contacts
   */
  removeRelationship(fromUid: string, toUid: string, type: RelationshipType): void {
    if (!this.graph.hasNode(fromUid) || !this.graph.hasNode(toUid)) {
      return;
    }

    const edgesToRemove: string[] = [];
    this.graph.forEachEdge(fromUid, toUid, (edge) => {
      if (this.graph.getEdgeAttribute(edge, 'type') === type) {
        edgesToRemove.push(edge);
      }
    });

    for (const edge of edgesToRemove) {
      this.graph.dropEdge(edge);
    }
  }

  /**
   * Get all relationships for a contact
   */
  getContactRelationships(uid: string): { type: RelationshipType; targetUid: string; targetName: string }[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: { type: RelationshipType; targetUid: string; targetName: string }[] = [];

    this.graph.forEachOutEdge(uid, (edge) => {
      const target = this.graph.target(edge);
      const targetNode = this.graph.getNodeAttributes(target);
      const type = this.graph.getEdgeAttribute(edge, 'type');

      relationships.push({
        type,
        targetUid: target,
        targetName: targetNode.fullName
      });
    });

    return relationships.sort((a, b) => 
      a.targetName.localeCompare(b.targetName)
    );
  }

  /**
   * Get all contacts that have a specific relationship to the given contact
   */
  getRelatedContacts(uid: string, type: RelationshipType): ContactNode[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const related: ContactNode[] = [];
    
    this.graph.forEachInEdge(uid, (edge) => {
      const source = this.graph.source(edge);
      if (this.graph.getEdgeAttribute(edge, 'type') === type) {
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
      return;
    }

    for (const field of relatedFields) {
      const targetUid = this.parseRelatedValue(field.value);
      if (targetUid && this.graph.hasNode(targetUid)) {
        this.addRelationship(uid, targetUid, field.type);
      }
    }
  }

  /**
   * Check graph consistency and return missing reciprocal relationships
   */
  checkConsistency(): { fromUid: string; toUid: string; type: RelationshipType }[] {
    const inconsistencies: { fromUid: string; toUid: string; type: RelationshipType }[] = [];

    this.graph.forEachEdge((edge) => {
      const source = this.graph.source(edge);
      const target = this.graph.target(edge);
      const type = this.graph.getEdgeAttribute(edge, 'type');
      const reciprocalType = this.getReciprocalType(type);
      
      if (reciprocalType) {
        // Check if reciprocal relationship exists using forEachOutEdge
        let reciprocalExists = false;
        
        this.graph.forEachOutEdge(target, (e) => {
          const edgeTarget = this.graph.target(e);
          const edgeType = this.graph.getEdgeAttribute(e, 'type');
          
          if (edgeTarget === source && edgeType === reciprocalType) {
            reciprocalExists = true;
          }
        });
        
        if (!reciprocalExists) {
          inconsistencies.push({ fromUid: target, toUid: source, type: reciprocalType });
        }
      }
    });

    return inconsistencies;
  }

  /**
   * Get the reciprocal relationship type
   */
  private getReciprocalType(type: RelationshipType): RelationshipType | null {
    const reciprocals: Record<RelationshipType, RelationshipType | null> = {
      'parent': 'child',
      'child': 'parent',
      'sibling': 'sibling',
      'spouse': 'spouse',
      'friend': 'friend',
      'colleague': 'colleague',
      'relative': 'relative',
      'auncle': 'nibling',
      'nibling': 'auncle',
      'grandparent': 'grandchild',
      'grandchild': 'grandparent',
      'cousin': 'cousin',
      'partner': 'partner'
    };

    return reciprocals[type] || null;
  }

  /**
   * Format a related value for vCard RELATED field
   */
  private formatRelatedValue(targetUid: string, targetName: string): string {
    // Check if targetUid is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(targetUid)) {
      return `urn:uuid:${targetUid}`;
    }
    
    // Check if it's a custom UID (not a name fallback)
    if (targetUid !== targetName) {
      return `uid:${targetUid}`;
    }
    
    // Fallback to name format
    return `name:${targetName}`;
  }

  /**
   * Parse a related value to extract the target UID
   */
  private parseRelatedValue(value: string): string | null {
    if (value.startsWith('urn:uuid:')) {
      return value.substring(9);
    }
    if (value.startsWith('uid:')) {
      return value.substring(4);
    }
    if (value.startsWith('name:')) {
      return value.substring(5);
    }
    return null;
  }

  /**
   * Clear all relationships but keep contacts
   */
  clearAllRelationships(): void {
    this.graph.clearEdges();
  }

  /**
   * Get graph statistics
   */
  getStats(): { contacts: number; relationships: number } {
    return {
      contacts: this.graph.order,
      relationships: this.graph.size
    };
  }
}