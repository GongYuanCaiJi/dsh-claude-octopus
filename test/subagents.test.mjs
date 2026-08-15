import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createOctopusSubagentProvider,
  OCTOPUS_PROVIDER_NAME,
  buildProbeSingleArgs,
  readProbeResult,
} from "../dist/subagents.js";

test("OCTOPUS_PROVIDER_NAME is octopus", () => {
  assert.equal(OCTOPUS_PROVIDER_NAME, "octopus");
});

test("provider advertises the octopus name and conservative capabilities", () => {
  const provider = createOctopusSubagentProvider({ shell: { resolve() {}, run() {} } });
  assert.equal(provider.name, "octopus");
  assert.deepEqual(provider.capabilities, {
    outputSchema: false,
    depthLimit: false,
    toolFilter: false,
    persona: false,
  });
  assert.equal(provider.inheritsParentContext, false);
});

test("buildProbeSingleArgs maps agent_type/perspective/task_id to orchestrate argv", () => {
  const args = buildProbeSingleArgs({
    agentType: "codex",
    perspective: "analyze the trade-offs",
    taskId: "task-42",
  });
  assert.deepEqual(args, ["codex", "analyze the trade-offs", "task-42"]);
});

test("readProbeResult returns the file content", () => {
  const dir = mkdtempSync(join(tmpdir(), "octo-probe-"));
  try {
    const f = join(dir, "codex-task-42.md");
    writeFileSync(f, "# Agent: codex\n\n## Output\n\nhello\n");
    assert.equal(readProbeResult(f), "# Agent: codex\n\n## Output\n\nhello\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("provider start dispatches probe-single and returns the result text", async () => {
  const dir = mkdtempSync(join(tmpdir(), "octo-provider-"));
  try {
    const resultFile = join(dir, "codex-task-42.md");
    writeFileSync(resultFile, "# Agent: codex\n\n## Output\n\nanalysis result\n");
    let dispatched;
    const ctx = {
      shell: {
        resolve: (request) => ({ ...request, workdir: request.workdir ?? process.cwd() }),
        run: async (spec) => {
          dispatched = spec;
          // orchestrate.sh probe-single prints the result file path on stdout
          return {
            exitCode: 0,
            signal: null,
            timedOut: false,
            aborted: false,
            timeoutMs: 30000,
            stdout: { text: `${resultFile}\n`, truncated: false },
            stderr: { text: "", truncated: false },
          };
        },
      },
    };
    const provider = createOctopusSubagentProvider(ctx);
    const run = await provider.start({
      prompt: [{ type: "text", text: "analyze the trade-offs" }],
      parent: { session: { header: { cwd: "/tmp" } } },
      signal: new AbortController().signal,
      agentOptions: { provider: "codex", model: "gpt-5" },
      descriptor: { id: "task-42", provider: "octopus", label: "octo-probe", createdAt: 0 },
    });
    assert.ok(dispatched, "provider must dispatch through ctx.shell");
    assert.match(
      dispatched.command,
      /orchestrate\.sh 'probe-single' 'codex' 'analyze the trade-offs' 'octo-[^']+'/,
    );
    const result = await run.result;
    assert.equal(result.stopReason, "completed");
    assert.equal(result.output[0].type, "text");
    assert.match(result.output[0].text, /analysis result/);
    await run.dispose();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("provider start maps nonzero exit to stopReason error", async () => {
  const ctx = {
    shell: {
      resolve: (request) => ({ ...request, workdir: request.workdir ?? process.cwd() }),
      run: async () => ({
        exitCode: 3,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: 30000,
        stdout: { text: "orchestrate.sh: Unknown command: nope\n", truncated: false },
        stderr: { text: "", truncated: false },
      }),
    },
  };
  const provider = createOctopusSubagentProvider(ctx);
  const run = await provider.start({
    prompt: [{ type: "text", text: "x" }],
    parent: { session: { header: { cwd: "/tmp" } } },
    signal: new AbortController().signal,
    descriptor: { id: "task-1", provider: "octopus", label: "octo-probe", createdAt: 0 },
  });
  const result = await run.result;
  assert.equal(result.stopReason, "error");
  await run.dispose();
});

test("provider sandbox denial rejects run.result (loud, not a silent empty result)", async () => {
  const ctx = {
    shell: {
      resolve: (request) => ({ ...request, workdir: request.workdir ?? process.cwd() }),
      run: async () => ({
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: 30000,
        stdout: { text: "", truncated: false },
        stderr: { text: "", truncated: false },
        sandbox: { mode: "workspace-write", denied: true },
      }),
    },
  };
  const provider = createOctopusSubagentProvider(ctx);
  const run = await provider.start({
    prompt: [{ type: "text", text: "x" }],
    parent: { session: { header: { cwd: "/tmp" } } },
    signal: new AbortController().signal,
    descriptor: { id: "task-1", provider: "octopus", label: "octo-probe", createdAt: 0 },
  });
  // `start` resolves with the run (contract); the sandbox fault must surface
  // through the run's result, not be swallowed into an empty success.
  await assert.rejects(() => run.result);
  await run.dispose();
});
