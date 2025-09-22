
export interface ContactsPluginSettings {
  contactsFolder: string;
  defaultHashtag: string;
  vcfWatchFolder: string;
  vcfWatchEnabled: boolean;
  vcfWatchPollingFrequency: number;
  [key: string]: string|boolean|number;
}
