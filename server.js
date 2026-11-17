const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
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

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage for temporary uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".tmp";
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB max for video
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
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
  if (!header) return null;
  try {
    const raw = Buffer.from(header, "base64").toString("utf8");
    const data = JSON.parse(raw);
    const client = new LocketClient({ sessionPath: null });
    client.session.uid = data.uid;
    client.session.email = data.email;
    client.session.idToken = data.idToken;
    client.session.refreshToken = data.refreshToken;
    client.session.expiresAt = data.expiresAt || 0;
    if (data.device) {
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
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email và mật khẩu là bắt buộc." });
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

// Send friend request by username
app.post("/api/friends/request", requireAuth, async (req, res) => {
  const client = req.locketClient;
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username không được để trống." });
  }
  try {
    const result = await client.friends.sendRequestByUsername(username.trim());
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
      isPrivate = false
    } = req.body;

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
