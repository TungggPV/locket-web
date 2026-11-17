// ========================================================
// Locket Web - Client Application Logic
// ========================================================

const state = {
  user: null,
  friends: [],
  presets: {},
  moments: [],
  nextPageToken: null,
  activeTab: "feed",
  activeChatPeer: null,
  selectedFile: null,
  selectedFileType: null
};

// ================= Session Token Management (Zero Server Disk Writes) ================= //
function getSessionToken() {
  return sessionStorage.getItem("locket_session") || localStorage.getItem("locket_session") || "";
}
function setSessionToken(token, remember = false) {
  if (remember) {
    localStorage.setItem("locket_session", token);
  } else {
    sessionStorage.setItem("locket_session", token);
  }
}
function clearSessionToken() {
  sessionStorage.removeItem("locket_session");
  localStorage.removeItem("locket_session");
}
async function apiFetch(url, options = {}) {
  const token = getSessionToken();
  const headers = options.headers || {};
  if (token) {
    headers["x-locket-session"] = token;
  }
  return fetch(url, { ...options, headers });
}

// ================= Web Audio Synthesizer (Zero External Audio Files) ================= //
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}
function playPopSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
}
function playShutterSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(800, ctx.currentTime);
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.04);

    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1200, ctx.currentTime);
        gain2.gain.setValueAtTime(0.18, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.05);
      } catch (e) {}
    }, 45);
  } catch (e) {}
}

// UI Elements
const el = {
  authScreen: document.getElementById("auth-screen"),
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  loginError: document.getElementById("login-error"),
  togglePassword: document.getElementById("toggle-password"),
  toastContainer: document.getElementById("toast-container"),

  // User elements
  sidebarAvatar: document.getElementById("sidebar-avatar"),
  sidebarName: document.getElementById("sidebar-name"),
  sidebarUsername: document.getElementById("sidebar-username"),
  mobileAvatar: document.getElementById("mobile-avatar"),
  btnLogout: document.getElementById("btn-logout"),

  // Tabs
  navItems: document.querySelectorAll(".nav-item, .mobile-nav-item"),
  tabPanes: document.querySelectorAll(".tab-pane"),

  // Feed
  feedContainer: document.getElementById("feed-container"),
  feedFilterFriend: document.getElementById("feed-filter-friend"),
  btnRefreshFeed: document.getElementById("btn-refresh-feed"),
  feedLoadMore: document.getElementById("feed-load-more"),
  btnLoadMoreFeed: document.getElementById("btn-load-more-feed"),

  // Post Studio
  dropZone: document.getElementById("drop-zone"),
  momentFileInput: document.getElementById("moment-file-input"),
  btnChooseFile: document.getElementById("btn-choose-file"),
  uploadZoneContent: document.getElementById("upload-zone-content"),
  selectedFileInfo: document.getElementById("selected-file-info"),
  fileName: document.getElementById("file-name"),
  fileSize: document.getElementById("file-size"),
  btnRemoveFile: document.getElementById("btn-remove-file"),

  // Preview elements
  previewPlaceholder: document.getElementById("preview-placeholder"),
  previewImage: document.getElementById("preview-image"),
  previewVideo: document.getElementById("preview-video"),
  previewOverlay: document.getElementById("preview-overlay"),
  overlayIcon: document.getElementById("overlay-icon"),
  overlayText: document.getElementById("overlay-text"),

  // Post inputs
  momentCaption: document.getElementById("moment-caption"),
  captionCount: document.getElementById("caption-count"),
  momentPresetSelect: document.getElementById("moment-preset-select"),
  toggleCustomStyle: document.getElementById("toggle-custom-style"),
  customColorsBox: document.getElementById("custom-colors-box"),
  colorPicker1: document.getElementById("color-picker-1"),
  colorPicker2: document.getElementById("color-picker-2"),
  colorPickerText: document.getElementById("color-picker-text"),
  customEmojiInput: document.getElementById("custom-emoji-input"),
  friendsChecklist: document.getElementById("friends-checklist"),
  recipientRadios: document.querySelectorAll("input[name='recipient-mode']"),
  btnPostMoment: document.getElementById("btn-post-moment"),
  postProgressBox: document.getElementById("post-progress-box"),
  postProgressBar: document.getElementById("post-progress-bar"),
  postProgressText: document.getElementById("post-progress-text"),

  // Chat
  conversationsList: document.getElementById("conversations-list"),
  chatHeader: document.getElementById("chat-header"),
  chatPeerAvatar: document.getElementById("chat-peer-avatar"),
  chatPeerName: document.getElementById("chat-peer-name"),
  chatPeerUsername: document.getElementById("chat-peer-username"),
  chatMessagesWrap: document.getElementById("chat-messages-wrap"),
  chatInputBar: document.getElementById("chat-input-bar"),
  chatTextInput: document.getElementById("chat-text-input"),
  btnSendMessage: document.getElementById("btn-send-message"),

  // Friends
  friendsCount: document.getElementById("friends-count"),
  friendSearchInput: document.getElementById("friend-search-input"),
  addFriendUsername: document.getElementById("add-friend-username"),
  btnSendFriendRequest: document.getElementById("btn-send-friend-request"),
  friendRequestsBox: document.getElementById("friend-requests-box"),
  incomingRequestsList: document.getElementById("incoming-requests-list"),
  friendsGrid: document.getElementById("friends-grid"),

  // Profile
  profileCardAvatar: document.getElementById("profile-card-avatar"),
  profileFullName: document.getElementById("profile-full-name"),
  profileHandle: document.getElementById("profile-handle"),
  profileUidBadge: document.getElementById("profile-uid-badge"),
  profileFirstName: document.getElementById("profile-first-name"),
  profileLastName: document.getElementById("profile-last-name"),
  btnSaveName: document.getElementById("btn-save-name"),
  profileEmail: document.getElementById("profile-email"),
  avatarFileInput: document.getElementById("avatar-file-input"),
  btnProfileLogout: document.getElementById("btn-profile-logout"),

  // Views Modal
  viewsModal: document.getElementById("views-modal"),
  viewsModalBody: document.getElementById("views-modal-body"),
  btnCloseViewsModal: document.getElementById("btn-close-views-modal")
};

// ================= Toast Notifications ================= //
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
  
  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-exclamation";

  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ================= Helper Functions ================= //
function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return "Vừa xong";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`;
  return d.toLocaleDateString("vi-VN", { month: "short", day: "numeric" });
}

function formatOverlayIcon(icon) {
  if (!icon) return "";
  if (typeof icon === "string") return icon;
  if (typeof icon === "object") {
    const symbol = String(icon.data || icon.name || "").toLowerCase();
    if (symbol.includes("clock")) return "🕒";
    if (symbol.includes("heart")) return "❤️";
    if (symbol.includes("flame") || symbol.includes("fire")) return "🔥";
    if (symbol.includes("location") || symbol.includes("pin")) return "📍";
    if (symbol.includes("star")) return "⭐";
    if (symbol.includes("sun")) return "☀️";
    if (symbol.includes("moon")) return "🌙";
    if (symbol.includes("music")) return "🎵";
    return "";
  }
  return "";
}

function getDefaultAvatar(name = "User") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2c2e35&color=ffcc00&bold=true`;
}

