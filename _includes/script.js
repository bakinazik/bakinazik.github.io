(function () {
  var CONTACT_EMAIL = "bakinazikk@gmail.com";

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

  function setupLoadMore(containerId, buttonId, itemSelector, perPage, paramKey) {
    var container = document.getElementById(containerId);
    var button = document.getElementById(buttonId);
    if (!container || !button) return;
    var items = Array.from(container.querySelectorAll(itemSelector));
    if (!items.length) return;

    document.documentElement.classList.add("js-ready");
    container.removeAttribute("tabindex");

    var initial = Math.min(perPage, items.length);
    var visible = Math.min(Math.max(readListParam(paramKey, initial), initial), items.length);

    function render() {
      items.forEach(function (item, i) {
        item.style.display = i < visible ? "" : "none";
      });
      button.style.display = visible < items.length ? "flex" : "none";
    }

    render();
    syncListParam(paramKey, visible, initial);

    button.addEventListener("click", function () {
      visible = Math.min(visible + perPage, items.length);
      render();
      syncListParam(paramKey, visible, initial);
    });
  }

  function removeUrlParam(key) {
    var params = new URLSearchParams(window.location.search);
    if (!params.has(key)) return;
    params.delete(key);
    var query = params.toString();
    var url = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }

  var quoteTargetEl = null;
  var quoteTargetNextSibling = null;

  function clearQuoteTarget() {
    removeUrlParam("target");
    var featured = document.getElementById("quote-featured");
    if (quoteTargetEl) {
      var quotesList = document.getElementById("quotes-list");
      if (quotesList) {
        if (quoteTargetNextSibling && quoteTargetNextSibling.parentNode === quotesList) {
          quotesList.insertBefore(quoteTargetEl, quoteTargetNextSibling);
        } else {
          quotesList.appendChild(quoteTargetEl);
        }
      }
      quoteTargetEl = null;
      quoteTargetNextSibling = null;
    }
    if (featured) {
      featured.innerHTML = "";
      featured.style.display = "none";
    }
  }

  function setupProfileTabs() {
    var tabs = Array.from(document.querySelectorAll(".profile-tab"));
    var panels = Array.from(document.querySelectorAll(".profile-panel"));
    if (!tabs.length || !panels.length) return;

    document.documentElement.classList.add("js-ready");

    var defaultTab = tabs[0].dataset.tab;
    var tabNames = tabs.map(function (tab) { return tab.dataset.tab; });

    function activate(name, sync) {
      tabs.forEach(function (tab) {
        tab.classList.toggle("is-active", tab.dataset.tab === name);
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.id === "panel-" + name);
      });
      if (sync) syncListParam("tab", name, defaultTab);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        clearQuoteTarget();
        activate(tab.dataset.tab, true);
      });
    });

    var requested = new URLSearchParams(window.location.search).get("tab");
    var startTab = tabNames.indexOf(requested) !== -1 ? requested : defaultTab;
    activate(startTab, false);

    document.querySelector(".profile-tabs").classList.add("is-interactive");
  }

  function setupQuoteTarget() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "quotes") return;
    var targetId = params.get("target");
    if (!targetId) return;
    var source = document.getElementById(targetId);
    var featured = document.getElementById("quote-featured");
    if (!source || !featured) return;

    quoteTargetEl = source;
    quoteTargetNextSibling = source.nextSibling;
    featured.appendChild(source);
    featured.style.display = "block";
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

  function setupSearchOverlay() {
    var RESULT_LIMIT = 20;
    var overlay = document.getElementById("search-overlay");
    var backdrop = document.getElementById("search-overlay-backdrop");
    var trigger = document.getElementById("header-search-trigger");
    var input = document.getElementById("search-overlay-input");
    var clearBtn = document.getElementById("search-overlay-clear");
    var closeBtn = document.getElementById("search-overlay-close");
    var body = document.getElementById("search-overlay-body");
    var placeholder = document.getElementById("search-overlay-placeholder");
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

    function render(rawQuery) {
      var query = rawQuery.trim();
      clearBtn.style.display = query ? "flex" : "none";
      placeholder.style.display = query ? "none" : "flex";
      if (!query) {
        metaBox.textContent = "";
        resultsBox.innerHTML = "";
        resultsBox.style.display = "none";
        emptyBox.style.display = "none";
        return;
      }

      var normalizedQuery = normalizeTr(query);
      var matches = filterPosts(posts, query);
      var shown = matches.slice(0, RESULT_LIMIT);

      metaBox.textContent = matches.length
        ? ("\u201C" + query + "\u201D için " + matches.length + " sonuç" +
            (shown.length < matches.length ? "tan " + shown.length + " tanesi gösteriliyor" : " bulundu"))
        : "";

      resultsBox.innerHTML = "";
      shown.forEach(function (post) {
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
          var snippet = document.createElement("div");
          snippet.className = "post-list-snippet";
          snippet.innerHTML = buildSnippet(post.content || "", normalizeTr(post.content || ""), normalizedQuery);
          link.appendChild(snippet);
        }
        item.appendChild(link);
        resultsBox.appendChild(item);
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
      input.value = "";
      render("");
    }

    function open() {
      loadPosts();
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

    trigger.addEventListener("focus", open);
    closeBtn.addEventListener("click", requestClose);
    backdrop.addEventListener("click", requestClose);

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
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupProfileTabs();
    setupLoadMore("posts-list", "posts-load-more", ".post-list-item", 3, "post");
    setupQuoteTarget();
    setupContactForm();
    setupSearchOverlay();
  });
})();
