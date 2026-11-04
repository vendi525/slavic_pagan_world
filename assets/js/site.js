(function () {
  var GA_ID = "G-1KZQ908ZL0";
  var KEY = "cookiesAccepted";

  function getChoice() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function setChoice(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }

  function loadAnalytics() {
    window["ga-disable-" + GA_ID] = false;
    if (window.GA4Loaded) return;
    window.GA4Loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var script = document.createElement("script");
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    script.async = true;
    document.head.appendChild(script);
  }

  function stopAnalytics() {
    window["ga-disable-" + GA_ID] = true;
    var parts = location.hostname.split(".");
    var domain = "." + parts.slice(-2).join(".");
    document.cookie.split(";").forEach(function (cookie) {
      var name = cookie.split("=")[0].trim();
      if (name.indexOf("_ga") !== 0) return;
      var expired = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      document.cookie = expired;
      document.cookie = expired + "; domain=" + domain;
    });
  }

  var banner = document.getElementById("cookie-banner");
  var choice = getChoice();

  if (choice === "yes") loadAnalytics();
  if (choice !== "yes" && choice !== "no") banner.hidden = false;

  document.getElementById("accept-cookies").addEventListener("click", function () {
    setChoice("yes");
    loadAnalytics();
    banner.hidden = true;
  });

  document.getElementById("reject-cookies").addEventListener("click", function () {
    setChoice("no");
    stopAnalytics();
    banner.hidden = true;
  });

  document.querySelectorAll("[data-cookie-settings]").forEach(function (button) {
    button.addEventListener("click", function () { banner.hidden = false; });
  });

  document.querySelectorAll(".product-gallery").forEach(function (gallery) {
    var main = gallery.querySelector(".gallery-main");
    gallery.querySelectorAll(".gallery-thumbs a").forEach(function (thumb) {
      thumb.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        main.src = thumb.href;
        main.alt = thumb.querySelector("img").alt;
        gallery.querySelectorAll(".gallery-thumbs a").forEach(function (other) {
          other.removeAttribute("aria-current");
        });
        thumb.setAttribute("aria-current", "true");
      });
    });
  });

  document.querySelectorAll("[data-newsletter]").forEach(function (form) {
    var status = form.querySelector(".newsletter-status");
    var button = form.querySelector("button");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var endpoint = form.getAttribute("action");

      if (form.elements.website.value) {
        status.textContent = "Thank you, you're signed up. If you don't see the email, check your spam folder and mark it as not spam.";
        form.reset();
        return;
      }
      if (!endpoint) {
        status.textContent = "Signup isn't connected yet.";
        return;
      }

      button.disabled = true;
      status.textContent = "Sending...";
      fetch(endpoint, { method: "POST", body: new URLSearchParams(new FormData(form)) })
        .then(function (response) { return response.json(); })
        .then(function (result) {
          if (!result.ok) throw new Error("rejected");
          status.textContent = "Thank you, you're signed up. If you don't see the email, check your spam folder and mark it as not spam.";
          form.reset();
        })
        .catch(function () {
          status.textContent = "Something went wrong. Please try again.";
        })
        .finally(function () { button.disabled = false; });
    });
  });

  var unsubscribe = document.querySelector("[data-unsubscribe]");
  if (unsubscribe) {
    var code = new URLSearchParams(location.search).get("u");
    var unsubscribeButton = unsubscribe.querySelector("button");
    var unsubscribeStatus = unsubscribe.querySelector("[role=status]");
    if (!code) {
      unsubscribeButton.hidden = true;
      unsubscribeStatus.textContent = "This link isn't valid.";
    }
    unsubscribeButton.addEventListener("click", function () {
      unsubscribeButton.disabled = true;
      fetch(unsubscribe.dataset.unsubscribe, {
        method: "POST",
        body: new URLSearchParams({ action: "unsubscribe", u: code })
      })
        .then(function (response) { return response.json(); })
        .then(function (result) {
          if (!result.ok) throw new Error("rejected");
          unsubscribeButton.hidden = true;
          unsubscribeStatus.textContent = "You are unsubscribed, and your details have been deleted.";
        })
        .catch(function () {
          unsubscribeButton.disabled = false;
          unsubscribeStatus.textContent = "Something went wrong. Please try again.";
        });
    });
  }

  document.querySelectorAll(".video").forEach(function (video) {
    video.querySelector(".video-play").addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.dataset.youtubeId) + "?autoplay=1";
      frame.title = video.dataset.title;
      frame.allow = "autoplay; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      video.replaceChildren(frame);
      video.classList.add("video-playing");
    });
  });
})();
