import { App, PluginSettingTab, Setting, Notice, Modal } from "obsidian";
import { setSettings } from "src/plugin/context/sharedSettingsContext";
import { CuratorSettingProperties } from "src/models/curatorManager/CuratorSettingProperties";
import { curatorService } from "src/models/curatorManager/curatorManager";
import ContactsPlugin from "src/main";
import { FolderSuggest } from "src/plugin/ui/FolderSuggest";

// Import curator registration to ensure processors are registered before we access their settings
import "src/curatorRegistration";

export interface ContactsPluginSettings {
  contactsFolder: string;
  defaultHashtag: string;
  vcardStorageMethod: 'single-vcard' | 'vcard-folder';
  vcardFilename: string;
  vcardWatchFolder: string;
  vcardWatchEnabled: boolean;
  vcardWatchPollingInterval: number;
  vcardWriteBackEnabled: boolean;
  vcardCustomizeIgnoreList: boolean;
  vcardIgnoreFilenames: string[];
  vcardIgnoreUIDs: string[];
  // Contact Section Sync Settings
  contactSectionSyncConfirmation: boolean;
  // Remove Invalid Fields Settings
  removeInvalidFieldsConfirmation: boolean;
  [key: string]: string|boolean|number|string[];
}

const curatorSetting = curatorService.settings();
const curatorSettingDefaults = curatorSetting.reduce((acc:Record<string, string|boolean>, setting) => {
  acc[setting.settingPropertyName] = setting.settingDefaultValue;
  return acc;
}, {} as Record<string, string>);

export const DEFAULT_SETTINGS: ContactsPluginSettings = {
  contactsFolder: "",
  defaultHashtag: "",
  vcardStorageMethod: 'vcard-folder',
  vcardFilename: "contacts.vcf",
  vcardWatchFolder: "",
  vcardWatchEnabled: false,
  vcardWatchPollingInterval: 30,
  vcardWriteBackEnabled: false,
  vcardCustomizeIgnoreList: false,
  vcardIgnoreFilenames: [],
  vcardIgnoreUIDs: [],
  // Contact Section Sync Default
  contactSectionSyncConfirmation: true,
  // Remove Invalid Fields Default
  removeInvalidFieldsConfirmation: true,
  ...curatorSettingDefaults
}

