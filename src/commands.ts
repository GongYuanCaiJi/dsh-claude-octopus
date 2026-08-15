import type { CommandResult } from "@deepseek-ai/dsh-commands";
import type { Context } from "@deepseek-ai/cordis";
import { runOctopus } from "./shell.js";

/**
 * Top-level subcommands accepted by the upstream `scripts/orchestrate.sh`
 * dispatch (extracted from its `case "$COMMAND"` block). Alias groups are
 * listed under every name the upstream accepts (e.g. both `optimize` and
 * `optimise`), so the validation below matches what the engine itself
 * dispatches.
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
 *
 * Most subcommands take one prompt-style argument (the upstream handlers join
 * with `"$*"`), so the remainder is passed as a single shell-quoted arg.
 * `probe-single` is the exception: the upstream handler reads positional
 * `$1/$2/$3/$4` with the perspective as ONE argument, so the remainder is
 * split at the first two whitespace runs to keep that arity intact without
 * breaking quoted perspectives.
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
  const args =
    parsed.subcommand === "probe-single" && parsed.args !== ""
      ? splitProbeSingleArgs(parsed.args)
      : parsed.args === ""
        ? []
        : [parsed.args];
  const result = await runOctopus(ctx, [parsed.subcommand, ...args], { cwd });
  if (result.code !== 0) {
    return { kind: "error", text: result.stdout };
  }
  return { kind: "success", text: result.stdout };
}

/**
 * Split `probe-single`'s remainder into `<agent_type> <perspective> [task_id]`
 * (upstream positional order: $1=agent_type, $2=perspective, $3=task_id).
 * The line is word-split: with ≥3 tokens the last is task_id and the middle
 * tokens rejoin as the perspective; with 2 tokens the second is the
 * perspective. Perspectives containing spaces are passed as ONE argv by the
 * provider path (buildProbeSingleArgs); through the command line, quote-free
 * input can only carry a single-token perspective (or a trailing task id).
 */
export function splitProbeSingleArgs(args: string): string[] {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return tokens;
  if (tokens.length === 2) return tokens;
  return [tokens[0], tokens.slice(1, -1).join(" "), tokens[tokens.length - 1]];
}
