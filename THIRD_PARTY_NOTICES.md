# Third-party notices

## claude-octopus

This package is a port of [`nyldn/claude-octopus`](https://github.com/nyldn/claude-octopus).
The upstream source is used under the MIT License.

| | |
|---|---|
| Package | `@anthropic-plugins/claude-octopus` v9.64.0（未發布到 npm，來源是 git repo） |
| Repository | <https://github.com/nyldn/claude-octopus> |
| Author | nyldn |
| License | MIT |
| Pinned commit | `5d7ac6b6`（2026-08-14，`v9.64.0-4-g5d7ac6b6`） |
| Archive SHA-256 | `b69b92737da1a855d708704afd686536ed0a981c74cf58256c7ce22cb73215f2`（`git archive` of the pinned commit） |

### Verifying the verbatim claim yourself

The README states that the plugin content is a verbatim copy of upstream. You do
not have to take that on trust — fetch the pinned commit and compare:

```bash
git clone https://github.com/nyldn/claude-octopus.git /tmp/upstream
git -C /tmp/upstream checkout 5d7ac6b60d2911f5a04a20432427f7f1f326da6c
git -C /tmp/upstream archive 5d7ac6b60d2911f5a04a20432427f7f1f326da6c | shasum -a 256
# expect: b69b92737da1a855d708704afd686536ed0a981c74cf58256c7ce22cb73215f2
```

Expected SHA-256 of key verbatim files (compare against this repo):

```
5ab959cc0b176c5976d1c5a488a7f438c51eab0b55942fe971d891bbf6aba758  scripts/orchestrate.sh
6215cd2012d868c76c583aed6a049098123cda63e8c60c8c17632ffd210f4065  package.json  (upstream original)
adaf16712bd20c76cb7de6bca422efa5f4eadcb6196184ed06c20f13ddcdbcf3  Makefile
1b71d3c0931a290304de5d318ed75e2bda0bb26975e6ed3417ac0fd41da19508  .claude-plugin/plugin.json
346f620daf437b05e615039909e5888165c4514dba6c75f3ab394aa56e3ecba9  commands/research.md
```

Every upstream file is copied byte-identical. This repo's own files — the dsh seam
(`src/`、`test/`、`dist/`、`cordis.patch.yml`、`tsconfig.json`) and the port's
`package.json`（改名 `dsh-claude-octopus`）、`README.md`、`LICENSE`、
`THIRD_PARTY_NOTICES.md`、`.gitignore` — have no upstream counterpart.

### Port-adapted upstream files

Two upstream files are adapted from byte-identical, for reasons the playbook
requires documenting:

- `tests/unit/test-github-work-queue-hook.sh` — the hook under test only fires
  when the checkout's git remote matches the upstream repo (it is a maintainer
  tool for `nyldn/claude-octopus`). On a port checkout that remote never
  matches, so the test registers a temporary `octo-test-upstream` remote for
  the duration of its two hook executions and removes it after. The hook
  itself (`hooks/github-work-queue-watch.sh`) is byte-identical.
- `README.md` — replaced by the port's own bilingual README (per
  cn-repo-conventions). The upstream test suite asserts that the README
  documents upstream's product facts (version badge, section headings,
  command/skill/persona counts, agentmemory/agy mentions); the port README
  carries those facts so the suite stays intact.

Diff either file against the pinned upstream commit to see the exact changes:

```bash
git -C /tmp/upstream diff 5d7ac6b6 -- tests/unit/test-github-work-queue-hook.sh
```
