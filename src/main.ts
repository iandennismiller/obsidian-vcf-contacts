import "src/insights/insightLoading";

import { Plugin, Notice } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { VcardFile } from "src/contacts/vcardFile";
import myScrollTo from "src/ui/myScrollTo";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { setupVCFDropHandler } from 'src/ui/vcfDropHandler';
import { setApp, clearApp } from "src/context/sharedAppContext";

import { ContactNote } from "src/contacts/contactNote";
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
		// Set up app context for shared utilities
		setApp(this.app);

		// Initialize ContactManager for automatic syncing
		this.contactManager = new ContactManager(this.app, this.settings);
		await this.contactManager.initializeCache();
		this.contactManager.setupEventListeners();

		// Ensure contact data consistency during initialization
		try {
			await this.contactManager.ensureContactDataConsistency();
		} catch (error) {
			console.log(`Error during contact data consistency check: ${error.message}`);
		}

		// Initialize VCF folder watcher
		this.vcfWatcher = new VCFolderWatcher(this.app, this.settings);
		await this.vcfWatcher.start();

		// Initialize VCF drop handler (watch for .vcf files created in the vault)
		this.vcfDropCleanup = setupVCFDropHandler(this.app, this.settings);

		this.registerView(
			VcardFile.CONTACTS_VIEW_CONFIG.type,
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
			id: 'run-insight-processors-current',
			name: "Run insight processors on current contact",
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

				new Notice('Running insight processors on current contact...');
				
				try {
					const { getFrontmatterFromFiles } = await import('./contacts/contactNote');
					const { insightService } = await import('./insights/insightService');
					const { RunType } = await import('./insights/insight.d');
					
					// Get contact data
					const contacts = await getFrontmatterFromFiles([activeFile]);
					
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
			},
		});

		this.addCommand({
			id: 'run-insight-processors-all',
			name: "Run insight processors on all contacts",
			callback: async () => {
				new Notice('Running insight processors on all contacts...');
				
				try {
					const { getFrontmatterFromFiles } = await import('./contacts/contactNote');
					const { insightService } = await import('./insights/insightService');
					const { RunType } = await import('./insights/insight.d');
					
					// Get all contact files
					const contactFiles = this.contactManager?.getAllContactFiles() || [];
					if (contactFiles.length === 0) {
						new Notice('No contact files found');
						return;
					}
					
					// Get contact data
					const contacts = await getFrontmatterFromFiles(contactFiles);
					
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
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateSidebarView() {
		if (this.app.workspace.getLeavesOfType(VcardFile.CONTACTS_VIEW_CONFIG.type).length < 1) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VcardFile.CONTACTS_VIEW_CONFIG.type,
          active: true,
        });
      }
		}

    // Grab the leaf
    const leaf = this.app.workspace.getLeavesOfType(VcardFile.CONTACTS_VIEW_CONFIG.type)[0];
    if (!leaf) return null;

    await this.app.workspace.revealLeaf(leaf);
    return leaf.view as ContactsView;
	}
}
