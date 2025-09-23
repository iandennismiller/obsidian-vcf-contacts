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
  private lastSyncTime: number = 0;
  private readonly syncThrottleMs: number = 5000; // 5 seconds between sync operations

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

  /**
   * Verify and sync all contacts in the graph with their front matter
   * This ensures the graph and front matter are in sync for all contacts
   * Throttled to prevent excessive sync operations
   */
  async syncAllContactsWithFrontMatter(force: boolean = false): Promise<void> {
    const now = Date.now();
    
    // Throttle sync operations unless forced
    if (!force && (now - this.lastSyncTime) < this.syncThrottleMs) {
      loggingService.info(`Skipping sync - throttled (last sync ${Math.floor((now - this.lastSyncTime) / 1000)}s ago)`);
      return;
    }

    this.lastSyncTime = now;
    
    const { updateContactRelatedFrontMatter } = await import('src/util/relationshipFrontMatter');
    const { parseRelatedFromFrontMatter } = await import('src/util/relationshipFrontMatter');
    const { getApp } = await import('src/context/sharedAppContext');
    
    const contactIds = this.getAllContactIds();
    let syncedCount = 0;
    let errorCount = 0;

    loggingService.info(`Starting sync verification for ${contactIds.length} contacts in graph`);

    for (const contactId of contactIds) {
      try {
        const contactNode = this.getContactNode(contactId);
        if (!contactNode?.file) {
          continue;
        }

        // Get current relationships from graph
        const graphRelationships = this.getContactRelationships(contactId);
        
        // Get current relationships from front matter
        const app = getApp();
        const frontMatter = app.metadataCache.getFileCache(contactNode.file)?.frontmatter;
        if (!frontMatter) {
          continue;
        }

        const frontMatterRelationships = parseRelatedFromFrontMatter(frontMatter);

        // Compare and check if sync is needed
        const needsSync = this.compareRelationships(graphRelationships, frontMatterRelationships);

        if (needsSync) {
          // Convert graph relationships to front matter format
          const syncedRelationships = graphRelationships.map(rel => ({
            kind: rel.kind,
            target: rel.targetContactId,
            key: '' // Will be generated when converting to front matter
          }));

          // Update the contact's front matter
          await updateContactRelatedFrontMatter(contactNode.file, syncedRelationships);
          syncedCount++;
          
          loggingService.info(`Synced front matter for contact: ${contactNode.fullName}`);
        }
      } catch (error) {
        errorCount++;
        loggingService.error(`Error syncing contact ${contactId}: ${error}`);
      }
    }

    loggingService.info(`Graph sync completed: ${syncedCount} contacts synced, ${errorCount} errors`);
  }

  /**
   * Verify and add missing reciprocal relationships (backlinks)
   * This ensures that if contact A has a relationship with contact B,
   * then contact B has the appropriate reciprocal relationship with contact A
   */
  async verifyAndAddMissingBacklinks(): Promise<void> {
    const { updateContactRelatedFrontMatter } = await import('src/util/relationshipFrontMatter');
    const { getReciprocalRelationshipKind, shouldHaveReciprocalRelationship } = await import('src/util/relationshipKinds');
    const { getApp } = await import('src/context/sharedAppContext');
    
    const contactIds = this.getAllContactIds();
    let backlinksAdded = 0;
    let errorCount = 0;

    loggingService.info(`Verifying reciprocal relationships for ${contactIds.length} contacts`);

    for (const sourceContactId of contactIds) {
      try {
        const sourceNode = this.getContactNode(sourceContactId);
        if (!sourceNode?.file) {
          continue;
        }

        const sourceRelationships = this.getContactRelationships(sourceContactId);

        for (const relationship of sourceRelationships) {
          const { kind, targetContactId } = relationship;

          // Check if this relationship type should have a reciprocal
          if (!shouldHaveReciprocalRelationship(kind)) {
            continue;
          }

          // Get the reciprocal relationship kind
          const reciprocalKind = getReciprocalRelationshipKind(kind);
          if (!reciprocalKind) {
            continue;
          }

          // Check if target contact exists
          const targetNode = this.getContactNode(targetContactId);
          if (!targetNode?.file) {
            // Target contact doesn't exist as a file, skip
            continue;
          }

          // Check if reciprocal relationship exists
          const targetRelationships = this.getContactRelationships(targetContactId);
          const hasReciprocal = targetRelationships.some(rel => 
            rel.targetContactId === sourceContactId && rel.kind === reciprocalKind
          );

          if (!hasReciprocal) {
            // Add the missing reciprocal relationship to the graph
            this.addRelationship(targetContactId, sourceContactId, reciprocalKind);

            // Update the target contact's front matter
            const updatedTargetRelationships = this.getContactRelationships(targetContactId);
            const syncedRelationships = updatedTargetRelationships.map(rel => ({
              kind: rel.kind,
              target: rel.targetContactId,
              key: '' // Will be generated when converting to front matter
            }));

            await updateContactRelatedFrontMatter(targetNode.file, syncedRelationships);
            backlinksAdded++;

            loggingService.info(`Added missing reciprocal relationship: ${targetNode.fullName} -[${reciprocalKind}]-> ${sourceNode.fullName}`);
          }
        }
      } catch (error) {
        errorCount++;
        loggingService.error(`Error verifying backlinks for contact ${sourceContactId}: ${error}`);
      }
    }

    loggingService.info(`Backlink verification completed: ${backlinksAdded} backlinks added, ${errorCount} errors`);
  }

  /**
   * Compare graph relationships with front matter relationships
   * Returns true if they differ and sync is needed
   */
  private compareRelationships(
    graphRelationships: Array<{ kind: string; targetContactId: string }>,
    frontMatterRelationships: Array<{ kind: string; target: string }>
  ): boolean {
    // Quick length check
    if (graphRelationships.length !== frontMatterRelationships.length) {
      return true;
    }

    // Create normalized sets for comparison
    const graphSet = new Set(
      graphRelationships.map(rel => `${rel.kind}:${rel.targetContactId}`)
    );
    
    const frontMatterSet = new Set(
      frontMatterRelationships.map(rel => `${rel.kind}:${rel.target}`)
    );

    // Check if sets are equal
    if (graphSet.size !== frontMatterSet.size) {
      return true;
    }

    for (const item of graphSet) {
      if (!frontMatterSet.has(item)) {
        return true;
      }
    }

    return false;
  }
}

// Global instance
export const relationshipGraphService = new RelationshipGraphService();