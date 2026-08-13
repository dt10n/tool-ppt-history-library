#!/usr/bin/env python3
"""Resume-safe batched uploader for the private Sites image bucket."""

import argparse
import concurrent.futures
import json
import mimetypes
import os
import struct
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "upload-manifest.jsonl"
CHECKPOINT = ROOT / "scripts" / ".uploaded-images.txt"
LOCK = threading.Lock()


def load_items():
    uploaded = set(CHECKPOINT.read_text(encoding="utf-8").splitlines()) if CHECKPOINT.exists() else set()
    return [json.loads(line) for line in MANIFEST.read_text(encoding="utf-8").splitlines()
            if line and json.loads(line)["key"] not in uploaded]


def make_batches(items, max_bytes=8 * 1024 * 1024, max_count=12):
    batch, size = [], 4
    for item in items:
        projected = size + item["size"] + len(item["key"].encode()) + 64
        if batch and (projected > max_bytes or len(batch) >= max_count):
            yield batch
            batch, size = [], 4
        batch.append(item)
        size += item["size"] + len(item["key"].encode()) + 64
    if batch:
        yield batch


def encode_batch(batch):
    output = bytearray(struct.pack(">I", len(batch)))
    for item in batch:
        key = item["key"].encode("utf-8")
        content_type = (mimetypes.guess_type(item["path"])[0] or "image/jpeg").encode("utf-8")
        data = Path(item["path"]).read_bytes()
        output.extend(struct.pack(">I", len(key))); output.extend(key)
        output.extend(struct.pack(">I", len(content_type))); output.extend(content_type)
        output.extend(struct.pack(">I", len(data))); output.extend(data)
    return bytes(output)


def upload_batch(batch, endpoint, bypass_token, import_token):
    last_error = None
    for attempt in range(5):
        try:
            request = urllib.request.Request(endpoint, data=encode_batch(batch), method="PUT", headers={
                "Authorization": f"Bearer {import_token}",
                "OAI-Sites-Authorization": f"Bearer {bypass_token}",
                "Content-Type": "application/octet-stream",
            })
            with urllib.request.urlopen(request, timeout=120) as response:
                if response.status != 200: raise RuntimeError(f"HTTP {response.status}")
            with LOCK:
                with CHECKPOINT.open("a", encoding="utf-8") as checkpoint:
                    for item in batch: checkpoint.write(item["key"] + "\n")
            return len(batch), sum(item["size"] for item in batch), None
        except Exception as error:
            last_error = str(error)
            if isinstance(error, urllib.error.HTTPError) and error.code in (401, 403): break
            time.sleep(2 ** attempt)
    return 0, 0, last_error or "unknown error"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args()
    bypass = os.environ.get("OAI_SITES_BYPASS_TOKEN", "")
    importer = os.environ.get("PPT_IMPORT_TOKEN", "")
    if not bypass or not importer: raise SystemExit("missing protected upload credentials")
    items = load_items()
    batches = list(make_batches(items))
    endpoint = args.base_url.rstrip("/") + "/api/internal/import-batch"
    print(json.dumps({"pending": len(items), "batches": len(batches), "bytes": sum(i["size"] for i in items)}), flush=True)
    done = sent = failed_batches = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(upload_batch, batch, endpoint, bypass, importer) for batch in batches]
        for future in concurrent.futures.as_completed(futures):
            count, size, error = future.result()
            done += count; sent += size
            if error: failed_batches += 1
            print(json.dumps({"done": done, "total": len(items), "failed_batches": failed_batches,
                              "sent_bytes": sent, "percent": round(done * 100 / max(1, len(items)), 2)}), flush=True)
    if failed_batches: raise SystemExit(f"{failed_batches} batches failed; rerun to resume")


if __name__ == "__main__":
    main()
