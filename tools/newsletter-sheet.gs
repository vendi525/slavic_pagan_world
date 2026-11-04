// Slavic Pagan World newsletter, run from a Google Sheet.
// Saves signups, sends the welcome and monthly emails, and handles unsubscribes.
//
// Setup: paste into Extensions > Apps Script in the sheet, then
// Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
// After changing this code, use Deploy > Manage deployments > Edit > New version.
//
// Emails containing "[IZA:" never go to subscribers. sendTestEmails() always
// goes only to you, so you can check them first.

var FROM_NAME = "Slavic Pagan World";

// The page in every email's unsubscribe link. It's on your own site because
// Google's web app page fails for anyone signed in to several Google accounts.
var UNSUBSCRIBE_PAGE = "https://slavicpaganworld.com/unsubscribe/";

// Must match the wording on the website form.
var CONSENT_WORDING = "Send me one free calendar page each month. I can unsubscribe anytime using the link in any email.";

// ---- Edit these ------------------------------------------------------------

var ETSY_LINK = "[IZA: Etsy listing link]";
var VIDEO_LINK = "https://www.youtube.com/watch?v=Mqx5K0wY0Gw"; // the newest full video
var BUSINESS_DETAILS = "[IZA: s.p. name and address]";

// The article for this season, shown in both emails. Leave empty until there is one.
var ARTICLE_TITLE = "";
var ARTICLE_LINK = "";

// The welcome email changes by itself once these are filled in, from December 1.
var CURRENT_PAGE_MONTH = ""; // for example "January"
var CURRENT_PAGE_LINK = "";

// Fill these in for each monthly email. Change MONTHLY_ID each time, for example
// "2027-01". If a send stops at the daily limit, running it again continues with
// whoever hasn't had it.
var MONTHLY_ID = "[IZA: month, for example 2027-01]";
var MONTH_NAME = "[IZA: month, for example January]";
var MONTH_PAGE_LINK = "[IZA: link to this month's calendar page]";
var HOLIDAY_NOTE = "[IZA: 2 to 4 sentences about this month's holiday]";

var WELCOME_SUBJECT = "welcome to the old Slavic year 🍂";

function articleBlock_(intro) {
  if (!ARTICLE_LINK) return [];
  return [intro + "\n" + ARTICLE_TITLE + "\n" + ARTICLE_LINK];
}

function videoBlock_() {
  return ["For a glimpse of my lifestyle, watch my most recent YouTube video.\n" + VIDEO_LINK];
}

function welcomeText_() {
  var hasPage = CURRENT_PAGE_MONTH && CURRENT_PAGE_LINK;
  var parts = [
    "Hi, and welcome.",
    "I'm Iza. I make slow videos about Slavic folklore, seasonal rituals and small handmade things, and I design the Slavic Pagan Calendar."
  ];
  if (hasPage) {
    parts.push("Here is your page for " + CURRENT_PAGE_MONTH + ":\n" + CURRENT_PAGE_LINK);
    parts.push("A new page arrives a few days before each month.");
  } else {
    parts.push("In December you'll get your first page, for January. After that, a new page arrives a few days before each month, with a short note about that month's holiday and whatever I've been making.");
  }
  parts = parts.concat(articleBlock_(hasPage ? "Here's something for this time of year:" : "Until then, here's something for this time of year:"));
  parts = parts.concat(videoBlock_());
  parts.push("If you'd like the whole year at once, the full 2027 calendar is on Etsy.\n" + ETSY_LINK);
  parts.push("Talk soon,\nIza");
  return parts.join("\n\n");
}

function monthlySubject_() {
  return "your " + MONTH_NAME + " page is here";
}

function monthlyText_() {
  var parts = ["Hi,", "Here is your calendar page for " + MONTH_NAME + ".\n" + MONTH_PAGE_LINK, HOLIDAY_NOTE];
  parts = parts.concat(articleBlock_("Something for this time of year:"));
  parts = parts.concat(videoBlock_());
  parts.push("See the full calendar:\n" + ETSY_LINK);
  parts.push("Talk soon,\nIza");
  return parts.join("\n\n");
}

// ---- Reminders --------------------------------------------------------------
// Emails you what to do and when. Run setupReminders once to start them. They go
// to the address in Project Settings > Script Properties > REMINDER_EMAIL, or to
// this account if that isn't set.

