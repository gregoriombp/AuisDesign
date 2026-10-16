#!/usr/bin/env python3
"""auis-critique: turn a findings file into Review Mode pins.

Usage:
    python3 post-pins.py findings.json            # create the pins
    python3 post-pins.py findings.json --dry-run  # show what would be created

findings.json:
    {
      "route": "/auis/states/example",
      "findings": [
        {
          "severity": "P1",               # P0 | P1 | P2 (P3 is never pinned)
          "category": "a11y",             # a11y | hierarchy | task | consistency | character | states | copy
          "title": "Muted caption fails contrast",
          "problem": "What is wrong, in one or two sentences.",
          "why": "Why it matters to the person using the screen.",
          "fix": "The concrete change, naming the Au component or token.",
          "evidence": "3.1:1, needs 4.5:1 - app/auis/states/example/page.tsx:88",
          "capture": { ...window.__auisCritique.capture(...) output... },
          "revealPath": [ ...window.__auisCritique.ref(trigger) steps... ]   # optional
        }
      ]
    }

Every write goes through the same-origin Review Bridge API
(PUT /api/review-bridge/comments/:id), never the JSON files under
review-bridge/data/. The bridge base is ${BRIDGE_BASE:-http://127.0.0.1:3000};
BRIDGE_AGENT_TOKEN is sent when set. Pins are signed as the agent named by
AGENT_ID (default "claude"); the server stamps kind, color and status "open".

Re-running is safe: a finding is skipped when its first line already exists
as an open, in-review or backlog comment on the same route path, or when this
agent already has an active pin on the same element of the same URL.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

AGENTS = {"claude": "Claude", "codex": "Codex", "grok": "Grok"}
PINNABLE = {"P0", "P1", "P2"}
MAX_PINS = 10


def fail(msg):
    print(f"auis-critique: {msg}", file=sys.stderr)
    sys.exit(1)


def request(method, url, body=None, agent_id=None):
    headers = {"Accept": "application/json"}
    token = os.environ.get("BRIDGE_AGENT_TOKEN")
    if token:
        headers["x-bridge-agent-token"] = token
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if agent_id:
        headers["x-bridge-agent-id"] = agent_id
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read() or b"{}")
        except ValueError:
            return err.code, {}
    except urllib.error.URLError as err:
        fail(f"cannot reach {url} ({err.reason}). Is `npm run dev` running for THIS app?")


def first_line(text):
    return (text or "").strip().splitlines()[0].strip() if (text or "").strip() else ""


def pin_text(f):
    head = f"[critique {f['severity']} · {f['category']}] {f['title'].strip()}"
    lines = [head, f"{f['problem'].strip()} {f.get('why', '').strip()}".strip()]
    lines.append(f"Fix: {f['fix'].strip()}")
    if f.get("evidence"):
        lines.append(f"Evidence: {f['evidence'].strip()}")
    text = "\n".join(lines)
    # A handle would only be noise: agent-authored comments never fire the
    # mention trigger, and resolution goes through triage + auis-review-bridge-solve.
    return text.replace("@", "")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if len(args) != 1:
        fail("usage: post-pins.py findings.json [--dry-run]")

    with open(args[0], encoding="utf-8") as fh:
        doc = json.load(fh)
    findings = doc.get("findings", [])

    agent_id = os.environ.get("AGENT_ID", "claude")
    if agent_id not in AGENTS:
        fail(f"AGENT_ID={agent_id!r} is not a bridge agent ({', '.join(AGENTS)}).")

    base = os.environ.get("BRIDGE_BASE", "http://127.0.0.1:3000").rstrip("/")
    bridge = f"{base}/api/review-bridge"
    print(f"Queue: {bridge}", file=sys.stderr)

    status, health = request("GET", f"{bridge}/health")
    if status != 200 or not (
        health.get("ok") and health.get("schemaVersion") == 3 and health.get("mode") == "serverless"
    ):
        fail(f"health check failed at {bridge} ({status}: {health})")

    # Existing pins, to skip what an earlier run already filed. Two keys: the
    # same first line on the same route path, or this agent's pin on the same
    # element of the same URL (a rerun that reworded the title). Only active
    # comments count; an archived one means the problem was handled.
    existing, anchored = set(), set()
    for st in ("open", "in_review", "backlog"):
        status, res = request("GET", f"{bridge}/comments?status={st}&view=preview")
        if status != 200:
            fail(f"could not list {st} comments ({status}: {res})")
        for c in res.get("comments", []):
            existing.add((c["url"].split("?")[0], first_line(c.get("text"))))
    for url in sorted({(f.get("capture") or {}).get("url") for f in findings} - {None}):
        status, res = request("GET", f"{bridge}/comments?url={urllib.parse.quote(url, safe='')}")
        if status != 200:
            fail(f"could not list comments on {url} ({status}: {res})")
        for c in res.get("comments", []):
            sel = ((c.get("anchor") or {}).get("el") or {}).get("selector")
            if sel and c.get("authorId") == agent_id and c.get("status") in ("open", "in_review", "backlog"):
                anchored.add((url, sel))

    pinned, skipped = [], []
    for f in findings:
        sev = f.get("severity")
        missing = [k for k in ("severity", "category", "title", "problem", "fix", "capture") if not f.get(k)]
        if missing:
            skipped.append((f.get("title", "?"), f"missing {', '.join(missing)}"))
            continue
        if sev not in PINNABLE:
            skipped.append((f["title"], f"{sev} is summary-only"))
            continue
        cap = f["capture"]
        if cap.get("error"):
            skipped.append((f["title"], f"capture failed: {cap['error']}"))
            continue
        text = pin_text(f)
        key = (cap["url"].split("?")[0], first_line(text))
        sel = ((cap.get("anchor") or {}).get("el") or {}).get("selector")
        if key in existing:
            skipped.append((f["title"], "already pinned on this route"))
            continue
        if (cap["url"], sel) in anchored:
            skipped.append((f["title"], "this agent already has a pin on that element"))
            continue
        if len(pinned) >= MAX_PINS:
            skipped.append((f["title"], f"over the {MAX_PINS}-pin cap; list it in the summary"))
            continue

        now = int(time.time() * 1000)
        cid = f"cmt-{uuid.uuid4()}"
        context = dict(cap["context"], capturedAt=now)
        body = {
            "id": cid,
            "schemaVersion": 3,
            "authorKind": "agent",
            "authorId": agent_id,
            "authorName": AGENTS[agent_id],
            "authorColorToken": "",  # the server stamps the agent's accent
            "createdAt": now,
            "updatedAt": now,
            "url": cap["url"],
            "viewportWidth": cap["viewportWidth"],
            "viewportHeight": cap["viewportHeight"],
            "scrollY": cap["scrollY"],
            "documentHeight": cap["documentHeight"],
            "anchor": cap["anchor"],
            "context": context,
            "text": text,
            "status": "open",
            "origin": "page",
        }
        if f.get("revealPath"):
            steps = f["revealPath"]
            if any(not isinstance(st, dict) or st.get("error") or not st.get("selector") for st in steps):
                skipped.append((f["title"], "revealPath has a step that failed to capture"))
                continue
            body["revealPath"] = steps[:6]
        if dry:
            pinned.append((cid, cap["url"], first_line(text)))
            existing.add(key)
            anchored.add((cap["url"], sel))
            continue
        status, res = request("PUT", f"{bridge}/comments/{urllib.parse.quote(cid)}", body, agent_id)
        if status != 200 or not res.get("ok"):
            skipped.append((f["title"], f"bridge said {status}: {res}"))
            continue
        existing.add(key)
        anchored.add((cap["url"], sel))
        pinned.append((cid, cap["url"], first_line(text)))

    label = "Would pin" if dry else "Pinned"
    print(f"{label} ({len(pinned)}):")
    for cid, url, head in pinned:
        print(f"  - {cid} · {url} · {head}")
    if skipped:
        print(f"Not pinned ({len(skipped)}):")
        for title, why in skipped:
            print(f"  - {title} · {why}")


if __name__ == "__main__":
    main()
