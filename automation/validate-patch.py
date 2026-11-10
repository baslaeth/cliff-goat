"""Fail closed before applying an untrusted Codex patch. Runs from trusted checkout."""
import json, pathlib, re, subprocess, sys

patch = pathlib.Path(sys.argv[1])
policy = json.loads(pathlib.Path(__file__).with_name('policy.json').read_text())
if patch.stat().st_size > policy['maximumPatchBytes']:
    raise SystemExit('Patch exceeds automatic integration limit')
raw = patch.read_text()
if not raw.strip():
    raise SystemExit('No proposed change')
if any(s in raw for s in ('GIT binary patch', 'new file mode', 'deleted file mode', 'old mode', 'new mode', 'rename from', 'rename to', 'copy from', 'copy to')):
    raise SystemExit('Only existing text file edits are eligible')
headers = re.findall(r'^diff --git a/(\S+) b/(\S+)$', raw, re.M)
if not headers or len(headers) != raw.count('diff --git '):
    raise SystemExit('Invalid patch headers')
for before, after in headers:
    if before != after or after not in policy['allowedFiles']:
        raise SystemExit('Protected or unrecognized path: ' + after)
changes = [line[1:] for line in raw.splitlines() if line[:1] in ('+', '-') and not line.startswith(('+++', '---'))]
if len(changes) > policy['maximumChangedLines']:
    raise SystemExit('Change too large for automatic integration')
# A deterministic restriction supplements (and does not trust) AI classification.
# UI controller, HTML, engine, tests, package metadata, server and automation are entirely protected.
blocked = re.compile(r'\b(rtp|payout\w*|balance\w*|stake\w*|probabilit\w*|settle\w*|payment\w*|deposit\w*|withdraw\w*|fetch|XMLHttpRequest|WebSocket|eval|Function|import|export\s*\*|require|localStorage|sessionStorage|cookie|sendBeacon|serviceWorker)\b|https?://|@import|url\s*\(', re.I)
for line in changes:
    if blocked.search(line):
        raise SystemExit('Protected logic, external resource or execution primitive in diff')
stats = subprocess.check_output(['git', 'apply', '--numstat', str(patch.resolve())], text=True)
for row in stats.splitlines():
    added, removed, path = row.split('\t', 2)
    if path not in policy['allowedFiles'] or not added.isdigit() or not removed.isdigit():
        raise SystemExit('Git resolved patch to a protected path or binary file')
subprocess.run(['git', 'apply', '--check', str(patch.resolve())], check=True)
print('Static scope gate passed')
