const express = require("express");
const path = require("path");
const fs = require("fs");
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
    return res.json({ authenticated: false, user: null });
  }
  try {
    const user = await client.user.getProfile();
    res.json({ authenticated: true, user });
  } catch (e) {
    res.json({ authenticated: false, user: null });
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

    const sessionData = {
      uid: client.session.uid,
      email: client.session.email,
      idToken: client.session.idToken,
      refreshToken: client.session.refreshToken,
      expiresAt: client.session.expiresAt,
      device: client.session.device ? client.session.device.toDict() : null
    };

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    res.json({
      success: true,
      message: "Đăng nhập thành công!",
      sessionData: sessionToken,
      user: profile || { uid: client.session.uid, email: client.session.email }
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
