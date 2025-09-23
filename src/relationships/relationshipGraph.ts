/**
 * @fileoverview Relationship graph service using Graphology
 */

import Graph, { DirectedGraph } from 'graphology';
import type { TFile, App } from 'obsidian';
import { 
  RelationshipTriple, 
  ContactReference, 
  ContactGraphNode, 
  RelationshipEdge,
  GENDERED_TO_NEUTRAL,
  GENDER_INFERRING_TERMS 
} from './types';
import { parseKey } from 'src/contacts';
import { getApp } from 'src/context/sharedAppContext';

export class RelationshipGraph {
  private graph: DirectedGraph<ContactGraphNode, RelationshipEdge>;
  private app: App;

  constructor(app?: App) {
    this.graph = new DirectedGraph();
    this.app = app || getApp();
  }

  /**
   * Add or update a contact node in the graph
   */
  addOrUpdateContactNode(uid: string, name: string, gender?: string, exists: boolean = true): void {
    if (this.graph.hasNode(uid)) {
      const existingNode = this.graph.getNodeAttributes(uid);
      this.graph.setNodeAttribute(uid, 'name', name);
      this.graph.setNodeAttribute(uid, 'exists', exists);
      if (gender && gender !== existingNode.gender) {
        this.graph.setNodeAttribute(uid, 'gender', gender);
      }
    } else {
      this.graph.addNode(uid, { uid, name, gender, exists });
    }
  }

  /**
   * Add a relationship edge between two contacts
   */
  addRelationship(fromUid: string, toUid: string, relationshipKind: string): void {
    // Normalize relationship kind to genderless form
    const normalizedKind = GENDERED_TO_NEUTRAL[relationshipKind.toLowerCase()] || relationshipKind.toLowerCase();
    
    // Ensure both nodes exist
    if (!this.graph.hasNode(fromUid)) {
      this.addOrUpdateContactNode(fromUid, 'Unknown', undefined, false);
    }
    if (!this.graph.hasNode(toUid)) {
      this.addOrUpdateContactNode(toUid, 'Unknown', undefined, false);
    }

    const edgeKey = `${fromUid}-${normalizedKind}-${toUid}`;
    
    if (!this.graph.hasDirectedEdge(fromUid, toUid)) {
      this.graph.addDirectedEdgeWithKey(edgeKey, fromUid, toUid, {
        kind: normalizedKind,
        displayKind: relationshipKind
      });
    }
  }

  /**
   * Remove a specific relationship edge
   */
  removeRelationship(fromUid: string, toUid: string, relationshipKind: string): void {
    const normalizedKind = GENDERED_TO_NEUTRAL[relationshipKind.toLowerCase()] || relationshipKind.toLowerCase();
    const edgeKey = `${fromUid}-${normalizedKind}-${toUid}`;
    
    if (this.graph.hasEdge(edgeKey)) {
      this.graph.dropEdge(edgeKey);
    }
  }

  /**
   * Get all relationships for a contact
   */
  getContactRelationships(uid: string): RelationshipTriple[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: RelationshipTriple[] = [];
    
    // Outgoing relationships (this contact related to others)
    this.graph.forEachOutEdge(uid, (edge, attributes, source, target) => {
      relationships.push({
        subject: source,
        relationshipKind: attributes.kind,
        object: target
      });
    });

    return relationships;
  }

  /**
   * Get all incoming relationships for a contact (others related to this contact)
   */
  getIncomingRelationships(uid: string): RelationshipTriple[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: RelationshipTriple[] = [];
    
    this.graph.forEachInEdge(uid, (edge, attributes, source, target) => {
      relationships.push({
        subject: source,
        relationshipKind: attributes.kind,
        object: target
      });
    });

    return relationships;
  }

  /**
   * Get all nodes in the graph
   */
  getAllContacts(): ContactGraphNode[] {
    return this.graph.mapNodes((node, attributes) => attributes);
  }

  /**
   * Check if a contact exists in the graph
   */
  hasContact(uid: string): boolean {
    return this.graph.hasNode(uid);
  }

  /**
   * Get contact info by UID
   */
  getContact(uid: string): ContactGraphNode | null {
    return this.graph.hasNode(uid) ? this.graph.getNodeAttributes(uid) : null;
  }

  /**
   * Update gender for a contact and infer from relationship if possible
   */
  inferAndUpdateGender(uid: string, fromRelationshipTerm: string): boolean {
    if (!this.graph.hasNode(uid)) {
      return false;
    }

    const inferredGender = GENDER_INFERRING_TERMS[fromRelationshipTerm.toLowerCase()];
    if (inferredGender) {
      this.graph.setNodeAttribute(uid, 'gender', inferredGender);
      return true;
    }
    return false;
  }

  /**
   * Clear all data from the graph
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Get graph statistics for debugging
   */
  getStats(): { nodes: number; edges: number } {
    return {
      nodes: this.graph.order,
      edges: this.graph.size
    };
  }

  /**
   * Check for missing reciprocal relationships and return them
   */
  findMissingReciprocalRelationships(): RelationshipTriple[] {
    const missing: RelationshipTriple[] = [];
    
    this.graph.forEachEdge((edge, attributes, source, target) => {
      const reciprocalKind = this.getReciprocalRelationshipKind(attributes.kind);
      if (reciprocalKind) {
        const reciprocalEdgeKey = `${target}-${reciprocalKind}-${source}`;
        if (!this.graph.hasEdge(reciprocalEdgeKey)) {
          missing.push({
            subject: target,
            relationshipKind: reciprocalKind,
            object: source
          });
        }
      }
    });

    return missing;
  }

  /**
   * Get the reciprocal relationship kind (e.g., parent <-> child)
   */
  private getReciprocalRelationshipKind(kind: string): string | null {
    const reciprocals: { [key: string]: string } = {
      'parent': 'child',
      'child': 'parent',
      'spouse': 'spouse',
      'sibling': 'sibling',
      'friend': 'friend',
      'auncle': 'nephew_niece'  // This would need more complex handling
    };
    
    return reciprocals[kind] || null;
  }
}