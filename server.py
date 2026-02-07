import http.server
import socketserver
import subprocess
import json
import os
import sys

PORT = 8000

class LocalBridgeHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/ingest':
            print("\n>>> INGESTION TRIGGERED VIA DASHBOARD <<<")
            try:
                # Run the reddit_ingest.py script
                result = subprocess.run([sys.executable, 'reddit_ingest.py'], 
                                     capture_output=True, text=True)
                
                if result.returncode == 0:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {"status": "success", "message": "Ingestion completed successfully", "output": result.stdout}
                    self.wfile.write(json.dumps(response).encode())
                else:
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {"status": "error", "message": "Ingestion failed", "error": result.stderr}
                    self.wfile.write(json.dumps(response).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {"status": "error", "message": str(e)}
                self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    # Ensure static files are served correctly from the current directory
    def translate_path(self, path):
        path = super().translate_path(path)
        return path

if __name__ == "__main__":
    print(f"Fat-Cat-Stacks Local Server starting at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    
    with socketserver.TCPServer(("", PORT), LocalBridgeHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)
