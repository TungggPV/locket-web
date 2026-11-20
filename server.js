const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const sharp = require("sharp");
const { LocketClient, NoteType, DeviceProfile } = require("./");

// Setup ffmpeg path for video processing
try {
  const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
  if (ffmpegInstaller && ffmpegInstaller.path) {
    const ffmpegDir = path.dirname(ffmpegInstaller.path);
    if (!process.env.PATH.includes(ffmpegDir)) {
      process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
    }
  }
} catch (e) {
  console.warn("[FFmpeg Setup Warning]:", e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");

// Enable trust proxy for cloud hosting (Render, Vercel, reverse proxies)
app.set("trust proxy", 1);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ================= SECURITY HEADERS (HELMET) ================= //
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      mediaSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "wss:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ================= RATE LIMITING ================= //
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 150, // max 150 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau giây lát."
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 login attempts per 15 mins per IP to protect against brute-force
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_LOGIN_ATTEMPTS",
    message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút."
  }
});

// Apply rate limiting to all API routes
app.use("/api/", apiLimiter);

// ================= MULTER FILE UPLOAD HARDENING ================= //
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".mp4", ".mov", ".webm", ".m4v"
]);

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mime) && !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error("Định dạng tệp không được hỗ trợ. Chỉ chấp nhận ảnh (JPG, PNG, WEBP, HEIC) hoặc video (MP4, MOV, WEBM)."), false);
  }
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      ext = ".jpg";
    }
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max per file
    files: 1
  }
});

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsers with safe limits (2MB max for text/JSON)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Load presets
let captionPresets = {};
try {
  captionPresets = require("./caption_presets.json");
} catch (e) {
  captionPresets = {};
}

// ================= ADMIN-GRANTED VIP ENGINE ================= //
const VIP_DATA_PATH = path.join(__dirname, "vip_members.json");
const VIP_SIGNING_SECRET = process.env.VIP_SIGNING_SECRET || "locket-by-tunggg-0201-supreme-vip-secret-key-2026";
const ADMIN_USERNAMES = new Set(["tunggg0201", "tungggpv"]);
const ADMIN_EMAILS = new Set(["tungpham020105@gmail.com"]);

const vipRegistry = new Map();
const revokedIdentifiers = new Set();

function normalizeId(val) {
  return String(val || "").trim().toLowerCase().replace(/^@/, "");
}

