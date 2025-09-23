/**
 * @fileoverview Graph-based relationship management using Graphology.
 * 
 * This module provides:
 * - Core relationship graph representation using Graphology
 * - Bidirectional mapping between vCard 4.0, YAML frontmatter, and markdown
 * - Graph operations for relationship consistency
 * - Event-driven synchronization with proper precedence control
 */

import Graph from 'graphology';
import { Attributes } from 'graphology-types';
import { App, TFile } from 'obsidian';
import { getFrontmatterFromFiles } from './contactFrontmatter';
import { RELATIONSHIP_TYPES } from './relationships';
import { loggingService } from '../services/loggingService';

export interface ContactNode {
  uid: string;
  name: string;
  file?: TFile;
  exists: boolean;
}

export interface RelationshipEdge {
  type: string;
  isNameBased: boolean;
  source: string; // UID
  target: string; // UID or name
}

export interface GraphSyncResult {
  success: boolean;
  changes: {
    nodesAdded: number;
    edgesAdded: number;
    edgesRemoved: number;
    filesUpdated: string[];
  };
  errors: string[];
}

/**
 * Core relationship graph manager using Graphology.
 * Maintains the authoritative representation of all contact relationships.
 */
export class RelationshipGraph {
  private graph: Graph;
  private app: App;
  private uidToFileMap: Map<string, TFile> = new Map();
  private nameToUidMap: Map<string, string> = new Map();

  constructor(app: App) {
    this.app = app;
    this.graph = new Graph({ type: 'directed', allowSelfLoops: false });
    this.initialize();
  }

  /**
   * Initialize the graph from existing contact files.
   */
  private async initialize(): Promise<void> {
    try {
      await this.rebuildFromContacts();
      loggingService.info('Relationship graph initialized successfully');
    } catch (error) {
      loggingService.error('Failed to initialize relationship graph:', error);
    }
  }

  /**
   * Rebuild the entire graph from contact files.
   */
  async rebuildFromContacts(): Promise<GraphSyncResult> {
    const result: GraphSyncResult = {
      success: true,
      changes: { nodesAdded: 0, edgesAdded: 0, edgesRemoved: 0, filesUpdated: [] },
      errors: []
    };

    try {
      // Clear existing graph
      this.graph.clear();
      this.uidToFileMap.clear();
      this.nameToUidMap.clear();

      // Get all contact files
      const contactFiles = this.getAllContactFiles();
      
      // First pass: Add all nodes
      for (const file of contactFiles) {
        await this.addContactNode(file);
        result.changes.nodesAdded++;
      }

      // Second pass: Add all relationships
      for (const file of contactFiles) {
        const relationships = await this.extractRelationshipsFromFile(file);
        for (const rel of relationships) {
          if (this.addRelationshipEdge(rel.source, rel.target, rel.type, rel.isNameBased)) {
            result.changes.edgesAdded++;
          }
        }
      }

      loggingService.info(`Graph rebuilt: ${result.changes.nodesAdded} nodes, ${result.changes.edgesAdded} edges`);
    } catch (error) {
      result.success = false;
      result.errors.push(`Graph rebuild failed: ${error.message}`);
      loggingService.error('Graph rebuild failed:', error);
    }

    return result;
  }

