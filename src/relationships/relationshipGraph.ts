/**
 * @fileoverview Relationship Graph Service using Graphology
 * 
 * This module manages the social graph of contacts using the Graphology library.
 * It provides bidirectional mapping between the graph structure and contact front matter.
 */

import { MultiDirectedGraph } from 'graphology';
import type { TFile } from 'obsidian';
import { Contact } from 'src/contacts';

export interface RelationshipEdge {
  kind: string;
  sourceUID: string;
  targetUID: string;
}

export interface ContactNode {
  uid: string;
  name?: string;
  file?: TFile;
  gender?: string;
}

export interface RelatedContact {
  kind: string;
  targetUID: string;
  targetName?: string;
}

/**
 * Gender mapping for relationship terms
 */
const GENDERED_RELATIONSHIPS: Record<string, { baseKind: string; gender: 'male' | 'female' }> = {
  'mother': { baseKind: 'parent', gender: 'female' },
  'mom': { baseKind: 'parent', gender: 'female' },
  'father': { baseKind: 'parent', gender: 'male' },
  'dad': { baseKind: 'parent', gender: 'male' },
  'sister': { baseKind: 'sibling', gender: 'female' },
  'brother': { baseKind: 'sibling', gender: 'male' },
  'daughter': { baseKind: 'child', gender: 'female' },
  'son': { baseKind: 'child', gender: 'male' },
  'aunt': { baseKind: 'auncle', gender: 'female' },
  'uncle': { baseKind: 'auncle', gender: 'male' },
  'wife': { baseKind: 'spouse', gender: 'female' },
  'husband': { baseKind: 'spouse', gender: 'male' },
  'girlfriend': { baseKind: 'partner', gender: 'female' },
  'boyfriend': { baseKind: 'partner', gender: 'male' }
};

/**
 * Service for managing relationship graph using Graphology
 */
export class RelationshipGraphService {
  private graph: MultiDirectedGraph;
  
  constructor() {
    this.graph = new MultiDirectedGraph();
  }

  /**
   * Parse gendered relationship term and return base kind and inferred gender
   */
  parseRelationshipTerm(term: string): { kind: string; inferredGender?: 'male' | 'female' } {
    const lowercaseTerm = term.toLowerCase();
    
    if (GENDERED_RELATIONSHIPS[lowercaseTerm]) {
      const { baseKind, gender } = GENDERED_RELATIONSHIPS[lowercaseTerm];
      return { kind: baseKind, inferredGender: gender };
    }
    
    return { kind: lowercaseTerm };
  }

  /**
   * Add or update a contact node in the graph
   */
  addContact(contact: ContactNode): void {
    if (!this.graph.hasNode(contact.uid)) {
      this.graph.addNode(contact.uid, {
        name: contact.name,
        file: contact.file,
        gender: contact.gender
      });
    } else {
      this.graph.updateNode(contact.uid, (attrs) => ({
        ...attrs,
        name: contact.name || attrs.name,
        file: contact.file || attrs.file,
        gender: contact.gender || attrs.gender
      }));
    }
  }

