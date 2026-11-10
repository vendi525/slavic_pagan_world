// Slavic Pagan World newsletter, run from a Google Sheet.
// Saves signups, sends the welcome and monthly emails, and handles unsubscribes.
// The monthly email is drafted by a scheduled Claude routine, which calls doPost.
//
// Setup: paste into Extensions > Apps Script in the sheet, then
// Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
// After changing this code, use Deploy > Manage deployments > Edit > New version.
//
// Emails containing "[IZA:" never go to subscribers. sendTestEmails() always
// goes only to you, so you can check it first.

var FROM_NAME = "Slavic Pagan World";
var TIME_ZONE = "Europe/Ljubljana";
var SEND_DAY = 20; // the monthly email goes out on this day, covering next month

// Fill these in only in the Apps Script copy. The repo is public, so keep them
// empty there. If you paste this file in again, add them back.
var REVIEW_EMAIL = "";   // where monthly drafts go for review
var ROUTINE_SECRET = ""; // shared with the Claude routine; empty turns it off

// The page in every email's unsubscribe link. It's on your own site because
// Google's web app page fails for anyone signed in to several Google accounts.
var UNSUBSCRIBE_PAGE = "https://slavicpaganworld.com/unsubscribe/";

// Must match the wording on the website form.
var CONSENT_WORDING = "Send me the upcoming Slavic holidays once a month and a short old story once a week. I can unsubscribe anytime using the link in any email.";

// ---- Edit these ------------------------------------------------------------

var VIDEO_LINK = "https://www.youtube.com/watch?v=Mqx5K0wY0Gw"; // only used if YouTube can't be reached
var BUSINESS_DETAILS = "Iza Vene s.p. · slavicfairyofficial@gmail.com";

// Every email ends with the newest article and the newest video, looked up
// when the email goes out, so they stay current by themselves.
var SITE_FEED = "https://slavicpaganworld.com/feed.xml";
var YOUTUBE_FEED = "https://www.youtube.com/feeds/videos.xml?playlist_id=UULFFQIPSgAB4ixVkAamAupKyQ"; // long videos only, no Shorts

var WELCOME_SUBJECT = "welcome to the old Slavic year 🍂";

// The last links found are kept here, in case a feed can't be reached later.
function setting_(name, fallback) {
  return PropertiesService.getScriptProperties().getProperty(name) || fallback;
}

function fetchXml_(url) {
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (response.getResponseCode() !== 200) throw new Error(url + " returned " + response.getResponseCode());
  return XmlService.parse(response.getContentText()).getRootElement();
}

// Newest entry in an Atom feed, as { title, link, image }.
function newestEntry_(url, readImage) {
  var root = fetchXml_(url), atom = root.getNamespace();
  var entries = root.getChildren("entry", atom);
  if (!entries.length) return null;
  entries.sort(function (a, b) { return a.getChildText("published", atom) < b.getChildText("published", atom) ? 1 : -1; });
  var entry = entries[0], link = entry.getChildren("link", atom).filter(function (l) {
    return !l.getAttribute("rel") || l.getAttribute("rel").getValue() === "alternate";
  })[0];
  return { title: entry.getChildText("title", atom).trim(), link: link ? link.getAttribute("href").getValue() : "", image: readImage(entry) };
}

function latestArticle_() {
  try {
    var article = newestEntry_(SITE_FEED, function (entry) {
      var thumb = entry.getChild("thumbnail", XmlService.getNamespace("media", "http://search.yahoo.com/mrss/"));
      return thumb ? thumb.getAttribute("url").getValue() : "";
    });
    if (article && article.link) {
      PropertiesService.getScriptProperties().setProperty("LATEST_ARTICLE", JSON.stringify(article));
      return article;
    }
  } catch (error) { console.log("Site feed: " + error); }
  var saved = setting_("LATEST_ARTICLE", "");
  return saved ? JSON.parse(saved) : null;
}

function latestVideo_() {
  try {
    var video = newestEntry_(YOUTUBE_FEED, function (entry) {
      var id = entry.getChildText("videoId", XmlService.getNamespace("yt", "http://www.youtube.com/xml/schemas/2015"));
      var big = "https://i.ytimg.com/vi/" + id + "/maxresdefault.jpg";
      return UrlFetchApp.fetch(big, { muteHttpExceptions: true }).getResponseCode() === 200 ? big : "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
    });
    if (video && video.link) {
      PropertiesService.getScriptProperties().setProperty("LATEST_VIDEO", JSON.stringify(video));
      return video;
    }
  } catch (error) { console.log("YouTube feed: " + error); }
  var saved = setting_("LATEST_VIDEO", "");
  return saved ? JSON.parse(saved) : { title: "My newest video", link: VIDEO_LINK, image: "" };
}