function loadVipRegistryFromDisk() {
  try {
    if (!fs.existsSync(VIP_DATA_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(VIP_DATA_PATH, "utf8"));
    if (Array.isArray(raw.members)) {
      raw.members.forEach((m) => {
        const key = normalizeId(m && m.identifier);
        if (key) {
          vipRegistry.set(key, {
            identifier: key,
            label: m.label || key,
            tier: m.tier || "SUPREME VIP",
            grantedBy: m.grantedBy || "tunggg0201",
            grantedAt: m.grantedAt || new Date().toISOString(),
            vipCode: m.vipCode || ""
          });
        }
      });
    }
    if (Array.isArray(raw.revoked)) {
      raw.revoked.forEach((r) => {
        const key = normalizeId(r);
        if (key) revokedIdentifiers.add(key);
      });
    }
  } catch (e) {
    console.warn("[VIP Registry Load Warning]:", e.message);
  }
}

function saveVipRegistryToDisk() {
  try {
    const payload = {
      members: Array.from(vipRegistry.values()),
      revoked: Array.from(revokedIdentifiers.values())
    };
    fs.writeFileSync(VIP_DATA_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (e) {
    console.warn("[VIP Registry Save Warning]:", e.message);
  }
}

loadVipRegistryFromDisk();

function isServerAdmin(user, sessionEmail = "") {
  const uname = normalizeId(user && user.username);
  const email = normalizeId((user && user.email) || sessionEmail);
  return (uname && ADMIN_USERNAMES.has(uname)) || (email && ADMIN_EMAILS.has(email));
}

function createSignedVipCode(identifier, tier = "SUPREME VIP") {
  const cleanId = normalizeId(identifier) || "*";
  const cleanTier = String(tier || "SUPREME VIP").trim() || "SUPREME VIP";
  const payload = Buffer.from(
    JSON.stringify({ id: cleanId, tier: cleanTier, by: "tunggg0201", ts: Date.now() }),
    "utf8"
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", VIP_SIGNING_SECRET)
    .update(payload)
    .digest("base64url")
    .slice(0, 14);
  return `VIP-TUNGGG-${payload}.${sig}`;
}

function verifySignedVipCode(code, user, sessionEmail = "") {
  const raw = String(code || "").trim();
  if (!raw.startsWith("VIP-TUNGGG-")) return { valid: false };
  const body = raw.slice("VIP-TUNGGG-".length);
  const dotIdx = body.lastIndexOf(".");
  if (dotIdx <= 0) return { valid: false };

  const payloadB64 = body.slice(0, dotIdx);
  const sig = body.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac("sha256", VIP_SIGNING_SECRET)
    .update(payloadB64)
    .digest("base64url")
    .slice(0, 14);

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false };
  }

  try {
    const data = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    const targetId = normalizeId(data && data.id);
    if (!targetId) return { valid: false };
    if (revokedIdentifiers.has(targetId)) return { valid: false };

    const userCandidates = [
      normalizeId(user && user.username),
      normalizeId((user && user.email) || sessionEmail),
      normalizeId(user && user.uid)
    ].filter(Boolean);

    if (userCandidates.some((c) => revokedIdentifiers.has(c))) {
      return { valid: false };
    }
    if (targetId !== "*" && !userCandidates.includes(targetId)) {
      return { valid: false };
    }
    return {
      valid: true,
      identifier: targetId,
      tier: data.tier || "SUPREME VIP"
    };
  } catch (e) {
    return { valid: false };
  }
}

function getVipStatusForUser(user, sessionEmail = "", headerVipToken = "") {
  if (isServerAdmin(user, sessionEmail)) {
    return {
      isAdmin: true,
      isVip: true,
      tier: "ROOT ADMIN",
      grantedBy: "SYSTEM"
    };
  }

  const candidates = [
    normalizeId(user && user.username),
    normalizeId((user && user.email) || sessionEmail),
    normalizeId(user && user.uid)
  ].filter(Boolean);

  for (const key of candidates) {
    if (revokedIdentifiers.has(key)) {
      return { isAdmin: false, isVip: false, tier: "FREE", grantedBy: null };
    }
  }

  for (const key of candidates) {
    const entry = vipRegistry.get(key);
    if (entry) {
      return {
        isAdmin: false,
        isVip: true,
        tier: entry.tier || "SUPREME VIP",
        grantedBy: entry.grantedBy || "tunggg0201",
        grantedAt: entry.grantedAt,
        vipCode: entry.vipCode || headerVipToken || ""
      };
    }
  }

  if (headerVipToken) {
    const verified = verifySignedVipCode(headerVipToken, user, sessionEmail);
    if (verified.valid) {
      const storeKey = candidates[0] || verified.identifier;
      if (storeKey && storeKey !== "*") {
        vipRegistry.set(storeKey, {
          identifier: storeKey,
          label: (user && user.username) || storeKey,
          tier: verified.tier,
          grantedBy: "tunggg0201",
          grantedAt: new Date().toISOString(),
          vipCode: String(headerVipToken).trim()
        });
        saveVipRegistryToDisk();
      }
      return {
        isAdmin: false,
        isVip: true,
        tier: verified.tier,
        grantedBy: "tunggg0201",
        vipCode: String(headerVipToken).trim()
      };
    }
  }

  return { isAdmin: false, isVip: false, tier: "FREE", grantedBy: null };
}

// Helper: Restore client per request from header - NEVER save to disk
function getClient(req) {
  const header = req.headers["x-locket-session"];
  if (!header || typeof header !== "string") return null;
  if (header.length > 16384) return null; // Prevent oversized token DoS

  try {
    const raw = Buffer.from(header, "base64").toString("utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (!data.uid || !data.idToken) return null;

    const client = new LocketClient({ sessionPath: null });
    client.session.uid = String(data.uid);
    client.session.email = String(data.email || "");
    client.session.idToken = String(data.idToken);
    client.session.refreshToken = String(data.refreshToken || "");
    client.session.expiresAt = Number(data.expiresAt) || 0;
    if (data.device && typeof data.device === "object") {
      client.session.device = DeviceProfile.fromDict(data.device);
      client.device = client.session.device;
    }
    return client;
  } catch (e) {
    return null;
  }
}

// Middleware to ensure request has valid session
function requireAuth(req, res, next) {
  const client = getClient(req);
  if (!client || !client.isAuthenticated()) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "Bạn chưa đăng nhập Locket. Vui lòng đăng nhập để tiếp tục."
    });
  }
  req.locketClient = client;
  next();
}

