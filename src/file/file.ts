import {App, Modal, normalizePath, Notice, TAbstractFile, TFile, TFolder, Vault, Workspace} from "obsidian";
import { join } from "path";
import { FileExistsModal } from "src/ui/modals/fileExistsModal";

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
	const activeFile = app.workspace.getActiveFile();
	const parentFolder = activeFile?.parent; // Get the parent folder if it's a file

	if (parentFolder?.path?.contains(folderPath)) {
		const filePath = normalizePath(join(parentFolder.path, filename));
		handleFileCreation(app, filePath, content);
	} else {
		const filePath = normalizePath(join(folderPath, filename));
		handleFileCreation(app, filePath, content);
	}
}

export function fileId(file: TAbstractFile): string {
	let hash = 0;
	for (let i = 0; i < file.path.length; i++) {
		hash = (hash << 5) - hash + file.path.charCodeAt(i);
		hash |= 0; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(); // Ensure it's positive
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


export function saveVcardFilePicker(data: string, obsidianFile?: TFile ) {
	try {
		const element = document.createElement("a");
		const file = new Blob([data], { type: "text/vcard" })
		element.href = URL.createObjectURL(file);
		element.download = obsidianFile ? obsidianFile.basename.replace(/ /g, '-') + '.vcf' : "contacts.vcf";
		element.click();
	} catch (_err) {}
}

export function createFileName(records: Record<string, string>) {
	const parts = [
		records['N.PREFIX'] || '',
		records['N.GN'] || '',
		records['N.MN'] || '',
		records['N.FN'] || '',
		records['N.SUFFIX'] || ''
	];

	return parts
		.map(part => part.trim())
		.filter(part => part !== '')
		.join(' ') + '.md';
}
