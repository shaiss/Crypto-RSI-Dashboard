const form = document.getElementById('session-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const fieldsEl = document.getElementById('session-fields');
const jsonEl = document.getElementById('session-json');

function setStatus(message, kind) {
  statusEl.hidden = !message;
  statusEl.textContent = message || '';
  statusEl.className = kind ? `status ${kind}` : 'status';
}

function renderSession(session) {
  const rows = [
    ['Token', session.token],
    ['Pair', session.pair],
    ['Exchange', session.exchange],
    ['Timeframe', session.timeframe],
    ['RSI', session.rsi != null ? String(session.rsi) : '—'],
    ['RSI as of', session.rsiAsOf || '—'],
    ['On watchlist', session.onWatchlist ? 'yes' : 'no'],
    [
      'Alert',
      session.alert?.status || 'none',
      session.alert?.status === 'active' ? 'alert-active' : session.alert?.status === 'recent' ? 'alert-recent' : '',
    ],
  ];

  if (session.alert?.summary) {
    rows.push(['Alert summary', session.alert.summary]);
  }
  if (session.errors?.length) {
    rows.push(['Errors', session.errors.join('; ')]);
  }

  fieldsEl.innerHTML = rows
    .map(([label, value, className]) => {
      const cls = className ? ` class="${className}"` : '';
      return `<dt>${label}</dt><dd${cls}>${value}</dd>`;
    })
    .join('');

  jsonEl.textContent = JSON.stringify(session, null, 2);
  resultEl.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const token = String(data.get('token') || '').trim();
  const timeframe = String(data.get('timeframe') || '').trim();
  const exchange = String(data.get('exchange') || '').trim();

  const params = new URLSearchParams({ token, timeframe });
  if (exchange) {
    params.set('exchange', exchange);
  }

  setStatus('Loading session…', 'loading');
  resultEl.hidden = true;

  try {
    const response = await fetch(`/api/session?${params.toString()}`);
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error || `Request failed (${response.status})`, 'error');
      return;
    }
    setStatus('');
    renderSession(body);
  } catch (err) {
    setStatus(err.message || 'Network error', 'error');
  }
});