// ================= Tab Management ================= //
function switchTab(tabId) {
  state.activeTab = tabId;

  el.navItems.forEach(item => {
    if (item.dataset.tab === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  el.tabPanes.forEach(pane => {
    if (pane.id === `tab-${tabId}`) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });

  if (tabId === "feed" && state.moments.length === 0) {
    loadFeed();
  } else if (tabId === "chat") {
    loadConversations();
  } else if (tabId === "friends" && state.friends.length === 0) {
    loadFriends();
  }
}

el.navItems.forEach(item => {
  item.addEventListener("click", () => {
    const tab = item.dataset.tab;
    if (tab) switchTab(tab);
  });
});

// ================= Auth & Initialization ================= //
async function checkAuthStatus() {
  const token = getSessionToken();
  if (!token) {
    el.authScreen.classList.remove("hidden");
    return;
  }

  try {
    const res = await apiFetch("/api/auth/status");
    const data = await res.json();

    if (data.authenticated) {
      el.authScreen.classList.add("hidden");
      state.user = data.user;
      renderCurrentUser();
  updateStatsAndLeaderboard();
      await Promise.all([loadFriends(), loadPresets()]);
      loadFeed();
    } else {
      clearSessionToken();
      el.authScreen.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Auth status error:", err);
    clearSessionToken();
    el.authScreen.classList.remove("hidden");
  }
}

// Login submission
el.loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value;

  const btnSubmit = document.getElementById("btn-login-submit");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Đang đăng nhập...`;
  el.loginError.classList.add("hidden");

  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast("Đăng nhập thành công!", "success");
      const remember = document.getElementById("login-remember")?.checked || false;
      setSessionToken(data.sessionData, remember);
      el.authScreen.classList.add("hidden");
      state.user = data.user;
      renderCurrentUser();
      await Promise.all([loadFriends(), loadPresets()]);
      loadFeed();
    } else {
      el.loginError.textContent = data.message || "Đăng nhập thất bại. Vui lòng thử lại.";
      el.loginError.classList.remove("hidden");
    }
  } catch (err) {
    el.loginError.textContent = "Lỗi kết nối máy chủ: " + err.message;
    el.loginError.classList.remove("hidden");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<span>Đăng nhập</span> <i class="fa-solid fa-arrow-right"></i>`;
  }
});

// Toggle password view
el.togglePassword.addEventListener("click", () => {
  const type = el.loginPassword.type === "password" ? "text" : "password";
  el.loginPassword.type = type;
  el.togglePassword.innerHTML = type === "password" ? `<i class="fa-regular fa-eye"></i>` : `<i class="fa-regular fa-eye-slash"></i>`;
});

// Logout
async function handleLogout() {
  if (!confirm("Bạn có chắc chắn muốn đăng xuất không?")) return;
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (e) {}
  clearSessionToken();
  state.user = null;
  state.friends = [];
  state.moments = [];
  el.authScreen.classList.remove("hidden");
  showToast("Đã xóa phiên và đăng xuất thành công.", "info");
}
el.btnLogout.addEventListener("click", handleLogout);
el.btnProfileLogout.addEventListener("click", handleLogout);

function renderCurrentUser() {
  if (!state.user) return;
  const fullName = `${state.user.first_name || ""} ${state.user.last_name || ""}`.trim() || state.user.username || "Tôi";
  const avatarUrl = state.user.profile_picture_url || getDefaultAvatar(fullName);

  el.sidebarAvatar.src = avatarUrl;
  el.mobileAvatar.src = avatarUrl;
  el.sidebarName.textContent = fullName;
  el.sidebarUsername.textContent = `@${state.user.username || "me"}`;

  // Profile tab fields
  el.profileCardAvatar.src = avatarUrl;
  el.profileFullName.textContent = fullName;
  el.profileHandle.textContent = `@${state.user.username || "me"}`;
  el.profileUidBadge.textContent = `UID: ${state.user.uid || "..."}`;
  el.profileFirstName.value = state.user.first_name || "";
  el.profileLastName.value = state.user.last_name || "";
  el.profileEmail.textContent = state.user.email || "Đã liên kết";
}

// ================= Friends Management ================= //
async function loadFriends() {
  try {
    const res = await apiFetch("/api/friends");
    const friends = await res.json();
    state.friends = Array.isArray(friends) ? friends : [];

    el.friendsCount.textContent = state.friends.length;
    renderFriendsFilter();
    renderFriendsChecklist();
    renderFriendsGrid(state.friends);
    loadFriendRequests();
  } catch (err) {
    console.error("Load friends error:", err);
  }
}

function renderFriendsFilter() {
  const currentVal = el.feedFilterFriend.value;
  el.feedFilterFriend.innerHTML = `<option value="">👥 Tất cả bạn bè</option>`;
  state.friends.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.uid;
    const name = `${f.first_name || ""} ${f.last_name || ""}`.trim() || f.username;
    opt.textContent = `${name} (@${f.username || "friend"})`;
    el.feedFilterFriend.appendChild(opt);
  });
  el.feedFilterFriend.value = currentVal;
}

function renderFriendsChecklist() {
  el.friendsChecklist.innerHTML = "";
  state.friends.forEach(f => {
    const name = `${f.first_name || ""} ${f.last_name || ""}`.trim() || f.username;
    const item = document.createElement("label");
    item.className = "friend-check-item";
    item.innerHTML = `
      <input type="checkbox" name="post-recipient" value="${f.uid}">
      <img src="${f.profile_picture_url || getDefaultAvatar(name)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">
      <span style="font-size:13px;font-weight:600;">${name}</span>
    `;
    el.friendsChecklist.appendChild(item);
  });
}

function renderFriendsGrid(friendsList) {
  if (!friendsList || friendsList.length === 0) {
    el.friendsGrid.innerHTML = `
      <div class="chat-empty">
        <i class="fa-solid fa-user-group fa-2x"></i>
        <span>Không tìm thấy bạn bè nào</span>
      </div>
    `;
    return;
  }

  el.friendsGrid.innerHTML = "";
  friendsList.forEach(f => {
    const name = `${f.first_name || ""} ${f.last_name || ""}`.trim() || f.username;
    const card = document.createElement("div");
    card.className = "friend-card";
    card.innerHTML = `
      <img src="${f.profile_picture_url || getDefaultAvatar(name)}" alt="${name}" class="friend-card-avatar">
      <div class="friend-card-info">
        <h4 class="friend-card-name">${name}</h4>
        <span class="friend-card-handle">@${f.username || ""}</span>
      </div>
      <div class="friend-card-actions">
        <button class="btn btn-secondary btn-sm btn-open-chat" data-uid="${f.uid}" data-name="${name}" title="Nhắn tin">
          <i class="fa-regular fa-comment-dots"></i>
        </button>
      </div>
    `;

    card.querySelector(".btn-open-chat").addEventListener("click", () => {
      openChatWithFriend(f);
    });

    el.friendsGrid.appendChild(card);
  });
}

// Search friends filter
el.friendSearchInput.addEventListener("input", e => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderFriendsGrid(state.friends);
    return;
  }
  const filtered = state.friends.filter(f => {
    const fullName = `${f.first_name || ""} ${f.last_name || ""}`.toLowerCase();
    const username = (f.username || "").toLowerCase();
    return fullName.includes(query) || username.includes(query);
  });
  renderFriendsGrid(filtered);
});

