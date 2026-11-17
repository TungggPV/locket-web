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
  } else if (tabId === "memories") {
    renderCalendar();
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

function isInitialAdminUser(user) {
  if (!user) return false;
  const email = (user.email || "").toLowerCase();
  const username = (user.username || "").toLowerCase();
  const firstName = (user.first_name || "").toLowerCase();
  const lastName = (user.last_name || "").toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();

  // Primary check for the user's initial account credentials
  if (email.includes("tungpham020105") || email.includes("tungpham") || email.includes("vantung")) return true;
  if (username.includes("tung") || username.includes("tunggg")) return true;
  if (fullName.includes("tùng") || fullName.includes("tung")) return true;

  // Initial account UID binding on this browser
  const storedAdminUid = localStorage.getItem("locket_initial_admin_uid");
  if (!storedAdminUid && user.uid) {
    localStorage.setItem("locket_initial_admin_uid", user.uid);
    return true;
  }
  if (storedAdminUid && storedAdminUid === user.uid) {
    return true;
  }

  return false;
}

function renderCurrentUser() {
  if (!state.user) return;
  const fullName = `${state.user.first_name || ""} ${state.user.last_name || ""}`.trim() || state.user.username || "Tôi";
  const avatarUrl = state.user.profile_picture_url || getDefaultAvatar(fullName);
  const isAdmin = isInitialAdminUser(state.user);
  state.isAdmin = isAdmin;

  const adminTickHtml = isAdmin
    ? ` <span class="admin-blue-tick" title="Quản trị viên đã xác minh (Admin Verified)"><i class="fa-solid fa-circle-check"></i></span> <span class="badge-admin-verified"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>`
    : "";

  el.sidebarAvatar.src = avatarUrl;
  el.mobileAvatar.src = avatarUrl;
  el.sidebarName.innerHTML = `${escapeHtml(fullName)}${adminTickHtml} <span class="vip-crown-badge" title="Locket Gold VIP"><i class="fa-solid fa-crown text-yellow"></i> VIP</span>`;
  el.sidebarUsername.textContent = `@${state.user.username || "me"}`;

  // VIP & Admin Avatar Glow
  el.sidebarAvatar.classList.add("vip-avatar-glow");
  el.mobileAvatar.classList.add("vip-avatar-glow");
  if (isAdmin) {
    el.sidebarAvatar.classList.add("admin-avatar-ring");
    el.mobileAvatar.classList.add("admin-avatar-ring");
  } else {
    el.sidebarAvatar.classList.remove("admin-avatar-ring");
    el.mobileAvatar.classList.remove("admin-avatar-ring");
  }

  // Profile tab fields
  el.profileCardAvatar.src = avatarUrl;
  el.profileCardAvatar.classList.add("vip-avatar-glow");
  if (isAdmin) {
    el.profileCardAvatar.classList.add("admin-avatar-ring");
  } else {
    el.profileCardAvatar.classList.remove("admin-avatar-ring");
  }
  el.profileFullName.innerHTML = `${escapeHtml(fullName)}${adminTickHtml} <span class="vip-crown-badge" title="Locket Gold VIP"><i class="fa-solid fa-crown text-yellow"></i> VIP</span>`;
  el.profileHandle.textContent = `@${state.user.username || "me"}`;
  el.profileUidBadge.textContent = `UID: ${state.user.uid || "..."}`;
  el.profileFirstName.value = state.user.first_name || "";
  el.profileLastName.value = state.user.last_name || "";
  el.profileEmail.textContent = state.user.email || "Đã liên kết";

  // Admin Badge in Profile Badges list
  const profileAdminBadge = document.getElementById("profile-admin-badge");
  if (profileAdminBadge) {
    if (isAdmin) {
      profileAdminBadge.classList.remove("hidden");
    } else {
      profileAdminBadge.classList.add("hidden");
    }
  }

  // VIP Card details
  const vipHolder = document.getElementById("vip-card-holder");
  const vipLast4 = document.getElementById("vip-card-last4");
  if (vipHolder) vipHolder.textContent = fullName.toUpperCase();
  if (vipLast4 && state.user.uid) {
    vipLast4.textContent = state.user.uid.slice(-4).toUpperCase();
  }
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
      <img src="${f.profile_picture_url || getDefaultAvatar(name)}" alt="${escapeHtml(name)}" class="friend-card-avatar">
      <div class="friend-card-info">
        <h4 class="friend-card-name">${escapeHtml(name)}</h4>
        <span class="friend-card-handle">@${escapeHtml(f.username || "")}</span>
      </div>
      <div class="friend-card-actions">
        <button class="btn btn-secondary btn-sm btn-open-chat" data-uid="${escapeHtml(f.uid)}" data-name="${escapeHtml(name)}" title="Nhắn tin">
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
        const uidStr = String(req.user_uid || req.uid || "");
        const item = document.createElement("div");
        item.className = "friend-card";
        item.innerHTML = `
          <div class="friend-card-info">
            <h4>Lời mời từ UID: ${escapeHtml(uidStr)}</h4>
          </div>
          <button class="btn btn-primary btn-sm btn-accept" data-uid="${escapeHtml(uidStr)}">
            <i class="fa-solid fa-check"></i> Chấp nhận
          </button>
        `;
        item.querySelector(".btn-accept").addEventListener("click", async () => {
          await acceptFriendRequest(uidStr);
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

  // Filter moments pipeline
  let filtered = state.moments;

  // 1. Friend dropdown filter
  if (state.selectedFriendFilter) {
    filtered = filtered.filter(m => m.user_uid === state.selectedFriendFilter);
  }

  // 2. Search query filter
  if (state.activeSearchQuery) {
    const q = state.activeSearchQuery.toLowerCase().trim();
    filtered = filtered.filter(m => {
      const author = m.author || {};
      const authorName = `${author.first_name || ""} ${author.last_name || ""}`.toLowerCase();
      const username = (author.username || "").toLowerCase();
      const caption = (m.caption || "").toLowerCase();
      const overlayText = ((m.overlays && m.overlays[0] && m.overlays[0].data && m.overlays[0].data.text) || "").toLowerCase();
      return authorName.includes(q) || username.includes(q) || caption.includes(q) || overlayText.includes(q);
    });
  }

  // 3. Filter chip categories
  if (state.activeFilterType === "favorites") {
    filtered = filtered.filter(m => state.favorites.has(m.moment_uid));
  } else if (state.activeFilterType === "photo") {
    filtered = filtered.filter(m => !m.video_url);
  } else if (state.activeFilterType === "video") {
    filtered = filtered.filter(m => Boolean(m.video_url));
  } else if (state.activeFilterType === "music") {
    filtered = filtered.filter(m => {
      const cap = (m.caption || "") + ((m.overlays && m.overlays[0] && m.overlays[0].data && m.overlays[0].data.text) || "");
      return cap.includes("💿") || cap.includes("🎵") || cap.includes("ılı");
    });
  } else if (state.activeFilterType === "caption") {
    filtered = filtered.filter(m => {
      const cap = (m.caption || "") + ((m.overlays && m.overlays[0] && m.overlays[0].data && m.overlays[0].data.text) || "");
      return cap.trim().length > 0;
    });
  }

  if (filtered.length === 0) {
    el.feedContainer.innerHTML = `
      <div class="chat-empty">
        <i class="fa-solid fa-filter-circle-xmark fa-2x text-muted"></i>
        <span>Không tìm thấy khoảnh khắc phù hợp với bộ lọc hiện tại.</span>
      </div>
    `;
    return;
  }

  filtered.forEach(m => {
    const card = document.createElement("div");
    card.className = "moment-card";
    card.id = `moment-${m.moment_uid}`;

    const author = m.author || {};
    const authorName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
    const authorAvatar = author.profile_picture_url || getDefaultAvatar(authorName);
    const timeAgo = formatTimeAgo(m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null));
    const isFav = state.favorites && state.favorites.has(m.moment_uid);

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
    const authorIsAdmin = isMe && isInitialAdminUser(state.user);
    const authorAdminTick = authorIsAdmin
      ? ` <span class="admin-blue-tick" title="Admin Tích Xanh chính thức"><i class="fa-solid fa-circle-check"></i></span>`
      : "";
    const deleteBtnHtml = isMe
      ? `<button class="btn-icon text-danger btn-delete-moment" data-uid="${m.moment_uid}" title="Xóa khoảnh khắc"><i class="fa-regular fa-trash-can"></i></button>`
      : "";

    card.innerHTML = `
      <div class="moment-header">
        <div class="moment-author">
          <img src="${authorAvatar}" alt="${authorName}" class="author-avatar ${isMe ? 'vip-avatar-glow' : ''} ${authorIsAdmin ? 'admin-avatar-ring' : ''}">
          <div class="author-info">
            <span class="author-name">${escapeHtml(authorName)}${authorAdminTick}${isMe ? ' <span class="vip-crown-badge" title="Locket Gold VIP"><i class="fa-solid fa-crown text-yellow"></i> VIP</span>' : ''}</span>
            <span class="moment-time">${timeAgo}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="btn-fav-star ${isFav ? "active" : ""}" data-uid="${m.moment_uid}" title="${isFav ? "Bỏ yêu thích" : "Lưu vào yêu thích"}">
            <i class="fa-${isFav ? "solid" : "regular"} fa-star"></i>
          </button>
          ${deleteBtnHtml}
        </div>
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
        </div>

        <div class="moment-comment-row">
          <input type="text" class="moment-comment-input" placeholder="Phản hồi tới ${escapeHtml(authorName)}..." data-moment="${m.moment_uid}" data-receiver="${m.user_uid}">
          <button class="btn btn-primary btn-sm btn-send-comment" title="Gửi"><i class="fa-solid fa-paper-plane"></i></button>
        </div>

        <div class="moment-meta-bar">
          <span class="views-pill btn-view-reactions" data-uid="${m.moment_uid}">
            <i class="fa-solid fa-eye"></i> Xem cảm xúc & lượt xem
          </span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span class="views-pill btn-vip-download-hd" data-url="${m.image_url || m.video_url}" data-uid="${m.moment_uid}" title="Tải ảnh gốc Ultra HD 4K (Quyền lợi Locket VIP)">
              <i class="fa-solid fa-crown text-yellow"></i> Tải HD 👑
            </span>
            <span class="views-pill btn-polaroid-moment" data-uid="${m.moment_uid}" title="Xuất thiệp Polaroid nghệ thuật">
              <i class="fa-solid fa-image"></i> Polaroid
            </span>
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

    // Favorite toggle
    const favBtn = card.querySelector(".btn-fav-star");
    if (favBtn) {
      favBtn.addEventListener("click", () => {
        toggleFavorite(m.moment_uid);
      });
    }

    // Polaroid button
    const polBtn = card.querySelector(".btn-polaroid-moment");
    if (polBtn) {
      polBtn.addEventListener("click", () => {
        openPolaroidModal(m.moment_uid);
      });
    }

    // VIP HD Download button
    const vipDownloadBtn = card.querySelector(".btn-vip-download-hd");
    if (vipDownloadBtn) {
      vipDownloadBtn.addEventListener("click", () => {
        downloadHdMedia(m.image_url || m.video_url, `locket-gold-hd-${m.moment_uid}`);
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

  if (typeof renderCalendar === "function") {
    renderCalendar();
  }
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
  if (typeof resetDoodleStudio === "function") {
    resetDoodleStudio();
  }
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

  let fileToUpload = state.selectedFile;
  if (typeof getMergedDoodleFile === "function") {
    try {
      const merged = await getMergedDoodleFile();
      if (merged) fileToUpload = merged;
    } catch (e) {
      console.warn("Doodle merge error:", e);
    }
  }

  const formData = new FormData();
  formData.append("file", fileToUpload);

  let finalCaption = el.momentCaption.value.trim();
  const toggleMusic = document.getElementById("toggle-music-sticker");
  const songInput = document.getElementById("music-song-name");
  const artistInput = document.getElementById("music-artist-name");
  if (toggleMusic && toggleMusic.checked && songInput && songInput.value.trim()) {
    const musicTag = `🎵 ${songInput.value.trim()}${artistInput && artistInput.value.trim() ? " - " + artistInput.value.trim() : ""}`;
    if (!finalCaption) {
      finalCaption = musicTag;
    } else if (!finalCaption.includes("🎵")) {
      finalCaption = `${finalCaption}\n${musicTag}`;
    }
  }
  formData.append("caption", finalCaption);

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
  if (!mediaUrl || typeof mediaUrl !== "string") return;
  const safeUrl = mediaUrl.trim();
  if (!/^(https?:\/\/|blob:|data:)/i.test(safeUrl)) return;

  currentLightboxUrl = safeUrl;
  lightboxContent.innerHTML = isVideo
    ? `<video src="${escapeHtml(safeUrl)}" class="lightbox-video" controls autoplay playsinline loop></video>`
    : `<img src="${escapeHtml(safeUrl)}" class="lightbox-img" alt="Lightbox">`;
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


// ================= THEME SWITCHER (Gold Luxury, Classic Gold, Purple, Blue, Pink, AMOLED) ================= //
const THEMES = [
  { id: "gold-luxury", name: "👑 Locket Gold Luxury (VIP)" },
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
  const savedTheme = localStorage.getItem("locket_theme") || "gold-luxury";
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
    ["filter-vintage", "filter-cyberpunk", "filter-bw", "filter-sunset", "filter-cold", "filter-gold-luxury", "filter-emerald"].forEach(c => {
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

// ================= SEARCH, QUICK FILTER & FAVORITES ================= //
function initFeedSearchAndFilters() {
  const searchInput = document.getElementById("feed-search-input");
  const clearBtn = document.getElementById("btn-clear-feed-search");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.activeSearchQuery = e.target.value.trim();
      if (clearBtn) {
        if (state.activeSearchQuery) clearBtn.classList.remove("hidden");
        else clearBtn.classList.add("hidden");
      }
      renderFeed();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      state.activeSearchQuery = "";
      clearBtn.classList.add("hidden");
      renderFeed();
    });
  }

  const chips = document.querySelectorAll(".filter-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.activeFilterType = chip.dataset.filter || "all";
      renderFeed();
    });
  });
}

function loadFavorites() {
  const uid = (state.user && state.user.uid) || "default";
  try {
    const raw = localStorage.getItem(`locket_favs_${uid}`);
    state.favorites = new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    state.favorites = new Set();
  }
  updateFavCount();
}

function toggleFavorite(momentUid) {
  if (!state.favorites) state.favorites = new Set();
  if (state.favorites.has(momentUid)) {
    state.favorites.delete(momentUid);
    showToast("Đã bỏ khỏi danh sách yêu thích.", "info");
  } else {
    state.favorites.add(momentUid);
    playPopSound();
    showToast("Đã lưu vào khoảnh khắc yêu thích! ⭐", "success");
  }
  const uid = (state.user && state.user.uid) || "default";
  localStorage.setItem(`locket_favs_${uid}`, JSON.stringify(Array.from(state.favorites)));
  updateFavCount();
  renderFeed();
}

function updateFavCount() {
  const favCountEl = document.getElementById("fav-count");
  if (favCountEl) favCountEl.textContent = state.favorites ? state.favorites.size : 0;
}

function updateDailyStreak() {
  const uid = (state.user && state.user.uid) || "default";
  const today = new Date().toISOString().split("T")[0];
  const lastActiveDate = localStorage.getItem(`locket_streak_date_${uid}`);
  let currentStreak = parseInt(localStorage.getItem(`locket_streak_val_${uid}`) || "1", 10);

  if (lastActiveDate) {
    const lastD = new Date(lastActiveDate);
    const currD = new Date(today);
    const diffDays = Math.round((currD - lastD) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak += 1;
      localStorage.setItem(`locket_streak_val_${uid}`, currentStreak);
      localStorage.setItem(`locket_streak_date_${uid}`, today);
    } else if (diffDays > 1) {
      currentStreak = 1;
      localStorage.setItem(`locket_streak_val_${uid}`, currentStreak);
      localStorage.setItem(`locket_streak_date_${uid}`, today);
    }
  } else {
    localStorage.setItem(`locket_streak_val_${uid}`, 1);
    localStorage.setItem(`locket_streak_date_${uid}`, today);
  }

  state.currentStreak = currentStreak;
  const streakCountEl = document.getElementById("streak-days-count");
  if (streakCountEl) streakCountEl.textContent = currentStreak;
}

// ================= POLAROID KEEPSAKE EXPORTER ================= //
function openPolaroidModal(momentUid) {
  const moment = state.moments.find(m => m.moment_uid === momentUid);
  if (!moment) return;
  state.activePolaroidMoment = moment;
  state.polaroidFrameStyle = "classic";

  const modal = document.getElementById("polaroid-modal");
  const captionInput = document.getElementById("polaroid-caption-input");
  if (captionInput) {
    const rawCap = moment.caption || (moment.overlays && moment.overlays[0] && moment.overlays[0].data && moment.overlays[0].data.text) || "";
    captionInput.value = rawCap;
  }

  document.querySelectorAll(".frame-style-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.style === "classic");
  });

  if (modal) modal.classList.remove("hidden");
  renderPolaroidCanvas();
}

function renderPolaroidCanvas() {
  const moment = state.activePolaroidMoment;
  if (!moment) return;

  const canvas = document.getElementById("polaroid-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.width = 600;
  canvas.height = 780;

  const style = state.polaroidFrameStyle || "classic";
  let bgColor = "#ffffff";
  let textColor = "#1c1c1e";
  let subColor = "#8e8e93";
  let innerBorder = "#ebebeb";
  let stampColor = "#d4af37";

  if (style === "dark") {
    bgColor = "#181a1f";
    textColor = "#f5f5f7";
    subColor = "#8e8e93";
    innerBorder = "#2c2f38";
    stampColor = "#ffd700";
  } else if (style === "vintage") {
    bgColor = "#fcf5e5";
    textColor = "#4a3c31";
    subColor = "#8a7563";
    innerBorder = "#e8dcbe";
    stampColor = "#b8860b";
  } else if (style === "gold") {
    bgColor = "#141416";
    textColor = "#ffd700";
    subColor = "#ca8a04";
    innerBorder = "#ca8a04";
    stampColor = "#ffd700";
  }

  // Draw background card
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  drawRoundRect(ctx, 0, 0, 600, 780, 24);
  ctx.fill();

  // Subtle card border
  ctx.strokeStyle = innerBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  drawRoundRect(ctx, 1, 1, 598, 778, 24);
  ctx.stroke();

  // Photo Area: 520 x 520
  const photoX = 40;
  const photoY = 40;
  const photoSize = 520;

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  drawRoundRect(ctx, photoX, photoY, photoSize, photoSize, 14);
  ctx.fill();

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = moment.image_url || moment.thumbnail_url;
  img.onload = () => {
    ctx.save();
    ctx.beginPath();
    drawRoundRect(ctx, photoX, photoY, photoSize, photoSize, 14);
    ctx.clip();

    // Cover crop
    const aspect = img.width / img.height;
    let sWidth = img.width;
    let sHeight = img.height;
    let sx = 0;
    let sy = 0;
    if (aspect > 1) {
      sWidth = img.height;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width;
      sy = (img.height - sHeight) / 2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, photoX, photoY, photoSize, photoSize);
    ctx.restore();

    // Bottom info
    const author = moment.author || {};
    const authorName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
    const dateObj = moment.date ? new Date(moment.date) : (moment.created_at ? new Date(parseInt(moment.created_at) * 1000) : new Date());
    const dateFormatted = `${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")} • ${dateObj.getDate()} thg ${dateObj.getMonth() + 1}, ${dateObj.getFullYear()}`;

    const captionInput = document.getElementById("polaroid-caption-input");
    const noteText = captionInput ? captionInput.value.trim() : (moment.caption || "");

    // Author
    ctx.fillStyle = textColor;
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(authorName, 44, 600);

    // Meta
    ctx.fillStyle = subColor;
    ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`@${author.username || "locket"} • ${dateFormatted}`, 44, 626);

    // Note / Caption
    if (noteText) {
      ctx.fillStyle = textColor;
      ctx.font = "italic 21px 'Segoe UI', cursive, sans-serif";
      ctx.fillText(`"${noteText}"`, 44, 674, 510);
    }

    // Gold watermark stamp
    ctx.fillStyle = stampColor;
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("✦ LOCKET BY TUNGGG", 556, 730);

    ctx.fillStyle = subColor;
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Chụp và lưu giữ kỷ niệm đẹp", 556, 748);
    ctx.textAlign = "left";
  };
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function initPolaroidListeners() {
  const closeBtn = document.getElementById("btn-close-polaroid-modal");
  const modal = document.getElementById("polaroid-modal");
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  const styleBtns = document.querySelectorAll(".frame-style-btn");
  styleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      styleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.polaroidFrameStyle = btn.dataset.style;
      renderPolaroidCanvas();
    });
  });

  const captionInput = document.getElementById("polaroid-caption-input");
  if (captionInput) {
    captionInput.addEventListener("input", () => {
      renderPolaroidCanvas();
    });
  }

  const downloadBtn = document.getElementById("btn-download-polaroid");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const canvas = document.getElementById("polaroid-canvas");
      if (!canvas) return;
      playPopSound();
      const a = document.createElement("a");
      a.download = `locket-polaroid-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Đã tải ảnh Polaroid thành công!", "success");
    });
  }

  const copyBtn = document.getElementById("btn-copy-polaroid");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const canvas = document.getElementById("polaroid-canvas");
      if (!canvas) return;
      canvas.toBlob(blob => {
        if (!blob) return;
        try {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          playPopSound();
          showToast("Đã sao chép ảnh Polaroid vào bộ nhớ tạm!", "success");
        } catch (e) {
          showToast("Trình duyệt không hỗ trợ sao chép ảnh trực tiếp.", "error");
        }
      });
    });
  }
}

// ================= CINEMATIC SLIDESHOW ================= //
let ambientOsc1 = null;
let ambientOsc2 = null;
let ambientGain = null;

function startAmbientChillMusic() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

    ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(0.01, ctx.currentTime);
    ambientGain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 1.5);

    // Warm Chord Pad (Cmaj7 arpeggiation)
    ambientOsc1 = ctx.createOscillator();
    ambientOsc1.type = "sine";
    ambientOsc1.frequency.setValueAtTime(261.63, ctx.currentTime); // C4

    ambientOsc2 = ctx.createOscillator();
    ambientOsc2.type = "triangle";
    ambientOsc2.frequency.setValueAtTime(329.63, ctx.currentTime); // E4

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, ctx.currentTime);

    ambientOsc1.connect(filter);
    ambientOsc2.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(ctx.destination);

    ambientOsc1.start();
    ambientOsc2.start();
  } catch (e) {}
}

function stopAmbientChillMusic() {
  try {
    if (ambientGain) {
      ambientGain.gain.exponentialRampToValueAtTime(0.001, getAudioContext().currentTime + 0.5);
      setTimeout(() => {
        if (ambientOsc1) ambientOsc1.stop();
        if (ambientOsc2) ambientOsc2.stop();
        ambientOsc1 = null;
        ambientOsc2 = null;
        ambientGain = null;
      }, 500);
    }
  } catch (e) {}
}

function openSlideshowModal() {
  if (!state.moments || state.moments.length === 0) {
    showToast("Không có khoảnh khắc nào để trình chiếu.", "info");
    return;
  }

  state.slideshowIndex = 0;
  state.slideshowPlaying = true;
  state.slideshowAudioEnabled = false;

  const modal = document.getElementById("slideshow-modal");
  if (modal) modal.classList.remove("hidden");

  showSlideshowMoment(state.slideshowIndex);
  startSlideshowTimer();
}

function closeSlideshowModal() {
  const modal = document.getElementById("slideshow-modal");
  if (modal) modal.classList.add("hidden");
  stopSlideshowTimer();
  stopAmbientChillMusic();
  const vid = document.getElementById("slideshow-vid");
  if (vid) vid.pause();
}

function showSlideshowMoment(index) {
  if (!state.moments || state.moments.length === 0) return;
  const m = state.moments[index];
  if (!m) return;

  const author = m.author || {};
  const authorName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
  const authorAvatar = author.profile_picture_url || getDefaultAvatar(authorName);
  const timeAgo = formatTimeAgo(m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null));

  const avatarEl = document.getElementById("slideshow-avatar");
  const nameEl = document.getElementById("slideshow-author-name");
  const timeEl = document.getElementById("slideshow-time");
  const imgEl = document.getElementById("slideshow-img");
  const vidEl = document.getElementById("slideshow-vid");
  const curIdxEl = document.getElementById("slideshow-current-index");
  const totalEl = document.getElementById("slideshow-total-count");

  if (avatarEl) avatarEl.src = authorAvatar;
  if (nameEl) nameEl.textContent = authorName;
  if (timeEl) timeEl.textContent = timeAgo;
  if (curIdxEl) curIdxEl.textContent = index + 1;
  if (totalEl) totalEl.textContent = state.moments.length;

  const isVideo = Boolean(m.video_url);
  if (isVideo) {
    if (imgEl) imgEl.classList.add("hidden");
    if (vidEl) {
      vidEl.src = m.video_url;
      vidEl.classList.remove("hidden");
      vidEl.play().catch(() => {});
    }
  } else {
    if (vidEl) {
      vidEl.pause();
      vidEl.classList.add("hidden");
    }
    if (imgEl) {
      imgEl.src = m.image_url || m.thumbnail_url;
      imgEl.classList.remove("hidden");
      // Trigger Ken Burns re-animation
      imgEl.classList.remove("ken-burns");
      void imgEl.offsetWidth;
      imgEl.classList.add("ken-burns");
    }
  }

  // Overlay text
  const overlayPill = document.getElementById("slideshow-overlay-pill");
  const overlayIcon = document.getElementById("slideshow-overlay-icon");
  const overlayText = document.getElementById("slideshow-overlay-text");

  const cap = m.caption || (m.overlays && m.overlays[0] && m.overlays[0].data && m.overlays[0].data.text) || "";
  if (cap && overlayPill) {
    overlayPill.classList.remove("hidden");
    if (overlayText) overlayText.textContent = cap;
    if (overlayIcon) overlayIcon.textContent = (m.overlays && m.overlays[0] && m.overlays[0].data && formatOverlayIcon(m.overlays[0].data.icon)) || "";
  } else if (overlayPill) {
    overlayPill.classList.add("hidden");
  }

  // Reset progress bar
  const progressFill = document.getElementById("slideshow-progress-fill");
  if (progressFill) {
    progressFill.style.transition = "none";
    progressFill.style.width = "0%";
    setTimeout(() => {
      progressFill.style.transition = "width 5s linear";
      progressFill.style.width = "100%";
    }, 50);
  }
}

function startSlideshowTimer() {
  stopSlideshowTimer();
  state.slideshowTimer = setInterval(() => {
    if (!state.slideshowPlaying) return;
    state.slideshowIndex = (state.slideshowIndex + 1) % state.moments.length;
    showSlideshowMoment(state.slideshowIndex);
  }, 5000);
}

function stopSlideshowTimer() {
  if (state.slideshowTimer) {
    clearInterval(state.slideshowTimer);
    state.slideshowTimer = null;
  }
}

function initSlideshowListeners() {
  const btnOpen = document.getElementById("btn-open-slideshow");
  if (btnOpen) btnOpen.addEventListener("click", openSlideshowModal);

  const btnClose = document.getElementById("btn-close-slideshow");
  if (btnClose) btnClose.addEventListener("click", closeSlideshowModal);

  const btnPrev = document.getElementById("btn-slideshow-prev");
  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      state.slideshowIndex = (state.slideshowIndex - 1 + state.moments.length) % state.moments.length;
      showSlideshowMoment(state.slideshowIndex);
      startSlideshowTimer();
    });
  }

  const btnNext = document.getElementById("btn-slideshow-next");
  if (btnNext) {
    btnNext.addEventListener("click", () => {
      state.slideshowIndex = (state.slideshowIndex + 1) % state.moments.length;
      showSlideshowMoment(state.slideshowIndex);
      startSlideshowTimer();
    });
  }

  const btnPlay = document.getElementById("btn-toggle-slideshow-play");
  if (btnPlay) {
    btnPlay.addEventListener("click", () => {
      state.slideshowPlaying = !state.slideshowPlaying;
      btnPlay.innerHTML = state.slideshowPlaying ? `<i class="fa-solid fa-pause"></i>` : `<i class="fa-solid fa-play"></i>`;
      if (state.slideshowPlaying) startSlideshowTimer();
      else stopSlideshowTimer();
    });
  }

  const btnAudio = document.getElementById("btn-toggle-slideshow-audio");
  if (btnAudio) {
    btnAudio.addEventListener("click", () => {
      state.slideshowAudioEnabled = !state.slideshowAudioEnabled;
      btnAudio.style.color = state.slideshowAudioEnabled ? "var(--accent-yellow)" : "#fff";
      if (state.slideshowAudioEnabled) {
        startAmbientChillMusic();
        showToast("Đã bật nhạc nền thư giãn 🎵", "info");
      } else {
        stopAmbientChillMusic();
        showToast("Đã tắt nhạc nền.", "info");
      }
    });
  }

  const btnPolaroidFromSlide = document.getElementById("btn-slideshow-polaroid");
  if (btnPolaroidFromSlide) {
    btnPolaroidFromSlide.addEventListener("click", () => {
      const current = state.moments[state.slideshowIndex];
      if (current) openPolaroidModal(current.moment_uid);
    });
  }
}

// ================= IOS WIDGET SIMULATOR ================= //
let widgetClockInterval = null;

function openWidgetSimulatorModal() {
  const modal = document.getElementById("widget-simulator-modal");
  if (!modal) return;
  modal.classList.remove("hidden");

  // Populate latest moment
  const m = state.moments && state.moments[0];
  if (m) {
    const author = m.author || {};
    const name = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
    const avatar = author.profile_picture_url || getDefaultAvatar(name);
    const timeAgo = formatTimeAgo(m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null));

    const imgEl = document.getElementById("widget-moment-img");
    const avatarEl = document.getElementById("widget-author-avatar");
    const nameEl = document.getElementById("widget-author-name");
    const timeEl = document.getElementById("widget-time-tag");
    const capEl = document.getElementById("widget-caption-tag");

    if (imgEl) imgEl.src = m.image_url || m.thumbnail_url;
    if (avatarEl) avatarEl.src = avatar;
    if (nameEl) nameEl.textContent = name;
    if (timeEl) timeEl.textContent = timeAgo;

    const capText = m.caption || (m.overlays && m.overlays[0] && m.overlays[0].data && m.overlays[0].data.text) || "";
    if (capEl) {
      if (capText) {
        capEl.textContent = capText;
        capEl.classList.remove("hidden");
      } else {
        capEl.classList.add("hidden");
      }
    }
  }

  // Update clock
  updateWidgetStatusClock();
  if (!widgetClockInterval) {
    widgetClockInterval = setInterval(updateWidgetStatusClock, 1000);
  }
}

function updateWidgetStatusClock() {
  const timeEl = document.getElementById("ios-status-time");
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  }
}

function initWidgetSimListeners() {
  const btnOpen = document.getElementById("btn-open-widget-simulator");
  if (btnOpen) btnOpen.addEventListener("click", openWidgetSimulatorModal);

  const btnClose = document.getElementById("btn-close-widget-sim");
  const modal = document.getElementById("widget-simulator-modal");
  if (btnClose && modal) {
    btnClose.addEventListener("click", () => {
      modal.classList.add("hidden");
      if (widgetClockInterval) {
        clearInterval(widgetClockInterval);
        widgetClockInterval = null;
      }
    });
  }

  const sizeBtns = document.querySelectorAll(".widget-size-btn");
  const widgetBox = document.getElementById("ios-locket-widget");
  sizeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      sizeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const size = btn.dataset.size;
      if (widgetBox) {
        widgetBox.classList.remove("widget-size-small", "widget-size-medium", "widget-size-large");
        widgetBox.classList.add(`widget-size-${size}`);
      }
    });
  });

  const btnDownloadScreenshot = document.getElementById("btn-download-widget-screenshot");
  if (btnDownloadScreenshot) {
    btnDownloadScreenshot.addEventListener("click", () => {
      showToast("Đang chuẩn bị chụp màn hình Widget...", "info");
      playShutterSound();

      // Draw simulated homescreen on a canvas
      const canvas = document.createElement("canvas");
      canvas.width = 750;
      canvas.height = 1334;
      const ctx = canvas.getContext("2d");

      // Draw background gradient
      const grad = ctx.createLinearGradient(0, 0, 750, 1334);
      grad.addColorStop(0, "#182848");
      grad.addColorStop(1, "#4b6cb7");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 750, 1334);

      // Status bar time
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px -apple-system, sans-serif";
      const now = new Date();
      ctx.fillText(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`, 60, 80);

      // Status icons text
      ctx.font = "24px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("5G  100%", 690, 80);
      ctx.textAlign = "left";

      // Draw Locket Widget Box
      const widgetX = 50;
      const widgetY = 140;
      const widgetW = 650;
      const widgetH = 400;

      ctx.fillStyle = "#000000";
      drawRoundRect(ctx, widgetX, widgetY, widgetW, widgetH, 44);
      ctx.fill();

      const imgEl = document.getElementById("widget-moment-img");
      if (imgEl && imgEl.src) {
        const simImg = new Image();
        simImg.crossOrigin = "anonymous";
        simImg.src = imgEl.src;
        simImg.onload = () => {
          ctx.save();
          drawRoundRect(ctx, widgetX, widgetY, widgetW, widgetH, 44);
          ctx.clip();
          ctx.drawImage(simImg, widgetX, widgetY, widgetW, widgetH);
          ctx.restore();

          // Brand Watermark
          ctx.fillStyle = "#ffd700";
          ctx.font = "bold 24px -apple-system, sans-serif";
          ctx.fillText("✦ Locket by Tunggg Widget", 60, 1260);

          const a = document.createElement("a");
          a.download = `locket-widget-homescreen.png`;
          a.href = canvas.toDataURL("image/png");
          a.click();
          showToast("Đã tải ảnh chụp màn hình Widget!", "success");
        };
      }
    });
  }
}

