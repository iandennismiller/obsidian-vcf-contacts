import { normalizePath, TAbstractFile, TFile, TFolder } from "obsidian";
import * as React from "react";
import { useApp } from "src/context/hooks";
import {createContactFile, createFileName, findContactFiles, openFilePicker, saveVcardFilePicker} from "src/file/file";
import ContactsPlugin from "src/main";
import { Contact } from "src/parse/contact";
import { parseContactFiles } from "src/parse/parse";
import { Sort } from "src/util/constants";
import { ContactsListView } from "./ContactsListView";
import { HeaderView } from "./HeaderView";
import { createEmptyVcard, parseToSingles, parseVcard } from "src/parse/vcard/vcardParse";
import { mdRender } from "src/parse/vcard/vcardMdTemplate";
import myScrollTo from "src/util/myScrollTo";
import { vcardToString } from "src/parse/vcard/vcardToString";
import { processAvatar } from "src/util/avatarActions";

type RootProps = {
	plugin: ContactsPlugin;
};

export const SidebarRootView = (props: RootProps) => {
	const app = useApp();
	const { vault, metadataCache } = app;
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

		parseContactFiles(findContactFiles(contactsFolder), metadataCache).then((contactsData) =>{
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
		app.workspace.on("active-leaf-change", myScrollTo.scrollToLeaf);

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
					const vcards = await vcardToString(metadataCache, allContactFiles);
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
						await processAvatar(contact)
					})();
				}}
				exportVCF={(contactFile: TFile) => {
					(async () => {
						const vcards = await vcardToString(metadataCache, [contactFile])
						saveVcardFilePicker(vcards, contactFile)
					})();
				}} />
		</div>
	);
};
