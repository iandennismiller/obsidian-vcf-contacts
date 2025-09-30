/**
 * @fileoverview CuratorQueItem interface definition
 * 
 * Defines the structure for curator processing results.
 * 
 * @module CuratorQueItem
 */

import { TFile } from "obsidian";
import { RunType } from "./RunType";

export interface CuratorQueItem {
  name: string;
  runType: RunType
  file: TFile;
  message: string;
  render: (queItem: CuratorQueItem) => JSX.Element;
  renderGroup: (queItems: CuratorQueItem[]) => JSX.Element;
}