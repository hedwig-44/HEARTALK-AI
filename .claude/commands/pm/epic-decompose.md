---
allowed-tools: Bash, Read, Write, LS, Task
---

# Epic Decompose

Break epic into concrete, actionable tasks with Epic-prefixed task IDs.

## Usage
```
/pm:epic-decompose <feature_name>
```

## Required Rules

**IMPORTANT:** Before executing this command, read and follow:
- `.claude/rules/datetime.md` - For getting real current date/time

## Preflight Checklist

Before proceeding, complete these validation steps.
Do not bother the user with preflight checks progress ("I'm not going to ..."). Just do them and move on.

1. **Verify epic exists:**
   - Check if `.claude/epics/$ARGUMENTS/epic.md` exists
   - If not found, tell user: "❌ Epic not found: $ARGUMENTS. First create it with: /pm:prd-parse $ARGUMENTS"
   - Stop execution if epic doesn't exist

2. **Check for existing tasks:**
   - Check if any Epic-prefixed task files (ABC001.md, ABC002.md, etc.) already exist in `.claude/epics/$ARGUMENTS/`
   - If tasks exist, list them and ask: "⚠️ Found {count} existing tasks. Delete and recreate all tasks? (yes/no)"
   - Only proceed with explicit 'yes' confirmation
   - If user says no, suggest: "View existing tasks with: /pm:epic-show $ARGUMENTS"

3. **Validate epic frontmatter:**
   - Verify epic has valid frontmatter with: name, status, created, prd
   - If invalid, tell user: "❌ Invalid epic frontmatter. Please check: .claude/epics/$ARGUMENTS/epic.md"

4. **Check epic status:**
   - If epic status is already "completed", warn user: "⚠️ Epic is marked as completed. Are you sure you want to decompose it again?"

## Instructions

You are decomposing an epic into specific, actionable tasks for: **$ARGUMENTS**

### 1. Read the Epic
- Load the epic from `.claude/epics/$ARGUMENTS/epic.md`
- Understand the technical approach and requirements
- Review the task breakdown preview
- Extract epic code from feature name:
```bash
# Generate epic code (max 3 chars, uppercase)
epic_code=$(echo "$ARGUMENTS" | sed 's/-/ /g' | awk '{
  result=""
  for(i=1; i<=NF && length(result)<3; i++) {
    result = result toupper(substr($i,1,1))
  }
  print result
}')
echo "Generated epic code: $epic_code"
```

### 2. Analyze for Parallel Creation

Determine if tasks can be created in parallel:
- If tasks are mostly independent: Create in parallel using Task agents
- If tasks have complex dependencies: Create sequentially
- For best results: Group independent tasks for parallel creation

### 3. Parallel Task Creation (When Possible)

If tasks can be created in parallel, spawn sub-agents:

```yaml
Task:
  description: "Create task files batch {X}"
  subagent_type: "general-purpose"
  prompt: |
    Create task files for epic: $ARGUMENTS

    Tasks to create:
    - {list of 3-4 tasks for this batch}

    For each task:
    1. Create file: .claude/epics/$ARGUMENTS/{epic_code}{number}.md (e.g., ABC001.md)
    2. Use the EXACT frontmatter format specified below
    3. Follow task breakdown from epic
    4. Set parallel/depends_on fields appropriately
    5. Number sequentially (ABC001.md, ABC002.md, etc.)

    REQUIRED FRONTMATTER FORMAT: Use the exact structure defined in section "4. Task File Format with Frontmatter" below. Do not deviate from this format.

    Return: List of files created
```

### 4. Task File Format with Frontmatter (AUTHORITATIVE TEMPLATE)
For each task, create a file with this exact structure (this is the single source of truth for frontmatter format during task creation):

```markdown
---
id: ABC001  # Epic code + 3-digit number (no quotes)
epic: login-page-redesign  # Epic name
title: "Task Title"  # Descriptive task title in quotes
status: open  # Initial status for new tasks
github_url: "[Will be updated when synced to GitHub]"
priority: medium  # high/medium/low
created: [Current ISO date/time]
updated: [Current ISO date/time]
assignee: unassigned
labels: []  # Array of relevant labels
dependencies: []  # Array of task IDs this depends on (e.g., [ABC001, ABC002])
depends_on: []  # Epic-prefixed task IDs that must complete before this can start
parallel: true  # Can this run alongside other tasks without conflicts
conflicts_with: []  # Epic-prefixed task IDs that modify the same files
estimated_hours: 0  # Estimated effort in hours
actual_hours: 0  # Actual time spent (starts at 0)
---

# Task: [Task Title]

## Description
Clear, concise description of what needs to be done

## Acceptance Criteria
- [ ] Specific criterion 1
- [ ] Specific criterion 2
- [ ] Specific criterion 3

## Technical Details
- Implementation approach
- Key considerations
- Code locations/files affected

## Dependencies
- [ ] Task/Issue dependencies
- [ ] External dependencies

## Effort Estimate
- Size: XS/S/M/L/XL
- Hours: estimated hours
- Parallel: true/false (can run in parallel with other tasks)

## Definition of Done
- [ ] Code implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Deployed to staging
```

