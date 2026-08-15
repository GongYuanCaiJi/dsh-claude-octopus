import type { CommandResult } from "@deepseek-ai/dsh-commands";
import type { Context } from "@deepseek-ai/cordis";
import { runOctopus } from "./shell.js";

/**
 * Top-level subcommands accepted by the upstream `scripts/orchestrate.sh`
 * dispatch (extracted verbatim from its `case "$COMMAND"` block; aliases are
 * canonicalized to their primary name).
 */
export const OCTO_SUBCOMMANDS: readonly string[] = [
  "advise",
  "agent-resume",
  "agent-summary",
  "aggregate",
  "analytics",
  "audit",
  "auth",
  "auto",
  "clean",
  "code-review",
  "completion",
  "config",
  "configure",
  "consensus",
  "consult",
  "cost",
  "cost-archive",
  "cost-clear",
  "cost-csv",
  "cost-json",
  "council",
  "create-docs",
  "dark-factory",
  "debate",
  "define",
  "deliberate",
  "deliver",
  "deliver-docs",
  "detect-providers",
  "dev",
  "dev-mode",
  "develop",
  "discover",
  "doctor",
  "embrace",
  "embrace-gate",
  "empathize",
  "empathy",
  "export-docs",
  "factory",
  "fan-out",
  "fanout",
  "grapple",
  "grasp",
  "help",
  "init",
  "init-workflow",
  "ink",
  "iterate",
  "kill",
  "km",
  "knowledge",
  "knowledge-mode",
  "knowledge-toggle",
  "lit-review",
  "login",
  "logout",
  "map-reduce",
  "mapreduce",
  "octopus-configure",
  "optimise",
  "optimize",
  "parallel",
  "preferences",
  "preflight",
  "probe",
  "probe-single",
  "ralph",
  "red-team",
  "release",
  "research",
  "review",
  "sentinel",
  "setup",
  "skills",
  "spawn",
  "squeeze",
  "status",
  "strategy",
  "summary",
  "synthesis",
  "synthesize",
  "synthesize-probe",
  "tangle",
  "update-clis",
  "update-plugin",
  "usage",
  "ux-research",
  "verification-only",
  "verify",
];

export const OCTO_COMMAND_NAME = "octo";

export interface OctoInvocation {
  readonly subcommand: string;
  /** Everything after the subcommand, verbatim (may be empty). */
  readonly args: string;
}

/**
 * Parse a dsh command invocation: `/octo <subcommand> <args...>`.
 * The leading slash and command name are stripped by the dsh command layer,
 * so this receives the raw remainder. Returns null for blank input; throws
 * for an unknown subcommand so typos fail loud instead of reaching a shell.
 */
export function parseOctoInvocation(rawInput: string): OctoInvocation | null {
  const trimmed = rawInput.trim();
  if (trimmed === "") return null;
  const firstSpace = trimmed.search(/\s/);
  const subcommand =
    firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const args = firstSpace === -1 ? "" : trimmed.slice(firstSpace).trim();
  if (!OCTO_SUBCOMMANDS.includes(subcommand)) {
    throw new Error(`unknown octo subcommand: ${subcommand}`);
  }
  return { subcommand, args };
}

/**
 * Run one octo workflow through the upstream engine. The subcommand is
 * validated against the upstream dispatch before any shell call; the workflow
 * output is returned as the command result text.
 */
export async function handleOctoCommand(
  rawInput: string,
  ctx: Context,
  cwd: string,
): Promise<CommandResult> {
  const parsed = parseOctoInvocation(rawInput);
  if (parsed === null) {
    return {
      kind: "error",
      text: "Usage: /octo <subcommand> <args...>. Run /octo help for the command list.",
    };
  }
  const args = parsed.args === "" ? [] : [parsed.args];
  const result = await runOctopus(ctx, [parsed.subcommand, ...args], { cwd });
  if (result.code !== 0) {
    return { kind: "error", text: result.stdout };
  }
  return { kind: "success", text: result.stdout };
}