var ONCE_REMINDERS = {
  "2026-12-01": ["Add January page to the welcome email", [
    "Put the January PDF on the site",
    "Fill in CURRENT_PAGE_MONTH and CURRENT_PAGE_LINK in the script",
    "Publish it: Deploy > Manage deployments > pencil > New version",
    "Fill in the monthly email details and run sendMonthlyEmail so existing subscribers get January",
    "Remove the 'first page in December' line from the website"
  ]]
};

var MONTHLY_REMINDER = ["Send the monthly newsletter", [
  "Put next month's PDF on the site",
  "Write the holiday note",
  "Update MONTHLY_ID, MONTH_NAME, MONTH_PAGE_LINK and HOLIDAY_NOTE in the script, and check the article and video",
  "Run sendTestEmails and check the email",
  "Run sendMonthlyEmail"
]];

var SEASON_REMINDER = ["Swap the seasonal article", [
  "Pick the article for the new season",
  "Update ARTICLE_TITLE and ARTICLE_LINK in the script",
  "Publish it: Deploy > Manage deployments > pencil > New version"
]];

function remindersFor_(date) { // date is "yyyy-mm-dd"
  var due = [];
  if (ONCE_REMINDERS[date]) due.push(ONCE_REMINDERS[date]);
  if (date.slice(8) === "25") due.push(MONTHLY_REMINDER);
  if (["03-01", "06-01", "09-01", "12-01"].indexOf(date.slice(5)) !== -1) due.push(SEASON_REMINDER);
  return due;
}

// Runs by itself every morning. It only sends once per date.
function sendDueReminders() {
  var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("LAST_REMINDER_DATE") === date) return;
  properties.setProperty("LAST_REMINDER_DATE", date);
  var to = properties.getProperty("REMINDER_EMAIL") || Session.getEffectiveUser().getEmail();
  remindersFor_(date).forEach(function (reminder) {
    MailApp.sendEmail({
      to: to,
      subject: "Reminder: " + reminder[0],
      name: FROM_NAME,
      body: reminder[1].map(function (step) { return "- " + step; }).join("\n")
    });
  });
}

function setupReminders() {
  assertOwner_();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "sendDueReminders") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("sendDueReminders").timeBased().everyDays(1).atHour(8).create();
}

// Sends one sample reminder so you can check it reaches you.
function sendTestReminder() {
  assertOwner_();
  var to = PropertiesService.getScriptProperties().getProperty("REMINDER_EMAIL") || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: to, subject: "TEST reminder: " + MONTHLY_REMINDER[0], name: FROM_NAME, body: MONTHLY_REMINDER[1].map(function (step) { return "- " + step; }).join("\n") });
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

function monthlyReady_() {
  return !hasPlaceholder_(MONTHLY_ID + monthlySubject_() + monthlyText_() + BUSINESS_DETAILS);
}

function isValidEmail_(email) {
  return email.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) && /^[A-Za-z0-9]/.test(email);
}

function unsubscribeLink_(code) {
  return UNSUBSCRIBE_PAGE + "?u=" + encodeURIComponent(code);
}

function sendEmail_(to, subject, text, code) {
  MailApp.sendEmail({
    to: to,
    subject: subject,
    name: FROM_NAME,
    body: text + "\n\n--\n" + BUSINESS_DETAILS + "\nUnsubscribe: " + unsubscribeLink_(code)
  });
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

// Sends both emails to you only. Their unsubscribe link opens the real page but removes nobody.
function sendTestEmails() {
  assertOwner_();
  var me = Session.getEffectiveUser().getEmail();
  sendEmail_(me, "TEST: " + WELCOME_SUBJECT, welcomeText_(), "test");
  sendEmail_(me, "TEST: " + monthlySubject_(), monthlyText_(), "test");
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

// Sends the monthly email to everyone who hasn't had this MONTHLY_ID yet.
function sendMonthlyEmail() {
  assertOwner_();
  if (!monthlyReady_()) throw new Error("The monthly email still has [IZA: placeholders.");
  var sheet = sheet_();
  var rows = sheet.getDataRange().getValues();
  var sent = 0, remaining = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][COL_MONTHLY] === MONTHLY_ID) continue;
    if (MailApp.getRemainingDailyQuota() < 1) { remaining++; continue; }
    sendEmail_(rows[i][COL_EMAIL], monthlySubject_(), monthlyText_(), rows[i][COL_CODE]);
    sheet.getRange(i + 1, COL_MONTHLY + 1).setValue(MONTHLY_ID);
    sent++;
  }
  Logger.log("Monthly emails sent: " + sent + ". Still to send: " + remaining + ". If any remain, run this again tomorrow.");
}
