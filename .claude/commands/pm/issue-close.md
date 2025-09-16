---
allowed-tools: Bash, Read, Write, LS
---

# Issue Close

Mark an issue as complete and close it on GitHub.

## Usage
```
/pm:issue-close <issue_number> [completion_notes]
```

## Instructions

### 1. Find Local Task File

First check if `.claude/epics/*/$ARGUMENTS.md` exists (new naming).
If not found, search for task file with `github:.*issues/$ARGUMENTS` in frontmatter (old naming).
If not found: "❌ No local task for issue #$ARGUMENTS"

### 2. Detect Current Status (Smart Completion Detection)

Check current task status and detect if issue-sync was used:
```bash
# Get current task status
current_status=$(grep '^status:' "$task_file" 2>/dev/null | sed 's/status: *//')

# Check if progress file exists (indicates issue-sync was used)
progress_file=".claude/epics/{epic}/updates/$ARGUMENTS/progress.md"

if [ -f "$progress_file" ]; then
  # issue-sync was used, check completion
  current_completion=$(grep '^completion:' "$progress_file" 2>/dev/null | sed 's/completion: *//' | tr -d '%')

  if [ "$current_completion" -ge 100 ] && [ "$current_status" != "closed" ]; then
    echo "ℹ️ 任务通过 issue-sync 标记完成 (${current_completion}%)，正在执行关闭操作..."
    completion_source="issue-sync"
  elif [ "$current_status" = "closed" ]; then
    echo "⚠️ 任务已本地关闭，检查 GitHub 同步状态..."
    completion_source="already-closed"
  else
    echo "ℹ️ 基于 issue-sync 数据完成任务关闭..."
    completion_source="issue-sync-partial"
  fi
else
  # No issue-sync used, direct completion
  if [ "$current_status" = "closed" ]; then
    echo "⚠️ 任务已关闭，验证 GitHub 状态..."
    completion_source="already-closed"
  else
    echo "ℹ️ 直接完成并关闭任务 (未使用 issue-sync)..."
    completion_source="direct"
  fi
fi
```

### 3. Update Local Status

Get current datetime: `date -u +"%Y-%m-%dT%H:%M:%SZ"`

Update task file frontmatter:
```yaml
status: closed
updated: {current_datetime}
```

### 4. Update Progress File (if exists)

If progress file exists, ensure completion is properly recorded:
```bash
if [ -f "$progress_file" ]; then
  # Update progress file with final completion
  sed -i.bak "/^completion:/c\completion: 100%" "$progress_file"
  sed -i.bak "/^last_sync:/c\last_sync: $current_datetime" "$progress_file"
  rm "${progress_file}.bak"

  # Add completion note
  echo "" >> "$progress_file"
  echo "## ✅ Final Completion - $current_datetime" >> "$progress_file"
  echo "Task officially closed via /pm:issue-close" >> "$progress_file"
  if [ ! -z "$2" ]; then
    echo "Notes: $2" >> "$progress_file"
  fi
fi
```

### 5. Collect Related Commits

# Get commits related to this issue since task started
if [ -f "$progress_file" ]; then
  start_date=$(grep '^started:' "$progress_file" | sed 's/started: *//')
else
  start_date="7 days ago" # fallback
fi

# Find related commits by issue number and timeframe
related_commits=$(git log --oneline --grep="#$ARGUMENTS" --since="$start_date")
if [ -z "$related_commits" ]; then
  related_commits=$(git log --oneline --since="$start_date" --author="$(git config user.name)" | head -5)
fi

### 6. Close on GitHub

Create comprehensive completion comment based on available information:
```bash
# Create completion comment content
cat > /tmp/completion-comment.md << EOF
## ✅ Task Completed - $(date -u +"%Y-%m-%dT%H:%M:%SZ")

### 📋 Completion Summary
EOF

# Add completion source information
case "$completion_source" in
  "issue-sync")
    cat >> /tmp/completion-comment.md << EOF
This task was tracked through issue-sync and marked complete at ${current_completion}%.
All acceptance criteria have been verified and deliverables completed.
EOF
    ;;
  "direct")
    cat >> /tmp/completion-comment.md << EOF
Task completed directly without issue-sync tracking.
Manual verification of completion criteria performed.
EOF
    ;;
  "already-closed")
    cat >> /tmp/completion-comment.md << EOF
Task was already marked complete locally. Synchronizing final closure to GitHub.
EOF
    ;;
esac

# Add completion notes if provided
if [ ! -z "$2" ]; then
  cat >> /tmp/completion-comment.md << EOF

### 📝 Completion Notes
$2
EOF
fi

# Add commits if found
if [ ! -z "$related_commits" ]; then
  cat >> /tmp/completion-comment.md << EOF

### 💻 Related Commits
\`\`\`
$related_commits
\`\`\`
EOF
fi

cat >> /tmp/completion-comment.md << EOF

### 🎯 Status
- ✅ Task implementation complete
- ✅ Local files updated
- ✅ GitHub issue closed

This task is now complete and ready for epic integration.

---
*Closed via /pm:issue-close at $(date -u +"%Y-%m-%dT%H:%M:%SZ")*
EOF

# Post comment and close issue
gh issue comment $ARGUMENTS --body-file /tmp/completion-comment.md
gh issue close $ARGUMENTS
```

