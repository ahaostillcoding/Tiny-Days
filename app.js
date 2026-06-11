const palette = [
  { name: "黑色", value: "#2f2c25", poem: "黑色" },
  { name: "红色", value: "#c65243", poem: "红色" },
  { name: "蓝色", value: "#5d94b7", poem: "蓝色" },
  { name: "绿色", value: "#668953", poem: "绿色" },
];

const STORAGE_KEY = "pixel-diary:v1";
const GITHUB_SYNC_KEY = "pixel-diary:github-sync:v1";
const GITHUB_TOKEN_KEY = "pixel-diary:github-token:v1";
const size = 16;
const totalPixels = size * size;

const pixelCanvas = document.querySelector("#pixelCanvas");
const paletteEl = document.querySelector("#palette");
const yearBoard = document.querySelector("#yearBoard");
const memoryStrip = document.querySelector("#memoryStrip");
const currentDateEl = document.querySelector("#currentDate");
const poemText = document.querySelector("#poemText");
const pixelRain = document.querySelector("#pixelRain");
const drawTool = document.querySelector("#drawTool");
const eraseTool = document.querySelector("#eraseTool");
const prevDayButton = document.querySelector("#prevDayButton");
const nextDayButton = document.querySelector("#nextDayButton");
const exportButton = document.querySelector("#exportButton");
const repoOwnerInput = document.querySelector("#repoOwnerInput");
const repoNameInput = document.querySelector("#repoNameInput");
const branchInput = document.querySelector("#branchInput");
const dataPathInput = document.querySelector("#dataPathInput");
const tokenInput = document.querySelector("#tokenInput");
const autoSyncInput = document.querySelector("#autoSyncInput");
const saveSyncSettingsButton = document.querySelector("#saveSyncSettingsButton");
const syncNowButton = document.querySelector("#syncNowButton");
const loadGitHubButton = document.querySelector("#loadGitHubButton");
const syncStatus = document.querySelector("#syncStatus");

let state = loadState();
let syncConfig = loadSyncConfig();
let selectedColor = palette[1].value;
let tool = "draw";
let activeDate = startOfDay(new Date());
let activeKey = dateKey(activeDate);
let syncTimer = null;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function inferRepoDefaults() {
  const defaults = {
    owner: "ahaostillcoding",
    repo: "Tiny-Days",
    branch: "main",
    dataPath: "data/entries",
    autoSync: false,
  };

  const hostParts = window.location.hostname.split(".");
  const repoFromPath = window.location.pathname.split("/").filter(Boolean)[0];
  if (hostParts.length >= 3 && hostParts[1] === "github" && hostParts[2] === "io") {
    defaults.owner = hostParts[0];
    if (repoFromPath) defaults.repo = repoFromPath;
  }

  return defaults;
}

function loadSyncConfig() {
  const defaults = inferRepoDefaults();
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(GITHUB_SYNC_KEY)) };
  } catch {
    return defaults;
  }
}

function saveSyncConfig() {
  syncConfig = {
    owner: repoOwnerInput.value.trim(),
    repo: repoNameInput.value.trim(),
    branch: branchInput.value.trim() || "main",
    dataPath: normalizeDataPath(dataPathInput.value),
    autoSync: autoSyncInput.checked,
  };
  localStorage.setItem(GITHUB_SYNC_KEY, JSON.stringify(syncConfig));

  const token = tokenInput.value.trim();
  if (token) sessionStorage.setItem(GITHUB_TOKEN_KEY, token);
  renderSyncSettings();
  setSyncStatus("设置已保存。", "ok");
}

function renderSyncSettings() {
  repoOwnerInput.value = syncConfig.owner;
  repoNameInput.value = syncConfig.repo;
  branchInput.value = syncConfig.branch;
  dataPathInput.value = syncConfig.dataPath;
  autoSyncInput.checked = Boolean(syncConfig.autoSync);
  tokenInput.value = sessionStorage.getItem(GITHUB_TOKEN_KEY) || "";
}

function normalizeDataPath(path) {
  return (path || "data/entries").trim().replace(/^\/+|\/+$/g, "") || "data/entries";
}

