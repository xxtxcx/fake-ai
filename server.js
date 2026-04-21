const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 8080;
const ROOT = __dirname;
const channels = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function getChannelSet(channel) {
  if (!channels.has(channel)) channels.set(channel, new Set());
  return channels.get(channel);
}

function safePath(urlPath) {
  const cleaned = decodeURIComponent(urlPath.split("?")[0]);
  const relative = cleaned === "/" ? "/index.html" : cleaned;
  const full = path.normalize(path.join(ROOT, relative));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/events") {
    const channel = (url.searchParams.get("channel") || "demo-room").toLowerCase();
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(": connected\n\n");

    const channelSet = getChannelSet(channel);
    channelSet.add(res);

    req.on("close", () => {
      channelSet.delete(res);
      if (channelSet.size === 0) channels.delete(channel);
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/ingest") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(raw || "{}");
        const channel = (payload.channel || "demo-room").toLowerCase();
        const data = {
          level: Number(payload.level) || 0,
          bass: Number(payload.bass) || 0,
          mid: Number(payload.mid) || 0,
          treble: Number(payload.treble) || 0,
          ts: Number(payload.ts) || Date.now(),
        };
        const listeners = getChannelSet(channel);
        const frame = `data: ${JSON.stringify(data)}\n\n`;
        for (const client of listeners) {
          client.write(frame);
        }
        sendJson(res, 200, { ok: true });
      } catch (_error) {
        sendJson(res, 400, { ok: false, error: "Bad JSON" });
      }
    });
    return;
  }

  const filePath = safePath(url.pathname || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
