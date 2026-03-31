export const config = {
  runtime: "nodejs",
};

const DELETE_USER_UPSTREAM_URL =
  process.env.DELETE_USER_UPSTREAM_URL ||
  "https://us-central1-lawhero-35bd7.cloudfunctions.net/deleteUser";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "3600");
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  return body;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token" });
    }

    const body = parseBody(req.body);

    const upstream = await fetch(DELETE_USER_UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    const raw = await upstream.text();

    if (!raw) {
      return res.status(upstream.status).end();
    }

    try {
      return res.status(upstream.status).json(JSON.parse(raw));
    } catch {
      return res.status(upstream.status).send(raw);
    }
  } catch (e) {
    console.error("🔥 deleteUser proxy error:", e);
    return res.status(500).json({
      error: e.message || "deleteUser proxy failed",
    });
  }
}
