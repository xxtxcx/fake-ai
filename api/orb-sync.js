if (!global.orbSyncState) {
  global.orbSyncState = {};
}

function getChannelState(channel) {
  if (!global.orbSyncState[channel]) {
    global.orbSyncState[channel] = {
      version: 0,
      level: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      ts: Date.now(),
    };
  }
  return global.orbSyncState[channel];
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const channel = String(
    req.method === "GET" ? req.query.channel || "demo-room" : req.body?.channel || "demo-room",
  ).toLowerCase();
  const state = getChannelState(channel);

  if (req.method === "GET") {
    const since = parseInt(req.query.since || "0", 10);
    if (state.version <= since) {
      res.status(200).json({ unchanged: true, channel, ...state });
      return;
    }
    res.status(200).json({ channel, ...state });
    return;
  }

  if (req.method === "POST") {
    const next = {
      version: state.version + 1,
      level: Number(req.body?.level) || 0,
      bass: Number(req.body?.bass) || 0,
      mid: Number(req.body?.mid) || 0,
      treble: Number(req.body?.treble) || 0,
      ts: Number(req.body?.ts) || Date.now(),
    };
    global.orbSyncState[channel] = next;
    res.status(200).json({ ok: true, channel, version: next.version });
    return;
  }

  res.status(404).json({ error: "Not Found" });
}