// ================= KEEP-ALIVE & HEALTH CHECK ================= //
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "locket-by-tunggg",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// ================= API ROUTES ================= //

// 1. Auth Status & Info
app.get("/api/auth/status", async (req, res) => {
  const client = getClient(req);
  if (!client || !client.isAuthenticated()) {
    return res.json({ authenticated: false, user: null, vipStatus: { isAdmin: false, isVip: false, tier: "FREE" } });
  }
  try {
    const profile = await client.user.getProfile();
    const user = {
      ...(profile || {}),
      uid: (profile && profile.uid) || client.session.uid,
      email: (profile && profile.email) || client.session.email || ""
    };
    const vipStatus = getVipStatusForUser(user, client.session.email, req.headers["x-locket-vip-token"]);
    res.json({ authenticated: true, user, vipStatus });
  } catch (e) {
    res.json({ authenticated: false, user: null, vipStatus: { isAdmin: false, isVip: false, tier: "FREE" } });
  }
});

// 2. Login - Returns sessionData to browser without writing to server disk
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email và mật khẩu là bắt buộc." });
  }
  if (email.length > 254 || password.length > 256) {
    return res.status(400).json({ error: "Email hoặc mật khẩu không hợp lệ." });
  }

  try {
    const client = new LocketClient({ sessionPath: null });
    await client.login(email.trim(), password);
    const profile = await client.user.getProfile();
    const user = {
      ...(profile || {}),
      uid: (profile && profile.uid) || client.session.uid,
      email: (profile && profile.email) || client.session.email || ""
    };

    const sessionData = {
      uid: client.session.uid,
      email: client.session.email,
      idToken: client.session.idToken,
      refreshToken: client.session.refreshToken,
      expiresAt: client.session.expiresAt,
      device: client.session.device ? client.session.device.toDict() : null
    };

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    const vipStatus = getVipStatusForUser(user, client.session.email, req.headers["x-locket-vip-token"]);

    res.json({
      success: true,
      message: "Đăng nhập thành công!",
      sessionData: sessionToken,
      user,
      vipStatus
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(401).json({
      error: "LOGIN_FAILED",
      message: err.message || "Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu."
    });
  }
});

// 3. Logout
app.post("/api/auth/logout", (req, res) => {
  res.json({ success: true, message: "Đã đăng xuất thành công." });
});

