import { Plugin, Notice } from 'obsidian';
import { VcardFile } from "./models/vcardFile";
import { SyncWatcher } from "src/plugin/services/syncWatcher";
import { setupVCFDropHandler } from 'src/plugin/services/dropHandler';
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
	private vcfDropCleanup: (() => void) | null = null;
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

			// Initialize VCF drop handler (watch for .vcf files created in the vault)
			this.vcfDropCleanup = setupVCFDropHandler(this.app, this.settings);

			// Register curator processor commands
			if (this.curatorManager) {
				this.curatorManager.registerCommands(this);
			}

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

		// Clean up VCF sync watcher
		if (this.syncWatcher) {
			this.syncWatcher.stop();
			this.syncWatcher = null;
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
		// Update shared settings context to keep it in sync
		setSettings(this.settings);
	}

}