// Send friend request
el.btnSendFriendRequest.addEventListener("click", async () => {
  const username = el.addFriendUsername.value.trim();
  if (!username) {
    showToast("Vui lòng nhập username Locket", "error");
    return;
  }

  el.btnSendFriendRequest.disabled = true;
  try {
    const res = await apiFetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Đã gửi lời mời kết bạn tới @${username}!`, "success");
      el.addFriendUsername.value = "";
    } else {
      showToast(data.error || "Không thể gửi lời mời.", "error");
    }
  } catch (e) {
    showToast("Lỗi gửi lời mời: " + e.message, "error");
  } finally {
    el.btnSendFriendRequest.disabled = false;
  }
});

// Load friend requests
async function loadFriendRequests() {
  try {
    const res = await apiFetch("/api/friends/requests");
    const data = await res.json();
    const incoming = data.incoming || [];
    if (incoming.length > 0) {
      el.friendRequestsBox.classList.remove("hidden");
      el.incomingRequestsList.innerHTML = "";
      incoming.forEach(req => {
        const item = document.createElement("div");
        item.className = "friend-card";
        item.innerHTML = `
          <div class="friend-card-info">
            <h4>Lời mời từ UID: ${req.user_uid || req.uid}</h4>
          </div>
          <button class="btn btn-primary btn-sm btn-accept" data-uid="${req.user_uid || req.uid}">
            <i class="fa-solid fa-check"></i> Chấp nhận
          </button>
        `;
        item.querySelector(".btn-accept").addEventListener("click", async () => {
          await acceptFriendRequest(req.user_uid || req.uid);
        });
        el.incomingRequestsList.appendChild(item);
      });
    } else {
      el.friendRequestsBox.classList.add("hidden");
    }
  } catch (e) {}
}

async function acceptFriendRequest(userUid) {
  try {
    const res = await apiFetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userUid })
    });
    if (res.ok) {
      showToast("Đã chấp nhận kết bạn!", "success");
      await loadFriends();
    }
  } catch (e) {
    showToast("Lỗi chấp nhận: " + e.message, "error");
  }
}

// ================= Presets Loading ================= //
async function loadPresets() {
  try {
    const res = await apiFetch("/api/presets");
    state.presets = await res.json();

    el.momentPresetSelect.innerHTML = `<option value="standard">Tiêu chuẩn (Standard)</option>`;

    // Group presets by section
    const grouped = {};
    for (const [key, preset] of Object.entries(state.presets)) {
      if (key === "standard") continue;
      const section = preset.section || "Khác";
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push({ key, ...preset });
    }

    for (const [sectionName, list] of Object.entries(grouped)) {
      const optGroup = document.createElement("optgroup");
      optGroup.label = sectionName;
      list.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.key;
        opt.textContent = `${p.icon ? p.icon + " " : ""}${p.text || p.key}`;
        optGroup.appendChild(opt);
      });
      el.momentPresetSelect.appendChild(optGroup);
    }
  } catch (err) {
    console.error("Load presets error:", err);
  }
}

// ================= Feed (Moments) ================= //
async function loadFeed(refresh = false) {
  if (refresh) {
    state.moments = [];
    state.nextPageToken = null;
  }

  el.feedContainer.innerHTML = `
    <div class="feed-loading">
      <div class="spinner"></div>
      <span>Đang tải khoảnh khắc...</span>
    </div>
  `;

  const filterFriend = el.feedFilterFriend.value;
  let url = `/api/moments?limit=24`;
  if (filterFriend) url += `&filteredByUserId=${encodeURIComponent(filterFriend)}`;

  try {
    const res = await apiFetch(url);
    const data = await res.json();

    state.moments = data.moments || [];
    state.nextPageToken = data.nextPageToken;

    renderFeed();
  } catch (err) {
    el.feedContainer.innerHTML = `
      <div class="chat-empty">
        <i class="fa-solid fa-triangle-exclamation text-danger fa-2x"></i>
        <span>Không thể tải khoảnh khắc: ${err.message}</span>
        <button class="btn btn-secondary btn-sm" onclick="loadFeed(true)">Thử lại</button>
      </div>
    `;
  }
}

function renderFeed() {
  if (!state.moments || state.moments.length === 0) {
    el.feedContainer.innerHTML = `
      <div class="chat-empty">
        <i class="fa-solid fa-camera fa-2x text-muted"></i>
        <span>Chưa có khoảnh khắc nào. Hãy đăng ảnh đầu tiên lên Locket!</span>
        <button class="btn btn-primary btn-sm mt-2" onclick="switchTab('post')">
          <i class="fa-solid fa-circle-plus"></i> Đăng khoảnh khắc ngay
        </button>
      </div>
    `;
    el.feedLoadMore.classList.add("hidden");
    return;
  }

  renderStoriesBar();
  el.feedContainer.innerHTML = "";

  state.moments.forEach(m => {
    const card = document.createElement("div");
    card.className = "moment-card";
    card.id = `moment-${m.moment_uid}`;

    const author = m.author || {};
    const authorName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
    const authorAvatar = author.profile_picture_url || getDefaultAvatar(authorName);
    const timeAgo = formatTimeAgo(m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null));

    // Media element
    const isVideo = Boolean(m.video_url);
    const mediaHtml = isVideo
      ? `<video src="${m.video_url}" poster="${m.thumbnail_url || m.image_url}" class="moment-media" playsinline loop autoplay muted></video>`
      : `<img src="${m.image_url || m.thumbnail_url}" alt="Moment" class="moment-media" loading="lazy">`;

    // Overlay style
    const overlay = (m.overlays && m.overlays[0]) ? m.overlays[0] : null;
    let overlayStyle = "";
    let overlayText = m.caption || "";
    let overlayIcon = "";

    if (overlay && overlay.data) {
      const data = overlay.data;
      if (data.text) overlayText = data.text;
      const formattedIcon = formatOverlayIcon(data.icon);
      if (formattedIcon) overlayIcon = `<span class="overlay-icon">${formattedIcon}</span>`;
      
      const colors = data.background && data.background.colors;
      if (Array.isArray(colors) && colors.length > 0) {
        if (colors.length === 1) {
          overlayStyle += `background: ${colors[0]}; `;
        } else {
          overlayStyle += `background: linear-gradient(135deg, ${colors.join(", ")}); `;
        }
      }
      if (data.text_color) {
        overlayStyle += `color: ${data.text_color}; `;
      }
    }

    const overlayHtml = overlayText
      ? `<div class="locket-overlay" style="${overlayStyle}">${overlayIcon}<span class="overlay-text">${escapeHtml(overlayText)}</span></div>`
      : "";

    // Delete button if author is me
    const isMe = author.is_me;
    const deleteBtnHtml = isMe
      ? `<button class="btn-icon text-danger btn-delete-moment" data-uid="${m.moment_uid}" title="Xóa khoảnh khắc"><i class="fa-regular fa-trash-can"></i></button>`
      : "";

    card.innerHTML = `
      <div class="moment-header">
        <div class="moment-author">
          <img src="${authorAvatar}" alt="${authorName}" class="author-avatar">
          <div class="author-info">
            <span class="author-name">${escapeHtml(authorName)}</span>
            <span class="moment-time">${timeAgo}</span>
          </div>
        </div>
        ${deleteBtnHtml}
      </div>

      <div class="moment-media-wrapper">
        ${mediaHtml}
        ${overlayHtml}
      </div>

      <div class="moment-footer">
        <div class="quick-reactions-bar">
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="❤️">❤️</button>
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="🔥">🔥</button>
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="😍">😍</button>
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="😂">😂</button>
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="🥰">🥰</button>
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="🫶">🫶</button>
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="💛">💛</button>
          <button class="reaction-emoji-btn" data-moment="${m.moment_uid}" data-emoji="😭">😭</button>
        
        <div class="moment-comment-row">
          <input type="text" class="moment-comment-input" placeholder="Phản hồi tới ${escapeHtml(authorName)}..." data-moment="${m.moment_uid}" data-receiver="${m.user_uid}">
          <button class="btn btn-primary btn-sm btn-send-comment" title="Gửi"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
</div>

        <div class="moment-meta-bar">
          <span class="views-pill btn-view-reactions" data-uid="${m.moment_uid}">
            <i class="fa-solid fa-eye"></i> Xem cảm xúc & lượt xem
          </span>
          <div style="display:flex;gap:6px;">
            <span class="views-pill btn-download-moment" data-url="${m.image_url || m.video_url}" title="Tải về">
              <i class="fa-solid fa-download"></i>
            </span>
            <span class="views-pill btn-share-moment" data-url="${m.image_url || m.video_url}" title="Sao chép liên kết">
              <i class="fa-solid fa-arrow-up-from-bracket"></i>
            </span>
          </div>
        </div>
      </div>
    `;

    // Click to open lightbox
    const mediaEl = card.querySelector(".moment-media");
    if (mediaEl) {
      mediaEl.style.cursor = "pointer";
      mediaEl.addEventListener("click", () => {
        openLightbox(m.image_url || m.video_url, isVideo);
      });
    }

    // Download button
    card.querySelector(".btn-download-moment").addEventListener("click", () => {
      const url = m.image_url || m.video_url;
      const a = document.createElement("a");
      a.href = url;
      a.download = `locket-${m.moment_uid}`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    
    // Attach comment send
    const commentInput = card.querySelector(".moment-comment-input");
    const commentBtn = card.querySelector(".btn-send-comment");
    const sendCardComment = async () => {
      const text = commentInput.value.trim();
      if (!text) return;
      commentInput.value = "";
      playPopSound();
      try {
        const res = await apiFetch("/api/moments/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ momentUid: m.moment_uid, receiverUid: m.user_uid, text })
        });
        if (res.ok) {
          showToast(`Đã gửi phản hồi tới ${authorName}!`, "success");
        } else {
          showToast("Không thể gửi phản hồi.", "error");
        }
      } catch (e) {
        showToast("Lỗi gửi phản hồi: " + e.message, "error");
      }
    };
    if (commentBtn) commentBtn.addEventListener("click", sendCardComment);
    if (commentInput) {
      commentInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendCardComment();
        }
      });
    }

    // Attach reaction click
    card.querySelectorAll(".reaction-emoji-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const momentUid = btn.dataset.moment;
        const emoji = btn.dataset.emoji;
        sendReaction(momentUid, emoji, btn);
      });
    });

    // Attach view reactions modal
    card.querySelector(".btn-view-reactions").addEventListener("click", () => {
      openViewsModal(m.moment_uid);
    });

    // Attach delete
    if (isMe) {
      card.querySelector(".btn-delete-moment").addEventListener("click", () => {
        deleteMoment(m.moment_uid);
      });
    }

    // Attach share
    card.querySelector(".btn-share-moment").addEventListener("click", () => {
      navigator.clipboard.writeText(m.image_url || m.video_url);
      showToast("Đã sao chép liên kết media vào bộ nhớ tạm!", "success");
    });

    el.feedContainer.appendChild(card);
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Send reaction
async function sendReaction(momentUid, emoji, btnElement) {
  playPopSound();
  try {
    // Pop animation on button
    btnElement.style.transform = "scale(1.5)";
    setTimeout(() => { btnElement.style.transform = ""; }, 250);

    const res = await apiFetch("/api/moments/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ momentUid, reaction: emoji })
    });
    if (res.ok) {
      showToast(`Đã thả cảm xúc ${emoji}!`, "success");
    }
  } catch (e) {
    showToast("Lỗi thả cảm xúc: " + e.message, "error");
  }
}

// Delete moment
async function deleteMoment(momentUid) {
  if (!confirm("Bạn có chắc chắn muốn xóa khoảnh khắc này khỏi Locket?")) return;
  try {
    const res = await apiFetch(`/api/moments/${momentUid}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Đã xóa khoảnh khắc.", "success");
      const card = document.getElementById(`moment-${momentUid}`);
      if (card) card.remove();
      state.moments = state.moments.filter(m => m.moment_uid !== momentUid);
    } else {
      showToast("Không thể xóa khoảnh khắc.", "error");
    }
  } catch (e) {
    showToast("Lỗi xóa: " + e.message, "error");
  }
}

