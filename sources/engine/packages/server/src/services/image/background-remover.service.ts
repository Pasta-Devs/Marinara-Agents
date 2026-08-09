import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { delimiter, join } from "path";
import { promisify } from "util";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";

const execFileAsync = promisify(execFile);

const RUNTIME_DIR = join(DATA_DIR, "background-remover");
const VENV_DIR = join(RUNTIME_DIR, ".venv");
const MODEL_DIR = join(RUNTIME_DIR, "models");
const U2NET_MODEL_PATH = join(MODEL_DIR, "u2net.pth");
const U2NETP_MODEL_PATH = join(MODEL_DIR, "u2netp.pth");
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

type BackgroundRemoverCommand = {
  command: string;
  argsPrefix: string[];
  label: string;
  source: "env" | "local" | "path";
};

export type SpriteBackgroundRemovalEngine = "auto" | "backgroundremover" | "builtin";

export interface BackgroundRemoverStatus {
  engine: SpriteBackgroundRemovalEngine;
  installed: boolean;
  command: string | null;
  source: BackgroundRemoverCommand["source"] | null;
  runtimeDir: string;
  reason: string | null;
}

function parseBooleanEnv(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

function preferredEngine(): SpriteBackgroundRemovalEngine {
  const raw = (process.env.SPRITE_BACKGROUND_REMOVAL_ENGINE ?? process.env.BACKGROUND_REMOVAL_ENGINE ?? "auto")
    .trim()
    .toLowerCase();
  if (raw === "backgroundremover" || raw === "background-remover" || raw === "ai") return "backgroundremover";
  if (raw === "builtin" || raw === "built-in" || raw === "sharp" || raw === "matte") return "builtin";
  return "auto";
}

function executableExists(path: string): boolean {
  try {
    const stat = statSync(path, { throwIfNoEntry: false });
    return !!stat?.isFile();
  } catch {
    return false;
  }
}

function localVenvExecutable(name: "backgroundremover" | "python"): string {
  if (process.platform === "win32") {
    return join(VENV_DIR, "Scripts", name === "python" ? "python.exe" : "backgroundremover.exe");
  }
  return join(VENV_DIR, "bin", name);
}

function pathExecutableNames(name: string): string[] {
  if (process.platform !== "win32") return [name];
  const extensions = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .map((ext) => ext.trim())
    .filter(Boolean);
  return extensions.map((ext) => `${name}${ext.toLowerCase()}`);
}

function findExecutableOnPath(name: string): string | null {
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    for (const executableName of pathExecutableNames(name)) {
      const candidate = join(entry, executableName);
      if (executableExists(candidate)) return candidate;
    }
  }
  return null;
}

function resolveBackgroundRemoverCommand(): BackgroundRemoverCommand | null {
  const envCommand = process.env.BACKGROUNDREMOVER_COMMAND?.trim();
  if (envCommand) {
    return { command: envCommand, argsPrefix: [], label: envCommand, source: "env" };
  }

  const envPython = process.env.BACKGROUNDREMOVER_PYTHON?.trim();
  if (envPython) {
    return {
      command: envPython,
      argsPrefix: ["-m", "backgroundremover.cmd.cli"],
      label: `${envPython} -m backgroundremover.cmd.cli`,
      source: "env",
    };
  }

  const localCli = localVenvExecutable("backgroundremover");
  if (executableExists(localCli)) {
    return { command: localCli, argsPrefix: [], label: localCli, source: "local" };
  }

  const localPython = localVenvExecutable("python");
  if (executableExists(localPython)) {
    return {
      command: localPython,
      argsPrefix: ["-m", "backgroundremover.cmd.cli"],
      label: `${localPython} -m backgroundremover.cmd.cli`,
      source: "local",
    };
  }

  const pathCli = findExecutableOnPath("backgroundremover");
  if (pathCli) {
    return { command: pathCli, argsPrefix: [], label: pathCli, source: "path" };
  }

  return null;
}

function backgroundRemoverTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.BACKGROUNDREMOVER_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function configuredEnvPath(name: "U2NET_PATH" | "U2NETP_PATH", fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function backgroundRemoverEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    KMP_DUPLICATE_LIB_OK: process.env.KMP_DUPLICATE_LIB_OK ?? "TRUE",
    U2NET_HOME: process.env.U2NET_HOME ?? MODEL_DIR,
    U2NET_PATH: configuredEnvPath("U2NET_PATH", U2NET_MODEL_PATH),
    U2NETP_PATH: configuredEnvPath("U2NETP_PATH", U2NETP_MODEL_PATH),
  };
}

