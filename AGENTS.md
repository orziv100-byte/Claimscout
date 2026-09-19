<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Crash / resource safety — highest priority

Continuously protect this machine from overload and crashes while working on Claim Scout.

If you detect any crash, freeze, severe slowdown, process failure, repeated restart, out-of-memory condition, or abnormal CPU/RAM/disk usage:

1. STOP all new work immediately.
2. Do not automatically restart the same failed task in a loop.
3. Inspect what caused the failure first.
4. Identify which process/task caused the problem and whether the cause is RAM exhaustion, CPU overload, disk/storage pressure, too many parallel processes/agents, a runaway process or infinite loop, an application/build error, or a network/service failure.
5. Fix the root cause before continuing.
6. If the machine cannot safely handle the number of simultaneous tasks, REDUCE CONCURRENCY and split the work into smaller sequential jobs.
7. Prefer one stable task at a time over many parallel tasks if resources are limited.
8. Never keep spawning/restarting processes that repeatedly fail.
9. Preserve completed work before stopping or restructuring tasks.
10. After recovery, verify system stability and then resume from the last safe point.

Stability has priority over speed. Do not allow Claim Scout, builds, scans, agents, or background jobs to overload or repeatedly crash this server.

Operational defaults for this repo:

- Check `free`, load average, disk, and process list before starting `next dev`, `next build`, live scans, or extra agents.
- Do not run `next dev` and `next build` at the same time.
- Do not spawn extra subagents or parallel scans when RAM available is under ~3 GiB or load average is high for this 4-core host.
- If a command OOMs, hangs, or restarts itself, stop and diagnose; never retry it in a loop.
- Live scans, Wayback CDX, and on-chain pool checks are serialized in-app (`lib/resource-guard.ts`, `/api/health`). Do not add unbounded `Promise.all` fan-out.
