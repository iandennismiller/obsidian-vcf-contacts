import { App, Modal, Notice } from "obsidian";
import * as React from "react";
import { useState, useEffect } from "react";
import { createRoot, Root } from "react-dom/client";
import { VdirsyncerService } from "../../services/vdirsyncerService";

interface VdirsyncerConfigModalProps {
  filePath: string;
  onClose: () => void;
}

type ModalStatus = 'unchanged' | 'unsaved' | 'saved';

const VdirsyncerConfigModalContent: React.FC<VdirsyncerConfigModalProps> = ({
  filePath,
  onClose
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [status, setStatus] = useState<ModalStatus>('unchanged');
  const [savedThisSession, setSavedThisSession] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Calculate status based on content changes and save state
  useEffect(() => {
    if (content === originalContent) {
      if (savedThisSession) {
        setStatus('saved');
      } else {
        setStatus('unchanged');
      }
    } else {
      setStatus('unsaved');
    }
  }, [content, originalContent, savedThisSession]);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      const configContent = await VdirsyncerService.readConfig(filePath);
      if (configContent !== null) {
        setContent(configContent);
        setOriginalContent(configContent);
      } else {
        new Notice('Failed to load vdirsyncer config file');
      }
      setLoading(false);
    };
    
    loadConfig();
  }, [filePath]);

  const handleReload = async () => {
    setLoading(true);
    const configContent = await VdirsyncerService.readConfig(filePath);
    if (configContent !== null) {
      setContent(configContent);
      setOriginalContent(configContent);
      setSavedThisSession(false);
      new Notice('Config reloaded from disk');
    } else {
      new Notice('Failed to reload config file');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    const success = await VdirsyncerService.writeConfig(filePath, content);
    if (success) {
      setOriginalContent(content);
      setSavedThisSession(true);
      new Notice('Config saved successfully');
    } else {
      new Notice('Failed to save config file');
    }
    setLoading(false);
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'unchanged':
        return 'unchanged';
      case 'unsaved':
        return 'unsaved changes';
      case 'saved':
        return 'saved changes';
    }
  };

  const getStatusClass = (): string => {
    switch (status) {
      case 'unchanged':
        return 'vdirsyncer-status-unchanged';
      case 'unsaved':
        return 'vdirsyncer-status-unsaved';
      case 'saved':
        return 'vdirsyncer-status-saved';
    }
  };

  return (
    <div className="vdirsyncer-config-modal">
      <div className={`vdirsyncer-status ${getStatusClass()}`}>
        Status: {getStatusText()}
      </div>
      
      <textarea
        className="vdirsyncer-config-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
        rows={20}
        style={{
          width: '100%',
          fontFamily: 'monospace',
          fontSize: '13px',
          resize: 'vertical',
          marginBottom: '1em'
        }}
      />
      
      <div className="vdirsyncer-modal-buttons">
        <button
          onClick={handleReload}
          disabled={loading}
        >
          Reload
        </button>
        <button
          onClick={handleSave}
          disabled={loading || status === 'unchanged'}
        >
          Save
        </button>
        <button
          className="mod-cta"
          onClick={onClose}
          disabled={loading}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export class VdirsyncerConfigModal extends Modal {
  filePath: string;
  private reactRoot: Root | null = null;

  constructor(app: App, filePath: string) {
    super(app);
    this.filePath = filePath;
  }

  onOpen() {
    this.titleEl.setText("vdirsyncer Configuration");

    // Create React root and render
    this.reactRoot = createRoot(this.contentEl);
    this.reactRoot.render(
      <VdirsyncerConfigModalContent
        filePath={this.filePath}
        onClose={() => this.close()}
      />
    );
  }

  onClose() {
    this.reactRoot?.unmount();
  }
}
