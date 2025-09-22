
export interface ContactsPluginSettings {
  contactsFolder: string;
  defaultHashtag: string;
  vcfWatchFolder: string;
  vcfWatchEnabled: boolean;
  vcfWatchPollingInterval: number;
  [key: string]: string|boolean|number;
}
