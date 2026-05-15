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
};

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
  const profileName = state.desktopData?.userName || state.desktopData?.userEmail || 'Desktop workspace';
  const profileEmail = state.desktopData?.userEmail || 'Not signed in';
  const selectedChat = state.selectedChat?.chat || state.selectedChat?.data?.chat || null;
  const messages = state.selectedChat?.messages || [];
  const chatTitle = selectedChat?.title || state.desktopData?.recentChats?.find((chat) => chat.id === state.selectedChatId)?.title || 'New session';
  const chatSubtitle = signedIn
    ? `${profileName} · ${profileEmail}`
    : 'Connect your account to unlock chats, projects, and local tools.';

  appRoot.innerHTML = `
    <div class="desktop">
      <aside class="rail">
        <div class="brand-card">
          <div class="brand-row">
            <div class="brand-mark">R</div>
            <div class="brand-meta">
              <div class="brand-kicker">Desktop workspace</div>
              <div class="brand-title">Rearvy command center</div>
            </div>
          </div>
          <div class="brand-status">${escapeHtml(chatSubtitle)}</div>
        </div>

        <div class="card" style="padding:14px;">
          <div class="section-title">Primary actions</div>
          <div class="section-subtitle">Local first, bridge-aware</div>
          <div style="height:12px"></div>
          <div class="action-list">
            <button class="primary" data-action="new-session">New session</button>
            <button data-action="refresh-data">Refresh workspace</button>
            <button data-action="check-updates">Check updates</button>
            <button data-action="open-terminal">Open terminal</button>
          </div>
        </div>

        <div class="card" style="padding:14px; min-height:0;">
          <div class="list-head">
            <div>
              <div class="list-title">Recent chats</div>
              <div class="section-subtitle">Jump back in</div>
            </div>
            <span class="pill">${escapeHtml(String(state.desktopData?.recentChats?.length || 0))}</span>
          </div>
          <div style="height:10px"></div>
          <div class="list-scroll" style="max-height: 18rem;">${renderRecentChats()}</div>
        </div>

        <div class="card" style="padding:14px; min-height:0;">
          <div class="list-head">
            <div>
              <div class="list-title">Projects</div>
              <div class="section-subtitle">Active workspaces</div>
            </div>
          </div>
          <div style="height:10px"></div>
          <div class="list-scroll" style="max-height: 12rem;">${renderProjects()}</div>
        </div>

        <div class="card" style="padding:14px;">
          <div class="section-title">Desktop sign-in</div>
          <div class="section-subtitle">Use your browser to authenticate and return to the app.</div>
          <div style="height:12px"></div>
          <div class="action-list">
            <button class="primary" data-action="open-signin">Open sign-in</button>
            <button data-action="clear-auth">Sign out</button>
          </div>
          <div style="height:10px"></div>
          <div class="small">${escapeHtml(state.signInMessage || state.signInError || '')}</div>
        </div>
      </aside>

      <main class="workspace">
        <div class="workspace-header">
          <div>
            <h1 class="workspace-title">${escapeHtml(chatTitle)}</h1>
            <div class="workspace-caption">${escapeHtml(chatSubtitle)}</div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
            <span class="pill">App ${escapeHtml(String(state.capabilities?.appVersion || 'n/a'))}</span>
            <span class="pill">Bridge ${escapeHtml(String(state.capabilities?.bridgeVersion || 'n/a'))}</span>
            <span class="pill">API ${escapeHtml(String(state.apiPort || 'n/a'))}</span>
          </div>
        </div>

        <div class="workspace-grid">
          <section class="card chat-panel">
            <div class="chat-toolbar">
              <div>
                <div class="section-title">Assistant workspace</div>
                <div class="section-subtitle">Native desktop shell with local data, tools, and chat history.</div>
              </div>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="secondary-button" data-action="load-selected-chat">Load chat</button>
                <button class="secondary-button" data-action="open-terminal">Terminal</button>
              </div>
            </div>

            <div class="chat-log">
              ${state.selectedChatLoading ? '<div class="chat-empty">Loading chat…</div>' : ''}
              ${state.selectedChatError ? `<div class="notice">${escapeHtml(state.selectedChatError)}</div>` : ''}
              ${!state.selectedChatLoading && !state.selectedChatError ? renderChatMessages(messages) : ''}
            </div>

            <div class="composer">
              <div class="notice">
                This native renderer is now separate from the website shell. Recent chats load from the local bridge, and sign-in stays in your browser.
              </div>
              <div class="composer-row">
                <input id="quick-note" type="text" placeholder="Type a local note for this workspace" value="${escapeHtml(state.workspaceNote)}" />
                <button class="primary-button" data-action="save-note">Save note</button>
              </div>
            </div>
          </section>

          <section class="terminal-card">
            <div class="terminal-head">
              <div>
                <div class="terminal-title">Local terminal</div>
                <div class="section-subtitle">Runs through the existing bridge</div>
              </div>
              <span class="pill">${escapeHtml(state.terminalStatus)}</span>
            </div>
            <div class="terminal-body log-scroll">${renderTerminalLogs()}</div>
            <form class="terminal-form" id="terminal-form">
              <input id="terminal-command" type="text" placeholder="powershell.exe -Command ..." autocomplete="off" />
              <button class="primary-button" type="submit">Run</button>
            </form>
          </section>
        </div>
      </main>

      <aside class="status">
        ${renderStatusPanels()}
      </aside>
    </div>
  `;

  const quickNoteInput = document.getElementById('quick-note');
  if (quickNoteInput) {
    quickNoteInput.value = state.workspaceNote;
    quickNoteInput.addEventListener('input', (event) => {
      state.workspaceNote = event.target.value;
    });
  }

  const terminalInput = document.getElementById('terminal-command');
  if (terminalInput) {
    terminalInput.addEventListener('input', (event) => {
      state.terminalInput = event.target.value;
    });
  }

  const terminalForm = document.getElementById('terminal-form');
  if (terminalForm) {
    terminalForm.addEventListener('submit', runTerminalCommand);
  }

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const action = event.currentTarget.getAttribute('data-action');
      const chatId = event.currentTarget.getAttribute('data-chat-id');

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
      } else if (action === 'refresh-data') {
        await loadDesktopData();
      } else if (action === 'check-updates') {
        await checkForUpdates();
      } else if (action === 'open-terminal') {
        if (window.electron?.terminal?.openExternal) {
          await window.electron.terminal.openExternal(state.terminalWorkingDirectory || undefined);
        }
      } else if (action === 'save-note') {
        state.workspaceNote = (document.getElementById('quick-note')?.value || '').trim();
        state.signInMessage = state.workspaceNote ? `Saved note: ${state.workspaceNote}` : 'Note cleared.';
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

  if (quickNoteInput) {
    quickNoteInput.focus({ preventScroll: true });
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
