/**
 * @fileoverview CuratorProcessor interface definition
 * 
 * Defines the structure for curator processors.
 * 
 * @module CuratorProcessor
 */

import { Contact } from "../contactNote/types";
import { RunType } from "./RunType";
import { CuratorQueItem } from "./CuratorQueItem";

export interface CuratorProcessor {
  name: string;
  runType: RunType
  settingPropertyName: string;
  settingDescription: string;
  settingDefaultValue: boolean;
  process(contact: Contact): Promise<CuratorQueItem | undefined>;
}