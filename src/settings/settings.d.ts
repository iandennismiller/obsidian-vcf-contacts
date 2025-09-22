
export interface ContactsPluginSettings {
  contactsFolder: string;
  defaultHashtag: string;
  vcfWatchFolder: string;
  vcfWatchEnabled: boolean;
  vcfWatchPollingInterval: number;
  vcfWriteBackEnabled: boolean;
  vcfIgnoreFilenames: string[];
  vcfIgnoreUIDs: string[];
  logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  [key: string]: string|boolean|number|string[];
}
