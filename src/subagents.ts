import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Context } from "@deepseek-ai/cordis";
import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { SessionId } from "@deepseek-ai/dsh-session";
import type {
  ResolvedSubagentStartRequest,
  SubagentProvider,
  SubagentResult,
  SubagentRun,
  SubagentStopReason,
} from "@deepseek-ai/dsh-subagent";
import { runOctopus } from "./shell.js";

/**
 * Provider name registered into `ctx.subagents`. dsh's built-in subagent
 * provider registry routes through this name; the octopus provider dispatches
 * each single-agent probe through the upstream `orchestrate.sh probe-single`
 * engine, so the multi-provider orchestration stays 100% upstream.
 */
export const OCTOPUS_PROVIDER_NAME = "octopus";

/**
 * Map a dsh `agentOptions.provider` route to an upstream octopus agent type.
 * dsh routes are harness-local (e.g. `deepseek-official`); octopus agent types
 * are provider CLIs (codex, agy, qwen, …). Unknown dsh routes fall back to the
 * octopus default so the probe still dispatches.
 */
const DEFAULT_AGENT_TYPE = "codex";

function agentTypeFor(request: ResolvedSubagentStartRequest): string {
  const provider = request.agentOptions?.provider;
  if (provider === undefined || provider === "") return DEFAULT_AGENT_TYPE;
  const lower = provider.toLowerCase();
  if (lower.startsWith("codex")) return "codex";
  if (lower.startsWith("agy") || lower.startsWith("gemini")) return "agy";
  if (lower.startsWith("qwen")) return "qwen";
  if (lower.startsWith("ollama")) return "ollama";
  if (lower.startsWith("perplexity")) return "perplexity";
  if (lower.startsWith("openrouter")) return "openrouter";
  if (lower.startsWith("deepseek")) return "openrouter-deepseek";
  return DEFAULT_AGENT_TYPE;
}

function textOf(content: readonly ContentBlock[]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/** Build the argv (after the subcommand) for one upstream `probe-single` dispatch. */
export function buildProbeSingleArgs(options: {
  readonly agentType: string;
  readonly perspective: string;
  readonly taskId: string;
}): string[] {
  return [options.agentType, options.perspective, options.taskId];
}

/** Read the result file the upstream probe writes (path printed on stdout). */
export function readProbeResult(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * The dsh `ctx.subagents` provider rewire: register this provider so dsh's
 * built-in subagent registry delegates to the octopus multi-provider engine.
 * One `start()` = one `orchestrate.sh probe-single` run; the result file the
 * engine writes becomes the child's final output.
 */
export function createOctopusSubagentProvider(ctx: Context): SubagentProvider {
  return {
    name: OCTOPUS_PROVIDER_NAME,
    capabilities: {
      outputSchema: false,
      depthLimit: false,
      toolFilter: false,
      persona: false,
    },
    inheritsParentContext: false,
    async start(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
      const agentType = agentTypeFor(request);
      const perspective = textOf(request.prompt);
      const taskId = `octo-${request.descriptor.label ?? "probe"}-${randomUUID().slice(0, 8)}`;
      // CLI-backed provider: mint a run id unique in the parent namespace (the
      // upstream engine has no dsh session to carry one).
      const runId = randomUUID() as SessionId;
      const cwd = request.parent.session?.header?.cwd;
      const resultPromise = runOctopus(
        ctx,
        ["probe-single", ...buildProbeSingleArgs({ agentType, perspective, taskId })],
        { cwd },
      ).then<SubagentResult>(async ({ code, stdout }) => {
        if (code !== 0) {
          return { output: [], stopReason: "error" as SubagentStopReason };
        }
        const resultPath = stdout.trim().split("\n").pop() ?? "";
        const text = resultPath === "" ? "" : readProbeResult(resultPath);
        return {
          output: text === "" ? [] : [{ type: "text", text }],
          stopReason: "completed" as SubagentStopReason,
        };
      });
      return {
        id: runId,
        localAgent: undefined,
        result: resultPromise,
        dispose: async () => {},
      };
    },
  };
}
