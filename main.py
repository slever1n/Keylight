import os
import sys
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import webview

def get_base_dir():
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

class KeylightHTTPHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=get_base_dir(), **kwargs)

    def log_message(self, format, *args):
        # Suppress noisy console logs in production
        pass

def start_server():
    server = ThreadingHTTPServer(('127.0.0.1', 0), KeylightHTTPHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port

def main():
    base_dir = get_base_dir()
    icon_path = os.path.join(base_dir, 'icon.ico')
    
    server, port = start_server()
    url = f'http://127.0.0.1:{port}/index.html'

    window = webview.create_window(
        title='Lumina Keylight',
        url=url,
        width=1200,
        height=820,
        min_size=(680, 500),
        background_color='#0c0e14',
        text_select=False
    )

    webview.start(gui='edgechromium', icon=icon_path if os.path.exists(icon_path) else None)

if __name__ == '__main__':
    main()
