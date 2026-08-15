import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseOctoInvocation,
  handleOctoCommand,
  splitProbeSingleArgs,
  OCTO_COMMAND_NAME,
  OCTO_SUBCOMMANDS,
} from "../dist/commands.js";

test("OCTO_COMMAND_NAME is octo", () => {
  assert.equal(OCTO_COMMAND_NAME, "octo");
});

test("parseOctoInvocation splits subcommand from args", () => {
  assert.deepEqual(parseOctoInvocation("research API caching"), {
    subcommand: "research",
    args: "API caching",
  });
});

test("parseOctoInvocation trims leading whitespace", () => {
  assert.deepEqual(parseOctoInvocation("  council --goal decision 'x y'"), {
    subcommand: "council",
    args: "--goal decision 'x y'",
  });
});

test("parseOctoInvocation returns null for empty input", () => {
  assert.equal(parseOctoInvocation(""), null);
  assert.equal(parseOctoInvocation("   "), null);
});

test("parseOctoInvocation rejects unknown subcommands loudly", () => {
  assert.throws(() => parseOctoInvocation("not-a-real-subcommand foo"), /unknown octo subcommand/i);
});

test("OCTO_SUBCOMMANDS contains the core workflow commands", () => {
  for (const name of ["research", "develop", "embrace", "council", "debate", "doctor", "setup", "probe-single"]) {
    assert.ok(OCTO_SUBCOMMANDS.includes(name), `missing ${name}`);
  }
});

test("parseOctoInvocation accepts probe-single with hyphens", () => {
  assert.deepEqual(parseOctoInvocation("probe-single codex 'perspective' task-1"), {
    subcommand: "probe-single",
    args: "codex 'perspective' task-1",
  });
});

test("handleOctoCommand passes prompt-style subcommands as one arg", async () => {
  let dispatched;
  const ctx = {
    shell: {
      resolve: (request) => ({ ...request, workdir: request.workdir ?? process.cwd() }),
      run: async (spec) => {
        dispatched = spec;
        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          aborted: false,
          timeoutMs: 30000,
          stdout: { text: "done\n", truncated: false },
          stderr: { text: "", truncated: false },
        };
      },
    },
  };
  const result = await handleOctoCommand("research API caching", ctx, "/tmp");
  assert.equal(result.kind, "success");
  // Prompt subcommands must stay one argument (upstream joins with "$*").
  assert.match(dispatched.command, /'research' 'API caching'$/);
});

test("handleOctoCommand word-splits probe-single to keep positional arity", async () => {
  let dispatched;
  const ctx = {
    shell: {
      resolve: (request) => ({ ...request, workdir: request.workdir ?? process.cwd() }),
      run: async (spec) => {
        dispatched = spec;
        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          aborted: false,
          timeoutMs: 30000,
          stdout: { text: "result.md\n", truncated: false },
          stderr: { text: "", truncated: false },
        };
      },
    },
  };
  const result = await handleOctoCommand("probe-single codex perspective task-1", ctx, "/tmp");
  assert.equal(result.kind, "success");
  // probe-single reads $1/$2/$3 — agent_type, perspective, task_id must be
  // separate argv entries, not one collapsed string (upstream guard:
  // $# -lt 3 fails if collapsed).
  assert.match(
    dispatched.command,
    /'probe-single' 'codex' 'perspective' 'task-1'$/,
  );
});

test("splitProbeSingleArgs splits agent/perspective/task", () => {
  // ≥3 tokens: last = task id, middle rejoins as the perspective.
  assert.deepEqual(splitProbeSingleArgs("codex analyze the trade-offs task-42"), [
    "codex",
    "analyze the trade-offs",
    "task-42",
  ]);
  assert.deepEqual(splitProbeSingleArgs("agy short task-1"), ["agy", "short", "task-1"]);
  // Exactly 2 tokens: second is the perspective (no task id).
  assert.deepEqual(splitProbeSingleArgs("codex topic"), ["codex", "topic"]);
  // Single token: just the agent type.
  assert.deepEqual(splitProbeSingleArgs("codex"), ["codex"]);
});
