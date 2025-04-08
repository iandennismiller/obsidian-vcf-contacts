import { ItemView, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { createRoot } from "react-dom/client";
import {setApp, clearApp} from "src/context/sharedAppContext";
import ContactsPlugin from "src/main";
import { CONTACTS_VIEW_CONFIG } from "src/util/constants";
import { SidebarRootView } from "./components/SidebarRootView";

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
		this.root.render(
				<SidebarRootView plugin={this.plugin} />
		);
	}

	async onClose() {
		clearApp();
		this.root.unmount();
	}
}
