import { normalizePath, Notice, TAbstractFile, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { Contact, getFrontmatterFromFiles, mdRender } from "src/contacts";
import { createEmptyVcard, parseToSingles, parseVcard, vcardToString } from "src/contacts/vcard";
import { getApp } from "src/context/sharedAppContext";
import {
  createContactFile,
  createFileName,
  findContactFiles, openFile,
  openFilePicker,
  saveVcardFilePicker
} from "src/file/file";
import ContactsPlugin from "src/main";
import { ActionView } from "src/ui/sidebar/components/actionView";
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
  const [displayActionsView, setDisplayActionsView] = React.useState<boolean>(false);
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
		<div className="contacts-sidebar">
      { displayActionsView ?
        <ActionView
          setDisplayActionsView={setDisplayActionsView}
        />
      :
        <>
        <div className="contacts-menu">
          <div className="nav-header">
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
            <div className="nav-actionable-container">
              <div className="action-card">
                <div className="action-card-content action-card-content--no-height">
                  <p><b>Roland Broekema</b> birthdays is today.</p>
                </div>
                <div className="modal-close-button"></div>
              </div>
              <div className="action-card">
                <div className="action-card-content">
                  <p><b>3</b> birthdays in the next 7 days.</p>
                  <p><b>16</b> profile improvements possible.</p>
                </div>
                <button
                  className="action-card-button"
                  onClick={() => setDisplayActionsView(true)}
                >Go</button>
                <div className="modal-close-button"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="contacts-view">
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
      </>
    }
  </div>
	);
};
