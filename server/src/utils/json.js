// Helpers para (de)serializar campos JSON guardados como String no SQLite.

export function parseJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value; // já é objeto
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJSON(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
