(function () {
  var CONTACT_EMAIL = "seninadresin@example.com";

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

    var targetId = new URLSearchParams(window.location.search).get("target");
    var targetIndex = targetId ? items.findIndex(function (item) { return item.id === targetId; }) : -1;
    if (targetIndex !== -1) visible = Math.max(visible, targetIndex + 1);

    function render() {
      items.forEach(function (item, i) {
        item.style.display = i < visible ? "" : "none";
      });
      button.style.display = visible < items.length ? "flex" : "none";
    }

    render();
    syncListParam(paramKey, visible, initial);

    if (targetIndex !== -1) {
      var target = items[targetIndex];
      target.classList.add("is-target");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { target.classList.remove("is-target"); }, 2000);
    }

    button.addEventListener("click", function () {
      visible = Math.min(visible + perPage, items.length);
      render();
      syncListParam(paramKey, visible, initial);
    });
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
        activate(tab.dataset.tab, true);
      });
    });

    var requested = new URLSearchParams(window.location.search).get("tab");
    var startTab = tabNames.indexOf(requested) !== -1 ? requested : defaultTab;
    activate(startTab, false);
  }

  function setupContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector("#contact-form-name").value.trim();
      var email = form.querySelector("#contact-form-email").value.trim();
      var message = form.querySelector("#contact-form-message").value.trim();
      var subject = "Website mesajı - " + name;
      var body = message + "\n\nGönderen: " + name + " (" + email + ")";
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

  function filterPosts(posts, query) {
    var q = query.toLowerCase();
    return posts.filter(function (post) {
      var haystack = [post.title, post.description, post.content, (post.keywords || []).join(" ")]
        .join(" ").toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
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
    setupLoadMore("quotes-list", "quotes-load-more", "p", 3, "quote");
    setupContactForm();
    setupArchiveFilter();
    setupSearch();
    setupHeaderSearch();
  });
})();
