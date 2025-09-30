
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
  [key: string]: string|boolean|number|string[];
}