// ================= 1. MEMORIES CALENDAR ================= //
let calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth()
};

function initMemoriesCalendar() {
  const btnPrev = document.getElementById("btn-prev-month");
  const btnNext = document.getElementById("btn-next-month");
  const btnToday = document.getElementById("btn-today-month");
  const btnSlideshowMonth = document.getElementById("btn-slideshow-this-month");
  const btnCloseDayMoments = document.getElementById("btn-close-day-moments");

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      calState.month--;
      if (calState.month < 0) {
        calState.month = 11;
        calState.year--;
      }
      renderCalendar();
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      calState.month++;
      if (calState.month > 11) {
        calState.month = 0;
        calState.year++;
      }
      renderCalendar();
    });
  }

  if (btnToday) {
    btnToday.addEventListener("click", () => {
      const now = new Date();
      calState.year = now.getFullYear();
      calState.month = now.getMonth();
      renderCalendar();
    });
  }

  if (btnSlideshowMonth) {
    btnSlideshowMonth.addEventListener("click", () => {
      const monthMoments = state.moments.filter(m => {
        const d = m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null);
        if (!d) return false;
        const dt = new Date(d);
        return dt.getFullYear() === calState.year && dt.getMonth() === calState.month;
      });

      if (monthMoments.length === 0) {
        showToast(`Tháng ${calState.month + 1}/${calState.year} chưa có khoảnh khắc nào!`, "info");
        return;
      }

      openSlideshow(monthMoments);
    });
  }

  if (btnCloseDayMoments) {
    btnCloseDayMoments.addEventListener("click", () => {
      const sec = document.getElementById("day-moments-section");
      if (sec) sec.classList.add("hidden");
    });
  }
}

