/* 竹枕快速适配 PWA —— 页面逻辑（镜像 Android 版功能） */
"use strict";

// ---------- 状态存储 ----------
const LS = {
  collector: "bp.collector",     // {name,phone,customLocations[]}
  history: "bp.history"          // [{ts,name,phone,gender,height,weight,shoulder,posture,location,note,result}]
};
const load = (k, dflt) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? dflt : v; }
  catch (_) { return dflt; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let RULES = null;
const collector = () => load(LS.collector, { name: "", phone: "", customLocations: [] });
const history = () => load(LS.history, []);

// ---------- 工具 ----------
const $ = (id) => document.getElementById(id);
function toast(msg, ms = 1800) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.add("hidden"), ms);
}
const fmtNum = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(/\.0$/, ""));

// ---------- 视图切换 ----------
function show(view) {
  for (const s of document.querySelectorAll(".view")) s.classList.remove("active");
  $("view-" + view).classList.add("active");
  for (const b of document.querySelectorAll("#navbar button"))
    b.classList.toggle("active", b.dataset.view === view);
  window.scrollTo(0, 0);
}
document.querySelectorAll("#navbar button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

// ---------- 采集人 ----------
function renderCollectorTip() {
  const c = collector();
  $("collector-tip").classList.toggle("hidden", !!(c.name && c.phone));
}
$("btn-goto-settings").addEventListener("click", () => show("settings"));

$("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("s-name").value.trim();
  const phone = $("s-phone").value.trim();
  if (!name || !phone) { toast("请填写采集人姓名和手机号"); return; }
  const c = collector();
  save(LS.collector, { ...c, name, phone });
  $("settings-msg").classList.remove("hidden");
  renderCollectorTip();
  toast("采集人已保存");
});

// ---------- 地点下拉（预设 + 自填历史，≤10 条去重） ----------
function locationOptions() {
  const c = collector();
  const set = [...c.customLocations.filter(Boolean)];
  for (const d of RULES.locationsDefault) if (!set.includes(d)) set.push(d);
  return set;
}
function renderLocMenu(filter) {
  const menu = $("loc-menu");
  const opts = locationOptions().filter((o) => !filter || o.includes(filter));
  menu.innerHTML = "";
  if (!opts.length) { menu.classList.add("hidden"); return; }
  for (const o of opts) {
    const d = document.createElement("div");
    d.textContent = o;
    d.addEventListener("click", () => {
      $("f-location").value = o;
      menu.classList.add("hidden");
    });
    menu.appendChild(d);
  }
  menu.classList.remove("hidden");
}
$("f-location").addEventListener("focus", () => renderLocMenu($("f-location").value.trim()));
$("f-location").addEventListener("input", () => renderLocMenu($("f-location").value.trim()));
document.addEventListener("click", (e) => {
  if (!e.target.closest(".loc-field")) $("loc-menu").classList.add("hidden");
});
function rememberLocation(loc) {
  const c = collector();
  const cur = [loc, ...c.customLocations.filter((x) => x !== loc)].slice(0, 10);
  save(LS.collector, { ...c, customLocations: cur });
}

// ---------- 问卷提交（支持历史修正：editingIdx 非空时覆盖保存） ----------
let editingIdx = null;

function setEditing(idx) {
  const hist = history();
  const rec = hist[idx];
  if (!rec) return;
  editingIdx = idx;
  $("f-name").value = rec.name || "";
  $("f-phone").value = rec.phone || "";
  const g = rec.gender === "女" ? "f-gender-female" : "f-gender-male";
  const radio = document.querySelector(`input[name="gender"][value="${rec.gender}"]`);
  if (radio) radio.checked = true;
  $("f-age").value = rec.age || "";
  $("f-height").value = rec.height || "";
  $("f-weight").value = rec.weight || "";
  $("f-shoulder").value = rec.shoulder || "";
  $("f-posture").value = rec.posture || "";
  $("f-location").value = rec.location || "";
  $("f-note").value = rec.note || "";
  $("f-osteo").value = rec.osteo || "不需要";
  $("f-osteo-note").value = rec.osteoNote || "";
  $("f-patch-six").value = rec.patchSix || "";
  $("f-patch-three").value = rec.patchThree || "";
  syncOsteoNote();
  $("editing-banner").classList.remove("hidden");
  $("btn-submit").textContent = "保存修正";
  show("survey");
}
function cancelEditing() {
  if (editingIdx == null) return;
  editingIdx = null;
  $("editing-banner").classList.add("hidden");
  $("btn-submit").textContent = "生成适配";
}
function syncOsteoNote() {
  $("osteo-note-wrap").classList.toggle("hidden", $("f-osteo").value !== "需要");
}
$("f-osteo").addEventListener("change", syncOsteoNote);

