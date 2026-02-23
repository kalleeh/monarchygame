export const log = {
  info: (handler: string, action: string, context?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'INFO', handler, action, ...context, timestamp: new Date().toISOString() }));
  },
  warn: (handler: string, message: string, context?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'WARN', handler, message, ...context, timestamp: new Date().toISOString() }));
  },
  error: (handler: string, error: unknown, context?: Record<string, unknown>) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: 'ERROR', handler, error: message, ...context, timestamp: new Date().toISOString() }));
  },
};
