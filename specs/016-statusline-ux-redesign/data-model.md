# Data Model: Statusline Segments

## Line 1: Repository Context
- folder: string (repo name)
- remote: string (origin URL)
- branch: string (current branch name)
- divergence: {ahead: number, behind: number}
- modified: number (count)
- added: number (count)
- conflicts: boolean
- pr: {number, state: "passed"|"failed"|"running"|"unknown"}

## Line 2: Activity & Skills
- activity: "working" | "idle"
- shellCount: number
- agentCount: number
- agents: Array<{id, name, skills: string[]}>
- skillsTotal: number
- skillsHidden: number

## Line 3: Harness
- model: string (e.g., "Opus 5")
- contextUsed: string (e.g., "1H")
- effortLevel: "low" | "medium" | "high" | "max"
- featureId: string (from Spec Kit)
- taskProgress: {done: number, total: number}

## Line 4: Tokens
- sessionDuration: string (e.g., "1h52m")
- sessionLimit: string (e.g., "1d")
- rtkSavings: number (percentage)
- contextPercent: number (%)
- ratePercent: number (%)
- rateReset: string (time)
