const SUGGESTED_L1_TOKENS = ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'ADA', 'DOT', 'LINK', 'XRP', 'MATIC'];

const form = document.getElementById('session-form');
const thresholdsForm = document.getElementById('thresholds-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const fieldsEl = document.getElementById('session-fields');
const jsonEl = document.getElementById('session-json');
const chartEl = document.getElementById('rsi-chart');
const tokenInput = document.getElementById('token-input');
const l1Picker = document.getElementById('l1-picker');
const l1Datalist = document.getElementById('l1-tokens');
const watchlistAddBtn = document.getElementById('watchlist-add');
const watchlistRemoveBtn = document.getElementById('watchlist-remove');
const thresholdsSaveBtn = document.getElementById('thresholds-save');
const authSignedOut = document.getElementById('auth-signed-out');
const authSignedIn = document.getElementById('auth-signed-in');
const authLocalOpen = document.getElementById('auth-local-open');
const clerkSignInBtn = document.getElementById('clerk-sign-in');
const clerkConnectWalletBtn = document.getElementById('clerk-connect-wallet');
const clerkSignOutBtn = document.getElementById('clerk-sign-out');
const clerkUserEmailEl = document.getElementById('clerk-user-email');
const walletStatusEl = document.getElementById('wallet-status');
const walletGateHintEl = document.getElementById('wallet-gate-hint');
const authHintEl = document.getElementById('auth-hint');
const strategyTimelineEl = document.getElementById('strategy-timeline');
const strategyEventsListEl = document.getElementById('strategy-events-list');

/** @type {typeof window.Clerk | null} */
let clerk = null;
let clerkRequired = false;
let lastSession = null;
/** @type {{ walletConnected: boolean, walletAddressTruncated: string|null }} */
let meProfile = { walletConnected: false, walletAddressTruncated: null };

/** Clerk modal options — compatible with Dashboard-enabled Google OAuth + Web3 wallets (no custom trading flows). */
function clerkModalBaseOptions() {
  return {
    routing: 'hash',
    redirectUrl: window.location.href,
    appearance: {
      elements: {
        socialButtonsBlockButton: 'cl-social-btn',
      },
    },
  };
}

function openClerkSignIn() {
  if (!clerk) {
    return;
  }
  if (typeof clerk.openSignIn === 'function') {
    clerk.openSignIn(clerkModalBaseOptions());
    return;
  }
  clerk.redirectToSignIn?.({ redirectUrl: window.location.href });
}

function openClerkUserProfile() {
  if (!clerk) {
    return;
  }
  if (typeof clerk.openUserProfile === 'function') {
    clerk.openUserProfile(clerkModalBaseOptions());
    return;
  }
  if (typeof clerk.redirectToUserProfile === 'function') {
    clerk.redirectToUserProfile();
  }
}

function setStatus(message, kind) {
  statusEl.hidden = !message;
  statusEl.textContent = message || '';
  statusEl.className = kind ? `status ${kind}` : 'status';
}

function appendField(label, value, className) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (className) {
    dd.className = className;
  }
  fieldsEl.append(dt, dd);
}

function initL1Picker() {
  for (const symbol of SUGGESTED_L1_TOKENS) {
    const option = document.createElement('option');
    option.value = symbol;
    l1Datalist.append(option);

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'l1-chip';
    chip.textContent = symbol;
    chip.addEventListener('click', () => {
      tokenInput.value = symbol;
      tokenInput.focus();
    });
    l1Picker.append(chip);
  }
}

