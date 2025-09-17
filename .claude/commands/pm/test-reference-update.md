---
allowed-tools: Bash, Read, Write
---

# Test Reference Update

Test the task reference update logic used in epic-sync.

## Usage
```
/pm:test-reference-update
```

## Instructions

### 1. Create Test Files

Create test task files with references:
```bash
mkdir -p /tmp/test-refs
cd /tmp/test-refs

# Create task ABC001
cat > ABC001.md << 'EOF'
---
id: "ABC001"
name: Task One
status: open
depends_on: []
parallel: true
conflicts_with: ["ABC002", "ABC003"]
---
# Task One
This is task ABC001.
EOF

# Create task ABC002
cat > ABC002.md << 'EOF'
---
id: "ABC002"
name: Task Two
status: open
depends_on: ["ABC001"]
parallel: false
conflicts_with: ["ABC003"]
---
# Task Two
This is task ABC002, depends on ABC001.
EOF

# Create task ABC003
cat > ABC003.md << 'EOF'
---
id: "ABC003"
name: Task Three
status: open
depends_on: ["ABC001", "ABC002"]
parallel: false
conflicts_with: []
---
# Task Three
This is task ABC003, depends on ABC001 and ABC002.
EOF
```

### 2. Create Mappings

Simulate the issue creation mappings:
```bash
# Simulate Epic task -> issue number mapping
cat > /tmp/task-mapping.txt << 'EOF'
ABC001.md:42
ABC002.md:43
ABC003.md:44
EOF

# With Epic-prefixed format, we keep filenames unchanged
# Only update GitHub URLs in frontmatter
echo "Epic Task -> GitHub Issue Mapping:"
cat /tmp/task-mapping.txt
```

### 3. Update GitHub URLs

Process each file and update GitHub URLs in frontmatter:
```bash
while IFS=: read -r task_file task_number; do
  echo "Processing: $task_file -> GitHub Issue #$task_number"
  
  # Keep Epic-prefixed filename, only update GitHub URL
  repo="owner/repo"  # Replace with actual repo
  github_url="https://github.com/$repo/issues/$task_number"
  
  # Update frontmatter (no dependency reference changes needed)
  sed -i.bak "/^github_url:/c\github_url: $github_url" "$task_file"
  rm "${task_file}.bak"

  echo "Updated GitHub URL for $task_file"
  grep "github_url:" "$task_file"
  echo "---"
done < /tmp/task-mapping.txt
```

### 4. Verify Results

Check that Epic-prefixed files maintain their dependencies and have GitHub URLs:
```bash
echo "=== Final Results ==="
for file in ABC001.md ABC002.md ABC003.md; do
  echo "File: $file"
  grep -E "id:|name:|depends_on:|conflicts_with:|github_url:" "$file"
  echo ""
done
```

Expected output:
- 42.md should have conflicts_with: [43, 44]
- 43.md should have depends_on: [42] and conflicts_with: [44]
- 44.md should have depends_on: [42, 43]

### 5. Cleanup

```bash
cd -
rm -rf /tmp/test-refs
rm -f /tmp/task-mapping.txt /tmp/id-mapping.txt
echo "✅ Test complete and cleaned up"
```