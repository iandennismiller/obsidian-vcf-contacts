import { DirectedGraph } from 'graphology';
import type { Attributes } from 'graphology-types';

export interface RelationshipEdge {
  kind: string;
  genderless: boolean;
}

export interface ContactNode {
  uid?: string;
  name: string;
  gender?: 'M' | 'F' | 'O' | 'N' | 'U'; // vCard 4.0 gender values
}

export interface RelationshipReference {
  uid?: string;
  name?: string;
  namespace: 'urn:uuid' | 'name' | 'uid';
}

/**
 * Manages the relationship graph between contacts using Graphology.
 * 
 * Features:
 * - Directed graph with multiple edges per node pair
 * - Genderless relationship kinds with gender-aware rendering
 * - Bidirectional sync with front matter RELATED fields
 * - Consistency checking and repair
 */
export class RelationshipGraph {
  private graph: DirectedGraph<ContactNode, RelationshipEdge>;
  
  // Mapping of gendered terms to genderless kinds
  private readonly GENDERED_TERMS = new Map([
    ['mother', { kind: 'parent', gender: 'F' }],
    ['mom', { kind: 'parent', gender: 'F' }],
    ['father', { kind: 'parent', gender: 'M' }],
    ['dad', { kind: 'parent', gender: 'M' }],
    ['parent', { kind: 'parent', gender: null }],
    ['sister', { kind: 'sibling', gender: 'F' }],
    ['brother', { kind: 'sibling', gender: 'M' }],
    ['sibling', { kind: 'sibling', gender: null }],
    ['daughter', { kind: 'child', gender: 'F' }],
    ['son', { kind: 'child', gender: 'M' }],
    ['child', { kind: 'child', gender: null }],
    ['aunt', { kind: 'auncle', gender: 'F' }],
    ['uncle', { kind: 'auncle', gender: 'M' }],
    ['auncle', { kind: 'auncle', gender: null }],
    ['niece', { kind: 'nibling', gender: 'F' }],
    ['nephew', { kind: 'nibling', gender: 'M' }],
    ['nibling', { kind: 'nibling', gender: null }],
    ['wife', { kind: 'spouse', gender: 'F' }],
    ['husband', { kind: 'spouse', gender: 'M' }],
    ['spouse', { kind: 'spouse', gender: null }],
    ['friend', { kind: 'friend', gender: null }],
    ['colleague', { kind: 'colleague', gender: null }],
    ['acquaintance', { kind: 'acquaintance', gender: null }],
  ]);

  constructor() {
    this.graph = new DirectedGraph<ContactNode, RelationshipEdge>();
  }

  /**
   * Add or update a contact node in the graph
   */
  addContact(uid: string, name: string, gender?: string): void {
    const nodeId = this.getNodeId(uid, name);
    const nodeData: ContactNode = { uid, name };
    if (gender && ['M', 'F', 'O', 'N', 'U'].includes(gender)) {
      nodeData.gender = gender as ContactNode['gender'];
    }
    
    if (this.graph.hasNode(nodeId)) {
      this.graph.mergeNodeAttributes(nodeId, nodeData);
    } else {
      this.graph.addNode(nodeId, nodeData);
    }
  }

  /**
   * Add a relationship edge between two contacts
   */
  addRelationship(fromUid: string, fromName: string, toUid: string, toName: string, relationshipKind: string): void {
    const fromNodeId = this.getNodeId(fromUid, fromName);
    const toNodeId = this.getNodeId(toUid, toName);
    
    // Ensure both nodes exist
    this.addContact(fromUid, fromName);
    this.addContact(toUid, toName);
    
    // Process gendered relationship term and infer gender
    const { kind: genderlessKind, gender: inferredGender } = this.processRelationshipTerm(relationshipKind);
    
    // Update target's gender if we inferred it
    if (inferredGender) {
      this.updateContactGender(toUid, toName, inferredGender);
    }
    
    // Add the edge (Graphology allows multiple edges between nodes)
    const edgeId = `${fromNodeId}-${genderlessKind}-${toNodeId}`;
    
    // Check if this specific relationship already exists
    let edgeExists = false;
    if (this.graph.hasEdge(fromNodeId, toNodeId)) {
      this.graph.forEachEdge(fromNodeId, toNodeId, (key, attributes) => {
        if (attributes.kind === genderlessKind) {
          edgeExists = true;
        }
      });
    }
    
    if (!edgeExists) {
      this.graph.addEdgeWithKey(edgeId, fromNodeId, toNodeId, {
        kind: genderlessKind,
        genderless: genderlessKind !== relationshipKind
      });
    }
  }

  /**
   * Get all relationships for a contact
   */
  getContactRelationships(uid: string, name: string): Array<{
    targetUid: string;
    targetName: string;
    relationshipKind: string;
    reference: RelationshipReference;
  }> {
    const nodeId = this.getNodeId(uid, name);
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const relationships: Array<{
      targetUid: string;
      targetName: string;
      relationshipKind: string;
      reference: RelationshipReference;
    }> = [];

    // Get all outbound edges
    this.graph.forEachOutboundEdge(nodeId, (edgeKey, attributes, source, target) => {
      const targetNode = this.graph.getNodeAttributes(target);
      const relationshipKind = this.renderRelationshipKind(attributes.kind, targetNode.gender);
      
      relationships.push({
        targetUid: targetNode.uid || '',
        targetName: targetNode.name,
        relationshipKind,
        reference: this.createRelationshipReference(targetNode.uid, targetNode.name)
      });
    });

    // Sort by relationship kind then by target name
    return relationships.sort((a, b) => {
      const kindCompare = a.relationshipKind.localeCompare(b.relationshipKind);
      return kindCompare !== 0 ? kindCompare : a.targetName.localeCompare(b.targetName);
    });
  }

