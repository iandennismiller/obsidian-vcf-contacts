import { Setting } from "obsidian";
import { Contact } from "src/contacts";

export interface InsightQueItem {
  name: string;
  runType: RunType
  uid: string;
  message: string;
}

export interface InsightProcessor {
  name: string;
  runType: RunType
  settingPropertyName: string;
  settingDescription: string;
  settingDefaultValue: boolean;
  process(contact: Contact): Promise<InsightQueItem | undefined>;
}


export interface InsighSettingProperties {
  name: string;
  runType: RunType;
  settingPropertyName: string;
  settingDescription: string;
  settingDefaultValue: boolean;
}

export enum RunType {
  IMMEDIATELY = 'immediately',
  QUEUED = 'queued'
}
