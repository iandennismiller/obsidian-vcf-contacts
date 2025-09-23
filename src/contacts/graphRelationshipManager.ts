/**
 * @fileoverview Graph-based relationship manager with event-driven synchronization.
 * 
 * This service provides:
 * - Graph-based relationship management using Graphology
 * - Event-driven synchronization with proper precedence control
 * - Bidirectional mapping between graph, YAML, and markdown
 * - Lock-based concurrency control to prevent sync loops
 */

import { App, TFile } from 'obsidian';
import { RelationshipGraph, ContactNode } from './relationshipGraph';
import { GraphYAMLMarkdownMapper, GraphSyncOperation } from './graphYAMLMarkdownMapper';
import { updateFrontMatterValue } from './contactFrontmatter';
import { loggingService } from '../services/loggingService';

export interface SyncPrecedence {
  respectUserEdits: boolean;
  reRenderMarkdown: boolean;
  propagateToGraph: boolean;
}

export interface GraphSyncResult {
  success: boolean;
  filesUpdated: string[];
  operations: GraphSyncOperation[];
  errors: string[];
}

/**
 * Graph-based relationship manager.
 * Manages all relationship operations through the Graphology relationship graph.
 */
export class GraphRelationshipManager {
  private app: App;
  private relationshipGraph: RelationshipGraph;
  private yamlMarkdownMapper: GraphYAMLMarkdownMapper;
  private syncLocks: Set<string> = new Set();
  private lockTimeout: number = 30000; // 30 seconds

  constructor(app: App) {
    this.app = app;
    this.relationshipGraph = new RelationshipGraph(app);
    this.yamlMarkdownMapper = new GraphYAMLMarkdownMapper(this.relationshipGraph);
  }

  /**
   * Initialize the manager and rebuild graph from existing contacts.
   */
  async initialize(): Promise<void> {
    try {
      await this.relationshipGraph.rebuildFromContacts();
      loggingService.info('Graph relationship manager initialized');
    } catch (error) {
      loggingService.error('Failed to initialize graph relationship manager:', error);
    }
  }

  /**
   * Sync relationships from user markdown edits to graph and affected contacts.
   */
  async syncFromUserMarkdownEdit(contactFile: TFile, markdownContent: string): Promise<GraphSyncResult> {
    const result: GraphSyncResult = {
      success: true,
      filesUpdated: [],
      operations: [],
      errors: []
    };

    const contactPath = contactFile.path;
    
    try {
      // Check for lock
      if (this.syncLocks.has(contactPath)) {
        result.errors.push(`Sync already in progress for ${contactPath}`);
        return result;
      }

      // Acquire lock
      this.acquireLock(contactPath);

      const contact = await this.getContactFromFile(contactFile);
      if (!contact) {
        result.errors.push(`Contact not found: ${contactPath}`);
        return result;
      }

      // Sync markdown to graph
      const operations = this.yamlMarkdownMapper.syncMarkdownToGraph(markdownContent, contact.uid);
      result.operations = operations;

      if (operations.length > 0) {
        // Update this contact's YAML frontmatter from graph
        await this.updateContactYAMLFromGraph(contactFile, contact.uid);
        result.filesUpdated.push(contactPath);

        // Update affected contacts (but don't re-render markdown to avoid loops)
        await this.updateAffectedContacts(operations, contact.uid, false);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error.message}`);
      loggingService.error('Failed to sync from user markdown edit:', error);
    } finally {
      this.releaseLock(contactPath);
    }

    return result;
  }

  /**
   * Sync relationships from YAML frontmatter changes to graph and affected contacts.
   */
  async syncFromYAMLChange(contactFile: TFile, yamlData: Record<string, any>): Promise<GraphSyncResult> {
    const result: GraphSyncResult = {
      success: true,
      filesUpdated: [],
      operations: [],
      errors: []
    };

    const contactPath = contactFile.path;
    
    try {
      // Check for lock
      if (this.syncLocks.has(contactPath)) {
        result.errors.push(`Sync already in progress for ${contactPath}`);
        return result;
      }

      // Acquire lock
      this.acquireLock(contactPath);

      const contact = await this.getContactFromFile(contactFile);
      if (!contact) {
        result.errors.push(`Contact not found: ${contactPath}`);
        return result;
      }

      // Sync YAML to graph
      const operations = this.yamlMarkdownMapper.syncYAMLToGraph(yamlData, contact.uid);
      result.operations = operations;

      if (operations.length > 0) {
        // Update affected contacts (with markdown re-rendering)
        await this.updateAffectedContacts(operations, contact.uid, true);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error.message}`);
      loggingService.error('Failed to sync from YAML change:', error);
    } finally {
      this.releaseLock(contactPath);
    }