// Open Views & Reactions Modal
async function openViewsModal(momentUid) {
  el.viewsModal.classList.remove("hidden");
  el.viewsModalBody.innerHTML = `
    <div class="feed-loading">
      <div class="spinner"></div>
      <span>Đang tải thông tin lượt xem...</span>
    </div>
  `;

  try {
    const res = await apiFetch(`/api/moments/${momentUid}/views`);
    const data = await res.json();

    const viewsCount = data.count || data.num_views || 0;
    const reactions = data.reactions || [];

    let reactionsHtml = "";
    if (reactions.length > 0) {
      reactionsHtml = `
        <div style="margin-top:16px;">
          <h4 style="font-size:14px;margin-bottom:8px;color:var(--text-secondary);">Biểu cảm đã thả:</h4>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${reactions.map(r => `<span style="background:var(--bg-tertiary);padding:6px 12px;border-radius:20px;font-size:18px;">${r.emoji}</span>`).join("")}
          </div>
        </div>
      `;
    }

    el.viewsModalBody.innerHTML = `
      <div style="text-align:center;padding:16px 0;">
        <i class="fa-solid fa-eye fa-3x text-yellow"></i>
        <h3 style="margin-top:12px;font-size:24px;">${viewsCount} Lượt Xem</h3>
        <p style="color:var(--text-muted);font-size:13px;">Số bạn bè đã xem khoảnh khắc này trên widget</p>
        ${reactionsHtml}
      </div>
    `;
  } catch (err) {
    el.viewsModalBody.innerHTML = `<p class="text-danger">Không thể tải thông tin: ${err.message}</p>`;
  }
}

el.btnCloseViewsModal.addEventListener("click", () => {
  el.viewsModal.classList.add("hidden");
});
el.viewsModal.addEventListener("click", e => {
  if (e.target === el.viewsModal) el.viewsModal.classList.add("hidden");
});

// Refresh feed
el.btnRefreshFeed.addEventListener("click", () => {
  loadFeed(true);
});
el.feedFilterFriend.addEventListener("change", () => {
  loadFeed(true);
});

// ================= Post Studio & Upload ================= //

// File input click & drag-drop
el.btnChooseFile.addEventListener("click", () => el.momentFileInput.click());
el.dropZone.addEventListener("click", e => {
  if (e.target !== el.btnRemoveFile && !el.btnRemoveFile.contains(e.target)) {
    el.momentFileInput.click();
  }
});

