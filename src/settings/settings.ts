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
  vcfWatchPollingInterval: 30,
  vcfWriteBackEnabled: false,
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

    // VCF Folder Watching Settings
    const vcfWatchingTitle = containerEl.createEl("h3", { text: "VCF Folder Watching" });
    vcfWatchingTitle.style.marginTop = "2em";

    // VCF Watch Folder
    const vcfFolderDesc = document.createDocumentFragment();
    vcfFolderDesc.append(
      "Local filesystem folder to watch for VCF files.",
      vcfFolderDesc.createEl("br"),
      "Can be outside of your Obsidian vault. Leave empty to disable."
    );

    new Setting(containerEl)
      .setName("VCF Watch Folder")
      .setDesc(vcfFolderDesc)
      .addText(text => text
        .setPlaceholder("Example: /Users/username/Documents/Contacts")
        .setValue(this.plugin.settings.vcfWatchFolder)
        .onChange(async (value) => {
          this.plugin.settings.vcfWatchFolder = value;
          await this.plugin.saveSettings();
          setSettings(this.plugin.settings);
        }));

    // VCF Watch Enabled Toggle
    new Setting(containerEl)
      .setName("Enable VCF Folder Watching")
      .setDesc("When enabled, the plugin will automatically import new VCF files from the watched folder.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.vcfWatchEnabled)
          .onChange(async (value) => {
            this.plugin.settings.vcfWatchEnabled = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

    // VCF Watch Polling Interval
    new Setting(containerEl)
      .setName("Polling Interval (seconds)")
      .setDesc("How often to check the VCF folder for changes. Minimum 10 seconds.")
      .addText(text => text
        .setPlaceholder("30")
        .setValue(String(this.plugin.settings.vcfWatchPollingInterval))
        .onChange(async (value) => {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue) && numValue >= 10) {
            this.plugin.settings.vcfWatchPollingInterval = numValue;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }
        }));

    // VCF Write Back Toggle
    new Setting(containerEl)
      .setName("Enable VCF Write Back")
      .setDesc("When enabled, changes to contacts in Obsidian will be written back to the corresponding VCF files in the watched folder. Disable to prevent any modifications to VCF files.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.vcfWriteBackEnabled)
          .onChange(async (value) => {
            this.plugin.settings.vcfWriteBackEnabled = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

  }
}
