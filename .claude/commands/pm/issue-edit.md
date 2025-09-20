---
allowed-tools: Bash, Read, Write, LS
---

# Issue Edit

Edit issue details locally and on GitHub.

## Usage
```
/pm:issue-edit <task_id>
```

## Instructions

### 1. Get Current Issue State

```bash
# Find task file
task_file=$(find .claude/epics -name "$ARGUMENTS.md" -not -path "*/.archived/*" 2>/dev/null | head -1)
[ -z "$task_file" ] && echo "❌ No task file found for $ARGUMENTS" && exit 1

# Extract GitHub issue number from task file
issue_number=$(grep "^github_url:" "$task_file" 2>/dev/null | grep -o '[0-9]*$')
[ -z "$issue_number" ] && echo "❌ No GitHub issue found for $ARGUMENTS. Run /pm:epic-sync first." && exit 1

# Get from GitHub
gh issue view $issue_number --json title,body,labels
```

### 2. Interactive Edit

Ask user what to edit:
- Title
- Description/Body
- Labels
- Acceptance criteria (local only)
- Priority/Size (local only)

### 3. Update Local File

Get current datetime: `date -u +"%Y-%m-%dT%H:%M:%SZ"`

Update task file with changes:
- Update frontmatter `name` if title changed
- Update body content if description changed
- Update `updated` field with current datetime

### 4. Update GitHub

If title changed:
```bash
gh issue edit $issue_number --title "{new_title}"
```

If body changed:
```bash
gh issue edit $issue_number --body-file {updated_task_file}
```

If labels changed:
```bash
gh issue edit $issue_number --add-label "{new_labels}"
gh issue edit $issue_number --remove-label "{removed_labels}"
```

### 5. Output

```
✅ Updated issue #$ARGUMENTS
  Changes:
    {list_of_changes_made}
  
Synced to GitHub: ✅
```

## Important Notes

Always update local first, then GitHub.
Preserve frontmatter fields not being edited.
Follow `/rules/frontmatter-operations.md`.