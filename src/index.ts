import type { Context } from "@deepseek-ai/cordis";
// Declaration merge only: makes `ctx.commands` / `ctx.shell` / `ctx.subagents` visible.
import type {} from "@deepseek-ai/dsh-commands";
import type {} from "@deepseek-ai/dsh-shell";
import type {} from "@deepseek-ai/dsh-subagent";
import { OCTO_COMMAND_NAME, handleOctoCommand } from "./commands.js";
import { createOctopusSubagentProvider } from "./subagents.js";

export const name = "dsh-claude-octopus";
export const inject = ["commands", "shell", "subagents"] as const;

export function apply(ctx: Context): void {
  // `/octo <subcommand> <args...>` → upstream orchestrate.sh, via ctx.shell.
  ctx.commands.register({
    name: OCTO_COMMAND_NAME,
    description:
      "Multi-AI orchestration (port of claude-octopus): research, develop, council, debate, embrace, …",
    input: { hint: "<subcommand> <args...>" },
    handler: async (invocation) => {
      const cwd = invocation.agent.session.header.cwd ?? process.cwd();
      return handleOctoCommand(invocation.rawInput, ctx, cwd);
    },
  });

  // Rewire `ctx.subagents`: dsh has a built-in subagent provider registry;
  // register the octopus provider so dsh-native subagent delegation dispatches
  // through the upstream multi-provider engine.
  ctx.subagents.registerProvider(createOctopusSubagentProvider(ctx));
}
