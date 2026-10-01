/**
 * Which coding agent is running the bar (specs/029-multi-harness).
 *
 * GitHub Copilot CLI runs a status line command the way Claude Code does,
 * with its own payload. Its loader exports `COPILOT_CLI_BINARY_VERSION` to the
 * command, and its payload alone carries `ai_used`; either is enough. The
 * Copilot-only chips (premium requests, allow-all) do not need this: they
 * show whenever their fields are present. Anything else is Claude Code.
 */
export function detectHarness(payload, env = process.env) {
  if (env?.COPILOT_CLI_BINARY_VERSION) return "copilot";
  if (payload && typeof payload === "object" && "ai_used" in payload) return "copilot";
  return "claude";
}
