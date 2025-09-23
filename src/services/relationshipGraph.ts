import { DirectedGraph } from 'graphology';
import { Contact } from 'src/contacts/contactFrontmatter';
import { TFile } from 'obsidian';
import { loggingService } from './loggingService';

export interface RelationshipEdge {
  kind: string;
  sourceContactId: string;
  targetContactId: string;
}

export interface ContactNode {
  uid?: string | null;
  fullName: string;
  file?: TFile;
  gender?: string | null;
}

/**
 * Service for managing relationship graph using Graphology
 * Handles bidirectional mapping between VCard RELATED fields and contact relationships
 */
export class RelationshipGraphService {
  private graph: DirectedGraph<ContactNode, RelationshipEdge>;

  constructor() {
    this.graph = new DirectedGraph();
  }

  /**
   * Add or update a contact node in the graph
   */
  addContactNode(contactId: string, contact: ContactNode): void {
    if (this.graph.hasNode(contactId)) {
      this.graph.mergeNodeAttributes(contactId, contact);
    } else {
      this.graph.addNode(contactId, contact);
    }
    loggingService.info(`Added/updated contact node: ${contactId}`);
  }

  /**
   * Remove a contact node from the graph
   */
  removeContactNode(contactId: string): void {
    if (this.graph.hasNode(contactId)) {
      this.graph.dropNode(contactId);
      loggingService.info(`Removed contact node: ${contactId}`);
    }
  }

  /**
   * Add a relationship edge between two contacts
   */
  addRelationship(sourceId: string, targetId: string, kind: string): void {
    // Ensure both nodes exist
    if (!this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) {
      loggingService.warn(`Cannot add relationship: missing node(s) ${sourceId} -> ${targetId}`);
      return;
    }

    const edgeKey = `${sourceId}-${kind}-${targetId}`;
    
    // Remove existing edges between these nodes first
    if (this.graph.hasEdge(sourceId, targetId)) {
      this.graph.dropEdge(sourceId, targetId);
    }
    
    // Add new edge with specific key
    this.graph.addDirectedEdgeWithKey(edgeKey, sourceId, targetId, {
      kind,
      sourceContactId: sourceId,
      targetContactId: targetId
    });
    
    loggingService.info(`Added relationship: ${sourceId} -[${kind}]-> ${targetId}`);
  }

  /**
   * Remove a specific relationship edge
   */
  removeRelationship(sourceId: string, targetId: string, kind: string): void {
    const edgeKey = `${sourceId}-${kind}-${targetId}`;
    
    if (this.graph.hasEdge(sourceId, targetId)) {
      // Find and remove the specific edge
      try {
        this.graph.dropEdge(sourceId, targetId);
        loggingService.info(`Removed relationship: ${sourceId} -[${kind}]-> ${targetId}`);
      } catch (error) {
        loggingService.warn(`Could not remove relationship: ${sourceId} -[${kind}]-> ${targetId}`);
      }
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
    
    // Outbound relationships (where this contact is the source)
    this.graph.forEachOutboundEdge(contactId, (edge, attributes) => {
      relationships.push(attributes);
    });

    return relationships;
  }

  /**
   * Get contact node by ID
   */
  getContactNode(contactId: string): ContactNode | null {
    if (!this.graph.hasNode(contactId)) {
      return null;
    }
    return this.graph.getNodeAttributes(contactId);
  }

  /**
   * Generate contact ID from UID or full name
   */
  generateContactId(contact: ContactNode): string {
    if (contact.uid && contact.uid.trim() !== '' && this.isValidUUID(contact.uid)) {
      return `urn:uuid:${contact.uid}`;
    } else if (contact.uid && contact.uid.trim() !== '') {
      return `uid:${contact.uid}`;
    } else {
      return `name:${contact.fullName}`;
    }
  }

  /**
   * Parse contact reference from RELATED field value
   */
  parseContactReference(relatedValue: string): { namespace: string; value: string } | null {
    if (relatedValue.startsWith('urn:uuid:')) {
      return { namespace: 'urn:uuid', value: relatedValue.substring(9) };
    } else if (relatedValue.startsWith('uid:')) {
      return { namespace: 'uid', value: relatedValue.substring(4) };
    } else if (relatedValue.startsWith('name:')) {
      return { namespace: 'name', value: relatedValue.substring(5) };
    }
    return null;
  }

  /**
   * Build contact ID from parsed reference
   */
  buildContactIdFromReference(namespace: string, value: string): string {
    return `${namespace}:${value}`;
  }

  /**
   * Check if string is a valid UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.graph.clear();
    loggingService.info('Relationship graph cleared');
  }

  /**
   * Get all contact IDs in the graph
   */
  getAllContactIds(): string[] {
    return this.graph.nodes();
  }

  /**
   * Get statistics about the graph
   */
  getGraphStats(): { nodeCount: number; edgeCount: number } {
    return {
      nodeCount: this.graph.order,
      edgeCount: this.graph.size
    };
  }
}

// Global instance
export const relationshipGraphService = new RelationshipGraphService();