["dragenter", "dragover"].forEach(eventName => {
  el.dropZone.addEventListener(eventName, e => {
    e.preventDefault();
    el.dropZone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach(eventName => {
  el.dropZone.addEventListener(eventName, e => {
    e.preventDefault();
    el.dropZone.classList.remove("dragover");
  });
});
el.dropZone.addEventListener("drop", e => {
  const files = e.dataTransfer.files;
  if (files.length > 0) handleFileSelected(files[0]);
});
el.momentFileInput.addEventListener("change", e => {
  if (e.target.files.length > 0) handleFileSelected(e.target.files[0]);
});

function handleFileSelected(file) {
  state.selectedFile = file;
  const isVideo = file.type.startsWith("video/") || file.name.match(/\.(mp4|mov|webm)$/i);
  state.selectedFileType = isVideo ? "video" : "image";

  // Update file info pill
  el.fileName.textContent = file.name;
  el.fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  el.uploadZoneContent.classList.add("hidden");
  el.selectedFileInfo.classList.remove("hidden");

  // Show live preview in phone screen
  el.previewPlaceholder.classList.add("hidden");
  const fileUrl = URL.createObjectURL(file);

  if (isVideo) {
    el.previewImage.classList.add("hidden");
    el.previewVideo.src = fileUrl;
    el.previewVideo.classList.remove("hidden");
    el.previewVideo.play().catch(() => {});
  } else {
    el.previewVideo.classList.add("hidden");
    el.previewVideo.pause();
    el.previewImage.src = fileUrl;
    el.previewImage.classList.remove("hidden");
  }

  updateLiveOverlay();
}

el.btnRemoveFile.addEventListener("click", e => {
  e.stopPropagation();
  resetFileSelection();
});

function resetFileSelection() {
  state.selectedFile = null;
  state.selectedFileType = null;
  el.momentFileInput.value = "";
  el.uploadZoneContent.classList.remove("hidden");
  el.selectedFileInfo.classList.add("hidden");

  el.previewImage.classList.add("hidden");
  el.previewImage.src = "";
  el.previewVideo.classList.add("hidden");
  el.previewVideo.src = "";
  el.previewPlaceholder.classList.remove("hidden");
  updateLiveOverlay();
}

// Live Overlay preview updating
function updateLiveOverlay() {
  const caption = el.momentCaption.value.trim();
  const hasFile = Boolean(state.selectedFile);

  if (!caption && !hasFile) {
    el.previewOverlay.classList.add("hidden");
    return;
  }

  el.previewOverlay.classList.remove("hidden");
  const isCustom = el.toggleCustomStyle.checked;

  if (isCustom) {
    const col1 = el.colorPicker1.value;
    const col2 = el.colorPicker2.value;
    const textCol = el.colorPickerText.value;
    const emoji = el.customEmojiInput.value.trim();

    el.previewOverlay.style.background = `linear-gradient(135deg, ${col1}, ${col2})`;
    el.overlayText.style.color = textCol;
    el.overlayIcon.textContent = emoji;
    el.overlayText.textContent = caption || "Xem trước nhãn";
  } else {
    const selectedPresetKey = el.momentPresetSelect.value;
    const preset = state.presets[selectedPresetKey];

    if (preset && preset.colors && preset.colors.length > 0) {
      if (preset.colors.length === 1) {
        el.previewOverlay.style.background = preset.colors[0];
      } else {
        el.previewOverlay.style.background = `linear-gradient(135deg, ${preset.colors.join(", ")})`;
      }
    } else {
      el.previewOverlay.style.background = "rgba(0, 0, 0, 0.55)";
    }

    el.overlayText.style.color = (preset && preset.text_color) || "#ffffff";
    el.overlayIcon.textContent = (preset && preset.icon) || "";
    el.overlayText.textContent = caption || (preset && preset.text) || "Caption xem trước";
  }
}

// Event listeners for post inputs
el.momentCaption.addEventListener("input", e => {
  el.captionCount.textContent = `${e.target.value.length}/150`;
  updateLiveOverlay();
});

el.momentPresetSelect.addEventListener("change", updateLiveOverlay);

el.toggleCustomStyle.addEventListener("change", e => {
  if (e.target.checked) {
    el.customColorsBox.classList.remove("hidden");
  } else {
    el.customColorsBox.classList.add("hidden");
  }
  updateLiveOverlay();
});

[el.colorPicker1, el.colorPicker2, el.colorPickerText, el.customEmojiInput].forEach(inp => {
  inp.addEventListener("input", updateLiveOverlay);
});

// Recipients radios
el.recipientRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.value === "custom" && radio.checked) {
      el.friendsChecklist.classList.remove("hidden");
    } else {
      el.friendsChecklist.classList.add("hidden");
    }
  });
});

// POST MOMENT SUBMIT
el.btnPostMoment.addEventListener("click", async () => {
  if (!state.selectedFile) {
    showToast("Vui lòng chọn ảnh hoặc video trước khi đăng!", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", state.selectedFile);
  formData.append("caption", el.momentCaption.value.trim());

  const isCustom = el.toggleCustomStyle.checked;
  if (isCustom) {
    const colors = [el.colorPicker1.value, el.colorPicker2.value];
    formData.append("colors", JSON.stringify(colors));
    formData.append("textColor", el.colorPickerText.value);
    if (el.customEmojiInput.value.trim()) {
      formData.append("icon", el.customEmojiInput.value.trim());
    }
    formData.append("noteType", "standard");
  } else {
    formData.append("noteType", el.momentPresetSelect.value || "standard");
  }

  // Recipients
  const mode = document.querySelector("input[name='recipient-mode']:checked").value;
  if (mode === "custom") {
    const checked = Array.from(document.querySelectorAll("input[name='post-recipient']:checked")).map(cb => cb.value);
    if (checked.length > 0) {
      formData.append("recipients", JSON.stringify(checked));
    }
  }

  // Upload with progress
  el.btnPostMoment.disabled = true;
  el.postProgressBox.classList.remove("hidden");
  el.postProgressBar.style.width = "0%";
  el.postProgressText.textContent = "Đang bắt đầu tải lên...";

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/moments/post");
  const sessToken = getSessionToken();
  if (sessToken) xhr.setRequestHeader("x-locket-session", sessToken);

  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 90);
      el.postProgressBar.style.width = `${percent}%`;
      el.postProgressText.textContent = `Đang tải lên: ${percent}%...`;
    }
  };

  xhr.onload = async () => {
    el.btnPostMoment.disabled = false;
    el.postProgressBox.classList.add("hidden");

    if (xhr.status >= 200 && xhr.status < 300) {
      showToast("🎉 Đăng khoảnh khắc lên Locket thành công!", "success");
      // Reset form
      resetFileSelection();
      el.momentCaption.value = "";
      el.captionCount.textContent = "0/150";
      // Switch to feed and refresh
      switchTab("feed");
      await loadFeed(true);
    } else {
      let errMsg = "Đăng thất bại.";
      try {
        const res = JSON.parse(xhr.responseText);
        errMsg = res.message || res.error || errMsg;
      } catch (e) {}
      showToast(errMsg, "error");
    }
  };

  xhr.onerror = () => {
    el.btnPostMoment.disabled = false;
    el.postProgressBox.classList.add("hidden");
    showToast("Lỗi kết nối máy chủ khi đăng media.", "error");
  };

  el.postProgressText.textContent = "Đang xử lý nén chuẩn Apple HEVC và upload...";
  xhr.send(formData);
});

// ================= Chat Management ================= //
async function loadConversations() {
  try {
    const res = await apiFetch("/api/chat/conversations");
    const convs = await res.json();

    if (!Array.isArray(convs) || convs.length === 0) {
      el.conversationsList.innerHTML = `<div class="chat-empty">Chưa có cuộc trò chuyện nào</div>`;
      return;
    }

    el.conversationsList.innerHTML = "";
    convs.forEach(c => {
      const peer = c.peer || {};
      const peerName = `${peer.first_name || ""} ${peer.last_name || ""}`.trim() || peer.username || "Bạn bè";
      const peerAvatar = peer.profile_picture_url || getDefaultAvatar(peerName);
      const snippet = c.latest_message ? c.latest_message.text : "Đã bắt đầu cuộc trò chuyện";
      const time = c.latest_message ? formatTimeAgo(c.latest_message.timestamp) : "";

      const item = document.createElement("div");
      item.className = "conv-item";
      if (state.activeChatPeer && state.activeChatPeer.uid === c.peer_uid) {
        item.classList.add("active");
      }

      item.innerHTML = `
        <img src="${peerAvatar}" alt="${peerName}" class="conv-avatar">
        <div class="conv-details">
          <div class="conv-top">
            <span class="conv-name">${escapeHtml(peerName)}</span>
            <span class="conv-time">${time}</span>
          </div>
          <span class="conv-snippet">${escapeHtml(snippet)}</span>
        </div>
      `;

      item.addEventListener("click", () => {
        openChatWithFriend({
          uid: c.peer_uid,
          first_name: peer.first_name,
          last_name: peer.last_name,
          username: peer.username,
          profile_picture_url: peer.profile_picture_url
        });
      });

      el.conversationsList.appendChild(item);
    });
  } catch (err) {
    console.error("Load conversations error:", err);
  }
}

