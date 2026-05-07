type LogContext = Record<string, unknown>;

const formatContext = (context?: LogContext) =>
  context && Object.keys(context).length > 0 ? context : undefined;

export const logger = {
  info(message: string, context?: LogContext) {
    console.info(`[INFO] ${message}`, formatContext(context) ?? '');
  },
  warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, formatContext(context) ?? '');
  },
  error(message: string, error?: unknown, context?: LogContext) {
    console.error(`[ERROR] ${message}`, { error, ...formatContext(context) });
  },
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, formatContext(context) ?? '');
    }
  },
};
