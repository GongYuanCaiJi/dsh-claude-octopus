# 🐙 dsh-claude-octopus

简体中文 | [English](#english)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![DSH](https://img.shields.io/badge/DSH-DeepSeek%20Harness-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Version](https://img.shields.io/badge/Version-9.64.0-blue)](https://github.com/nyldn/claude-octopus)
[![上游](https://img.shields.io/badge/移植自-claude--octopus-orange.svg)](https://github.com/nyldn/claude-octopus)

> **一句话：一个 `/octo` 命令，让多个 AI 模型（Codex、Antigravity、Copilot、Qwen、Ollama、OpenRouter、Grok 等）一起研究、开发、评审、辩论，达成共识再交付。**

移植自 [`nyldn/claude-octopus`](https://github.com/nyldn/claude-octopus)（MIT，v9.64.0），
上游的编排引擎（`scripts/orchestrate.sh` 与全部 skills / commands / agents / hooks）逐字保留，
只适配 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件接缝。

## ✨ 功能

- 🐙 **多模型编排** —— Codex / Antigravity / Copilot / Qwen / Ollama / Perplexity / OpenRouter / OrcaRouter / OpenCode / Grok 十种外部 provider，外加宿主本身
- 🗳️ **共识门禁** —— 多模型意见分歧时用 75% 共识阈值挡在交付前
- 🧠 **跨会话记忆** —— 整合 claude-mem / agentmemory，决策与研究跨 session 存活
- ⚡ **Dark Factory** —— 给一份 spec，自动跑完 research → define → develop → deliver 全流程
- 🔄 **四阶段方法论** —— Discover → Define → Develop → Deliver，阶段之间有质量闸
- 👥 **32 个专业 persona + 54 条命令 + 63 个 skill** —— 显式工作流才激活，普通请求不受影响
- 🔌 **dsh 原生接缝** —— `/octo` 命令走 `ctx.shell`；多 agent 派发走 dsh 内建的 `ctx.subagents`（注册 `octopus` provider）

> 💬 `/octo debate`（AI Debate Hub）集成自 [wolverin0/claude-skills](https://github.com/wolverin0/claude-skills)（MIT），与上游一致保留署名。

## 📸 效果

```text
> /octo research "GraphQL vs REST 的设计权衡"

🐙 Octopus Research
  probe codex         → 并行探索（多 provider）
  probe agy           → 每个 provider 一个独立视角
  probe claude        → ...
  共识门禁 75%        → 分歧点显式列出
  → 结构化研究报告（executive summary / themes / takeaways / sources）
```

## 📦 安装

```bash
dsh plugin --profile <你的 profile> add github:GongYuanCaiJi/dsh-claude-octopus
```

安装时 `prepare` 会自动构建 `dist/`。若 pnpm 拦下构建步骤，把本包加进 profile 的
`pnpm-workspace.yaml` 的 `allowBuilds`。

从本地目录安装（需要先自行构建）：

```bash
git clone https://github.com/GongYuanCaiJi/dsh-claude-octopus.git
cd dsh-claude-octopus && npm install        # 触发 prepare，产出 dist/
dsh plugin --profile <你的 profile> add ../dsh-claude-octopus
```

> 本包尚未发布到 npm，所以不提供裸名安装。

> 已有访问权限时，四种 provider 不额外花钱：🧭 Antigravity CLI（`agy`）、Codex、Copilot
> 走既有订阅或本地认证，Ollama 本地免费跑。零外部 provider 也能用 —— 宿主本身就是一个座位。

## 🚀 用法

```text
/octo help                        # 全部子命令
/octo research "topic"            # 多 provider 并行研究
/octo develop "task"              # 带验证的实现
/octo council --goal decision "?" # 3/5/7 persona 结构化合议
/octo debate "question"           # 多模型辩论
/octo embrace "spec"              # 完整四阶段工作流
/octo doctor                      # 环境诊断
```

外部 provider CLI（codex、agy、qwen …）按需安装，`/octo doctor` 会告诉你缺什么。
零外部 provider 也能用 —— 宿主本身就是一个座位。

<details>
<summary>移植说明（对上游 <code>nyldn/claude-octopus@5d7ac6b6</code>）</summary>

**逐字保留**：`scripts/`、`commands/`、`skills/`、`agents/`、`hooks/`、`config/`、
`docs/`、`mcp-server/`、`openclaw/` 等全部 1174 个上游文件一字未改，`cmp` 可验
（[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) 钉住了上游 commit 与逐字文件 SHA-256）。

**新增的只有 dsh 接缝**（上游没有对应物）：
- `src/shell.ts` —— `ctx.shell` 转接层，显式处置 dsh 的 truncated / timedOut / sandbox.denied / invocation.signal 四个信号
- `src/commands.ts` —— `/octo <subcommand>` 命令，转发到 `scripts/orchestrate.sh`
- `src/subagents.ts` —— 向 `ctx.subagents` 注册 `octopus` provider，把 dsh 内建的 subagent 派发接到上游 `probe-single` 引擎
- `package.json` / `cordis.patch.yml` —— dsh 插件装载

**已知限制**：上游文案是英文 —— 那是上游原文，逐字保留未做翻译。
</details>

## 🛠 开发

```bash
npm install      # 触发 prepare，产出 dist/
npm test         # 构建 + adapter 单元测试 + 上游完整测试套件（smoke + unit）
```

上游测试套件里包含在临时 git 仓库中直接提交 `main` 的用例；若你的机器有
「禁止直推 main」类 git hook，`npm test` 已用 `GIT_CONFIG_COUNT` 环境变量把
`safetyfuse.allowStable` 只作用在测试进程内，不碰任何仓库配置。

## 📄 License

MIT。上游 [`nyldn/claude-octopus`](https://github.com/nyldn/claude-octopus)
`Copyright (c) 2026 nyldn`，本移植 `Copyright (c) 2026 GongYuanCaiJi (dsh port)`。
见 [LICENSE](./LICENSE)。

感谢 [nyldn](https://github.com/nyldn) 的原作 —— 如果这个插件对你有用，
**也请去给[上游仓库](https://github.com/nyldn/claude-octopus)点个 star**。

---

<a id="english"></a>

# Claude Octopus (dsh port)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![DSH](https://img.shields.io/badge/DSH-DeepSeek%20Harness-blue.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Version](https://img.shields.io/badge/Version-9.64.0-blue)](https://github.com/nyldn/claude-octopus)
[![Claude Code](https://img.shields.io/badge/Claude_Code-v2.1.14+_required-blueviolet)](https://code.claude.com/docs/en/overview)

Every AI model has blind spots. Claude Octopus supports ten external provider integrations — Codex, Antigravity CLI, Copilot, Qwen, Ollama, Perplexity, OpenRouter, OrcaRouter, OpenCode, and Grok — alongside the built-in Claude Code host, with consensus gates that flag disagreements before you ship.

Claude Code **v2.1.14+** is the minimum supported runtime; the plugin tracks 182 Claude Code capability flags through Claude Code v2.1.219.

> **One line: one `/octo` command, and multiple AI models (Codex, Antigravity, Copilot, Qwen, Ollama, OpenRouter, Grok, …) research, build, review and debate together — with a consensus gate before delivery.**

A port of [`nyldn/claude-octopus`](https://github.com/nyldn/claude-octopus) (MIT, v9.64.0) to
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). The upstream orchestration
engine (`scripts/orchestrate.sh` and every skill/command/agent/hook) is kept byte-identical;
only the dsh plugin seams are adapted.

## ✨ Features

- 🐙 **Multi-model orchestration** — Codex / Antigravity / Copilot / Qwen / Ollama / Perplexity / OpenRouter / OrcaRouter / OpenCode / Grok plus the host seat
- 🗳️ **Consensus gates** — a 75% consensus threshold flags disagreements before they ship
- 🧠 **Cross-session memory** — integrates [claude-mem](https://github.com/thedotmack/claude-mem) and [agentmemory](https://github.com/rohitg00/agentmemory)
- ⚡ **Dark Factory** — spec in, autonomous research → define → develop → deliver
- 🔄 **Four-phase methodology** — Discover → Define → Develop → Deliver with quality gates
- 👥 **32 personas, 54 commands, 63 skills** — explicit workflows only; ordinary requests stay untouched
- 🔌 **Native dsh seams** — `/octo` runs through `ctx.shell`; multi-agent dispatch registers an `octopus` provider into dsh's built-in `ctx.subagents`

> 💬 `/octo debate` (AI Debate Hub) integrates [wolverin0/claude-skills](https://github.com/wolverin0/claude-skills) (MIT), attribution kept identical to upstream.

## 📸 Demo

```text
> /octo research "GraphQL vs REST design trade-offs"

🐙 Octopus Research
  probe codex         → parallel exploration (multiple providers)
  probe agy           → one independent perspective per provider
  probe claude        → ...
  consensus gate 75%  → disagreements listed explicitly
  → structured research report (summary / themes / takeaways / sources)
```

## What's New

<!-- BEGIN CURRENT RELEASE -->
> 🆕 **v9.64.0 — Keep Octopus dormant until explicitly invoked.**
>
> **Default roster:** Claude Opus 5 leads architecture, planning, security reasoning, and final judgment; GPT-5.6 Sol is the independent implementation/review peer; Claude Sonnet 5 is the standard Claude seat; Fable 5 remains an opt-in judgment escalation. Existing model pins and provider configuration still win. See [the routing strategy](docs/MODEL-ROUTING-STRATEGY.md).
<!-- END CURRENT RELEASE -->

| Version | Best Features |
|---------|--------------|
| **v9.64.0** (new) | Keep Octopus dormant until explicitly invoked. |
| **v9.50** | Claude Code 2026 compatibility layer — routines manifest, SubagentStop gate, `/octo:usage` cost attribution, Claude Agent SDK seat. |
| **v9** | Up to 10 external provider integrations, structured provider debates, configurable multi-LLM councils. |

[Full changelog →](CHANGELOG.md)

<details>
<summary>Upgrading to 9.5x</summary>

<!-- BEGIN CURRENT MODEL DEFAULTS -->
- Current fresh configurations use **GPT-5.6 Sol** for Codex implementation/review, **Claude Opus 5** for premium Claude work, and **Claude Sonnet 5** for the standard Claude seat. Existing environment, session, and `providers.json` pins remain unchanged; `OCTOPUS_LEGACY_ROLES=1` restores the pre-frontier role mapping.
<!-- END CURRENT MODEL DEFAULTS -->
- Premium Claude role routing (architect, strategist, security-reviewer to Opus) landed in v9.29; restore the older mapping with `OCTOPUS_LEGACY_ROLES=1`.

</details>

## Claude Code Web and Remote Sessions

When an explicit Octopus workflow is running in a hosted, web, or remote-control
environment, set `OCTOPUS_REMOTE_SESSION=true` in that environment. Once a
workflow starts, `orchestrate.sh` also recognizes `CLAUDE_CODE_REMOTE=true` or
`CLAUDE_CODE_WEB=true` and applies unattended-safe runtime defaults: autonomy is
set to `autonomous`, provider smoke tests are skipped, and the statusline uses a
lightweight remote-safe display.

## Quickstart

```bash
dsh plugin --profile <your-profile> add github:GongYuanCaiJi/dsh-claude-octopus
# then, inside a dsh session:
/octo research "topic"
```

Four providers cost nothing extra when you already have access: 🧭 Antigravity CLI (`agy`),
Codex, and Copilot use existing subscriptions or local auth; Ollama runs locally for free.
Zero external providers works too — the host is a seat.

## 54 Commands That Matter Most

The full surface is `scripts/orchestrate.sh` (all subcommands under `/octo help`). The
workflows that matter most:

```text
/octo research "topic"            # multi-provider parallel research
/octo develop "task"              # implementation with validation
/octo embrace "spec"              # full four-phase workflow
/octo council --goal decision "?" # 3/5/7-persona structured deliberation
/octo debate "question"           # multi-model debate
/octo doctor                      # environment diagnostics
```

## How It Works

Octopus stays dormant until you explicitly run `/octo:*`. Each command dispatches through
the upstream `scripts/orchestrate.sh` engine, which probes the configured provider CLIs
with role-specific personas, applies quality gates between the Discover → Define →
Develop → Deliver phases, and synthesizes a consensus result. In dsh, the single-agent
probe is exposed as the `octopus` provider in `ctx.subagents`.

| Provider | Integration |
|----------|-------------|
| Codex | `codex` CLI |
| Antigravity | `agy` CLI |
| Copilot | GitHub Copilot CLI |
| Qwen | Qwen Code CLI |
| Ollama | local |
| Perplexity | API key |
| OpenRouter | API key |
| OrcaRouter | API key |
| OpenCode | OpenCode CLI |
| Grok | xAI API key |

## Cost & Provider Pricing

Four providers cost nothing extra when you already have access: 🧭 Antigravity CLI (`agy`),
Codex, and Copilot use existing subscriptions or local auth; Ollama runs locally for free.
Qwen now requires API-key or Coding-Plan auth.

- [OpenAI model pricing](https://developers.openai.com/api/docs/models/gpt-5.6-sol) — GPT-5.6 Sol on Codex implementation/review seats
- [Perplexity pricing](https://docs.perplexity.ai/docs/getting-started/pricing) — per-request fee applies
- Antigravity seats bill nothing extra beyond your existing plan
- Long-context and provider-specific rate rules apply per provider; `/octo:cost` reports usage attribution

## Documentation

- [`docs/`](./docs/) — full command reference, architecture, and workflows (upstream, verbatim)
- [`CLAUDE.md`](./CLAUDE.md) — the plugin's own development guide (upstream, verbatim)
- [Upstream docs](https://github.com/nyldn/claude-octopus/tree/main/docs)

## 📦 Install

```bash
dsh plugin --profile <your-profile> add github:GongYuanCaiJi/dsh-claude-octopus
```

The `prepare` script builds `dist/` during installation. If pnpm blocks the build
step, add this package to `allowBuilds` in the profile's `pnpm-workspace.yaml`.

From a local checkout (build it first):

```bash
git clone https://github.com/GongYuanCaiJi/dsh-claude-octopus.git
cd dsh-claude-octopus && npm install        # runs prepare, produces dist/
dsh plugin --profile <your-profile> add ../dsh-claude-octopus
```

> Not published to npm yet, so no bare-name install.

## 🚀 Usage

```text
/octo help                        # all subcommands
/octo research "topic"            # multi-provider parallel research
/octo develop "task"              # implementation with validation
/octo council --goal decision "?" # 3/5/7-persona structured deliberation
/octo debate "question"           # multi-model debate
/octo embrace "spec"              # full four-phase workflow
/octo doctor                      # environment diagnostics
```

Install external provider CLIs (codex, agy, qwen …) as needed; `/octo doctor` shows
what's missing.

<details>
<summary>Port notes (vs upstream <code>nyldn/claude-octopus@5d7ac6b6</code>)</summary>

**Kept verbatim**: all 1174 upstream files — `scripts/`, `commands/`, `skills/`,
`agents/`, `hooks/`, `config/`, `docs/`, `mcp-server/`, `openclaw/` — byte-identical,
verifiable with `cmp` ([THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) pins the
upstream commit and per-file SHA-256).

**Added (no upstream counterpart)**: the dsh seam layer —
`src/shell.ts` (`ctx.shell` adapter with explicit truncated/timedOut/sandbox.denied/
invocation.signal handling), `src/commands.ts` (`/octo` → `scripts/orchestrate.sh`),
`src/subagents.ts` (registers the `octopus` provider into `ctx.subagents`, wiring
dsh's built-in subagent dispatch to the upstream `probe-single` engine), and the
`package.json` / `cordis.patch.yml` plugin mounting.

**Known limitation**: upstream copy is English — it is the upstream original, kept
untranslated.
</details>

## 🛠 Development

```bash
npm install      # runs prepare, produces dist/
npm test         # build + adapter unit tests + full upstream suite (smoke + unit)
```

The upstream suite includes cases that commit directly to `main` inside disposable
temp repos; if your machine has a "no direct main commits" git hook, `npm test`
scopes `safetyfuse.allowStable` to the test process via `GIT_CONFIG_COUNT` without
touching any repository config.

## Attribution

- Upstream: [`nyldn/claude-octopus`](https://github.com/nyldn/claude-octopus) (MIT) — this is a port
- Debate skill: [wolverin0/claude-skills](https://github.com/wolverin0/claude-skills) (MIT)
- Memory integrations: [claude-mem](https://github.com/thedotmack/claude-mem), [agentmemory](https://github.com/rohitg00/agentmemory)

## Contributing

Upstream development happens at [`nyldn/claude-octopus`](https://github.com/nyldn/claude-octopus)
(see its [`CONTRIBUTING.md`](https://github.com/nyldn/claude-octopus/blob/main/docs/CONTRIBUTING.md)).
Port-specific changes are the dsh seam layer in [`src/`](./src/) and
[`test/`](./test/).

## 📄 License

MIT. Upstream [`nyldn/claude-octopus`](https://github.com/nyldn/claude-octopus)
`Copyright (c) 2026 nyldn`; this port `Copyright (c) 2026 GongYuanCaiJi (dsh port)`.
See [LICENSE](./LICENSE).

Thanks to [nyldn](https://github.com/nyldn) — if this plugin is useful to you,
**please also star the [upstream repository](https://github.com/nyldn/claude-octopus)**.
