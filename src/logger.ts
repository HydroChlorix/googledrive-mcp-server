import pino from "pino";

const logger = pino({
  level: process.env["LOG_LEVEL"] || "info",
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
