"""Local preview for the public site.

/login is not part of this static folder. Send that path to the live
staff console so a click does not land on a blank 404.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

TARGET = "https://ndclients.co.in/login"


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _redirect_login(self):
        path = self.path.split("?", 1)[0]
        if path != "/login" and not path.startswith("/login/"):
            return False
        body = (
            "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>"
            "<title>Staff login</title>"
            f"<meta http-equiv='refresh' content='0;url={TARGET}'>"
            "</head><body>"
            f"<p><a href='{TARGET}'>Open staff login</a></p>"
            f"<script>location.replace({TARGET!r})</script>"
            "</body></html>"
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)
        return True

    def do_GET(self):
        if self._redirect_login():
            return
        super().do_GET()

    def do_HEAD(self):
        if self._redirect_login():
            return
        super().do_HEAD()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
