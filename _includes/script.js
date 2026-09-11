(function () {
  var CONTACT_EMAIL = "bakinazikk@gmail.com";

  var LANGUAGES = [
    { code: "en", name: "English", flag: "gb" },
    { code: "zh", name: "中文", flag: "cn" },
    { code: "es", name: "Español", flag: "es" },
    { code: "hi", name: "हिन्दी", flag: "in" },
    { code: "ar", name: "العربية", flag: "sa" },
    { code: "pt", name: "Português", flag: "pt" },
    { code: "bn", name: "বাংলা", flag: "bd" },
    { code: "ru", name: "Русский", flag: "ru" },
    { code: "ja", name: "日本語", flag: "jp" },
    { code: "de", name: "Deutsch", flag: "de" },
    { code: "fr", name: "Français", flag: "fr" },
    { code: "tr", name: "Türkçe", flag: "tr" },
    { code: "ko", name: "한국어", flag: "kr" },
    { code: "it", name: "Italiano", flag: "it" },
    { code: "id", name: "Bahasa Indonesia", flag: "id" }
  ];
  var SUPPORTED_CODES = LANGUAGES.map(function (l) { return l.code; });
  var RTL_CODES = ["ar"];
  var i18nDict = {};
  var currentLang = "tr";

  function t(key, vars) {
    var str = i18nDict[key] || "";
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.split("{" + k + "}").join(vars[k]);
      });
    }
    return str;
  }

  function findLanguage(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return null;
  }

  function formatDates() {
    var formatter = new Intl.DateTimeFormat(currentLang, { day: "2-digit", month: "long", year: "numeric" });
    document.querySelectorAll("[data-i18n-date]").forEach(function (el) {
      var iso = el.getAttribute("data-i18n-date");
      if (!iso) return;
      var date = new Date(iso);
      if (isNaN(date.getTime())) return;
      el.textContent = formatter.format(date);
    });
  }

  function applyI18n() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = RTL_CODES.indexOf(currentLang) !== -1 ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-value]").forEach(function (el) {
      el.value = t(el.getAttribute("data-i18n-value"));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      var text = t(el.getAttribute("data-i18n-aria-label"));
      var site = el.getAttribute("data-site-title");
      if (site) text = text.split("{site}").join(site);
      el.setAttribute("aria-label", text);
    });
    formatDates();
    updateLanguageTrigger();
  }

  function updateLanguageTrigger() {
    document.querySelectorAll("#lang-menu-panel button").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.lang === currentLang);
    });
  }

  var i18nData = {};
  try {
    var i18nDataEl = document.getElementById("i18n-data");
    if (i18nDataEl) i18nData = JSON.parse(i18nDataEl.textContent);
  } catch (e) {
    i18nData = {};
  }

  function setLanguage(lang) {
    i18nDict = i18nData[lang] || i18nData.en || {};
    currentLang = lang;
    applyI18n();
    document.dispatchEvent(new CustomEvent("i18n:changed"));
  }

  function chooseLanguage(lang) {
    localStorage.setItem("lang", lang);
    setLanguage(lang);
  }

  function detectInitialLanguage() {
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get("lang");
    var stored = localStorage.getItem("lang");

    if (urlLang && SUPPORTED_CODES.indexOf(urlLang) !== -1) {
      localStorage.setItem("lang", urlLang);
      removeUrlParam("lang");
      return urlLang;
    }
    if (stored && SUPPORTED_CODES.indexOf(stored) !== -1) {
      return stored;
    }

    var browserLang = (navigator.language || "tr").slice(0, 2).toLowerCase();
    var lang = SUPPORTED_CODES.indexOf(browserLang) !== -1 ? browserLang : "tr";
    localStorage.setItem("lang", lang);
    params.set("lang", lang);
    var url = window.location.pathname + "?" + params.toString() + window.location.hash;
    window.history.replaceState(null, "", url);
    return lang;
  }

  function setupLanguageMenu() {
    var panel = document.getElementById("lang-menu-panel");
    if (!panel) return;

    LANGUAGES.forEach(function (lang) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "menuitem");
      btn.dataset.lang = lang.code;
      var flag = document.createElement("span");
      flag.className = "fi fi-" + lang.flag;
      var name = document.createElement("span");
      name.textContent = lang.name;
      btn.appendChild(flag);
      btn.appendChild(name);
      btn.addEventListener("click", function () {
        chooseLanguage(lang.code);
      });
      panel.appendChild(btn);
    });
  }

  function setupI18n() {
    var lang = detectInitialLanguage();
    setupLanguageMenu();
    setLanguage(lang);
  }

  function readListParam(key, fallback) {
    var raw = new URLSearchParams(window.location.search).get(key);
    var n = parseInt(raw, 10);
    return isNaN(n) ? fallback : n;
  }

  function syncListParam(key, value, defaultValue) {
    var params = new URLSearchParams(window.location.search);
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    var query = params.toString();
    var url = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }

  var BATCH_SIZE = 5;
  var revealCounts = { all: 5, post: 5, quote: 5 };

  function matchingItemCount(filter) {
    var items = document.querySelectorAll("#posts-list .post-list-item");
    var count = 0;
    items.forEach(function (item) {
      if (filter === "all" || item.dataset.postType === filter) count++;
    });
    return count;
  }

  function renderFilter(filter) {
    var items = document.querySelectorAll("#posts-list .post-list-item");
    var limit = revealCounts[filter] || BATCH_SIZE;
    var shown = 0;
    items.forEach(function (item) {
      var match = filter === "all" || item.dataset.postType === filter;
      var hide = !match || shown >= limit;
      item.classList.toggle("post-filtered-out", hide);
      if (match && !hide) shown++;
    });
    var empty = document.getElementById("posts-filter-empty");
    if (empty) empty.style.display = shown === 0 ? "" : "none";
    var button = document.getElementById("posts-load-more");
    if (button) button.style.display = matchingItemCount(filter) > limit ? "flex" : "none";
  }

  function setupPostsList() {
    var container = document.getElementById("posts-list");
    var button = document.getElementById("posts-load-more");
    if (!container) return;

    BATCH_SIZE = parseInt(container.getAttribute("data-batch-size"), 10) || BATCH_SIZE;
    revealCounts.all = BATCH_SIZE;
    revealCounts.post = BATCH_SIZE;
    revealCounts.quote = BATCH_SIZE;

    if (button) {
      button.addEventListener("click", function () {
        var activeFilterTab = document.querySelector(".profile-tab.is-active[data-tab=\"posts\"]");
        var filter = activeFilterTab ? activeFilterTab.dataset.filter || "all" : "all";
        revealCounts[filter] = (revealCounts[filter] || BATCH_SIZE) + BATCH_SIZE;
        renderFilter(filter);
      });
    }
  }

  function removeUrlParam(key) {
    var params = new URLSearchParams(window.location.search);
    if (!params.has(key)) return;
    params.delete(key);
    var query = params.toString();
    var url = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }

  function setupProfileTabs() {
    var tabs = Array.from(document.querySelectorAll(".profile-tab"));
    var panels = Array.from(document.querySelectorAll(".profile-panel"));
    if (!tabs.length || !panels.length) return;

    document.documentElement.classList.add("js-ready");

    var defaultTab = tabs[0].dataset.tab;
    var defaultFilter = tabs[0].dataset.filter || "all";
    var tabNames = tabs.map(function (tab) { return tab.dataset.tab; });

    function activate(name, filter, sync) {
      tabs.forEach(function (tab) {
        var tabFilter = tab.dataset.filter || "all";
        tab.classList.toggle("is-active", tab.dataset.tab === name && (name !== "posts" || tabFilter === filter));
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.id === "panel-" + name);
      });
      if (name === "posts") renderFilter(filter);
      if (sync) {
        syncListParam("tab", name, defaultTab);
        syncListParam("filter", filter, defaultFilter);
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        activate(tab.dataset.tab, tab.dataset.filter || "all", true);
      });
    });

    var params = new URLSearchParams(window.location.search);
    var requestedTab = params.get("tab");
    var requestedFilter = params.get("filter");
    var startTab = tabNames.indexOf(requestedTab) !== -1 ? requestedTab : defaultTab;
    var startFilter = requestedFilter || defaultFilter;
    activate(startTab, startFilter, false);

    document.querySelector(".profile-tabs").classList.add("is-interactive");
  }

  function setupContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var subject = form.querySelector("#contact-form-subject").value.trim();
      var body = form.querySelector("#contact-form-message").value.trim();
      window.location.href = "mailto:" + CONTACT_EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
    });
  }

  function fetchSearchIndex() {
    return fetch("/search.json")
      .then(function (r) { return r.json(); })
      .catch(function () { return []; });
  }

  function normalizeTr(str) {
    return String(str)
      .replace(/[İIı]/g, "i")
      .replace(/[Ğğ]/g, "g")
      .replace(/[Üü]/g, "u")
      .replace(/[Şş]/g, "s")
      .replace(/[Öö]/g, "o")
      .replace(/[Çç]/g, "c")
      .toLowerCase();
  }

  function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    var count = 0;
    var pos = haystack.indexOf(needle);
    while (pos !== -1) {
      count++;
      pos = haystack.indexOf(needle, pos + needle.length);
    }
    return count;
  }

  function scorePost(post, q) {
    var title = countOccurrences(normalizeTr(post.title || ""), q);
    var description = countOccurrences(normalizeTr(post.description || ""), q);
    var keywords = countOccurrences(normalizeTr((post.keywords || []).join(" ")), q);
    var content = countOccurrences(normalizeTr(post.content || ""), q);
    return [title, description + keywords, content];
  }

  function filterPosts(posts, query) {
    if (query.charAt(0) === "#") {
      var tag = normalizeTr(query.slice(1).trim());
      if (!tag) return [];
      return posts.filter(function (post) {
        return (post.tags || []).some(function (t) { return normalizeTr(t) === tag; });
      });
    }
    var q = normalizeTr(query);
    return posts
      .map(function (post) { return { post: post, score: scorePost(post, q) }; })
      .filter(function (entry) { return entry.score[0] + entry.score[1] + entry.score[2] > 0; })
      .sort(function (a, b) {
        for (var i = 0; i < a.score.length; i++) {
          if (b.score[i] !== a.score[i]) return b.score[i] - a.score[i];
        }
        return 0;
      })
      .map(function (entry) { return entry.post; });
  }

  function indicesOf(haystack, needle) {
    var idxs = [];
    if (!needle) return idxs;
    var pos = haystack.indexOf(needle);
    while (pos !== -1) {
      idxs.push(pos);
      pos = haystack.indexOf(needle, pos + needle.length);
    }
    return idxs;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;";
    });
  }

  function markMatches(text, normalizedText, normalizedQuery) {
    var idxs = indicesOf(normalizedText, normalizedQuery);
    if (!idxs.length) return escapeHtml(text);
    var out = "";
    var cursor = 0;
    idxs.forEach(function (i) {
      out += escapeHtml(text.slice(cursor, i));
      out += "<mark>" + escapeHtml(text.slice(i, i + normalizedQuery.length)) + "</mark>";
      cursor = i + normalizedQuery.length;
    });
    out += escapeHtml(text.slice(cursor));
    return out;
  }

  function buildSnippet(content, normalizedContent, normalizedQuery) {
    var idx = normalizedContent.indexOf(normalizedQuery);
    if (idx === -1) {
      var head = content.slice(0, 160);
      return escapeHtml(head) + (content.length > 160 ? "…" : "");
    }
    var start = Math.max(0, idx - 60);
    var end = Math.min(content.length, idx + normalizedQuery.length + 140);
    var html = markMatches(content.slice(start, end), normalizedContent.slice(start, end), normalizedQuery);
    if (start > 0) html = "…" + html;
    if (end < content.length) html += "…";
    return html;
  }

  function buildResultItem(post, normalizedQuery, showDate) {
    var item = document.createElement("div");
    item.className = "post-list-item";
    var link = document.createElement("a");
    link.className = "post-list-link";
    link.href = post.url;
    var title = document.createElement("div");
    title.className = "post-list-title";
    title.innerHTML = markMatches(post.title || "", normalizeTr(post.title || ""), normalizedQuery);
    link.appendChild(title);
    if (post.type !== "quote") {
      if (showDate && post.date) {
        var date = document.createElement("div");
        date.className = "post-list-date";
        var time = document.createElement("time");
        time.setAttribute("datetime", post.date);
        time.setAttribute("data-i18n-date", post.date);
        date.appendChild(time);
        link.appendChild(date);
      } else {
        var snippet = document.createElement("div");
        snippet.className = "post-list-snippet";
        snippet.innerHTML = buildSnippet(post.content || "", normalizeTr(post.content || ""), normalizedQuery);
        link.appendChild(snippet);
      }
    }
    item.appendChild(link);
    return item;
  }

  function setupSearchOverlay() {
    var RESULT_LIMIT = 20;
    var DEFAULT_LIMIT = 3;
    var overlay = document.getElementById("search-overlay");
    var backdrop = document.getElementById("search-overlay-backdrop");
    var trigger = document.getElementById("header-search-trigger");
    var input = document.getElementById("search-overlay-input");
    var clearBtn = document.getElementById("search-overlay-clear");
    var closeBtn = document.getElementById("search-overlay-close");
    var body = document.getElementById("search-overlay-body");
    var defaultBox = document.getElementById("search-overlay-default");
    var defaultPostsSection = document.getElementById("search-overlay-default-posts-section");
    var defaultPostsBox = document.getElementById("search-overlay-default-posts");
    var defaultQuotesSection = document.getElementById("search-overlay-default-quotes-section");
    var defaultQuotesBox = document.getElementById("search-overlay-default-quotes");
    var metaBox = document.getElementById("search-overlay-meta");
    var resultsBox = document.getElementById("search-overlay-results");
    var emptyBox = document.getElementById("search-overlay-empty");
    if (!overlay || !trigger || !input) return;

    var posts = [];
    var loaded = false;
    var isOpen = false;

    function urlFor(query) {
      var params = new URLSearchParams(window.location.search);
      if (query) params.set("search", query); else params.delete("search");
      var qs = params.toString();
      return window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    }

    function loadPosts() {
      if (loaded) return;
      loaded = true;
      fetchSearchIndex().then(function (data) {
        posts = data;
        render(input.value);
      });
    }

    function renderDefault() {
      var latestPosts = posts
        .filter(function (post) { return post.type !== "quote"; })
        .slice()
        .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
        .slice(0, DEFAULT_LIMIT);
      var quotes = posts
        .filter(function (post) { return post.type === "quote"; })
        .slice(0, DEFAULT_LIMIT);

      defaultPostsBox.innerHTML = "";
      latestPosts.forEach(function (post) {
        defaultPostsBox.appendChild(buildResultItem(post, "", true));
      });
      defaultQuotesBox.innerHTML = "";
      quotes.forEach(function (post) {
        defaultQuotesBox.appendChild(buildResultItem(post, "", true));
      });

      defaultPostsSection.style.display = latestPosts.length ? "" : "none";
      defaultQuotesSection.style.display = quotes.length ? "" : "none";
      formatDates();
    }

    function render(rawQuery) {
      var query = rawQuery.trim();
      clearBtn.style.display = query ? "flex" : "none";
      if (!query) {
        metaBox.textContent = "";
        resultsBox.innerHTML = "";
        resultsBox.style.display = "none";
        emptyBox.style.display = "none";
        defaultBox.style.display = "";
        renderDefault();
        return;
      }
      defaultBox.style.display = "none";

      var normalizedQuery = normalizeTr(query);
      var matches = filterPosts(posts, query);
      var shown = matches.slice(0, RESULT_LIMIT);

      metaBox.textContent = matches.length
        ? (shown.length < matches.length
            ? t("search_results_partial", { q: query, total: matches.length, shown: shown.length })
            : t("search_results_found", { q: query, n: matches.length }))
        : "";

      resultsBox.innerHTML = "";
      shown.forEach(function (post) {
        resultsBox.appendChild(buildResultItem(post, normalizedQuery, false));
      });

      resultsBox.style.display = matches.length ? "" : "none";
      emptyBox.style.display = matches.length ? "none" : "";
    }

    function showOverlay() {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("search-overlay-locked");
      isOpen = true;
    }

    function hideOverlay() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("search-overlay-locked");
      isOpen = false;
      trigger.blur();
      removeUrlParam("search");
      setTimeout(function () {
        input.value = "";
        render("");
      }, 250);
    }

    function open(query) {
      loadPosts();
      if (typeof query === "string") input.value = query;
      showOverlay();
      input.focus();
      render(input.value);
      window.history.pushState({ searchOverlay: true }, "", urlFor(input.value));
    }

    function requestClose() {
      if (window.history.state && window.history.state.searchOverlay) {
        window.history.back();
      } else {
        hideOverlay();
      }
    }

    trigger.addEventListener("focus", function () { open(); });
    closeBtn.addEventListener("click", requestClose);
    backdrop.addEventListener("click", requestClose);

    document.addEventListener("click", function (e) {
      var link = e.target.closest('a[href*="?search="]');
      if (!link) return;
      var url = new URL(link.getAttribute("href"), window.location.href);
      if (url.pathname !== window.location.pathname) return;
      var query = url.searchParams.get("search");
      if (!query) return;
      e.preventDefault();
      open(decodeURIComponent(query));
    });

    input.addEventListener("input", function () {
      render(input.value);
      if (isOpen) window.history.replaceState({ searchOverlay: true }, "", urlFor(input.value));
    });

    clearBtn.addEventListener("click", function () {
      input.value = "";
      render("");
      input.focus();
      if (isOpen) window.history.replaceState({ searchOverlay: true }, "", urlFor(""));
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) requestClose();
    });

    window.addEventListener("popstate", function (e) {
      var wantsOpen = !!(e.state && e.state.searchOverlay);
      if (isOpen && !wantsOpen) {
        hideOverlay();
      } else if (!isOpen && wantsOpen) {
        input.value = new URLSearchParams(window.location.search).get("search") || "";
        loadPosts();
        showOverlay();
        render(input.value);
      }
    });

    var initialQuery = new URLSearchParams(window.location.search).get("search");
    if (initialQuery) {
      input.value = initialQuery;
      loadPosts();
      showOverlay();
      render(input.value);
    }

    document.addEventListener("i18n:changed", function () {
      render(input.value);
    });
  }

  var THEMES = ["system", "dark", "light"];
  var FONT_SIZES = ["small", "normal", "large"];

  function setTheme(theme) {
    localStorage.setItem("theme", theme);
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    document.querySelectorAll("#theme-menu-panel button").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.themeOption === theme);
    });
  }

  function setupThemeMenu() {
    var panel = document.getElementById("theme-menu-panel");
    if (!panel) return;
    var stored = localStorage.getItem("theme");
    var theme = THEMES.indexOf(stored) !== -1 ? stored : "system";
    panel.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(btn.dataset.themeOption);
      });
    });
    setTheme(theme);
  }

  function setFontSize(size) {
    localStorage.setItem("fontSize", size);
    document.documentElement.setAttribute("data-font-size", size);
    document.querySelectorAll("#font-size-menu-panel button").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.fontSizeOption === size);
    });
  }

  function setupFontSizeMenu() {
    var panel = document.getElementById("font-size-menu-panel");
    if (!panel) return;
    var stored = localStorage.getItem("fontSize");
    var size = FONT_SIZES.indexOf(stored) !== -1 ? stored : "normal";
    panel.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setFontSize(btn.dataset.fontSizeOption);
      });
    });
    setFontSize(size);
  }

  var closeSettingsMenu = function () {};

  function setupSettingsMenu() {
      var menu = document.getElementById("settings-menu");
      var trigger = document.getElementById("settings-menu-trigger");
      var panel = document.getElementById("settings-menu-panel");
      if (!menu || !trigger || !panel) return;

      function showAccordionRoot() {
        panel.classList.remove("has-active-section");
        panel.querySelectorAll(".settings-menu-section.is-active").forEach(function (section) {
          section.classList.remove("is-active");
        });
        panel.querySelectorAll(".settings-accordion-trigger").forEach(function (btn) {
          btn.setAttribute("aria-expanded", "false");
        });
      }

      function close() {
        menu.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        showAccordionRoot();
      }

      closeSettingsMenu = close;

      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var willOpen = !menu.classList.contains("is-open");
        menu.classList.toggle("is-open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
        if (!willOpen) showAccordionRoot();
      });

      document.addEventListener("click", function (e) {
        if (!menu.contains(e.target)) close();
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") close();
      });

      panel.querySelectorAll(".settings-accordion-trigger").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var target = document.getElementById(btn.dataset.accordionTarget);
          if (!target) return;
          panel.classList.add("has-active-section");
          target.classList.add("is-active");
          btn.setAttribute("aria-expanded", "true");
        });
      });

      panel.querySelectorAll("[data-accordion-back]").forEach(function (btn) {
        btn.addEventListener("click", showAccordionRoot);
      });
    }

  function setupRssMenu() {
    var menu = document.getElementById("rss-menu");
    var trigger = document.getElementById("rss-menu-trigger");
    if (!menu || !trigger) return;

    function close() {
      menu.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target)) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupI18n();
    setupPostsList();
    setupProfileTabs();
    setupContactForm();
    setupSearchOverlay();
    setupRssMenu();
    setupSettingsMenu();
    setupThemeMenu();
    setupFontSizeMenu();
  });
})();