// The ending of every email: a line, the newest article, a line, the newest video.
// Looked up at most once an hour.
function latestText_() {
  var cache = CacheService.getScriptCache(), cached = cache.get("LATEST_TEXT");
  if (cached) return cached;
  var parts = [], article = latestArticle_(), video = latestVideo_();
  if (article) {
    parts.push("---", "**New on the wiki**");
    if (article.image) parts.push("[[picture|" + article.image + "|" + article.link + "]]");
    parts.push("[" + linkText_(article.title) + "](" + article.link + ")");
  }
  if (video) {
    parts.push("---", "**My latest YouTube video**");
    if (video.image) parts.push("[[picture|" + video.image + "|" + video.link + "]]");
    parts.push("[" + linkText_(video.title) + "](" + video.link + ")");
  }
  var text = parts.join("\n\n");
  cache.put("LATEST_TEXT", text, 3600);
  return text;
}

function linkText_(title) {
  return String(title).replace(/[\[\]]/g, "");
}

// Adds the ending to an email's text.
function withLatest_(body) {
  var latest = latestText_();
  return latest ? String(body).replace(/\s+$/, "") + "\n\n" + latest : String(body);
}

function welcomeText_() {
  var parts = [
    "Hi lovely soul, and welcome.",
    "I'm Iza. I make slow videos about Slavic folklore, seasonal rituals and small handmade things, and I design the Slavic Pagan Calendar.",
    "Once a month I'll send you the Slavic pagan holidays coming up, and once a week an ancient anecdote for you to contemplate.",
    "Stay well,\nIza"
  ];
  return withLatest_(parts.join("\n\n"));
}

// ---- Sheet columns ---------------------------------------------------------

var HEADERS = ["Signed up", "Email", "Agreed to", "Unsubscribe code", "Welcome sent", "Last monthly sent", "Last story sent"];
var COL_EMAIL = 1, COL_CODE = 3, COL_WELCOME = 4, COL_MONTHLY = 5, COL_STORY = 6; // positions in a row, from 0

function sheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function hasPlaceholder_(text) {
  return String(text).indexOf("[IZA:") !== -1;
}

function welcomeReady_() {
  return !hasPlaceholder_(WELCOME_SUBJECT + welcomeText_() + BUSINESS_DETAILS);
}

function isValidEmail_(email) {
  return email.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) && /^[A-Za-z0-9]/.test(email);
}

function unsubscribeLink_(code) {
  return UNSUBSCRIBE_PAGE + "?u=" + encodeURIComponent(code);
}

function sendEmail_(to, subject, text, code) {
  var link = unsubscribeLink_(code);
  MailApp.sendEmail({
    to: to,
    subject: subject,
    name: FROM_NAME,
    body: plainText_(text) + "\n\n--\n" + BUSINESS_DETAILS + "\nUnsubscribe: " + link,
    htmlBody: wrapHtml_(renderHtml_(text) +
      '<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #d8c9b4;font-size:13px;color:#6d5848">' +
      escapeHtml_(BUSINESS_DETAILS) + '<br><a href="' + escapeHtml_(link) + '" style="color:#6d5848">Unsubscribe</a></p>')
  });
}

// Emails are written in a small format:
//   # Heading        **bold**        [[Button text|https://link]]        [link text](https://link)
//   ---  a separator line        [[picture|https://image|https://link]]  a picture that links
//   Lines starting with a number are the holiday list.
function escapeHtml_(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml_(line) {
  // [text](https://link) becomes a text link; bare links are linked as they are.
  var links = [];
  var html = escapeHtml_(line).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, function (match, text, url) {
    links.push('<a href="' + url + '" style="color:#7a3b27">' + text + '</a>');
    return "\u0000" + (links.length - 1) + "\u0000";
  });
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s<\u0000]+)/g, '<a href="$1" style="color:#7a3b27">$1</a>');
  return html.replace(/\u0000(\d+)\u0000/g, function (match, i) { return links[Number(i)]; });
}