async function openChatWithFriend(friend) {
  state.activeChatPeer = friend;
  switchTab("chat");

  const name = `${friend.first_name || ""} ${friend.last_name || ""}`.trim() || friend.username || "Bạn bè";
  const avatar = friend.profile_picture_url || getDefaultAvatar(name);

  el.chatPeerAvatar.src = avatar;
  el.chatPeerName.textContent = name;
  el.chatPeerUsername.textContent = `@${friend.username || ""}`;

  el.chatHeader.classList.remove("hidden");
  el.chatInputBar.classList.remove("hidden");

  // Load messages
  el.chatMessagesWrap.innerHTML = `
    <div class="chat-empty">
      <div class="spinner"></div>
      <span>Đang tải tin nhắn...</span>
    </div>
  `;

  try {
    const res = await apiFetch(`/api/chat/messages?otherUserId=${encodeURIComponent(friend.uid)}`);
    const messages = await res.json();
    renderChatMessages(messages);
  } catch (err) {
    el.chatMessagesWrap.innerHTML = `<div class="chat-empty text-danger">Không thể tải tin nhắn: ${err.message}</div>`;
  }
}

function renderChatMessages(messages) {
  if (!messages || messages.length === 0) {
    el.chatMessagesWrap.innerHTML = `
      <div class="chat-no-selected">
        <i class="fa-regular fa-comment-dots fa-3x text-yellow"></i>
        <p>Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn đầu tiên!</p>
      </div>
    `;
    return;
  }

  el.chatMessagesWrap.innerHTML = "";
  messages.forEach(msg => {
    const isMe = msg.is_me;
    const time = msg.timestamp ? formatTimeAgo(msg.timestamp) : "";

    const wrap = document.createElement("div");
    wrap.className = `msg-bubble-wrap ${isMe ? "me" : "other"}`;
    wrap.innerHTML = `
      <div class="msg-bubble">${escapeHtml(msg.text || "")}</div>
      <span class="msg-time">${time}</span>
    `;
    el.chatMessagesWrap.appendChild(wrap);
  });

  // Scroll to bottom
  el.chatMessagesWrap.scrollTop = el.chatMessagesWrap.scrollHeight;
}

// Send chat message
async function sendChatMessage() {
  if (!state.activeChatPeer) return;
  const text = el.chatTextInput.value.trim();
  if (!text) return;

  el.chatTextInput.value = "";
  el.chatTextInput.focus();

  // Optimistic UI append
  const tempWrap = document.createElement("div");
  tempWrap.className = "msg-bubble-wrap me";
  tempWrap.innerHTML = `
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <span class="msg-time">Vừa xong</span>
  `;
  el.chatMessagesWrap.appendChild(tempWrap);
  el.chatMessagesWrap.scrollTop = el.chatMessagesWrap.scrollHeight;

  try {
    const res = await apiFetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiverUid: state.activeChatPeer.uid,
        text
      })
    });
    if (!res.ok) {
      showToast("Không thể gửi tin nhắn.", "error");
    }
  } catch (e) {
    showToast("Lỗi gửi tin nhắn: " + e.message, "error");
  }
}

el.btnSendMessage.addEventListener("click", sendChatMessage);
el.chatTextInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

// ================= Profile Tab ================= //
el.btnSaveName.addEventListener("click", async () => {
  const firstName = el.profileFirstName.value.trim();
  const lastName = el.profileLastName.value.trim();

  el.btnSaveName.disabled = true;
  try {
    const res = await apiFetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName })
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Cập nhật họ tên thành công!", "success");
      state.user = data.profile;
      renderCurrentUser();
    } else {
      showToast(data.error || "Không thể cập nhật tên.", "error");
    }
  } catch (e) {
    showToast("Lỗi: " + e.message, "error");
  } finally {
    el.btnSaveName.disabled = false;
  }
});

// Change avatar
el.avatarFileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("avatar", file);

  showToast("Đang cập nhật ảnh đại diện...", "info");
  try {
    const res = await apiFetch("/api/user/avatar", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Cập nhật ảnh đại diện thành công!", "success");
      state.user = data.profile;
      renderCurrentUser();
    } else {
      showToast(data.error || "Không thể cập nhật ảnh.", "error");
    }
  } catch (err) {
    showToast("Lỗi đổi avatar: " + err.message, "error");
  }
});

// ================= Camera & Lightbox Management ================= //
let webcamStream = null;
let currentFacingMode = "user";
let currentLightboxUrl = "";

const btnOpenCamera = document.getElementById("btn-open-camera");
const cameraModal = document.getElementById("camera-modal");
const btnCloseCameraModal = document.getElementById("btn-close-camera-modal");
const webcamVideo = document.getElementById("webcam-video");
const webcamCanvas = document.getElementById("webcam-canvas");
const btnTakeSnapshot = document.getElementById("btn-take-snapshot");
const btnSwitchCamera = document.getElementById("btn-switch-camera");

const lightboxModal = document.getElementById("lightbox-modal");
const lightboxContent = document.getElementById("lightbox-content");
const btnCloseLightbox = document.getElementById("btn-close-lightbox");
const btnDownloadLightbox = document.getElementById("btn-download-lightbox");

async function startCamera() {
  stopCamera();
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false
    });
    webcamVideo.srcObject = webcamStream;
    cameraModal.classList.remove("hidden");
  } catch (err) {
    showToast("Không thể mở camera: " + err.message, "error");
  }
}

function stopCamera() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  if (cameraModal) cameraModal.classList.add("hidden");
}

if (btnOpenCamera) {
  btnOpenCamera.addEventListener("click", () => {
    startCamera();
  });
}

if (btnCloseCameraModal) {
  btnCloseCameraModal.addEventListener("click", stopCamera);
}

if (btnSwitchCamera) {
  btnSwitchCamera.addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    startCamera();
  });
}

if (btnTakeSnapshot) {
  btnTakeSnapshot.addEventListener("click", () => {
    playShutterSound();
    if (!webcamVideo.videoWidth) return;
    const size = Math.min(webcamVideo.videoWidth, webcamVideo.videoHeight);
    webcamCanvas.width = size;
    webcamCanvas.height = size;

    const ctx = webcamCanvas.getContext("2d");
    const startX = (webcamVideo.videoWidth - size) / 2;
    const startY = (webcamVideo.videoHeight - size) / 2;

    if (currentFacingMode === "user") {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(webcamVideo, startX, startY, size, size, 0, 0, size, size);

    webcamCanvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `locket-${Date.now()}.jpg`, { type: "image/jpeg" });
        handleFileSelected(file);
        stopCamera();
        showToast("Đã chụp ảnh từ Camera thành công!", "success");
      }
    }, "image/jpeg", 0.95);
  });
}

// Lightbox
function openLightbox(mediaUrl, isVideo = false) {
  currentLightboxUrl = mediaUrl;
  lightboxContent.innerHTML = isVideo
    ? `<video src="${mediaUrl}" class="lightbox-video" controls autoplay playsinline loop></video>`
    : `<img src="${mediaUrl}" class="lightbox-img" alt="Lightbox">`;
  lightboxModal.classList.remove("hidden");
}

