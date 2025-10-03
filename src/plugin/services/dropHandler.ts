import * as fs from 'fs/promises';
import { App, Notice, TFile } from 'obsidian';
import * as path from 'path';
import { ContactNote } from 'src/models/contactNote';
import { VcardFile } from 'src/models/vcardFile';
import { ContactManagerUtils } from 'src/models/contactManager/contactManagerUtils';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Sets up a vault 'create' listener that handles .vcf files dropped into the vault.
 * Copies the dropped vcard into the configured watch folder, imports/updates contacts
 * in the contacts folder, and deletes the original file from the vault.
 *
 * Returns a cleanup function to remove the listener.
 */
export function setupVcardDropHandler(app: App, settings: ContactsPluginSettings): () => void {
  const onCreate = async (file: TFile) => {
    try {
      if (!file || !file.name.toLowerCase().endsWith('.vcf')) return;

      if (!settings.vcardWatchFolder) {
        console.debug('vcard drop ignored because vcardWatchFolder is not configured');
        return;
      }

      // Read file contents from the vault
      let content: string;
      try {
        content = await app.vault.read(file);
      } catch (err) {
        console.debug(`Failed to read dropped vcard ${file.path}: ${err.message}`);
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
              // No update needed - vcard matches existing contact
            }
          } catch (err) {
            console.debug(`Failed comparing/updating contact for UID ${record.UID}: ${err.message}`);
          }
        } else {
          // Create new contact file
          try {
            const filename = (slug || 'contact') + '.md';
            await ContactManagerUtils.createContactFile(app, settings.contactsFolder, mdContent, filename);
            // Contact imported from dropped vcard
          } catch (err) {
            console.debug(`Failed to create contact from dropped vcard UID ${record.UID}: ${err.message}`);
          }
        }
      }

      // Write the vcard file into the configured watch folder (overwrite if necessary)
      try {
        const filename = path.basename(file.path);
        const targetPath = path.join(settings.vcardWatchFolder, filename);

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
          // Copied dropped vcard to watch folder
        } else {
          // Dropped vcard identical to existing vcard in watch folder
        }
      } catch (err) {
        console.debug(`Failed to copy dropped vcard into watch folder: ${err.message}`);
        return;
      }

      // Remove original vcard from the vault
      try {
        await app.vault.delete(file);
        // Removed dropped vcard from vault
      } catch (err) {
        console.debug(`Failed to remove dropped vcard from vault: ${err.message}`);
      }

    } catch (error: any) {
      console.debug(`Error handling dropped vcard file ${file?.path}: ${error.message}`);
    }
  };

  app.vault.on('create', onCreate);

  // Return cleanup function
  return () => app.vault.off('create', onCreate);
}
