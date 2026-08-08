export type LogContext = Readonly<Record<string, string | number | boolean>>;

const write = (
  _level: 'info' | 'warn' | 'error',
  _message: string,
  _context?: LogContext,
): void => {};

export const logger = {
  info: (message: string, context?: LogContext): void => write('info', message, context),
  warn: (message: string, context?: LogContext): void => write('warn', message, context),
  error: (message: string, context?: LogContext): void => write('error', message, context),
};
