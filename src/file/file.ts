import {App, Modal, normalizePath, Notice, TFile, TFolder, Vault, Workspace} from "obsidian";
import { join } from "path";
import { Template } from "src/settings/settings";
import { ContactNameModal } from "../modals/contactNameModal";
import {FileExistsModal} from "../modals/fileExistsModal";

const customFormat =
  `/---contact---/
| key       | value |
| --------- | ----- |
| Name      |       |
| Last Name |       |
| Phone     |       |
| Telegram  |       |
| Linkedin  |       |
| Birthday  |       |
| Last chat |       |
| Friends   |       |
/---contact---/`

const frontmatterFormat =
  `---
name:
  first:
  last:
phone:
telegram:
linkedin:
birthday:
last_chat:
friends:
type: contact
---`

export async function openFile(file: TFile, workspace: Workspace) {
  const leaf = workspace.getLeaf()
  await leaf.openFile(file, { active: true });
}

export function findContactFiles(contactsFolder: TFolder) {
  const contactFiles: TFile[] = [];
  Vault.recurseChildren(contactsFolder, async (contactNote) => {
    if (contactNote instanceof TFile) {
      contactFiles.push(contactNote);
    }
  });
  return contactFiles;
}

export function createContactFile(app: App, folderPath: string, template: Template, hashtag: string, vault: Vault, workspace: Workspace) {
	const folder = vault.getAbstractFileByPath(folderPath)
	if (!folder) {
		new Notice(`Can not find path: '${folderPath}'. Please update "Contacts" plugin settings`);
		return;
	}

	new ContactNameModal(app, async (givenName, familyName) => {
		const filePath = normalizePath(join(folderPath, `${givenName} ${familyName}.md`));
		const fileExists = await vault.adapter.exists(filePath);
		if (fileExists) {
			new FileExistsModal(filePath, (action: "replace" | "skip") => {
				if(action === "skip") {
					new Notice("File creation skipped.");
				}

				if(action === "replace") {
					vault.adapter.write(filePath, getNewFileContent(template, hashtag))
						.then(() => {
							const file = vault.getAbstractFileByPath(filePath);
							if (file instanceof TFile) {
								openFile(file, workspace);
							}
							new Notice(`File overwritten.`);
						});
				}
			}).open();
		} else {
			vault.create(filePath, getNewFileContent(template, hashtag))
				.then(createdFile => openFile(createdFile, workspace));
		}
	}).open();
}

// export function createContactFileWithData() {
// 	const folder = vault.getAbstractFileByPath(folderPath)
// 	if (!folder) {
// 		new Notice(`Can not find path: '${folderPath}'. Please update "Contacts" plugin settings`);
// 		return;
// 	}
//
// 	vault.create(normalizePath(join(folderPath, `Contact ${findNextFileNumber(folderPath, vault)}.md`)), getNewFileContent(template, hashtag))
// 		.then(createdFile => openFile(createdFile, workspace));
// }


function getNewFileContent(template: Template, hashtag: string): string {
  let hashtagSuffix = '';
  if (hashtag) {
    hashtagSuffix = '\n' + hashtag;
  }
  switch (template) {
    case Template.CUSTOM:
      return customFormat + hashtagSuffix;
    case Template.FRONTMATTER:
      return frontmatterFormat + hashtagSuffix;
    default:
      return customFormat + hashtagSuffix;
  }
}

export async function openFilePicker(type: string): Promise<string> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = type;
		input.style.display = "none";

		input.addEventListener("change", () => {
			if (input?.files && input.files.length > 0) {
				const file = input.files[0];
				const reader = new FileReader();

				reader.onload = function (event) {
					const rawData = event?.target?.result || '';
					if (typeof rawData === "string") {
						resolve(rawData);
					} else {
						resolve(new TextDecoder("utf-8").decode(rawData));
					}

				};

				reader.readAsText(file, "UTF-8");
			} else {
				resolve('');
			}
		});

		document.body.appendChild(input);
		input.click();
		document.body.removeChild(input);
	});
}
