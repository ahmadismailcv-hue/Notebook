# session-dash

A side pane with live stats for the current Claude Code session: elapsed time, prompts sent, tool calls grouped by tool with call count, average duration and failures, files changed, and the most recent calls with their status. Opens on session start. Run `/session-dash` to reopen it, or `/session-dash reset` to clear the counters.

## Suggested skills

After each finished main-thread turn that followed a new prompt, the pane asks a side fork of the session's own transcript which of the available skills fit what you are doing now, and lists up to three. Press one (or its number key while the pane has focus) to put `/<skill> ` in the prompt. `r` or Refresh asks again. `/session-dash skills off` stops the automatic runs; `/session-dash skills on` restarts them. Each run is billed to the session; the pane shows an estimated running token count.
