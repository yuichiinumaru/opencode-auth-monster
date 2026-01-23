#!/bin/bash
# run-category-subagent.sh
# Runs a non-interactive subagent to analyze all repos in a category

set -e

CATEGORY="$1"
if [ -z "$CATEGORY" ]; then
  echo "Usage: $0 <category>"
  exit 1
fi

PROJECT_DIR="/home/sephiroth/.config/opencode/opencode-auth-monster"
OUTPUT_FILE="$PROJECT_DIR/analysis/${CATEGORY}_analysis.json"
PROMPT_FILE="$PROJECT_DIR/prompts/deep-analysis.md"

# List repos for this category (from categories.md)
REPOS=$(grep -A 100 "### $CATEGORY" "$PROJECT_DIR/analysis/categories.md" | grep -v "^###" | grep -v "^$" | head -n -1 | grep -v "(none)")

if [ -z "$REPOS" ]; then
  echo "No repos found for category: $CATEGORY"
  exit 0
fi

echo "Analyzing category: $CATEGORY"
echo "Repos: $REPOS"
echo ""

# Build the prompt
PROMPT=$(cat <<EOF
You are analyzing OpenCode auth plugins in the "$CATEGORY" category.

## Repos to analyze:
$REPOS

For each repo in $PROJECT_DIR/references/[repo_name]:

1. Read package.json and identify:
   - Plugin name
   - Version
   - Dependencies
   
2. Read src/index.ts or main entry point and identify:
   - Auth mechanism (API key, OAuth, web scraping, proxy server)
   - What service it authenticates against
   - Models exposed
   
3. Read README.md for:
   - Setup instructions
   - Configuration options
   - Known issues

4. Rate each repo (1-10) on:
   - Code quality
   - Documentation
   - Feature completeness
   - Maintainability

5. Output a JSON report with:
{
  "category": "$CATEGORY",
  "repos": [
    {
      "name": "repo-name",
      "auth_type": "api_key|oauth|scraping|proxy",
      "service": "what it authenticates to",
      "models": ["list", "of", "models"],
      "scores": {
        "code_quality": 8,
        "documentation": 7,
        "features": 6,
        "maintainability": 8
      },
      "best_features": ["what's good"],
      "issues": ["what's bad"]
    }
  ],
  "recommendation": {
    "best_base": "which repo to fork",
    "features_to_port": ["from other repos"]
  }
}

Save to: $OUTPUT_FILE
EOF
)

# Run via opencode subagent (non-interactive)
echo "$PROMPT" | opencode --non-interactive --model google/gemini-3-flash-preview --output "$OUTPUT_FILE" 2>&1

echo "Done! Results saved to $OUTPUT_FILE"
