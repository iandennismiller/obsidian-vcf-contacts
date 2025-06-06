
import { Contact } from "src/contacts";
import { InsighSettingProperties, InsightProcessor, InsightQueItem, RunType } from "src/insights/insight.d";

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

  async process(contacts: Contact|Contact[], runType: RunType): Promise<InsightQueItem[]> {
    const contactArray = Array.isArray(contacts) ? contacts : [contacts];
    const results =  await Promise.all(
      contactArray.map((contact) => processSingleContact(contact, runType))
    );
    return results.flat().filter((insight) => insight !== undefined) as InsightQueItem[];
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
