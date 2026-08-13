#!/usr/bin/env python3
"""Upload in bounded bursts so the private site can recover between cycles."""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "upload-manifest.jsonl"
CHECKPOINT = ROOT / "scripts" / ".uploaded-images.txt"

BASE = [
    sys.executable, "scripts/upload_images.py",
    "--base-url", "https://ppt-history-library.llf359028660.chatgpt.site",
    "--workers", "24", "--limit", "500",
]

for cycle in range(1, 80):
    total = sum(1 for line in MANIFEST.read_text(encoding="utf-8").splitlines() if line)
    uploaded = len(set(CHECKPOINT.read_text(encoding="utf-8").splitlines())) if CHECKPOINT.exists() else 0
    if uploaded >= total:
        print(f"UPLOAD_COMPLETE {uploaded}/{total}", flush=True)
        raise SystemExit(0)
    print(f"UPLOAD_CYCLE {cycle}", flush=True)
    result = subprocess.run(BASE)
    print(f"cycle {cycle} finished with status {result.returncode}; cooling down", flush=True)
    time.sleep(20 if result.returncode == 0 else 40)

raise SystemExit("upload cycles exhausted before completion")
