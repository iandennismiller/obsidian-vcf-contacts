import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

/**
 * Invalid field information for display in the modal
 */
export interface InvalidField {
  key: string;
  value: string;
  reason: string;
}

interface RemoveInvalidFieldsModalProps {
  invalidFields: InvalidField[];
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const RemoveInvalidFieldsModalContent: React.FC<RemoveInvalidFieldsModalProps> = ({ 
  invalidFields, 
  onClose, 
  onConfirm, 
  onCancel 
}) => {
  return (
    <div className="contact-modal">
      <div className="contact-modal-content">
        <p>
          The following invalid contact fields were found and will be removed from frontmatter:
        </p>

        <div className="contact-modal-section">
          <h4>Fields to Remove ({invalidFields.length})</h4>
          <ul>
            {invalidFields.map((field, idx) => (
              <li key={idx}>
                <strong>{field.key}</strong>: {field.value}
                <br />
                <span style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>
                  {field.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="contact-modal-buttons">
        <button 
          className="mod-cta"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Remove Invalid Fields
        </button>
        <button
          onClick={() => {
            onCancel();
            onClose();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * Modal for confirming removal of invalid frontmatter fields
 */
export class RemoveInvalidFieldsModal extends Modal {
  private root: Root | null = null;
  private invalidFields: InvalidField[];
  private onConfirm: () => void;
  private onCancel: () => void;

  constructor(
    app: App, 
    invalidFields: InvalidField[], 
    onConfirm: () => void,
    onCancel: () => void
  ) {
    super(app);
    this.invalidFields = invalidFields;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    this.root = createRoot(contentEl);
    this.root.render(
      <RemoveInvalidFieldsModalContent
        invalidFields={this.invalidFields}
        onClose={() => this.close()}
        onConfirm={this.onConfirm}
        onCancel={this.onCancel}
      />
    );
  }

  onClose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}
