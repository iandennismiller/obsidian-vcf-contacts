import { Plugin, Notice } from 'obsidian';
import { VcardFile } from "./models/vcardFile";
import { SyncWatcher } from "src/plugin/services/syncWatcher";
import { setupVCFDropHandler } from 'src/plugin/services/dropHandler';
import { setApp, clearApp } from "src/plugin/context/sharedAppContext";
import { CuratorManager, curatorService } from "./models/curatorManager/curatorManager";

// Curator processor imports
import { UidProcessor } from 'src/curators/uidValidate';
import { VcardSyncPreProcessor } from 'src/curators/vcardSyncRead';
import { RelatedOtherProcessor } from 'src/curators/relatedOther';
import { RelatedFrontMatterProcessor } from 'src/curators/relatedFrontMatter';
import { RelatedListProcessor } from 'src/curators/relatedList';
import { GenderInferenceProcessor } from 'src/curators/genderInference';
import { GenderRenderProcessor } from 'src/curators/genderRender';
import { RelatedNamespaceUpgradeProcessor } from 'src/curators/namespaceUpgrade';
import { VcardSyncPostProcessor } from 'src/curators/vcardSyncWrite';

import { ContactNote } from "./models/contactNote";
import { ContactManager } from "./models/contactManager";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './plugin/settings';
import { ContactsPluginSettings } from  './interfaces/ContactsPluginSettings';

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

		// Register curator processors
		curatorService.register(UidProcessor);
		curatorService.register(VcardSyncPreProcessor);
		curatorService.register(RelatedOtherProcessor);
		curatorService.register(RelatedFrontMatterProcessor);
		curatorService.register(RelatedListProcessor);
		curatorService.register(RelatedNamespaceUpgradeProcessor);
		curatorService.register(GenderInferenceProcessor);
		curatorService.register(GenderRenderProcessor);
		curatorService.register(VcardSyncPostProcessor);

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
			console.log(`Error during contact data consistency check: ${error.message}`);
		}

		// Initialize VCard sync watcher
		this.syncWatcher = new SyncWatcher(this.app, this.settings);
		await this.syncWatcher.start();

		// Initialize VCF drop handler (watch for .vcf files created in the vault)
		this.vcfDropCleanup = setupVCFDropHandler(this.app, this.settings);

		this.addSettingTab(new ContactsSettingTab(this.app, this));

		// Register curator processor commands
		this.curatorManager.registerCommands(this);
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
	}

}
