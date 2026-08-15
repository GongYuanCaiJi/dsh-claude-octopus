import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOctopusCommand,
  escapeShellArg,
  runOctopus,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_STDOUT_MAX_BYTES,
  OctopusTimeoutError,
  OctopusSandboxError,
  OctopusAbortedError,
  OctopusTruncatedError,
} from "../dist/shell.js";

/**
 * Build a non-identity ctx.shell stub. resolve() applies the same defaults the
 * real executor would (workdir/timeoutMs/stdoutMaxBytes), so run() must be
 * handed the resolved spec — a caller that feeds run() the raw request instead
 * is caught by the default-filling in the stubs below.
 */
function makeCtx(overrides = () => ({})) {
  return {
    shell: {
      resolve: (request) => ({
        command: request.command,
        workdir: request.workdir ?? process.cwd(),
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        stdoutMaxBytes: request.stdoutMaxBytes ?? DEFAULT_STDOUT_MAX_BYTES,
        signal: request.signal ?? undefined,
      }),
      run: async (spec) => ({
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: spec.timeoutMs,
        stdout: { text: "", truncated: false },
        stderr: { text: "", truncated: false },
        ...overrides(spec),
      }),
    },
  };
}

test("escapeShellArg quotes plain args", () => {
  assert.equal(escapeShellArg("probe-single"), "'probe-single'");
  assert.equal(escapeShellArg("a b"), "'a b'");
  assert.equal(escapeShellArg("it's"), "'it'\\''s'");
});

test("buildOctopusCommand joins the script with escaped args", () => {
  const cmd = buildOctopusCommand(["probe-single", "codex", "topic", "task-1"]);
  // The orchestrate.sh entry resolves relative to the built module.
  assert.match(cmd, /scripts\/orchestrate\.sh 'probe-single' 'codex' 'topic' 'task-1'$/);
  assert.ok(cmd.startsWith("/"), "orchestrate.sh path must be absolute");
});

test("runOctopus passes resolve output into run (non-identity stub)", async () => {
  // The stub must be non-identity: resolve() produces a spec with defaults,
  // and run() must receive THAT spec, not the raw request.
  let runReceived;
  const ctx = {
    shell: {
      resolve: (request) => ({
        command: request.command,
        workdir: request.workdir ?? process.cwd(),
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        stdoutMaxBytes: request.stdoutMaxBytes ?? DEFAULT_STDOUT_MAX_BYTES,
        signal: request.signal ?? undefined,
      }),
      run: async (spec) => {
        runReceived = spec;
        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          aborted: false,
          timeoutMs: spec.timeoutMs,
          stdout: { text: "result-file.md\n", truncated: false },
          stderr: { text: "", truncated: false },
        };
      },
    },
  };
  const result = await runOctopus(ctx, ["probe-single", "codex", "p", "t"], {
    cwd: "/tmp/x",
  });
  assert.deepEqual(result, { code: 0, stdout: "result-file.md\n" });
  assert.match(runReceived.command, /scripts\/orchestrate\.sh 'probe-single' 'codex' 'p' 't'$/);
  assert.equal(runReceived.workdir, "/tmp/x");
  assert.equal(runReceived.timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(runReceived.stdoutMaxBytes, DEFAULT_STDOUT_MAX_BYTES);
});

test("runOctopus maps null exitCode (signal death) to code -1", async () => {
  const ctx = makeCtx(() => ({
    exitCode: null,
    signal: "SIGKILL",
    stdout: { text: "", truncated: false },
  }));
  const result = await runOctopus(ctx, ["doctor"]);
  assert.deepEqual(result, { code: -1, stdout: "" });
});

test("runOctopus rejects with OctopusTimeoutError on timedOut (never silent success)", async () => {
  const ctx = makeCtx(() => ({
    exitCode: 0, // must not let a fake zero exit mask the timeout
    timedOut: true,
    timeoutMs: 5000,
    stdout: { text: "partial", truncated: false },
  }));
  await assert.rejects(
    () => runOctopus(ctx, ["research", "x"]),
    (err) => err instanceof OctopusTimeoutError && err.timeoutMs === 5000,
  );
});

test("runOctopus rejects with OctopusAbortedError on invocation.signal", async () => {
  const ctx = makeCtx(() => ({
    exitCode: null,
    signal: "SIGINT",
    aborted: true,
    stdout: { text: "", truncated: false },
  }));
  await assert.rejects(() => runOctopus(ctx, ["develop", "x"]), OctopusAbortedError);
});

test("runOctopus rejects with OctopusSandboxError on sandbox.denied", async () => {
  const ctx = makeCtx(() => ({
    stdout: { text: "", truncated: false },
    sandbox: { mode: "workspace-write", denied: true },
  }));
  await assert.rejects(() => runOctopus(ctx, ["setup"]), OctopusSandboxError);
});

test("runOctopus rejects with OctopusSandboxError on SandboxUnavailableError reject", async () => {
  const ctx = {
    shell: {
      resolve: (request) => ({ ...request, workdir: request.workdir ?? process.cwd() }),
      run: async () => {
        const err = new Error("sandbox runner unavailable");
        err.name = "SandboxUnavailableError";
        throw err;
      },
    },
  };
  await assert.rejects(() => runOctopus(ctx, ["setup"]), OctopusSandboxError);
});

test("runOctopus rejects with OctopusTruncatedError when stdout was truncated", async () => {
  const ctx = makeCtx(() => ({
    stdout: { text: "tail-only", truncated: true },
  }));
  await assert.rejects(() => runOctopus(ctx, ["doctor"]), OctopusTruncatedError);
});

test("runOctopus forwards the caller signal into the resolved spec", async () => {
  let resolvedSignal;
  const ctrl = new AbortController();
  const ctx = {
    shell: {
      resolve: (request) => {
        resolvedSignal = request.signal;
        return { ...request, workdir: request.workdir ?? process.cwd() };
      },
      run: async (spec) => ({
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: 30000,
        stdout: { text: "", truncated: false },
        stderr: { text: "", truncated: false },
      }),
    },
  };
  await runOctopus(ctx, ["doctor"], { signal: ctrl.signal });
  assert.equal(resolvedSignal, ctrl.signal);
});
