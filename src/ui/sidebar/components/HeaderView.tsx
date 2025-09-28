import { setIcon } from "obsidian";
import { Dispatch, SetStateAction } from "react";
import * as React from "react";
import { VcardFile } from "../../../models/vcardFile";


type HeaderProps = {
  onSortChange: React.Dispatch<React.SetStateAction<typeof VcardFile.Sort[keyof typeof VcardFile.Sort]>>;
  sort: typeof VcardFile.Sort[keyof typeof VcardFile.Sort];
  onCreateContact: () => void;
  importVCF: () => void;
  exportAllVCF: () => void;
  setDisplayInsightsView: Dispatch<SetStateAction<boolean>>;
}

export const HeaderView = (props: HeaderProps) => {
	const buttons = React.useRef<(HTMLElement | null)[]>([]);

	React.useEffect(() => {
		buttons.current.forEach(setIconForButton);
	}, [buttons]);

	return (
    <div className="nav-buttons-container">
      <div
        id="create-btn"
        className="clickable-icon nav-action-button"
        data-icon="contact"
        aria-label="Create new contact"
        ref={(element) => (buttons.current[1] = element)}
        onClick={props.onCreateContact}/>

      <div
        id="import-vcf-btn"
        data-icon="file-down"
        className={"clickable-icon nav-action-button "}
        aria-label="Import vcf"
        ref={(element) => (buttons.current[2] = element)}
        onClick={props.importVCF}/>
      <div
        id="import-vcf-btn"
        data-icon="file-up"
        className={"clickable-icon nav-action-button "}
        aria-label="Export vcf"
        ref={(element) => (buttons.current[3] = element)}
        onClick={props.exportAllVCF}/>

      <div className="menu-vert"></div>
      <div
        id="sort-by-name-btn"
        data-icon="baseline"
        className={"clickable-icon nav-action-button " +
          (props.sort === VcardFile.Sort.NAME && "is-active")}
        aria-label="Sort by name"
        ref={(element) => (buttons.current[4] = element)}
        onClick={() => props.onSortChange(VcardFile.Sort.NAME)}/>
      <div
        id="sort-by-birthday-btn"
        data-icon="cake"
        className={"clickable-icon nav-action-button " +
          (props.sort === VcardFile.Sort.BIRTHDAY && "is-active")}
        aria-label="Sort by birthday"
        ref={(element) => (buttons.current[6] = element)}
        onClick={() => props.onSortChange(VcardFile.Sort.BIRTHDAY)}/>
      <div
        id="sort-by-organization-btn"
        data-icon="building"
        className={"clickable-icon nav-action-button " +
          (props.sort === VcardFile.Sort.ORG && "is-active")}
        aria-label="Sort by organization"
        ref={(element) => (buttons.current[7] = element)}
        onClick={() => props.onSortChange(VcardFile.Sort.ORG)}/>

      <div className="menu-vert"></div>

      <div
        id="insights-btn"
        data-icon="lightbulb"
        className="clickable-icon nav-action-button"
        aria-label="Contact insights"
        ref={(element) => (buttons.current[8] = element)}
        onClick={() => props.setDisplayInsightsView(true)}/>

    </div>
	);
};

function setIconForButton(button: HTMLElement | null) {
	if (button != null) {
		const icon = button.getAttr("data-icon");
		if (icon != null) {
			setIcon(button, icon);
		}
	}
}