function renderLine_(line) {
  if (/^-{3,}$/.test(line)) return '<hr style="margin:32px 0;border:0;border-top:1px solid #d8c9b4">';
  var picture = line.match(/^\[\[picture\|(https?:\/\/[^|\s]+)\|(https?:\/\/[^\]\s]+)\]\]$/);
  if (picture) {
    return '<p style="margin:0 0 8px"><a href="' + escapeHtml_(picture[2]) + '"><img src="' + escapeHtml_(picture[1]) + '" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:8px"></a></p>';
  }
  var button = line.match(/^\[\[(.+?)\|(.+)\]\]$/);
  if (button && /^https?:\/\//.test(button[2])) {
    return '<p style="margin:24px 0"><a href="' + escapeHtml_(button[2]) + '" style="display:inline-block;padding:12px 24px;background:#ebcb8b;color:#3a2a1e;border-radius:8px;text-decoration:none;font-weight:bold">' + escapeHtml_(button[1]) + '</a></p>';
  }
  if (button) return '<p style="margin:24px 0">' + escapeHtml_(button[1]) + ": " + escapeHtml_(button[2]) + '</p>';
  if (line.indexOf("# ") === 0) {
    return '<h1 style="margin:24px 0 16px;font-size:36px;line-height:1.2;font-weight:normal;color:#523e2d">' + escapeHtml_(line.slice(2)) + '</h1>';
  }
  if (/^\*{0,2}\d/.test(line)) return '<p style="margin:0 0 8px">' + inlineHtml_(line) + '</p>';
  return '<p style="margin:0 0 16px">' + inlineHtml_(line) + '</p>';
}

function renderHtml_(text) {
  return String(text).split("\n").filter(function (line) { return line.trim(); }).map(function (line) { return renderLine_(line.trim()); }).join("");
}

function wrapHtml_(inner) {
  return '<div style="max-width:520px;margin:0 auto;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#3a2a1e">' + inner + '</div>';
}

function plainText_(text) {
  return String(text).replace(/^\[\[picture\|.*\]\]\n*/gm, "").replace(/^-{3,}$/gm, "* * *").replace(/^# /gm, "").replace(/\*\*/g, "").replace(/\[\[(.+?)\|(.+)\]\]/g, "$1: $2")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1: $2");
}

// Only you can run the sending functions, not visitors to the unsubscribe page.
function assertOwner_() {
  if (Session.getActiveUser().getEmail() !== Session.getEffectiveUser().getEmail()) {
    throw new Error("Not allowed");
  }
}

function respond_(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Signup from the website -----------------------------------------------

function doPost(e) {
  var params = (e && e.parameter) || {};

  // Bots fill in the hidden "website" field. Pretend it worked and save nothing.
  if (params.website) return respond_({ ok: true });

  if (params.routine) return respond_(routineAction_(params));

  if (params.action === "unsubscribe") {
    unsubscribe(String(params.u || ""));
    return respond_({ ok: true });
  }

  var email = String(params.email || "").trim().toLowerCase();
  if (!isValidEmail_(email) || params.consent !== "yes") return respond_({ ok: false });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = sheet_();
    var rows = sheet.getDataRange().getValues();
    var alreadySignedUp = rows.some(function (row) { return row[COL_EMAIL] === email; });
    if (!alreadySignedUp) {
      var code = Utilities.getUuid();
      sheet.appendRow([new Date(), email, CONSENT_WORDING, code, "", ""]);
      if (welcomeReady_()) {
        try {
          sendEmail_(email, WELCOME_SUBJECT, welcomeText_(), code);
          sheet.getRange(rows.length + 1, COL_WELCOME + 1).setValue(new Date());
        } catch (error) {
          // The signup is saved. sendMissingWelcomes() can catch up later.
          // This shows up under Executions in the Apps Script editor.
          console.error("Welcome email failed: " + error);
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
  return respond_({ ok: true });
}

// ---- Unsubscribe -----------------------------------------------------------

// Only for emails sent before unsubscribing moved to the website. It opens a page
// with a button, because email security tools open links automatically and would
// otherwise unsubscribe people by accident. The website page works the same way.
function doGet(e) {
  var code = String((e && e.parameter && e.parameter.u) || "");
  if (!/^[A-Za-z0-9-]{1,64}$/.test(code)) {
    return HtmlService.createHtmlOutput("<p>This link isn't valid.</p>");
  }
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<div style="font-family:Georgia,serif;max-width:28rem;margin:3rem auto;padding:0 1rem;text-align:center">' +
    '<h1 style="font-size:1.4rem">Unsubscribe from ' + FROM_NAME + '?</h1>' +
    '<p id="message"><button id="go" style="font:inherit;padding:.75rem 1.5rem;cursor:pointer">Yes, unsubscribe me</button></p>' +
    '</div><script>' +
    'document.getElementById("go").onclick=function(){' +
    'this.disabled=true;' +
    'var m=document.getElementById("message");' +
    'google.script.run' +
    '.withSuccessHandler(function(){m.textContent="You are unsubscribed. Your email address has been deleted.";})' +
    '.withFailureHandler(function(){m.textContent="Something went wrong. Please reply to any email and it will be handled by hand.";})' +
    '.unsubscribe("' + code + '");};' +
    '</script>'
  ).setTitle("Unsubscribe").addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function unsubscribe(code) {
  if (!code) return false;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = sheet_();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][COL_CODE] === code) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

// ---- Run these yourself from the Apps Script editor ------------------------

// Sends the welcome email to you only. Its unsubscribe link removes nobody.
function sendTestEmails() {
  assertOwner_();
  var me = Session.getEffectiveUser().getEmail();
  sendEmail_(me, "TEST: " + WELCOME_SUBJECT, welcomeText_(), "test");
}

// Sends the welcome email to anyone who signed up while it had placeholders.
function sendMissingWelcomes() {
  assertOwner_();
  if (!welcomeReady_()) throw new Error("The welcome email still has [IZA: placeholders.");
  var sheet = sheet_();
  var rows = sheet.getDataRange().getValues();
  var sent = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][COL_WELCOME] || MailApp.getRemainingDailyQuota() < 1) continue;
    sendEmail_(rows[i][COL_EMAIL], WELCOME_SUBJECT, welcomeText_(), rows[i][COL_CODE]);
    sheet.getRange(i + 1, COL_WELCOME + 1).setValue(new Date());
    sent++;
  }
  Logger.log("Welcome emails sent: " + sent);
}

// Run this once to start the daily check that sends confirmed emails.
function setupMonthlySend() {
  assertOwner_();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "sendScheduledMonthly") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("sendScheduledMonthly").timeBased().everyDays(1).atHour(9).inTimezone(TIME_ZONE).create();
}