  /**
   * Add a relationship edge between two contacts
   */
  addRelationship(sourceUID: string, targetUID: string, kind: string): void {
    // Ensure both nodes exist in the graph
    if (!this.graph.hasNode(sourceUID)) {
      this.addContact({ uid: sourceUID });
    }
    if (!this.graph.hasNode(targetUID)) {
      this.addContact({ uid: targetUID });
    }

    // Create edge key for multiple relationships between same contacts
    const edgeKey = `${sourceUID}-${targetUID}-${kind}`;
    
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addDirectedEdgeWithKey(edgeKey, sourceUID, targetUID, { kind });
    }
  }

  /**
   * Remove a relationship edge
   */
  removeRelationship(sourceUID: string, targetUID: string, kind: string): void {
    const edgeKey = `${sourceUID}-${targetUID}-${kind}`;
    if (this.graph.hasEdge(edgeKey)) {
      this.graph.dropEdge(edgeKey);
    }
  }

  /**
   * Get all relationships for a contact
   */
  getRelationships(uid: string): RelatedContact[] {
    if (!this.graph.hasNode(uid)) {
      return [];
    }

    const relationships: RelatedContact[] = [];
    
    // Get outgoing edges (relationships this contact has)
    this.graph.forEachOutboundEdge(uid, (edge, attributes, source, target) => {
      const targetNode = this.graph.getNodeAttributes(target);
      relationships.push({
        kind: attributes.kind,
        targetUID: target,
        targetName: targetNode?.name
      });
    });

    return relationships;
  }

  /**
   * Convert relationships to RELATED front matter format
   * Returns array of [key, value] pairs for front matter
   */
  relationshipsToFrontMatter(uid: string): [string, string][] {
    const relationships = this.getRelationships(uid);
    
    // Group relationships by kind
    const groupedByKind: Record<string, string[]> = {};
    
    relationships.forEach(({ kind, targetUID }) => {
      if (!groupedByKind[kind]) {
        groupedByKind[kind] = [];
      }
      // Format as vCard RELATED field value
      const value = this.formatRelatedValue(targetUID);
      groupedByKind[kind].push(value);
    });

    // Convert to front matter array format
    const frontMatterEntries: [string, string][] = [];
    
    Object.entries(groupedByKind).forEach(([kind, values]) => {
      values.sort(); // Sort for consistency
      
      values.forEach((value, index) => {
        const key = index === 0 ? `RELATED[${kind}]` : `RELATED[${index}:${kind}]`;
        frontMatterEntries.push([key, value]);
      });
    });

    return frontMatterEntries;
  }

  /**
   * Parse RELATED front matter entries and add to graph
   */
  frontMatterToGraph(uid: string, frontMatter: Record<string, any>): void {
    // First remove existing relationships for this contact
    if (this.graph.hasNode(uid)) {
      const edges = this.graph.outboundEdges(uid);
      edges.forEach(edge => this.graph.dropEdge(edge));
    }

    // Parse RELATED fields
    Object.entries(frontMatter).forEach(([key, value]) => {
      if (key.startsWith('RELATED[') && typeof value === 'string') {
        const kindMatch = key.match(/^RELATED\[(?:\d+:)?([^\]]+)\]$/);
        if (kindMatch) {
          const kind = kindMatch[1];
          const targetUID = this.parseRelatedValue(value);
          if (targetUID) {
            this.addRelationship(uid, targetUID, kind);
          }
        }
      }
    });
  }

  /**
   * Format a UID as a RELATED field value
   */
  private formatRelatedValue(uid: string): string {
    // Check if UID is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(uid)) {
      return `urn:uuid:${uid}`;
    } else if (uid.startsWith('name:')) {
      return uid; // Already in name format
    } else {
      return `uid:${uid}`;
    }
  }

  /**
   * Parse a RELATED field value to extract UID
   */
  private parseRelatedValue(value: string): string | null {
    if (value.startsWith('urn:uuid:')) {
      return value.substring(9);
    } else if (value.startsWith('uid:')) {
      return value.substring(4);
    } else if (value.startsWith('name:')) {
      return value; // Keep name: format for now
    }
    
    return null;
  }

  /**
   * Check graph consistency and return missing reciprocal relationships
   */
  checkConsistency(): Array<{ sourceUID: string; targetUID: string; kind: string }> {
    const missingReciprocals: Array<{ sourceUID: string; targetUID: string; kind: string }> = [];
    
    this.graph.forEachEdge((edge, attributes, source, target) => {
      const { kind } = attributes;
      
      // Check if there's a reciprocal relationship
      const reciprocalKind = this.getReciprocalRelationship(kind);
      if (reciprocalKind) {
        const reciprocalEdgeKey = `${target}-${source}-${reciprocalKind}`;
        if (!this.graph.hasEdge(reciprocalEdgeKey)) {
          missingReciprocals.push({
            sourceUID: target,
            targetUID: source,
            kind: reciprocalKind
          });
        }
      }
    });
    
    return missingReciprocals;
  }

  /**
   * Get the reciprocal relationship type
   */
  private getReciprocalRelationship(kind: string): string | null {
    const reciprocals: Record<string, string> = {
      'parent': 'child',
      'child': 'parent',
      'sibling': 'sibling',
      'spouse': 'spouse',
      'partner': 'partner',
      'friend': 'friend',
      'auncle': 'nibling' // aunt/uncle -> nephew/niece (gender neutral)
    };
    
    return reciprocals[kind] || null;
  }

  /**
   * Get all contacts in the graph
   */
  getAllContacts(): ContactNode[] {
    return this.graph.nodes().map(uid => ({
      uid,
      ...this.graph.getNodeAttributes(uid)
    }));
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.graph.clear();
  }
}