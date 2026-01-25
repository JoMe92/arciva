---
description: Full development lifecycle: Issue -> Branch -> Code -> Test -> PR.
---

# Feature Development Workflow

Run this workflow to handle a development task from start to finish.

## Step 1: Issue Management

1. Ask the user for the **Issue ID** or the **Task Description**.
2. **If Issue ID provided:** Fetch details from GitHub. Check if it has sub-issues. Move status to "In Progress".
3. **If Description provided:**
   - Search for existing issues.
   - If none, create a new Issue with user approval.
   - Assign T-Shirt size (XS-XL), Labels, and add to the Project Board (Status: Backlog -> In Progress).
4. **Analysis:** Analyze the codebase and create an implementation plan.

## Step 2: Environment Setup

1. Checkout `develop` and pull latest changes.
2. Determine the branch name using Conventional Branching (e.g., `feat/ID-description`).
   - *Note:* If this is a sub-issue, check if the Parent Branch exists and use that.
3. Create and switch to the branch.

## Step 3: Implementation (TDD Loop)

*Repeat this loop for each logical component:*

1. **Write Tests:** Create Unit Tests (or Integration Tests) for the specific requirement.
2. **Implement:** Write the code to pass the test.
3. **Refactor & Lint:** Run formatters (Black/Prettier) and Linters.
4. **Commit:** Create a Conventional Commit referencing the Issue ID.

## Step 4: Verification

1. Run full test suite.
2. If UI was changed, perform E2E check (Login as `test@test.de` / `123456789`).
   - *Tip:* If testing image import, generate a dummy image script instead of looking for local files.
3. Run full linting check.

## Step 5: Pull Request

1. Push branch to origin.
2. Create a Pull Request targeting `develop`.
   - Description must link to Issue #.
3. Check GitHub Actions status.
   - If CI fails: Fix -> Commit -> Push -> Wait.
4. Once CI passes, ask user: "Ready to merge?" (Do not merge without approval).
