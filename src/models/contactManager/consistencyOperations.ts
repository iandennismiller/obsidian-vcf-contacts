/**
 * Data consistency operations optimized for data locality with ContactManagerData.
 */

import { TFile } from 'obsidian';
import { ContactNote, Contact } from '../contactNote';
import { ContactManagerData } from './contactManagerData';
import { getSettings, updateSettings } from '../../context/sharedSettingsContext';
import { RunType } from "src/interfaces/RunType.d";
import { curatorService } from '../curatorManager/curatorManager';

/**
 * Data consistency operations that work directly with ContactManagerData
 * for optimal cache locality and performance.
 */
export class ConsistencyOperations {
  private managerData: ContactManagerData;

  constructor(managerData: ContactManagerData) {
    this.managerData = managerData;
  }

  // === Data Consistency Operations (co-located with data access) ===

  /**
   * Ensure consistency of contact data by processing through curator processors
   * Groups consistency logic with data access for better cache locality
   */
  async ensureContactDataConsistency(maxIterations: number = 10): Promise<void> {
    console.log('[ConsistencyOperations] Starting contact data consistency check...');
    
    try {
      // Get all contact files
      const allContactFiles = this.managerData.getAllContactFiles();
      if (allContactFiles.length === 0) {
        console.log('[ConsistencyOperations] No contacts found for consistency check');
        return;
      }

      console.log(`[ConsistencyOperations] Processing ${allContactFiles.length} contacts for consistency`);

      // Create initial task list with contacts and their REV timestamps
      let taskList = await this.createContactTaskListInternal(allContactFiles);
      let iteration = 0;
      let hasChanges = true;

      // Temporarily disable vcardSyncPostProcessor by storing its original state
      const originalVcardSyncPostProcessorState = getSettings().vcardSyncPostProcessor;
      
      try {
        // Disable vcardSyncPostProcessor during consistency checks
        updateSettings({ vcardSyncPostProcessor: false });

        // Iteratively process contacts until no changes or max iterations
        while (hasChanges && iteration < maxIterations) {
          iteration++;
          console.log(`[ConsistencyOperations] Consistency check iteration ${iteration}/${maxIterations}`);

          const changedContacts = await this.processTaskListForConsistency(taskList);
          
          if (changedContacts.length === 0) {
            hasChanges = false;
            console.log(`[ConsistencyOperations] No changes detected in iteration ${iteration}, consistency achieved`);
          } else {
            console.log(`[ConsistencyOperations] ${changedContacts.length} contacts changed in iteration ${iteration}`);
            // Create new task list with only changed contacts
            taskList = await this.createContactTaskListInternal(changedContacts);
          }
        }

        // Check if we hit max iterations
        if (iteration >= maxIterations && hasChanges) {
          console.log(`[ConsistencyOperations] WARNING: Consistency check stopped after ${maxIterations} iterations. Some contacts may still need processing.`);
        }

      } finally {
        // Restore original vcardSyncPostProcessor state
        updateSettings({ vcardSyncPostProcessor: originalVcardSyncPostProcessorState });
      }

      // Finally, process all contacts one more time with just vcardSyncPostProcessor
      if (originalVcardSyncPostProcessorState) {
        console.log('[ConsistencyOperations] Running final vcardSyncPostProcessor pass...');
        const allContacts = await this.getFrontmatterFromFiles(allContactFiles);
        await curatorService.process(allContacts, RunType.INPROVEMENT);
        console.log('[ConsistencyOperations] Final vcardSyncPostProcessor pass completed');
      }

      console.log(`[ConsistencyOperations] Contact data consistency check completed after ${iteration} iterations`);

    } catch (error: any) {
      console.log(`[ConsistencyOperations] Error during consistency check: ${error.message}`);
      // Don't throw - handle gracefully for error resilience
      return;
    }
  }

  // === Task List Operations (grouped with consistency processing) ===

  /**
   * Create a task list of contacts with their current REV timestamps (private)
   * Co-locates task creation with consistency operations
   */
  private async createContactTaskListInternal(contactFiles: TFile[]): Promise<Map<string, { file: TFile; originalRev: string | null }>> {
    const taskList = new Map<string, { file: TFile; originalRev: string | null }>();
    const app = this.managerData.getApp();
    const settings = this.managerData.getSettings();
    
    for (const file of contactFiles) {
      try {
        const contactNote = new ContactNote(app, settings, file);
        const frontmatter = await contactNote.getFrontmatter();
        const originalRev = frontmatter?.REV || null;
        
        const uid = await this.managerData.extractUIDFromFile(file);
        if (uid) {
          taskList.set(uid, { file, originalRev });
        }
      } catch (error: any) {
        console.log(`[ConsistencyOperations] Error reading contact ${file.basename}: ${error.message}`);
      }
    }
    
    return taskList;
  }

