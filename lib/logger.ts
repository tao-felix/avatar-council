import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "debug.log");

try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* */ }

export function log(source: string, message: string, data?: unknown) {
  const ts = new Date().toISOString();
  const line = data
    ? `${ts} [${source}] ${message} ${JSON.stringify(data)}\n`
    : `${ts} [${source}] ${message}\n`;
  try { appendFileSync(LOG_FILE, line); } catch { /* */ }
}