// ---- Monthly email ----------------------------------------------------------
// The "Monthly emails" tab shows every month's draft, its status and what was sent.
// Each month's email goes out on SEND_DAY of the month before, once confirmed.

var MONTHLY_TAB = "Monthly emails";
var MONTHLY_HEADERS = ["Month", "Status", "Version", "Subject", "Body", "Last reply id", "Updated", "Confirmed", "Sent", "Recipients"];
var M_ID = 0, M_STATUS = 1, M_VERSION = 2, M_SUBJECT = 3, M_BODY = 4, M_REPLY = 5, M_UPDATED = 6, M_CONFIRMED = 7, M_SENT = 8, M_RECIPIENTS = 9;

function monthlySheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(MONTHLY_TAB);
  if (!sheet) {
    sheet = book.insertSheet(MONTHLY_TAB);
    sheet.appendRow(MONTHLY_HEADERS);
  }
  return sheet;
}

// Returns the row for a month as { number: sheet row, values: [...] }, or null.
function findMonth_(sheet, month) {
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][M_ID]) === month) return { number: i + 1, values: rows[i] };
  }
  return null;
}

// Next month as "yyyy-MM", plus today's day of the month.
function targetMonth_() {
  var now = new Date();
  var year = Number(Utilities.formatDate(now, TIME_ZONE, "yyyy"));
  var month = Number(Utilities.formatDate(now, TIME_ZONE, "M"));
  var next = month === 12 ? (year + 1) + "-01" : year + "-" + ("0" + (month + 1)).slice(-2);
  return { id: next, day: Number(Utilities.formatDate(now, TIME_ZONE, "d")) };
}

function emailIza_(subject, text, html) {
  var mail = { to: REVIEW_EMAIL || Session.getEffectiveUser().getEmail(), subject: subject, name: FROM_NAME, body: text };
  if (html) mail.htmlBody = html;
  MailApp.sendEmail(mail);
}

function missingNote_(body) {
  var missing = [];
  if (hasPlaceholder_(body)) missing.push("the [IZA: ...] parts in this email");
  if (hasPlaceholder_(BUSINESS_DETAILS)) missing.push("your business details in the script");
  return missing.length ? "\n\nStill needed before this can send: " + missing.join(" and ") + "." : "";
}

