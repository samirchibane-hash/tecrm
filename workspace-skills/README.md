# Workspace skills (Meta Ads Launcher)

Claude Code skills for the Treat Engine ad-ops workspace (the folder that contains this `crm/` repo). They live here so
they're version-controlled in `tecrm`; the workspace's `.claude/skills/<name>` are symlinks to these folders, so Claude
Code loads them as `/perf-report` and `/video-ad` when working from the workspace root.

| Skill | What it does |
|---|---|
| `perf-report/` | Portfolio performance report + execution loop: Meta + funnel + GHL data, structure audit, CMO-level Claude Doc with a tab per client, then executes approved actions and updates the report the same turn |
| `video-ad/` | Animated Meta video ads (4:5 feed, 9:16 Story) rendered with Remotion in `../animations/` from each client's approved Figma design |

They reference workspace paths outside this repo (`../execution/`, `../directives/`, `../animations/`, `../clients/`).
Nothing here is part of the CRM app build.
