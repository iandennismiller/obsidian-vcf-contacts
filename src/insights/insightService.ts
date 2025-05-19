
import { Contact } from "src/contacts";
import { InsighSettingProperties, InsightProcessor, RunType } from "src/insights/insightDefinitions";

const processors = new Map<string, InsightProcessor>();

const processSingleContact  = async (contact:Contact, runType: RunType) => {
  const insight = [];
  for (const processor of processors.values()) {
    if (processor.runType === runType) {
      insight.push(processor.process(contact));
    }
  }
  return Promise.all(insight);
}

export const insightService = {

  register(processor: InsightProcessor) {
    processors.set(processor.name, processor);
  },

  async process(contacts: Contact|Contact[], runType: RunType) {
    if (!Array.isArray(contacts)) {
      return processSingleContact(contacts, runType);
    } else {
      return contacts.map((contact: Contact) => {
        processSingleContact(contact, runType);
      });
    }
  },

  settings(): InsighSettingProperties[] {
    return Array.from(processors.values()).map(processor => ({
      name: processor.name,
      runType: processor.runType,
      settingPropertyName: processor.settingPropertyName,
      settingDescription: processor.settingDescription,
      settingDefaultValue: processor.settingDefaultValue,
    }));
  }

}
