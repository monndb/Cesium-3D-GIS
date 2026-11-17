#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""最简本地服务：把项目根目录通过 HTTP 提供出去。

Cesium 不能直接用 file:// 打开，地形瓦片必须走 HTTP 才能加载。
运行： python backend/server.py   然后访问 http://127.0.0.1:8001/
"""

import http.server
import os
import socketserver
from functools import partial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8001"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # 站点根目录是 frontend/，而 data/ 与它平级，所以：
        #   /            -> frontend/
        #   /data/xxx    -> data/xxx
        if not path.startswith("/data/"):
            path = "/frontend" + path
        return super().translate_path(path)

    def do_GET(self):
        # CesiumLab 切出的 .terrain 通常是 gzip 压缩的，
        # 必须补上 Content-Encoding 头，否则 Cesium 会把压缩数据当原始二进制解析而报错。
        if self.path.split("?")[0].endswith(".terrain"):
            path = self.translate_path(self.path)
            if os.path.isfile(path):
                with open(path, "rb") as fp:
                    data = fp.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.quantized-mesh")
                self.send_header("Content-Length", str(len(data)))
                if data[:2] == b"\x1f\x8b":
                    self.send_header("Content-Encoding", "gzip")
                self.end_headers()
                self.wfile.write(data)
                return
        super().do_GET()


class Server(socketserver.ThreadingTCPServer):
    # 不加这个，Ctrl+C 之后立刻重启会报 WinError 10048（端口被 TIME_WAIT 占着）
    allow_reuse_address = True
    daemon_threads = True


with Server(("", PORT), partial(Handler, directory=ROOT)) as httpd:
    print("服务已启动: http://127.0.0.1:%d/" % PORT)
    print("按 Ctrl+C 停止")
    httpd.serve_forever()
