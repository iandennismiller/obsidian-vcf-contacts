import { App, PluginSettingTab, Setting } from "obsidian";
import { setSettings } from "src/context/sharedSettingsContext";
import { InsighSettingProperties } from "src/insights/insight.d";
import { insightService } from "src/insights/insightService";
import ContactsPlugin from "src/main";
import { FolderSuggest } from "src/settings/FolderSuggest";
import { ContactsPluginSettings } from "src/settings/settings.d"

const insightsSetting = insightService.settings();
const insightsSettingDefaults = insightsSetting.reduce((acc:Record<string, string|boolean>, setting) => {
  acc[setting.settingPropertyName] = setting.settingDefaultValue;
  return acc;
}, {} as Record<string, string>);

export const DEFAULT_SETTINGS: ContactsPluginSettings = {
  contactsFolder: '',
  defaultHashtag: '',
  ...insightsSettingDefaults
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

    const folderDesc = document.createDocumentFragment();
    folderDesc.append(
      "New contacts will be saved here.",
      folderDesc.createEl("br"),
      "If empty, contacts will be created in the root of your vault."
    );

    const contactsFolder = this.plugin.settings.contactsFolder;
    new Setting(this.containerEl)
      .setName("Contacts folder location")
      .setDesc(folderDesc)
      .addSearch((cb) => {
        new FolderSuggest(this.app, this.plugin, cb.inputEl);
        cb.setPlaceholder("Example: Contacts")
          .setValue(contactsFolder)
          .onChange(async(value) => {
            if(value === '') {
              this.plugin.settings.contactsFolder = '';
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
            }
          });
      });

    const defaultHashtag = this.plugin.settings.defaultHashtag;
    new Setting(containerEl)
      .setName('Default hashtag')
      .setDesc('Hashtag to be used for every contact created')
      .addText(text => text
        .setPlaceholder('')
        .setValue(defaultHashtag)
        .onChange(async (value) => {
          this.plugin.settings.defaultHashtag = value;
          await this.plugin.saveSettings();
          setSettings(this.plugin.settings);
        }));

    insightsSetting.forEach((settingProps :InsighSettingProperties) => {
      const settingKey = settingProps.settingPropertyName;
      const currentValue = this.plugin.settings[settingKey];

      if (typeof currentValue === 'boolean') {
        new Setting(containerEl)
          .setName(settingProps.name)
          .setDesc(settingProps.settingDescription)
          .addToggle(toggle =>
            toggle
              .setValue(currentValue)
              .onChange(async (value) => {
                this.plugin.settings[settingKey] = value;
                await this.plugin.saveSettings();
                setSettings(this.plugin.settings);
              }));
      }
    })

  }
}
