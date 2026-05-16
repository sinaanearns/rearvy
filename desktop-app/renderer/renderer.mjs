const appRoot = document.getElementById('app');

const state = {
  ready: false,
  authToken: localStorage.getItem('rearvy.desktop.native.auth') || '',
  apiPort: null,
  capabilities: null,
  updateState: null,
  automationState: null,
  clickyStatus: 'checking',
  desktopData: null,
  selectedChatId: null,
  selectedChat: null,
  selectedChatLoading: false,
  selectedChatError: '',
  terminalLogs: [],
  terminalInput: '',
  terminalWorkingDirectory: '',
  terminalStatus: 'idle',
  signInMessage: '',
  signInError: '',
  openPathNotice: '',
  workspaceNote: '',
  composerText: '',
};

const starterPrompts = [
  {
    icon: '⌕',
    label: 'Research with sources',
    prompt: 'Research our competitors on the web and cite the sources you use.',
    description: 'Research our competitors on the web and cite the sources you use.',
  },
  {
    icon: '₹',
    label: 'Monthly collections',
    prompt: 'How much did we do this month? Show Shopify and Razorpay separately.',
    description: 'How much did we do this month? Show Shopify and Razorpay separately.',
  },
  {
    icon: '◫',
    label: 'Shopify vs UPI',
    prompt: 'Break this month into Shopify vs UPI.',
    description: 'Break this month into Shopify vs UPI.',
  },
  {
    icon: '▥',
    label: 'Payment method mix',
    prompt: 'Which Razorpay payment method brought the most money this month?',
    description: 'Which Razorpay payment method brought the most money this month?',
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(value) {
  if (!value) {
    return 'recent';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'recent';
  }

  const deltaMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (deltaMinutes < 1) return 'just now';
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function toText(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return '';
}

function messageContent(message) {
  return toText(message?.content)
    || (Array.isArray(message?.parts)
      ? message.parts
          .map((part) => toText(part?.text || part?.content || ''))
          .filter(Boolean)
          .join('\n')
      : '');
}

function setTerminalNotice(text) {
  state.openPathNotice = text;
  render();
}

async function getApiPort() {
  if (state.apiPort) {
    return state.apiPort;
  }

  if (!window.electron?.localApiPort) {
    state.apiPort = 4000;
    return state.apiPort;
  }

  try {
    const port = await window.electron.localApiPort();
    state.apiPort = Number(port) || 4000;
  } catch {
    state.apiPort = 4000;
  }

  return state.apiPort;
}

async function apiFetch(pathname, init = {}) {
  const port = await getApiPort();
  const headers = new Headers(init.headers || {});

  if (state.authToken) {
    headers.set('Authorization', `Bearer ${state.authToken}`);
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`http://localhost:${port}${pathname}`, {
    ...init,
    headers,
    credentials: 'include',
  });
}

async function refreshCapabilities() {
  if (!window.electron?.getCapabilities) {
    state.capabilities = {
      appVersion: 'n/a',
      bridgeVersion: 'unavailable',
      rendererBridgeVersion: 'unavailable',
      localApi: { available: false, port: null },
      terminal: false,
      automation: false,
      clicky: false,
      error: 'Electron bridge unavailable',
    };
    render();
    return;
  }

  try {
    state.capabilities = await window.electron.getCapabilities();
  } catch (error) {
    state.capabilities = {
      appVersion: 'n/a',
      bridgeVersion: 'error',
      rendererBridgeVersion: 'error',
      localApi: { available: false, port: null },
      terminal: false,
      automation: false,
      clicky: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  state.apiPort = state.capabilities?.localApi?.port ?? state.apiPort;
  render();
}

async function loadDesktopData() {
  if (!state.authToken) {
    state.desktopData = null;
    state.selectedChat = null;
    state.selectedChatId = null;
    render();
    return;
  }

  try {
    const response = await apiFetch('/api/dashboard/data');
    if (!response.ok) {
      throw new Error(`Failed to load desktop data (${response.status})`);
    }

    const data = await response.json();
    state.desktopData = data;
    state.signInError = '';

    if (!state.selectedChatId && Array.isArray(data.recentChats) && data.recentChats.length > 0) {
      await loadChat(data.recentChats[0].id);
    }
  } catch (error) {
    state.desktopData = null;
    state.signInError = error instanceof Error ? error.message : String(error);
  }

  render();
}

async function loadChat(chatId) {
  if (!state.authToken || !chatId) {
    return;
  }

  state.selectedChatLoading = true;
  state.selectedChatError = '';
  state.selectedChatId = chatId;
  render();

  try {
    const response = await apiFetch(`/api/dashboard/chats/${chatId}`);
    if (!response.ok) {
      throw new Error(`Failed to load chat (${response.status})`);
    }

    const data = await response.json();
    state.selectedChat = data;
  } catch (error) {
    state.selectedChat = null;
    state.selectedChatError = error instanceof Error ? error.message : String(error);
  } finally {
    state.selectedChatLoading = false;
    render();
  }
}

function saveAuthToken(token) {
  state.authToken = token;
  if (token) {
    localStorage.setItem('rearvy.desktop.native.auth', token);
  } else {
    localStorage.removeItem('rearvy.desktop.native.auth');
  }
}

async function handleAuthCredential(credential) {
  const token = credential?.idToken || credential?.accessToken || '';
  if (!token) {
    return;
  }

  saveAuthToken(token);
  state.signInMessage = 'Signed in. Syncing workspace...';
  state.signInError = '';
  render();
  await loadDesktopData();
}

async function openDesktopSignin() {
  const url = 'https://www.rearvy.com/auth/desktop-signin';
  if (window.electron?.system?.openExternal) {
    await window.electron.system.openExternal(url);
    state.signInMessage = 'Desktop sign-in opened in your browser.';
    render();
    return;
  }

  window.open(url, '_blank');
}

async function handleNewSession() {
  state.selectedChatId = null;
  state.selectedChat = null;
  state.selectedChatError = '';
  state.signInMessage = 'Fresh session ready.';
  render();
}

async function checkForUpdates() {
  if (!window.electron?.updater?.checkForUpdates) {
    return;
  }

  await window.electron.updater.checkForUpdates();
}

async function downloadUpdate() {
  if (!window.electron?.updater?.downloadUpdate) {
    return;
  }

  await window.electron.updater.downloadUpdate();
}

async function installUpdate() {
  if (!window.electron?.updater?.installAndRestart) {
    return;
  }

  await window.electron.updater.installAndRestart();
}

function appendTerminalLog(type, data) {
  state.terminalLogs = [...state.terminalLogs.slice(-199), {
    type,
    data,
    timestamp: Date.now(),
  }];
  render();
}

function syncWorkspaceSummary() {
  const profileName = state.desktopData?.userName || state.desktopData?.userEmail || 'Signed in';
  document.title = `Rearvy Desktop · ${profileName}`;
}

async function runTerminalCommand(event) {
  event.preventDefault();
  const command = state.terminalInput.trim();
  if (!command || !window.electron?.terminal?.runCommand) {
    return;
  }

  const workingDirectory = state.terminalWorkingDirectory || undefined;
  appendTerminalLog('system', `> ${command}`);
  state.terminalStatus = 'starting';
  state.terminalInput = '';
  render();

  try {
    const response = await window.electron.terminal.runCommand({ command, cwd: workingDirectory });
    if (!response.success) {
      state.terminalStatus = 'error';
      appendTerminalLog('error', response.error || 'Command failed to start');
      return;
    }

    state.terminalStatus = 'running';
    appendTerminalLog('system', `Process ${response.processId} started`);
  } catch (error) {
    state.terminalStatus = 'error';
    appendTerminalLog('error', error instanceof Error ? error.message : String(error));
  }
}

function renderChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '<div class="chat-empty">No messages loaded yet. Pick a recent chat or start a fresh session.</div>';
  }

  return messages
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant' || message.role === 'system'))
    .map((message) => {
      const role = message.role || 'system';
      const content = escapeHtml(messageContent(message) || '(empty message)').replace(/\n/g, '<br />');
      const createdAt = formatTime(message.created_at || message.updated_at || message.timestamp);
      return `
        <article class="message ${role}">
          <div class="message-meta">
            <span class="message-role">${escapeHtml(role)}</span>
            <span>${escapeHtml(createdAt)}</span>
          </div>
          <div class="message-content">${content}</div>
        </article>
      `;
    })
    .join('');
}

function renderRecentChats() {
  const recentChats = state.desktopData?.recentChats || [];

  if (!recentChats.length) {
    return '<div class="notice">No recent chats are available yet.</div>';
  }

  return recentChats
    .slice(0, 10)
    .map((chat) => {
      const selected = chat.id === state.selectedChatId ? 'selected' : '';
      return `
        <button class="list-item ${selected}" data-action="select-chat" data-chat-id="${escapeHtml(chat.id)}">
          <div>
            <div class="item-title">${escapeHtml(chat.title || 'Untitled chat')}</div>
            <div class="item-subtitle">${escapeHtml(chat.id.slice(0, 8))} · ${escapeHtml(formatTime(chat.updated_at))}</div>
          </div>
        </button>
      `;
    })
    .join('');
}

function renderProjects() {
  const projects = state.desktopData?.projects || [];

  if (!projects.length) {
    return '<div class="notice">Projects will appear here after the desktop profile loads.</div>';
  }

  return projects
    .slice(0, 5)
    .map((project) => `
      <div class="project-item">
        <div class="item-title">${escapeHtml(project.name || 'Untitled project')}</div>
        <div class="item-subtitle">Project workspace</div>
      </div>
    `)
    .join('');
}

function renderStarterPrompts() {
  return starterPrompts
    .map((template) => `
      <button class="starter-card" data-action="pick-prompt" data-prompt="${escapeHtml(template.prompt)}">
        <div class="starter-card-top">
          <div class="starter-icon">${escapeHtml(template.icon)}</div>
          <div class="starter-label">${escapeHtml(template.label)}</div>
        </div>
        <div class="starter-description">${escapeHtml(template.description)}</div>
      </button>
    `)
    .join('');
}

function renderSidebarStatus() {
  const bridgeVersion = escapeHtml(String(state.capabilities?.bridgeVersion || 'Bridge unknown'));
  const appVersion = escapeHtml(String(state.capabilities?.appVersion || 'App 0.1.2'));
  const apiPort = escapeHtml(String(state.apiPort || '4000'));

  return `
    <div class="sidebar-status-card">
      <div class="sidebar-status-title">Bridge health</div>
      <div class="sidebar-status-value">Runtime ${escapeHtml(window.electron ? 'Electron' : 'Browser')}</div>
      <div class="sidebar-status-sub">Bridge ${bridgeVersion}</div>
      <div class="sidebar-status-sub">API ${apiPort}</div>
      <div class="sidebar-status-sub">App ${appVersion}</div>
    </div>
  `;
}

function renderFloatingBridgeCard() {
  const clickyStatus = escapeHtml(String(state.clickyStatus || 'Ready'));
  const bridgeVersion = escapeHtml(String(state.capabilities?.bridgeVersion || 'Bridge unknown'));
  const appVersion = escapeHtml(String(state.capabilities?.appVersion || 'App 0.1.2'));

  return `
    <div class="floating-bridge-card">
      <div class="floating-bridge-kicker">CLICKY</div>
      <div class="floating-bridge-status">${clickyStatus}</div>
      <div class="floating-bridge-meta">Bridge ${bridgeVersion} · ${appVersion}</div>
    </div>
  `;
}

function renderTerminalLogs() {
  if (!state.terminalLogs.length) {
    return '<div class="log-entry">No terminal activity yet.</div>';
  }

  return state.terminalLogs
    .map((entry) => `
      <div class="log-entry ${escapeHtml(entry.type)}">
        <strong>[${new Date(entry.timestamp).toLocaleTimeString()}]</strong> ${escapeHtml(entry.data)}
      </div>
    `)
    .join('');
}

function statusRow(label, value, tone = '') {
  const valueClass = tone ? ` ${tone}` : '';
  return `
    <div class="status-row">
      <div class="small">${escapeHtml(label)}</div>
      <div class="item-title${valueClass}">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderStatusPanels() {
  const caps = state.capabilities || {};
  const updateState = state.updateState || {};
  const currentVersion = updateState.currentVersion || caps.appVersion || 'n/a';
  const latestVersion = updateState.latestVersion || 'n/a';
  const bridge = caps.bridgeVersion || 'unavailable';
  const localApiPort = caps.localApi?.port ?? state.apiPort ?? 'n/a';
  const updateLabel = updateState.downloaded ? 'Downloaded' : updateState.downloading ? 'Downloading' : updateState.updateAvailable ? 'Available' : 'Idle';

  return `
    <div class="card">
      <div class="panel-header">
        <div>
          <div class="section-title">Bridge health</div>
          <div class="section-subtitle">Runtime and local bridge status</div>
        </div>
        <span class="pill dot">${escapeHtml(window.electron ? 'Electron' : 'Browser')}</span>
      </div>
      <div class="status-list">
        ${statusRow('Runtime', window.electron ? 'Electron' : 'Browser')}
        ${statusRow('Bridge', bridge)}
        ${statusRow('Local API', String(localApiPort))}
        ${statusRow('Terminal', caps.terminal ? 'Ready' : 'Unavailable')}
        ${statusRow('Clicky', caps.clicky ? String(state.clickyStatus) : 'Unavailable')}
      </div>
    </div>

    <div class="card">
      <div class="panel-header">
        <div>
          <div class="section-title">Automation</div>
          <div class="section-subtitle">Workflow bridge state</div>
        </div>
        <span class="pill">${escapeHtml(state.automationState?.state || 'idle')}</span>
      </div>
      <div class="mini-grid">
        <div class="mini-card">
          <div class="kicker">Renderer bridge</div>
          <div class="value">${escapeHtml(caps.rendererBridgeVersion || 'n/a')}</div>
        </div>
        <div class="mini-card">
          <div class="kicker">Current user</div>
          <div class="value">${escapeHtml(state.desktopData?.userEmail || state.desktopData?.userName || 'Signed in')}</div>
        </div>
      </div>
      <div style="height:10px"></div>
      <div class="status-list">
        ${statusRow('State', state.automationState?.state || 'Unavailable')}
        ${statusRow('Current step', state.automationState?.currentStep || 'n/a')}
        ${statusRow('Latest update', updateLabel)}
      </div>
    </div>

    <div class="card">
      <div class="panel-header">
        <div>
          <div class="section-title">Updates</div>
          <div class="section-subtitle">Keep the app current</div>
        </div>
        <span class="pill">${escapeHtml(currentVersion)}</span>
      </div>
      <div class="status-list">
        ${statusRow('Current', String(currentVersion))}
        ${statusRow('Latest', String(latestVersion))}
        ${statusRow('State', updateLabel)}
      </div>
    </div>

    <div class="card">
      <div class="panel-header">
        <div>
          <div class="section-title">Clicky</div>
          <div class="section-subtitle">Mouse assistant status</div>
        </div>
        <span class="pill">${escapeHtml(state.clickyStatus)}</span>
      </div>
      <div class="status-list">
        ${statusRow('Status', String(state.clickyStatus))}
        ${statusRow('Open path', state.terminalWorkingDirectory || 'No file open')}
      </div>
    </div>
  `;
}

function render() {
  syncWorkspaceSummary();

  const signedIn = Boolean(state.authToken);
  const profileName = state.desktopData?.userName || state.desktopData?.userEmail || 'muhammed sinaan';
  const profileEmail = state.desktopData?.userEmail || 'mutalvita@gmail.com';
  const recentChatCount = String(state.desktopData?.recentChats?.length || 0);
  const projectCount = String(state.desktopData?.projects?.length || 0);

  appRoot.innerHTML = `
    <div class="desktop-app">
      <aside class="app-sidebar">
        <div class="sidebar-brand-card">
          <div class="sidebar-brand">Rearvy</div>
          <div class="sidebar-brand-sub">Desktop workspace</div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-title">Menu</div>
          <div class="sidebar-nav">
            <button class="sidebar-nav-item active" data-action="new-session"><span class="sidebar-nav-icon">⋯</span> Insights</button>
            <button class="sidebar-nav-item"><span class="sidebar-nav-icon">◔</span> Integrations</button>
            <button class="sidebar-nav-item"><span class="sidebar-nav-icon">⌁</span> Terminal</button>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-title">Projects</div>
          <button class="sidebar-link-button">+ New project</button>
        </div>

        <div class="sidebar-section grow">
          <div class="sidebar-section-header">
            <div>
              <div class="sidebar-section-title">Your chats</div>
            </div>
            <span class="sidebar-count">${escapeHtml(recentChatCount)}</span>
          </div>
          <div class="sidebar-list">${renderRecentChats()}</div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-feedback-card">
            <div class="sidebar-section-title">Feedback</div>
            <div class="sidebar-feedback-text">Tell us about bugs or features on a dedicated page.</div>
            <button class="sidebar-feedback-button">Open feedback page</button>
          </div>
        </div>

        <div class="sidebar-user-card">
          <div class="sidebar-user-avatar">${escapeHtml(profileName.slice(0, 2).toUpperCase())}</div>
          <div class="sidebar-user-meta">
            <div class="sidebar-user-name">${escapeHtml(profileName)}</div>
            <div class="sidebar-user-email">${escapeHtml(profileEmail)}</div>
          </div>
        </div>
      </aside>

      <div class="app-main">
        <header class="app-topbar">
          <div class="app-topbar-left">
            <button class="topbar-icon-button" data-action="new-session">☰</button>
            <button class="topbar-new-chat" data-action="new-session">+ New Chat</button>
          </div>
          <div class="app-topbar-right">
            <button class="topbar-icon-button">◔</button>
            <button class="topbar-icon-button">▣</button>
            <button class="topbar-avatar">${escapeHtml(profileName.slice(0, 2).toUpperCase())}</button>
          </div>
        </header>

        <div class="app-banner">
          <span><strong>Unlock full Rearvy features:</strong> Terminal, AI automation, and device access are available in the desktop app.</span>
          <button data-action="open-signin">Download desktop app</button>
        </div>

        <main class="app-hero-shell">
          <section class="app-hero">
            <h1>What can I help with?</h1>
            <p>Pick a repeat agency job or start with a specialized prompt.</p>

            <div class="app-starter-section">
              <div class="app-starter-kicker">Starter prompts</div>
              <div class="app-starter-subtitle">Try one of these specialized analytics prompts.</div>
            </div>

            <div class="starter-grid">
              ${renderStarterPrompts()}
            </div>
          </section>
        </main>

        <footer class="app-composer">
          <button class="composer-icon-button" aria-label="Add files">+</button>
          <button class="composer-icon-button" aria-label="Voice input">◌</button>
          <button class="composer-icon-button" aria-label="Tools">⌘</button>
          <input id="composer-input" type="text" placeholder="Type a message, use + for files, or / for commands" value="${escapeHtml(state.composerText)}" />
          <button class="composer-send-button" data-action="send-message">↑</button>
        </footer>
      </div>

      ${renderFloatingBridgeCard()}
    </div>
  `;

  const composerInput = document.getElementById('composer-input');
  if (composerInput) {
    composerInput.value = state.composerText;
    composerInput.addEventListener('input', (event) => {
      state.composerText = event.target.value;
    });
  }

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const action = event.currentTarget.getAttribute('data-action');
      const chatId = event.currentTarget.getAttribute('data-chat-id');
      const promptText = event.currentTarget.getAttribute('data-prompt');

      if (action === 'open-signin') {
        await openDesktopSignin();
      } else if (action === 'clear-auth') {
        saveAuthToken('');
        state.desktopData = null;
        state.selectedChat = null;
        state.selectedChatId = null;
        render();
      } else if (action === 'new-session') {
        await handleNewSession();
      } else if (action === 'send-message') {
        state.signInMessage = state.composerText.trim()
          ? `Composer ready: ${state.composerText.trim()}`
          : 'Composer ready.';
        state.composerText = '';
        render();
      } else if (action === 'refresh-data') {
        await loadDesktopData();
      } else if (action === 'check-updates') {
        await checkForUpdates();
      } else if (action === 'open-terminal') {
        if (window.electron?.terminal?.openExternal) {
          await window.electron.terminal.openExternal(state.terminalWorkingDirectory || undefined);
        }
      } else if (action === 'pick-prompt' && promptText) {
        state.composerText = promptText;
        state.signInMessage = 'Prompt loaded into the composer.';
        render();
      } else if (action === 'select-chat' || chatId) {
        const resolvedChatId = chatId || (action === 'select-chat'
          ? event.currentTarget.getAttribute('data-chat-id')
          : null);
        if (resolvedChatId) {
          await loadChat(resolvedChatId);
        }
      } else if (action === 'load-selected-chat') {
        if (state.selectedChatId) {
          await loadChat(state.selectedChatId);
        }
      }
    });
  });

  if (composerInput) {
    composerInput.focus({ preventScroll: true });
  }
}

function registerBridgeListeners() {
  window.electron?.onAuthCredential?.((credential) => {
    void handleAuthCredential(credential);
  });

  window.electron?.onAuthToken?.((token) => {
    void handleAuthCredential({ idToken: token });
  });

  window.electron?.onLocalApiPort?.((port) => {
    state.apiPort = Number(port) || 4000;
    render();
  });

  window.electron?.onOpenPath?.((payload) => {
    state.terminalWorkingDirectory = payload.cwd || '';
    setTerminalNotice(`Opened ${payload.kind}: ${payload.path}`);
    appendTerminalLog('system', `Opened ${payload.kind}: ${payload.path}\nWorking directory: ${payload.cwd}`);
  });

  window.electron?.updater?.onStateChange?.((updateState) => {
    state.updateState = updateState || null;
    render();
  });

  window.electron?.automation?.onStateChange?.((workflowState) => {
    state.automationState = workflowState || null;
    render();
  });

  window.electron?.clicky?.onStatus?.((status) => {
    state.clickyStatus = typeof status === 'string' ? status : JSON.stringify(status);
    render();
  });

  window.electron?.terminal?.onOutput?.((output) => {
    appendTerminalLog(output.type || 'stdout', output.data || '');
  });

  window.electron?.terminal?.onStatusChange?.((status) => {
    state.terminalStatus = status?.status || 'idle';
    if (status?.status === 'stopped') {
      appendTerminalLog('system', `Process exited with code ${status.code ?? 'unknown'}`);
    }
    render();
  });
}

async function bootstrap() {
  registerBridgeListeners();
  await refreshCapabilities();

  if (state.authToken) {
    state.signInMessage = 'Restored desktop sign-in.';
    await loadDesktopData();
  }

  state.ready = true;
  render();
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap native renderer:', error);
  appRoot.innerHTML = `<div class="boot-screen"><div class="boot-card"><div class="boot-mark">!</div><div><div class="boot-label">Rearvy Desktop failed to load</div><div class="boot-subtitle">${escapeHtml(error instanceof Error ? error.message : String(error))}</div></div></div></div>`;
});
