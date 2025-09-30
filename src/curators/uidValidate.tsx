import * as React from "react";
import { Contact, ContactNote } from "src/models";
import { getApp } from "src/plugin/context/sharedAppContext";
import { getSettings } from "src/plugin/context/sharedSettingsContext";
import { CuratorProcessor } from "src/interfaces/CuratorProcessor";
import { CuratorQueItem } from "src/interfaces/CuratorQueItem";
import { RunType } from "src/interfaces/RunType";

// Zero dependency uuid generator as its not used for millions of records
const generateUUID = (): string => {
  const timestamp = Date.now().toString(16).padStart(12, "0");
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).replace(/^(.{24})/, (_, p1) => {
    return timestamp + p1.slice(timestamp.length);
  });
}

const renderGroup = (queItems: CuratorQueItem[]):JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} UID's generates</b></p>
        <p>Unique Contact identifiers generated for your contacts where they where absent.</p>
      </div>
    </div>
  );
}

const render = (queItem: CuratorQueItem):JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p>{queItem.message}</p>
      </div>
    </div>
  );
}

export const UidProcessor: CuratorProcessor = {
  name: "UidProcessor",
  runType: RunType.IMMEDIATELY,
  settingPropertyName: "UIDProcessor",
  settingDescription: "Automatically generates a unique identifier (UID) for contact when missing. (e.g. when the contact is created manually)",
  settingDefaultValue: true,

  async process(contact:Contact): Promise<CuratorQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    if (!activeProcessor || contact.data["UID"]) {
      return Promise.resolve(undefined);
    }

    const UUID = `urn:uuid:${generateUUID()}`
    const contactNote = new ContactNote(getApp(), getSettings(), contact.file);
    await contactNote.updateFrontmatterValue("UID", UUID);

    return Promise.resolve({
      name: this.name,
      runType: this.runType,
      file: contact.file,
      message: `A UID has been generated for contact ${contact.file.name}!`,
      render,
      renderGroup
    });
  },

};