  /**
   * Remove a relationship between two contacts
   */
  removeRelationship(fromUid: string, fromName: string, toUid: string, toName: string, relationshipKind: string): void {
    const fromNodeId = this.getNodeId(fromUid, fromName);
    const toNodeId = this.getNodeId(toUid, toName);
    const { kind: genderlessKind } = this.processRelationshipTerm(relationshipKind);
    
    // Find and remove the specific edge
    if (this.graph.hasEdge(fromNodeId, toNodeId)) {
      const edgesToRemove: string[] = [];
      this.graph.forEachEdge(fromNodeId, toNodeId, (key, attributes) => {
        if (attributes.kind === genderlessKind) {
          edgesToRemove.push(key);
        }
      });
      
      edgesToRemove.forEach(edgeKey => {
        this.graph.dropEdge(edgeKey);
      });
    }
  }

  /**
   * Update a contact's gender
   */
  updateContactGender(uid: string, name: string, gender: string): void {
    const nodeId = this.getNodeId(uid, name);
    if (this.graph.hasNode(nodeId) && ['M', 'F', 'O', 'N', 'U'].includes(gender)) {
      this.graph.mergeNodeAttributes(nodeId, { gender: gender as ContactNode['gender'] });
    }
  }

  /**
   * Check graph consistency and return missing reciprocal relationships
   */
  checkConsistency(): Array<{
    fromUid: string;
    fromName: string;
    toUid: string;
    toName: string;
    missingRelationshipKind: string;
  }> {
    const missingRelationships: Array<{
      fromUid: string;
      fromName: string;
      toUid: string;
      toName: string;
      missingRelationshipKind: string;
    }> = [];

    // For each relationship, check if reciprocal exists
    this.graph.forEachEdge((edgeKey, attributes, source, target) => {
      const sourceNode = this.graph.getNodeAttributes(source);
      const targetNode = this.graph.getNodeAttributes(target);
      const reciprocalKind = this.getReciprocalRelationship(attributes.kind, sourceNode.gender);
      
      if (reciprocalKind) {
        // Check if reciprocal relationship exists
        let reciprocalExists = false;
        if (this.graph.hasEdge(target, source)) {
          this.graph.forEachEdge(target, source, (key, attributes) => {
            if (attributes.kind === reciprocalKind) {
              reciprocalExists = true;
            }
          });
        }
        
        if (!reciprocalExists) {
          missingRelationships.push({
            fromUid: targetNode.uid || '',
            fromName: targetNode.name,
            toUid: sourceNode.uid || '',
            toName: sourceNode.name,
            missingRelationshipKind: reciprocalKind
          });
        }
      }
    });

    return missingRelationships;
  }

  /**
   * Clear all data from the graph
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Get node ID from UID and name
   */
  private getNodeId(uid: string, name: string): string {
    return uid || `name:${name}`;
  }

  /**
   * Process relationship term to extract genderless kind and infer gender
   */
  private processRelationshipTerm(term: string): { kind: string; gender: string | null } {
    const normalizedTerm = term.toLowerCase().trim();
    const mapping = this.GENDERED_TERMS.get(normalizedTerm);
    
    if (mapping) {
      return { kind: mapping.kind, gender: mapping.gender };
    }
    
    // If not found in mapping, use the term as-is
    return { kind: term, gender: null };
  }

  /**
   * Render relationship kind based on gender
   */
  private renderRelationshipKind(genderlessKind: string, targetGender?: string): string {
    // Special cases for gendered rendering
    switch (genderlessKind) {
      case 'auncle':
        return targetGender === 'F' ? 'aunt' : targetGender === 'M' ? 'uncle' : 'aunt/uncle';
      case 'nibling':
        return targetGender === 'F' ? 'niece' : targetGender === 'M' ? 'nephew' : 'niece/nephew';
      case 'parent':
        return targetGender === 'F' ? 'mother' : targetGender === 'M' ? 'father' : 'parent';
      case 'child':
        return targetGender === 'F' ? 'daughter' : targetGender === 'M' ? 'son' : 'child';
      case 'sibling':
        return targetGender === 'F' ? 'sister' : targetGender === 'M' ? 'brother' : 'sibling';
      case 'spouse':
        return targetGender === 'F' ? 'wife' : targetGender === 'M' ? 'husband' : 'spouse';
      default:
        return genderlessKind;
    }
  }

  /**
   * Get reciprocal relationship kind
   */
  private getReciprocalRelationship(kind: string, sourceGender?: string): string | null {
    switch (kind) {
      case 'parent':
        return 'child';
      case 'child':
        return 'parent';
      case 'sibling':
        return 'sibling';
      case 'spouse':
        return 'spouse';
      case 'auncle':
        return 'nibling';
      case 'nibling':
        return 'auncle';
      case 'friend':
        return 'friend';
      default:
        return null; // No reciprocal for some relationships like colleague, acquaintance
    }
  }

  /**
   * Create relationship reference based on UID format
   */
  private createRelationshipReference(uid?: string, name?: string): RelationshipReference {
    if (uid) {
      // Check if UID is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(uid)) {
        return { uid, namespace: 'urn:uuid' };
      } else {
        return { uid, namespace: 'uid' };
      }
    } else if (name) {
      return { name, namespace: 'name' };
    }
    
    throw new Error('Either UID or name must be provided for relationship reference');
  }
}