$("survey-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("f-name").value.trim();
  const phone = $("f-phone").value.trim();
  const gender = (document.querySelector('input[name="gender"]:checked') || {}).value;
  const age = parseInt($("f-age").value, 10) || 0;
  const height = parseFloat($("f-height").value);
  const weight = parseFloat($("f-weight").value);
  const shoulder = $("f-shoulder").value;
  const posture = $("f-posture").value;
  const location = $("f-location").value.trim();
  const note = $("f-note").value.trim();
  const osteo = $("f-osteo").value || "不需要";
  const osteoNote = osteo === "需要" ? $("f-osteo-note").value.trim() : "";
  const patchSix = parseInt($("f-patch-six").value, 10) || 0;
  const patchThree = parseInt($("f-patch-three").value, 10) || 0;

  if (!name || !phone) { toast("请填写姓名和联系方式"); return; }
  if (!gender) { toast("请选择性别"); return; }
  if (!(height >= 140 && height <= 200)) { toast("身高建议填写 140-200cm"); return; }
  if (!(weight >= 30 && weight <= 150)) { toast("体重建议填写 30-150kg"); return; }
  if (!shoulder || !posture) { toast("请选择肩宽自评与睡姿"); return; }
  if (!location) { toast("请填写采集地点"); return; }

  const result = BPEngine.compute(
    { gender, heightCm: height, weightKg: weight, shoulder, posture }, RULES);

  const rec = {
    ts: new Date().toLocaleString("zh-CN", { hour12: false }),
    name, phone, gender, age, height, weight, shoulder, posture, location, note,
    osteo, osteoNote, patchSix, patchThree,
    collector: collector().name || "",
    collectorPhone: collector().phone || "",
    result
  };
  const hist = history();

  if (editingIdx != null && hist[editingIdx]) {
    rec.ts = `${hist[editingIdx].ts} (修正 ${rec.ts})`;
    hist[editingIdx] = rec;
    save(LS.history, hist);
    rememberLocation(location);
    cancelEditing();
    renderHistory();
    toast("已修正并覆盖原记录");
    show("history");
    return;
  }

  hist.push(rec);
  save(LS.history, hist);
  rememberLocation(location);

  renderResult(rec);
  show("result");
});

