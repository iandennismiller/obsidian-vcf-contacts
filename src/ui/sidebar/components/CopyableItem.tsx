import * as React from "react";
import {Menu, Notice} from "obsidian";

interface CopyableItemProps {
	value: string;
	children: React.ReactNode;
}

export const CopyableItem: React.FC<CopyableItemProps> = ({ value, children }) => {
	const handleCopy = () => {
		navigator.clipboard.writeText(value).then(() => {
			new Notice(`Copied "${value}" to clipboard`);
		}).catch(err => {
			new Notice("Failed to copy to clipboard");
		});
	};

	const handleContextMenu = (event: React.MouseEvent) => {
		event.preventDefault();
		const menu = new Menu();
		menu.addItem((item) =>
			item.setTitle("Copy to Clipboard").setIcon("clipboard").onClick(handleCopy)
		);
		menu.showAtPosition({ x: event.pageX, y: event.pageY });
	};

	return (
		<div className="biz-item" onContextMenu={handleContextMenu}>
			{children}
		</div>
	);
};
