import "src/insights/insightLoading";

import { Plugin, Notice } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";
import myScrollTo from "src/util/myScrollTo";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { setupVCFDropHandler } from 'src/services/vcfDropHandler';
import { setApp, clearApp } from "src/context/sharedAppContext";
import { loggingService } from "src/services/loggingService";
import { syncRelatedListToFrontmatter } from "src/util/relatedListSync";
import { ContactManager } from "src/contacts/contactManager";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './settings/settings';
import { ContactsPluginSettings } from  './settings/settings.d';

export default class ContactsPlugin extends Plugin {
	settings: ContactsPluginSettings;
	private vcfWatcher: VCFolderWatcher | null = null;
	private vcfDropCleanup: (() => void) | null = null;
	private contactManager: ContactManager | null = null;

	async onload() {
		await this.loadSettings();
		// Initialize logging service early
		loggingService.initialize(this.settings.logLevel, "VCF Contacts plugin loaded");
		// Set up app context for shared utilities
		setApp(this.app);

		// Initialize ContactManager for automatic syncing
		this.contactManager = new ContactManager(this.app, this.settings);
		await this.contactManager.initializeCache();
		this.contactManager.setupEventListeners();

		// Initialize VCF folder watcher
		this.vcfWatcher = new VCFolderWatcher(this.app, this.settings);
		await this.vcfWatcher.start();

		// Initialize VCF drop handler (watch for .vcf files created in the vault)
		this.vcfDropCleanup = setupVCFDropHandler(this.app, this.settings);

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
				leaf?.createNewContact();
			},
		});

		this.addCommand({
			id: 'sync-related-list',
			name: "Sync Related list to frontmatter",
			callback: async () => {
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

				// Perform the sync
				new Notice('Syncing Related list to frontmatter...');
				const result = await syncRelatedListToFrontmatter(
					this.app,
					activeFile,
					this.settings.contactsFolder
				);

				if (result.success) {
					new Notice('Related list synced successfully!');
					if (result.errors.length > 0) {
						new Notice(`Sync completed with ${result.errors.length} warnings - check console for details`);
						result.errors.forEach(error => loggingService.warn(error));
					}
				} else {
					new Notice('Failed to sync Related list - check console for details');
					result.errors.forEach(error => loggingService.error(error));
				}
			},
		});
	}

	onunload() {
		// Clean up ContactManager event listeners
		if (this.contactManager) {
			this.contactManager.cleanupEventListeners();
			this.contactManager = null;
		}

		// Clean up app context
		clearApp();

		// Clean up VCF folder watcher
		if (this.vcfWatcher) {
			this.vcfWatcher.stop();
			this.vcfWatcher = null;
		}

		// Clean up VCF drop handler
		if (this.vcfDropCleanup) {
			this.vcfDropCleanup();
			this.vcfDropCleanup = null;
		}
		// Clean up loggingService event listener
		loggingService.cleanup();
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
