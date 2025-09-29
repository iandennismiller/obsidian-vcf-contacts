import { TFile } from "obsidian";
import { Contact } from "src";

export interface CuratorQueItem {
  name: string;
  runType: RunType
  file: TFile;
  message: string;
  render: (queItem: CuratorQueItem) => JSX.Element;
  renderGroup: (queItems: CuratorQueItem[]) => JSX.Element;
}

export interface CuratorProcessor {
  name: string;
  runType: RunType
  settingPropertyName: string;
  settingDescription: string;
  settingDefaultValue: boolean;
  process(contact: Contact): Promise<CuratorQueItem | undefined>;
}

export interface CuratorSettingProperties {
  name: string;
  runType: RunType;
  settingPropertyName: string;
  settingDescription: string;
  settingDefaultValue: boolean;
}

export enum RunType {
  IMMEDIATELY = 'immediately',
  UPCOMMING = 'upcoming',
  INPROVEMENT = 'inprovement',
}