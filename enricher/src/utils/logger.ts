const formatMessage = (message: unknown): string => {
  if (message instanceof Error) {
    return message.stack || message.message;
  }
  if (typeof message === 'object' && message !== null) {
    try {
      return JSON.stringify(message, null, 2);
    } catch {
      return String(message);
    }
  }
  return String(message);
};

const formatArgs = (args: unknown[]) => args.map(formatMessage).join(' ');

const logger = {
  debug: (...args: unknown[]) =>
    console.debug(`[wgeteer] DEBUG ${new Date().toISOString()} ${formatArgs(args)}`),
  info: (...args: unknown[]) =>
    console.info(`[wgeteer] INFO  ${new Date().toISOString()} ${formatArgs(args)}`),
  warn: (...args: unknown[]) =>
    console.warn(`[wgeteer] WARN  ${new Date().toISOString()} ${formatArgs(args)}`),
  error: (...args: unknown[]) =>
    console.error(`[wgeteer] ERROR ${new Date().toISOString()} ${formatArgs(args)}`),
};

export default logger;