if (btnCloseLightbox) {
  btnCloseLightbox.addEventListener("click", () => {
    lightboxModal.classList.add("hidden");
    lightboxContent.innerHTML = "";
  });
}
if (lightboxModal) {
  lightboxModal.addEventListener("click", e => {
    if (e.target === lightboxModal) {
      lightboxModal.classList.add("hidden");
      lightboxContent.innerHTML = "";
    }
  });
}
if (btnDownloadLightbox) {
  btnDownloadLightbox.addEventListener("click", () => {
    if (!currentLightboxUrl) return;
    const a = document.createElement("a");
    a.href = currentLightboxUrl;
    a.download = `locket-moment-${Date.now()}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}


// ================= STORIES BAR & FULLSCREEN STORY VIEWER ================= //
function renderStoriesBar() {
  const bar = document.getElementById("stories-bar");
  if (!bar) return;

  const userMap = new Map();
  state.moments.forEach(m => {
    const uid = m.user_uid;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        author: m.author,
        moments: []
      });
    }
    userMap.get(uid).moments.push(m);
  });

  if (userMap.size === 0) {
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = "";
  for (const [uid, group] of userMap.entries()) {
    const author = group.author || {};
    const name = author.is_me ? "Tôi" : (author.first_name || author.username || "Bạn bè");
    const avatar = author.profile_picture_url || getDefaultAvatar(name);

    const item = document.createElement("div");
    item.className = "story-circle-item";
    item.innerHTML = `
      <div class="story-avatar-ring">
        <img src="${avatar}" alt="${name}" class="story-avatar-img">
      </div>
      <span class="story-user-label">${escapeHtml(name)}</span>
    `;

    item.addEventListener("click", () => {
      openStoryViewer(uid);
    });

    bar.appendChild(item);
  }
}

let activeStoryMoments = [];
let activeStoryIndex = 0;
let storyTimer = null;

function openStoryViewer(userUid) {
  activeStoryMoments = state.moments.filter(m => m.user_uid === userUid);
  if (!activeStoryMoments.length) return;
  activeStoryIndex = 0;

  const modal = document.getElementById("story-viewer-modal");
  if (modal) modal.classList.remove("hidden");

  renderStorySlide();
}

function renderStorySlide() {
  clearTimeout(storyTimer);
  const m = activeStoryMoments[activeStoryIndex];
  if (!m) {
    closeStoryViewer();
    return;
  }

  const progContainer = document.getElementById("story-progress-segments");
  if (progContainer) {
    progContainer.innerHTML = "";
    activeStoryMoments.forEach((_, idx) => {
      const seg = document.createElement("div");
      seg.className = "story-segment";
      const fill = document.createElement("div");
      fill.className = `story-segment-fill ${idx < activeStoryIndex ? "completed" : ""}`;
      if (idx === activeStoryIndex) fill.id = "active-story-fill";
      seg.appendChild(fill);
      progContainer.appendChild(seg);
    });
  }

  const author = m.author || {};
  const name = author.is_me ? "Khoảnh khắc của tôi" : (`${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè");
  const authorNameEl = document.getElementById("story-author-name");
  const authorAvatarEl = document.getElementById("story-author-avatar");
  const timeAgoEl = document.getElementById("story-time-ago");

  if (authorNameEl) authorNameEl.textContent = name;
  if (authorAvatarEl) authorAvatarEl.src = author.profile_picture_url || getDefaultAvatar(name);
  if (timeAgoEl) timeAgoEl.textContent = formatTimeAgo(m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null));

  const img = document.getElementById("story-img");
  const vid = document.getElementById("story-vid");
  const isVideo = Boolean(m.video_url);

  if (isVideo) {
    if (img) img.classList.add("hidden");
    if (vid) {
      vid.classList.remove("hidden");
      vid.src = m.video_url;
      vid.currentTime = 0;
      vid.play().catch(() => {});
      vid.onended = () => nextStorySlide();
    }
  } else {
    if (vid) {
      vid.classList.add("hidden");
      vid.pause();
    }
    if (img) {
      img.classList.remove("hidden");
      img.src = m.image_url || m.thumbnail_url;
    }
  }

  const overlayPill = document.getElementById("story-overlay-pill");
  const overlay = (m.overlays && m.overlays[0]) ? m.overlays[0] : null;
  if (overlayPill) {
    if (m.caption || (overlay && overlay.data && overlay.data.text)) {
      overlayPill.classList.remove("hidden");
      let txt = m.caption || "";
      let icon = "";
      if (overlay && overlay.data) {
        if (overlay.data.text) txt = overlay.data.text;
        const formattedIcon = formatOverlayIcon(overlay.data.icon);
        if (formattedIcon) icon = formattedIcon;
      }
      document.getElementById("story-overlay-text").textContent = txt;
      document.getElementById("story-overlay-icon").textContent = icon;
    } else {
      overlayPill.classList.add("hidden");
    }
  }

  const duration = isVideo ? 15000 : 5000;
  const activeFill = document.getElementById("active-story-fill");
  if (activeFill) {
    activeFill.style.transition = `width ${duration}ms linear`;
    setTimeout(() => { activeFill.style.width = "100%"; }, 25);
  }

  if (!isVideo) {
    storyTimer = setTimeout(() => {
      nextStorySlide();
    }, duration);
  }
}

function nextStorySlide() {
  if (activeStoryIndex < activeStoryMoments.length - 1) {
    activeStoryIndex++;
    renderStorySlide();
  } else {
    closeStoryViewer();
  }
}

function prevStorySlide() {
  if (activeStoryIndex > 0) {
    activeStoryIndex--;
    renderStorySlide();
  } else {
    renderStorySlide();
  }
}

function closeStoryViewer() {
  clearTimeout(storyTimer);
  const vid = document.getElementById("story-vid");
  if (vid) vid.pause();
  const modal = document.getElementById("story-viewer-modal");
  if (modal) modal.classList.add("hidden");
}

function triggerFloatingEmoji(emoji) {
  playPopSound();
  const container = document.getElementById("story-floating-reactions");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "floating-emoji";
  el.textContent = emoji;
  el.style.left = `${25 + Math.random() * 50}%`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

// Touch controls for Story Viewer
const touchPrev = document.getElementById("story-touch-prev");
const touchNext = document.getElementById("story-touch-next");
const btnCloseStory = document.getElementById("btn-close-story");
const btnSoundStory = document.getElementById("btn-sound-toggle-story");

if (touchPrev) touchPrev.addEventListener("click", prevStorySlide);
if (touchNext) touchNext.addEventListener("click", nextStorySlide);
if (btnCloseStory) btnCloseStory.addEventListener("click", closeStoryViewer);

if (btnSoundStory) {
  btnSoundStory.addEventListener("click", () => {
    const vid = document.getElementById("story-vid");
    if (vid) {
      vid.muted = !vid.muted;
      btnSoundStory.innerHTML = vid.muted
        ? '<i class="fa-solid fa-volume-xmark"></i>'
        : '<i class="fa-solid fa-volume-high"></i>';
    }
  });
}

// Story Quick Reaction buttons
document.querySelectorAll(".story-reaction-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const emoji = btn.dataset.emoji;
    const m = activeStoryMoments[activeStoryIndex];
    if (m) {
      triggerFloatingEmoji(emoji);
      apiFetch("/api/moments/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ momentUid: m.moment_uid, reaction: emoji })
      }).catch(() => {});
    }
  });
});

// Story Reply input
const storyReplyInput = document.getElementById("story-reply-input");
const btnSendStoryReply = document.getElementById("btn-send-story-reply");
const sendStoryReply = async () => {
  if (!storyReplyInput) return;
  const text = storyReplyInput.value.trim();
  const m = activeStoryMoments[activeStoryIndex];
  if (!text || !m) return;
  storyReplyInput.value = "";
  playPopSound();
  try {
    const res = await apiFetch("/api/moments/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ momentUid: m.moment_uid, receiverUid: m.user_uid, text })
    });
    if (res.ok) {
      showToast("Đã gửi phản hồi vào tin nhắn!", "success");
    }
  } catch (e) {
    showToast("Lỗi gửi tin nhắn", "error");
  }
};
if (btnSendStoryReply) btnSendStoryReply.addEventListener("click", sendStoryReply);
if (storyReplyInput) {
  storyReplyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendStoryReply();
    }
  });
}

