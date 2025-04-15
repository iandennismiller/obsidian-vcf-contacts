import { MarkdownView, WorkspaceLeaf } from "obsidian";
import { fileId } from "src/file/file";

let debounceTimer: NodeJS.Timeout;

const scrollToLeaf = (leaf: WorkspaceLeaf):void => {
	clearTimeout(debounceTimer); // Reset debounce timer
	debounceTimer = setTimeout(() => {
		if (!(leaf?.view instanceof MarkdownView)) return;

		const contactElement = document.getElementById(fileId(leaf.view.file));
		if (!contactElement) return;


		const scrollContainer = contactElement.closest(".view-content") as HTMLElement | null;
		if (!scrollContainer) return;

		const elementRect = contactElement.getBoundingClientRect();
		const containerRect = scrollContainer.getBoundingClientRect();

		const scrollOffset =
			elementRect.top - containerRect.top - scrollContainer.clientHeight / 2 + elementRect.height / 2;

		// Smoothly scroll to center the element
		requestAnimationFrame(() => {
			scrollContainer.scrollTo({
				top: scrollContainer.scrollTop + scrollOffset,
				behavior: "smooth",
			});
		});
	}, 50);
};

const scrollToTop = ():void => {
		const scrollContainer = document.querySelector('.contacts-menu')?.closest(".view-content") as HTMLElement | null;
		if (!scrollContainer) return;
		requestAnimationFrame(() => {
			scrollContainer.scrollTo({
				top: 0,
				behavior: "smooth",
			});
		});
};


const clearDebounceTimer = ():void => {
	clearTimeout(debounceTimer);
}

export default {
	scrollToTop,
	scrollToLeaf,
	clearDebounceTimer,
}
