import { ItemView, WorkspaceLeaf } from "obsidian";
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
				<SidebarRootView />
		);
	}

	async onClose() {
		clearApp();
    clearSettings();
		this.root.unmount();
	}
}