  /**
   * Add a contact node to the graph.
   */
  private async addContactNode(file: TFile): Promise<boolean> {
    try {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter) return false;

      const uid = frontmatter.UID || frontmatter.uid;
      const name = frontmatter.FN || frontmatter.fn || file.basename;

      if (!uid) {
        loggingService.warn(`Contact file ${file.path} has no UID`);
        return false;
      }

      const nodeData: ContactNode = {
        uid,
        name,
        file,
        exists: true
      };

      if (!this.graph.hasNode(uid)) {
        this.graph.addNode(uid, nodeData);
        this.uidToFileMap.set(uid, file);
        this.nameToUidMap.set(name, uid);
        return true;
      }

      return false;
    } catch (error) {
      loggingService.error(`Failed to add contact node for ${file.path}:`, error);
      return false;
    }
  }

  /**
   * Add a relationship edge to the graph.
   */
  addRelationshipEdge(sourceUid: string, targetIdentifier: string, relationshipType: string, isNameBased: boolean = false): boolean {
    try {
      // Ensure source node exists
      if (!this.graph.hasNode(sourceUid)) {
        loggingService.warn(`Source node ${sourceUid} not found in graph`);
        return false;
      }

      let targetUid = targetIdentifier;

      // Handle name-based relationships
      if (isNameBased) {
        const existingUid = this.nameToUidMap.get(targetIdentifier);
        if (existingUid) {
          // Contact now exists, use UID
          targetUid = existingUid;
          isNameBased = false;
        } else {
          // Create phantom node for missing contact
          targetUid = `name:${targetIdentifier}`;
          if (!this.graph.hasNode(targetUid)) {
            const phantomNode: ContactNode = {
              uid: targetUid,
              name: targetIdentifier,
              exists: false
            };
            this.graph.addNode(targetUid, phantomNode);
          }
        }
      }

      // Ensure target node exists
      if (!this.graph.hasNode(targetUid)) {
        loggingService.warn(`Target node ${targetUid} not found in graph`);
        return false;
      }

      const edgeKey = `${sourceUid}-${targetUid}-${relationshipType}`;
      
      if (!this.graph.hasEdge(edgeKey)) {
        const edgeData: RelationshipEdge = {
          type: relationshipType,
          isNameBased,
          source: sourceUid,
          target: targetUid
        };

        this.graph.addEdgeWithKey(edgeKey, sourceUid, targetUid, edgeData);
        return true;
      }

      return false;
    } catch (error) {
      loggingService.error(`Failed to add relationship edge:`, error);
      return false;
    }
  }

  /**
   * Remove a relationship edge from the graph.
   */
  removeRelationshipEdge(sourceUid: string, targetIdentifier: string, relationshipType: string): boolean {
    try {
      let targetUid = targetIdentifier;
      
      // Handle name-based relationships
      if (targetIdentifier.startsWith('name:')) {
        targetUid = targetIdentifier;
      } else {
        const nameBasedUid = `name:${targetIdentifier}`;
        if (this.graph.hasNode(nameBasedUid)) {
          targetUid = nameBasedUid;
        }
      }

      const edgeKey = `${sourceUid}-${targetUid}-${relationshipType}`;
      
      if (this.graph.hasEdge(edgeKey)) {
        this.graph.dropEdge(edgeKey);
        
        // Remove phantom nodes that have no edges
        if (targetUid.startsWith('name:') && this.graph.degree(targetUid) === 0) {
          this.graph.dropNode(targetUid);
        }
        
        return true;
      }

      return false;
    } catch (error) {
      loggingService.error(`Failed to remove relationship edge:`, error);
      return false;
    }
  }

  /**
   * Get all relationships for a contact.
   */
  getContactRelationships(uid: string): RelationshipEdge[] {
    try {
      if (!this.graph.hasNode(uid)) {
        return [];
      }

      const relationships: RelationshipEdge[] = [];
      
      // Get outgoing edges (relationships this contact has)
      this.graph.forEachOutEdge(uid, (edgeKey, edgeAttrs) => {
        relationships.push(edgeAttrs as RelationshipEdge);
      });

      return relationships;
    } catch (error) {
      loggingService.error(`Failed to get contact relationships for ${uid}:`, error);
      return [];
    }
  }

  /**
   * Add a bidirectional relationship with complement.
   */
  addBidirectionalRelationship(sourceUid: string, targetIdentifier: string, relationshipType: string, isNameBased: boolean = false): boolean {
    try {
      // Add primary relationship
      const added = this.addRelationshipEdge(sourceUid, targetIdentifier, relationshipType, isNameBased);
      
      if (added) {
        // Add complement relationship
        const relationshipDef = RELATIONSHIP_TYPES[relationshipType.toLowerCase()];
        if (relationshipDef?.complement) {
          const complementType = relationshipDef.complement;
          let targetUid = targetIdentifier;
          
          if (isNameBased) {
            targetUid = `name:${targetIdentifier}`;
          }
          
          this.addRelationshipEdge(targetUid, sourceUid, complementType, false);
        }
      }

      return added;
    } catch (error) {
      loggingService.error(`Failed to add bidirectional relationship:`, error);
      return false;
    }
  }

  /**
   * Remove a bidirectional relationship with complement.
   */
  removeBidirectionalRelationship(sourceUid: string, targetIdentifier: string, relationshipType: string): boolean {
    try {
      // Remove primary relationship
      const removed = this.removeRelationshipEdge(sourceUid, targetIdentifier, relationshipType);
      
      if (removed) {
        // Remove complement relationship
        const relationshipDef = RELATIONSHIP_TYPES[relationshipType.toLowerCase()];
        if (relationshipDef?.complement) {
          const complementType = relationshipDef.complement;
          let targetUid = targetIdentifier;
          
          if (targetIdentifier.startsWith('name:')) {
            targetUid = targetIdentifier;
          } else {
            const nameBasedUid = `name:${targetIdentifier}`;
            if (this.graph.hasNode(nameBasedUid)) {
              targetUid = nameBasedUid;
            }
          }
          
          this.removeRelationshipEdge(targetUid, sourceUid, complementType);
        }
      }

      return removed;
    } catch (error) {
      loggingService.error(`Failed to remove bidirectional relationship:`, error);
      return false;
    }
  }

  /**
   * Upgrade name-based relationships to UID-based when contacts are created.
   */
  upgradeNameBasedRelationships(contactName: string, contactUid: string): boolean {
    try {
      const nameBasedUid = `name:${contactName}`;
      
      if (!this.graph.hasNode(nameBasedUid)) {
        return false;
      }

      // Get all edges involving the name-based node
      const incomingEdges: Array<{key: string, source: string, attrs: any}> = [];
      const outgoingEdges: Array<{key: string, target: string, attrs: any}> = [];
      
      this.graph.forEachInEdge(nameBasedUid, (edgeKey, edgeAttrs, source) => {
        incomingEdges.push({key: edgeKey, source, attrs: edgeAttrs});
      });
      
      this.graph.forEachOutEdge(nameBasedUid, (edgeKey, edgeAttrs, _, target) => {
        outgoingEdges.push({key: edgeKey, target, attrs: edgeAttrs});
      });

      // Remove old edges
      incomingEdges.forEach(edge => this.graph.dropEdge(edge.key));
      outgoingEdges.forEach(edge => this.graph.dropEdge(edge.key));

      // Add new UID-based edges
      incomingEdges.forEach(edge => {
        const newEdgeData = {...edge.attrs, target: contactUid, isNameBased: false};
        const newEdgeKey = `${edge.source}-${contactUid}-${edge.attrs.type}`;
        this.graph.addEdgeWithKey(newEdgeKey, edge.source, contactUid, newEdgeData);
      });

      outgoingEdges.forEach(edge => {
        const newEdgeData = {...edge.attrs, source: contactUid, isNameBased: false};
        const newEdgeKey = `${contactUid}-${edge.target}-${edge.attrs.type}`;
        this.graph.addEdgeWithKey(newEdgeKey, contactUid, edge.target, newEdgeData);
      });

      // Remove the name-based node
      this.graph.dropNode(nameBasedUid);

      loggingService.info(`Upgraded name-based relationships for ${contactName} to UID ${contactUid}`);
      return true;
    } catch (error) {
      loggingService.error(`Failed to upgrade name-based relationships:`, error);
      return false;
    }
  }

  /**
   * Extract relationships from a contact file's frontmatter.
   */
  private async extractRelationshipsFromFile(file: TFile): Promise<RelationshipEdge[]> {
    const relationships: RelationshipEdge[] = [];
    
    try {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter) return relationships;

      const sourceUid = frontmatter.UID || frontmatter.uid;
      if (!sourceUid) return relationships;

      // Parse RELATED fields
      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED') && value && value !== '') {
          const relationshipMatch = key.match(/^RELATED(?:\[(?:\d+:)?([^\]]+)\])?$/);
          if (relationshipMatch) {
            const relationshipType = relationshipMatch[1] || 'related';
            
            const isNameBased = String(value).startsWith('name:');
            const targetIdentifier = isNameBased ? String(value).substring(5) : String(value);
            
            relationships.push({
              type: relationshipType,
              isNameBased,
              source: sourceUid,
              target: targetIdentifier
            });
          }
        }
      }
    } catch (error) {
      loggingService.error(`Failed to extract relationships from ${file.path}:`, error);
    }

    return relationships;
  }

  /**
   * Get all contact files in the vault.
   */
  private getAllContactFiles(): TFile[] {
    const allFiles = this.app.vault.getMarkdownFiles();
    return allFiles.filter(file => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      return frontmatter && (frontmatter.UID || frontmatter.uid);
    });
  }

  /**
   * Get graph statistics.
   */
  getStats(): {nodes: number, edges: number, phantomNodes: number} {
    const nodes = this.graph.order;
    const edges = this.graph.size;
    let phantomNodes = 0;
    
    this.graph.forEachNode((node, attrs) => {
      if (!(attrs as ContactNode).exists) {
        phantomNodes++;
      }
    });

    return { nodes, edges, phantomNodes };
  }

  /**
   * Validate graph consistency.
   */
  validateConsistency(): {isValid: boolean, issues: string[]} {
    const issues: string[] = [];
    
    try {
      // Check for orphaned phantom nodes
      this.graph.forEachNode((nodeKey, nodeAttrs) => {
        const node = nodeAttrs as ContactNode;
        if (!node.exists && this.graph.degree(nodeKey) === 0) {
          issues.push(`Orphaned phantom node: ${nodeKey}`);
        }
      });

      // Check for self-loops (should not exist)
      this.graph.forEachEdge((edgeKey, edgeAttrs, source, target) => {
        if (source === target) {
          issues.push(`Self-loop detected: ${edgeKey}`);
        }
      });

      // Check for missing complement relationships
      this.graph.forEachEdge((edgeKey, edgeAttrs) => {
        const edge = edgeAttrs as RelationshipEdge;
        const relationshipDef = RELATIONSHIP_TYPES[edge.type.toLowerCase()];
        
        if (relationshipDef?.complement && !relationshipDef.isSymmetric) {
          const complementEdgeKey = `${edge.target}-${edge.source}-${relationshipDef.complement}`;
          if (!this.graph.hasEdge(complementEdgeKey)) {
            issues.push(`Missing complement relationship: ${complementEdgeKey}`);
          }
        }
      });

    } catch (error) {
      issues.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get the underlying graph instance (for advanced operations).
   */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * Get contact by UID.
   */
  getContact(uid: string): ContactNode | null {
    try {
      if (this.graph.hasNode(uid)) {
        return this.graph.getNodeAttributes(uid) as ContactNode;
      }
      return null;
    } catch (error) {
      loggingService.error(`Failed to get contact ${uid}:`, error);
      return null;
    }
  }

  /**
   * Find contact UID by name.
   */
  findContactByName(name: string): string | null {
    return this.nameToUidMap.get(name) || null;
  }
}