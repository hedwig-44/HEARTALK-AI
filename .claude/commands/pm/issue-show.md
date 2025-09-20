---
allowed-tools: Bash, Read, LS
---

# Issue Show

Display issue and sub-issues with detailed information.

## Usage
```
/pm:issue-show <task_id>
```

## Instructions

You are displaying comprehensive information about a GitHub issue and related sub-issues for: **Issue #$ARGUMENTS**

### 1. Fetch Issue Data
```bash
# Find task file
task_file=$(find .claude/epics -name "$ARGUMENTS.md" -not -path "*/.archived/*" 2>/dev/null | head -1)
[ -z "$task_file" ] && echo "❌ No task file found for $ARGUMENTS" && exit 1

# Extract GitHub issue number from task file
issue_number=$(grep "^github_url:" "$task_file" 2>/dev/null | grep -o '[0-9]*$')
[ -z "$issue_number" ] && echo "❌ No GitHub issue found for $ARGUMENTS. Run /pm:epic-sync first." && exit 1
gh issue view $issue_number --json title,body,labels,state,assignees
```
- Check for related issues and sub-tasks

### 2. Issue Overview
Display issue header:
```
🎫 Issue #$ARGUMENTS: {Issue Title}
   Status: {open/closed}
   Labels: {labels}
   Assignee: {assignee}
   Created: {creation_date}
   Updated: {last_update}
   
📝 Description:
{issue_description}
```

### 3. Local File Mapping
If local task file exists:
```
📁 Local Files:
   Task file: .claude/epics/{epic_name}/{task_file}
   Updates: .claude/epics/{epic_name}/updates/$ARGUMENTS/
   Last local update: {timestamp}
```

### 4. Sub-Issues and Dependencies
Show related issues:
```
🔗 Related Issues:
   Parent Epic: #{epic_issue_number}
   Dependencies: #{dep1}, #{dep2}
   Blocking: #{blocked1}, #{blocked2}
   Sub-tasks: #{sub1}, #{sub2}
```

### 5. Recent Activity
Display recent comments and updates:
```
💬 Recent Activity:
   {timestamp} - {author}: {comment_preview}
   {timestamp} - {author}: {comment_preview}
   
   View full thread: gh issue view #$issue_number --comments
```

### 6. Progress Tracking
If task file exists, show progress:
```
✅ Acceptance Criteria:
   ✅ Criterion 1 (completed)
   🔄 Criterion 2 (in progress)
   ⏸️ Criterion 3 (blocked)
   □ Criterion 4 (not started)
```

### 7. Quick Actions
```
🚀 Quick Actions:
   Start work: /pm:issue-start $ARGUMENTS
   Sync updates: /pm:issue-sync $ARGUMENTS
   Add comment: gh issue comment #$issue_number --body "your comment"
   View in browser: gh issue view #$issue_number --web
```

### 8. Error Handling
- Handle invalid issue numbers gracefully
- Check for network/authentication issues
- Provide helpful error messages and alternatives

Provide comprehensive issue information to help developers understand context and current status for Issue #$ARGUMENTS.
