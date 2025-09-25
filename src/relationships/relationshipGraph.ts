import Graph from 'graphology';
import { TFile } from 'obsidian';
import { 
  ContactNode, 
  RelationshipEdge, 
  RelatedField, 
  RelationshipType, 
  Gender,
  ContactRelationship
} from './types';
import { loggingService } from 'src/services/loggingService';

/**
 * Relationship graph for managing contact relationships
 * Uses Graphology for efficient graph operations
 */
export class RelationshipGraph {
  private graph: Graph<ContactNode, RelationshipEdge>;

  constructor() {
    this.graph = new Graph({ type: 'directed', allowSelfLoops: false });
  }

  /**
   * Add a contact node to the graph
   */
  addNode(uid: string, fullName?: string, gender?: Gender, file?: TFile): void {
    if (this.graph.hasNode(uid)) {
      // Update existing node
      this.graph.updateNodeAttributes(uid, (attributes) => ({
        ...attributes,
        ...(fullName && { fullName }),
        ...(gender && { gender }),
        ...(file && { file })
      }));
    } else {
      // Add new node
      this.graph.addNode(uid, {
        uid,
        fullName: fullName || uid,
        gender,
        file
      });
    }
    
    loggingService.info(`[RelationshipGraph] Added/updated node: ${uid} (${fullName})`);
  }

  /**
   * Remove a contact node from the graph
   */
  removeNode(uid: string): void {
    if (this.graph.hasNode(uid)) {
      this.graph.dropNode(uid);
      loggingService.info(`[RelationshipGraph] Removed node: ${uid}`);
    }
  }

  /**
   * Add a relationship edge between two contacts
   */
  addRelationship(sourceUid: string, targetUid: string, relationshipType: RelationshipType): void {
    if (!this.graph.hasNode(sourceUid) || !this.graph.hasNode(targetUid)) {
      throw new Error(`Cannot add relationship: missing node(s) - ${sourceUid} or ${targetUid}`);
    }

    // Check for existing edge of same type to avoid duplicates
    const edgeKey = this.findEdge(sourceUid, targetUid, relationshipType);
    if (edgeKey) {
      loggingService.debug(`[RelationshipGraph] Relationship already exists: ${sourceUid} -[${relationshipType}]-> ${targetUid}`);
      return;
    }

    // Add the edge
    this.graph.addEdge(sourceUid, targetUid, {
      type: relationshipType,
      source: sourceUid,
      target: targetUid
    });

    loggingService.info(`[RelationshipGraph] Added relationship: ${sourceUid} -[${relationshipType}]-> ${targetUid}`);
  }

  /**
   * Remove a relationship edge
   */
  removeRelationship(sourceUid: string, targetUid: string, relationshipType: RelationshipType): void {
    const edgeKey = this.findEdge(sourceUid, targetUid, relationshipType);
    if (edgeKey) {
      this.graph.dropEdge(edgeKey);
      loggingService.info(`[RelationshipGraph] Removed relationship: ${sourceUid} -[${relationshipType}]-> ${targetUid}`);
    }
  }

  /**
   * Check if a relationship exists
   */
  hasRelationship(sourceUid: string, targetUid: string, relationshipType: RelationshipType): boolean {
    return this.findEdge(sourceUid, targetUid, relationshipType) !== null;
  }

