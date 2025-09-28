import * as fs from 'fs/promises';
import { App, Notice, TFile } from 'obsidian';
import * as path from 'path';
import { ContactNote } from 'src/contacts/contactNote';
import { VcardFile } from 'src/contacts/vcardFile';
import { ContactManager } from 'src/contacts/contactManager';
import { ContactsPluginSettings } from 'src/settings/settings.d';

/**
 * Sets up a vault 'create' listener that handles .vcf files dropped into the vault.
 * Copies the dropped VCF into the configured watch folder, imports/updates contacts
 * in the contacts folder, and deletes the original file from the vault.
 *
 * Returns a cleanup function to remove the listener.
 */
export function setupVCFDropHandler(app: App, settings: ContactsPluginSettings): () => void {
  const onCreate = async (file: TFile) => {
    try {
      if (!file || !file.name.toLowerCase().endsWith('.vcf')) return;

      if (!settings.vcfWatchFolder) {
        console.log('VCF drop ignored because vcfWatchFolder is not configured');
        return;
      }

      // Read file contents from the vault
      let content: string;
      try {
        content = await app.vault.read(file);
      } catch (err) {
        console.log(`Failed to read dropped VCF ${file.path}: ${err.message}`);
        return;
      }

      // Parse vCard records and create/update contacts
      const vcardFile = new VcardFile(content);
      for await (const [slug, record] of vcardFile.parse()) {
        if (!record || !record.UID) continue;

        // Locate existing contact by UID (scan contacts folder)
        let existingContact: TFile | null = null;
        try {
          const contactsFolder = settings.contactsFolder || '/';
          const files = app.vault.getMarkdownFiles().filter(f => f.path.startsWith(contactsFolder));
          for (const f of files) {
            const cache = app.metadataCache.getFileCache(f);
            const uid = cache?.frontmatter?.UID;
            if (uid === record.UID) {
              existingContact = f;
              break;
            }
          }
        } catch (err) {
          // Remove debug logging - error searching for existing contact
        }

        const contactNote = new ContactNote(app, settings, null as any); // We'll create the file first
        const mdContent = contactNote.mdRender(record, settings.defaultHashtag);

        if (existingContact) {
          try {
            const existingContent = await app.vault.read(existingContact);
            if (existingContent !== mdContent) {
              // Update contact if changes detected

              // Rename if necessary
              const newFilename = (slug || existingContact.basename.replace(/\.md$/i, '')) + '.md';
              if (existingContact.name !== newFilename) {
                const newPath = existingContact.path.replace(existingContact.name, newFilename);
                try {
                  await app.vault.rename(existingContact, newPath);
                } catch (err) {
                  // Remove debug logging - failed to rename contact file
                }
              }

              // Modify with new content
              await app.vault.modify(existingContact, mdContent);
            } else {
              // No update needed - VCF matches existing contact
            }
          } catch (err) {
            console.log(`Failed comparing/updating contact for UID ${record.UID}: ${err.message}`);
          }
        } else {
          // Create new contact file
          try {
            const filename = (slug || 'contact') + '.md';
            await ContactManager.createContactFileStatic(app, settings.contactsFolder, mdContent, filename);
            // Contact imported from dropped VCF
          } catch (err) {
            console.log(`Failed to create contact from dropped VCF UID ${record.UID}: ${err.message}`);
          }
        }
      }

      // Write the VCF file into the configured watch folder (overwrite if necessary)
      try {
        const filename = path.basename(file.path);
        const targetPath = path.join(settings.vcfWatchFolder, filename);

        // If target exists and content differs, overwrite; otherwise write new file
        let write = true;
        try {
          const existing = await fs.readFile(targetPath, 'utf-8');
          if (existing === content) write = false;
        } catch (_) {
          write = true;
        }

        if (write) {
          await fs.writeFile(targetPath, content, 'utf-8');
          // Copied dropped VCF to watch folder
        } else {
          // Dropped VCF identical to existing VCF in watch folder
        }
      } catch (err) {
        console.log(`Failed to copy dropped VCF into watch folder: ${err.message}`);
        return;
      }

      // Remove original VCF from the vault
      try {
        await app.vault.delete(file);
        // Removed dropped VCF from vault
      } catch (err) {
        console.log(`Failed to remove dropped VCF from vault: ${err.message}`);
      }

    } catch (error) {
      console.log(`Error handling dropped VCF file ${file?.path}: ${error.message}`);
    }
  };

  app.vault.on('create', onCreate);

  // Return cleanup function
  return () => app.vault.off('create', onCreate);
}