### 7. Update Epic Task List on GitHub

Check the task checkbox in the epic issue:

```bash
# Get epic name from local task file path
epic_name={extract_from_path}

# Get epic issue number from epic.md
epic_issue=$(grep 'github_url:' .claude/epics/$epic_name/epic.md | grep -oE '[0-9]+$')

if [ ! -z "$epic_issue" ]; then
  # Get current epic body
  gh issue view $epic_issue --json body -q .body > /tmp/epic-body.md
  
  # Check off this task
  sed -i "s/- \[ \] #$ARGUMENTS/- [x] #$ARGUMENTS/" /tmp/epic-body.md
  
  # Update epic issue
  gh issue edit $epic_issue --body-file /tmp/epic-body.md
  
  echo "✓ Updated epic progress on GitHub"
fi
```

### 8. Update Local Epic Task List

Update the "## Tasks Created" section in epic.md:
- Change `- [ ] {TASK_ID}` to `- [x] {TASK_ID} ✅` for completed task
- Add completion status indicator (✅)
- Maintain formatting consistency with other completed tasks

```bash
# Find the task ID from the local task file
task_id=$(basename "$task_file" .md)

# Update epic.md task list - handle both old and new formats
sed -i.bak "s/^- \[ \] ${task_id}\(.*\)$/- [x] ${task_id}\1 ✅/" .claude/epics/$epic_name/epic.md

# Clean up duplicate ✅ if task was already marked
sed -i.bak "s/✅ ✅$/✅/" .claude/epics/$epic_name/epic.md
rm .claude/epics/$epic_name/epic.md.bak

echo "✓ Updated local epic task list for ${task_id}"
```

### 9. Update Epic Progress (Comprehensive Calculation)

Calculate and update epic progress based on all task statuses:
```bash
# Count total tasks in epic directory
total_tasks=$(ls .claude/epics/$epic_name/[A-Z][A-Z][A-Z][0-9][0-9][0-9].md 2>/dev/null | wc -l)

# Count completed tasks (both file status and epic.md checkboxes)
closed_by_status=$(grep -l '^status: closed' .claude/epics/$epic_name/[A-Z][A-Z][A-Z][0-9][0-9][0-9].md 2>/dev/null | wc -l)
checked_in_epic=$(grep -c '- \[x\]' .claude/epics/$epic_name/epic.md 2>/dev/null || echo 0)

# Use the higher count (more accurate representation)
closed_tasks=$((closed_by_status > checked_in_epic ? closed_by_status : checked_in_epic))

# Calculate progress percentage
if [ "$total_tasks" -gt 0 ]; then
  epic_progress=$(( (closed_tasks * 100) / total_tasks ))

  # Update epic.md frontmatter
  current_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  sed -i.bak "/^progress:/c\progress: ${epic_progress}%" .claude/epics/$epic_name/epic.md
  sed -i.bak "/^updated:/c\updated: $current_date" .claude/epics/$epic_name/epic.md
  rm .claude/epics/$epic_name/epic.md.bak

  echo "✓ Epic progress updated: ${epic_progress}% (${closed_tasks}/${total_tasks} tasks complete)"
else
  echo "⚠️ No tasks found for epic progress calculation"
fi
```

### 10. Output

Provide comprehensive completion summary:
```bash
echo "✅ Closed issue #$ARGUMENTS"
echo ""
echo "📋 Completion Summary:"
echo "  Source: $completion_source"
echo "  Local: Task marked complete"
echo "  GitHub: Issue closed & epic updated"
echo "  Epic progress: ${epic_progress}% (${closed_tasks}/${total_tasks} tasks complete)"
echo ""

if [ "$completion_source" = "issue-sync" ]; then
  echo "📊 Progress was tracked via issue-sync (${current_completion}%)"
elif [ "$completion_source" = "direct" ]; then
  echo "📝 Direct completion (no issue-sync used)"
fi

echo ""
echo "🔗 Next actions:"
echo "  View closed issue: gh issue view $ARGUMENTS"
echo "  Epic status: /pm:epic-status $epic_name"
echo "  Next task: /pm:next"
```

## Important Notes

Follow `/rules/frontmatter-operations.md` for updates.
Follow `/rules/github-operations.md` for GitHub commands.
Always sync local state before GitHub.