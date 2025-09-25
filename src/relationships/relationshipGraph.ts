/**
 * Relationship graph for managing contact relationships
 * Uses Graphology for efficient graph operations
 */

import Graph from 'graphology';
import { ContactNode, RelationshipEdge, GenderlessKind, Gender, RelatedField } from './types';

/**
 * Relationship graph for managing contact relationships
 * Uses Graphology for efficient graph operations
 */
export class RelationshipGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  /**
   * Add a contact node to the graph
   */
  addNode(uid: string, fullName: string, gender?: Gender): void {
    if (this.graph.hasNode(uid)) {
      // Update existing node
      this.graph.mergeNodeAttributes(uid, { fullName, gender });
    } else {
      this.graph.addNode(uid, { uid, fullName, gender });
    }
  }

  /**
   * Remove a contact node from the graph
   */
  removeNode(uid: string): void {
    if (this.graph.hasNode(uid)) {
      this.graph.dropNode(uid);
    }
  }

  /**
   * Check if a contact node exists
   */
  hasNode(uid: string): boolean {
    return this.graph.hasNode(uid);
  }

  /**
   * Get contact node information
   */
  getNode(uid: string): ContactNode | null {
    if (!this.graph.hasNode(uid)) {
      return null;
    }
    return this.graph.getNodeAttributes(uid) as ContactNode;
  }

  /**
   * Get all nodes in the graph
   */
  getNodes(): ContactNode[] {
    return this.graph.mapNodes((node, attributes) => attributes as ContactNode);
  }

  /**
   * Add a relationship edge
   */
  addRelationship(sourceUid: string, targetUid: string, kind: GenderlessKind): void {
    if (!this.graph.hasNode(sourceUid) || !this.graph.hasNode(targetUid)) {
      throw new Error(`Cannot add relationship: missing node(s) ${sourceUid} -> ${targetUid}`);
    }

    const edgeKey = `${sourceUid}-${kind}-${targetUid}`;
    
    if (this.graph.hasEdge(edgeKey)) {
      // Update existing edge
      this.graph.setEdgeAttribute(edgeKey, 'type', kind);
    } else {
      // Add new edge
      this.graph.addDirectedEdgeWithKey(edgeKey, sourceUid, targetUid, {
        type: kind,
        source: sourceUid,
        target: targetUid
      });
    }
  }

  /**
   * Remove a relationship edge
   */
  removeRelationship(sourceUid: string, targetUid: string, kind: GenderlessKind): void {
    const edgeKey = `${sourceUid}-${kind}-${targetUid}`;
    if (this.graph.hasEdge(edgeKey)) {
      this.graph.dropEdge(edgeKey);
    }
  }

  /**
   * Check if a relationship exists
   */
  hasRelationship(sourceUid: string, targetUid: string, kind: GenderlessKind): boolean {
    const edgeKey = `${sourceUid}-${kind}-${targetUid}`;
    return this.graph.hasEdge(edgeKey);
  }

  /**
   * Get all relationships for a specific contact
   */
  getContactRelationships(uid: string): RelationshipEdge[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: RelationshipEdge[] = [];

    // Get outbound relationships (this contact -> others)
    this.graph.forEachOutEdge(uid, (edge, attributes, source, target) => {
      relationships.push({
        type: attributes.type as GenderlessKind,
        source: source,
        target: target
      });
    });

    return relationships.sort((a, b) => {
      // Sort by type first, then by target
      const typeCompare = a.type.localeCompare(b.type);
      if (typeCompare !== 0) return typeCompare;
      return a.target.localeCompare(b.target);
    });
  }

  /**
   * Get all contacts that have a specific relationship to the given contact
   */
  getRelatedContacts(uid: string, kind: GenderlessKind): ContactNode[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const related: ContactNode[] = [];
    
    // Get contacts where this uid has the specified relationship TO them
    this.graph.forEachOutEdge(uid, (edge, attributes, source, target) => {
      if (attributes.type === kind) {
        const targetNode = this.graph.getNodeAttributes(target) as ContactNode;
        related.push(targetNode);
      }
    });

    return related.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /**
   * Get all contacts that have a specific relationship FROM the given contact
   */
  getInboundRelatedContacts(uid: string, kind: GenderlessKind): ContactNode[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const related: ContactNode[] = [];
    
    // Get contacts where OTHER contacts have the specified relationship TO this uid
    this.graph.forEachInEdge(uid, (edge, attributes, source, target) => {
      if (attributes.type === kind) {
        const sourceNode = this.graph.getNodeAttributes(source) as ContactNode;
        related.push(sourceNode);
      }
    });

    return related.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /**
   * Get all relationships grouped by type for a contact
   */
  getRelationshipsByType(uid: string): Record<GenderlessKind, ContactNode[]> {
    const relationships: Record<GenderlessKind, ContactNode[]> = {} as Record<GenderlessKind, ContactNode[]>;
    
    if (!this.graph.hasNode(uid)) {
      return relationships;
    }

    this.graph.forEachOutEdge(uid, (edge, attributes, source, target) => {
      const kind = attributes.type as GenderlessKind;
      if (!relationships[kind]) {
        relationships[kind] = [];
      }
      const targetNode = this.graph.getNodeAttributes(target) as ContactNode;
      relationships[kind].push(targetNode);
    });

    // Sort each relationship type by name
    for (const kind in relationships) {
      relationships[kind as GenderlessKind].sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    return relationships;
  }

  /**
   * Convert contact relationships to vCard RELATED fields
   */
  contactToRelatedFields(uid: string): RelatedField[] {
    const relationships = this.getContactRelationships(uid);
    return relationships.map(rel => ({
      type: rel.type,
      value: this.formatRelatedValue(rel.target)
    }));
  }

  /**
   * Format a related value for vCard RELATED field
   */
  private formatRelatedValue(targetUid: string): string {
    const targetNode = this.getNode(targetUid);
    if (!targetNode) {
      return `uid:${targetUid}`;
    }

    // Prefer UUID format if the UID is a valid UUID
    if (this.isValidUUID(targetUid)) {
      return `urn:uuid:${targetUid}`;
    }

    // Use UID format if available
    return `uid:${targetUid}`;
  }

  /**
   * Parse vCard RELATED field value to extract target UID
   */
  parseRelatedValue(value: string): string | null {
    if (value.startsWith('urn:uuid:')) {
      return value.substring('urn:uuid:'.length);
    }
    if (value.startsWith('uid:')) {
      return value.substring('uid:'.length);
    }
    if (value.startsWith('name:')) {
      // For now, we'll return null for name-based references
      // In a full implementation, we'd need to resolve names to UIDs
      return null;
    }
    return value; // Assume it's a direct UID
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
   * Update a contact's gender and refresh node attributes
   */
  updateContactGender(uid: string, gender: Gender): void {
    if (this.graph.hasNode(uid)) {
      this.graph.mergeNodeAttributes(uid, { gender });
    }
  }

  /**
   * Clear all relationships for a contact (but keep the node)
   */
  clearContactRelationships(uid: string): void {
    if (!this.graph.hasNode(uid)) {
      return;
    }

    // Remove all outbound edges
    const outEdges = this.graph.outEdges(uid);
    outEdges.forEach(edge => this.graph.dropEdge(edge));
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

  /**
   * Export graph data for debugging
   */
  exportGraphData(): { nodes: ContactNode[]; edges: RelationshipEdge[] } {
    const nodes = this.getNodes();
    const edges: RelationshipEdge[] = [];

    this.graph.forEachEdge((edge, attributes, source, target) => {
      edges.push({
        type: attributes.type as GenderlessKind,
        source,
        target
      });
    });

    return { nodes, edges };
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Check if a string is a valid UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
}