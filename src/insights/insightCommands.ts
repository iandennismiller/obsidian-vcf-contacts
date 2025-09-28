import { Notice, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { ContactManager } from '../models/contactManager';

/**
 * Insight processor commands for the VCF Contacts plugin
 */
export class InsightCommands {
  constructor(
    private app: App,
    private settings: ContactsPluginSettings,
    private contactManager: ContactManager
  ) {}

  /**
   * Register insight processor commands with the plugin
   */
  registerCommands(plugin: any) {
    plugin.addCommand({
      id: 'run-insight-processors-current',
      name: "Run insight processors on current contact",
      callback: async () => {
        await this.runInsightProcessorsOnCurrent();
      },
    });

    plugin.addCommand({
      id: 'run-insight-processors-all',
      name: "Run insight processors on all contacts",
      callback: async () => {
        await this.runInsightProcessorsOnAll();
      },
    });
  }

  /**
   * Run insight processors on the current active contact
   */
  async runInsightProcessorsOnCurrent(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file found');
      return;
    }

    // Check if the file is in the contacts folder
    if (!activeFile.path.startsWith(this.settings.contactsFolder)) {
      new Notice('Active file is not in the contacts folder');
      return;
    }

    // Check if file has UID (is a contact file)
    const cache = this.app.metadataCache.getFileCache(activeFile);
    if (!cache?.frontmatter?.UID) {
      new Notice('Active file is not a contact file (missing UID)');
      return;
    }

    new Notice('Running insight processors on current contact...');
    
    try {
      const { ContactManager } = await import('../models/contactManager');
      const { insightService } = await import('./insightService');
      const { RunType } = await import('./insight.d');
      
      // Get contact data
      const contactManager = new ContactManager(app);
      const contacts = await contactManager.getFrontmatterFromFiles([activeFile]);
      
      // Run all processors
      const immediateResults = await insightService.process(contacts, RunType.IMMEDIATELY);
      const improvementResults = await insightService.process(contacts, RunType.INPROVEMENT);
      const upcomingResults = await insightService.process(contacts, RunType.UPCOMMING);
      
      const totalResults = immediateResults.length + improvementResults.length + upcomingResults.length;
      if (totalResults > 0) {
        new Notice(`Insight processors completed: ${totalResults} actions taken`);
      } else {
        new Notice('Insight processors completed: No actions needed');
      }
    } catch (error) {
      new Notice(`Error running insight processors: ${error.message}`);
      console.log('Insight processor error:', error);
    }
  }

  /**
   * Run insight processors on all contacts
   */
  async runInsightProcessorsOnAll(): Promise<void> {
    new Notice('Running insight processors on all contacts...');
    
    try {
      const { insightService } = await import('./insightService');
      const { RunType } = await import('./insight.d');
      
      // Get all contact files
      const contactFiles = this.contactManager.getAllContactFiles();
      if (contactFiles.length === 0) {
        new Notice('No contact files found');
        return;
      }
      
      // Get contact data
      const contacts = await this.contactManager.getFrontmatterFromFiles(contactFiles);
      
      // Run all processors
      const immediateResults = await insightService.process(contacts, RunType.IMMEDIATELY);
      const improvementResults = await insightService.process(contacts, RunType.INPROVEMENT);
      const upcomingResults = await insightService.process(contacts, RunType.UPCOMMING);
      
      const totalResults = immediateResults.length + improvementResults.length + upcomingResults.length;
      if (totalResults > 0) {
        new Notice(`Insight processors completed on ${contacts.length} contacts: ${totalResults} actions taken`);
      } else {
        new Notice(`Insight processors completed on ${contacts.length} contacts: No actions needed`);
      }
    } catch (error) {
      new Notice(`Error running insight processors: ${error.message}`);
      console.log('Insight processor error:', error);
    }
  }
}