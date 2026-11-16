# Lessons

## 2026-11-13 — Workflows can be cut off by a session ending
- The Sprint A workflow (3 developers + gates) was interrupted when the previous session ended; Dev-3 was mid-way and no completion record existed.
- Rule: keep each agent's final report in the repo (docs/qa/<sprint>/<agent>-report.json) as soon as it lands, so a continuation can be hand-authored without re-running finished agents. Resume by writing a short continuation workflow that lists what is already done, instead of resuming the original run with changed options (changed opts invalidate the cache and re-run finished work).
- This machine runs at most 2 workflow agents concurrently (CPU cap), so "3 developers in parallel" is really 2 + 1 queued. Plan phases and prompts for that.
- Custom agent types from .claude/agents were not available in the new session; use agentType general-purpose and embed the role rules in the prompt.

## 2026-11-13 — Route cross-owner findings to both owners
- Gate-1 finding F1 (Staff error messages not translatable) needed a change in Dev-2's action return type AND in Dev-3's consumer. Routing by file ownership sent it only to Dev-2; the re-gate then failed on the untouched consumer line.
- Rule: when a finding's fix changes an exported type or function signature, assign a companion finding to every file that consumes it (grep for the import) in the same fix round, or give one developer temporary ownership of both files.

## 2026-11-16 — Evidence scripts must not break the build
- QA wrote a .ts evidence script under docs/qa/; tsconfig's `**/*.ts` include picked it up and every developer's typecheck and next build failed in the fix round (all_checks_green false for all three).
- Rule: tsconfig now excludes docs/ and tasks/. Tell QA and security agents to write evidence scripts as .cjs (or under the scratchpad), and treat a failure that lives only in another agent's evidence file as that agent's finding, not a red build.
