import "src/insights/insightLoading";

import { Plugin } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";
import myScrollTo from "src/util/myScrollTo";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setApp, clearApp } from "src/context/sharedAppContext";
import { loggingService } from "src/services/loggingService";
import { RelationshipManager } from "src/relationships/relationshipManager";
import { VCFDropHandler } from "src/relationships/vcfDropHandler";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './settings/settings';
import { ContactsPluginSettings } from  './settings/settings.d';

export default class ContactsPlugin extends Plugin {
	settings: ContactsPluginSettings;
	private vcfWatcher: VCFolderWatcher | null = null;
	private relationshipManager: RelationshipManager | null = null;
	private vcfDropHandler: VCFDropHandler | null = null;
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
		this.relationshipManager = new RelationshipManager(this.app);
		await this.relationshipManager.initializeFromVault();

		// Initialize VCF drop handler
		this.vcfDropHandler = new VCFDropHandler(this.app, this.settings, this.relationshipManager);

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


	}

	onunload() {
		// Clean up app context
		clearApp();

		// Clean up VCF folder watcher
		if (this.vcfWatcher) {
			this.vcfWatcher.stop();
			this.vcfWatcher = null;
		}

		// Clean up relationship manager
		if (this.relationshipManager) {
			this.relationshipManager.destroy();
			this.relationshipManager = null;
		}

		// Clean up VCF drop handler
		if (this.vcfDropHandler) {
			this.vcfDropHandler.destroy();
			this.vcfDropHandler = null;
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
