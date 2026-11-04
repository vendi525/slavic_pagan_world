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
