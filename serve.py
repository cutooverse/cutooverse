"""Local server for the game.

    python serve.py              ->  http://localhost:8765 (this computer only)
    python serve.py 8766 --lan   ->  also reachable from a phone on the same Wi-Fi

Like `python -m http.server`, but it tells the browser not to keep old copies of the files, so a
plain reload always picks up the latest code.
"""
import functools
import http.server
import socket
import sys
from pathlib import Path


class NoCache(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        if "If-Modified-Since" in self.headers:          # always send the file, never "not modified"
            del self.headers["If-Modified-Since"]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def lan_addresses():
    out = set()
    try:                                                 # the address used to reach the router
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.168.0.1", 9)); out.add(s.getsockname()[0]); s.close()
    except OSError:
        pass
    try:
        out.update(a[4][0] for a in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
    except OSError:
        pass
    return sorted(a for a in out if not a.startswith("127."))


args = [a for a in sys.argv[1:] if not a.startswith("--")]
lan = "--lan" in sys.argv
port = int(args[0]) if args else 8765
handler = functools.partial(NoCache, directory=str(Path(__file__).resolve().parent))
server = http.server.ThreadingHTTPServer(("0.0.0.0" if lan else "127.0.0.1", port), handler)
print(f"serving on http://localhost:{port}", flush=True)
if lan:
    for ip in lan_addresses():
        print(f"on your phone (same Wi-Fi): http://{ip}:{port}", flush=True)
server.serve_forever()
