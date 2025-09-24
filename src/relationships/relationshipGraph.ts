import Graph from 'graphology';
import { TFile } from 'obsidian';
import { ContactNode, RelationshipEdge, RelationshipType, RelatedField, Gender, RelationshipTuple } from './relationshipTypes';
import { formatRelatedValue, parseRelatedValue } from './relationshipUtils';

/**
 * Relationship graph for managing contact relationships
 * Uses Graphology for efficient graph operations
 */
export class RelationshipGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ type: 'directed', multi: true });
  }

  /**
   * Add a contact to the graph
   */
  addContact(uid: string, fullName: string, gender?: Gender, file?: TFile): void {
    const attributes = { uid, fullName, gender, file };
    if (this.graph.hasNode(uid)) {
      // Update existing node
      this.graph.replaceNodeAttributes(uid, attributes);
    } else {
      // Add new node
      this.graph.addNode(uid, attributes);
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
   * Check if a contact exists in the graph
   */
  hasContact(uid: string): boolean {
    return this.graph.hasNode(uid);
  }

  /**
   * Get contact information
   */
  getContact(uid: string): ContactNode | null {
    if (!this.graph.hasNode(uid)) {
      return null;
    }
    return this.graph.getNodeAttributes(uid) as ContactNode;
  }

  /**
   * Get all contacts in the graph
   */
  getAllContacts(): ContactNode[] {
    return this.graph.nodes().map(uid => this.graph.getNodeAttributes(uid) as ContactNode);
  }

  /**
   * Add a relationship between two contacts
   */
  addRelationship(fromUid: string, toUid: string, type: RelationshipType): void {
    if (!this.graph.hasNode(fromUid) || !this.graph.hasNode(toUid)) {
      throw new Error(`Cannot add relationship: one or both contacts not found (${fromUid} -> ${toUid})`);
    }

    // Check if this exact relationship already exists
    const existingEdges = this.graph.edges().filter(edgeId => {
      const source = this.graph.source(edgeId);
      const target = this.graph.target(edgeId);
      const edgeType = this.graph.getEdgeAttribute(edgeId, 'type');
      return source === fromUid && target === toUid && edgeType === type;
    });

    if (existingEdges.length === 0) {
      this.graph.addEdge(fromUid, toUid, {
        type,
        created: new Date()
      });
    }
  }

  /**
   * Remove a specific relationship
   */
  removeRelationship(fromUid: string, toUid: string, type: RelationshipType): void {
    const edgesToRemove = this.graph.edges().filter(edgeId => {
      const source = this.graph.source(edgeId);
      const target = this.graph.target(edgeId);
      const edgeType = this.graph.getEdgeAttribute(edgeId, 'type');
      return source === fromUid && target === toUid && edgeType === type;
    });

    edgesToRemove.forEach(edge => this.graph.dropEdge(edge));
  }

  /**
   * Remove all outbound relationships for a contact
   */
  removeAllRelationships(uid: string): void {
    if (this.graph.hasNode(uid)) {
      const outEdges = this.graph.outEdges(uid);
      outEdges.forEach(edge => this.graph.dropEdge(edge));
    }
  }

  /**
   * Get all relationships for a contact (outbound)
   */
  getContactRelationships(uid: string): RelationshipTuple[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: RelationshipTuple[] = [];
    
    this.graph.forEachOutEdge(uid, (edge) => {
      const target = this.graph.target(edge);
      const targetNode = this.graph.getNodeAttributes(target) as ContactNode;
      const edgeAttrs = this.graph.getEdgeAttributes(edge) as RelationshipEdge;

      relationships.push({
        type: edgeAttrs.type,
        targetUid: target,
        targetName: targetNode.fullName
      });
    });

    // Sort by type then by target name for consistency
    return relationships.sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;
      return a.targetName.localeCompare(b.targetName);
    });
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
      const edgeType = this.graph.getEdgeAttribute(edge, 'type');
      if (edgeType === type) {
        related.push(this.graph.getNodeAttributes(source) as ContactNode);
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
      value: formatRelatedValue(rel.targetUid, rel.targetName)
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
    this.removeAllRelationships(uid);

    // Add new relationships
    for (const field of relatedFields) {
      const parsedValue = parseRelatedValue(field.value);
      if (parsedValue && this.graph.hasNode(parsedValue.uid)) {
        this.addRelationship(uid, parsedValue.uid, field.type);
      }
    }
  }

  /**
   * Get graph statistics
   */
  getStatistics(): { contactCount: number; relationshipCount: number } {
    return {
      contactCount: this.graph.order,
      relationshipCount: this.graph.size
    };
  }

  /**
   * Clear all data from the graph
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Check graph consistency and return issues
   */
  checkConsistency(): { issues: string[]; repaired: boolean } {
    const issues: string[] = [];
    let repaired = false;

    // Check for orphaned edges (edges pointing to non-existent nodes)
    const allEdges = this.graph.edges();
    for (const edgeId of allEdges) {
      const source = this.graph.source(edgeId);
      const target = this.graph.target(edgeId);
      
      if (!this.graph.hasNode(source)) {
        issues.push(`Edge ${edgeId} has invalid source: ${source}`);
        this.graph.dropEdge(edgeId);
        repaired = true;
      }
      
      if (!this.graph.hasNode(target)) {
        issues.push(`Edge ${edgeId} has invalid target: ${target}`);
        this.graph.dropEdge(edgeId);
        repaired = true;
      }
    }

    return { issues, repaired };
  }

  /**
   * Export graph data for debugging
   */
  exportData(): { nodes: ContactNode[]; edges: Array<{ from: string; to: string; type: RelationshipType }> } {
    const nodes = this.getAllContacts();
    const edges = this.graph.edges().map(edgeId => ({
      from: this.graph.source(edgeId),
      to: this.graph.target(edgeId),
      type: this.graph.getEdgeAttribute(edgeId, 'type') as RelationshipType
    }));

    return { nodes, edges };
  }
}