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
  vcfStorageMethod: 'single-vcf' | 'vcf-folder';
  vcfFilename: string;
  vcfWatchFolder: string;
  vcfWatchEnabled: boolean;
  vcfWatchPollingInterval: number;
  vcfWriteBackEnabled: boolean;
  vcfCustomizeIgnoreList: boolean;
  vcfIgnoreFilenames: string[];
  vcfIgnoreUIDs: string[];
  // Contact Section Template Settings
  contactTemplateShowFirstOnly: boolean;
  contactTemplateFieldOrder: string[];
  contactTemplateIcons: Record<string, string>;
  contactTemplateDisplayNames: Record<string, string>;
  contactTemplateEnabledFields: Record<string, boolean>;
  [key: string]: string|boolean|number|string[]|Record<string, string>|Record<string, boolean>;
}

const curatorSetting = curatorService.settings();
const curatorSettingDefaults = curatorSetting.reduce((acc:Record<string, string|boolean>, setting) => {
  acc[setting.settingPropertyName] = setting.settingDefaultValue;
  return acc;
}, {} as Record<string, string>);

export const DEFAULT_SETTINGS: ContactsPluginSettings = {
  contactsFolder: "",
  defaultHashtag: "",
  vcfStorageMethod: 'vcf-folder',
  vcfFilename: "contacts.vcf",
  vcfWatchFolder: "",
  vcfWatchEnabled: false,
  vcfWatchPollingInterval: 30,
  vcfWriteBackEnabled: false,
  vcfCustomizeIgnoreList: false,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  // Contact Section Template Defaults
  contactTemplateShowFirstOnly: true,
  contactTemplateFieldOrder: ['EMAIL', 'TEL', 'ADR', 'URL'],
  contactTemplateIcons: {
    EMAIL: '📧',
    TEL: '📞',
    ADR: '🏠',
    URL: '🌐'
  },
  contactTemplateDisplayNames: {
    EMAIL: 'Email',
    TEL: 'Phone',
    ADR: 'Address',
    URL: 'Website'
  },
  contactTemplateEnabledFields: {
    EMAIL: true,
    TEL: true,
    ADR: true,
    URL: true
  },
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
    const vcfStorageTitle = containerEl.createEl("h3", { text: "Sync Contacts" });
    vcfStorageTitle.style.marginTop = "2em";

    // VCF Watch Enabled Toggle (moved before storage method)
    new Setting(containerEl)
      .setName("Enable Contact Sync")
      .setDesc("When enabled, the plugin will monitor for changes and trigger VCF sync processors. Controls both VCF Sync Pre Processor (import) and VCF Sync Post Processor (write-back).")
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
      // VCF Watch Polling Interval
      new Setting(containerEl)
        .setName("Polling Interval (seconds)")
        .setDesc("How often to check for changes. Minimum 10 seconds.")
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
        .setDesc("When enabled, the VCF Sync Post Processor will write changes from Obsidian contacts back to VCF files. Disable to prevent any modifications to VCF files.")
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

    // VCF Storage Method
    const storageMethodDesc = document.createDocumentFragment();
    storageMethodDesc.append(
      "Choose how vCard files are stored:",
      storageMethodDesc.createEl("br"),
      storageMethodDesc.createEl("strong", { text: "Single VCF: " }),
      "All contacts in one vCard file",
      storageMethodDesc.createEl("br"),
      storageMethodDesc.createEl("strong", { text: "VCF Folder: " }),
      "Separate vCard file for each contact"
    );

    new Setting(containerEl)
      .setName("VCF Storage Method")
      .setDesc(storageMethodDesc)
      .addDropdown(dropdown => {
        dropdown
          .addOption('single-vcf', 'Single VCF')
          .addOption('vcf-folder', 'VCF Folder')
          .setValue(this.plugin.settings.vcfStorageMethod)
          .onChange(async (value: 'single-vcf' | 'vcf-folder') => {
            this.plugin.settings.vcfStorageMethod = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
            // Refresh the display to show/hide dependent settings
            this.display();
          });
      });

    // VCF Filename (only shown for single VCF method)
    if (this.plugin.settings.vcfStorageMethod === 'single-vcf') {
      const vcfFilenameDesc = document.createDocumentFragment();
      vcfFilenameDesc.append(
        "Name of the single VCF file that will contain all contacts.",
        vcfFilenameDesc.createEl("br"),
        "Include the .vcf extension."
      );

      new Setting(containerEl)
        .setName("VCF Filename")
        .setDesc(vcfFilenameDesc)
        .addText(text => text
          .setPlaceholder("contacts.vcf")
          .setValue(this.plugin.settings.vcfFilename)
          .onChange(async (value) => {
            this.plugin.settings.vcfFilename = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));
    }

    // VCF Folder Settings (only shown for VCF folder method)
    if (this.plugin.settings.vcfStorageMethod === 'vcf-folder') {
      const vcfFolderDesc = document.createDocumentFragment();
      vcfFolderDesc.append(
        "Folder path where individual VCF files will be stored.",
        vcfFolderDesc.createEl("br"),
        "Each contact will have its own .vcf file in this folder."
      );

      new Setting(containerEl)
        .setName("VCF Folder")
        .setDesc(vcfFolderDesc)
        .addText(text => text
          .setPlaceholder("Example: /Users/username/Documents/Contacts")
          .setValue(this.plugin.settings.vcfWatchFolder)
          .onChange(async (value) => {
            this.plugin.settings.vcfWatchFolder = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

      // Customize Ignore List toggle (only for VCF folder method)
      new Setting(containerEl)
        .setName("Customize Ignore List")
        .setDesc("Enable customization of files and UIDs to ignore during sync.")
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.vcfCustomizeIgnoreList)
            .onChange(async (value) => {
              this.plugin.settings.vcfCustomizeIgnoreList = value;
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
              // Refresh the display to show/hide ignore list settings
              this.display();
            }));
    }

    // Ignore Lists Section (only shown when VCF folder method and customize ignore list is enabled)
    if (this.plugin.settings.vcfStorageMethod === 'vcf-folder' && 
        this.plugin.settings.vcfCustomizeIgnoreList) {
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

    // Contact Section Template
    const contactTemplateTitle = containerEl.createEl("h3", { text: "Contact Section Template" });
    contactTemplateTitle.style.marginTop = "2em";

    const contactTemplateDesc = document.createDocumentFragment();
    contactTemplateDesc.append(
      "Customize how contact information is displayed in the Contact section.",
      contactTemplateDesc.createEl("br"),
      "These settings control the appearance, order, and content of contact fields."
    );

    new Setting(containerEl)
      .setName("Contact Section Template")
      .setDesc(contactTemplateDesc);

    // Show First Field Only Toggle
    new Setting(containerEl)
      .setName("Show First Field Only")
      .setDesc("When enabled, only the first field of each type is displayed. When disabled, all fields are shown.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.contactTemplateShowFirstOnly)
          .onChange(async (value) => {
            this.plugin.settings.contactTemplateShowFirstOnly = value;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

    // Field Enable/Disable Controls
    const fieldTypesTitle = containerEl.createEl("h4", { text: "Enabled Field Types" });
    fieldTypesTitle.style.marginTop = "1em";
    fieldTypesTitle.style.fontSize = "1em";

    const fieldTypes = ['EMAIL', 'TEL', 'ADR', 'URL'];
    for (const fieldType of fieldTypes) {
      new Setting(containerEl)
        .setName(`Show ${this.plugin.settings.contactTemplateDisplayNames[fieldType] || fieldType}`)
        .setDesc(`Display ${fieldType} fields in Contact section`)
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.contactTemplateEnabledFields[fieldType] !== false)
            .onChange(async (value) => {
              this.plugin.settings.contactTemplateEnabledFields[fieldType] = value;
              await this.plugin.saveSettings();
              setSettings(this.plugin.settings);
            }));
    }

    // Field Customization
    const fieldCustomTitle = containerEl.createEl("h4", { text: "Field Customization" });
    fieldCustomTitle.style.marginTop = "1em";
    fieldCustomTitle.style.fontSize = "1em";

    for (const fieldType of fieldTypes) {
      // Icon customization
      new Setting(containerEl)
        .setName(`${fieldType} Icon`)
        .setDesc(`Icon/emoji for ${fieldType} fields`)
        .addText(text => text
          .setPlaceholder(this.plugin.settings.contactTemplateIcons[fieldType])
          .setValue(this.plugin.settings.contactTemplateIcons[fieldType])
          .onChange(async (value) => {
            this.plugin.settings.contactTemplateIcons[fieldType] = value || this.plugin.settings.contactTemplateIcons[fieldType];
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));

      // Display name customization
      new Setting(containerEl)
        .setName(`${fieldType} Display Name`)
        .setDesc(`Display name for ${fieldType} fields`)
        .addText(text => text
          .setPlaceholder(this.plugin.settings.contactTemplateDisplayNames[fieldType])
          .setValue(this.plugin.settings.contactTemplateDisplayNames[fieldType])
          .onChange(async (value) => {
            this.plugin.settings.contactTemplateDisplayNames[fieldType] = value || this.plugin.settings.contactTemplateDisplayNames[fieldType];
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }));
    }

    // Field Order
    const fieldOrderTitle = containerEl.createEl("h4", { text: "Field Display Order" });
    fieldOrderTitle.style.marginTop = "1em";
    fieldOrderTitle.style.fontSize = "1em";

    const fieldOrderDesc = document.createDocumentFragment();
    fieldOrderDesc.append(
      "Comma-separated list of field types in display order.",
      fieldOrderDesc.createEl("br"),
      "Example: EMAIL,TEL,ADR,URL"
    );

    new Setting(containerEl)
      .setName("Field Order")
      .setDesc(fieldOrderDesc)
      .addText(text => text
        .setPlaceholder("EMAIL,TEL,ADR,URL")
        .setValue(this.plugin.settings.contactTemplateFieldOrder.join(','))
        .onChange(async (value) => {
          const order = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
          if (order.length > 0) {
            this.plugin.settings.contactTemplateFieldOrder = order;
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
          }
        }));

    // Reset to Defaults Button
    new Setting(containerEl)
      .setName("Reset Template to Defaults")
      .setDesc("Reset all Contact section template settings to their default values")
      .addButton(button =>
        button
          .setButtonText("Reset to Defaults")
          .onClick(async () => {
            this.plugin.settings.contactTemplateShowFirstOnly = true;
            this.plugin.settings.contactTemplateFieldOrder = ['EMAIL', 'TEL', 'ADR', 'URL'];
            this.plugin.settings.contactTemplateIcons = {
              EMAIL: '📧',
              TEL: '📞',
              ADR: '🏠',
              URL: '🌐'
            };
            this.plugin.settings.contactTemplateDisplayNames = {
              EMAIL: 'Email',
              TEL: 'Phone',
              ADR: 'Address',
              URL: 'Website'
            };
            this.plugin.settings.contactTemplateEnabledFields = {
              EMAIL: true,
              TEL: true,
              ADR: true,
              URL: true
            };
            await this.plugin.saveSettings();
            setSettings(this.plugin.settings);
            this.display(); // Refresh the settings display
            new Notice('Contact template settings reset to defaults');
          }));
  }
}
