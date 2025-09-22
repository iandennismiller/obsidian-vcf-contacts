import "src/insights/insightLoading";

import { Plugin, TFile } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";
import myScrollTo from "src/util/myScrollTo";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setApp, clearApp } from "src/context/sharedAppContext";
import { loggingService } from "src/services/loggingService";
import { RelationshipSyncService } from "src/contacts/relationshipSyncService";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './settings/settings';
import { ContactsPluginSettings } from  './settings/settings.d';

export default class ContactsPlugin extends Plugin {
	settings: ContactsPluginSettings;
	private vcfWatcher: VCFolderWatcher | null = null;
	private settingsUnsubscribe: (() => void) | null = null;
	private relationshipSyncService: RelationshipSyncService | null = null;

	async onload() {
		// Set up app context for shared utilities
		setApp(this.app);

		await this.loadSettings();
		
		// Set log level from settings
		loggingService.setLogLevel(this.settings.logLevel);
		
		loggingService.info("VCF Contacts plugin loaded");
		
		// Initialize relationship sync service
		this.relationshipSyncService = new RelationshipSyncService(this.app);
		
		// Initialize VCF folder watcher
		this.vcfWatcher = new VCFolderWatcher(this.app, this.settings);
		await this.vcfWatcher.start();

		// Listen for file modification events to sync relationships
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					// Check if this is a contact file and handle relationship changes
					this.handleContactFileModification(file);
				}
			})
		);

		// Listen for settings changes to update watcher
		this.settingsUnsubscribe = onSettingsChange(async (newSettings) => {
			// Update log level when settings change
			loggingService.setLogLevel(newSettings.logLevel);
			
			if (this.vcfWatcher) {
				await this.vcfWatcher.updateSettings(newSettings);
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

    this.addCommand({
      id: 'contacts-update-relationships',
      name: "Update All Contact Relationships",
      callback: async () => {
        await this.updateAllContactRelationships();
      },
    });


	}

	onunload() {
		// Clean up app context
		clearApp();

		// Clean up VCF folder watcher
		if (this.vcfWatcher) {
			this.vcfWatcher.stop();
			this.vcfWatcher = null;
		}

		// Clean up relationship sync service
		this.relationshipSyncService = null;

		// Unsubscribe from settings changes
		if (this.settingsUnsubscribe) {
			this.settingsUnsubscribe();
			this.settingsUnsubscribe = null;
		}
	}

	private async handleContactFileModification(file: TFile) {
		try {
			// Check if this file has contact frontmatter
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (frontmatter && (frontmatter['N.GN'] || frontmatter['FN'])) {
				// This is a contact file, handle potential relationship changes
				if (this.relationshipSyncService) {
					await this.relationshipSyncService.handleFileModification(file);
				}
			}
		} catch (error) {
			loggingService.warn(`Error handling contact file modification: ${error.message}`);
		}
	}

	private async updateAllContactRelationships() {
		try {
			if (!this.relationshipSyncService) {
				return;
			}

			// Get all contact files
			const allFiles = this.app.vault.getMarkdownFiles();
			const contactFiles = [];

			for (const file of allFiles) {
				const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
				if (frontmatter && (frontmatter['N.GN'] || frontmatter['FN'])) {
					contactFiles.push(file);
				}
			}

			// Update relationships for all contact files
			for (const file of contactFiles) {
				await this.relationshipSyncService.updateRelationshipsSection(file);
			}

			loggingService.info(`Updated relationships for ${contactFiles.length} contacts`);
		} catch (error) {
			loggingService.warn(`Error updating all contact relationships: ${error.message}`);
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
