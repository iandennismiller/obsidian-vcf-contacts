import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { ContactNote, Contact } from '../contactNote';
import { getSettings } from '../../context/sharedSettingsContext';
import { RunType } from '../../insights/insight.d';
import { insightService } from '../../insights/insightService';

/**
 * Handles contact data consistency operations and processing.
 * Manages insight processing and contact data validation.
 */
export class ContactDataConsistency {
  private app: App;
  private settings: ContactsPluginSettings;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
  }

  /**
   * Ensure consistency of contact data by processing through insight processors
   */
  async ensureContactDataConsistency(
    getAllContactFiles: () => TFile[],
    extractUIDFromFile: (file: TFile) => Promise<string | null>,
    maxIterations: number = 10
  ): Promise<void> {
    console.log('[ContactDataConsistency] Starting contact data consistency check...');
    
    try {
      // Get all contact files
      const allContactFiles = getAllContactFiles();
      if (allContactFiles.length === 0) {
        console.log('[ContactDataConsistency] No contacts found for consistency check');
        return;
      }

      console.log(`[ContactDataConsistency] Processing ${allContactFiles.length} contacts for consistency`);

      // Create initial task list with contacts and their REV timestamps
      let taskList = await this.createContactTaskList(allContactFiles, extractUIDFromFile);
      let iteration = 0;
      let hasChanges = true;

      // Temporarily disable vcardSyncPostProcessor by storing its original state
      const originalVcardSyncPostProcessorState = getSettings().vcardSyncPostProcessor;
      
      try {
        // Disable vcardSyncPostProcessor during consistency checks
        const currentSettings = getSettings();
        currentSettings.vcardSyncPostProcessor = false;

        // Iteratively process contacts until no changes or max iterations
        while (hasChanges && iteration < maxIterations) {
          iteration++;
          console.log(`[ContactDataConsistency] Consistency check iteration ${iteration}/${maxIterations}`);

          const changedContacts = await this.processTaskListForConsistency(taskList);
          
          if (changedContacts.length === 0) {
            hasChanges = false;
            console.log(`[ContactDataConsistency] No changes detected in iteration ${iteration}, consistency achieved`);
          } else {
            console.log(`[ContactDataConsistency] ${changedContacts.length} contacts changed in iteration ${iteration}`);
            // Create new task list with only changed contacts
            taskList = await this.createContactTaskList(changedContacts, extractUIDFromFile);
          }
        }

        // Check if we hit max iterations
        if (iteration >= maxIterations && hasChanges) {
          console.log(`[ContactDataConsistency] WARNING: Consistency check stopped after ${maxIterations} iterations. Some contacts may still need processing.`);
        }

      } finally {
        // Restore original vcardSyncPostProcessor state
        const currentSettings = getSettings();
        currentSettings.vcardSyncPostProcessor = originalVcardSyncPostProcessorState;
      }

      // Finally, process all contacts one more time with just vcardSyncPostProcessor
      if (originalVcardSyncPostProcessorState) {
        console.log('[ContactDataConsistency] Running final vcardSyncPostProcessor pass...');
        const allContacts = await this.getFrontmatterFromFiles(allContactFiles);
        await insightService.process(allContacts, RunType.INPROVEMENT);
        console.log('[ContactDataConsistency] Final vcardSyncPostProcessor pass completed');
      }

      console.log(`[ContactDataConsistency] Contact data consistency check completed after ${iteration} iterations`);

    } catch (error: any) {
      console.log(`[ContactDataConsistency] Error during consistency check: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a task list of contacts with their current REV timestamps
   */
  private async createContactTaskList(
    contactFiles: TFile[],
    extractUIDFromFile: (file: TFile) => Promise<string | null>
  ): Promise<Map<string, { file: TFile; originalRev: string | null }>> {
    const taskList = new Map<string, { file: TFile; originalRev: string | null }>();
    
    for (const file of contactFiles) {
      try {
        const contactNote = new ContactNote(this.app, this.settings, file);
        const frontmatter = await contactNote.getFrontmatter();
        const originalRev = frontmatter?.REV || null;
        
        const uid = await extractUIDFromFile(file);
        if (uid) {
          taskList.set(uid, { file, originalRev });
        }
      } catch (error: any) {
        console.log(`[ContactDataConsistency] Error reading contact ${file.basename}: ${error.message}`);
      }
    }
    
    return taskList;
  }

  /**
   * Process a task list of contacts and return those that were changed (REV updated)
   */
  private async processTaskListForConsistency(taskList: Map<string, { file: TFile; originalRev: string | null }>): Promise<TFile[]> {
    const changedContacts: TFile[] = [];
    const contactFiles = Array.from(taskList.values()).map(item => item.file);
    
    try {
      // Get contact data for processing
      const contacts = await this.getFrontmatterFromFiles(contactFiles);
      
      // Process with all insight processors except vcardSyncPostProcessor
      // Note: vcardSyncPostProcessor is already disabled by the caller
      await insightService.process(contacts, RunType.IMMEDIATELY);
      await insightService.process(contacts, RunType.INPROVEMENT);
      await insightService.process(contacts, RunType.UPCOMMING);
      
      // Check which contacts had their REV timestamp updated
      for (const [uid, taskItem] of taskList) {
        try {
          const contactNote = new ContactNote(this.app, this.settings, taskItem.file);
          const currentFrontmatter = await contactNote.getFrontmatter();
          const currentRev = currentFrontmatter?.REV || null;
          
          // Compare REV timestamps to detect changes
          if (currentRev !== taskItem.originalRev) {
            changedContacts.push(taskItem.file);
            console.log(`[ContactDataConsistency] Contact ${taskItem.file.basename} REV changed: ${taskItem.originalRev} -> ${currentRev}`);
          }
        } catch (error: any) {
          console.log(`[ContactDataConsistency] Error checking REV for ${taskItem.file.basename}: ${error.message}`);
        }
      }
      
    } catch (error: any) {
      console.log(`[ContactDataConsistency] Error processing task list: ${error.message}`);
      throw error;
    }
    
    return changedContacts;
  }

  /**
   * Get contact frontmatter data from files for processing
   */
  private async getFrontmatterFromFiles(files: TFile[]): Promise<Contact[]> {
    const contactsData: Contact[] = [];
    for (const file of files) {
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
        contactsData.push({
          file: file,
          data: frontMatter
        });
      }
    }
    return contactsData;
  }
}