function sendReview_(month, version, subject, body, note) {
  var story = storyForWeek_(sendDayFor_(month));
  note = (note ? note + " " : "") + (story
    ? "This week's story, from the Stories tab: " + story.values[S_TITLE] + "."
    : "No story is marked ready for the week of the " + SEND_DAY + "th, so this one goes without a story.");
  body = withLatest_(monthlyText_(month, body, story));
  var isTest = month.indexOf("TEST") === 0;
  var intro = (isTest ? "This is a TEST and can never reach subscribers.\n\n" : "") +
    "Reply with what you want changed, or reply with just the word confirmed." +
    (isTest ? "" : " Once confirmed it goes out on the " + SEND_DAY + "th.") +
    (note ? "\n\nNote: " + note : "") + missingNote_(body);
  emailIza_("Newsletter review " + month + " (version " + version + ")",
    intro + "\n\nSubject: " + subject + "\n\n-----\n" + plainText_(body) + "\n-----",
    wrapHtml_('<div style="padding:16px;background:#f3ebdd;border-radius:8px;font-size:14px">' +
      intro.split("\n\n").map(function (part) { return '<p style="margin:0 0 8px">' + escapeHtml_(part) + '</p>'; }).join("") +
      '<p style="margin:0"><strong>Subject:</strong> ' + escapeHtml_(subject) + '</p></div>' + renderHtml_(body)));
}

// Called by the Claude routine. Nothing here can send to subscribers directly.
function routineAction_(params) {
  if (!ROUTINE_SECRET || params.secret !== ROUTINE_SECRET) return { ok: false, error: "not allowed" };
  var month = String(params.month || "");
  if (!/^(TEST-)?\d{4}-\d{2}$/.test(month)) return { ok: false, error: "bad month" };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = monthlySheet_();
    var row = findMonth_(sheet, month);

    if (params.routine === "status") {
      return {
        ok: true, found: !!row, status: row ? row.values[M_STATUS] : "",
        version: row ? row.values[M_VERSION] : 0, subject: row ? row.values[M_SUBJECT] : "",
        body: row ? row.values[M_BODY] : "", lastReplyId: row ? String(row.values[M_REPLY]) : ""
      };
    }
    if (row && row.values[M_STATUS] === "sent") return { ok: false, error: "already sent" };

    if (params.routine === "noteReply") {
      if (!row) return { ok: false, error: "no draft" };
      sheet.getRange(row.number, M_REPLY + 1).setValue(String(params.replyId || ""));
      return { ok: true };
    }

    if (params.routine === "saveDraft") {
      var subject = String(params.subject || ""), body = String(params.body || "");
      if (!subject || !body) return { ok: false, error: "missing text" };
      var version = row ? Number(row.values[M_VERSION]) + 1 : 1;
      var values = [month, "draft", version, subject, body, String(params.replyId || ""), new Date(), "", "", ""];
      if (row) values.forEach(function (value, column) { sheet.getRange(row.number, column + 1).setValue(value); });
      else sheet.appendRow(values);
      sendReview_(month, version, subject, body, String(params.note || ""));
      return { ok: true, version: version };
    }

    if (params.routine === "confirm") {
      if (!row) return { ok: false, error: "no draft" };
      sheet.getRange(row.number, M_REPLY + 1).setValue(String(params.replyId || ""));
      if (hasPlaceholder_(row.values[M_SUBJECT] + row.values[M_BODY])) {
        emailIza_("Newsletter " + month + " not confirmed yet", "This email still has [IZA: ...] parts, so it can't be confirmed. Reply with the missing details and I'll make a new version.");
        return { ok: false, error: "placeholders" };
      }
      sheet.getRange(row.number, M_STATUS + 1).setValue("confirmed");
      sheet.getRange(row.number, M_CONFIRMED + 1).setValue(new Date());
      emailIza_("Newsletter " + month + " confirmed",
        (month.indexOf("TEST") === 0 ? "Test confirmed. Nothing will be sent." : "Locked in. It goes out on the " + SEND_DAY + "th. Reply with a change before then if you want to reopen it.") + missingNote_(row.values[M_BODY]));
      return { ok: true };
    }
    return { ok: false, error: "unknown action" };
  } finally {
    lock.releaseLock();
  }
}

function remindOnce_(key, subject, text) {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(key)) return;
  properties.setProperty(key, "yes");
  emailIza_(subject, text);
}

// Runs by itself every morning at about 9:00 (the trigger keeps this old name).
// Sends the monthly email from SEND_DAY onwards, then the weekly story, then story previews.
function sendScheduledMonthly() {
  [sendMonthly_, sendScheduledStory_, previewUpcomingStories_].forEach(function (step) {
    try { step(); } catch (error) { emailIza_("Newsletter problem", "Something went wrong this morning in " + step.name + ": " + error); }
  });
}