function formatFailureChunk(value: unknown): string {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return "";
}

function commandFailureText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const failure = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [failure.message, failure.stdout, failure.stderr].map(formatFailureChunk).filter(Boolean).join("\n");
}

function isCorruptedManagedModelError(error: unknown): boolean {
  const output = commandFailureText(error);
  if (!/Corrupted model file|appears to be corrupted|Ran out of input/i.test(output)) return false;

  const usingDefaultU2netPath = !process.env.U2NET_PATH?.trim();
  const usingDefaultU2netpPath = !process.env.U2NETP_PATH?.trim();
  return usingDefaultU2netPath || usingDefaultU2netpPath;
}

function clearManagedModelCache(): void {
  if (!process.env.U2NET_PATH?.trim()) rmSync(U2NET_MODEL_PATH, { force: true });
  if (!process.env.U2NETP_PATH?.trim()) rmSync(U2NETP_MODEL_PATH, { force: true });
}

export function getBackgroundRemoverStatus(): BackgroundRemoverStatus {
  const engine = preferredEngine();
  const disabled = parseBooleanEnv(process.env.BACKGROUNDREMOVER_DISABLED);
  const command = disabled || engine === "builtin" ? null : resolveBackgroundRemoverCommand();
  return {
    engine,
    installed: !!command,
    command: command?.label ?? null,
    source: command?.source ?? null,
    runtimeDir: RUNTIME_DIR,
    reason: disabled
      ? "backgroundremover is disabled by BACKGROUNDREMOVER_DISABLED"
      : engine === "builtin"
        ? "Built-in matte cleanup is forced by SPRITE_BACKGROUND_REMOVAL_ENGINE"
        : command
          ? null
          : `Run "pnpm backgroundremover:install" to install the optional local AI background remover.`,
  };
}

export async function tryRemoveBackgroundWithBackgroundRemover(
  input: Buffer,
  options: { required?: boolean } = {},
): Promise<Buffer | null> {
  const engine = preferredEngine();
  const disabled = parseBooleanEnv(process.env.BACKGROUNDREMOVER_DISABLED);
  if (engine === "builtin" || disabled) {
    if (options.required) {
      throw new Error(
        disabled
          ? "backgroundremover is disabled by BACKGROUNDREMOVER_DISABLED."
          : "backgroundremover cannot run while SPRITE_BACKGROUND_REMOVAL_ENGINE is set to builtin.",
      );
    }
    return null;
  }

  const command = resolveBackgroundRemoverCommand();
  if (!command) {
    if (engine === "backgroundremover" || options.required) {
      throw new Error(`backgroundremover is not installed. Run "pnpm backgroundremover:install" first.`);
    }
    return null;
  }

  const workDir = await mkdtemp(join(tmpdir(), "marinara-bgrem-"));
  const inputPath = join(workDir, "input.png");
  const outputPath = join(workDir, "output.png");

  try {
    mkdirSync(RUNTIME_DIR, { recursive: true });
    mkdirSync(MODEL_DIR, { recursive: true });
    writeFileSync(inputPath, input);

    const runBackgroundRemover = () =>
      execFileAsync(command.command, [...command.argsPrefix, "-i", inputPath, "-o", outputPath], {
        timeout: backgroundRemoverTimeoutMs(),
        maxBuffer: 1024 * 1024 * 8,
        windowsHide: true,
        env: backgroundRemoverEnv(),
      });

    try {
      await runBackgroundRemover();
    } catch (error) {
      if (!isCorruptedManagedModelError(error)) throw error;

      logger.warn(error, "backgroundremover model cache was corrupt; deleting managed cache and retrying once");
      clearManagedModelCache();
      rmSync(outputPath, { force: true });
      await runBackgroundRemover();
    }

    if (!existsSync(outputPath)) {
      throw new Error("backgroundremover did not write an output image");
    }

    return readFileSync(outputPath);
  } catch (error) {
    if (engine === "backgroundremover" || options.required) {
      throw error;
    }
    logger.warn(error, "backgroundremover failed; falling back to built-in sprite cleanup");
    return null;
  } finally {
    try {
      rmSync(inputPath, { force: true });
      rmSync(outputPath, { force: true });
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Best-effort temp cleanup.
    }
  }
}
