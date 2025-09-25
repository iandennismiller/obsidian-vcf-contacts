import "src/insights/insightLoading";

import { Plugin, Notice } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";
import myScrollTo from "src/util/myScrollTo";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setApp, clearApp } from "src/context/sharedAppContext";
import { loggingService } from "src/services/loggingService";
import { RelationshipManager } from "src/relationships";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './settings/settings';
import { ContactsPluginSettings } from  './settings/settings.d';

export default class ContactsPlugin extends Plugin {
	settings: ContactsPluginSettings;
	private vcfWatcher: VCFolderWatcher | null = null;
	private relationshipManager: RelationshipManager | null = null;
	private settingsUnsubscribe: (() => void) | null = null;

	async onload() {
		// Set up app context for shared utilities
		setApp(this.app);

		await this.loadSettings();
		
		// Set log level from settings
		loggingService.setLogLevel(this.settings.logLevel);
		
		loggingService.info("VCF Contacts plugin loaded");
		
		// Initialize VCF folder watcher
		this.vcfWatcher = new VCFolderWatcher(this.app, this.settings);
		await this.vcfWatcher.start();

		// Initialize relationship manager
		this.relationshipManager = new RelationshipManager(this.app, this.settings);
		
		// Initialize relationship graph after a short delay to ensure contacts are loaded
		setTimeout(async () => {
			if (this.relationshipManager) {
				try {
					await this.relationshipManager.initializeGraph();
					loggingService.info("Relationship management initialized");
				} catch (error) {
					loggingService.warn(`Failed to initialize relationship management: ${error.message}`);
				}
			}
		}, 1000);

		// Listen for settings changes to update watcher
		this.settingsUnsubscribe = onSettingsChange(async (newSettings) => {
			// Update log level when settings change
			loggingService.setLogLevel(newSettings.logLevel);
			
			if (this.vcfWatcher) {
				await this.vcfWatcher.updateSettings(newSettings);
			}

			// Update relationship manager settings
			if (this.relationshipManager) {
				// Recreate relationship manager with new settings
				this.relationshipManager = new RelationshipManager(this.app, newSettings);
				await this.relationshipManager.initializeGraph();
			}
		});

		this.registerView(
			CONTACTS_VIEW_CONFIG.type,
			(leaf) => new ContactsView(leaf, this)
		);

		this.addRibbonIcon('contact', 'Contacts', () => {
			this.activateSidebarView();
      myScrollTo.handleLeafEvent(null);
		});

		this.addSettingTab(new ContactsSettingTab(this.app, this));

    this.addCommand({
      id: 'contacts-sidebar',
      name: "Open Contacts Sidebar",
      callback: () => {
        this.activateSidebarView();
      },
    });

    this.addCommand({
      id: 'contacts-create',
      name: "Create Contact",
      callback: async () => {
        const leaf = await this.activateSidebarView();
        leaf?.createNewContact()
      },
    });

    // Relationship management commands
    this.addCommand({
      id: 'relationships-sync-current',
      name: "Sync relationships for current contact",
      callback: async () => {
        if (!this.relationshipManager) {
          new Notice("Relationship management not initialized");
          return;
        }
        
        try {
          await this.relationshipManager.syncCurrentFile();
          new Notice("Relationships synced for current contact");
        } catch (error) {
          new Notice(`Failed to sync relationships: ${error.message}`);
          loggingService.error(`Relationship sync error: ${error.message}`);
        }
      },
    });

    this.addCommand({
      id: 'relationships-rebuild-graph',
      name: "Rebuild relationship graph",
      callback: async () => {
        if (!this.relationshipManager) {
          new Notice("Relationship management not initialized");
          return;
        }
        
        try {
          await this.relationshipManager.rebuildGraph();
          const stats = this.relationshipManager.getGraphStats();
          new Notice(`Relationship graph rebuilt: ${stats.nodes} contacts, ${stats.edges} relationships`);
        } catch (error) {
          new Notice(`Failed to rebuild graph: ${error.message}`);
          loggingService.error(`Graph rebuild error: ${error.message}`);
        }
      },
    });

    this.addCommand({
      id: 'relationships-check-consistency',
      name: "Check relationship consistency",
      callback: async () => {
        if (!this.relationshipManager) {
          new Notice("Relationship management not initialized");
          return;
        }
        
        try {
          const result = await this.relationshipManager.checkConsistency();
          if (result.inconsistentContacts.length === 0 && result.missingBacklinks.length === 0) {
            new Notice("All relationships are consistent");
          } else {
            new Notice(`Found issues: ${result.inconsistentContacts.length} inconsistent contacts, ${result.missingBacklinks.length} missing backlinks`);
          }
        } catch (error) {
          new Notice(`Failed to check consistency: ${error.message}`);
          loggingService.error(`Consistency check error: ${error.message}`);
        }
      },
    });

    this.addCommand({
      id: 'relationships-fix-consistency',
      name: "Fix relationship consistency issues",
      callback: async () => {
        if (!this.relationshipManager) {
          new Notice("Relationship management not initialized");
          return;
        }
        
        try {
          await this.relationshipManager.fixConsistency();
          new Notice("Relationship consistency issues fixed");
        } catch (error) {
          new Notice(`Failed to fix consistency: ${error.message}`);
          loggingService.error(`Consistency fix error: ${error.message}`);
        }
      },
    });


	}

	onunload() {
		// Clean up app context
		clearApp();

		// Clean up relationship manager
		if (this.relationshipManager) {
			this.relationshipManager = null;
		}

		// Clean up VCF folder watcher
		if (this.vcfWatcher) {
			this.vcfWatcher.stop();
			this.vcfWatcher = null;
		}

		// Unsubscribe from settings changes
		if (this.settingsUnsubscribe) {
			this.settingsUnsubscribe();
			this.settingsUnsubscribe = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateSidebarView() {
		if (this.app.workspace.getLeavesOfType(CONTACTS_VIEW_CONFIG.type).length < 1) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: CONTACTS_VIEW_CONFIG.type,
          active: true,
        });
      }
		}

    // Grab the leaf
    const leaf = this.app.workspace.getLeavesOfType(CONTACTS_VIEW_CONFIG.type)[0];
    if (!leaf) return null;

    await this.app.workspace.revealLeaf(leaf);
    return leaf.view as ContactsView;
	}
}