function sendMonthly_() {
  var target = targetMonth_();
  if (target.day < SEND_DAY) return;
  var month = target.id;
  var monthly = monthlySheet_();
  var row = findMonth_(monthly, month);

  if (!row) {
    remindOnce_("REMINDED_MISSING_" + month, "Newsletter " + month + " has no draft", "It's the " + SEND_DAY + "th and there's no draft for " + month + ", so nothing went out. The Claude routine may have failed.");
    return;
  }
  var status = row.values[M_STATUS];
  if (status === "sent") return;
  if (status !== "confirmed") {
    remindOnce_("REMINDED_UNCONFIRMED_" + month, "Newsletter " + month + " is waiting for you", "It's the " + SEND_DAY + "th and you haven't confirmed this email, so nothing went out. Reply to the review email with the word confirmed, or tell me what to change.");
    return;
  }
  var subject = row.values[M_SUBJECT], body = row.values[M_BODY];
  if (hasPlaceholder_(subject + body + BUSINESS_DETAILS)) {
    remindOnce_("REMINDED_BLOCKED_" + month, "Newsletter " + month + " can't send yet", "It's confirmed but something is still missing, so nothing went out." + missingNote_(body) + " It sends the morning after that's fixed.");
    return;
  }

  var story = storyForWeek_(dayString_(new Date()), true);
  if (story) storiesSheet_().getRange(story.number, S_STATUS + 1).setValue(WITH_MONTHLY);
  body = withLatest_(monthlyText_(month, body, story));
  var sheet = sheet_();
  var rows = sheet.getDataRange().getValues();
  var sent = Number(row.values[M_RECIPIENTS]) || 0, remaining = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_MONTHLY]) === month) continue;
    if (MailApp.getRemainingDailyQuota() < 2) { remaining++; continue; }
    sendEmail_(rows[i][COL_EMAIL], subject, body, rows[i][COL_CODE]);
    sheet.getRange(i + 1, COL_MONTHLY + 1).setValue(month);
    sent++;
  }
  monthly.getRange(row.number, M_RECIPIENTS + 1).setValue(sent);
  if (remaining > 0) {
    emailIza_("Newsletter " + month + " partly sent", "Sent to " + sent + " so far. Google's daily limit was reached, so the other " + remaining + " go out tomorrow morning.");
    return;
  }
  monthly.getRange(row.number, M_STATUS + 1).setValue("sent");
  monthly.getRange(row.number, M_SENT + 1).setValue(new Date());
  if (story) {
    var stories = storiesSheet_();
    stories.getRange(story.number, S_STATUS + 1).setValue("sent");
    stories.getRange(story.number, S_SENT + 1).setValue(new Date());
    stories.getRange(story.number, S_RECIPIENTS + 1).setValue(sent + " (with the monthly email)");
  }
  emailIza_("Newsletter " + month + " sent", "Sent to " + sent + " subscribers.");
}


// ---- Weekly stories ---------------------------------------------------------
// The "Stories" tab is the story library, one row per story. A story goes out on
// its "Send on" day at about 9:00, only if its Status is "ready". Anything else,
// like "draft", waits. Two days before, you get a preview by email.
// The story planned for the week (Monday to Sunday) of the monthly email goes
// inside the monthly email instead of on its own.
// The Newsletter menu in the sheet shows the library and previews a story.

var STORIES_TAB = "Stories";
var STORY_HEADERS = ["Send on", "Status", "Title", "Theme", "Story", "Credit", "Question", "Sent", "Recipients"];
var S_DATE = 0, S_STATUS = 1, S_TITLE = 2, S_THEME = 3, S_STORY = 4, S_CREDIT = 5, S_QUESTION = 6, S_SENT = 7, S_RECIPIENTS = 8;
var STORY_SUBJECT = "A story to sit with: ";
var WITH_MONTHLY = "with monthly"; // status while it rides along with the monthly email
var PREVIEW_DAYS_AHEAD = 2;
var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function storiesSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(STORIES_TAB);
  if (!sheet) {
    sheet = book.insertSheet(STORIES_TAB);
    sheet.appendRow(STORY_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd");
    sheet.getRange("E:E").setWrap(true);
    sheet.setColumnWidth(5, 420);
  }
  return sheet;
}

function dayString_(date) {
  return Utilities.formatDate(date, TIME_ZONE, "yyyy-MM-dd");
}

