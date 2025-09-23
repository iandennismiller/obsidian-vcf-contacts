import "src/insights/insightLoading";

import { Plugin, TFile, TFolder } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";
import myScrollTo from "src/util/myScrollTo";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setApp, clearApp } from "src/context/sharedAppContext";
import { loggingService } from "src/services/loggingService";
import { RelationshipService } from "src/relationships/relationshipService";
import { getFrontmatterFromFiles } from "src/contacts/contactFrontmatter";
import { findContactFiles } from "src/file/file";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './settings/settings';
import { ContactsPluginSettings } from  './settings/settings.d';

export default class ContactsPlugin extends Plugin {
	settings: ContactsPluginSettings;
	private vcfWatcher: VCFolderWatcher | null = null;
	private settingsUnsubscribe: (() => void) | null = null;
	private relationshipService: RelationshipService;
	private lastActiveFile: TFile | null = null;

	async onload() {
		// Set up app context for shared utilities
		setApp(this.app);

		await this.loadSettings();
		
		// Set log level from settings
		loggingService.setLogLevel(this.settings.logLevel);
		
		loggingService.info("VCF Contacts plugin loaded");
		
		// Initialize relationship service
		this.relationshipService = new RelationshipService();
		
		// Initialize VCF folder watcher
		this.vcfWatcher = new VCFolderWatcher(this.app, this.settings);
		await this.vcfWatcher.start();

		// Initialize relationship graph with existing contacts
		await this.initializeRelationships();

		// Set up event listeners for relationship syncing
		this.setupRelationshipEventListeners();

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

	/**
	 * Initialize the relationship graph with existing contacts
	 */
	private async initializeRelationships() {
		try {
			const contactsFolder = this.app.vault.getAbstractFileByPath(this.settings.contactsFolder);
			if (!contactsFolder || !(contactsFolder instanceof TFolder)) {
				loggingService.warn(`Contacts folder not found: ${this.settings.contactsFolder}`);
				return;
			}

			const contactFiles = findContactFiles(contactsFolder);
			const contacts = await getFrontmatterFromFiles(contactFiles);
			
			await this.relationshipService.initializeFromContacts(contacts);
			loggingService.info(`Initialized relationship graph with ${contacts.length} contacts`);
		} catch (error) {
			loggingService.error(`Failed to initialize relationship graph: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Set up event listeners for relationship syncing
	 */
	private setupRelationshipEventListeners() {
		// Listen for file modifications to update the relationship graph
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (file instanceof TFile) {
					await this.onFileModify(file);
				}
			})
		);

		// Listen for file deletions to remove from relationship graph
		this.registerEvent(
			this.app.vault.on('delete', async (file) => {
				if (file instanceof TFile) {
					await this.onFileDelete(file);
				}
			})
		);

		// Listen for active leaf changes to sync relationships when switching files
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', async () => {
				const previousFile = this.lastActiveFile;
				const currentFile = this.app.workspace.getActiveFile();
				this.lastActiveFile = currentFile;
				
				if (previousFile && this.isContactFile(previousFile)) {
					await this.onFileClose(previousFile);
				}
			})
		);
	}

	/**
	 * Handle file close events for relationship syncing
	 */
	private async onFileClose(file: TFile) {
		if (!this.isContactFile(file)) {
			return;
		}

		try {
			await this.relationshipService.syncFromMarkdown(file, this.app);
			await this.relationshipService.syncAffectedContacts(file, this.app);
		} catch (error) {
			loggingService.error(`Failed to sync relationships for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handle file modification events
	 */
	private async onFileModify(file: TFile) {
		if (!this.isContactFile(file)) {
			return;
		}

		try {
			const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (frontMatter) {
				this.relationshipService.updateContact(file, frontMatter);
			}
		} catch (error) {
			loggingService.error(`Failed to update contact in relationship graph for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handle file deletion events
	 */
	private async onFileDelete(file: TFile) {
		if (!this.isContactFile(file)) {
			return;
		}

		try {
			const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (frontMatter) {
				this.relationshipService.removeContact(frontMatter);
			}
		} catch (error) {
			loggingService.error(`Failed to remove contact from relationship graph for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check if a file is a contact file
	 */
	private isContactFile(file: TFile): boolean {
		return file.path.startsWith(this.settings.contactsFolder) && file.extension === 'md';
	}
}
