import { ContactsPluginSettings } from 'src/interfaces/ContactsPluginSettings';
type SettingsListener = (settings: ContactsPluginSettings) => void;

let _settings: ContactsPluginSettings | undefined
const _listeners = new Set<SettingsListener>();

export function setSettings(settings: ContactsPluginSettings) {
  _settings = settings
  _listeners.forEach((listener) => listener(settings));
}

export function getSettings(): ContactsPluginSettings {
  if (!_settings) {
    throw new Error('Plugin context has not been set.')
  }
  return _settings
}

export function updateSettings(partialSettings: Partial<ContactsPluginSettings>) {
  if (!_settings) {
    throw new Error('Plugin context has not been set.')
  }
  _settings = { ..._settings, ...partialSettings };
  _listeners.forEach((listener) => listener(_settings!));
}

export function clearSettings() {
  _settings = undefined;
  _listeners.clear();
}

export function onSettingsChange(listener: SettingsListener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