function getGitHubToken() {
  const token = tokenInput.value.trim() || sessionStorage.getItem(GITHUB_TOKEN_KEY) || "";
  if (token) sessionStorage.setItem(GITHUB_TOKEN_KEY, token);
  return token;
}

function setSyncStatus(message, tone = "") {
  syncStatus.textContent = message;
  syncStatus.className = `sync-status${tone ? ` ${tone}` : ""}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function getEntry(key = activeKey) {
  if (!state.entries[key]) {
    state.entries[key] = {
      pixels: Array(totalPixels).fill(null),
      rainy: deterministicRain(key),
      updatedAt: Date.now(),
    };
    saveState();
  }
  return state.entries[key];
}

function deterministicRain(key) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return hash % 5 === 0;
}

function renderPalette() {
  paletteEl.innerHTML = "";
  palette.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `swatch${selectedColor === color.value ? " active" : ""}`;
    button.style.background = color.value;
    button.title = color.name;
    button.setAttribute("aria-label", color.name);
    button.addEventListener("click", () => {
      selectedColor = color.value;
      tool = "draw";
      drawTool.classList.add("active");
      eraseTool.classList.remove("active");
      renderPalette();
    });
    paletteEl.appendChild(button);
  });
}

function renderCanvas() {
  const entry = getEntry();
  pixelCanvas.innerHTML = "";
  pixelCanvas.parentElement.classList.toggle("rainy", entry.rainy);
  entry.pixels.forEach((color, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "pixel";
    cell.style.background = color || "";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `第 ${index + 1} 颗像素`);
    cell.addEventListener("click", () => paintPixel(index));
    pixelCanvas.appendChild(cell);
  });
  renderRain(entry.rainy);
}

function paintPixel(index) {
  const entry = getEntry();
  entry.pixels[index] = tool === "erase" ? null : selectedColor;
  entry.updatedAt = Date.now();
  saveState();
  renderCanvas();
  renderYearBoard();
  renderMemoryStrip();
  renderPoem();
  scheduleAutoSync();
}

function renderRain(enabled) {
  pixelRain.innerHTML = "";
  if (!enabled) return;
  for (let i = 0; i < 24; i += 1) {
    const drop = document.createElement("span");
    drop.className = "rain-drop";
    drop.style.left = `${8 + Math.random() * 40}px`;
    drop.style.top = `${Math.random() * 460}px`;
    drop.style.animationDuration = `${1.3 + Math.random() * 1.8}s`;
    drop.style.animationDelay = `${Math.random() * -2}s`;
    pixelRain.appendChild(drop);
  }
}

function renderPoem() {
  const entry = getEntry();
  const counts = palette
    .map((color) => ({
      ...color,
      count: entry.pixels.filter((pixel) => pixel === color.value).length,
    }))
    .filter((color) => color.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!counts.length) {
    poemText.textContent = entry.rainy
      ? "今天还没有落笔，雨丝先替你在边上写了几行。"
      : "点下第一颗像素，今天就开始发光。";
    return;
  }

  const countText = counts
    .slice(0, 3)
    .map((color) => `${color.count} 次${color.poem}`)
    .join("，");
  const shape = guessShape(entry.pixels);
  const weather = entry.rainy ? "，雨在画布边缘慢慢落下" : "";
  poemText.textContent = `今天你用了 ${countText}，形状看起来像${shape}${weather}。`;
}

function guessShape(pixels) {
  const filled = pixels
    .map((color, index) => (color ? { x: index % size, y: Math.floor(index / size) } : null))
    .filter(Boolean);

  if (filled.length < 5) return "一粒刚醒来的种子";

  const xs = filled.map((p) => p.x);
  const ys = filled.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const topHalf = filled.filter((p) => p.y <= minY + height / 2).length;
  const bottomHalf = filled.length - topHalf;
  const leftHalf = filled.filter((p) => p.x <= minX + width / 2).length;
  const rightHalf = filled.length - leftHalf;

  if (height > width * 1.7) return "一根安静的蜡烛";
  if (width > height * 1.7) return "一条趴着的小路";
  if (topHalf > bottomHalf * 1.8 && height > 5) return "一把小伞";
  if (bottomHalf > topHalf * 1.6) return "一只小碗";
  if (Math.abs(leftHalf - rightHalf) <= Math.max(3, filled.length * 0.12)) return "一枚圆圆的纪念章";
  return "一件放进口袋的旧事";
}

function renderYearBoard() {
  const todayKey = dateKey(startOfDay(new Date()));
  const year = activeDate.getFullYear();
  yearBoard.innerHTML = "";

  for (let month = 0; month < 12; month += 1) {
    const label = document.createElement("div");
    label.className = "month-label";
    label.textContent = `${String(month + 1).padStart(2, "0")}月`;
    yearBoard.appendChild(label);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= 31; day += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day-cell";

      if (day <= daysInMonth) {
        const date = new Date(year, month, day);
        const key = dateKey(date);
        const entry = state.entries[key];
        const isToday = key === todayKey;
        cell.classList.toggle("saved", Boolean(entry && entry.pixels.some(Boolean)));
        cell.classList.toggle("today", isToday);
        cell.title = `${formatDate(date)}${entry?.rainy ? "，雨天" : ""}`;
        cell.addEventListener("click", () => setActiveDate(date));
        drawMini(cell, entry?.pixels, 8);
      } else {
        cell.disabled = true;
        cell.setAttribute("aria-hidden", "true");
        cell.style.visibility = "hidden";
      }

      yearBoard.appendChild(cell);
    }
  }
}

function drawMini(parent, pixels, miniSize) {
  if (!pixels) return;
  const step = size / miniSize;
  for (let y = 0; y < miniSize; y += 1) {
    for (let x = 0; x < miniSize; x += 1) {
      const sourceX = Math.floor(x * step);
      const sourceY = Math.floor(y * step);
      const color = pixels[sourceY * size + sourceX];
      if (!color) continue;
      const dot = document.createElement("span");
      dot.className = parent.classList.contains("strip-day") ? "strip-pixel" : "mini-pixel";
      dot.style.left = `${(x / miniSize) * 100}%`;
      dot.style.top = `${(y / miniSize) * 100}%`;
      dot.style.background = color;
      parent.appendChild(dot);
    }
  }
}

function renderMemoryStrip() {
  memoryStrip.innerHTML = "";
  const start = new Date(activeDate);
  start.setDate(activeDate.getDate() - 6);
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dateKey(date);
    const entry = state.entries[key];
    const item = document.createElement("button");
    item.type = "button";
    item.className = `strip-day${key === activeKey ? " today" : ""}`;
    item.title = formatDate(date);
    item.addEventListener("click", () => setActiveDate(date));
    drawMini(item, entry?.pixels, 8);

    const label = document.createElement("span");
    label.className = "strip-date";
    label.textContent = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    item.appendChild(label);
    memoryStrip.appendChild(item);
  }
}

function setActiveDate(date) {
  activeDate = startOfDay(date);
  activeKey = dateKey(activeDate);
  currentDateEl.textContent = formatDate(activeDate);
  getEntry();
  renderCanvas();
  renderYearBoard();
  renderMemoryStrip();
  renderPoem();
}

function moveActiveDate(days) {
  const date = new Date(activeDate);
  date.setDate(activeDate.getDate() + days);
  setActiveDate(date);
}

function exportSnapshot() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pixel-diary-${dateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function scheduleAutoSync() {
  if (!syncConfig.autoSync || !getGitHubToken()) return;
  clearTimeout(syncTimer);
  setSyncStatus("本地已保存，稍后同步到 GitHub...", "");
  syncTimer = setTimeout(() => {
    syncActiveEntry().catch((error) => setSyncStatus(error.message, "error"));
  }, 1800);
}

function getEntryPoem(key) {
  const entry = getEntry(key);
  const counts = palette
    .map((color) => ({
      ...color,
      count: entry.pixels.filter((pixel) => pixel === color.value).length,
    }))
    .filter((color) => color.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!counts.length) {
    return entry.rainy
      ? "今天还没有落笔，雨丝先替你在边上写了几行。"
      : "点下第一颗像素，今天就开始发光。";
  }

  const countText = counts
    .slice(0, 3)
    .map((color) => `${color.count} 次${color.poem}`)
    .join("，");
  const weather = entry.rainy ? "，雨在画布边缘慢慢落下" : "";
  return `今天你用了 ${countText}，形状看起来像${guessShape(entry.pixels)}${weather}。`;
}

function entryPayload(key) {
  const entry = getEntry(key);
  return {
    app: "pixel-diary",
    version: 1,
    date: key,
    pixels: entry.pixels,
    rainy: entry.rainy,
    poem: getEntryPoem(key),
    updatedAt: entry.updatedAt,
    syncedAt: new Date().toISOString(),
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function githubFileUrl(path) {
  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://api.github.com/repos/${encodeURIComponent(syncConfig.owner)}/${encodeURIComponent(syncConfig.repo)}/contents/${encodedPath}`;
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(content) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 404) return null;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || `GitHub 请求失败：${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function syncActiveEntry() {
  saveSyncConfig();
  const token = getGitHubToken();
  if (!token) throw new Error("请先填入 GitHub token。");
  if (!syncConfig.owner || !syncConfig.repo) throw new Error("请填写仓库主人和仓库名。");

  setSyncStatus("正在把今天写进 GitHub...", "");
  const filePath = `${syncConfig.dataPath}/${activeKey}.json`;
  const url = `${githubFileUrl(filePath)}?ref=${encodeURIComponent(syncConfig.branch)}`;
  const existing = await githubRequest(url, {
    method: "GET",
    headers: githubHeaders(token),
  });

  const payload = JSON.stringify(entryPayload(activeKey), null, 2);
  const body = {
    message: `Save pixel diary for ${activeKey}`,
    content: encodeBase64(payload),
    branch: syncConfig.branch,
  };
  if (existing?.sha) body.sha = existing.sha;

  await githubRequest(githubFileUrl(filePath), {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  setSyncStatus(`已保存到 GitHub：${filePath}`, "ok");
}

async function loadEntriesFromGitHub() {
  saveSyncConfig();
  const token = getGitHubToken();
  if (!token) throw new Error("请先填入 GitHub token。");
  if (!syncConfig.owner || !syncConfig.repo) throw new Error("请填写仓库主人和仓库名。");

  setSyncStatus("正在从 GitHub 读取日记...", "");
  const dirUrl = `${githubFileUrl(syncConfig.dataPath)}?ref=${encodeURIComponent(syncConfig.branch)}`;
  const files = await githubRequest(dirUrl, {
    method: "GET",
    headers: githubHeaders(token),
  });

  if (!Array.isArray(files)) {
    setSyncStatus("仓库里还没有远程日记。", "");
    return;
  }

  const jsonFiles = files.filter((file) => file.type === "file" && file.name.endsWith(".json"));
  let imported = 0;
  for (const file of jsonFiles) {
    const detail = await githubRequest(file.url, {
      method: "GET",
      headers: githubHeaders(token),
    });
    if (!detail?.content) continue;
    const entry = JSON.parse(decodeBase64(detail.content));
    if (!entry?.date || !Array.isArray(entry.pixels)) continue;
    state.entries[entry.date] = {
      pixels: entry.pixels.slice(0, totalPixels),
      rainy: Boolean(entry.rainy),
      updatedAt: entry.updatedAt || Date.now(),
    };
    imported += 1;
  }

  saveState();
  setActiveDate(activeDate);
  setSyncStatus(`已从 GitHub 读取 ${imported} 天日记。`, "ok");
}

drawTool.addEventListener("click", () => {
  tool = "draw";
  drawTool.classList.add("active");
  eraseTool.classList.remove("active");
});

eraseTool.addEventListener("click", () => {
  tool = "erase";
  eraseTool.classList.add("active");
  drawTool.classList.remove("active");
});

prevDayButton.addEventListener("click", () => moveActiveDate(-1));
nextDayButton.addEventListener("click", () => moveActiveDate(1));
exportButton.addEventListener("click", exportSnapshot);
saveSyncSettingsButton.addEventListener("click", saveSyncConfig);
syncNowButton.addEventListener("click", () => {
  syncActiveEntry().catch((error) => setSyncStatus(error.message, "error"));
});
loadGitHubButton.addEventListener("click", () => {
  loadEntriesFromGitHub().catch((error) => setSyncStatus(error.message, "error"));
});

renderPalette();
renderSyncSettings();
setActiveDate(activeDate);