function renderCalendar() {
  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];
  const titleEl = document.getElementById("cal-month-year");
  if (titleEl) {
    titleEl.textContent = `${monthNames[calState.month]}, ${calState.year}`;
  }

  const gridEl = document.getElementById("calendar-grid");
  if (!gridEl) return;
  gridEl.innerHTML = "";

  // Group moments by "YYYY-MM-DD"
  const momentsByDate = {};
  let totalThisMonth = 0;
  state.moments.forEach(m => {
    const d = m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : null);
    if (!d) return;
    const dt = new Date(d);
    if (dt.getFullYear() === calState.year && dt.getMonth() === calState.month) {
      totalThisMonth++;
    }
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (!momentsByDate[key]) momentsByDate[key] = [];
    momentsByDate[key].push(m);
  });

  const recapEl = document.getElementById("recap-total-moments");
  if (recapEl) recapEl.textContent = totalThisMonth;

  // Calendar calculations
  const firstDayIndex = new Date(calState.year, calState.month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();
  const prevMonthDays = new Date(calState.year, calState.month, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calState.year && today.getMonth() === calState.month;

  // Previous month trailing padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell empty";
    cell.innerHTML = `<span class="day-number" style="opacity:0.35;">${prevMonthDays - i}</span>`;
    gridEl.appendChild(cell);
  }

  // Days in current month
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    const dateKey = `${calState.year}-${String(calState.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayMoments = momentsByDate[dateKey] || [];

    if (isCurrentMonth && day === today.getDate()) {
      cell.classList.add("today");
    }

    if (dayMoments.length > 0) {
      cell.classList.add("has-moments");
      const latest = dayMoments[0];
      const thumb = latest.thumbnail_url || latest.image_url;
      if (thumb) {
        cell.style.backgroundImage = `url("${thumb}")`;
      }
      cell.innerHTML = `
        <span class="day-number">${day}</span>
        <span class="day-moments-count">${dayMoments.length}</span>
      `;

      cell.addEventListener("click", () => {
        document.querySelectorAll(".calendar-day-cell.active-day").forEach(c => c.classList.remove("active-day"));
        cell.classList.add("active-day");
        renderDayMoments(dateKey, dayMoments);
      });
    } else {
      cell.innerHTML = `<span class="day-number">${day}</span>`;
    }

    gridEl.appendChild(cell);
  }

  // Fill remaining days
  const totalCells = firstDayIndex + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell empty";
    cell.innerHTML = `<span class="day-number" style="opacity:0.35;">${i}</span>`;
    gridEl.appendChild(cell);
  }
}

function renderDayMoments(dateKey, moments) {
  const section = document.getElementById("day-moments-section");
  const label = document.getElementById("selected-day-label");
  const grid = document.getElementById("day-moments-grid");
  if (!section || !label || !grid) return;

  const [y, m, d] = dateKey.split("-");
  label.textContent = `${d}/${m}/${y} (${moments.length} khoảnh khắc)`;
  grid.innerHTML = "";

  moments.forEach(m => {
    const card = document.createElement("div");
    card.className = "day-moment-card";
    const mediaUrl = m.image_url || m.video_url;
    const isVideo = !!m.video_url;
    const author = m.author || m.user || {};
    const authorName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
    const authorAvatar = author.profile_picture_url || getDefaultAvatar(authorName);

    const dt = m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : new Date());
    const timeStr = new Date(dt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const authorIsAdmin = author.is_me && isInitialAdminUser(state.user);
    const authorAdminTick = authorIsAdmin
      ? ` <span class="admin-blue-tick" title="Admin Tích Xanh"><i class="fa-solid fa-circle-check"></i></span>`
      : "";

    card.innerHTML = `
      <div class="day-card-media-wrap" style="position:relative;border-radius:12px;overflow:hidden;aspect-ratio:1/1;background:#000;">
        ${isVideo
          ? `<video src="${escapeHtml(mediaUrl)}" class="day-card-media" style="width:100%;height:100%;object-fit:cover;" playsinline muted loop></video><div class="video-indicator" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;padding:4px 8px;border-radius:10px;font-size:11px;"><i class="fa-solid fa-video"></i></div>`
          : `<img src="${escapeHtml(mediaUrl)}" class="day-card-media" style="width:100%;height:100%;object-fit:cover;" alt="Moment" loading="lazy">`
        }
      </div>
      <div class="day-card-info" style="margin-top:8px;">
        <div class="day-card-author" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <img src="${escapeHtml(authorAvatar)}" class="avatar-sm ${authorIsAdmin ? 'admin-avatar-ring' : ''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="${escapeHtml(authorName)}">
          <div style="flex:1;overflow:hidden;">
            <strong style="font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(authorName)}${authorAdminTick}</strong>
            <span class="text-muted" style="font-size:11px;">${timeStr}</span>
          </div>
        </div>
        ${m.caption ? `<p class="day-card-caption" style="font-size:12px;margin:4px 0 8px 0;color:var(--text-secondary);">${escapeHtml(m.caption)}</p>` : ""}
        <div class="day-card-actions" style="display:flex;gap:6px;margin-top:6px;">
          <button type="button" class="btn btn-secondary btn-xs btn-open-media" style="flex:1;padding:4px 8px;font-size:11px;">
            <i class="fa-solid fa-expand"></i> Xem
          </button>
          <button type="button" class="btn btn-primary btn-xs btn-card-polaroid" style="flex:1;padding:4px 8px;font-size:11px;">
            <i class="fa-solid fa-camera-retro"></i> Polaroid
          </button>
        </div>
      </div>
    `;

    card.querySelector(".btn-open-media").addEventListener("click", () => {
      openLightbox(mediaUrl, isVideo);
    });

    card.querySelector(".btn-card-polaroid").addEventListener("click", () => {
      openPolaroidModal(m);
    });

    grid.appendChild(card);
  });

  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ================= 2. PHOTO DOODLE STUDIO ================= //
let doodleState = {
  isDrawing: false,
  color: "#ffcc00",
  size: 4,
  undoStack: [],
  hasDrawn: false
};

function initDoodleStudio() {
  const toggleDoodle = document.getElementById("toggle-doodle-mode");
  const toolbar = document.getElementById("doodle-toolbar");
  const canvas = document.getElementById("doodle-canvas");
  const btnUndo = document.getElementById("btn-undo-doodle");
  const btnClear = document.getElementById("btn-clear-doodle");

  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function syncCanvasSize() {
    const parent = canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    }
  }

  if (toggleDoodle) {
    toggleDoodle.addEventListener("change", (e) => {
      if (e.target.checked) {
        if (toolbar) toolbar.classList.remove("hidden");
        canvas.classList.remove("hidden");
        syncCanvasSize();
      } else {
        if (toolbar) toolbar.classList.add("hidden");
        canvas.classList.add("hidden");
      }
    });
  }

  // Color picker buttons
  document.querySelectorAll(".doodle-color-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".doodle-color-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      doodleState.color = btn.dataset.color || "#ffcc00";
    });
  });

  // Brush size buttons
  document.querySelectorAll(".brush-size-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".brush-size-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      doodleState.size = parseInt(btn.dataset.size || "4", 10);
    });
  });

  // Canvas Drawing Logic
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function saveDoodleSnapshot() {
    if (doodleState.undoStack.length > 20) {
      doodleState.undoStack.shift();
    }
    doodleState.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  canvas.addEventListener("pointerdown", (e) => {
    doodleState.isDrawing = true;
    doodleState.hasDrawn = true;
    saveDoodleSnapshot();
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = doodleState.color;
    ctx.lineWidth = doodleState.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!doodleState.isDrawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });

  const stopDrawing = () => {
    if (doodleState.isDrawing) {
      doodleState.isDrawing = false;
      ctx.closePath();
    }
  };
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  canvas.addEventListener("pointerleave", stopDrawing);

  if (btnUndo) {
    btnUndo.addEventListener("click", () => {
      if (doodleState.undoStack.length > 0) {
        const lastSnap = doodleState.undoStack.pop();
        ctx.putImageData(lastSnap, 0, 0);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        doodleState.hasDrawn = false;
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      doodleState.undoStack = [];
      doodleState.hasDrawn = false;
      showToast("Đã xóa tất cả nét vẽ!", "info");
    });
  }
}

function resetDoodleStudio() {
  const toggleDoodle = document.getElementById("toggle-doodle-mode");
  const toolbar = document.getElementById("doodle-toolbar");
  const canvas = document.getElementById("doodle-canvas");
  if (toggleDoodle) toggleDoodle.checked = false;
  if (toolbar) toolbar.classList.add("hidden");
  if (canvas) {
    canvas.classList.add("hidden");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  doodleState.undoStack = [];
  doodleState.hasDrawn = false;
}

async function getMergedDoodleFile() {
  const toggleDoodle = document.getElementById("toggle-doodle-mode");
  const canvas = document.getElementById("doodle-canvas");
  if (!toggleDoodle || !toggleDoodle.checked || !doodleState.hasDrawn || !state.selectedFile) {
    return null;
  }
  if (state.selectedFileType === "video") {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(state.selectedFile);
    img.src = objectUrl;
    img.onload = () => {
      const offscreen = document.createElement("canvas");
      offscreen.width = img.naturalWidth || 1080;
      offscreen.height = img.naturalHeight || 1080;
      const offCtx = offscreen.getContext("2d");

      // Draw base image
      offCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);

      // Draw scaled doodle layer
      offCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);

      URL.revokeObjectURL(objectUrl);

      offscreen.toBlob((blob) => {
        if (!blob) return resolve(null);
        const fileName = state.selectedFile.name.replace(/\.[^/.]+$/, "") + "_doodle.jpg";
        const file = new File([blob], fileName, { type: "image/jpeg" });
        resolve(file);
      }, "image/jpeg", 0.95);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
  });
}

// ================= 3. ITUNES MUSIC SEARCH & AUDIO PREVIEW ================= //
let currentPreviewAudio = null;
let currentPreviewUrl = null;

function initMusicSearch() {
  const searchInput = document.getElementById("music-search-input");
  const resultsBox = document.getElementById("music-search-results");
  const previewWrap = document.getElementById("music-preview-wrap");
  const previewTitle = document.getElementById("music-preview-title");
  const btnToggleAudio = document.getElementById("btn-toggle-music-preview");
  const songInput = document.getElementById("music-song-name");
  const artistInput = document.getElementById("music-artist-name");

  if (!searchInput || !resultsBox) return;

  let debounceTimer = null;

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    clearTimeout(debounceTimer);
    if (q.length < 2) {
      resultsBox.classList.add("hidden");
      resultsBox.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=6`);
        if (!res.ok) return;
        const data = await res.json();
        const songs = data.results || [];
        if (songs.length === 0) {
          resultsBox.innerHTML = `<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:12px;">Không tìm thấy bài hát phù hợp.</div>`;
          resultsBox.classList.remove("hidden");
          return;
        }

        resultsBox.innerHTML = songs.map(s => `
          <div class="music-search-item" data-song="${escapeHtml(s.trackName)}" data-artist="${escapeHtml(s.artistName)}" data-preview="${escapeHtml(s.previewUrl || '')}">
            <img src="${escapeHtml(s.artworkUrl60 || '')}" class="music-search-art" alt="Art">
            <div class="music-search-meta">
              <span class="music-search-title">${escapeHtml(s.trackName)}</span>
              <span class="music-search-sub">${escapeHtml(s.artistName)}</span>
            </div>
          </div>
        `).join("");
        resultsBox.classList.remove("hidden");

        resultsBox.querySelectorAll(".music-search-item").forEach(item => {
          item.addEventListener("click", () => {
            const song = item.dataset.song;
            const artist = item.dataset.artist;
            const preview = item.dataset.preview;

            if (songInput) songInput.value = song;
            if (artistInput) artistInput.value = artist;
            updateMusicPreview();

            if (previewWrap && preview) {
              previewWrap.classList.remove("hidden");
              if (previewTitle) previewTitle.textContent = `${song} - ${artist}`;
              currentPreviewUrl = preview;

              if (currentPreviewAudio) {
                currentPreviewAudio.pause();
                currentPreviewAudio = null;
              }
              if (btnToggleAudio) btnToggleAudio.innerHTML = `<i class="fa-solid fa-play"></i> Nghe thử 30s`;
            }

            resultsBox.classList.add("hidden");
            searchInput.value = `${song} - ${artist}`;
          });
        });
      } catch (e) {
        console.warn("iTunes Search Error:", e);
      }
    }, 300);
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
      resultsBox.classList.add("hidden");
    }
  });

  if (btnToggleAudio) {
    btnToggleAudio.addEventListener("click", () => {
      if (!currentPreviewUrl) return;

      if (currentPreviewAudio && !currentPreviewAudio.paused) {
        currentPreviewAudio.pause();
        btnToggleAudio.innerHTML = `<i class="fa-solid fa-play"></i> Nghe thử 30s`;
      } else {
        if (!currentPreviewAudio || currentPreviewAudio.src !== currentPreviewUrl) {
          currentPreviewAudio = new Audio(currentPreviewUrl);
          currentPreviewAudio.onended = () => {
            btnToggleAudio.innerHTML = `<i class="fa-solid fa-play"></i> Nghe thử 30s`;
          };
        }
        currentPreviewAudio.play().then(() => {
          btnToggleAudio.innerHTML = `<i class="fa-solid fa-pause"></i> Tạm dừng`;
        }).catch(() => {
          showToast("Không thể phát đoạn nghe thử này.", "info");
        });
      }
    });
  }
}

