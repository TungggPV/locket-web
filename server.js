const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const { LocketClient, NoteType } = require("./");

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
const SESSION_FILE = path.join(__dirname, "locket.js_session.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

// Auto-restore session from environment variable if present
if (process.env.LOCKET_SESSION_DATA && !fs.existsSync(SESSION_FILE)) {
  try {
    fs.writeFileSync(SESSION_FILE, process.env.LOCKET_SESSION_DATA, "utf8");
    console.log("[Auth]: Restored session from LOCKET_SESSION_DATA env var.");
  } catch (e) {
    console.error("Failed to write session from env:", e.message);
  }
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage
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

// Client Management
let client = null;
let cachedFriends = new Map();
let myProfile = null;

function initClient() {
  try {
    client = new LocketClient({ sessionPath: SESSION_FILE });
    return client;
  } catch (err) {
    console.error("Failed to init LocketClient:", err);
    client = null;
    return null;
  }
}

initClient();

async function refreshCache() {
  if (!client || !client.isAuthenticated()) return;
  try {
    myProfile = await client.user.getProfile();
  } catch (e) {
    console.warn("Could not fetch my profile:", e.message);
  }

  try {
    const friends = await client.friends.getAllFriends();
    if (Array.isArray(friends)) {
      cachedFriends.clear();
      for (const f of friends) {
        cachedFriends.set(f.uid, f);
      }
    }
  } catch (e) {
    console.warn("Could not fetch friends:", e.message);
  }
}

// Initial cache warm up
refreshCache().catch(() => {});

// Middleware to ensure client is authenticated
function requireAuth(req, res, next) {
  if (!client || !client.isAuthenticated()) {
    return res.status(401).json({
      error: "UNAUTHENTICATED",
      message: "Bạn chưa đăng nhập Locket. Vui lòng đăng nhập để tiếp tục."
    });
  }
  next();
}

// ================= API ROUTES ================= //

// 1. Auth Status & Info
app.get("/api/auth/status", async (req, res) => {
  const isAuth = client ? client.isAuthenticated() : false;
  let user = null;
  if (isAuth) {
    if (!myProfile) {
      try {
        myProfile = await client.user.getProfile();
      } catch (e) {
        // Token might need refresh or session expired
      }
    }
    user = myProfile;
  }
  res.json({
    authenticated: isAuth,
    user: user || (client && client.session ? { uid: client.session.uid, email: client.session.email } : null)
  });
});

// 2. Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email và mật khẩu là bắt buộc." });
  }

  try {
    if (!client) {
      client = new LocketClient({ sessionPath: SESSION_FILE });
    }
    await client.login(email.trim(), password);
    await refreshCache();

    res.json({
      success: true,
      message: "Đăng nhập thành công!",
      user: myProfile || { uid: client.session.uid, email: client.session.email }
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
app.post("/api/auth/logout", async (req, res) => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
    client = new LocketClient({ sessionPath: SESSION_FILE });
    myProfile = null;
    cachedFriends.clear();
    res.json({ success: true, message: "Đã đăng xuất thành công." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Current User Profile
app.get("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const profile = await client.user.getProfile();
    myProfile = profile;
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile name
app.post("/api/user/profile", requireAuth, async (req, res) => {
  const { firstName, lastName } = req.body;
  try {
    const updated = await client.user.updateName(firstName || "", lastName || "");
    myProfile = await client.user.getProfile();
    res.json({ success: true, profile: myProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update avatar
app.post("/api/user/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Chưa chọn file ảnh đại diện." });
  }
  const filePath = req.file.path;
  try {
    await client.user.updateAvatar(filePath);
    myProfile = await client.user.getProfile();
    res.json({ success: true, profile: myProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
  }
});

// 5. Friends
app.get("/api/friends", requireAuth, async (req, res) => {
  try {
    const friends = await client.friends.getAllFriends();
    if (Array.isArray(friends)) {
      for (const f of friends) {
        cachedFriends.set(f.uid, f);
      }
    }
    res.json(friends || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Friend requests
app.get("/api/friends/requests", requireAuth, async (req, res) => {
  try {
    const requests = await client.friends.getFriendRequests();
    res.json(requests || { incoming: [], outgoing: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send friend request by username
app.post("/api/friends/request", requireAuth, async (req, res) => {
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
  const { userUid } = req.body;
  if (!userUid) {
    return res.status(400).json({ error: "userUid không hợp lệ." });
  }
  try {
    const result = await client.friends.acceptRequest(userUid);
    await refreshCache();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Moments Feed
app.get("/api/moments", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const filteredByUserId = req.query.filteredByUserId || null;
    const pageToken = req.query.pageToken || null;

    const data = await client.moments.getMoments({
      limit,
      filteredByUserId,
      pageToken
    });

    const moments = (data && data.moments) || [];

    // Ensure cache has friends
    if (cachedFriends.size === 0) {
      await refreshCache();
    }

    // Attach author details
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
        let friend = cachedFriends.get(m.user_uid);
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
              cachedFriends.set(m.user_uid, friend);
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

// Get moment views and reactions
app.get("/api/moments/:momentUid/views", requireAuth, async (req, res) => {
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
      try {
        parsedColors = typeof colors === "string" ? JSON.parse(colors) : colors;
      } catch (e) {
        parsedColors = null;
      }
    }

    let parsedRecipients = null;
    if (recipients) {
      try {
        parsedRecipients = typeof recipients === "string" ? JSON.parse(recipients) : recipients;
      } catch (e) {
        parsedRecipients = null;
      }
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
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}
  }
});

// 8. Presets Catalog
app.get("/api/presets", (req, res) => {
  res.json(captionPresets);
});

// 9. Chat / Conversations
app.get("/api/chat/conversations", requireAuth, async (req, res) => {
  try {
    const convs = await client.chat.getConversations();
    // Enrich with friend details
    const enriched = (convs || []).map(c => {
      const friend = cachedFriends.get(c.peer_uid);
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
  console.log(`🚀 Locket Web Server đang chạy tại:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`===============================================`);
});
