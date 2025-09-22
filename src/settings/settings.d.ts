
export interface ContactsPluginSettings {
  contactsFolder: string;
  defaultHashtag: string;
  vcfWatchFolder: string;
  vcfWatchEnabled: boolean;
  vcfWatchPollingInterval: number;
  vcfWriteBackEnabled: boolean;
  [key: string]: string|boolean|number;
}