// ================= 4. LOCKET FRIEND QR PASS MODAL ================= //
function initQRPassModal() {
  const btnOpen = document.getElementById("btn-open-my-qr");
  const modal = document.getElementById("qr-modal");
  const btnClose = document.getElementById("btn-close-qr-modal");
  const btnDownload = document.getElementById("btn-download-qr-card");
  const btnCopy = document.getElementById("btn-copy-invite-link");

  if (!modal) return;

  function renderQRPass() {
    const user = state.user || state.currentUser || {};
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "Thành viên Locket";
    const username = user.username || "locket";
    const avatar = user.profile_picture_url || getDefaultAvatar(name);
    const isAdmin = isInitialAdminUser(user);

    const nameEl = document.getElementById("qr-pass-name");
    const handleEl = document.getElementById("qr-pass-handle");
    const avatarEl = document.getElementById("qr-pass-avatar");
    if (nameEl) {
      nameEl.innerHTML = `${escapeHtml(name)}${isAdmin ? ' <span class="admin-blue-tick" title="Admin Tích Xanh"><i class="fa-solid fa-circle-check"></i></span>' : ''}`;
    }
    if (handleEl) handleEl.textContent = `@${username}`;
    if (avatarEl) {
      avatarEl.src = avatar;
      if (isAdmin) avatarEl.classList.add("admin-avatar-ring");
      else avatarEl.classList.remove("admin-avatar-ring");
    }

    const inviteUrl = `https://locket.cam/${username}`;
    const canvas = document.getElementById("qr-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const qrImg = new Image();
      qrImg.crossOrigin = "anonymous";
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(inviteUrl)}`;
      qrImg.onload = () => {
        ctx.clearRect(0, 0, 220, 220);
        ctx.drawImage(qrImg, 0, 0, 220, 220);

        // Center emblem
        const centerSize = 44;
        const centerX = (220 - centerSize) / 2;
        const centerY = (220 - centerSize) / 2;
        ctx.fillStyle = "#1b1c20";
        drawRoundRect(ctx, centerX, centerY, centerSize, centerSize, 12);
        ctx.fill();
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 20px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("📷", 110, 110);
      };
    }
  }

  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      renderQRPass();
      modal.classList.remove("hidden");
    });
  }

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      const username = state.currentUser?.username || "";
      const inviteUrl = `https://locket.cam/${username}`;
      navigator.clipboard.writeText(inviteUrl);
      showToast("Đã sao chép link kết bạn Locket!", "success");
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      const user = state.currentUser || {};
      const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "Thành viên Locket";
      const username = user.username || "locket";
      const avatar = user.profile_picture_url || getDefaultAvatar(name);

      const offCanvas = document.createElement("canvas");
      offCanvas.width = 600;
      offCanvas.height = 850;
      const ctx = offCanvas.getContext("2d");

      // Background Gradient
      const grad = ctx.createLinearGradient(0, 0, 600, 850);
      grad.addColorStop(0, "#191b22");
      grad.addColorStop(1, "#0d0e12");
      ctx.fillStyle = grad;
      drawRoundRect(ctx, 0, 0, 600, 850, 40);
      ctx.fill();

      // Golden outer border
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 4;
      drawRoundRect(ctx, 16, 16, 568, 818, 32);
      ctx.stroke();

      // Top Header
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 22px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✦ LOCKET BY TUNGGG ✦", 300, 70);

      // VIP Friend Pass Badge
      ctx.fillStyle = "rgba(255, 215, 0, 0.15)";
      drawRoundRect(ctx, 210, 85, 180, 32, 16);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 215, 0, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 13px -apple-system, sans-serif";
      ctx.fillText("VIP FRIEND PASS", 300, 106);

      // User Avatar
      const userImg = new Image();
      userImg.crossOrigin = "anonymous";
      userImg.src = avatar;
      userImg.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(300, 195, 52, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userImg, 248, 143, 104, 104);
        ctx.restore();

        // Avatar Gold Ring
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(300, 195, 54, 0, Math.PI * 2);
        ctx.stroke();

        // User Name & Handle
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px -apple-system, sans-serif";
        ctx.fillText(name, 300, 285);

        ctx.fillStyle = "#8a8d9b";
        ctx.font = "16px -apple-system, sans-serif";
        ctx.fillText(`@${username}`, 300, 315);

        // QR Code Box
        ctx.fillStyle = "#ffffff";
        drawRoundRect(ctx, 160, 360, 280, 280, 24);
        ctx.fill();

        const qrSrcCanvas = document.getElementById("qr-canvas");
        if (qrSrcCanvas) {
          ctx.drawImage(qrSrcCanvas, 180, 380, 240, 240);
        }

        // Footer hint
        ctx.fillStyle = "#e0e0e0";
        ctx.font = "15px -apple-system, sans-serif";
        ctx.fillText("Mở Camera điện thoại quét mã để kết bạn", 300, 690);

        ctx.fillStyle = "#ffd700";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.fillText(`locket.cam/${username}`, 300, 725);

        const a = document.createElement("a");
        a.download = `locket-friend-pass-${username}.png`;
        a.href = offCanvas.toDataURL("image/png");
        a.click();
        showToast("Đã tải Thẻ QR Kết Bạn VIP!", "success");
      };

      userImg.onerror = () => {
        showToast("Đang tạo thẻ QR...", "info");
      };
    });
  }
}

