#!/usr/bin/env python3
"""Runs the whole test suite in order and prints one line per test. Exit code 1 if any fails.
Usage: python3 tests/run_all.py [--quick]   (--quick skips the Office and local-server tests)"""
import os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
QUICK = '--quick' in sys.argv
TESTS = ['lint_modules.py', 'test_server.py', 'test_engine.py', 'test_hl.py', 'test_pdfedit.py', 'test_flow.py', 'test_landing.py', 'test_platforms.py', 'test_edit.py', 'test_login.py', 'test_desk.py', 'test_learning.py', 'test_memory.py', 'test_more.py', 'test_loop.py', 'test_deal.py', 'test_playbook.py', 'test_dashboard.py']
if not QUICK: TESTS += ['test_office.py', 'test_pdf.py', 'test_local.py']
failed = []
for t in TESTS:
    t0 = time.time()
    r = subprocess.run([sys.executable, os.path.join(HERE, t)], capture_output=True, text=True, cwd=HERE)
    out = (r.stdout + r.stderr)
    ok = r.returncode == 0 and 'FAILURES' not in out and 'Traceback' not in out
    print('%-20s %s  %5.1fs' % (t, 'ok  ' if ok else 'FAIL', time.time() - t0))
    if not ok:
        failed.append(t)
        print('\n'.join('    ' + l for l in out.strip().splitlines()[-12:]))
print('%d/%d passed' % (len(TESTS) - len(failed), len(TESTS)))
sys.exit(1 if failed else 0)
