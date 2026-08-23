#!/usr/bin/env python3
"""Tiny local score API. Same shape the live board uses."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent / "scores.json"
if not DATA.exists():
    DATA.write_text('{"racers":[]}\n', encoding="utf-8")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        raw = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,PUT,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Accept")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if self.path.rstrip("/") != "/api/scores":
            self._send(404, {"error": "not found"})
            return
        self._send(200, json.loads(DATA.read_text(encoding="utf-8")))

    def do_PUT(self):
        if self.path.rstrip("/") != "/api/scores":
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        payload = json.loads(self.rfile.read(length) or b"{}")
        racers = payload.get("racers")
        if not isinstance(racers, list):
            self._send(400, {"error": "racers must be a list"})
            return
        DATA.write_text(json.dumps({"racers": racers}, indent=2) + "\n", encoding="utf-8")
        self._send(200, {"racers": racers})

    def log_message(self, fmt, *args):
        print(self.address_string(), "-", fmt % args)


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8787), Handler).serve_forever()
