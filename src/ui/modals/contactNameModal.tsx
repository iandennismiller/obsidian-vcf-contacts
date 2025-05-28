import { App, Modal, Notice } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client"

interface ContactNameModalProps {
	vcfFn?: string;
	onClose: () => void;
	onSubmit: (givenName: string, familyName: string) => void;
}

const ContactNameModalContent: React.FC<ContactNameModalProps> = ({ vcfFn, onClose, onSubmit }) => {
	const givenRef = React.useRef<HTMLInputElement>(null);
	const familyRef = React.useRef<HTMLInputElement>(null);

	const handleSubmit = () => {
		const given = givenRef.current?.value.trim() ?? "";
		const family = familyRef.current?.value.trim() ?? "";

		if (!given || !family) {
			new Notice("Please enter both a given name and a family name.");
			return;
		}

		onSubmit(given, family);
		onClose();
	};

	React.useEffect(() => {
		givenRef.current?.focus();
	}, []);

	return (
		<div className="contact-modal">
			<div className="contact-modal-field">
				<label className="contact-modal-label">
					Given Name:
				</label>
				<input
					ref={givenRef}
					type="text"
					className="contact-modal-input"
				/>
			</div>
			<div>
				<label className="contact-modal-label">
					Family Name:
				</label>
				<input
					ref={familyRef}
					type="text"
					className="contact-modal-input"
				/>
			</div>
			<div className="contact-modal-buttons">
				<button className="mod-cta"
					onClick={handleSubmit}
				>
					Submit
				</button>
			</div>
		</div>
	);
};


export class ContactNameModal extends Modal {
	private reactRoot: Root | null = null;
	private vcfFn: string | undefined;
	private callback: (givenName: string, familyName: string) => void;

	constructor(app: App, vcfFn: string | undefined, callback: (givenName: string, familyName: string) => void) {
		super(app);
		this.vcfFn = vcfFn;
		this.callback = callback;
	}

	onOpen() {
		this.titleEl.setText(`Enter full name${this.vcfFn ? " for " + this.vcfFn : ""}`);

		this.reactRoot = createRoot(this.contentEl);
		this.reactRoot.render(
			<ContactNameModalContent
				vcfFn={this.vcfFn}
				onClose={() => this.close()}
				onSubmit={(given, family) => this.callback(given, family)}
			/>
		);
	}

	onClose() {
		this.reactRoot?.unmount();
	}
}
