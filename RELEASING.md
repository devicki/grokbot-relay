# Releasing

`VERSION` is one line, `X.Y.Z`. `CHANGELOG.md` has a `## X.Y.Z` section with the notes. A release is an annotated git tag `vX.Y.Z` on the commit that contains that version, plus a GitHub Release whose body is that CHANGELOG section.

`./bin/release` is the maintainer command. It is not a `grokbot-relay` service subcommand. The server copy under `/opt` is not a git checkout; run it from the source clone.

```bash
./bin/release            # dry run: tag, notes, commands
./bin/release --apply    # create the annotated tag, push it, gh release create
```

`--apply` requires a clean tree and a `HEAD` that is already on `origin/main`. It refuses when `vX.Y.Z` already exists locally or on origin. It does not force-update tags.

## After this change is on main

```bash
git checkout main
git pull
# VERSION must be 0.8.2
./bin/release
./bin/release --apply
```

The same steps without the script, notes copied from the `## 0.8.2` section of `CHANGELOG.md` (do not rewrite them):

```bash
git tag -a v0.8.2 -m "grokbot-relay 0.8.2"
git push origin refs/tags/v0.8.2
gh release create v0.8.2 --title "grokbot-relay 0.8.2" --notes-file notes-0.8.2.md
```

Do not tag the pull-request branch. A squash merge produces a new commit, and the tag cannot be moved afterwards.

## Older versions

This history had no tags. Versions `0.1.0`–`0.3.0` are not separate `VERSION` commits (`VERSION` starts at `0.4.0`; `55e61bb` is the `0.3.0` subject and has no `VERSION` file). Do not invent notes for them.

Optional backfill, one tag per row, only if that tag does not already exist. Point the tag at the commit below. Notes are the matching `CHANGELOG.md` section. For `0.8.1`, use `642f9ad` (the last commit still at `0.8.1`, including the ja/zh-TW docs), not the earlier bump commit.

| Version | Commit |
| --- | --- |
| 0.4.0 | `7d22d8e` |
| 0.5.0 | `819f926` |
| 0.5.1 | `35de17e` |
| 0.5.2 | `96e22da` |
| 0.6.0 | `3505d00` |
| 0.7.0 | `f6262cd` |
| 0.7.1 | `2e72b46` |
| 0.7.2 | `c43d556` |
| 0.7.3 | `d6d3c60` |
| 0.7.4 | `74e1d84` |
| 0.7.5 | `d8670ff` |
| 0.7.6 | `8655021` |
| 0.7.7 | `0a71ef9` |
| 0.7.8 | `67d9f73` |
| 0.7.9 | `a1fc590` |
| 0.8.0 | `c6c5a65` |
| 0.8.1 | `642f9ad` |

Example for the current tip before this release:

```bash
git tag -a v0.8.1 642f9ad -m "grokbot-relay 0.8.1"
git push origin refs/tags/v0.8.1
gh release create v0.8.1 --target 642f9ad --title "grokbot-relay 0.8.1" --notes-file notes-0.8.1.md
```

Repeat with the table. Skip any tag that already exists. Never pass `--force` to `git tag` or `git push`.

## v1 line (not released by this file's script)

Root `VERSION` is the v0 line. `./bin/release` reads only that file and the matching `## X.Y.Z` section of `CHANGELOG.md`. Do not put `1.0.0` in the root file to publish v1: that would make `./bin/release` tag the whole repo as `v1.0.0` and would stop naming the v0 line.

v1's number is `relay-v1/VERSION`. It is `1.0.0` as the proposed first release and does not create the tag. The note is the `### v1 line` part of `## 0.8.3` in `CHANGELOG.md`. `./bin/release` publishes root `VERSION` (`0.8.3` for the ceiling release) as `v0.8.3` and does not create `v1.0.0`.

After a server trial of `relay-v1/` (`whoami`, then an allowlisted `grokbot__ask` against a bot that already exists) succeeds, cut the tag by hand from the commit whose `relay-v1/VERSION` is `1.0.0`:

```bash
git tag -a v1.0.0 -m "grokbot-relay 1.0.0"
git push origin refs/tags/v1.0.0
gh release create v1.0.0 --title "grokbot-relay 1.0.0" --notes-file notes-1.0.0.md
```

Do that on `main` after the v1 commit is merged. Do not tag the pull-request branch. Do not move `v0.8.2` or any older tag. Never pass `--force`.

Installers check out an explicit tag. `v0.8.x` is the `relay/` tree on `@cursor/bdk@0.2.28`. `v1.0.0` will be the `relay-v1/` tree on `@grok/agent-sdk@0.3.x`. Neither line tracks npm `latest`. `bin/grokbot-relay` keeps installing `relay/` until a later change teaches it the second directory.
