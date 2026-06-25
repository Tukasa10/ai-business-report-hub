from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def run_server(start_port=4173):
    root = Path(__file__).resolve().parents[1]
    handler = SimpleHTTPRequestHandler

    for port in range(start_port, start_port + 20):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), handler)
        except OSError:
            continue
        print(f"AI Business Report Hub running at http://127.0.0.1:{port}")
        print(f"Serving directory: {root}")
        try:
            server.serve_forever()
        finally:
            server.server_close()
        return

    raise RuntimeError("No available port found.")


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[1]
    import os

    os.chdir(project_root)
    run_server()
