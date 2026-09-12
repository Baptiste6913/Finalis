#!/usr/bin/env python3
"""Cross-module check without a JS toolchain: every `Module.member` used in src/*.js must be exported by
that module's `return { ... }` (or be a known property). Also flags `S.` state keys read but never set.
Usage: python3 tests/lint_modules.py  (exit 1 on findings)"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(os.path.dirname(HERE), 'src')
files = {f: open(os.path.join(SRC, f), encoding='utf-8').read() for f in sorted(os.listdir(SRC)) if f.endswith('.js')}
exports = {}
for f, s in files.items():
    m = re.search(r'^const (\w+) = \(\(\) => \{', s, re.M)
    if not m: continue
    name = m.group(1)
    r = re.findall(r'^\s*return \{([^}]*)\};\s*$', s, re.M)
    if not r: continue
    members = set()
    for chunk in r[-1].split(','):
        chunk = chunk.strip()
        if not chunk: continue
        key = chunk.split(':')[0].strip()
        if re.match(r'^[A-Za-z_$][\w$]*$', key): members.add(key)
    exports[name] = members
problems = []
for f, s in files.items():
    for mod, members in exports.items():
        for use in set(re.findall(r'\b' + mod + r'\.([A-Za-z_$][\w$]*)', s)):
            if use not in members and use not in ('S',) and not (mod == 'UI'):
                problems.append('%s uses %s.%s which %s does not export' % (f, mod, use, mod))
# state keys: S.foo read somewhere but never assigned or declared in the initial state
ui = files.get('ui.js', '')
init = re.search(r'const S = \{(.*?)\n  \};', ui, re.S)
declared = set(re.findall(r'\b(\w+):', init.group(1))) if init else set()
assigned = set(re.findall(r'\bS\.(\w+)\s*=[^=]', ui))
read = set(re.findall(r'\bS\.(\w+)\b', ui))
for k in sorted(read - declared - assigned):
    problems.append('ui.js reads S.%s which is never set' % k)
for p in problems: print('LINT', p)
print('modules:', ', '.join('%s(%d)' % (k, len(v)) for k, v in exports.items()))
sys.exit(1 if problems else 0)
