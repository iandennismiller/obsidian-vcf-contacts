import { Notice, App } from 'obsidian';
import { ContactsPluginSettings } from '../../interfaces/ContactsPluginSettings';
import { ContactManager } from '../contactManager';
import { Contact } from '../index';
import { CuratorSettingProperties } from '../../interfaces/CuratorSettingProperties';
import { CuratorProcessor } from '../../interfaces/CuratorProcessor';
import { CuratorQueItem } from '../../interfaces/CuratorQueItem';
import { RunType } from '../../interfaces/RunType';

const processors = new Map<string, CuratorProcessor>();

const processSingleContact = async (contact: Contact, runType: RunType) => {
  const curator = [];
  for (const processor of processors.values()) {
    if (processor.runType === runType) {
      curator.push(processor.process(contact));
    }
  }
  return Promise.all(curator);
}

/**
 * Curator manager for the VCF Contacts plugin
 * Combines service functionality and command registration
 */
export class CuratorManager {
  constructor(
    private app: App,
    private pluginSettings: ContactsPluginSettings,
    private contactManager: ContactManager
  ) {}

  /**
   * Register a curator processor
   */
  register(processor: CuratorProcessor) {
    processors.set(processor.name, processor);
  }

  /**
   * Process contacts with curator processors
   */
  async process(contacts: Contact | Contact[], runType: RunType): Promise<CuratorQueItem[]> {
    const contactArray = Array.isArray(contacts) ? contacts : [contacts];
    const results = await Promise.all(
      contactArray.map((contact) => processSingleContact(contact, runType))
    );
    return results.flat().filter((curator) => curator !== undefined) as CuratorQueItem[];
  }

  /**
   * Get curator processor settings
   */
  settings(): CuratorSettingProperties[] {
    return Array.from(processors.values()).map(processor => ({
      name: processor.name,
      runType: processor.runType,
      settingPropertyName: processor.settingPropertyName,
      settingDescription: processor.settingDescription,
      settingDefaultValue: processor.settingDefaultValue,
    }));
  }

  /**
   * Register curator processor commands with the plugin
   */
  registerCommands(plugin: any) {
    plugin.addCommand({
      id: 'run-curator-processors-current',
      name: "Run curator processors on current contact",
      callback: async () => {
        await this.runCuratorProcessorsOnCurrent();
      },
    });

    plugin.addCommand({
      id: 'run-curator-processors-all',
      name: "Run curator processors on all contacts",
      callback: async () => {
        await this.runCuratorProcessorsOnAll();
      },
    });
  }

  /**
   * Run curator processors on the current active contact
   */
  async runCuratorProcessorsOnCurrent(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file found');
      return;
    }

    // Check if the file is in the contacts folder
    if (!activeFile.path.startsWith(this.pluginSettings.contactsFolder)) {
      new Notice('Active file is not in the contacts folder');
      return;
    }

    try {
      // Get contact data
      const contacts = await this.contactManager.getFrontmatterFromFiles([activeFile]);
      const contact = contacts[0];
      if (!contact) {
        new Notice('Could not load contact data');
        return;
      }

      // Run curator processors
      const results = await this.process(contact, RunType.INPROVEMENT);
      
      if (results.length === 0) {
        new Notice('No curator actions needed for this contact');
      } else {
        new Notice(`Applied ${results.length} curator improvements to contact`);
      }
    } catch (error: any) {
      console.error('Error running curator processors on current contact:', error);
      new Notice('Error running curator processors');
    }
  }

  /**
   * Run curator processors on all contacts
   */
  async runCuratorProcessorsOnAll(): Promise<void> {
    try {
      new Notice('Running curator processors on all contacts...');
      
      const contactFiles = this.contactManager.getAllContactFiles();
      let totalActions = 0;

      for (const file of contactFiles) {
        try {
          const contacts = await this.contactManager.getFrontmatterFromFiles([file]);
          const contact = contacts[0];
          if (contact) {
            const results = await this.process(contact, RunType.INPROVEMENT);
            totalActions += results.length;
          }
        } catch (error: any) {
          console.error(`Error processing contact ${file.name}:`, error);
        }
      }

      new Notice(`Curator processing complete: ${totalActions} improvements applied to ${contactFiles.length} contacts`);
    } catch (error: any) {
      console.error('Error running curator processors on all contacts:', error);
      new Notice('Error running curator processors on all contacts');
    }
  }
}

// Export a singleton service for backwards compatibility
export const curatorService = {
  register(processor: CuratorProcessor) {
    processors.set(processor.name, processor);
  },

  async process(contacts: Contact | Contact[], runType: RunType): Promise<CuratorQueItem[]> {
    const contactArray = Array.isArray(contacts) ? contacts : [contacts];
    const results = await Promise.all(
      contactArray.map((contact) => processSingleContact(contact, runType))
    );
    return results.flat().filter((curator) => curator !== undefined) as CuratorQueItem[];
  },

  settings(): CuratorSettingProperties[] {
    return Array.from(processors.values()).map(processor => ({
      name: processor.name,
      runType: processor.runType,
      settingPropertyName: processor.settingPropertyName,
      settingDescription: processor.settingDescription,
      settingDefaultValue: processor.settingDefaultValue,
    }));
  },

  // Test utility method to clear processors
  _clearProcessors() {
    processors.clear();
  }
};