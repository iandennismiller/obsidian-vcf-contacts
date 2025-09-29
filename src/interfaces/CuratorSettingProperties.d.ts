/**
 * @fileoverview CuratorSettingProperties interface definition
 * 
 * Defines the structure for curator setting properties.
 * 
 * @module CuratorSettingProperties
 */

import { RunType } from "./RunType";

export interface CuratorSettingProperties {
  name: string;
  runType: RunType;
  settingPropertyName: string;
  settingDescription: string;
  settingDefaultValue: boolean;
}