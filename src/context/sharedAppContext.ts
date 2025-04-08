import { App } from 'obsidian'

let _app: App | undefined

export function setApp(app: App) {
	_app = app
}

// Safe accessor, runtime-enforced, TS knows it's not undefined
export function getApp(): App {
	if (!_app) {
		throw new Error('App context has not been set.')
	}
	return _app
}

export function clearApp() {
	_app = undefined;
}
