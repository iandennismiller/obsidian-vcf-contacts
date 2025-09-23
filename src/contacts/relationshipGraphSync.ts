/**
 * @fileoverview Graph-based relationship synchronization service.
 * 
 * This service provides:
 * - Lock-based synchronization to prevent recursive updates
 * - Two-phase sync: frontmatter propagation followed by markdown rendering
 * - Graph-wide consistency checks and deadlock prevention
 * - Surgical updates that preserve note content outside relationship sections
 */

import { App, TFile } from 'obsidian';
import { RelationshipManager } from './relationshipManager';
import { 
  syncYAMLToMarkdown, 
  syncMarkdownToYAML,
  extractRelationshipsFromMarkdown,
  RelationshipData
} from './yamlMarkdownMapper';
import { loggingService } from '../services/loggingService';

interface SyncOperation {
  file: TFile;
  type: 'frontmatter' | 'markdown';
  timestamp: number;
}

export class RelationshipGraphSync {
  private app: App;
  private relationshipManager: RelationshipManager;
  
  // Lock management
  private lockedFiles = new Set<string>();
  private syncQueue: SyncOperation[] = [];
  private isProcessingQueue = false;
  
  // Deadlock prevention
  private readonly MAX_SYNC_ATTEMPTS = 3;
  private readonly DEADLOCK_TIMEOUT = 5000; // 5 seconds
  private syncAttempts = new Map<string, number>();

  constructor(app: App) {
    this.app = app;
    this.relationshipManager = new RelationshipManager(app);
  }

  /**
   * Entry point for relationship sync from user edits.
   * Phase 1: Sync markdown to frontmatter without re-rendering
   * Phase 2: Propagate through relationship graph
   * Phase 3: Render markdown for all affected contacts
   */
  async syncFromUserEdit(contactFile: TFile): Promise<void> {
    if (this.isFileLocked(contactFile.path)) {
      return; // Skip if already being processed
    }

    try {
      this.lockFile(contactFile.path);
      
      // Phase 1: Parse user's markdown changes and update frontmatter
      await this.syncMarkdownToFrontmatter(contactFile);
      
      // Phase 2: Propagate changes through the relationship graph
      const affectedFiles = await this.propagateRelationshipChanges(contactFile);
      
      // Phase 3: Render markdown for all affected files (including original)
      await this.renderMarkdownForFiles([contactFile, ...affectedFiles]);
      
    } finally {
      this.unlockFile(contactFile.path);
    }
  }

  /**
   * Entry point for relationship sync when opening files.
   * Simply renders frontmatter to markdown without propagation.
   */
  async syncFromFileOpen(contactFile: TFile): Promise<void> {
    if (this.isFileLocked(contactFile.path)) {
      return;
    }

    try {
      this.lockFile(contactFile.path);
      await this.renderFrontmatterToMarkdown(contactFile);
    } finally {
      this.unlockFile(contactFile.path);
    }
  }

  /**
   * Entry point for manual refresh commands.
   * Full bidirectional sync with graph propagation.
   */
  async syncManualRefresh(contactFile: TFile): Promise<void> {
    if (this.isFileLocked(contactFile.path)) {
      return;
    }

    try {
      this.lockFile(contactFile.path);
      
      // First upgrade any name-based relationships
      await this.relationshipManager.upgradeNameBasedRelationships(contactFile);
      
      // Then do full sync
      await this.syncFromUserEdit(contactFile);
      
    } finally {
      this.unlockFile(contactFile.path);
    }
  }

  private async syncMarkdownToFrontmatter(contactFile: TFile): Promise<void> {
    await syncMarkdownToYAML(contactFile, this.app, async (contactName: string) => {
      return await this.relationshipManager.getContactUIDByName(contactName);
    });
  }

  private async renderFrontmatterToMarkdown(contactFile: TFile): Promise<void> {
    await syncYAMLToMarkdown(contactFile, this.app, async (uid: string) => {
      return await this.relationshipManager.getContactNameByUID(uid);
    });
  }

  private async propagateRelationshipChanges(sourceFile: TFile): Promise<TFile[]> {
    const affectedFiles: TFile[] = [];
    const processedFiles = new Set<string>();
    
    // Get current relationships from the source file
    const relationships = await this.relationshipManager.getContactRelationships(sourceFile);
    
    for (const relationship of relationships) {
      if (!relationship.contactFile || processedFiles.has(relationship.contactFile.path)) {
        continue;
      }
      
      processedFiles.add(relationship.contactFile.path);
      
      // Lock the target file to prevent recursive updates
      if (this.isFileLocked(relationship.contactFile.path)) {
        continue;
      }
      
      try {
        this.lockFile(relationship.contactFile.path);
        
        // Update the target contact's relationships without rendering markdown yet
        await this.relationshipManager.updateAffectedContactRelationships(
          sourceFile, 
          relationship.contactFile
        );
        
        affectedFiles.push(relationship.contactFile);
        
      } finally {
        this.unlockFile(relationship.contactFile.path);
      }
    }
    
    return affectedFiles;
  }

  private async renderMarkdownForFiles(files: TFile[]): Promise<void> {
    for (const file of files) {
      if (this.isFileLocked(file.path)) {
        continue;
      }
      
      try {
        this.lockFile(file.path);
        await this.renderFrontmatterToMarkdown(file);
      } finally {
        this.unlockFile(file.path);
      }
    }
  }

  private isFileLocked(filePath: string): boolean {
    return this.lockedFiles.has(filePath);
  }

  private lockFile(filePath: string): void {
    this.lockedFiles.add(filePath);
    
    // Set timeout to prevent permanent locks
    setTimeout(() => {
      this.unlockFile(filePath);
    }, this.DEADLOCK_TIMEOUT);
  }

  private unlockFile(filePath: string): void {
    this.lockedFiles.delete(filePath);
  }

  /**
   * Validates that all relationships in the graph are consistent.
   * Used for testing and debugging.
   */
  async validateGraphConsistency(): Promise<boolean> {
    try {
      const allFiles = this.app.vault.getMarkdownFiles();
      const contactFiles = [];

      for (const file of allFiles) {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter && (frontmatter['N.GN'] || frontmatter['FN'])) {
          contactFiles.push(file);
        }
      }

      for (const file of contactFiles) {
        const relationships = await this.relationshipManager.getContactRelationships(file);
        
        for (const relationship of relationships) {
          if (relationship.contactFile) {
            // Check if the reverse relationship exists
            const reverseRelationships = await this.relationshipManager.getContactRelationships(relationship.contactFile);
            const hasReverseRelationship = reverseRelationships.some(rel => 
              rel.contactFile?.path === file.path
            );
            
            if (!hasReverseRelationship) {
              loggingService.warn(`Inconsistent relationship: ${file.basename} -> ${relationship.contactFile.basename} but no reverse`);
              return false;
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      loggingService.error(`Error validating graph consistency: ${error.message}`);
      return false;
    }
  }

  /**
   * Emergency cleanup function to clear all locks.
   */
  clearAllLocks(): void {
    this.lockedFiles.clear();
    this.syncQueue = [];
    this.isProcessingQueue = false;
    this.syncAttempts.clear();
    loggingService.info('Cleared all relationship sync locks');
  }
}