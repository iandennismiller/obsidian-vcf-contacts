import { ContactsPluginSettings } from "src/settings/settings";

let _settings: ContactsPluginSettings | undefined

export function setSettings(settings: ContactsPluginSettings) {
  _settings = settings
}

export function getSettings(): ContactsPluginSettings {
  if (!_settings) {
    throw new Error('Plugin context has not been set.')
  }
  return _settings
}

export function clearSettings() {
  _settings = undefined;
}
