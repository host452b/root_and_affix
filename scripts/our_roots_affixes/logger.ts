type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export function log(level: Level, source: string, fields: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const entries = Object.entries(fields).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${level} ${source} ${entries}`);
}

export const logger = {
  info: (source: string, fields: Record<string, unknown>) => log('INFO', source, fields),
  warn: (source: string, fields: Record<string, unknown>) => log('WARN', source, fields),
  error: (source: string, fields: Record<string, unknown>) => log('ERROR', source, fields),
  debug: (source: string, fields: Record<string, unknown>) => log('DEBUG', source, fields),
};
