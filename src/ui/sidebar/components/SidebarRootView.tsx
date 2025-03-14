import { normalizePath, TAbstractFile, TFile, TFolder } from "obsidian";
import * as React from "react";
import { useApp } from "src/context/hooks";
import {createContactFile, findContactFiles, openFilePicker, saveVcardFilePicker} from "src/file/file";
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
		) as TFolder;

		if (!contactsFolder) {
			setContacts([]);
		}

		const contactFiles: TFile[] = findContactFiles(contactsFolder);

		parseContactFiles(contactFiles, metadataCache).then((contactsData) =>
			setContacts(contactsData)
		);
	};

	React.useEffect(() => {
		parseContacts();
	}, []);

	React.useEffect(() => {
		const updateFiles = (file: TAbstractFile) => {
			if (isFileInFolder(file)) {
				parseContacts();
			}
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
								const fileName = `${records['N.GN']} ${records['N.FN']}.md`
								const mdContent = mdRender(records, props.plugin.settings.defaultHashtag);
								createContactFile(app, folder, mdContent, fileName)
							}
						}
					})
				}}
				exportAllVCF={async() => {
					const vcards = await vcardToString(metadataCache, contacts.map((contact)=> contact.file));
					saveVcardFilePicker(vcards)
				}}
				onCreateContact={async () => {
					const records = await createEmptyVcard();
					const fileName = `${records['N.GN']} ${records['N.FN']}.md`
					const mdContent = mdRender(records, props.plugin.settings.defaultHashtag);
					createContactFile(app, folder, mdContent, fileName)
				}}
				sort={sort}
			/>
			<ContactsListView
				contacts={contacts}
				sort={sort}
				exportVCF={(contactFile: TFile) => {
					(async () => {
						const vcards = await vcardToString(metadataCache, [contactFile])
						saveVcardFilePicker(vcards, contactFile)
					})();
				}} />
		</div>
	);
};