  /**
   * Get all relationships for a contact
   */
  getContactRelationships(uid: string): ContactRelationship[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: ContactRelationship[] = [];
    
    this.graph.forEachOutEdge(uid, (edge, attributes, source, target) => {
      const targetNode = this.graph.getNodeAttributes(target);
      relationships.push({
        type: attributes.type,
        targetUid: target,
        targetName: targetNode.fullName
      });
    });

    // Sort relationships by type then by target name for consistent ordering
    return relationships.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.targetName.localeCompare(b.targetName);
    });
  }

  /**
   * Get all contacts that have a specific relationship to the given contact
   */
  getRelatedContacts(uid: string, relationshipType: RelationshipType): ContactNode[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const related: ContactNode[] = [];
    
    this.graph.forEachInEdge(uid, (edge, attributes, source, target) => {
      if (attributes.type === relationshipType) {
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
   * Get all nodes in the graph
   */
  getNodes(): ContactNode[] {
    return this.graph.nodes().map(uid => this.graph.getNodeAttributes(uid));
  }

  /**
   * Get a specific node
   */
  getNode(uid: string): ContactNode | null {
    return this.graph.hasNode(uid) ? this.graph.getNodeAttributes(uid) : null;
  }

  /**
   * Check for consistency issues
   */
  checkConsistency(): {
    missingReciprocals: Array<{
      sourceUid: string;
      targetUid: string;
      relationshipType: RelationshipType;
      reciprocalType: RelationshipType;
    }>;
    duplicateEdges: Array<{
      sourceUid: string;
      targetUid: string;
      relationshipType: RelationshipType;
    }>;
  } {
    const missingReciprocals: Array<{
      sourceUid: string;
      targetUid: string;
      relationshipType: RelationshipType;
      reciprocalType: RelationshipType;
    }> = [];
    
    const duplicateEdges: Array<{
      sourceUid: string;
      targetUid: string;
      relationshipType: RelationshipType;
    }> = [];

    // Check for duplicate edges (same relationship type between same nodes)
    const seenEdges = new Set<string>();
    this.graph.forEachEdge((edge, attributes, source, target) => {
      const edgeSignature = `${source}-${target}-${attributes.type}`;
      if (seenEdges.has(edgeSignature)) {
        duplicateEdges.push({
          sourceUid: source,
          targetUid: target,
          relationshipType: attributes.type
        });
      } else {
        seenEdges.add(edgeSignature);
      }
    });

    // Check for missing reciprocals based on relationship types
    this.graph.forEachEdge((edge, attributes, source, target) => {
      const reciprocalType = this.getReciprocalRelationshipType(attributes.type);
      if (reciprocalType) {
        const hasReciprocal = this.hasRelationship(target, source, reciprocalType);
        if (!hasReciprocal) {
          missingReciprocals.push({
            sourceUid: source,
            targetUid: target,
            relationshipType: attributes.type,
            reciprocalType
          });
        }
      }
    });

    return { missingReciprocals, duplicateEdges };
  }

  /**
   * Clear all relationships
   */
  clear(): void {
    this.graph.clear();
    loggingService.info('[RelationshipGraph] Graph cleared');
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

  // Private helper methods

  private findEdge(sourceUid: string, targetUid: string, relationshipType: RelationshipType): string | null {
    try {
      // Use directed edge search - only check outbound edges from source to target
      const outEdges = this.graph.outEdges(sourceUid);
      for (const edge of outEdges) {
        const target = this.graph.target(edge);
        const attributes = this.graph.getEdgeAttributes(edge);
        if (target === targetUid && attributes.type === relationshipType) {
          return edge;
        }
      }
    } catch (error) {
      // Nodes might not exist or no edges between them
    }
    return null;
  }

  private formatRelatedValue(targetUid: string, targetName: string): string {
    // Prefer UUID format if the UID is a valid UUID
    if (targetUid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return `urn:uuid:${targetUid}`;
    }
    
    // If UID exists but isn't a valid UUID
    if (targetUid && targetUid !== targetName) {
      return `uid:${targetUid}`;
    }
    
    // Fallback to name
    return `name:${targetName}`;
  }

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
    return value;
  }

  private getReciprocalRelationshipType(type: RelationshipType): RelationshipType | null {
    const reciprocals: Record<RelationshipType, RelationshipType> = {
      parent: 'child',
      child: 'parent',
      sibling: 'sibling',
      spouse: 'spouse',
      friend: 'friend',
      colleague: 'colleague',
      relative: 'relative',
      auncle: 'nibling',
      nibling: 'auncle',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
      cousin: 'cousin',
      partner: 'partner'
    };
    
    return reciprocals[type] || null;
  }
}