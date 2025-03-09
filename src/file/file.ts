import {App, Modal, normalizePath, Notice, TFile, TFolder, Vault, Workspace} from "obsidian";
import { join } from "path";
import {FileExistsModal} from "../modals/fileExistsModal";

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

function openCreatedFile(app: App, filePath: string) {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (file instanceof TFile) {
		openFile(file, app.workspace);
	}
}

async function handleFileCreation(app: App, filePath: string, content: string) {
	const fileExists = await app.vault.adapter.exists(filePath);

	if (fileExists) {
		new FileExistsModal(filePath, async (action: "replace" | "skip") => {
			if (action === "skip") {
				new Notice("File creation skipped.");
				return;
			}

			if (action === "replace") {
				await app.vault.adapter.write(filePath, content);
				openCreatedFile(app, filePath);
				new Notice(`File overwritten.`);
			}
		}).open();
	} else {
		const createdFile = await app.vault.create(filePath, content);
		openFile(createdFile, app.workspace);
	}
}

export function createContactFile(
	app: App,
	folderPath: string,
	content: string,
	filename: string
) {
	const folder = app.vault.getAbstractFileByPath(folderPath);
	if (!folder) {
		new Notice(`Can not find path: '${folderPath}'. Please update "Contacts" plugin settings`);
		return;
	}

	const filePath = normalizePath(join(folderPath, filename));
	handleFileCreation(app, filePath, content);

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
