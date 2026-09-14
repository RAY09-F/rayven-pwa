"""Read-only token-pattern audit. Never emits matching values or source lines."""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    "TELEGRAM_BOT_TOKEN": re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{32,}\b"),
    "ANTHROPIC_API_KEY": re.compile(r"\bsk-ant-[A-Za-z0-9_-]{30,}"),
    "OPENAI_API_KEY": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}"),
    "GITHUB_TOKEN": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})"),
    "PRIVATE_KEY": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}

def findings(text):
    return [name for name, pattern in RULES.items() if pattern.search(text)]

def scan(history=True):
    found = set()
    paths = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT).decode().split("\0")
    for name in sorted(set(paths)):
        path = ROOT / name
        if not path.is_file() or path.stat().st_size > 5_000_000:
            continue
        data = path.read_bytes()
        if b"\0" in data:
            continue
        for rule in findings(data.decode("utf-8", errors="replace")):
            found.add(("working-tree", rule, name))
    if history:
        proc = subprocess.Popen(["git", "log", "--all", "--format=", "-p", "--no-ext-diff", "--no-textconv"], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        name = "unknown"
        for raw in proc.stdout:
            line = raw.decode("utf-8", errors="replace")
            if line.startswith("+++ b/"):
                name = line[6:].strip()
            if line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
                for rule in findings(line):
                    found.add(("history", rule, name))
        if proc.wait():
            raise RuntimeError("History scan failed")
    return [{"scope": s, "name": r, "path": p} for s, r, p in sorted(found)]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--working-tree-only", action="store_true")
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()
    result = scan(not args.working_tree_only)
    if args.report:
        report = "# Security scan\n\nPattern-based audit of non-ignored text files (up to 5 MB) and all locally reachable Git patch history. Not gitleaks; no entropy scan or credential validity check. Ignored runtime secret stores are excluded. Possible fixtures require review. Secret values are never recorded.\n\n"
        report += "| Scope | Secret name / type | Path |\n|---|---|---|\n"
        report += "".join(f"| {x['scope']} | {x['name']} | `{x['path']}` |\n" for x in result) or "| Both | No pattern matches | — |\n"
        (ROOT / "docs/SECURITY-SCAN.md").write_text(report, encoding="utf-8")
    print(json.dumps({"findings": result, "count": len(result)}))
    raise SystemExit(bool(result))
