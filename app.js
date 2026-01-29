const $ = (s) => document.querySelector(s);

const inputEl = $("#input");
const listEl = $("#list");
const countEl = $("#count");
const outputEl = $("#output");
const copyAllBtn = $("#copyAllBtn");
const clearBtn = $("#clearBtn");
const copyMsgEl = $("#copyMsg");

let state = []; // [{ text, type, as }]

// 저장(디바운스)
const saveDraft = AppStorage.debounce(() => {
  AppStorage.save({ inputText: inputEl.value, state });
}, 250);

// 자동 분리(디바운스)
const autoSplit = AppStorage.debounce(() => {
  const sentences = splitSentences(inputEl.value);
  state = reconcileState(state, sentences);
  render();
}, 250);

// ✅ 빈 줄 2줄 이상 → 특수 문장 삽입
function replaceDoubleLineBreak(text) {
  const marker = ' [ ](#" style="text-decoration: none; display:block;)';
  return text.replace(/\n\s*\n+/g, `\n${marker}\n`);
}

// ✅ 문장 분리: 줄바꿈 + 구두점(.!?…) 기준
function splitSentences(text) {
  text = replaceDoubleLineBreak(text);

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\s+\n/g, "\n")
    .trim();

  if (!normalized) return [];

  return normalized.split("\n").flatMap((line) => {
    const t = line.trim();
    if (!t) return [];
    const parts = t.split(/(?<=[.!?…])\s+/g);
    return parts.map(p => p.trim()).filter(Boolean);
  });
}

// ✅ 기존 state에서 같은 문장은 prefix/as 유지
function reconcileState(prevState, newSentences) {
  const prev = Array.isArray(prevState) ? prevState : [];
  const used = new Set();

  function takeMatch(text) {
    for (let i = 0; i < prev.length; i++) {
      if (used.has(i)) continue;
      if ((prev[i]?.text ?? "") === text) {
        used.add(i);
        return prev[i];
      }
    }
    return null;
  }

  return newSentences.map((t) => {
    const m = takeMatch(t);
    if (m) return { text: t, type: m.type, as: m.as };
    return { text: t, type: "desc", as: "" };
  });
}

// ✅ /as 값은 항상 "..." 로
function normalizeQuotedName(raw) {
  let v = (raw || "").trim();
  if (!v) return "";
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1).trim();
  v = v.replaceAll('"', '\\"');
  return `"${v}"`;
}

function buildPrefix(type, asValue) {
  if (type === "desc") return "/desc ";
  if (type === "as") {
    const q = normalizeQuotedName(asValue);
    return q ? `/as ${q} ` : "/as ";
  }
  return "";
}

function sentenceWithPrefix(item) {
  return buildPrefix(item.type, item.as) + item.text;
}

// ✅ 결과 미리보기 스크롤 제거(자동 높이)
function autoResizeOutput() {
  outputEl.style.height = "auto";
  outputEl.style.height = outputEl.scrollHeight + "px";
}

function rebuildOutput() {
  outputEl.value = state.map(sentenceWithPrefix).join("\n");
  autoResizeOutput();
  saveDraft();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function render() {
  listEl.innerHTML = "";
  countEl.textContent = `총 ${state.length}개`;

  state.forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "card";

    const top = document.createElement("div");
    top.className = "topline";

    const group = document.createElement("div");
    group.className = "prefix-group";

    const seg = document.createElement("div");
    seg.className = "seg";

    const name = `p_${i}`;
    const idDesc = `d_${i}`;
    const idAs = `a_${i}`;
    const idNone = `n_${i}`;

    seg.innerHTML = `
      <input id="${idDesc}" type="radio" name="${name}" value="desc" ${item.type==="desc"?"checked":""}>
      <label for="${idDesc}">/desc</label>

      <input id="${idAs}" type="radio" name="${name}" value="as" ${item.type==="as"?"checked":""}>
      <label for="${idAs}">/as</label>

      <input id="${idNone}" type="radio" name="${name}" value="none" ${item.type==="none"?"checked":""}>
      <label for="${idNone}">(없음)</label>
    `;

    const asInput = document.createElement("input");
    asInput.className = "as-input";
    asInput.type = "text";
    asInput.placeholder = "나레이터";
    asInput.value = item.as || "";
    asInput.style.display = item.type === "as" ? "inline-block" : "none";

    seg.addEventListener("change", () => {
      item.type = seg.querySelector(`input[name="${name}"]:checked`)?.value || "desc";
      asInput.style.display = item.type === "as" ? "inline-block" : "none";
      rebuildOutput();
    });

    asInput.addEventListener("input", () => {
      item.as = asInput.value;
      rebuildOutput();
    });

    group.appendChild(seg);
    group.appendChild(asInput);

    const meta = document.createElement("div");
    meta.className = "small";
    meta.textContent = `#${i + 1}`;

    top.appendChild(group);
    top.appendChild(meta);

    const sentence = document.createElement("div");
    sentence.className = "sentence";
    sentence.textContent = item.text;

    // ✅ 문장 div 클릭 → 개별 복사
    sentence.addEventListener("click", async () => {
      const ok = await copyText(sentenceWithPrefix(item));
      if (copyMsgEl) copyMsgEl.textContent = ok ? `#${i+1} 복사됨 ✅` : `#${i+1} 복사 실패 ❌`;
    });

    card.appendChild(top);
    card.appendChild(sentence);
    listEl.appendChild(card);
  });

  rebuildOutput();
}

// ✅ 저장 복구
(function restore() {
  const saved = AppStorage.load();
  if (!saved) return;

  inputEl.value = saved.inputText || "";
  const sentences = splitSentences(inputEl.value);
  state = reconcileState(saved.state || [], sentences);
  render();
})();

// ✅ 입력 변경 → 자동 분리
inputEl.addEventListener("input", () => {
  saveDraft();
  autoSplit();
});

// 지우기
clearBtn.addEventListener("click", () => {
  inputEl.value = "";
  state = [];
  listEl.innerHTML = "";
  countEl.textContent = "";
  outputEl.value = "";
  if (copyMsgEl) copyMsgEl.textContent = "";
  AppStorage.clear();
  inputEl.focus();
});

// 전체 복사
copyAllBtn.addEventListener("click", async () => {
  const text = outputEl.value.trim();
  if (!text) return;
  const ok = await copyText(text);
  if (copyMsgEl) copyMsgEl.textContent = ok ? "전체 복사됨 ✅" : "전체 복사 실패 ❌";
});
