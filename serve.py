#!/usr/bin/env python3
"""Сервер FitTrack: раздаёт приложение в локальной сети (для телефона).
Запуск:  python3 serve.py   (или двойной клик по start.sh)
Порт 8787. Работает, пока открыт терминал / запущен скрипт."""
import http.server, socketserver, os

PORT = 8787
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        p = self.path.split('?')[0]
        if p.endswith('.html') or p in ('/', '/sw.js', '/manifest.webmanifest'):
            self.send_header('Cache-Control', 'no-cache')
        elif p.endswith(('.png', '.css', '.js')):
            self.send_header('Cache-Control', 'max-age=604800')
        super().end_headers()

    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(('0.0.0.0', PORT), H).serve_forever()
