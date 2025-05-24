import { AbstractInputSuggest, App, TFolder } from 'obsidian';
import { KeyboardEvent, MouseEvent } from "react";
import { setSettings } from "src/context/sharedSettingsContext";
import ContactsPlugin from "src/main";

export class FolderSuggest extends AbstractInputSuggest<string> {
  folders: string[];
  private inputEl: HTMLInputElement;
  private plugin: ContactsPlugin;

  constructor(app: App, plugin: ContactsPlugin, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.plugin = plugin;
    this.folders = this.getAllFolderPaths().filter(folder => folder.toLowerCase() !== '/');
  }

  getAllFolderPaths(): string[] {
    const folders = this.app.vault.getAllLoadedFiles().filter(f => f instanceof TFolder) as TFolder[];
    return folders.map(f => f.path);
  }

  getSuggestions(inputStr: string): string[] {
    return this.folders.filter(folder => folder.toLowerCase().includes(inputStr.toLowerCase()));
  }

  renderSuggestion(folder: string, el: HTMLElement): void {
    el.setText(folder);
  }

  selectSuggestion(folder: string): void {
    this.inputEl.value = folder;
    this.inputEl.trigger('input');
    // Trim folder and Strip ending slash if there
    let value = folder.trim()
    value = value.replace(/\/$/, "");
    this.plugin.settings.contactsFolder = value;
    this.plugin.saveSettings().then(() => {
      setSettings(this.plugin.settings);
      this.close();
    });
  }

}
