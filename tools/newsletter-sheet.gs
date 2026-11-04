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

// Must match the wording on the website form.
var CONSENT_WORDING = "Send me one free calendar page each month. I can unsubscribe anytime using the link in any email.";

// ---- Edit these ------------------------------------------------------------

var WELCOME_SUBJECT = "[IZA: welcome email subject]";
var WELCOME_TEXT = "[IZA: welcome email text, with a link to the current calendar page]";

// Change MONTHLY_ID for each new send, for example "2027-01". If a send stops
// at the daily limit, running it again continues with whoever hasn't had it.
var MONTHLY_ID = "[IZA: month, for example 2027-01]";
var MONTHLY_SUBJECT = "[IZA: monthly email subject]";
var MONTHLY_TEXT = "[IZA: monthly email text, with a link to this month's calendar page]";

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

function isValidEmail_(email) {
  return email.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) && /^[A-Za-z0-9]/.test(email);
}

function unsubscribeLink_(code) {
  return ScriptApp.getService().getUrl() + "?u=" + encodeURIComponent(code);
}

function sendEmail_(to, subject, text, code) {
  MailApp.sendEmail({
    to: to,
    subject: subject,
    name: FROM_NAME,
    body: text + "\n\n--\nUnsubscribe: " + unsubscribeLink_(code)
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
      if (!hasPlaceholder_(WELCOME_SUBJECT + WELCOME_TEXT)) {
        try {
          sendEmail_(email, WELCOME_SUBJECT, WELCOME_TEXT, code);
          sheet.getRange(rows.length + 1, COL_WELCOME + 1).setValue(new Date());
        } catch (error) {
          // The signup is saved. sendMissingWelcomes() can catch up later.
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
  return respond_({ ok: true });
}

// ---- Unsubscribe -----------------------------------------------------------

// The link opens a page with a button, because email security tools open links
// automatically and would otherwise unsubscribe people by accident.
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
  sendEmail_(me, "TEST: " + WELCOME_SUBJECT, WELCOME_TEXT, "test");
  sendEmail_(me, "TEST: " + MONTHLY_SUBJECT, MONTHLY_TEXT, "test");
}

// Sends the welcome email to anyone who signed up while it had placeholders.
function sendMissingWelcomes() {
  assertOwner_();
  if (hasPlaceholder_(WELCOME_SUBJECT + WELCOME_TEXT)) throw new Error("The welcome email still has [IZA: placeholders.");
  var sheet = sheet_();
  var rows = sheet.getDataRange().getValues();
  var sent = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][COL_WELCOME] || MailApp.getRemainingDailyQuota() < 1) continue;
    sendEmail_(rows[i][COL_EMAIL], WELCOME_SUBJECT, WELCOME_TEXT, rows[i][COL_CODE]);
    sheet.getRange(i + 1, COL_WELCOME + 1).setValue(new Date());
    sent++;
  }
  Logger.log("Welcome emails sent: " + sent);
}

// Sends the monthly email to everyone who hasn't had this MONTHLY_ID yet.
function sendMonthlyEmail() {
  assertOwner_();
  if (hasPlaceholder_(MONTHLY_ID + MONTHLY_SUBJECT + MONTHLY_TEXT)) throw new Error("The monthly email still has [IZA: placeholders.");
  var sheet = sheet_();
  var rows = sheet.getDataRange().getValues();
  var sent = 0, remaining = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][COL_MONTHLY] === MONTHLY_ID) continue;
    if (MailApp.getRemainingDailyQuota() < 1) { remaining++; continue; }
    sendEmail_(rows[i][COL_EMAIL], MONTHLY_SUBJECT, MONTHLY_TEXT, rows[i][COL_CODE]);
    sheet.getRange(i + 1, COL_MONTHLY + 1).setValue(MONTHLY_ID);
    sent++;
  }
  Logger.log("Monthly emails sent: " + sent + ". Still to send: " + remaining + ". If any remain, run this again tomorrow.");
}
