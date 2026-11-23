import * as v from 'valibot';
import { ConfigSchema, type AppConfig } from './schema.ts';
import { DEFAULT_CONFIG } from './defaults.ts';

type Plain = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Führt `override` tief in `base` zusammen. Arrays und Primitive werden ersetzt. */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : override) as T;
  }
  const result: Plain = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] = isPlainObject(value) && isPlainObject(result[key]) ? deepMerge(result[key], value) : value;
  }
  return result as T;
}

export class ConfigError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/** Validiert eine (teilweise) Konfiguration und ergänzt die Vorgaben. */
export function resolveConfig(raw: unknown): AppConfig {
  const merged = deepMerge(structuredClone(DEFAULT_CONFIG), raw);
  const result = v.safeParse(ConfigSchema, merged);
  if (!result.success) {
    const issues = result.issues.map((issue) => {
      const path = issue.path?.map((p) => String(p.key)).join('.') ?? '(root)';
      return `${path}: ${issue.message}`;
    });
    throw new ConfigError('Die Konfiguration ist ungültig.', issues);
  }
  const config = result.output;
  if (!config.theme.themes[config.theme.active]) {
    throw new ConfigError('Die Konfiguration ist ungültig.', [
      `theme.active: Theme «${config.theme.active}» ist nicht unter theme.themes definiert`,
    ]);
  }
  if (!config.locales.ui.includes(config.locales.default)) {
    throw new ConfigError('Die Konfiguration ist ungültig.', [
      `locales.default: «${config.locales.default}» fehlt in locales.ui`,
    ]);
  }
  if (!config.api.mock && !config.api.baseUrl) {
    throw new ConfigError('Die Konfiguration ist ungültig.', [
      'api.baseUrl: fehlt (oder api.mock: true setzen)',
    ]);
  }
  return config;
}

/**
 * Lädt `config/config.json` relativ zur App. Fehlt die Datei (404), wird `config/config.example.json`
 * verwendet – praktisch für die lokale Entwicklung mit Demo-Daten.
 */
export async function loadConfig(base = import.meta.env.BASE_URL): Promise<AppConfig> {
  const candidates = [`${base}config/config.json`, `${base}config/config.example.json`];
  for (const url of candidates) {
    let response: Response;
    try {
      response = await fetch(url, { cache: 'no-cache' });
    } catch (error) {
      throw new ConfigError(`Konfiguration konnte nicht geladen werden (${url}).`, [String(error)]);
    }
    if (response.status === 404) continue;
    if (!response.ok) throw new ConfigError(`Konfiguration konnte nicht geladen werden (${url}).`);
    const type = response.headers.get('content-type') ?? '';
    // Ein SPA-Fallback liefert bei fehlender Datei index.html aus – dann nächste Datei versuchen.
    if (type.includes('text/html')) continue;
    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      throw new ConfigError(`${url} ist kein gültiges JSON.`, [String(error)]);
    }
    if (url.endsWith('config.example.json')) {
      console.info('[epics] config/config.json fehlt – verwende config.example.json');
    }
    return resolveConfig(raw);
  }
  throw new ConfigError('Keine Konfigurationsdatei gefunden (config/config.json).');
}
