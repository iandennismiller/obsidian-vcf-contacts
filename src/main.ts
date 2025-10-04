import { Plugin, Notice } from 'obsidian';
import { VcardFile } from "./models/vcardFile";
import { SyncWatcher } from "src/plugin/services/syncWatcher";
import { setupVcardDropHandler } from 'src/plugin/services/dropHandler';
import { setApp, clearApp } from "src/plugin/context/sharedAppContext";
import { setSettings, clearSettings } from "src/plugin/context/sharedSettingsContext";
import { CuratorManager, curatorService } from "./models/curatorManager/curatorManager";
import { waitForMetadataCache } from "src/plugin/services/metadataCacheWaiter";

import { ContactNote } from "./models/contactNote";
import { ContactManager } from "./models/contactManager";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './plugin/settings';
import { ContactsPluginSettings } from  './plugin/settings';

/* istanbul ignore next */
// Plugin lifecycle methods integrate with Obsidian API and require full app context
export default class ContactsPlugin extends Plugin {
	settings: ContactsPluginSettings;
	private syncWatcher: SyncWatcher | null = null;
	private vcardDropCleanup: (() => void) | null = null;
	private contactManager: ContactManager | null = null;
	private curatorManager: CuratorManager | null = null;

	async onload() {
		await this.loadSettings();
		// Set up app context for shared utilities
		setApp(this.app);
		// Set up settings context for curator processors
		setSettings(this.settings);

		// Note: Curator processors are registered in curatorRegistration.ts at module load time
		// This ensures they're available when DEFAULT_SETTINGS is created

		// Add settings tab immediately so users can configure the plugin
		this.addSettingTab(new ContactsSettingTab(this.app, this));

		// Initialize plugin components in the background without blocking Obsidian startup
		// This runs asynchronously and doesn't block Obsidian from loading
		this.initializePluginAsync();
	}

	/**
	 * Initialize plugin components asynchronously in the background.
	 * This method waits for the metadata cache to be ready, then initializes
	 * all plugin components that depend on it.
	 * 
	 * This runs in the background and doesn't block Obsidian from loading.
	 */
	private async initializePluginAsync(): Promise<void> {
		try {
			// Wait for metadata cache to be ready before initializing
			await waitForMetadataCache(this.app);

			// Initialize ContactManager for automatic syncing
			this.contactManager = new ContactManager(this.app, this.settings);
			await this.contactManager.initializeCache();
			this.contactManager.setupEventListeners();

			// Initialize CuratorManager
			this.curatorManager = new CuratorManager(this.app, this.settings, this.contactManager);

			// Ensure contact data consistency during initialization
			try {
				await this.contactManager.ensureContactDataConsistency();
			} catch (error: any) {
				console.debug(`Error during contact data consistency check: ${error.message}`);
			}

			// Initialize VCard sync watcher
			this.syncWatcher = new SyncWatcher(this.app, this.settings);
			await this.syncWatcher.start();

			// Initialize vcard drop handler (watch for .vcf files created in the vault)
			this.vcardDropCleanup = setupVcardDropHandler(this.app, this.settings);

			// Register curator processor commands
			if (this.curatorManager) {
				this.curatorManager.registerCommands(this);
			}

			// Register validation commands
			this.registerValidationCommands();

			console.debug('[ContactsPlugin] Plugin initialization complete');
		} catch (error: any) {
			console.error(`[ContactsPlugin] Error during async initialization: ${error.message}`);
		}
	}

	onunload() {
		// Clean up ContactManager event listeners
		if (this.contactManager) {
			this.contactManager.cleanupEventListeners();
			this.contactManager = null;
		}

		// Clean up CuratorManager
		this.curatorManager = null;

		// Clean up app context
		clearApp();
		// Clean up settings context
		clearSettings();

		// Clean up VCard sync watcher
		if (this.syncWatcher) {
			this.syncWatcher.stop();
			this.syncWatcher = null;
		}

		// Clean up vcard drop handler
		if (this.vcardDropCleanup) {
			this.vcardDropCleanup();
			this.vcardDropCleanup = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update shared settings context to keep it in sync
		setSettings(this.settings);
	}

	/**
	 * Register validation commands for removing invalid frontmatter fields
	 */
	private registerValidationCommands(): void {
		// Command to remove invalid fields from current contact
		this.addCommand({
			id: 'remove-invalid-fields-current',
			name: "Remove invalid frontmatter fields from current contact",
			callback: async () => {
				await this.removeInvalidFieldsFromCurrent();
			},
		});

		// Command to remove invalid fields from all contacts
		this.addCommand({
			id: 'remove-invalid-fields-all',
			name: "Remove invalid frontmatter fields from all contacts",
			callback: async () => {
				await this.removeInvalidFieldsFromAll();
			},
		});
	}

	/**
	 * Remove invalid frontmatter fields from the current active contact
	 */
	private async removeInvalidFieldsFromCurrent(): Promise<void> {
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

		try {
			const contactNote = new ContactNote(this.app, this.settings, activeFile);
			const result = await contactNote.removeInvalidFrontmatterFields();

			if (result.errors.length > 0) {
				new Notice(`Error removing invalid fields: ${result.errors[0]}`);
				return;
			}

			if (result.removed.length === 0) {
				new Notice('No invalid fields found');
			} else {
				new Notice(`Removed ${result.removed.length} invalid field(s): ${result.removed.join(', ')}`);
			}
		} catch (error: any) {
			console.error('Error removing invalid fields from current contact:', error);
			new Notice('Error removing invalid fields');
		}
	}

	/**
	 * Remove invalid frontmatter fields from all contacts
	 */
	private async removeInvalidFieldsFromAll(): Promise<void> {
		if (!this.contactManager) {
			new Notice('Contact manager not initialized');
			return;
		}

		try {
			new Notice('Removing invalid fields from all contacts...');
			
			const contactFiles = this.contactManager.getAllContactFiles();
			let totalRemoved = 0;
			let processedCount = 0;

			for (const file of contactFiles) {
				try {
					const contactNote = new ContactNote(this.app, this.settings, file);
					const result = await contactNote.removeInvalidFrontmatterFields();
					
					if (result.removed.length > 0) {
						totalRemoved += result.removed.length;
						processedCount++;
					}
				} catch (error: any) {
					console.error(`Error processing contact ${file.name}:`, error);
				}
			}

			if (totalRemoved === 0) {
				new Notice('No invalid fields found in any contacts');
			} else {
				new Notice(`Removed ${totalRemoved} invalid field(s) from ${processedCount} contact(s)`);
			}
		} catch (error: any) {
			console.error('Error removing invalid fields from all contacts:', error);
			new Notice('Error removing invalid fields from all contacts');
		}
	}

}
