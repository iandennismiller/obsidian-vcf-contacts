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
  contactsFolder: "",
  defaultHashtag: "",
  vcfWatchFolder: "",
  vcfWatchEnabled: false,
  vcfWatchPollingFrequency: 60,
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
              this.plugin.settings.contactsFolder = "";
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
            }
          });
      });
    
    const hashtagDesc = document.createDocumentFragment();
    hashtagDesc.append(
      "New contacts are automatically tagged with this hashtags.",
      hashtagDesc.createEl("br"),
      "The hashtags are inserted at the end of the note.",
      hashtagDesc.createEl("br"),
      hashtagDesc.createEl("br"),
      hashtagDesc.createEl("strong", {
                text: "Attention: ",
      }),
      "You must include the ",
      hashtagDesc.createEl("code", { text: "#" }),
      "-sign"
    );

    const defaultHashtag = this.plugin.settings.defaultHashtag;
    new Setting(containerEl)
      .setName("Default hashtags")
      .setDesc(hashtagDesc)
      .addText(text => text
        .setPlaceholder("")
        .setValue(defaultHashtag)
        .onChange(async (value) => {
          this.plugin.settings.defaultHashtag = value;
          await this.plugin.saveSettings();
          setSettings(this.plugin.settings);
        }));

    // VCF Watch Settings
    const vcfWatchHeaderDesc = document.createDocumentFragment();
    vcfWatchHeaderDesc.append(
      "Configure VCF folder watching to automatically import VCF contacts.",
      vcfWatchHeaderDesc.createEl("br"),
      "When enabled, the plugin will periodically scan the specified folder for VCF files and create corresponding markdown contact files."
    );
    
    new Setting(containerEl)
      .setName("VCF Folder Watching")
      .setDesc(vcfWatchHeaderDesc)
      .setHeading();

    // VCF Watch Folder
    const vcfFolderDesc = document.createDocumentFragment();
    vcfFolderDesc.append(
      "Path to folder containing VCF files to watch for changes.",
      vcfFolderDesc.createEl("br"),
      "Leave empty to disable VCF folder watching."
    );

    const vcfWatchFolder = this.plugin.settings.vcfWatchFolder;
    new Setting(containerEl)
      .setName("VCF folder path")
      .setDesc(vcfFolderDesc)
      .addText(text => text
        .setPlaceholder("Example: /Users/john/Contacts")
        .setValue(vcfWatchFolder)
        .onChange(async (value) => {
          this.plugin.settings.vcfWatchFolder = value;
          await this.plugin.saveSettings();
          setSettings(this.plugin.settings);
        }));

    // VCF Watch Enable Toggle
    new Setting(containerEl)
      .setName("Enable VCF folder watching")
      .setDesc("Enable background polling of the VCF folder for changes")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.vcfWatchEnabled)
          .onChange(async (value) => {
            this.plugin.settings.vcfWatchEnabled = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

    // VCF Watch Polling Frequency
    new Setting(containerEl)
      .setName("Polling frequency (seconds)")
      .setDesc("How often to check for VCF file changes (minimum: 10 seconds)")
      .addText(text => text
        .setPlaceholder("60")
        .setValue(String(this.plugin.settings.vcfWatchPollingFrequency))
        .onChange(async (value) => {
          const freq = parseInt(value) || 60;
          this.plugin.settings.vcfWatchPollingFrequency = Math.max(10, freq);
          await this.plugin.saveSettings();
          setSettings(this.plugin.settings);
        }));

    insightsSetting.forEach((settingProps :InsighSettingProperties) => {
      const settingKey = settingProps.settingPropertyName;
      const currentValue = this.plugin.settings[settingKey];

      if (typeof currentValue === "boolean") {
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
