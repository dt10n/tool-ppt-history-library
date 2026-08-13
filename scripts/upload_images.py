#!/usr/bin/env python3
"""Resume-safe uploader for the private Sites image bucket."""

import argparse
import concurrent.futures
import json
import mimetypes
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "upload-manifest.jsonl"
CHECKPOINT = ROOT / "scripts" / ".uploaded-images.txt"
LOCK = threading.Lock()


def load_manifest():
    return [json.loads(line) for line in MANIFEST.read_text(encoding="utf-8").splitlines() if line]


def load_uploaded():
    if not CHECKPOINT.exists():
        return set()
    return set(CHECKPOINT.read_text(encoding="utf-8").splitlines())


def upload_one(item, base_url, bypass_token, import_token):
    path = Path(item["path"])
    content_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    endpoint = f"{base_url.rstrip('/')}/api/internal/import-image?{urllib.parse.urlencode({'key': item['key']})}"
    last_error = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(
                endpoint,
                data=path.read_bytes(),
                method="PUT",
                headers={
                    "Authorization": f"Bearer {import_token}",
                    "OAI-Sites-Authorization": f"Bearer {bypass_token}",
                    "Content-Type": content_type,
                },
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
            with LOCK:
                with CHECKPOINT.open("a", encoding="utf-8") as checkpoint:
                    checkpoint.write(item["key"] + "\n")
            return item["key"], item["size"], None
        except Exception as error:
            last_error = str(error)
            if isinstance(error, urllib.error.HTTPError) and error.code in (401, 403):
                break
            time.sleep(2 ** attempt)
    return item["key"], 0, last_error or "unknown error"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    bypass_token = os.environ.get("OAI_SITES_BYPASS_TOKEN", "")
    import_token = os.environ.get("PPT_IMPORT_TOKEN", "")
    if not bypass_token or not import_token:
        raise SystemExit("missing protected upload credentials")

    uploaded = load_uploaded()
    items = [item for item in load_manifest() if item["exists"] and item["key"] not in uploaded]
    if args.limit:
        items = items[: args.limit]
    total_bytes = sum(item["size"] for item in items)
    print(json.dumps({"pending": len(items), "bytes": total_bytes}, ensure_ascii=False), flush=True)
    if not items:
        return

    done = failed = sent = 0
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(upload_one, item, args.base_url, bypass_token, import_token) for item in items]
        for future in concurrent.futures.as_completed(futures):
            key, size, error = future.result()
            done += 1
            sent += size
            if error:
                failed += 1
                failures.append({"key": key, "error": error})
            if done == 1 or done % 25 == 0 or done == len(items):
                print(json.dumps({
                    "done": done, "total": len(items), "failed": failed,
                    "sent_bytes": sent, "percent": round(done * 100 / len(items), 2),
                }, ensure_ascii=False), flush=True)
    if failures:
        failure_path = ROOT / "scripts" / ".upload-failures.json"
        failure_path.write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")
        raise SystemExit(f"{failed} uploads failed")


if __name__ == "__main__":
    main()
