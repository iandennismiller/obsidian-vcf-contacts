import { App, PluginSettingTab, Setting, Notice, Modal } from "obsidian";
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
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'INFO',
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

    // VCF Watch Enabled Toggle (always shown)
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
            // Refresh the display to show/hide dependent settings
            this.display();
          }));

    // Show folder watching sub-settings only when watching is enabled
    if (this.plugin.settings.vcfWatchEnabled) {
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

      // VCF Write Back Toggle (only shown when folder watching is enabled)
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
              // Refresh the display to show/hide dependent settings
              this.display();
            }));
    }

    // Ignore Lists Section (only shown when both folder watching and write back are enabled)
    if (this.plugin.settings.vcfWatchEnabled && this.plugin.settings.vcfWriteBackEnabled) {
      const ignoreTitle = containerEl.createEl("h3", { text: "Ignore Lists" });
      ignoreTitle.style.marginTop = "2em";

      // Ignored Filenames
      const ignoreFilenamesDesc = document.createDocumentFragment();
      ignoreFilenamesDesc.append(
        "VCF filenames to ignore during sync (one per line).",
        ignoreFilenamesDesc.createEl("br"),
        "Use this for known malformed files or files controlled by CardDAV services."
      );

      new Setting(containerEl)
        .setName("Ignored VCF Filenames")
        .setDesc(ignoreFilenamesDesc)
        .addTextArea(textArea => {
          textArea
            .setPlaceholder("filename1.vcf\nfilename2.vcf")
            .setValue(this.plugin.settings.vcfIgnoreFilenames.join('\n'))
            .onChange(async (value) => {
              this.plugin.settings.vcfIgnoreFilenames = value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
            });
          textArea.inputEl.rows = 4;
          textArea.inputEl.style.width = "100%";
        });

      // Ignored UIDs
      const ignoreUIDsDesc = document.createDocumentFragment();
      ignoreUIDsDesc.append(
        "Contact UIDs to ignore during sync (one per line).",
        ignoreUIDsDesc.createEl("br"),
        "Use this for contacts that cause sync problems."
      );

      new Setting(containerEl)
        .setName("Ignored Contact UIDs")
        .setDesc(ignoreUIDsDesc)
        .addTextArea(textArea => {
          textArea
            .setPlaceholder("UID-1234-5678\nUID-ABCD-EFGH")
            .setValue(this.plugin.settings.vcfIgnoreUIDs.join('\n'))
            .onChange(async (value) => {
              this.plugin.settings.vcfIgnoreUIDs = value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
            });
          textArea.inputEl.rows = 4;
          textArea.inputEl.style.width = "100%";
        });
    }

    // Logging Section
    const loggingTitle = containerEl.createEl("h3", { text: "Logging" });
    loggingTitle.style.marginTop = "2em";

    // Log Level Setting
    const logLevelDesc = document.createDocumentFragment();
    logLevelDesc.append(
      "Set the minimum log level for VCF sync operations.",
      logLevelDesc.createEl("br"),
      "DEBUG: All messages, INFO: Normal operation, WARNING: Potential issues, ERROR: Only errors."
    );

    new Setting(containerEl)
      .setName("Log Level")
      .setDesc(logLevelDesc)
      .addDropdown(dropdown => {
        dropdown
          .addOption('DEBUG', 'DEBUG - Most verbose')
          .addOption('INFO', 'INFO - Normal operation')
          .addOption('WARNING', 'WARNING - Potential issues')
          .addOption('ERROR', 'ERROR - Errors only')
          .setValue(this.plugin.settings.logLevel)
          .onChange(async (value: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR') => {
            this.plugin.settings.logLevel = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
            
            // Update log level immediately
            const { loggingService } = require("src/services/loggingService");
            loggingService.setLogLevel(value);
          });
      });

  // Log viewer and clear log buttons removed for lightweight loggingService

  }

  // showLogsModal removed for lightweight loggingService
}
