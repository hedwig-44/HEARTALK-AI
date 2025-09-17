# Detail Preservation Rules

Rules for maintaining granular details across workflow transformations while preventing unnecessary simplification or complexity inflation.

## Core Principles

1. **Preserve not simplify** - Transform domain language while maintaining information density
2. **Granularity consistency** - Output detail level should match or exceed input detail level
3. **Traceability** - Every output element should trace back to specific input requirements
4. **Domain translation** - Convert between domains (product → technical → execution) without content loss

## Standard Behaviors

### Detail Inheritance
Always carry forward all specific requirements:
```markdown
✅ DO: "Create login form with email field (validation), password field (min 8 chars), remember me checkbox, forgot password link"
❌ DON'T: "Create login form with standard fields"
```

### Granularity Preservation
Maintain or increase specificity:
```markdown
✅ DO: "Implement user authentication → Create login endpoint, session management, password hashing"
❌ DON'T: "Implement user authentication → Handle user login"
```

### Context Translation
Convert between domains without losing substance:
```markdown
Product Language: "Users should see immediate feedback when clicking save"
Technical Language: "Implement optimistic UI updates for save operations with error rollback"
Execution Language: "Add loading state to save button, update UI immediately, handle API errors"
```

## Prohibited Patterns

### Abstract Generalization
```markdown
❌ "Implement user interface" (was specific UI requirements)
❌ "Handle business logic" (was specific business rules)
❌ "Add data layer" (was specific data structures/operations)
```

### Requirement Merging
```markdown
❌ Combining "Email validation" + "Password strength" → "Input validation"
❌ Combining "User creation" + "User authentication" → "User management"
```

### Unnecessary Complexity
```markdown
❌ Adding microservices architecture when requirement is simple REST API
❌ Adding complex state management when requirement is simple form handling
❌ Adding caching layer when requirement doesn't mention performance needs
```

## Required Checks

Before finalizing any workflow output, verify:

1. **Detail Count**: Does output contain equal or more specific requirements than input?
2. **Traceability**: Can each output element be mapped to specific input requirement?
3. **Completeness**: Are all input requirements addressed in output?
4. **Scope Consistency**: Is output scope aligned with input scope (no feature creep)?

## Application Patterns

### Document Transformation
When transforming between document types:
```markdown
PRD → Epic: Product requirements → Technical specifications (same detail level)
Epic → Tasks: Technical specs → Development tasks (same or more detail)
Tasks → Analysis: Development tasks → Execution steps (implementation detail)
```

### Information Processing
When processing requirements:
```markdown
1. Extract all specific requirements from input
2. Transform language/format while preserving all specifics
3. Add necessary technical/implementation details
4. Verify no information was lost in transformation
```

### Quality Gates
At each transformation step:
```markdown
Input Analysis: What specific requirements exist?
Output Review: Are all requirements preserved and appropriately detailed?
Gap Check: What's missing that should be present?
Scope Check: What's added that wasn't requested?
```

## Common Use Cases

### Product to Technical Translation
- UI mockups → Component specifications
- User stories → API requirements
- Business rules → Validation logic
- Performance goals → Technical constraints

### Technical to Implementation Translation
- API specifications → Endpoint implementations
- Component specs → Code structure
- Data models → Database schema
- Integration requirements → Service connections

## Validation Strategy

### Before Starting
1. Understand input detail level
2. Identify all specific requirements
3. Plan preservation strategy

### During Processing
1. Transform domain language
2. Preserve all specific requirements
3. Add necessary implementation details
4. Avoid scope creep

### After Completion
1. Verify detail preservation
2. Check traceability
3. Validate scope consistency
4. Confirm completeness

## Remember

**Detail preservation is about information fidelity, not verbosity** - Transform and enhance content appropriately for the target domain while ensuring no specific requirements are lost or unnecessarily complicated.

The goal is maintaining the substance of requirements through domain translations, not mechanical copying or arbitrary simplification.