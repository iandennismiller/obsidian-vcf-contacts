import { Plugin, Notice } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { VcardFile } from "./models/vcardFile";
import myScrollTo from "src/ui/myScrollTo";
import { SyncWatcher } from "src/services/syncWatcher";
import { setupVCFDropHandler } from 'src/ui/vcfDropHandler';
import { setApp, clearApp } from "src/context/sharedAppContext";
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

import { ContactsSettingTab, DEFAULT_SETTINGS } from './settings/settings';
import { ContactsPluginSettings } from  './settings/settings.d';

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
		} catch (error) {
			console.log(`Error during contact data consistency check: ${error.message}`);
		}

		// Initialize VCard sync watcher
		this.syncWatcher = new SyncWatcher(this.app, this.settings);
		await this.syncWatcher.start();

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
