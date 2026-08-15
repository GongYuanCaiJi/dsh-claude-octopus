import type { Context } from "@deepseek-ai/cordis";
// Declaration merge only: makes `ctx.shell` visible.
import type {} from "@deepseek-ai/dsh-shell";
import { fileURLToPath } from "node:url";

export interface OctopusResult {
  readonly code: number;
  readonly stdout: string;
}

/** Default per-run timeout: octopus workflows are long; 10 min covers them. */
export const DEFAULT_TIMEOUT_MS = 10 * 60_000;
/** Large stdout budget: result transcripts and workflow logs fit comfortably. */
export const DEFAULT_STDOUT_MAX_BYTES = 50_000_000;

/** The upstream orchestrate.sh entry, resolved relative to this package. */
const ORCHESTRATE_SCRIPT = fileURLToPath(new URL("../scripts/orchestrate.sh", import.meta.url));

export function escapeShellArg(arg: string): string {
  return `'${arg.replaceAll("'", `'\\''`)}'`;
}

export function buildOctopusCommand(args: readonly string[]): string {
  return [ORCHESTRATE_SCRIPT, ...args.map(escapeShellArg)].join(" ");
}

/**
 * Timeout was the first cause to cut the run short. Distinct from a nonzero
 * exit: a timed-out run may carry a zero exit code, and treating it as
 * "no changes" would silently hide incomplete work.
 */
export class OctopusTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`octopus run timed out after ${timeoutMs}ms`);
    this.name = "OctopusTimeoutError";
  }
}

/** The caller's AbortSignal cut the run short (invocation.signal). */
export class OctopusAbortedError extends Error {
  constructor(readonly signalName: string | null) {
    super(`octopus run aborted${signalName ? ` by ${signalName}` : ""}`);
    this.name = "OctopusAbortedError";
  }
}

/** The sandbox denied the run, or no sandbox runner was available. */
export class OctopusSandboxError extends Error {
  constructor(reason: string) {
    super(`octopus run denied by the sandbox: ${reason}`);
    this.name = "OctopusSandboxError";
  }
}

/**
 * stdout was truncated: the retained text is the TAIL of the stream, so line
 * numbers and file lists derived from it would be wrong. Fail loud instead of
 * letting a caller misparse partial output as complete.
 */
export class OctopusTruncatedError extends Error {
  constructor() {
    super("octopus stdout was truncated; refusing to treat partial output as complete");
    this.name = "OctopusTruncatedError";
  }
}

function isSandboxUnavailable(err: unknown): boolean {
  return err instanceof Error && err.name === "SandboxUnavailableError";
}

/**
 * dsh shell seam adapter: `runOctopus(ctx, [subcommand, ...args], { cwd }) → { code, stdout }`.
 *
 * Maps the upstream `scripts/orchestrate.sh <subcommand> <args>` surface onto
 * dsh's `ctx.shell.resolve({ command, workdir, timeoutMs, stdoutMaxBytes }) +
 * run(spec)` seam. The dsh shell reports four signals beyond exitCode/stdout;
 * each gets an explicit disposition (playbook: 忽略它們會靜默出錯):
 *
 * - `stdout.truncated`  → OctopusTruncatedError (tail-only output misparses)
 * - `timedOut`          → OctopusTimeoutError (never a silent "no changes")
 * - `sandbox.denied` / `SandboxUnavailableError` reject → OctopusSandboxError
 * - `invocation.signal` → OctopusAbortedError (user cancelled; no follow-up)
 */
export async function runOctopus(
  ctx: Context,
  args: readonly string[],
  options: { readonly cwd?: string } = {},
): Promise<OctopusResult> {
  const spec = ctx.shell.resolve({
    command: buildOctopusCommand(args),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    stdoutMaxBytes: DEFAULT_STDOUT_MAX_BYTES,
    workdir: options.cwd,
  });
  let result;
  try {
    result = await ctx.shell.run(spec);
  } catch (err) {
    if (isSandboxUnavailable(err)) {
      throw new OctopusSandboxError("no sandbox runner available");
    }
    throw err;
  }
  if (result.timedOut) {
    throw new OctopusTimeoutError(result.timeoutMs);
  }
  if (result.aborted) {
    throw new OctopusAbortedError(result.signal);
  }
  if (result.sandbox?.denied) {
    throw new OctopusSandboxError(`mode=${result.sandbox.mode}`);
  }
  if (result.stdout.truncated) {
    throw new OctopusTruncatedError();
  }
  // exitCode is null when the process died from a signal; upstream code is
  // always a number, so map null to a non-zero code (failure).
  return { code: result.exitCode ?? -1, stdout: result.stdout.text };
}