  /**
   * Process a task list of contacts and return those that were changed (REV updated)
   * Groups task processing with consistency operations
   */
  private async processTaskListForConsistency(taskList: Map<string, { file: TFile; originalRev: string | null }>): Promise<TFile[]> {
    const changedContacts: TFile[] = [];
    const contactFiles = Array.from(taskList.values()).map(item => item.file);
    const app = this.managerData.getApp();
    const settings = this.managerData.getSettings();
    
    try {
      // Get contact data for processing
      const contacts = await this.getFrontmatterFromFiles(contactFiles);
      
      // Process with all curator processors except vcardSyncPostProcessor
      // Note: vcardSyncPostProcessor is already disabled by the caller
      await curatorService.process(contacts, RunType.IMMEDIATELY);
      await curatorService.process(contacts, RunType.INPROVEMENT);
      await curatorService.process(contacts, RunType.UPCOMMING);
      
      // Check which contacts had their REV timestamp updated
      for (const [uid, taskItem] of taskList) {
        try {
          const contactNote = new ContactNote(app, settings, taskItem.file);
          const currentFrontmatter = await contactNote.getFrontmatter();
          const currentRev = currentFrontmatter?.REV || null;
          
          // Compare REV timestamps to detect changes
          if (currentRev !== taskItem.originalRev) {
            changedContacts.push(taskItem.file);
            console.log(`[ConsistencyOperations] Contact ${taskItem.file.basename} REV changed: ${taskItem.originalRev} -> ${currentRev}`);
          }
        } catch (error: any) {
          console.log(`[ConsistencyOperations] Error checking REV for ${taskItem.file.basename}: ${error.message}`);
        }
      }
      
    } catch (error: any) {
      console.log(`[ConsistencyOperations] Error processing task list: ${error.message}`);
      throw error;
    }
    
    return changedContacts;
  }

  // === Frontmatter Operations (co-located with data processing) ===

  /**
   * Get contact frontmatter data from files for processing
   * Groups frontmatter access with consistency operations
   */
  private async getFrontmatterFromFiles(files: TFile[]): Promise<Contact[]> {
    const contactsData: Contact[] = [];
    const app = this.managerData.getApp();
    
    for (const file of files) {
      const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter;
      if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
        contactsData.push({
          file: file,
          data: frontMatter
        });
      }
    }
    return contactsData;
  }

  // === Validation Operations (grouped with consistency operations) ===

  /**
   * Validate contact data integrity
   * Co-locates validation with consistency operations
   */
  async validateContactIntegrity(): Promise<{ 
    isValid: boolean; 
    issues: string[]; 
    recommendations: string[] 
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const allFiles = this.managerData.getAllContactFiles();
      const cacheStats = this.managerData.getCacheStats();
      
      // Check cache consistency
      if (cacheStats.uidCount !== cacheStats.fileCount) {
        issues.push(`Cache inconsistency: ${cacheStats.uidCount} UIDs but ${cacheStats.fileCount} files`);
        recommendations.push('Run cache reinitialization to resolve inconsistencies');
      }

      // Check for files without UIDs
      let filesWithoutUID = 0;
      for (const file of allFiles) {
        const uid = await this.managerData.extractUIDFromFile(file);
        if (!uid) {
          filesWithoutUID++;
        }
      }

      if (filesWithoutUID > 0) {
        issues.push(`${filesWithoutUID} contact files missing UIDs`);
        recommendations.push('Add UIDs to contact files or remove them from contacts folder');
      }

      // Check for duplicate UIDs
      const uidCounts = new Map<string, number>();
      for (const file of allFiles) {
        const uid = await this.managerData.extractUIDFromFile(file);
        if (uid) {
          uidCounts.set(uid, (uidCounts.get(uid) || 0) + 1);
        }
      }

      const duplicates = Array.from(uidCounts.entries()).filter(([, count]) => count > 1);
      if (duplicates.length > 0) {
        issues.push(`Duplicate UIDs found: ${duplicates.map(([uid, count]) => `${uid} (${count} files)`).join(', ')}`);
        recommendations.push('Resolve duplicate UIDs by updating or removing duplicate contacts');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error: any) {
      issues.push(`Validation failed: ${error.message}`);
      return {
        isValid: false,
        issues,
        recommendations: ['Fix validation errors before checking integrity']
      };
    }
  }

  /**
   * Process contacts with curator service (public method for testing)
   */
  async processContactsWithInsights(taskList: Array<{ file: TFile; revTimestamp?: number }>): Promise<any[]> {
    try {
      const contacts = await this.extractFrontmatterFromFiles(taskList.map(task => task.file));
      const result = await curatorService.process(contacts, RunType.IMMEDIATELY);
      return result || [];
    } catch (error: any) {
      console.log(`[ConsistencyOperations] Error processing contacts with curator: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract frontmatter from files (public method for testing)
   */
  async extractFrontmatterFromFiles(files: TFile[]): Promise<Contact[]> {
    const contactsData: Contact[] = [];
    const app = this.managerData.getApp();
    
    for (const file of files) {
      try {
        const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter || {};
        contactsData.push({
          file: file,
          data: frontMatter
        });
      } catch (error: any) {
        console.log(`[ConsistencyOperations] Error extracting frontmatter from ${file.path}: ${error.message}`);
        contactsData.push({
          file: file,
          data: {}
        });
      }
    }
    return contactsData;
  }

  /**
   * Create contact task list (public method for testing)
   */
  async createContactTaskList(contactFiles: TFile[]): Promise<Array<{ file: TFile; revTimestamp: number }>> {
    const taskList: Array<{ file: TFile; revTimestamp: number }> = [];
    const app = this.managerData.getApp();
    
    for (const file of contactFiles) {
      try {
        const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter;
        let revTimestamp = 0;
        
        if (frontMatter?.REV) {
          const parsed = parseInt(frontMatter.REV, 10);
          revTimestamp = isNaN(parsed) ? 0 : parsed;
        }
        
        taskList.push({ file, revTimestamp });
      } catch (error: any) {
        console.log(`[ConsistencyOperations] Error reading contact ${file.basename}: ${error.message}`);
        taskList.push({ file, revTimestamp: 0 });
      }
    }
    
    return taskList;
  }
}