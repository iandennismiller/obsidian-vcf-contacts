import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

/**
 * Field change information for display in the modal
 */
export interface FieldChange {
  key: string;
  oldValue?: string;
  newValue: string;
  changeType: 'added' | 'modified' | 'deleted';
}

interface UpdateContactModalProps {
  changes: FieldChange[];
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const UpdateContactModalContent: React.FC<UpdateContactModalProps> = ({ 
  changes, 
  onClose, 
  onConfirm, 
  onCancel 
}) => {
  const added = changes.filter(c => c.changeType === 'added');
  const modified = changes.filter(c => c.changeType === 'modified');
  const deleted = changes.filter(c => c.changeType === 'deleted');

  return (
    <div className="contact-modal">
      <div className="contact-modal-content">
        <p>
          The Contact section has been edited. The following changes will be synced to frontmatter:
        </p>

        {added.length > 0 && (
          <div className="contact-modal-section">
            <h4>Fields to Add ({added.length})</h4>
            <ul>
              {added.map((change, idx) => (
                <li key={idx}>
                  <strong>{change.key}</strong>: {change.newValue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {modified.length > 0 && (
          <div className="contact-modal-section">
            <h4>Fields to Update ({modified.length})</h4>
            <ul>
              {modified.map((change, idx) => (
                <li key={idx}>
                  <strong>{change.key}</strong>: {change.oldValue} → {change.newValue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {deleted.length > 0 && (
          <div className="contact-modal-section">
            <h4>Fields to Remove ({deleted.length})</h4>
            <ul>
              {deleted.map((change, idx) => (
                <li key={idx}>
                  <strong>{change.key}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="contact-modal-buttons">
        <button 
          className="mod-cta"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Confirm Sync
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

export class UpdateContactModal extends Modal {
  private reactRoot: Root | null = null;
  private changes: FieldChange[];
  private confirmCallback: () => void;
  private cancelCallback: () => void;

  constructor(
    app: App, 
    changes: FieldChange[], 
    confirmCallback: () => void,
    cancelCallback: () => void
  ) {
    super(app);
    this.changes = changes;
    this.confirmCallback = confirmCallback;
    this.cancelCallback = cancelCallback;
  }

  onOpen() {
    this.titleEl.setText("Sync Contact Section to Frontmatter");

    this.reactRoot = createRoot(this.contentEl);
    this.reactRoot.render(
      <UpdateContactModalContent
        changes={this.changes}
        onClose={() => this.close()}
        onConfirm={() => this.confirmCallback()}
        onCancel={() => this.cancelCallback()}
      />
    );
  }

  onClose() {
    this.reactRoot?.unmount();
  }
}
