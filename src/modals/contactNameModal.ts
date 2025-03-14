import { App, Modal, Notice } from "obsidian";

export class ContactNameModal extends Modal {
	callback: (givenName: string, familyName: string) => void;
	vcfFn: string | undefined;

	constructor(app: App, vcfFn: string|undefined, callback: (givenName: string, familyName: string) => void) {
		super(app);
		this.vcfFn = vcfFn;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl, titleEl } = this;
		titleEl.setText(`Enter full name${this.vcfFn ? (" for " + this.vcfFn) : ''}`);

		// Create input fields for given and family names
		contentEl.innerHTML = `
            <div>
                <label for="given-name" style="display: block; font-weight: bold; margin-bottom: 5px">Given Name:</label>
                <input type="text" id="given-name" style="margin-bottom: 12px; width: 100%;">
            </div>
            <div>
                <label for="family-name" style="display: block; font-weight: bold; margin-bottom: 5px">Family Name:</label>
                <input type="text" id="family-name" style="margin-bottom: 12px; width: 100%;">
            </div>
            <button id="submit-name" style="margin-top: 12px; width: 100%; font-weight: bold;">Submit</button>
        `;

		// Get elements
		const givenNameInput = contentEl.querySelector("#given-name") as HTMLInputElement;
		const familyNameInput = contentEl.querySelector("#family-name") as HTMLInputElement;
		const submitButton = contentEl.querySelector("#submit-name") as HTMLButtonElement;

		// Handle submit click
		submitButton.addEventListener("click", () => {
			const givenName = givenNameInput.value.trim();
			const familyName = familyNameInput.value.trim();

			if (!givenName || !familyName) {
				new Notice("Please enter both a given name and a family name.");
				return;
			}

			this.close();
			this.callback(givenName, familyName);
		});

		// Auto-focus on the first input field for better UX
		givenNameInput.focus();
	}

	onClose() {
		this.contentEl.empty();
	}
}
