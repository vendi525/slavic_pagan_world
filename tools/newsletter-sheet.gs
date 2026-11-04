// Saves newsletter signups from the website into this Google Sheet.
// Paste into Extensions > Apps Script in the sheet, then deploy as a web app.

var CONSENT_WORDING = "Send me one free calendar page each month. I can unsubscribe anytime by replying to any email.";

function respond(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function isValidEmail(email) {
  return email.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) && /^[A-Za-z0-9]/.test(email);
}

function doPost(e) {
  var params = (e && e.parameter) || {};

  // Bots fill in the hidden "website" field. Pretend it worked and save nothing.
  if (params.website) return respond({ ok: true });

  var email = String(params.email || "").trim().toLowerCase();
  if (!isValidEmail(email) || params.consent !== "yes") return respond({ ok: false });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(["Signed up", "Email", "Agreed to"]);

    var existing = sheet.getRange(1, 2, sheet.getLastRow(), 1).getValues();
    var alreadySignedUp = existing.some(function (row) { return row[0] === email; });
    if (!alreadySignedUp) sheet.appendRow([new Date(), email, CONSENT_WORDING]);
  } finally {
    lock.releaseLock();
  }
  return respond({ ok: true });
}
