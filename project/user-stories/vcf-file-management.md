# VCF File Management User Stories

Stories related to importing, exporting, and synchronizing vCard (VCF) files with Obsidian contacts.

## 1. Single VCF File Synchronization

**As a user**, I store my vCard contacts in a single VCF file and I want to keep that file synced with my Obsidian contacts so that any changes in Obsidian are reflected in my VCF file and vice versa.

**Test Location**: `tests/stories/singleVcfSync.spec.ts`

## 2. Individual VCF Files in Folder

**As a user**, I store my vCard contacts as individual VCF files in a folder and I want to keep that folder synced with my Obsidian contacts so that each contact corresponds to one VCF file.

**Test Location**: `tests/stories/individualVcfFiles.spec.ts`

## 3. VCF File Drop Import

**As a user**, when I drop a VCF file into my Obsidian vault, I want the plugin to automatically import the contacts into my contacts folder and place the VCF file in my watch folder for ongoing synchronization.

**Test Location**: `tests/stories/vcfDropImport.spec.ts`

## 4. Automatic VCF Monitoring

**As a user**, I want the plugin to monitor my VCF watch folder for changes and automatically update my Obsidian contacts when VCF files are modified externally.

**Test Location**: `tests/stories/automaticVcfMonitoring.spec.ts`

## 5. VCF Export from Obsidian

**As a user**, I want to export my Obsidian contacts to VCF format so I can share them with other applications or backup my contact data.

**Test Location**: `tests/stories/vcfExport.spec.ts`

---

**Related Specifications**: 
- [VCF Sync Specification](../specifications/vcf-sync-spec.md)
- [vCard Format Guide](../specs/vcard-format.md)
