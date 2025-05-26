import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { clearApp, setApp } from "src/context/sharedAppContext";
import { clearSettings, setSettings } from "src/context/sharedSettingsContext";
import ContactsPlugin from "src/main";
import { SidebarRootView } from "src/ui/sidebar/components/SidebarRootView";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";

export class ContactsView extends ItemView {
	root = createRoot(this.containerEl.children[1]);
	plugin: ContactsPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: ContactsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

  async createDefaultPluginFolder(): Promise<void> {
    const vault = this.app.vault;
    const folderPath = "Contacts"; // You can move this to a constant if you prefer

    try {
      const folderExists = await vault.adapter.exists(folderPath);
      if (!folderExists) {
        await vault.createFolder(folderPath);
        this.plugin.settings.contactsFolder = folderPath;
        await this.plugin.saveSettings();
        setSettings(this.plugin.settings);
      } else {
        this.plugin.settings.contactsFolder = folderPath;
        await this.plugin.saveSettings();
        setSettings(this.plugin.settings);
      }
    } catch (err) {
      new Notice('Failed to create folder default Contacts folder');
    }
  }

	getViewType(): string {
		return CONTACTS_VIEW_CONFIG.type;
	}

	getDisplayText(): string {
		return CONTACTS_VIEW_CONFIG.name;
	}

	getIcon(): string {
		return CONTACTS_VIEW_CONFIG.icon;
	}

	async onOpen(){
		setApp(this.app);
    setSettings(this.plugin.settings);
		this.root.render(
				<SidebarRootView
          createDefaultPluginFolder={this.createDefaultPluginFolder.bind(this)}
        />
		);
	}

	async onClose() {
		clearApp();
    clearSettings();
		this.root.unmount();
	}
}
