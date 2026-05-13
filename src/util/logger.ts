import pino, { Logger, LoggerOptions } from "pino";

export type { Logger } from "pino";

export interface LoggerConfig {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  pretty?: boolean;
}

export function createLogger(config: LoggerConfig = {}): Logger {
  const level = config.level ?? (process.env.DEBUG ? "debug" : "info");
  const pretty =
    config.pretty ?? (process.env.NODE_ENV !== "production" && !process.env.LOG_JSON);

  const options: LoggerOptions = { level };

  if (pretty) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino(options);
}

export function silentLogger(): Logger {
  return pino({ level: "silent" });
}