function renderRsiChart(session) {
  if (!window.Plotly || !chartEl) {
    return;
  }

  const series = session.rsiSeries || [];
  const times = series.map((point) => point.time).filter(Boolean);
  const values = series.map((point) => point.value);

  if (times.length === 0 || values.length === 0) {
    chartEl.innerHTML = '<p class="chart-empty">No RSI series available (check TAAPI configuration).</p>';
    return;
  }

  const traces = [
    {
      x: times,
      y: values,
      type: 'scatter',
      mode: 'lines',
      name: 'RSI',
      line: { color: '#3d9cf5', width: 2 },
    },
  ];

  const shapes = [
    {
      type: 'line',
      xref: 'paper',
      x0: 0,
      x1: 1,
      y0: 30,
      y1: 30,
      line: { color: '#3dd68c', width: 1, dash: 'dot' },
    },
    {
      type: 'line',
      xref: 'paper',
      x0: 0,
      x1: 1,
      y0: 70,
      y1: 70,
      line: { color: '#f5b83d', width: 1, dash: 'dot' },
    },
  ];

  const thresholds = session.thresholds || {};
  if (thresholds.buyBelow != null) {
    shapes.push({
      type: 'line',
      xref: 'paper',
      x0: 0,
      x1: 1,
      y0: thresholds.buyBelow,
      y1: thresholds.buyBelow,
      line: { color: '#3dd68c', width: 2 },
    });
  }
  if (thresholds.sellAbove != null) {
    shapes.push({
      type: 'line',
      xref: 'paper',
      x0: 0,
      x1: 1,
      y0: thresholds.sellAbove,
      y1: thresholds.sellAbove,
      line: { color: '#f5b83d', width: 2 },
    });
  }

  const layout = {
    margin: { t: 24, r: 16, b: 40, l: 48 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#e7ecf3', size: 12 },
    xaxis: {
      title: 'Time (UTC)',
      gridcolor: '#2a3544',
      zerolinecolor: '#2a3544',
    },
    yaxis: {
      title: 'RSI',
      range: [0, 100],
      gridcolor: '#2a3544',
      zerolinecolor: '#2a3544',
    },
    shapes,
    showlegend: false,
  };

  Plotly.react(chartEl, traces, layout, { responsive: true, displayModeBar: false });
}

function formatStrategyEventLabel(event) {
  const side = event.side === 'buy' ? 'Would have bought' : 'Would have sold';
  const when = event.createdAt ? new Date(event.createdAt).toISOString() : '—';
  return `${side} ${event.token} (${event.timeframe}) at RSI ${event.rsi} (threshold ${event.threshold}) — ${when}`;
}

function renderStrategyTimeline(session) {
  if (!strategyTimelineEl || !strategyEventsListEl) {
    return;
  }
  const show = clerkRequired && meProfile.walletConnected;
  strategyTimelineEl.hidden = !show;
  if (!show) {
    strategyEventsListEl.replaceChildren();
    return;
  }
  const events = session?.paperStrategy?.recentEvents || [];
  strategyEventsListEl.replaceChildren();
  if (events.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'No paper signals yet for this token and timeframe.';
    strategyEventsListEl.append(empty);
    return;
  }
  for (const event of events) {
    const item = document.createElement('li');
    item.className = event.side === 'buy' ? 'side-buy' : 'side-sell';
    item.textContent = formatStrategyEventLabel(event);
    strategyEventsListEl.append(item);
  }
}

function syncThresholdForm(session) {
  if (!thresholdsForm) {
    return;
  }
  const thresholds = session?.thresholds || {};
  const buyInput = thresholdsForm.elements.namedItem('buyBelow');
  const sellInput = thresholdsForm.elements.namedItem('sellAbove');
  if (buyInput) {
    buyInput.value = thresholds.buyBelow != null ? String(thresholds.buyBelow) : '';
  }
  if (sellInput) {
    sellInput.value = thresholds.sellAbove != null ? String(thresholds.sellAbove) : '';
  }
}

function renderSession(session) {
  lastSession = session;
  fieldsEl.replaceChildren();

  appendField('Token', session.token);
  appendField('Pair', session.pair);
  appendField('Exchange', session.exchange);
  appendField('Timeframe', session.timeframe);
  appendField('RSI', session.rsi != null ? String(session.rsi) : '—');
  appendField('RSI as of', session.rsiAsOf || '—');
  appendField('On watchlist', session.onWatchlist ? 'yes' : 'no');

  const thresholds = session.thresholds || {};
  const thresholdParts = [];
  if (thresholds.buyBelow != null) {
    thresholdParts.push(`buy < ${thresholds.buyBelow}`);
  }
  if (thresholds.sellAbove != null) {
    thresholdParts.push(`sell > ${thresholds.sellAbove}`);
  }
  appendField('Thresholds', thresholdParts.length ? thresholdParts.join('; ') : '—');

  const alertStatus = session.alert?.status || 'none';
  let alertClass = '';
  if (alertStatus === 'active') {
    alertClass = 'alert-active';
  } else if (alertStatus === 'recent') {
    alertClass = 'alert-recent';
  }
  appendField('Alert', alertStatus, alertClass);

  if (session.alert?.summary) {
    appendField('Alert summary', session.alert.summary);
  }
  if (session.errors?.length) {
    appendField('Errors', session.errors.join('; '));
  }

  jsonEl.textContent = JSON.stringify(session, null, 2);
  renderRsiChart(session);
  syncThresholdForm(session);
  renderStrategyTimeline(session);
  resultEl.hidden = false;

  updateMutationButtons(session.token);
}

function updateMutationButtons(token) {
  const hasToken = Boolean(String(token || '').trim());
  const signedIn = clerk ? Boolean(clerk.user) : !clerkRequired;
  const walletReady = !clerkRequired || meProfile.walletConnected;
  watchlistAddBtn.disabled = !hasToken || !signedIn;
  watchlistRemoveBtn.disabled = !hasToken || !signedIn;
  if (thresholdsSaveBtn) {
    thresholdsSaveBtn.disabled = !hasToken || !signedIn || !walletReady;
  }
  if (thresholdsForm) {
    thresholdsForm.hidden = clerkRequired && signedIn && !walletReady;
  }
  if (walletGateHintEl) {
    walletGateHintEl.hidden = !(clerkRequired && signedIn && !walletReady);
  }
}

function setAuthHint(html) {
  if (!authHintEl) {
    return;
  }
  authHintEl.innerHTML = html;
}

function updateAuthUi() {
  if (authLocalOpen) {
    authLocalOpen.hidden = clerkRequired;
  }
  if (!clerkRequired) {
    if (authSignedOut) authSignedOut.hidden = true;
    if (authSignedIn) authSignedIn.hidden = true;
    setAuthHint(
      'Session load uses open <code>GET /api/session</code>. Clerk is not configured — watchlist and threshold mutations are open in local file mode.',
    );
    updateMutationButtons(String(new FormData(form).get('token') || '').trim());
    return;
  }
  const user = clerk?.user;
  if (authSignedOut) authSignedOut.hidden = Boolean(user);
  if (authSignedIn) authSignedIn.hidden = !user;
  if (user && clerkUserEmailEl) {
    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '—';
    clerkUserEmailEl.textContent = email;
  }
  if (clerkConnectWalletBtn) {
    clerkConnectWalletBtn.hidden = !user || meProfile.walletConnected;
  }
  if (walletStatusEl) {
    if (user && meProfile.walletConnected) {
      walletStatusEl.hidden = false;
      walletStatusEl.textContent = meProfile.walletAddressTruncated
        ? `Wallet ${meProfile.walletAddressTruncated}`
        : 'Wallet connected';
      walletStatusEl.title = 'Web3 wallet linked in Clerk (paper strategy UI gate — no trading)';
    } else {
      walletStatusEl.hidden = true;
      walletStatusEl.removeAttribute('title');
    }
  }
  if (!user) {
    setAuthHint(
      'Session load uses open <code>GET /api/session</code>. Use <strong>Sign in</strong> in the top bar to change watchlist or buy/sell thresholds (stored as alert conditions).',
    );
  } else if (!meProfile.walletConnected) {
    setAuthHint(
      'Signed in. Use <strong>Connect wallet</strong> in the top bar to save RSI thresholds and view paper strategy signals (no trades are executed).',
    );
  } else {
    setAuthHint(
      'Watchlist and threshold controls are enabled for your signed-in account. Session load remains open via <code>GET /api/session</code>.',
    );
  }
  updateMutationButtons(String(new FormData(form).get('token') || '').trim());
}

async function refreshMeProfile() {
  if (!clerkRequired) {
    meProfile = { walletConnected: false, walletAddressTruncated: null };
    return meProfile;
  }
  try {
    const headers = await mutationHeaders();
    const response = await fetch('/api/me', { headers });
    if (!response.ok) {
      meProfile = { walletConnected: false, walletAddressTruncated: null };
      return meProfile;
    }
    const body = await response.json();
    meProfile = {
      walletConnected: Boolean(body.walletConnected),
      walletAddressTruncated: body.walletAddressTruncated || null,
    };
    return meProfile;
  } catch {
    meProfile = { walletConnected: false, walletAddressTruncated: null };
    return meProfile;
  }
}

async function loadClerkScript(publishableKey) {
  if (!window.Clerk) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.clerkPublishableKey = publishableKey;
      script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Clerk'));
      document.head.appendChild(script);
    });
  }
  await window.Clerk.load({ publishableKey });
  return window.Clerk;
}

