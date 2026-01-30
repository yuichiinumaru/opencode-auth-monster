import os
import re

DIFF_DIR = "docs/branch_diffs"

def analyze_diff(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    summary = {
        "files": [],
        "added_lines": 0,
        "removed_lines": 0,
        "keywords": {
            "TODO": 0,
            "FIXME": 0,
            "SECRET": 0,
            "class ": 0,
            "function ": 0,
            "interface ": 0
        }
    }

    # Regex for file headers
    file_pattern = re.compile(r'^\+\+\+ b/(.+)$', re.MULTILINE)
    summary["files"] = file_pattern.findall(content)

    for line in content.splitlines():
        if line.startswith('+') and not line.startswith('+++'):
            summary["added_lines"] += 1
            for kw in summary["keywords"]:
                if kw in line:
                    summary["keywords"][kw] += 1
        elif line.startswith('-') and not line.startswith('---'):
            summary["removed_lines"] += 1

    return summary

def main():
    print("# Branch Analysis Inventory\n")

    diffs = [f for f in os.listdir(DIFF_DIR) if f.endswith('.diff')]

    for diff in diffs:
        path = os.path.join(DIFF_DIR, diff)
        stats = analyze_diff(path)

        print(f"## Branch: `{diff.replace('.diff', '')}`")
        print(f"- **Files Changed:** {len(stats['files'])}")
        print(f"- **Lines Added:** {stats['added_lines']}")
        print(f"- **Lines Removed:** {stats['removed_lines']}")

        print("### Key Entities Detected:")
        for kw, count in stats['keywords'].items():
            if count > 0:
                print(f"- `{kw}`: {count}")

        print("\n### Modified Files (Top 10):")
        for f in stats['files'][:10]:
            print(f"- {f}")
        if len(stats['files']) > 10:
            print(f"- ... and {len(stats['files']) - 10} more")
        print("\n---\n")

if __name__ == "__main__":
    main()
