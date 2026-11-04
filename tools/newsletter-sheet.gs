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
var CONSENT_WORDING = "Send me the upcoming Slavic holidays and rituals each month. I can unsubscribe anytime using the link in any email.";

// ---- Edit these ------------------------------------------------------------

var ETSY_LINK = "[IZA: Etsy listing link]";
var VIDEO_LINK = "https://www.youtube.com/watch?v=Mqx5K0wY0Gw"; // the newest full video
var BUSINESS_DETAILS = "[IZA: s.p. name and address]";

// The article for this season, shown in both emails. Leave empty until there is one.
var ARTICLE_TITLE = "";
var ARTICLE_LINK = "";

var WELCOME_SUBJECT = "welcome to the old Slavic year 🍂";

// The routine keeps the latest links here, so the welcome email stays current.
// The values above are only used until it has saved some.
function setting_(name, fallback) {
  return PropertiesService.getScriptProperties().getProperty(name) || fallback;
}

function articleBlock_(intro) {
  var link = setting_("ARTICLE_LINK", ARTICLE_LINK);
  if (!link) return [];
  return [intro + "\n" + setting_("ARTICLE_TITLE", ARTICLE_TITLE) + "\n" + link];
}

function videoBlock_() {
  return ["For a glimpse of my lifestyle, watch my most recent YouTube video.\n" + setting_("VIDEO_LINK", VIDEO_LINK)];
}

function welcomeText_() {
  var parts = [
    "Hi, and welcome.",
    "I'm Iza. I make slow videos about Slavic folklore, seasonal rituals and small handmade things, and I design the Slavic Pagan Calendar.",
    "Each month I'll send you the holidays and rituals coming up next month, with a short note on each one and the deities connected to them."
  ];
  parts = parts.concat(articleBlock_("Here's something for this time of year:"));
  parts = parts.concat(videoBlock_());
  parts.push("If you'd like the whole year at once, the full 2027 calendar is on Etsy.\n" + ETSY_LINK);
  parts.push("Talk soon,\nIza");
  return parts.join("\n\n");
}

// ---- Sheet columns ---------------------------------------------------------

var HEADERS = ["Signed up", "Email", "Agreed to", "Unsubscribe code", "Welcome sent", "Last monthly sent"];
var COL_EMAIL = 1, COL_CODE = 3, COL_WELCOME = 4, COL_MONTHLY = 5; // positions in a row, from 0

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
//   # Heading        **bold**        [[Button text|https://link]]
//   Lines starting with a number are the holiday list.
function escapeHtml_(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml_(line) {
  return escapeHtml_(line)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#7a3b27">$1</a>');
}

function renderLine_(line) {
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
  return String(text).replace(/^# /gm, "").replace(/\*\*/g, "").replace(/\[\[(.+?)\|(.+)\]\]/g, "$1: $2");
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
        body: row ? row.values[M_BODY] : "", lastReplyId: row ? String(row.values[M_REPLY]) : "",
        etsyLink: ETSY_LINK
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
      if (month.indexOf("TEST") !== 0) {
        var properties = PropertiesService.getScriptProperties();
        if (params.videoLink) properties.setProperty("VIDEO_LINK", String(params.videoLink));
        if (params.articleLink) {
          properties.setProperty("ARTICLE_LINK", String(params.articleLink));
          properties.setProperty("ARTICLE_TITLE", String(params.articleTitle || ""));
        }
      }
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

// Runs by itself every morning. Sends a confirmed email from SEND_DAY onwards.
function sendScheduledMonthly() {
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
  emailIza_("Newsletter " + month + " sent", "Sent to " + sent + " subscribers.");
}
