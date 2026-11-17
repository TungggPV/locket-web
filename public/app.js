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

// ================= App Start ================= //
checkAuthStatus();
