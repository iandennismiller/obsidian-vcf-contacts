import { DirectedGraph } from 'graphology';
import { TFile } from 'obsidian';

export interface RelationshipEdge {
  relationshipType: string;
  sourceContact: string;
  targetContact: string;
}

export interface ContactReference {
  uid?: string;
  name?: string;
  file?: TFile;
}

/**
 * Relationship types that have gender implications
 */
export const GENDERED_RELATIONSHIPS: Record<string, { baseType: string; gender: 'M' | 'F' }> = {
  // Parents
  'mother': { baseType: 'parent', gender: 'F' },
  'mom': { baseType: 'parent', gender: 'F' },
  'father': { baseType: 'parent', gender: 'M' },
  'dad': { baseType: 'parent', gender: 'M' },
  
  // Siblings
  'sister': { baseType: 'sibling', gender: 'F' },
  'brother': { baseType: 'sibling', gender: 'M' },
  
  // Extended family
  'aunt': { baseType: 'auncle', gender: 'F' },
  'uncle': { baseType: 'auncle', gender: 'M' },
  'grandmother': { baseType: 'grandparent', gender: 'F' },
  'grandfather': { baseType: 'grandparent', gender: 'M' },
  'grandson': { baseType: 'grandchild', gender: 'M' },
  'granddaughter': { baseType: 'grandchild', gender: 'F' }
};

/**
 * Manages the relationship graph between contacts using Graphology
 */
export class RelationshipGraph {
  private graph: DirectedGraph;

  constructor() {
    this.graph = new DirectedGraph();
  }

  /**
   * Add a contact node to the graph
   */
  addContact(contactId: string, contactData?: any): void {
    if (!this.graph.hasNode(contactId)) {
      this.graph.addNode(contactId, contactData || {});
    } else if (contactData) {
      // Update existing node data
      this.graph.mergeNodeAttributes(contactId, contactData);
    }
  }

  /**
   * Add a relationship edge between two contacts
   */
  addRelationship(sourceId: string, targetId: string, relationshipType: string): void {
    // Ensure both nodes exist
    this.addContact(sourceId);
    this.addContact(targetId);

    // Check if relationship already exists
    const edgeKey = `${sourceId}-${relationshipType}-${targetId}`;
    
    if (!this.graph.hasEdge(sourceId, targetId)) {
      this.graph.addEdgeWithKey(edgeKey, sourceId, targetId, {
        relationshipType,
        sourceContact: sourceId,
        targetContact: targetId
      });
    } else {
      // Update edge attributes if edge exists
      this.graph.setEdgeAttribute(sourceId, targetId, 'relationshipType', relationshipType);
    }
  }

  /**
   * Remove a relationship edge
   */
  removeRelationship(sourceId: string, targetId: string, relationshipType: string): void {
    if (this.graph.hasEdge(sourceId, targetId)) {
      this.graph.dropEdge(sourceId, targetId);
    }
  }

  /**
   * Get all relationships for a contact
   */
  getContactRelationships(contactId: string): RelationshipEdge[] {
    if (!this.graph.hasNode(contactId)) {
      return [];
    }

    const relationships: RelationshipEdge[] = [];
    
    // Outgoing edges (relationships this contact has)
    this.graph.forEachOutEdge(contactId, (edge, attributes, source, target) => {
      relationships.push({
        relationshipType: attributes.relationshipType,
        sourceContact: source,
        targetContact: target
      });
    });

    return relationships;
  }

  /**
   * Get all incoming relationships for a contact (who considers this contact as related)
   */
  getIncomingRelationships(contactId: string): RelationshipEdge[] {
    if (!this.graph.hasNode(contactId)) {
      return [];
    }

    const relationships: RelationshipEdge[] = [];
    
    // Incoming edges (relationships others have to this contact)
    this.graph.forEachInEdge(contactId, (edge, attributes, source, target) => {
      relationships.push({
        relationshipType: attributes.relationshipType,
        sourceContact: source,
        targetContact: target
      });
    });

    return relationships;
  }

  /**
   * Check if two contacts have a specific relationship
   */
  hasRelationship(sourceId: string, targetId: string, relationshipType: string): boolean {
    if (!this.graph.hasEdge(sourceId, targetId)) {
      return false;
    }
    const edgeAttributes = this.graph.getEdgeAttributes(sourceId, targetId);
    return edgeAttributes.relationshipType === relationshipType;
  }

  /**
   * Get all contacts in the graph
   */
  getAllContacts(): string[] {
    return this.graph.nodes();
  }

  /**
   * Remove a contact and all its relationships
   */
  removeContact(contactId: string): void {
    if (this.graph.hasNode(contactId)) {
      this.graph.dropNode(contactId);
    }
  }

  /**
   * Convert gendered relationship to base relationship type
   */
  static normalizeRelationshipType(relationshipType: string): string {
    const normalized = relationshipType.toLowerCase();
    return GENDERED_RELATIONSHIPS[normalized]?.baseType || relationshipType;
  }

  /**
   * Get gender implication from relationship type
   */
  static getGenderFromRelationship(relationshipType: string): 'M' | 'F' | null {
    const normalized = relationshipType.toLowerCase();
    return GENDERED_RELATIONSHIPS[normalized]?.gender || null;
  }

  /**
   * Clear all data from the graph
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Get a serializable representation of the graph
   */
  serialize(): any {
    return this.graph.export();
  }

  /**
   * Load graph from serialized data
   */
  deserialize(data: any): void {
    this.graph.clear();
    this.graph.import(data);
  }
}