import {Modal} from "obsidian";

export class FileExistsModal extends Modal {
	filePath: string;
	callback?: (action: "replace" | "skip") => void;

	constructor(filePath:string, callback?: (action: "replace" | "skip") => void) {
		super(app);
		this.filePath = filePath;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl, titleEl } = this;
		titleEl.setText("file exists");

		// Create input fields for given and family names
		contentEl.innerHTML = `
					  <p>
					 		The file "${this.filePath}" already exists. What would you like to do?
						</p>
            <button id="skip" style="margin-top: 12px; font-weight: bold;">Skip</button>
            <button id="replace" style="margin-top: 12px; font-weight: bold;">Replace</button>
        `;

		const skipButton = contentEl.querySelector("#skip") as HTMLButtonElement;
		const replaceButton = contentEl.querySelector("#replace") as HTMLButtonElement;

		replaceButton.onclick = async () => {
			this.callback?.("replace"); // Invoke the callback with "replace"
			this.close();
		};

		skipButton.onclick = () => {
			this.callback?.("skip"); // Invoke the callback with "skip"
			this.close();
		};
	}

	onClose() {
		this.contentEl.empty();
	}
}