    return result;
  }

  /**
   * Sync contact when file is opened (graph to markdown).
   */
  async syncOnFileOpen(contactFile: TFile): Promise<GraphSyncResult> {
    const result: GraphSyncResult = {
      success: true,
      filesUpdated: [],
      operations: [],
      errors: []
    };

    try {
      const contact = await this.getContactFromFile(contactFile);
      if (!contact) {
        return result;
      }

      // Update markdown from graph
      await this.updateContactMarkdownFromGraph(contactFile, contact.uid);
      result.filesUpdated.push(contactFile.path);

    } catch (error) {
      result.success = false;
      result.errors.push(`File open sync failed: ${error.message}`);
      loggingService.error('Failed to sync on file open:', error);
    }

    return result;
  }

  /**
   * Manual refresh of a contact (full bidirectional sync).
   */
  async manualRefresh(contactFile: TFile): Promise<GraphSyncResult> {
    const result: GraphSyncResult = {
      success: true,
      filesUpdated: [],
      operations: [],
      errors: []
    };

    const contactPath = contactFile.path;
    
    try {
      // Check for lock
      if (this.syncLocks.has(contactPath)) {
        result.errors.push(`Sync already in progress for ${contactPath}`);
        return result;
      }

      // Acquire lock
      this.acquireLock(contactPath);

      const contact = await this.getContactFromFile(contactFile);
      if (!contact) {
        result.errors.push(`Contact not found: ${contactPath}`);
        return result;
      }

      // Get current file content
      const fileContent = await this.app.vault.read(contactFile);
      const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter || {};

      // Sync YAML to graph first
      const yamlOps = this.yamlMarkdownMapper.syncYAMLToGraph(frontmatter, contact.uid);
      
      // Sync markdown to graph
      const markdownOps = this.yamlMarkdownMapper.syncMarkdownToGraph(fileContent, contact.uid);
      
      result.operations = [...yamlOps, ...markdownOps];

      // Update this contact's YAML and markdown from graph
      await this.updateContactYAMLFromGraph(contactFile, contact.uid);
      await this.updateContactMarkdownFromGraph(contactFile, contact.uid);
      result.filesUpdated.push(contactPath);

      // Update affected contacts
      if (result.operations.length > 0) {
        await this.updateAffectedContacts(result.operations, contact.uid, true);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Manual refresh failed: ${error.message}`);
      loggingService.error('Failed to manual refresh:', error);
    } finally {
      this.releaseLock(contactPath);
    }

    return result;
  }

  /**
   * Update all contacts (rebuild entire graph and sync all files).
   */
  async updateAllContacts(): Promise<GraphSyncResult> {
    const result: GraphSyncResult = {
      success: true,
      filesUpdated: [],
      operations: [],
      errors: []
    };

    try {
      // Rebuild graph from all contacts
      const rebuildResult = await this.relationshipGraph.rebuildFromContacts();
      
      if (!rebuildResult.success) {
        result.success = false;
        result.errors = rebuildResult.errors;
        return result;
      }

      // Update all contact files
      const allContactFiles = this.getAllContactFiles();
      
      for (const file of allContactFiles) {
        try {
          const contact = await this.getContactFromFile(file);
          if (contact) {
            await this.updateContactYAMLFromGraph(file, contact.uid);
            await this.updateContactMarkdownFromGraph(file, contact.uid);
            result.filesUpdated.push(file.path);
          }
        } catch (error) {
          result.errors.push(`Failed to update ${file.path}: ${error.message}`);
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Update all contacts failed: ${error.message}`);
      loggingService.error('Failed to update all contacts:', error);
    }

    return result;
  }

  /**
   * Add a new contact to the graph.
   */
  async addContact(contactFile: TFile): Promise<boolean> {
    try {
      const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
      if (!frontmatter) return false;

      const uid = frontmatter.UID || frontmatter.uid;
      const name = frontmatter.FN || frontmatter.fn || contactFile.basename;

      if (!uid) return false;

      // Add node to graph
      const contact: ContactNode = {
        uid,
        name,
        file: contactFile,
        exists: true
      };

      const graph = this.relationshipGraph.getGraph();
      if (!graph.hasNode(uid)) {
        graph.addNode(uid, contact);
        
        // Upgrade any existing name-based relationships
        this.relationshipGraph.upgradeNameBasedRelationships(name, uid);
        
        loggingService.info(`Added contact to graph: ${name} (${uid})`);
        return true;
      }

      return false;
    } catch (error) {
      loggingService.error(`Failed to add contact to graph:`, error);
      return false;
    }
  }

  /**
   * Remove a contact from the graph.
   */
  async removeContact(contactUid: string): Promise<boolean> {
    try {
      const graph = this.relationshipGraph.getGraph();
      
      if (graph.hasNode(contactUid)) {
        // Get all related contacts before removing
        const relatedContacts = new Set<string>();
        
        graph.forEachInNeighbor(contactUid, (neighborUid) => {
          relatedContacts.add(neighborUid);
        });
        
        graph.forEachOutNeighbor(contactUid, (neighborUid) => {
          relatedContacts.add(neighborUid);
        });

        // Remove the node (this also removes all edges)
        graph.dropNode(contactUid);

        // Update affected contacts
        for (const relatedUid of relatedContacts) {
          const relatedContact = this.relationshipGraph.getContact(relatedUid);
          if (relatedContact?.file) {
            await this.updateContactYAMLFromGraph(relatedContact.file, relatedUid);
            await this.updateContactMarkdownFromGraph(relatedContact.file, relatedUid);
          }
        }

        loggingService.info(`Removed contact from graph: ${contactUid}`);
        return true;
      }

      return false;
    } catch (error) {
      loggingService.error(`Failed to remove contact from graph:`, error);
      return false;
    }
  }

  /**
   * Get contact information from a file.
   */
  private async getContactFromFile(file: TFile): Promise<ContactNode | null> {
    try {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter) return null;

      const uid = frontmatter.UID || frontmatter.uid;
      if (!uid) return null;

      return this.relationshipGraph.getContact(uid);
    } catch (error) {
      loggingService.error(`Failed to get contact from file ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Update a contact's YAML frontmatter from the graph.
   */
  private async updateContactYAMLFromGraph(contactFile: TFile, contactUid: string): Promise<void> {
    try {
      const yamlResult = this.yamlMarkdownMapper.generateYAMLFromGraph(contactUid);
      
      // Remove all existing RELATED fields first
      const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter || {};
      const relatedKeys = Object.keys(frontmatter).filter(key => key.startsWith('RELATED'));
      
      for (const key of relatedKeys) {
        await updateFrontMatterValue(this.app, contactFile, key, null);
      }

      // Add new RELATED fields
      const sanitizedFields = this.yamlMarkdownMapper.sanitizeYAMLFields(yamlResult.yamlFields);
      for (const [key, value] of Object.entries(sanitizedFields)) {
        await updateFrontMatterValue(this.app, contactFile, key, value);
      }

    } catch (error) {
      loggingService.error(`Failed to update YAML for ${contactFile.path}:`, error);
    }
  }

  /**
   * Update a contact's markdown from the graph.
   */
  private async updateContactMarkdownFromGraph(contactFile: TFile, contactUid: string): Promise<void> {
    try {
      const currentContent = await this.app.vault.read(contactFile);
      const markdownResult = this.yamlMarkdownMapper.generateMarkdownFromGraph(contactUid);
      
      const newContent = this.yamlMarkdownMapper.replaceRelationshipsInMarkdown(
        currentContent,
        markdownResult.markdownContent
      );

      if (newContent !== currentContent) {
        await this.app.vault.modify(contactFile, newContent);
      }

    } catch (error) {
      loggingService.error(`Failed to update markdown for ${contactFile.path}:`, error);
    }
  }

  /**
   * Update affected contacts based on operations.
   */
  private async updateAffectedContacts(operations: GraphSyncOperation[], sourceUid: string, reRenderMarkdown: boolean): Promise<void> {
    const affectedUids = new Set<string>();

    // Collect affected contact UIDs
    for (const op of operations) {
      if (op.targetIdentifier !== sourceUid && !op.targetIdentifier.startsWith('name:')) {
        affectedUids.add(op.targetIdentifier);
      }
    }

    // Update affected contacts
    for (const uid of affectedUids) {
      try {
        // Skip if already locked
        const contact = this.relationshipGraph.getContact(uid);
        if (!contact?.file || this.syncLocks.has(contact.file.path)) {
          continue;
        }

        // Acquire temporary lock
        this.acquireLock(contact.file.path);

        try {
          // Always update YAML
          await this.updateContactYAMLFromGraph(contact.file, uid);

          // Conditionally update markdown
          if (reRenderMarkdown) {
            await this.updateContactMarkdownFromGraph(contact.file, uid);
          }
        } finally {
          this.releaseLock(contact.file.path);
        }

      } catch (error) {
        loggingService.error(`Failed to update affected contact ${uid}:`, error);
      }
    }
  }

  /**
   * Acquire a sync lock for a file.
   */
  private acquireLock(filePath: string): void {
    this.syncLocks.add(filePath);
    
    // Set timeout to release lock automatically
    setTimeout(() => {
      if (this.syncLocks.has(filePath)) {
        loggingService.warn(`Lock timeout for ${filePath}, force releasing`);
        this.syncLocks.delete(filePath);
      }
    }, this.lockTimeout);
  }

  /**
   * Release a sync lock for a file.
   */
  private releaseLock(filePath: string): void {
    this.syncLocks.delete(filePath);
  }

  /**
   * Clear all sync locks (emergency function).
   */
  clearAllLocks(): void {
    const lockedFiles = Array.from(this.syncLocks);
    this.syncLocks.clear();
    loggingService.info(`Cleared ${lockedFiles.length} sync locks: ${lockedFiles.join(', ')}`);
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
  getGraphStats(): {nodes: number, edges: number, phantomNodes: number} {
    return this.relationshipGraph.getStats();
  }

  /**
   * Validate graph consistency.
   */
  validateGraph(): {isValid: boolean, issues: string[]} {
    return this.relationshipGraph.validateConsistency();
  }

  /**
   * Get the relationship graph instance.
   */
  getRelationshipGraph(): RelationshipGraph {
    return this.relationshipGraph;
  }

  /**
   * Check if a file is currently locked.
   */
  isLocked(filePath: string): boolean {
    return this.syncLocks.has(filePath);
  }

  /**
   * Get currently locked files.
   */
  getLockedFiles(): string[] {
    return Array.from(this.syncLocks);
  }
}