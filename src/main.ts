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
import { vcard } from "src/contacts/vcard";
import { mdRender } from "src/contacts/contactMdTemplate";
import { updateFrontMatterValue } from "src/contacts/contactFrontmatter";

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

		// Listen for file creations and drops (including VCF drops)
		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (file instanceof TFile) {
					await this.onFileCreate(file);
				}
			})
		);

		// Listen for active leaf changes to sync relationships when switching files
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', async () => {
				const previousFile = this.lastActiveFile;
				const currentFile = this.app.workspace.getActiveFile();
				
				// Handle file close event for previous file
				if (previousFile && this.isContactFile(previousFile)) {
					await this.onFileClose(previousFile);
				}
				
				// Handle file open event for current file
				if (currentFile && this.isContactFile(currentFile)) {
					await this.onFileOpen(currentFile);
				}
				
				this.lastActiveFile = currentFile;
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
	 * Handle file open events for relationship syncing (frontmatter → Related list)
	 */
	private async onFileOpen(file: TFile) {
		if (!this.isContactFile(file)) {
			return;
		}

		try {
			await this.relationshipService.syncFromFrontMatter(file, this.app);
		} catch (error) {
			loggingService.error(`Failed to sync relationships from frontmatter for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handle file creation events (including VCF drops)
	 */
	private async onFileCreate(file: TFile) {
		try {
			// Handle VCF file drops
			if (file.extension === 'vcf') {
				await this.handleVCFDrop(file);
				return;
			}

			// Handle contact file creation
			if (this.isContactFile(file)) {
				const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
				if (frontMatter) {
					this.relationshipService.updateContact(file, frontMatter);
				}
			}
		} catch (error) {
			loggingService.error(`Failed to handle file creation for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Handle VCF file drops - copy to VCF folder and remove from vault
	 */
	private async handleVCFDrop(file: TFile) {
		try {
			// Check if this is a VCF file dropped into the vault (not in VCF folder)
			const vcfFolderPath = this.settings.vcfWatchFolder;
			if (!vcfFolderPath || file.path.startsWith(vcfFolderPath)) {
				return; // Already in VCF folder or no VCF folder configured
			}

			loggingService.info(`VCF file dropped: ${file.path}, moving to VCF folder`);

			// Read the VCF content
			const vcfContent = await this.app.vault.read(file);
			
			// Determine target path in VCF folder
			const fileName = file.name;
			const targetPath = `${vcfFolderPath}/${fileName}`;

			// Check if file already exists in VCF folder
			const existingFile = this.app.vault.getAbstractFileByPath(targetPath);
			
			if (existingFile instanceof TFile) {
				// File exists, check for differences
				const existingContent = await this.app.vault.read(existingFile);
				
				if (existingContent !== vcfContent) {
					// Content is different, update existing file and sync to contact
					await this.app.vault.modify(existingFile, vcfContent);
					loggingService.info(`Updated existing VCF file: ${targetPath}`);
					
					// Parse the VCF and update corresponding contact note
					await this.updateContactFromVCF(vcfContent, fileName);
				} else {
					loggingService.info(`VCF file ${fileName} already exists with same content`);
				}
			} else {
				// File doesn't exist, create it
				await this.app.vault.create(targetPath, vcfContent);
				loggingService.info(`Created new VCF file: ${targetPath}`);
				
				// Parse the VCF and create/update corresponding contact note
				await this.updateContactFromVCF(vcfContent, fileName);
			}

			// Remove the dropped file from vault
			await this.app.vault.delete(file);
			loggingService.info(`Removed dropped VCF file from vault: ${file.path}`);

		} catch (error) {
			loggingService.error(`Failed to handle VCF drop for ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Update contact note from VCF content
	 */
	private async updateContactFromVCF(vcfContent: string, fileName: string) {
		try {
			// Parse the VCF content
			const contacts = [];
			for await (const [slug, vCardObject] of vcard.parse(vcfContent)) {
				if (slug && vCardObject) {
					contacts.push({ slug, data: vCardObject });
				}
			}

			// Update or create contact notes for each contact in the VCF
			for (const { slug, data } of contacts) {
				const contactPath = `${this.settings.contactsFolder}/${slug}.md`;
				const existingFile = this.app.vault.getAbstractFileByPath(contactPath);

				if (existingFile instanceof TFile) {
					// Contact exists, check for differences and update
					const existingFrontMatter = this.app.metadataCache.getFileCache(existingFile)?.frontmatter;
					
					if (existingFrontMatter) {
						// Compare and update different fields
						for (const [key, value] of Object.entries(data)) {
							if (existingFrontMatter[key] !== value) {
								await updateFrontMatterValue(existingFile, key, value.toString(), this.app);
								loggingService.info(`Updated field ${key} for contact ${slug}`);
							}
						}
					}
				} else {
					// Contact doesn't exist, create it
					const contactContent = mdRender(data);
					await this.app.vault.create(contactPath, contactContent);
					loggingService.info(`Created new contact from VCF: ${slug}`);
				}
			}
		} catch (error) {
			loggingService.error(`Failed to update contact from VCF ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check if a file is a contact file
	 */
	private isContactFile(file: TFile): boolean {
		return file.path.startsWith(this.settings.contactsFolder) && file.extension === 'md';
	}
}
