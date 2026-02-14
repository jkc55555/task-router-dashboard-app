/**
 * GTD Inbox — Gmail Add-on
 * Adds the current email to your GTD app inbox via POST /intake.
 * Set BACKEND_URL (and optionally API_KEY) in Script Properties.
 */

function getBackendConfig() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('BACKEND_URL');
  if (!url) throw new Error('BACKEND_URL not set in Script Properties');
  return {
    url: url.replace(/\/$/, ''),
    apiKey: props.getProperty('API_KEY')
  };
}

/**
 * Contextual trigger: runs when user opens a Gmail message.
 * Builds a card with "Add to GTD Inbox" button.
 */
function onGmailMessageOpen(e) {
  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var messageId = e.gmail.messageId;
  var message = GmailApp.getMessageById(messageId);
  var subject = message.getSubject() || '(No subject)';
  var from = message.getFrom();
  var plainBody = message.getPlainBody();
  var thread = message.getThread();
  var threadId = thread.getId();
  var permalink = thread.getPermalink ? thread.getPermalink() : '';

  var section = CardService.newCardSection()
    .addWidget(CardService.newKeyValue()
      .setTopLabel('From')
      .setContent(from))
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Subject')
      .setContent(subject));

  var addAction = CardService.newAction()
    .setFunctionName('addToGtdInbox')
    .setParameters({ messageId: messageId });

  section.addWidget(CardService.newTextButton()
    .setText('Add to GTD Inbox')
    .setOnClickAction(addAction));

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('GTD Inbox'))
    .addSection(section)
    .build();

  return [card];
}

/**
 * Action callback: POST current message to backend /intake.
 */
function addToGtdInbox(e) {
  var config = getBackendConfig();
  var messageId = (e.parameters && e.parameters.messageId) ? e.parameters.messageId : (e.gmail && e.gmail.messageId);
  if (!messageId) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('No message context'))
      .build();
  }
  if (e.gmail && e.gmail.accessToken) GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  var message = GmailApp.getMessageById(messageId);
  var subject = message.getSubject() || '(No subject)';
  var fullPlainBody = message.getPlainBody() || '';
  var thread = message.getThread();
  var threadLink = thread.getPermalink ? thread.getPermalink() : '';

  var payload = {
    title: subject,
    body: fullPlainBody.slice(0, 50000),
    source: 'gmail',
    metadata: {
      messageId: messageId,
      threadId: thread.getId(),
      webLink: threadLink
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  if (config.apiKey) {
    options.headers = { 'Authorization': 'Bearer ' + config.apiKey };
  }

  var response = UrlFetchApp.fetch(config.url + '/intake', options);
  var code = response.getResponseCode();

  if (code >= 200 && code < 300) {
    var result = JSON.parse(response.getContentText());
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Added to GTD Inbox'))
      .setStateChanged(true)
      .build();
  } else {
    var errText = response.getContentText();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Failed: ' + (errText || 'HTTP ' + code)))
      .build();
  }
}

/**
 * Homepage: show when add-on is opened from Gmail inbox (no message selected).
 */
function onHomepageOpen() {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('GTD Inbox'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('Open an email and click "Add to GTD Inbox" to send it to your task app.')))
    .build();
  return [card];
}

/**
 * Compose trigger: minimal UI when composing (no message to add).
 */
function onComposeOpen() {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('GTD Inbox'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('To add an email to GTD Inbox, open a received message and use the add-on there.')))
    .build();
  return [card];
}
