(() => {
  const KEY = "sentence_splitter_autosave_v1";

  function safeJsonParse(str) { try { return JSON.parse(str); } catch { return null; } }
  function sanitizeState(state) {
    if (!Array.isArray(state)) return [];
    return state.map(it => ({
      text: String(it?.text ?? ""),
      type: (it?.type === "desc" || it?.type === "as" || it?.type === "none") ? it.type : "desc",
      as: String(it?.as ?? "")
    }));
  }

  function save(payload) {
    const data = {
      version: 1,
      updatedAt: new Date().toISOString(),
      inputText: String(payload?.inputText ?? ""),
      state: sanitizeState(payload?.state),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return {
      inputText: String(parsed.inputText ?? ""),
      state: sanitizeState(parsed.state),
      updatedAt: parsed.updatedAt ?? null
    };
  }

  function clear() { localStorage.removeItem(KEY); }

  function debounce(fn, wait = 250) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  window.AppStorage = { save, load, clear, debounce };
})();