// 3b. VIP Status & Activation / Admin Grant Management
app.get("/api/vip/status", requireAuth, async (req, res) => {
  const client = req.locketClient;
  try {
    const profile = await client.user.getProfile();
    const user = {
      ...(profile || {}),
      uid: (profile && profile.uid) || client.session.uid,
      email: (profile && profile.email) || client.session.email || ""
    };
    const vipStatus = getVipStatusForUser(user, client.session.email, req.headers["x-locket-vip-token"]);
    res.json(vipStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/vip/redeem", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { code } = req.body || {};
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "INVALID_VIP_CODE", message: "Vui lòng nhập mã kích hoạt VIP." });
  }
  try {
    const profile = await client.user.getProfile();
    const user = {
      ...(profile || {}),
      uid: (profile && profile.uid) || client.session.uid,
      email: (profile && profile.email) || client.session.email || ""
    };
    const verified = verifySignedVipCode(code, user, client.session.email);
    if (!verified.valid) {
      return res.status(400).json({
        error: "INVALID_VIP_CODE",
        message: "Mã VIP không hợp lệ, đã bị thu hồi hoặc không dành cho tài khoản này."
      });
    }

    const storeKey = normalizeId(user.username || user.email || user.uid);
    if (storeKey) {
      revokedIdentifiers.delete(storeKey);
      vipRegistry.set(storeKey, {
        identifier: storeKey,
        label: user.username || user.first_name || storeKey,
        tier: verified.tier,
        grantedBy: "tunggg0201",
        grantedAt: new Date().toISOString(),
        vipCode: code.trim()
      });
      saveVipRegistryToDisk();
    }
    const vipStatus = getVipStatusForUser(user, client.session.email, code.trim());
    res.json({
      success: true,
      message: "🎉 Kích hoạt Locket Gold VIP thành công!",
      vipToken: code.trim(),
      vipStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/vip/list", requireAuth, async (req, res) => {
  const client = req.locketClient;
  try {
    const profile = await client.user.getProfile();
    const user = {
      ...(profile || {}),
      uid: (profile && profile.uid) || client.session.uid,
      email: (profile && profile.email) || client.session.email || ""
    };
    if (!isServerAdmin(user, client.session.email)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Chỉ Admin @tunggg0201 mới có quyền truy cập." });
    }
    res.json({ members: Array.from(vipRegistry.values()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/vip/grant", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { identifier, label, tier } = req.body || {};
  try {
    const profile = await client.user.getProfile();
    const user = {
      ...(profile || {}),
      uid: (profile && profile.uid) || client.session.uid,
      email: (profile && profile.email) || client.session.email || ""
    };
    if (!isServerAdmin(user, client.session.email)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Chỉ Admin @tunggg0201 mới có quyền cấp VIP." });
    }
    const id = normalizeId(identifier);
    if (!id || id === "*") {
      return res.status(400).json({ error: "INVALID_IDENTIFIER", message: "Vui lòng nhập @username, email hoặc UID cụ thể của tài khoản cần cấp VIP." });
    }
    const cleanTier = String(tier || "SUPREME VIP").trim() || "SUPREME VIP";
    revokedIdentifiers.delete(id);
    const vipCode = createSignedVipCode(id, cleanTier);
    const member = {
      identifier: id,
      label: String(label || identifier || id).trim(),
      tier: cleanTier,
      grantedBy: "tunggg0201",
      grantedAt: new Date().toISOString(),
      vipCode
    };
    vipRegistry.set(id, member);
    saveVipRegistryToDisk();
    res.json({ success: true, member, vipCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/vip/revoke", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { identifier } = req.body || {};
  try {
    const profile = await client.user.getProfile();
    const user = {
      ...(profile || {}),
      uid: (profile && profile.uid) || client.session.uid,
      email: (profile && profile.email) || client.session.email || ""
    };
    if (!isServerAdmin(user, client.session.email)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Chỉ Admin @tunggg0201 mới có quyền thu hồi VIP." });
    }
    const id = normalizeId(identifier);
    if (!id) {
      return res.status(400).json({ error: "INVALID_IDENTIFIER", message: "Thiếu định danh tài khoản cần thu hồi VIP." });
    }
    if (ADMIN_USERNAMES.has(id) || ADMIN_EMAILS.has(id)) {
      return res.status(400).json({ error: "CANNOT_REVOKE_ADMIN", message: "Không thể thu hồi quyền của Root Admin @tunggg0201." });
    }
    vipRegistry.delete(id);
    revokedIdentifiers.add(id);
    saveVipRegistryToDisk();
    res.json({ success: true, identifier: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Current User Profile
app.get("/api/user/profile", requireAuth, async (req, res) => {
  const client = req.locketClient;
  try {
    const profile = await client.user.getProfile();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile name
app.post("/api/user/profile", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { firstName, lastName } = req.body;
  try {
    await client.user.updateName(firstName || "", lastName || "");
    const profile = await client.user.getProfile();
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update avatar
app.post("/api/user/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  const client = req.locketClient;
  if (!req.file) {
    return res.status(400).json({ error: "Chưa chọn file ảnh đại diện." });
  }
  const filePath = req.file.path;
  try {
    await client.user.updateAvatar(filePath);
    const profile = await client.user.getProfile();
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
  }
});

// 5. Friends
app.get("/api/friends", requireAuth, async (req, res) => {
  const client = req.locketClient;
  try {
    const friends = await client.friends.getAllFriends();
    res.json(friends || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Friend requests
app.get("/api/friends/requests", requireAuth, async (req, res) => {
  const client = req.locketClient;
  try {
    const requests = await client.friends.getFriendRequests();
    res.json(requests || { incoming: [], outgoing: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send friend request by username or invite URL
app.post("/api/friends/request", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { username } = req.body;
  if (!username || !String(username).trim()) {
    return res.status(400).json({ error: "Username hoặc link mời không được để trống." });
  }
  const rawInput = String(username).trim();
  try {
    let result;
    const inviteMatch = rawInput.match(/locket\.camera(?:\/|%2F)invites(?:\/|%2F)([a-zA-Z0-9]+)/i);
    const camMatch = rawInput.match(/locket\.cam\/([a-zA-Z0-9._-]+)/i);

    if (inviteMatch) {
      const userData = await client.friends.fetchUserByInviteToken(inviteMatch[1]);
      const uid = userData?.user?.uid || null;
      if (!uid) throw new Error("Link mời Locket không hợp lệ hoặc đã hết hạn.");
      result = await client.friends.sendRequest(uid);
    } else if (camMatch) {
      result = await client.friends.sendRequestByUsername(camMatch[1]);
    } else if (/^https?:\/\//i.test(rawInput)) {
      const parsed = new URL(rawInput);
      const allowedHosts = new Set(["locket.cam", "www.locket.cam", "locket.camera", "www.locket.camera"]);
      if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
        throw new Error("Chỉ chấp nhận liên kết chính thức từ locket.cam hoặc locket.camera.");
      }
      const pageRes = await fetch(rawInput, { redirect: "follow" });
      const html = await pageRes.text();
      const resolvedInvite =
        (pageRes.url || "").match(/invites\/([a-zA-Z0-9]+)/i) ||
        html.match(/locket\.camera(?:\/|%2F)invites(?:\/|%2F)([a-zA-Z0-9]+)/i);
      if (resolvedInvite) {
        const userData = await client.friends.fetchUserByInviteToken(resolvedInvite[1]);
        const uid = userData?.user?.uid || null;
        if (!uid) throw new Error("Không tìm thấy người dùng từ link mời Locket.");
        result = await client.friends.sendRequest(uid);
      } else {
        throw new Error("Không nhận diện được link mời Locket hợp lệ.");
      }
    } else {
      const cleanUsername = rawInput.replace(/^@+/, "");
      result = await client.friends.sendRequestByUsername(cleanUsername);
    }
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept friend request
app.post("/api/friends/accept", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { userUid } = req.body;
  if (!userUid) {
    return res.status(400).json({ error: "userUid không hợp lệ." });
  }
  try {
    const result = await client.friends.acceptRequest(userUid);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove friend
app.delete("/api/friends/:userUid", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { userUid } = req.params;
  if (!userUid) {
    return res.status(400).json({ error: "userUid không hợp lệ." });
  }
  try {
    const result = await client.friends.remove(userUid);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Block friend
app.post("/api/friends/block", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { userUid } = req.body;
  if (!userUid) {
    return res.status(400).json({ error: "userUid không hợp lệ." });
  }
  try {
    const result = await client.friends.block(userUid);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Moments Feed
app.get("/api/moments", requireAuth, async (req, res) => {
  const client = req.locketClient;
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const filteredByUserId = req.query.filteredByUserId || null;
    const pageToken = req.query.pageToken || null;

    const [data, friends, myProfile] = await Promise.all([
      client.moments.getMoments({ limit, filteredByUserId, pageToken }),
      client.friends.getAllFriends().catch(() => []),
      client.user.getProfile().catch(() => null)
    ]);

    const moments = (data && data.moments) || [];
    const friendsMap = new Map();
    if (Array.isArray(friends)) {
      friends.forEach(f => friendsMap.set(f.uid, f));
    }

    const myUid = client.session.uid;
    const enrichedMoments = await Promise.all(moments.map(async m => {
      let author = null;
      if (m.user_uid === myUid) {
        author = {
          uid: myUid,
          first_name: myProfile?.first_name || "Tôi",
          last_name: myProfile?.last_name || "",
          username: myProfile?.username || "me",
          profile_picture_url: myProfile?.profile_picture_url || null,
          is_me: true
        };
      } else {
        let friend = friendsMap.get(m.user_uid);
        if (!friend && m.user_uid) {
          try {
            const fetched = await client.user.getProfile(m.user_uid);
            if (fetched) {
              friend = {
                uid: m.user_uid,
                first_name: fetched.first_name || "",
                last_name: fetched.last_name || "",
                username: fetched.username || "",
                profile_picture_url: fetched.profile_picture_url || null
              };
              friendsMap.set(m.user_uid, friend);
            }
          } catch (e) {}
        }

        if (friend) {
          author = {
            uid: friend.uid,
            first_name: friend.first_name,
            last_name: friend.last_name,
            username: friend.username,
            profile_picture_url: friend.profile_picture_url,
            is_me: false
          };
        } else {
          author = {
            uid: m.user_uid,
            first_name: "Bạn bè",
            last_name: "",
            username: "",
            profile_picture_url: null,
            is_me: false
          };
        }
      }

      return {
        ...m,
        author
      };
    }));

    res.json({
      moments: enrichedMoments,
      nextPageToken: data ? data.nextPageToken : null
    });
  } catch (err) {
    console.error("Fetch moments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// React to moment
app.post("/api/moments/react", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { momentUid, reaction = "❤️" } = req.body;
  if (!momentUid) {
    return res.status(400).json({ error: "momentUid là bắt buộc." });
  }
  try {
    const result = await client.moments.react(momentUid, reaction);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comment / Direct Reply to moment
app.post("/api/moments/comment", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { momentUid, receiverUid, text } = req.body;
  if (!momentUid || !receiverUid || !text) {
    return res.status(400).json({ error: "Thiếu thông tin bình luận." });
  }
  try {
    const result = await client.moments.comment(momentUid, receiverUid, text.trim());
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get moment views and reactions
app.get("/api/moments/:momentUid/views", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { momentUid } = req.params;
  try {
    const views = await client.moments.getViews(momentUid);
    res.json(views || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete moment
app.delete("/api/moments/:momentUid", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { momentUid } = req.params;
  try {
    const result = await client.moments.delete(momentUid);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Post Moment (Photo / Video)
app.post("/api/moments/post", requireAuth, upload.single("file"), async (req, res) => {
  const client = req.locketClient;
  if (!req.file) {
    return res.status(400).json({ error: "Vui lòng chọn ảnh hoặc video để đăng." });
  }

  const filePath = req.file.path;
  const mime = req.file.mimetype || "";
  const isVideo = mime.startsWith("video/") || [".mp4", ".mov", ".m4v", ".webm"].includes(path.extname(req.file.originalname).toLowerCase());

  try {
    const {
      caption = "",
      noteType = "standard",
      icon = null,
      colors = null,
      textColor = null,
      recipients = null,
      isPrivate = false,
      skipAutoFormat = false
    } = req.body;

    const shouldSkipAutoFormat = skipAutoFormat === true || skipAutoFormat === "true";

    let parsedColors = null;
    if (colors) {
      try { parsedColors = typeof colors === "string" ? JSON.parse(colors) : colors; } catch (e) {}
    }

    let parsedRecipients = null;
    if (recipients) {
      try { parsedRecipients = typeof recipients === "string" ? JSON.parse(recipients) : recipients; } catch (e) {}
    }

    const postOptions = {
      caption: caption || "",
      noteType: noteType || NoteType.STANDARD,
      isPrivate: isPrivate === true || isPrivate === "true",
      skipAutoFormat: shouldSkipAutoFormat,
      autoCompress: true,
      priority: "speed"
    };

    if (icon) postOptions.icon = icon;
    if (parsedColors && Array.isArray(parsedColors) && parsedColors.length > 0) {
      postOptions.colors = parsedColors;
    }
    if (textColor) postOptions.textColor = textColor;
    if (parsedRecipients && Array.isArray(parsedRecipients) && parsedRecipients.length > 0) {
      postOptions.recipients = parsedRecipients;
    }

    if (isVideo) {
      postOptions.video = filePath;
    } else {
      // Auto-format landscape / PC screenshot images to 1:1 with blurred backdrop unless user chose original
      if (!shouldSkipAutoFormat && filePath && fs.existsSync(filePath)) {
        try {
          const meta = await sharp(filePath).metadata();
          if (meta.width && meta.height && meta.width > meta.height * 1.15) {
            console.log(`[AutoFormat]: Formatting landscape image (${meta.width}x${meta.height}) to 1:1 square for Locket Widget`);
            const size = Math.max(meta.width, meta.height);
            const blurBg = await sharp(filePath)
              .resize(size, size, { fit: "cover" })
              .blur(25)
              .modulate({ brightness: 0.65 })
              .toBuffer();

            const scale = size / meta.width;
            const fgH = Math.round(meta.height * scale);
            const fg = await sharp(filePath)
              .resize(size, fgH, { fit: "contain" })
              .toBuffer();

            const composited = await sharp(blurBg)
              .composite([{ input: fg, gravity: "center" }])
              .jpeg({ quality: 95 })
              .toBuffer();

            fs.writeFileSync(filePath, composited);
          }
        } catch (err) {
          console.warn("[AutoFormat]: Sharp landscape format error:", err.message);
        }
      }
      postOptions.image = filePath;
    }

    const result = await client.moments.post(postOptions);

    res.json({
      success: true,
      message: "Đăng khoảnh khắc thành công!",
      result
    });
  } catch (err) {
    console.error("Post moment error:", err);
    res.status(500).json({
      error: "POST_FAILED",
      message: err.message || "Không thể đăng khoảnh khắc."
    });
  } finally {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
  }
});

// 8. Presets Catalog
app.get("/api/presets", (req, res) => {
  res.json(captionPresets);
});

// 9. Chat / Conversations
app.get("/api/chat/conversations", requireAuth, async (req, res) => {
  const client = req.locketClient;
  try {
    const [convs, friends] = await Promise.all([
      client.chat.getConversations(),
      client.friends.getAllFriends().catch(() => [])
    ]);

    const friendsMap = new Map();
    if (Array.isArray(friends)) {
      friends.forEach(f => friendsMap.set(f.uid, f));
    }

    const enriched = (convs || []).map(c => {
      const friend = friendsMap.get(c.peer_uid);
      return {
        ...c,
        peer: friend || {
          uid: c.peer_uid,
          first_name: "Bạn bè",
          last_name: "",
          username: "",
          profile_picture_url: null
        }
      };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat messages
app.get("/api/chat/messages", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { otherUserId } = req.query;
  if (!otherUserId) {
    return res.status(400).json({ error: "otherUserId là bắt buộc." });
  }
  try {
    const msgs = await client.chat.getMessages({ otherUserId, fetchServer: true });
    res.json(msgs || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message
app.post("/api/chat/send", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { receiverUid, text } = req.body;
  if (!receiverUid || (!text && text !== "")) {
    return res.status(400).json({ error: "receiverUid và text là bắt buộc." });
  }
  try {
    const result = await client.chat.sendMessage({ receiverUid, text });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "FILE_TOO_LARGE", message: "Kích thước tệp quá lớn (Tối đa 100MB)." });
    }
    return res.status(400).json({ error: "UPLOAD_ERROR", message: err.message });
  }
  if (err) {
    console.error("[Security/Server Error]:", err.message);
    return res.status(err.status || 500).json({
      error: "SERVER_ERROR",
      message: err.message || "Đã xảy ra lỗi máy chủ."
    });
  }
  next();
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Locket by Tunggg Web Server đang chạy tại:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`===============================================`);
});
