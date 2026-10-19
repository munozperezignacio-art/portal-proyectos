export type ThemePreference = 'light' | 'dark' | 'automatic';
export type ThemeMode = 'light' | 'dark';
type PreferenceStorage = { getItem:(key:string)=>Promise<string|null>; setItem:(key:string,value:string)=>Promise<void> };

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'automatic';
}

export function resolveThemeMode(preference: ThemePreference, system: unknown): ThemeMode {
  return preference === 'automatic' ? (system === 'dark' ? 'dark' : 'light') : preference;
}

export function themeStorageKey(userKey: string) {
  return `obraxis:appearance:${encodeURIComponent(userKey)}`;
}

export async function loadThemePreference(storage: PreferenceStorage, userKey: string) {
  return parseThemePreference(await storage.getItem(themeStorageKey(userKey)));
}

export async function saveThemePreference(storage: PreferenceStorage, userKey: string, preference: ThemePreference) {
  if (!['light', 'dark', 'automatic'].includes(preference)) throw new Error('Preferencia de apariencia inválida.');
  await storage.setItem(themeStorageKey(userKey), preference);
}
