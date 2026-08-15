import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOctoInvocation, OCTO_COMMAND_NAME, OCTO_SUBCOMMANDS } from "../dist/commands.js";

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