function renderResult(rec) {
  const r = rec.result;
  const rows = [
    ["姓名 / 性别 / 年龄", `${rec.name} / ${rec.gender}${rec.age ? " / " + rec.age + " 岁" : ""}`],
    ["联系方式", rec.phone],
    ["身高 / 体重", `${rec.height}cm / ${rec.weight}kg`],
    ["BMI", fmtNum(r.bmi)], ["体型", r.bodyType], ["身高档", r.heightBand],
    ["基础枕高", fmtNum(r.baseHeight)], ["体型修正", fmtNum(r.bodyTypeAdjust)],
    ["肩宽修正", fmtNum(r.shoulderAdjust)], ["总修正", fmtNum(r.totalAdjust)],
    ["推荐枕高", fmtNum(r.recommended)], ["最终枕高", r.finalHeight != null ? `${fmtNum(r.finalHeight)} cm` : "—"],
    ["枕长", r.pillowLength != null ? `${r.pillowLength} cm` : "—"], ["枕宽", r.pillowWidth],
    ["情况描述", rec.note || "无"],
    ["是否需要正骨治疗", rec.osteo || "不需要"],
    ...(rec.osteo === "需要" ? [["正骨备注", rec.osteoNote || "—"]] : []),
    ...(rec.patchSix > 0 || rec.patchThree > 0
      ? [["肩颈腰腿贴", `六片装 ${rec.patchSix || 0} 袋 / 三片装 ${rec.patchThree || 0} 袋`]] : []),
    ["采集地点", rec.location], ["采集人", rec.collector]
  ];
  $("result-body").innerHTML =
    `<div class="card result-hero">
       <div class="big">${r.finalHeight != null ? fmtNum(r.finalHeight) : "—"}</div>
       <div class="unit">最终枕高（cm）</div>
       <div class="sub">枕长 ${r.pillowLength ?? "—"}cm · 枕宽 ${r.pillowWidth}</div>
     </div>
     <div class="card">${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v ?? "—"}</span></div>`).join("")}
       ${r.sideSleepNote ? `<p class="note">${r.sideSleepNote}</p>` : ""}
     </div>`;
}

$("btn-back-survey").addEventListener("click", () => {
  cancelEditing();
  $("survey-form").reset();
  syncOsteoNote();
  show("survey");
});

// ---------- 历史 ----------
function renderHistory() {
  const hist = history();
  const body = $("history-body");
  if (!hist.length) {
    body.innerHTML = `<p class="empty">暂无记录</p>`;
    return;
  }
  body.innerHTML = [...hist].reverse().map((rec, i) => {
    const idx = hist.length - 1 - i;
    const r = rec.result;
    const extra = [];
    if (rec.age) extra.push(["年龄", String(rec.age)]);
    if (rec.osteo === "需要") extra.push(["正骨", `${rec.osteo === "需要" ? "需要" : ""}${rec.osteoNote ? "（" + rec.osteoNote + "）" : ""}`]);
    if (rec.patchSix > 0 || rec.patchThree > 0) extra.push(["贴", `六片装 ${rec.patchSix || 0}袋 / 三片装 ${rec.patchThree || 0}袋`]);
    return `<div class="card history-item">
      <button class="edit" data-edit-idx="${idx}">修正</button>
      <button class="del" data-idx="${idx}">删除</button>
      <div class="kv"><span>姓名 / 性别</span><span>${rec.name} / ${rec.gender}${rec.age ? " / " + rec.age + "岁" : ""}</span></div>
      <div class="kv"><span>身高 / 体重</span><span>${rec.height}cm / ${rec.weight}kg</span></div>
      <div class="kv"><span>最终枕高 / 枕长</span><span>${fmtNum(r.finalHeight)}cm / ${r.pillowLength ?? "—"}cm</span></div>
      ${extra.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join("")}
      <div class="kv"><span>采集地点</span><span>${rec.location || "—"}</span></div>
      <div class="kv"><span>采集人</span><span>${rec.collector || "—"}</span></div>
      <div class="kv"><span>填表时间</span><span>${rec.ts}</span></div>
    </div>`;
  }).join("");
  body.querySelectorAll(".del").forEach((btn) => btn.addEventListener("click", () => {
    const hist2 = history();
    hist2.splice(Number(btn.dataset.idx), 1);
    save(LS.history, hist2);
    renderHistory();
  }));
  body.querySelectorAll(".edit").forEach((btn) => btn.addEventListener("click", () => {
    setEditing(Number(btn.dataset.editIdx));
  }));
}

$("btn-clear").addEventListener("click", () => {
  if (!history().length) { toast("暂无记录"); return; }
  if (confirm("确定清空全部历史记录？")) {
    save(LS.history, []);
    renderHistory();
    toast("已清空");
  }
});

// ---------- CSV 导出（27 列，与 Android CSVExporter 同序，UTF-8 BOM） ----------
const CSV_HEADER = ["填表时间", "姓名", "联系方式", "性别", "年龄", "身高cm", "体重kg", "肩宽自评", "睡姿",
  "采集地点", "采集人", "采集人手机", "BMI", "体型", "身高档", "基础枕高", "体型修正", "肩宽修正", "总修正",
  "最终枕高cm", "枕长cm", "枕宽", "情况描述", "是否需要正骨", "正骨备注(计划费用上限)", "六片装(袋)", "三片装(袋)"];
const esc = (v) => (v == null || v === "" ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

function buildCsv() {
  const lines = [CSV_HEADER.join(",")];
  for (const rec of history()) {
    const r = rec.result;
    lines.push([
      rec.ts, rec.name, rec.phone, rec.gender, rec.age ?? "", fmtNum(rec.height), fmtNum(rec.weight),
      rec.shoulder, rec.posture, rec.location, rec.collector, rec.collectorPhone,
      fmtNum(r.bmi), r.bodyType, r.heightBand, fmtNum(r.baseHeight), fmtNum(r.bodyTypeAdjust),
      fmtNum(r.shoulderAdjust), fmtNum(r.totalAdjust), fmtNum(r.finalHeight),
      r.pillowLength ?? "", r.pillowWidth, rec.note || "",
      rec.osteo || "不需要", rec.osteoNote || "", rec.patchSix ?? "", rec.patchThree ?? ""
    ].map(esc).join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

// 采集人姓名 → 汉语拼音全拼前缀（文件名防不同采集者重名；表缺失时回退 user）
let PINYIN = null;
function pinyinSlug(name) {
  const s = String(name || "").trim();
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0);
    const c = String.fromCharCode(code);
    if (/[A-Za-z0-9]/.test(c)) { out += c.toLowerCase(); continue; }
    if (code < 0x2e80) continue; // 标点/空白/符号跳过
    const key = "U+" + code.toString(16).toUpperCase().padStart(4, "0");
    const p = PINYIN && PINYIN[key];
    if (p) out += p;
  }
  return out.slice(0, 24) || "user";
}

$("btn-export").addEventListener("click", async () => {
  const hist = history();
  if (!hist.length) { toast("暂无记录可导出"); return; }
  const csv = buildCsv();
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const filename = `${pinyinSlug(collector().name)}_竹枕适配_${stamp}.csv`;

  // iOS 15+ 原生分享弹层（可存"文件"/发微信）；低版本/无 Web Share 落下载
  try {
    if (navigator.canShare && navigator.canShare({ files: [] })) {
      const file = new File([csv], filename, { type: "text/csv" });
      await navigator.share({ files: [file], title: "竹枕适配数据" });
      return;
    }
  } catch (_) { /* 用户取消或不支持，走下载 */ }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("已下载 " + filename);
});

// ---------- 说明 ----------
$("info-body").innerHTML = `
  <h3>填写方法</h3>
  <p>1. 先在「设置」页保存采集人姓名与手机号；</p>
  <p>2. 在「问卷」页逐项填写：姓名、联系方式、性别、年龄（选填）、身高（140-200cm）、体重（30-150kg）、肩宽自评、睡姿（仰卧为主 / 侧卧为主 / 趴卧为主 / 不确定）、采集地点（下拉预设，也可直接键入新地点，新地点自动记住）；</p>
  <p>3. 「情况描述」可手写（颈部粗短、肩部脂肪厚、锁骨突出、腰间盘突出、肩周炎、富贵包、拉伤、肌肉疼痛、痛经等），建议用输入法的语音键听写；</p>
  <p>4. 如需正骨随访请选「需要」并补计划时间 / 可承受费用上限等备注；购买「肩颈腰腿贴」按六片装 / 三片装分列记袋数，不买留空；</p>
  <p>5. 点「生成适配」即可看到最终枕高、枕长与参考说明，无需手动计算。</p>
  <h3>修正历史</h3>
  <p>历史卡片点「修正」回到编辑状态，保存后覆盖原记录；点「删除」删除该条；导出 CSV 为 27 列标准表。</p>
  <h3>规则摘要</h3>
  <p>BMI 分型：&lt;18.5 偏瘦，18.5-24 标准，&gt;24 偏胖；</p>
  <p>基础枕高按性别 × 身高档查表；总修正 = 体型修正 + 肩宽修正，钳位 [-0.5, +1.0]；</p>
  <p>最终枕高在 5-11cm 的 8 个档位中取最近，等距取较大；</p>
  <p>枕长：身高 &lt;165→35cm，165-175→37cm，≥175→39cm；枕宽待定制。</p>
  <h3>现场数据汇总</h3>
  <p>「历史→导出 CSV」生成 27 列标准表（含地点/采集人/正骨/贴袋），交给 PC 汇总文件夹即可自动并入 Excel 汇总表（见 PC 侧 merge_csv 使用说明）。</p>
  <h3>适用人群</h3>
  <p>园区义诊中上班人群肩周炎患者；身高 150-185cm、体重 30-150kg 范围内的成人。</p>
`;

// ---------- 启动 ----------
(async function init() {
  RULES = await (await fetch("./rules.json")).json();
  try { PINYIN = await (await fetch("./pinyin_map.json")).json(); } catch (_) { PINYIN = null; }
  const c = collector();
  $("s-name").value = c.name || "";
  $("s-phone").value = c.phone || "";
  renderCollectorTip();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
})();
