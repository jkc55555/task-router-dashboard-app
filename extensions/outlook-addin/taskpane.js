/**
 * GTD Inbox — Outlook Add-in taskpane
 * Set BACKEND_URL (and optionally API_KEY) below or via build/config.
 */
var BACKEND_URL = 'https://localhost:3001';
var API_KEY = '';

Office.onReady(function () {
  document.getElementById('addBtn').onclick = addToGtdInbox;
});

function setStatus(text, isError) {
  var el = document.getElementById('status');
  el.textContent = text;
  el.style.color = isError ? '#c00' : '#0a0';
}

function addToGtdInbox() {
  var item = Office.context.mailbox.item;
  if (!item) {
    setStatus('No message selected.', true);
    return;
  }

  var subject = item.subject || '(No subject)';
  setStatus('Sending…');

  item.body.getAsync(Office.CoercionType.Text, function (asyncResult) {
    if (asyncResult.status === Office.AsyncResultStatus.Failed) {
      setStatus('Could not read message body.', true);
      return;
    }

    var body = asyncResult.value || '';
    var metadata = {
      itemId: item.itemId,
      webLink: item.webLink || ''
    };

    var payload = {
      title: subject,
      body: body,
      source: 'outlook',
      metadata: metadata
    };

    var options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (API_KEY) {
      options.headers['Authorization'] = 'Bearer ' + API_KEY;
    }

    fetch(BACKEND_URL + '/intake', options)
      .then(function (res) {
        if (res.ok) {
          setStatus('Added to GTD Inbox.');
        } else {
          return res.text().then(function (t) {
            setStatus('Failed: ' + (t || res.status), true);
          });
        }
      })
      .catch(function (err) {
        setStatus('Error: ' + (err.message || err), true);
      });
  });
}
