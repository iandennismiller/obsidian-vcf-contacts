import { Contact, updateFrontMatterValue } from "src/contacts";
import { getSettings } from "src/context/sharedSettingsContext";
import { InsightProcessor, InsightQueItem, RunType } from "src/insights/insightDefinitions";

// Zero dependency uuid generator as its not used for millions of records
const generateUUID = (): string => {
  const timestamp = Date.now().toString(16).padStart(12, '0');
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).replace(/^(.{24})/, (_, p1) => {
    return timestamp + p1.slice(timestamp.length);
  });
}

export const UidProcessor: InsightProcessor = {
  name: "UidProcessor",
  runType: RunType.IMMEDIATELY,
  settingPropertyName: 'UidProcessor',
  settingDescription: 'Generates a unique identifier for contact when missing.',
  settingDefaultValue: true,

  async process(contact:Contact): Promise<InsightQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    if (!activeProcessor || contact.data['UID']) {
      return Promise.resolve(undefined);
    }

    const UUID = `urn:uuid:${generateUUID()}`
    await updateFrontMatterValue(contact.file, 'UID', UUID)

    return Promise.resolve({
      name: this.name,
      runType: this.runType,
      uid: UUID,
      message: `Generated UUID for Contact ${contact.file.name}.` });
  },

  insightRender (item) =>  (
    <div className="insight-card">
      <h4>UUID Generated</h4>
      <p>{item.message}</p>
      <code>{item.uid}</code>
    </div>
  ),

  insightsRender (count) => (
    <div className="insight-group">
      <h3>{items.length} UUIDs Generated</h3>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item.uid} — {item.message}</li>
        ))}
      </ul>
    </div>
  )

};



