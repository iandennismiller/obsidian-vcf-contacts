import "src/insights/insightLoading";

import { Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { ContactsView } from "src/ui/sidebar/sidebarView";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";
import myScrollTo from "src/util/myScrollTo";
import { VCFolderWatcher } from "src/services/vcfFolderWatcher";
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { setApp, clearApp } from "src/context/sharedAppContext";
import { loggingService } from "src/services/loggingService";
import { GraphRelationshipManager } from "src/contacts/graphRelationshipManager";

import { ContactsSettingTab, DEFAULT_SETTINGS } from './settings/settings';
import { ContactsPluginSettings } from  './settings/settings.d';

export default class ContactsPlugin extends Plugin {
	settings: ContactsPluginSettings;
	private vcfWatcher: VCFolderWatcher | null = null;
	private settingsUnsubscribe: (() => void) | null = null;
	private graphRelationshipManager: GraphRelationshipManager | null = null;
	private pendingSyncFiles = new Set<string>();
	private syncDebounceTimer: number | null = null;

	async onload() {
		// Set up app context for shared utilities
		setApp(this.app);

		await this.loadSettings();
		
		// Set log level from settings
		loggingService.setLogLevel(this.settings.logLevel);
		
		loggingService.info("VCF Contacts plugin loaded");
		
		// Initialize graph-based relationship manager
		this.graphRelationshipManager = new GraphRelationshipManager(this.app);
		await this.graphRelationshipManager.initialize();
		
		// Initialize VCF folder watcher
		this.vcfWatcher = new VCFolderWatcher(this.app, this.settings);
		await this.vcfWatcher.start();

		// Listen for when the active leaf changes (when user switches away from a file)
		// This is more appropriate than 'modify' events which fire too frequently
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				this.handleActiveLeafChange(leaf);
			})
		);

		// Also listen for modify events to track which contact files have changes
		// but don't sync immediately - just mark them as needing sync
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.markContactFileForSync(file);
				}
			})
		);

		// Listen for file open events to sync frontmatter to note content
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.handleFileOpen(file);
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

    this.addCommand({
      id: 'contacts-refresh-current-relationships',
      name: "Refresh Current Contact Relationships",
      callback: async () => {
        await this.refreshCurrentContactRelationships();
      },
    });

    this.addCommand({
      id: 'contacts-clear-sync-locks-debug',
      name: "Clear Relationship Sync Locks (Debug)",
      callback: () => {
        this.clearRelationshipSyncLocks();
      },
    });

    this.addCommand({
      id: 'contacts-validate-graph-debug',
      name: "Validate Relationship Graph (Debug)",
      callback: async () => {
        await this.validateRelationshipGraph();
      },
    });


	}

	onunload() {
		// Clean up app context
		clearApp();

		// Clean up debounce timer
		if (this.syncDebounceTimer) {
			window.clearTimeout(this.syncDebounceTimer);
			this.syncDebounceTimer = null;
		}

		// Clean up VCF folder watcher
		if (this.vcfWatcher) {
			this.vcfWatcher.stop();
			this.vcfWatcher = null;
		}

		// Clean up graph relationship manager
		this.graphRelationshipManager = null;

		// Unsubscribe from settings changes
		if (this.settingsUnsubscribe) {
			this.settingsUnsubscribe();
			this.settingsUnsubscribe = null;
		}
	}

	private markContactFileForSync(file: TFile) {
		try {
			// Check if this file has contact frontmatter
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (frontmatter && (frontmatter.UID || frontmatter.uid)) {
				// This is a contact file, mark it for sync when user switches away
				this.pendingSyncFiles.add(file.path);
			}
		} catch (error) {
			loggingService.warn(`Error marking contact file for sync: ${error.message}`);
		}
	}

	private async handleFileOpen(file: TFile) {
		try {
			// Check if this is a contact file
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (frontmatter && (frontmatter.UID || frontmatter.uid) && this.graphRelationshipManager) {
				// This is a contact file - sync graph to note content
				await this.graphRelationshipManager.syncOnFileOpen(file);
			}
		} catch (error) {
			loggingService.warn(`Error handling file open: ${error.message}`);
		}
	}

	private handleActiveLeafChange(leaf: WorkspaceLeaf | null) {
		try {
			// Get the previous active file and sync it if it was a contact file with pending changes
			const previousFile = this.app.workspace.getActiveFile();
			
			// Debounce the sync to avoid excessive calls when user rapidly switches between files
			if (this.syncDebounceTimer) {
				window.clearTimeout(this.syncDebounceTimer);
			}

			this.syncDebounceTimer = window.setTimeout(async () => {
				// Sync any pending contact files
				if (this.pendingSyncFiles.size > 0 && this.graphRelationshipManager) {
					const filesToSync = Array.from(this.pendingSyncFiles);
					this.pendingSyncFiles.clear();

					for (const filePath of filesToSync) {
						const file = this.app.vault.getAbstractFileByPath(filePath);
						if (file instanceof TFile) {
							const fileContent = await this.app.vault.read(file);
							await this.graphRelationshipManager.syncFromUserMarkdownEdit(file, fileContent);
						}
					}

					if (filesToSync.length > 0) {
						loggingService.info(`Synced relationships for ${filesToSync.length} contact file(s)`);
					}
				}
			}, 500); // Wait 500ms after the user stops switching files
		} catch (error) {
			loggingService.warn(`Error handling active leaf change: ${error.message}`);
		}
	}

	private async updateAllContactRelationships() {
		try {
			if (!this.graphRelationshipManager) {
				return;
			}

			// Update all contacts using the graph-based manager
			const result = await this.graphRelationshipManager.updateAllContacts();

			if (result.success) {
				loggingService.info(`Updated relationships for ${result.filesUpdated.length} contacts`);
			} else {
				loggingService.warn(`Error updating contacts: ${result.errors.join(', ')}`);
			}
		} catch (error) {
			loggingService.warn(`Error updating all contact relationships: ${error.message}`);
		}
	}

	private async refreshCurrentContactRelationships() {
		try {
			if (!this.graphRelationshipManager) {
				return;
			}

			// Get the currently active file
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile || activeFile.extension !== 'md') {
				loggingService.warn('No active markdown file to refresh relationships');
				return;
			}

			// Check if it's a contact file
			const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
			if (!frontmatter || (!frontmatter.UID && !frontmatter.uid)) {
				loggingService.warn('Active file is not a contact file');
				return;
			}

			// Manual refresh with full bidirectional sync
			const result = await this.graphRelationshipManager.manualRefresh(activeFile);

			if (result.success) {
				loggingService.info(`Refreshed relationships for ${activeFile.basename}`);
			} else {
				loggingService.warn(`Error refreshing relationships: ${result.errors.join(', ')}`);
			}
		} catch (error) {
			loggingService.warn(`Error refreshing current contact relationships: ${error.message}`);
		}
	}

	/**
	 * Emergency command to clear relationship sync locks.
	 * Useful if the system gets stuck in a deadlocked state.
	 */
	private clearRelationshipSyncLocks() {
		try {
			if (this.graphRelationshipManager) {
				this.graphRelationshipManager.clearAllLocks();
				loggingService.info('Cleared all relationship sync locks');
			}
		} catch (error) {
			loggingService.warn(`Error clearing sync locks: ${error.message}`);
		}
	}

	/**
	 * Debugging command to validate relationship graph consistency.
	 */
	private async validateRelationshipGraph() {
		try {
			if (!this.graphRelationshipManager) {
				return;
			}

			const validation = this.graphRelationshipManager.validateGraph();
			const stats = this.graphRelationshipManager.getGraphStats();
			
			loggingService.info(`Graph stats: ${stats.nodes} nodes, ${stats.edges} edges, ${stats.phantomNodes} phantom nodes`);
			
			if (validation.isValid) {
				loggingService.info('Relationship graph is consistent');
			} else {
				loggingService.warn(`Relationship graph has ${validation.issues.length} issue(s):`);
				validation.issues.forEach(issue => loggingService.warn(`  - ${issue}`));
			}
		} catch (error) {
			loggingService.warn(`Error validating relationship graph: ${error.message}`);
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