### 5. Task Naming Convention
Save tasks as: `.claude/epics/$ARGUMENTS/{epic_code}{number}.md`
- Use Epic-prefixed numbering: ABC001.md, ABC002.md, etc.
- Keep task titles short but descriptive

### 6. Frontmatter Field Explanations
Additional context and validation rules for the above template:
- **id**: Epic code + 3-digit number (e.g., ABC001) without quotes
- **epic**: The epic name (e.g., login-page-redesign)
- **title**: Descriptive task title in quotes (without "Task:" prefix)
- **status**: Always start with "open" for new tasks
- **github_url**: Leave placeholder text - will be updated during sync
- **priority**: Set as high/medium/low based on task importance
- **created**: Get REAL current datetime by running: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
- **updated**: Use the same real datetime as created for new tasks
- **assignee**: Always start with "unassigned"
- **labels**: Array of relevant labels (e.g., [frontend, ui, api])
- **dependencies**: Array of Epic-prefixed task IDs this depends on (e.g., [ABC001, ABC002])
- **depends_on**: Array of Epic-prefixed task IDs that must complete before this can start (e.g., [ABC001, ABC002])
- **parallel**: Set to true if this can run alongside other tasks without conflicts
- **conflicts_with**: Array of Epic-prefixed task IDs that modify the same files (helps coordination)
- **estimated_hours**: Estimated effort in hours (numeric value)
- **actual_hours**: Always start with 0 for new tasks

### 7. Task Types to Consider
- **Setup tasks**: Environment, dependencies, scaffolding
- **Data tasks**: Models, schemas, migrations
- **API tasks**: Endpoints, services, integration
- **UI tasks**: Components, pages, styling
- **Testing tasks**: Unit tests, integration tests
- **Documentation tasks**: README, API docs
- **Deployment tasks**: CI/CD, infrastructure

### 8. Parallelization
Mark tasks with `parallel: true` if they can be worked on simultaneously without conflicts.

### 9. Execution Strategy

Choose based on task count and complexity:

**Small Epic (< 5 tasks)**: Create sequentially for simplicity

**Medium Epic (5-10 tasks)**:
- Batch into 2-3 groups
- Spawn agents for each batch
- Consolidate results

**Large Epic (> 10 tasks)**:
- Analyze dependencies first
- Group independent tasks
- Launch parallel agents (max 5 concurrent)
- Create dependent tasks after prerequisites

Example for parallel execution:
```markdown
Spawning 3 agents for parallel task creation:
- Agent 1: Creating tasks 001-003 (Database layer)
- Agent 2: Creating tasks 004-006 (API layer)
- Agent 3: Creating tasks 007-009 (UI layer)
```

### 10. Task Dependency Validation

When creating tasks with dependencies:
- Ensure referenced dependencies exist (e.g., if ABC003 depends on ABC002, verify ABC002 was created)
- Check for circular dependencies (ABC001 → ABC002 → ABC001)
- If dependency issues found, warn but continue: "⚠️ Task dependency warning: {details}"

### 11. Update Epic with Task Summary
After creating all tasks, update the epic file by adding this section:
```markdown
## Tasks Created
- [ ] ABC001.md - {Task Title} (parallel: true/false)
- [ ] ABC002.md - {Task Title} (parallel: true/false)
- etc.

Total tasks: {count}
Parallel tasks: {parallel_count}
Sequential tasks: {sequential_count}
Estimated total effort: {sum of hours}
```

Also update the epic's frontmatter progress if needed (still 0% until tasks actually start).

### 12. Quality Validation

Before finalizing tasks, verify:
- [ ] All tasks have clear acceptance criteria
- [ ] Task sizes are reasonable (1-3 days each)
- [ ] Dependencies are logical and achievable
- [ ] Parallel tasks don't conflict with each other
- [ ] Combined tasks cover all epic requirements

### 13. Post-Decomposition

After successfully creating tasks:
1. Confirm: "✅ Created {count} tasks for epic: $ARGUMENTS"
2. Show summary:
   - Total tasks created
   - Parallel vs sequential breakdown
   - Total estimated effort
3. Suggest next step: "Ready to sync to GitHub? Run: /pm:epic-sync $ARGUMENTS"

## Error Recovery

If any step fails:
- If task creation partially completes, list which tasks were created
- Provide option to clean up partial tasks
- Never leave the epic in an inconsistent state

Aim for tasks that can be completed in 1-3 days each. Break down larger tasks into smaller, manageable pieces for the "$ARGUMENTS" epic.
