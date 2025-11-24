import fs from "fs";
import os from "os";
import path from "path";

export interface BeadsConfig {
  beadsPath: string;
  beadsDir?: string;
  beadsDb?: string;
  beadsActor?: string;
  beadsNoAutoFlush: boolean;
  beadsNoAutoImport: boolean;
  beadsWorkingDir?: string;
}

function parseBoolEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function which(executable: string): string | undefined {
  const pathEnv = process.env.PATH ?? "";
  const separator = process.platform === "win32" ? ";" : ":";

  for (const dir of pathEnv.split(separator)) {
    if (!dir) continue;
    const fullPath = path.join(dir, executable);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
    if (process.platform === "win32") {
      const fullExe = fullPath + ".exe";
      if (fs.existsSync(fullExe) && fs.statSync(fullExe).isFile()) {
        return fullExe;
      }
    }
  }

  return undefined;
}

export function defaultBeadsPath(): string {
  const fromEnv = process.env.BEADS_PATH;
  if (fromEnv && fromEnv.trim() !== "") {
    return fromEnv;
  }

  const found = which("bd");
  if (found) {
    return found;
  }

  // Fallback to common install location used in README
  return path.join(os.homedir(), ".local", "bin", "bd");
}

export function loadBeadsConfig(): BeadsConfig {
  return {
    beadsPath: defaultBeadsPath(),
    beadsDir: process.env.BEADS_DIR || undefined,
    beadsDb: process.env.BEADS_DB || undefined,
    beadsActor: process.env.BEADS_ACTOR || process.env.USER || undefined,
    beadsNoAutoFlush: parseBoolEnv(process.env.BEADS_NO_AUTO_FLUSH),
    beadsNoAutoImport: parseBoolEnv(process.env.BEADS_NO_AUTO_IMPORT),
    beadsWorkingDir: process.env.BEADS_WORKING_DIR || undefined,
  };
}

