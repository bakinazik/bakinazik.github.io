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
    featured.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function setupArchiveFilter() {
    var list = document.getElementById("archive-list");
    var emptyBox = document.getElementById("archive-no-result");
    if (!list || !emptyBox) return;
    var tag = new URLSearchParams(window.location.search).get("tag");
    if (!tag) return;
    var items = Array.from(list.querySelectorAll(".post-list-item"));
    var visibleCount = 0;
    items.forEach(function (item) {
      var tags = (item.getAttribute("data-tags") || "").split(",");
      var matches = tags.indexOf(tag) !== -1;
      item.style.display = matches ? "" : "none";
      if (matches) visibleCount++;
    });
    emptyBox.style.display = visibleCount === 0 ? "" : "none";
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

  function renderResults(resultsBox, emptyBox, matches) {
    resultsBox.innerHTML = "";
    matches.forEach(function (post) {
      var item = document.createElement("div");
      item.className = "post-list-item";
      var link = document.createElement("a");
      link.className = "post-list-link";
      link.href = post.url;
      var title = document.createElement("div");
      title.className = "post-list-title";
      var titleText = post.title;
      if (post.type === "quote" && titleText.length > 90) {
        titleText = titleText.slice(0, 90).trim() + "…";
      }
      title.textContent = titleText;
      var dateWrap = document.createElement("div");
      dateWrap.className = "post-list-date";
      var time = document.createElement("time");
      time.textContent = post.date;
      dateWrap.appendChild(time);
      link.appendChild(title);
      link.appendChild(dateWrap);
      item.appendChild(link);
      resultsBox.appendChild(item);
    });
    resultsBox.style.display = matches.length ? "" : "none";
    emptyBox.style.display = matches.length ? "none" : "";
  }

  function setupSearch() {
    var input = document.getElementById("search-input");
    if (!input) return;
    var resultsBox = document.getElementById("search-results");
    var emptyBox = document.getElementById("search-empty");
    var posts = [];

    fetchSearchIndex().then(function (data) { posts = data; });

    input.addEventListener("input", function () {
      var query = input.value.trim();
      if (!query) {
        resultsBox.style.display = "none";
        emptyBox.style.display = "none";
        resultsBox.innerHTML = "";
        return;
      }
      renderResults(resultsBox, emptyBox, filterPosts(posts, query));
    });
  }

  function setupHeaderSearch() {
    var wrap = document.getElementById("header-search");
    var input = document.getElementById("header-search-input");
    var dropdown = document.getElementById("header-search-dropdown");
    var resultsBox = document.getElementById("header-search-results");
    var emptyBox = document.getElementById("header-search-empty");
    if (!wrap || !input || !dropdown) return;
    var posts = [];

    fetchSearchIndex().then(function (data) { posts = data; });

    function renderQuery(query) {
      if (!query) {
        dropdown.style.display = "none";
        resultsBox.innerHTML = "";
        return;
      }
      renderResults(resultsBox, emptyBox, filterPosts(posts, query));
      dropdown.style.display = "flex";
    }

    input.addEventListener("input", function () {
      renderQuery(input.value.trim());
    });

    input.addEventListener("focus", function () {
      renderQuery(input.value.trim());
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) dropdown.style.display = "none";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupProfileTabs();
    setupLoadMore("posts-list", "posts-load-more", ".post-list-item", 3, "post");
    setupQuoteTarget();
    setupContactForm();
    setupArchiveFilter();
    setupSearch();
    setupHeaderSearch();
  });
})();