// ================= 5. DATA BACKUP & OFFLINE PHOTO BOOK ================= //
function initMemoriesBackup() {
  const btnExportHtml = document.getElementById("btn-export-album-html");
  const btnExportJson = document.getElementById("btn-export-album-json");

  if (btnExportJson) {
    btnExportJson.addEventListener("click", () => {
      if (!state.moments || state.moments.length === 0) {
        showToast("Chưa có khoảnh khắc nào để sao lưu!", "info");
        return;
      }

      const jsonStr = JSON.stringify(state.moments, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const a = document.createElement("a");
      a.download = `locket-moments-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Đã tải tệp sao lưu JSON thành công!", "success");
    });
  }

  if (btnExportHtml) {
    btnExportHtml.addEventListener("click", () => {
      if (!state.moments || state.moments.length === 0) {
        showToast("Chưa có khoảnh khắc nào để xuất sách ảnh!", "info");
        return;
      }

      const user = state.currentUser || {};
      const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "Người dùng";
      const exportDate = new Date().toLocaleDateString("vi-VN");

      const cardsHtml = state.moments.map(m => {
        const mediaUrl = m.image_url || m.video_url || "";
        const isVideo = !!m.video_url;
        const author = m.author || m.user || {};
        const authorName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Bạn bè";
        const authorAvatar = author.profile_picture_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100";
        const dt = m.date || (m.created_at ? new Date(parseInt(m.created_at) * 1000) : new Date());
        const dateStr = new Date(dt).toLocaleString("vi-VN");

        return `
          <div class="moment-item">
            <div class="media-wrap">
              ${isVideo
                ? `<video src="${escapeHtml(mediaUrl)}" controls playsinline></video>`
                : `<img src="${escapeHtml(mediaUrl)}" alt="Moment" loading="lazy">`
              }
            </div>
            <div class="info-wrap">
              <div class="author-row">
                <img src="${escapeHtml(authorAvatar)}" class="avatar" alt="${escapeHtml(authorName)}">
                <div>
                  <div class="author-name">${escapeHtml(authorName)}</div>
                  <div class="moment-time">${dateStr}</div>
                </div>
              </div>
              ${m.caption ? `<div class="caption">${escapeHtml(m.caption)}</div>` : ""}
            </div>
          </div>
        `;
      }).join("");

      const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Sách Ảnh Kỷ Niệm Locket - ${escapeHtml(userName)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0f12;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 30px 20px;
    }
    .header {
      max-width: 1200px;
      margin: 0 auto 30px auto;
      text-align: center;
      padding: 30px;
      background: linear-gradient(145deg, #16181d, #1f232b);
      border: 1px solid #30363d;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .header h1 {
      font-size: 28px;
      color: #ffd700;
      margin-bottom: 8px;
    }
    .header p {
      color: #8b949e;
      font-size: 14px;
    }
    .gallery {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }
    .moment-item {
      background: #16181d;
      border: 1px solid #30363d;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      transition: transform 0.2s;
    }
    .moment-item:hover {
      transform: translateY(-4px);
      border-color: #ffd700;
    }
    .media-wrap {
      width: 100%;
      aspect-ratio: 1/1;
      background: #000;
    }
    .media-wrap img, .media-wrap video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .info-wrap {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .author-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #ffd700;
    }
    .author-name {
      font-weight: 700;
      font-size: 14px;
      color: #fff;
    }
    .moment-time {
      font-size: 11px;
      color: #8b949e;
    }
    .caption {
      font-size: 13.5px;
      line-height: 1.4;
      background: rgba(255,255,255,0.04);
      padding: 8px 12px;
      border-radius: 8px;
      color: #ffd700;
    }
    .footer {
      max-width: 1200px;
      margin: 40px auto 10px auto;
      text-align: center;
      font-size: 12px;
      color: #8b949e;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✦ Sách Ảnh Kỷ Niệm Locket ✦</h1>
    <p>Chủ tài khoản: <strong>${escapeHtml(userName)}</strong> • Tổng số: <strong>${state.moments.length} khoảnh khắc</strong></p>
    <p style="margin-top:4px;">Xuất bản ngày: ${exportDate} • Locket by Tunggg Edition</p>
  </div>
  <div class="gallery">
    ${cardsHtml}
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Locket by Tunggg • Dữ liệu lưu trữ cá nhân ngoại tuyến</p>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.download = `Locket-PhotoBook-${new Date().toISOString().split("T")[0]}.html`;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Đã tải Sách Ảnh Kỷ Niệm HTML Offline!", "success");
    });
  }
}

// ================= 6. LOCKET GOLD VIP SUITE ================= //
async function downloadHdMedia(url, filename) {
  if (!url) return;
  showToast("💎 Đang tải file gốc Ultra HD không nén từ Locket Cloud...", "info");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    const ext = blob.type.includes("video") ? "mp4" : "jpg";
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${filename || 'locket-ultra-hd'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    showToast("🎉 Đã tải khoảnh khắc Ultra HD gốc thành công!", "success");
  } catch (e) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.download = filename || "locket-ultra-hd";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("Đang mở tệp media gốc chất lượng cao...", "info");
  }
}

function initLocketVipSuite() {
  const toggleGhost = document.getElementById("toggle-ghost-mode");
  const btnDownloadVip = document.getElementById("btn-download-vip-card");

  // Ghost Mode Init
  if (toggleGhost) {
    const isGhost = localStorage.getItem("locket_ghost_mode") !== "false";
    toggleGhost.checked = isGhost;
    toggleGhost.addEventListener("change", (e) => {
      localStorage.setItem("locket_ghost_mode", e.target.checked);
      if (e.target.checked) {
        showToast("👻 Chế độ Ẩn Danh VIP: Đang BẬT! Bạn có thể xem ảnh & story bạn bè hoàn toàn vô hình.", "success");
      } else {
        showToast("Đã tắt Chế độ Ẩn Danh.", "info");
      }
    });
  }

  // 3D Locket Gold VIP Member Card Tilt Effect
  const card = document.getElementById("vip-member-card");
  if (card) {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotX = -(y / (rect.height / 2)) * 10;
      const rotY = (x / (rect.width / 2)) * 10;
      card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)";
    });
  }

  // Generate & Download 3D VIP Card PNG
  if (btnDownloadVip) {
    btnDownloadVip.addEventListener("click", () => {
      const user = state.user || {};
      const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "HOANG GIA VIP";
      const last4 = user.uid ? user.uid.slice(-4).toUpperCase() : "GOLD";

      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 540;
      const ctx = canvas.getContext("2d");

      // Deep Luxury Obsidian Gold Gradient
      const grad = ctx.createLinearGradient(0, 0, 900, 540);
      grad.addColorStop(0, "#191507");
      grad.addColorStop(0.4, "#2e250b");
      grad.addColorStop(0.7, "#1c1808");
      grad.addColorStop(1, "#0f0d04");
      ctx.fillStyle = grad;
      drawRoundRect(ctx, 0, 0, 900, 540, 36);
      ctx.fill();

      // Metallic 24K Gold Border
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 5;
      drawRoundRect(ctx, 15, 15, 870, 510, 30);
      ctx.stroke();

      // Inner subtle border
      ctx.strokeStyle = "rgba(255, 215, 0, 0.25)";
      ctx.lineWidth = 1.5;
      drawRoundRect(ctx, 25, 25, 850, 490, 24);
      ctx.stroke();

      // Top Header Brand
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 28px -apple-system, sans-serif";
      ctx.fillText("👑 LOCKET GOLD VIP", 60, 85);

      // Status Pill
      ctx.fillStyle = "rgba(255, 215, 0, 0.18)";
      drawRoundRect(ctx, 610, 55, 230, 38, 19);
      ctx.fill();
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 13px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✦ LIFETIME ACTIVE", 725, 79);
      ctx.textAlign = "left";

      // Golden EMV Chip
      const chipGrad = ctx.createLinearGradient(60, 140, 140, 205);
      chipGrad.addColorStop(0, "#d4af37");
      chipGrad.addColorStop(0.5, "#fae188");
      chipGrad.addColorStop(1, "#997305");
      ctx.fillStyle = chipGrad;
      drawRoundRect(ctx, 60, 140, 80, 65, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Chip circuit accents
      ctx.strokeStyle = "rgba(100, 70, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(75, 152, 50, 40);

      // Contactless Wi-Fi wave icon
      ctx.fillStyle = "rgba(255, 215, 0, 0.75)";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("🛜", 160, 185);

      // Embossed Card Number
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 34px 'Courier New', Courier, monospace";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowOffsetY = 3;
      ctx.shadowBlur = 6;
      ctx.fillText(`8888   7777   9999   ${last4}`, 60, 280);
      ctx.shadowColor = "transparent";

      // Divider line
      ctx.strokeStyle = "rgba(255, 215, 0, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, 340);
      ctx.lineTo(840, 340);
      ctx.stroke();

      const isAdmin = isInitialAdminUser(user);

      // Details Columns
      // Cardholder
      ctx.fillStyle = "#8e8d96";
      ctx.font = "bold 13px -apple-system, sans-serif";
      ctx.fillText("HỘI VIÊN SỞ HỮU", 60, 385);
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 24px -apple-system, sans-serif";
      ctx.fillText(name.toUpperCase() + (isAdmin ? " ✔" : ""), 60, 425);

      // Expiry
      ctx.fillStyle = "#8e8d96";
      ctx.font = "bold 13px -apple-system, sans-serif";
      ctx.fillText("HẠN DÙNG", 420, 385);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px -apple-system, sans-serif";
      ctx.fillText("VĨNH VIỄN ✦", 420, 425);

      // Rank
      ctx.fillStyle = "#8e8d96";
      ctx.font = "bold 13px -apple-system, sans-serif";
      ctx.fillText("CẤP BẬC", 650, 385);
      ctx.fillStyle = isAdmin ? "#00c6ff" : "#ffd700";
      ctx.font = "bold 20px -apple-system, sans-serif";
      ctx.fillText(isAdmin ? "ROOT ADMIN 🛡️" : "SUPREME VIP 👑", 650, 425);

      // Watermark
      ctx.fillStyle = "rgba(255, 215, 0, 0.3)";
      ctx.font = "12px -apple-system, sans-serif";
      ctx.fillText("✦ LOCKET BY TUNGGG · OFFICIAL VIP MEMBER CARD", 60, 495);

      const a = document.createElement("a");
      a.download = `locket-gold-vip-member-card-${last4}.png`;
      a.href = canvas.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("🎉 Đã tải Thẻ Hội Viên Locket Gold VIP thành công!", "success");
    });
  }
}

// Attach all mega feature listeners
initFeedSearchAndFilters();
initPolaroidListeners();
initSlideshowListeners();
initWidgetSimListeners();
initMemoriesCalendar();
initDoodleStudio();
initMusicSearch();
initQRPassModal();
initMemoriesBackup();
initLocketVipSuite();

// Hook favorites and streak on load
const origRenderCurrentUser = renderCurrentUser;
renderCurrentUser = function() {
  origRenderCurrentUser();
  loadFavorites();
  updateDailyStreak();
};

// ================= App Start ================= //

checkAuthStatus();