// Global Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  const storyModal = document.getElementById("story-viewer-modal");
  const isStoryOpen = storyModal && !storyModal.classList.contains("hidden");

  if (e.key === "Escape") {
    if (isStoryOpen) closeStoryViewer();
    const lb = document.getElementById("lightbox-modal");
    if (lb && !lb.classList.contains("hidden")) lb.classList.add("hidden");
    const cam = document.getElementById("camera-modal");
    if (cam && !cam.classList.contains("hidden")) stopCamera();
  } else if (isStoryOpen) {
    if (e.key === "ArrowLeft") prevStorySlide();
    if (e.key === "ArrowRight") nextStorySlide();
  }
});


// ================= THEME SWITCHER (Gold, Purple, Blue, Pink, AMOLED) ================= //
const THEMES = [
  { id: "gold", name: "Locket Classic Gold 💛" },
  { id: "purple", name: "Cyberpunk Purple 💜" },
  { id: "blue", name: "Deep Ocean Blue 💙" },
  { id: "pink", name: "Sakura Pink 💖" },
  { id: "amoled", name: "Pure AMOLED Black 🖤" }
];
let currentThemeIndex = 0;

function applyTheme(themeId) {
  if (themeId === "gold") {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.setAttribute("data-theme", themeId);
  }
  localStorage.setItem("locket_theme", themeId);
}

function initTheme() {
  const savedTheme = localStorage.getItem("locket_theme") || "gold";
  const idx = THEMES.findIndex(t => t.id === savedTheme);
  currentThemeIndex = idx >= 0 ? idx : 0;
  applyTheme(savedTheme);
}

function cycleTheme() {
  playPopSound();
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  const theme = THEMES[currentThemeIndex];
  applyTheme(theme.id);
  showToast(`Đã chuyển sang chủ đề: ${theme.name}`, "info");
}

const btnTheme = document.getElementById("btn-theme-switcher");
const btnMobileTheme = document.getElementById("btn-mobile-theme");
if (btnTheme) btnTheme.addEventListener("click", cycleTheme);
if (btnMobileTheme) btnMobileTheme.addEventListener("click", cycleTheme);
initTheme();

// ================= PHOTO FILTERS & MUSIC STICKER IN STUDIO ================= //
let currentFilter = "normal";

document.querySelectorAll(".filter-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    playPopSound();
    document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;

    const img = document.getElementById("preview-image");
    const vid = document.getElementById("preview-video");
    ["filter-vintage", "filter-cyberpunk", "filter-bw", "filter-sunset", "filter-cold"].forEach(c => {
      if (img) img.classList.remove(c);
      if (vid) vid.classList.remove(c);
    });

    if (currentFilter !== "normal") {
      const cls = `filter-${currentFilter}`;
      if (img) img.classList.add(cls);
      if (vid) vid.classList.add(cls);
    }
  });
});

// Quick Sticker Chips
document.querySelectorAll(".sticker-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    playPopSound();
    const text = chip.dataset.text;
    const inp = document.getElementById("moment-caption");
    if (inp) {
      inp.value = inp.value ? `${inp.value} ${text}` : text;
      inp.dispatchEvent(new Event("input"));
    }
  });
});

// Music Sticker Toggle
const toggleMusic = document.getElementById("toggle-music-sticker");
const musicBox = document.getElementById("music-sticker-box");
const musicBadge = document.getElementById("preview-music-badge");
const songInput = document.getElementById("music-song-name");
const artistInput = document.getElementById("music-artist-name");

function updateMusicPreview() {
  if (!toggleMusic || !toggleMusic.checked) {
    if (musicBadge) musicBadge.classList.add("hidden");
    return;
  }
  if (musicBadge) musicBadge.classList.remove("hidden");
  const s = songInput ? songInput.value.trim() : "";
  const a = artistInput ? artistInput.value.trim() : "";
  const songEl = document.getElementById("music-preview-song");
  const artistEl = document.getElementById("music-preview-artist");
  if (songEl) songEl.textContent = s || "Tên bài hát";
  if (artistEl) artistEl.textContent = a || "Nghệ sĩ";
}

if (toggleMusic) {
  toggleMusic.addEventListener("change", (e) => {
    if (e.target.checked) {
      if (musicBox) musicBox.classList.remove("hidden");
    } else {
      if (musicBox) musicBox.classList.add("hidden");
    }
    updateMusicPreview();
  });
}
if (songInput) songInput.addEventListener("input", updateMusicPreview);
if (artistInput) artistInput.addEventListener("input", updateMusicPreview);

// ================= DATE MEMORY FILTER IN FEED ================= //
const feedDateFilter = document.getElementById("feed-filter-date");
if (feedDateFilter) {
  feedDateFilter.addEventListener("change", (e) => {
    const selectedDate = e.target.value;
    if (!selectedDate) {
      renderFeed();
      return;
    }
    const filtered = state.moments.filter(m => {
      const d = m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null);
      if (!d) return false;
      const isoDate = new Date(d).toISOString().split("T")[0];
      return isoDate === selectedDate;
    });

    if (filtered.length === 0) {
      showToast(`Không có khoảnh khắc nào trong ngày ${selectedDate}`, "info");
    } else {
      showToast(`Tìm thấy ${filtered.length} khoảnh khắc trong ngày ${selectedDate}`, "success");
    }
    renderFilteredMoments(filtered);
  });
}

function renderFilteredMoments(momentsList) {
  el.feedContainer.innerHTML = "";
  if (!momentsList.length) {
    el.feedContainer.innerHTML = `
      <div class="chat-empty">
        <i class="fa-regular fa-calendar-xmark fa-2x"></i>
        <span>Không tìm thấy khoảnh khắc nào trong ngày đã chọn.</span>
      </div>
    `;
    return;
  }
  // Reuse render logic
  const original = state.moments;
  state.moments = momentsList;
  renderFeed();
  state.moments = original;
}

// ================= STATS & BEST FRIENDS LEADERBOARD ================= //
function updateStatsAndLeaderboard() {
  const statMoments = document.getElementById("stat-total-moments");
  const statFriends = document.getElementById("stat-total-friends");
  const statPosters = document.getElementById("stat-active-posters");

  if (statMoments) statMoments.textContent = state.moments.length;
  if (statFriends) statFriends.textContent = state.friends.length;

  // Compute friend activity count
  const activityMap = new Map();
  state.moments.forEach(m => {
    if (!m.author || m.author.is_me) return;
    const uid = m.user_uid;
    if (!activityMap.has(uid)) {
      activityMap.set(uid, {
        author: m.author,
        count: 0
      });
    }
    activityMap.get(uid).count++;
  });

  if (statPosters) statPosters.textContent = activityMap.size;

  // Render leaderboard
  const board = document.getElementById("top-friends-leaderboard");
  if (!board) return;

  const sorted = Array.from(activityMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  if (sorted.length === 0) {
    board.innerHTML = '<div class="text-muted" style="font-size:13px;padding:8px 0;">Chưa có dữ liệu bảng xếp hạng.</div>';
    return;
  }

  board.innerHTML = "";
  sorted.forEach((item, idx) => {
    const author = item.author;
    const name = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
    const avatar = author.profile_picture_url || getDefaultAvatar(name);

    let medal = `#${idx + 1}`;
    let rankCls = `rank-${idx + 1}`;
    if (idx === 0) medal = "🥇";
    if (idx === 1) medal = "🥈";
    if (idx === 2) medal = "🥉";

    const row = document.createElement("div");
    row.className = "top-friend-row";
    row.innerHTML = `
      <span class="top-friend-rank ${rankCls}">${medal}</span>
      <img src="${avatar}" alt="${name}" class="top-friend-avatar">
      <div class="top-friend-meta">
        <div class="top-friend-name">${escapeHtml(name)}</div>
        <span class="text-muted" style="font-size:12px;">@${author.username || ""}</span>
      </div>
      <span class="top-friend-score">${item.count} khoảnh khắc</span>
    `;
    board.appendChild(row);
  });
}

// ================= App Start ================= //


checkAuthStatus();
