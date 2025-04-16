import { normalizePath, Notice, TAbstractFile, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { Contact, getFrontmatterFromFiles, mdRender } from "src/contacts";
import { createEmptyVcard, parseToSingles, parseVcard, vcardToString } from "src/contacts/vcard";
import { getApp } from "src/context/sharedAppContext";
import {
  createContactFile,
  createFileName,
  findContactFiles,
  openFilePicker,
  saveVcardFilePicker
} from "src/file/file";
import ContactsPlugin from "src/main";
import { ContactsListView } from "src/ui/sidebar/components/ContactsListView";
import { HeaderView } from "src/ui/sidebar/components/HeaderView";
import { processAvatar } from "src/util/avatarActions";
import { Sort } from "src/util/constants";
import myScrollTo from "src/util/myScrollTo";


type RootProps = {
	plugin: ContactsPlugin;
};

export const SidebarRootView = (props: RootProps) => {
	const { vault } = getApp();
	const [contacts, setContacts] = React.useState<Contact[]>([]);
	const [sort, setSort] = React.useState<Sort>(Sort.NAME);
	const folder = props.plugin.settings.contactsFolder;

	const isFileInFolder = (file: TAbstractFile) => {
		return file.path.startsWith(folder);
	};

	const parseContacts = () => {
		const contactsFolder = vault.getAbstractFileByPath(
			normalizePath(folder)
		)

		if (!(contactsFolder instanceof TFolder)) {
			setContacts([]);
			return;
		}

		getFrontmatterFromFiles(findContactFiles(contactsFolder)).then((contactsData) =>{
			setContacts(contactsData);
		});
	};

	React.useEffect(() => {
		parseContacts();
	}, []);

	React.useEffect(() => {

		const updateFiles = (file: TAbstractFile) => {
			setTimeout(() => {
				if (isFileInFolder(file)) {
					parseContacts();
				}
			}, 50); // place our update after obsidian has a opportunity to run some code
		};

		vault.on("create", updateFiles);
		vault.on("modify", updateFiles);
		vault.on("rename", updateFiles);
		vault.on("delete", updateFiles);

		return () => {
			vault.off("create", updateFiles);
			vault.off("modify", updateFiles);
			vault.off("rename", updateFiles);
			vault.off("delete", updateFiles);
		};
	}, [vault, folder]);

	React.useEffect(() => {
		app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf):void => {
			myScrollTo.scrollToLeaf(leaf);
		});

		return () => {
			myScrollTo.clearDebounceTimer()
			app.workspace.off("active-leaf-change", myScrollTo.scrollToLeaf);
		};
	}, [app.workspace]);

	return (
		<div>
			<HeaderView
				onSortChange={setSort}
				importVCF={() => {
					openFilePicker('.vcf').then(async (fileContent: string) => {
						if (fileContent === '') {
							return;
						} else {
							const singles: string[] = parseToSingles(fileContent);
							for (const single of singles) {
								const records = await parseVcard(single);
								const mdContent = mdRender(records, props.plugin.settings.defaultHashtag);
								createContactFile(app, folder, mdContent, createFileName(records))
							}
						}
					})
				}}
				exportAllVCF={async() => {
					const allContactFiles = contacts.map((contact)=> contact.file)
					const vcards = await vcardToString(allContactFiles);
					saveVcardFilePicker(vcards)
				}}
				onCreateContact={async () => {
					const records = await createEmptyVcard();
					const mdContent = mdRender(records, props.plugin.settings.defaultHashtag);
					createContactFile(app, folder, mdContent, createFileName(records))
				}}
				sort={sort}
			/>
			<ContactsListView
				contacts={contacts}
				sort={sort}
				processAvatar={(contact :Contact) => {
					(async () => {
						try {
							await processAvatar(contact);
							setTimeout(() => { parseContacts() }, 50);
						} catch (err) {
							new Notice(err.message);
						}
					})();
				}}
				exportVCF={(contactFile: TFile) => {
					(async () => {
						const vcards = await vcardToString([contactFile])
						saveVcardFilePicker(vcards, contactFile)
					})();
				}} />
		</div>
	);
};