/* istanbul ignore next */
// Settings tab UI integrates with Obsidian's settings API and requires DOM/UI context
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

    // Sync Contacts Section
    const vcardStorageTitle = containerEl.createEl("h3", { text: "Sync Contacts" });
    vcardStorageTitle.style.marginTop = "2em";

    // vcard Watch Enabled Toggle (moved before storage method)
    new Setting(containerEl)
      .setName("Enable Contact Sync")
      .setDesc("When enabled, the plugin will monitor for changes and trigger vcard sync processors. Controls both vcard Sync Pre Processor (import) and vcard Sync Post Processor (write-back).")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.vcardWatchEnabled)
          .onChange(async (value) => {
            this.plugin.settings.vcardWatchEnabled = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
            // Refresh the display to show/hide dependent settings
            this.display();
          }));

    // Show folder watching sub-settings only when watching is enabled
    if (this.plugin.settings.vcardWatchEnabled) {
      // vcard Watch Polling Interval
      new Setting(containerEl)
        .setName("Polling Interval (seconds)")
        .setDesc("How often to check for changes. Minimum 10 seconds.")
        .addText(text => text
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.vcardWatchPollingInterval))
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue) && numValue >= 10) {
              this.plugin.settings.vcardWatchPollingInterval = numValue;
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
            }
          }));

      // vcard Write Back Toggle (only shown when folder watching is enabled)
      new Setting(containerEl)
        .setName("Enable vcard Write Back")
        .setDesc("When enabled, the vcard Sync Post Processor will write changes from Obsidian contacts back to vcard files. Disable to prevent any modifications to vcard files.")
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.vcardWriteBackEnabled)
            .onChange(async (value) => {
              this.plugin.settings.vcardWriteBackEnabled = value;
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
              // Refresh the display to show/hide dependent settings
              this.display();
            }));
    }

    // vcard Storage Method
    const storageMethodDesc = document.createDocumentFragment();
    storageMethodDesc.append(
      "Choose how vCard files are stored:",
      storageMethodDesc.createEl("br"),
      storageMethodDesc.createEl("strong", { text: "Single vcard: " }),
      "All contacts in one vCard file",
      storageMethodDesc.createEl("br"),
      storageMethodDesc.createEl("strong", { text: "vcard Folder: " }),
      "Separate vCard file for each contact"
    );

    new Setting(containerEl)
      .setName("vcard Storage Method")
      .setDesc(storageMethodDesc)
      .addDropdown(dropdown => {
        dropdown
          .addOption('single-vcard', 'Single vcard')
          .addOption('vcard-folder', 'vcard Folder')
          .setValue(this.plugin.settings.vcardStorageMethod)
          .onChange(async (value: 'single-vcard' | 'vcard-folder') => {
            this.plugin.settings.vcardStorageMethod = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
            // Refresh the display to show/hide dependent settings
            this.display();
          });
      });

    // vcard Filename (only shown for single vcard method)
    if (this.plugin.settings.vcardStorageMethod === 'single-vcard') {
      const vcardFilenameDesc = document.createDocumentFragment();
      vcardFilenameDesc.append(
        "Name of the single vcard file that will contain all contacts.",
        vcardFilenameDesc.createEl("br"),
        "Include the .vcf extension."
      );

      new Setting(containerEl)
        .setName("vcard Filename")
        .setDesc(vcardFilenameDesc)
        .addText(text => text
          .setPlaceholder("contacts.vcf")
          .setValue(this.plugin.settings.vcardFilename)
          .onChange(async (value) => {
            this.plugin.settings.vcardFilename = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));
    }

    // vcard Folder Settings (only shown for vcard folder method)
    if (this.plugin.settings.vcardStorageMethod === 'vcard-folder') {
      const vcardFolderDesc = document.createDocumentFragment();
      vcardFolderDesc.append(
        "Folder path where individual vcard files will be stored.",
        vcardFolderDesc.createEl("br"),
        "Each contact will have its own .vcf file in this folder."
      );

      new Setting(containerEl)
        .setName("vcard Folder")
        .setDesc(vcardFolderDesc)
        .addText(text => text
          .setPlaceholder("Example: /Users/username/Documents/Contacts")
          .setValue(this.plugin.settings.vcardWatchFolder)
          .onChange(async (value) => {
            this.plugin.settings.vcardWatchFolder = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

      // Customize Ignore List toggle (only for vcard folder method)
      new Setting(containerEl)
        .setName("Customize Ignore List")
        .setDesc("Enable customization of files and UIDs to ignore during sync.")
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.vcardCustomizeIgnoreList)
            .onChange(async (value) => {
              this.plugin.settings.vcardCustomizeIgnoreList = value;
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
              // Refresh the display to show/hide ignore list settings
              this.display();
            }));
    }

    // Ignore Lists Section (only shown when vcard folder method and customize ignore list is enabled)
    if (this.plugin.settings.vcardStorageMethod === 'vcard-folder' && 
        this.plugin.settings.vcardCustomizeIgnoreList) {
      const ignoreTitle = containerEl.createEl("h3", { text: "Ignore Lists" });
      ignoreTitle.style.marginTop = "2em";

      // Ignored Filenames
      const ignoreFilenamesDesc = document.createDocumentFragment();
      ignoreFilenamesDesc.append(
        "vcard filenames to ignore during sync (one per line).",
        ignoreFilenamesDesc.createEl("br"),
        "Use this for known malformed files or files controlled by CardDAV services."
      );

      new Setting(containerEl)
        .setName("Ignored vcard Filenames")
        .setDesc(ignoreFilenamesDesc)
        .addTextArea(textArea => {
          textArea
            .setPlaceholder("filename1.vcf\nfilename2.vcf")
            .setValue(this.plugin.settings.vcardIgnoreFilenames.join('\n'))
            .onChange(async (value) => {
              this.plugin.settings.vcardIgnoreFilenames = value
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
            .setValue(this.plugin.settings.vcardIgnoreUIDs.join('\n'))
            .onChange(async (value) => {
              this.plugin.settings.vcardIgnoreUIDs = value
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

    // Data Quality Section
    const dataQualityTitle = containerEl.createEl("h3", { text: "Data Quality" });
    dataQualityTitle.style.marginTop = "2em";

    // Contact Section Sync Confirmation
    new Setting(containerEl)
      .setName("Confirm before syncing Contact section to frontmatter")
      .setDesc("When enabled, shows a preview of changes before syncing Contact section data to frontmatter.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.contactSectionSyncConfirmation)
          .onChange(async (value) => {
            this.plugin.settings.contactSectionSyncConfirmation = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

    // Remove Invalid Fields Confirmation
    new Setting(containerEl)
      .setName("Confirm before removing invalid fields")
      .setDesc("When enabled, shows a preview of invalid fields before removing them from frontmatter.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.removeInvalidFieldsConfirmation)
          .onChange(async (value) => {
            this.plugin.settings.removeInvalidFieldsConfirmation = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

  }
}
