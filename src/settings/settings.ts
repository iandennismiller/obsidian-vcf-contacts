import { App, PluginSettingTab, Setting } from "obsidian";
import ContactsPlugin from "src/main";

export interface ContactsPluginSettings {
  contactsFolder: string;
  template: Template;
  defaultHashtag: string;
}

export enum Template {
  CUSTOM = "custom", FRONTMATTER = "frontmatter"
}

export const DEFAULT_SETTINGS: ContactsPluginSettings = {
  contactsFolder: '/',
  template: Template.CUSTOM,
  defaultHashtag: ''
}

export class ContactsSettingTab extends PluginSettingTab {
  plugin: ContactsPlugin;

  constructor(app: App, plugin: ContactsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Settings for "Contacts" plugin.' });

    new Setting(containerEl)
      .setName('Contacts folder location')
      .setDesc('Files in this folder and all subfolders will be available as contacts')
      .addText(text => text
        .setPlaceholder('Contacts')
        .setValue(this.plugin.settings.contactsFolder)
        .onChange(async (value) => {
          this.plugin.settings.contactsFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default hashtag')
      .setDesc('Hashtag to be used for every contact created')
      .addText(text => text
        .setPlaceholder('')
        .setValue(this.plugin.settings.defaultHashtag)
        .onChange(async (value) => {
          this.plugin.settings.defaultHashtag = value;
          await this.plugin.saveSettings();
        }));
  }
}