function addDays_(day, days) {
  var date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Monday of that day's week, as "yyyy-MM-dd".
function weekStart_(day) {
  var weekday = (new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7;
  return addDays_(day, -weekday);
}

// The day a month's email is due: SEND_DAY of the month before.
function sendDayFor_(month) {
  var parts = month.replace("TEST-", "").split("-"), year = Number(parts[0]), number = Number(parts[1]) - 1;
  if (number === 0) { number = 12; year--; }
  return year + "-" + ("0" + number).slice(-2) + "-" + ("0" + SEND_DAY).slice(-2);
}

// Every story as { number: sheet row, values, day, status }.
function stories_() {
  var rows = storiesSheet_().getDataRange().getValues(), list = [];
  for (var i = 1; i < rows.length; i++) {
    var date = rows[i][S_DATE];
    if (!rows[i][S_TITLE] && !rows[i][S_STORY]) continue;
    list.push({
      number: i + 1, values: rows[i],
      day: date instanceof Date ? dayString_(date) : String(date || ""),
      status: String(rows[i][S_STATUS] || "").trim().toLowerCase()
    });
  }
  return list.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
}

// The ready story planned for that day's week, if any.
function storyForWeek_(day, includeClaimed) {
  var week = weekStart_(day);
  return stories_().filter(function (story) {
    return story.day && weekStart_(story.day) === week &&
      (story.status === "ready" || (includeClaimed && story.status === WITH_MONTHLY));
  })[0] || null;
}

function storyIntro_(values) {
  return "Here is an ancient anecdote for you to contemplate. This one is about " +
    String(values[S_THEME] || "[IZA: what the story is about]").trim().replace(/[.\s]+$/, "") + ".";
}

function storyBlock_(values) {
  var parts = ["# " + String(values[S_TITLE]).trim(), String(values[S_STORY]).trim()];
  if (String(values[S_CREDIT]).trim()) parts.push(String(values[S_CREDIT]).trim());
  if (String(values[S_QUESTION]).trim()) parts.push("**" + String(values[S_QUESTION]).trim().replace(/^\*+|\*+$/g, "") + "**");
  return parts.join("\n\n");
}

function storyEmail_(values) {
  return "Hi lovely soul,\n\n" + storyIntro_(values) + "\n\n" + storyBlock_(values) + "\n\nStay well,\nIza";
}

function storySubject_(values) {
  return STORY_SUBJECT + String(values[S_TITLE]).trim();
}

// The monthly email: the routine writes only the holiday part (# Month, list,
// deities). This adds the greeting, the week's story, the lines and the sign-off.
function monthlyText_(month, holidays, story) {
  holidays = String(holidays).trim();
  if (/^Hi\b/.test(holidays)) return holidays; // an old draft that is already complete
  var name = MONTH_NAMES[Number(month.slice(-2)) - 1];
  if (!story) return "Hi lovely soul,\n\nHere are the Slavic pagan holidays for " + name + ".\n\n" + holidays + "\n\nStay well,\nIza";
  return "Hi lovely soul,\n\n" + storyIntro_(story.values) + " Below it is a list of Slavic pagan holidays for " + name + ".\n\n" +
    storyBlock_(story.values) + "\n\n---\n\n" + holidays + "\n\nStay well,\nIza";
}

function sendScheduledStory_() {
  var today = dayString_(new Date());
  var story = stories_().filter(function (s) {
    return s.status === "sending" || (s.status === "ready" && s.day === today);
  })[0];
  if (!story) return;
  var subject = storySubject_(story.values), body = storyEmail_(story.values);
  if (hasPlaceholder_(subject + body)) {
    remindOnce_("REMINDED_STORY_" + story.day, "Story for " + story.day + " can't send", "It still has [IZA: ...] parts, so nothing went out. Fix it in the Stories tab and set Status to ready with a new date.");
    return;
  }
  var stories = storiesSheet_(), id = "story " + story.day;
  stories.getRange(story.number, S_STATUS + 1).setValue("sending");
  body = withLatest_(body);

  var sheet = sheet_();
  if (!sheet.getRange(1, COL_STORY + 1).getValue()) sheet.getRange(1, COL_STORY + 1).setValue(HEADERS[COL_STORY]);
  var rows = sheet.getDataRange().getValues();
  var sent = Number(story.values[S_RECIPIENTS]) || 0, remaining = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_STORY]) === id) continue;
    if (MailApp.getRemainingDailyQuota() < 2) { remaining++; continue; }
    sendEmail_(rows[i][COL_EMAIL], subject, body, rows[i][COL_CODE]);
    sheet.getRange(i + 1, COL_STORY + 1).setValue(id);
    sent++;
  }
  stories.getRange(story.number, S_RECIPIENTS + 1).setValue(sent);
  if (remaining > 0) {
    emailIza_("Story partly sent", "Sent to " + sent + " so far. Google's daily limit was reached, so the other " + remaining + " go out tomorrow morning.");
    return;
  }
  stories.getRange(story.number, S_STATUS + 1).setValue("sent");
  stories.getRange(story.number, S_SENT + 1).setValue(new Date());
}