async function initClerkAuth() {
  try {
    const response = await fetch('/api/auth/config');
    const config = await response.json();
    if (!config.publishableKey) {
      clerkRequired = false;
      updateAuthUi();
      return;
    }
    clerkRequired = true;
    clerk = await loadClerkScript(config.publishableKey);
    clerk.addListener(async () => {
      await refreshMeProfile();
      updateAuthUi();
      if (lastSession) {
        renderStrategyTimeline(lastSession);
      }
    });
    await refreshMeProfile();
    updateAuthUi();
  } catch (err) {
    console.error(err);
    setStatus('Could not initialize Clerk sign-in.', 'error');
  }
}

async function mutationHeaders() {
  if (!clerkRequired || !clerk) {
    return {};
  }
  const token = await clerk.session?.getToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function loadSessionFromForm() {
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

  const response = await fetch(`/api/session?${params.toString()}`, {
    headers: await mutationHeaders(),
  });
  const body = await response.json();
  if (!response.ok) {
    setStatus(body.error || `Request failed (${response.status})`, 'error');
    return null;
  }
  setStatus('');
  renderSession(body);
  return body;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await loadSessionFromForm();
  } catch (err) {
    setStatus(err.message || 'Network error', 'error');
  }
});

if (thresholdsForm) {
  thresholdsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const sessionData = new FormData(form);
    const token = String(sessionData.get('token') || '').trim();
    const timeframe = String(sessionData.get('timeframe') || '').trim();
    if (!token || !timeframe) {
      return;
    }
    if (clerkRequired && !clerk?.user) {
      openClerkSignIn();
      return;
    }
    if (clerkRequired && !meProfile.walletConnected) {
      setStatus('Connect a Web3 wallet in Clerk to save thresholds.', 'error');
      return;
    }

    const thresholdData = new FormData(thresholdsForm);
    const buyBelowRaw = String(thresholdData.get('buyBelow') || '').trim();
    const sellAboveRaw = String(thresholdData.get('sellAbove') || '').trim();

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await mutationHeaders()),
      };
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token,
          timeframe,
          buyBelow: buyBelowRaw === '' ? null : Number(buyBelowRaw),
          sellAbove: sellAboveRaw === '' ? null : Number(sellAboveRaw),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Request failed (${response.status})`);
      }
      setStatus('Thresholds saved.', '');
      if (lastSession) {
        await loadSessionFromForm();
      }
    } catch (err) {
      setStatus(err.message || 'Threshold save failed', 'error');
    }
  });
}

if (clerkSignInBtn) {
  clerkSignInBtn.addEventListener('click', () => {
    openClerkSignIn();
  });
}

if (clerkConnectWalletBtn) {
  clerkConnectWalletBtn.addEventListener('click', () => {
    openClerkUserProfile();
  });
}

if (clerkSignOutBtn) {
  clerkSignOutBtn.addEventListener('click', async () => {
    await clerk?.signOut();
    meProfile = { walletConnected: false, walletAddressTruncated: null };
    updateAuthUi();
  });
}

async function mutateWatchlist(method, tokenSymbol) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await mutationHeaders()),
  };
  const url = method === 'DELETE'
    ? `/api/watchlist/${encodeURIComponent(tokenSymbol)}`
    : '/api/watchlist';
  const init = { method, headers };
  if (method === 'POST') {
    init.body = JSON.stringify({ token: tokenSymbol });
  }
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

watchlistAddBtn.addEventListener('click', async () => {
  const token = String(new FormData(form).get('token') || '').trim();
  if (!token) {
    return;
  }
  if (clerkRequired && !clerk?.user) {
    openClerkSignIn();
    return;
  }
  try {
    await mutateWatchlist('POST', token);
    setStatus('Added to watchlist.', '');
    await loadSessionFromForm();
  } catch (err) {
    setStatus(err.message || 'Watchlist update failed', 'error');
  }
});

watchlistRemoveBtn.addEventListener('click', async () => {
  const token = String(new FormData(form).get('token') || '').trim();
  if (!token) {
    return;
  }
  if (clerkRequired && !clerk?.user) {
    openClerkSignIn();
    return;
  }
  try {
    await mutateWatchlist('DELETE', token);
    setStatus('Removed from watchlist.', '');
    await loadSessionFromForm();
  } catch (err) {
    setStatus(err.message || 'Watchlist update failed', 'error');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initL1Picker();
  initClerkAuth();
});