// Two days ahead, emails you the story as subscribers will see it.
function previewUpcomingStories_() {
  var day = addDays_(dayString_(new Date()), PREVIEW_DAYS_AHEAD);
  stories_().forEach(function (story) {
    if (story.day !== day || story.status === "sent") return;
    var key = "PREVIEWED_STORY_" + story.day + "_" + story.number;
    var properties = PropertiesService.getScriptProperties();
    if (properties.getProperty(key)) return;
    properties.setProperty(key, "yes");
    var ready = story.status === "ready";
    var intro = (ready
      ? "This story goes out on " + story.day + " at about 9:00. To change it, edit its row in the Stories tab before then."
      : "This story is planned for " + story.day + " but its Status is \"" + story.status + "\", so it will NOT go out. Set Status to ready in the Stories tab if you want it sent.") +
      " If that day is in the week of the monthly email, it goes inside that email instead.";
    var body = withLatest_(storyEmail_(story.values));
    emailIza_("Story preview for " + story.day + ": " + story.values[S_TITLE],
      intro + "\n\nSubject: " + storySubject_(story.values) + "\n\n-----\n" + plainText_(body) + "\n-----",
      previewHtml_(intro, storySubject_(story.values), body));
  });
}

function previewHtml_(intro, subject, body) {
  return wrapHtml_('<div style="padding:16px;background:#f3ebdd;border-radius:8px;font-size:14px">' +
    (intro ? '<p style="margin:0 0 8px">' + escapeHtml_(intro) + '</p>' : '') +
    '<p style="margin:0"><strong>Subject:</strong> ' + escapeHtml_(subject) + '</p></div>' + renderHtml_(body));
}

// ---- The Newsletter menu in the sheet ---------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Newsletter")
    .addItem("Show the story library", "showStoryLibrary")
    .addItem("Preview the selected story", "previewSelectedStory")
    .addItem("Email me the selected story", "emailSelectedStory")
    .addToUi();
}

function selectedStory_() {
  var sheet = SpreadsheetApp.getActiveSheet(), row = sheet.getActiveRange().getRow();
  if (sheet.getName() !== STORIES_TAB || row < 2) {
    SpreadsheetApp.getUi().alert("Open the Stories tab and click any cell in a story's row first.");
    return null;
  }
  return sheet.getRange(row, 1, 1, STORY_HEADERS.length).getValues()[0];
}

function previewSelectedStory() {
  var values = selectedStory_();
  if (!values) return;
  var html = previewHtml_("", storySubject_(values), withLatest_(storyEmail_(values)));
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(640).setHeight(720), "Story preview");
}

function emailSelectedStory() {
  var values = selectedStory_();
  if (!values) return;
  var body = withLatest_(storyEmail_(values));
  emailIza_("TEST: " + storySubject_(values), plainText_(body), wrapHtml_(renderHtml_(body)));
  SpreadsheetApp.getActiveSpreadsheet().toast("Sent to you only.", "Newsletter");
}

function showStoryLibrary() {
  var today = dayString_(new Date()), colors = { ready: "#4f7a3a", sent: "#8a8a8a", sending: "#b07a1e" };
  colors[WITH_MONTHLY] = "#b07a1e";
  var cards = stories_().map(function (story) {
    var color = colors[story.status] || "#a8452f";
    var past = story.day && story.day < today ? "opacity:.6;" : "";
    return '<div style="' + past + 'margin:0 0 24px;padding:16px 20px;background:#fbf7f0;border:1px solid #e6dccb;border-radius:8px">' +
      '<p style="margin:0 0 8px;font-size:13px;color:#6d5848">' + escapeHtml_(story.day || "no date") +
      ' &middot; <span style="color:' + color + ';font-weight:bold">' + escapeHtml_(story.status || "no status") + '</span>' +
      (story.values[S_THEME] ? ' &middot; about ' + escapeHtml_(story.values[S_THEME]) : '') + '</p>' +
      renderHtml_(storyBlock_(story.values)) + '</div>';
  }).join("") || "<p>No stories yet. Add one to the Stories tab.</p>";
  var html = '<div style="font-family:Georgia,serif;font-size:15px;line-height:1.55;color:#3a2a1e">' +
    '<p style="font-size:13px;color:#6d5848">Only stories marked <b>ready</b> go out, on their date. Past ones are faded.</p>' + cards + '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(760).setHeight(720), "Story library");
}
