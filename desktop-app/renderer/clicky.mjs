const statusNode = document.getElementById('clicky-status');
const subtitleNode = document.getElementById('clicky-subtitle');

function updateStatus(text) {
  if (statusNode) {
    statusNode.textContent = text;
  }
}

function updateSubtitle(text) {
  if (subtitleNode) {
    subtitleNode.textContent = text;
  }
}

updateStatus('Ready');
updateSubtitle('Waiting for Clicky commands and status updates');

window.electron?.clicky?.onStatus?.((status) => {
  const normalized = typeof status === 'string' ? status : JSON.stringify(status);
  updateStatus(normalized);
  updateSubtitle('Clicky bridge connected');
});

window.electron?.getCapabilities?.()
  .then((caps) => {
    if (caps?.clicky) {
      updateSubtitle(`Bridge ${caps.bridgeVersion || 'connected'} · App ${caps.appVersion || 'n/a'}`);
    } else {
      updateSubtitle('Clicky bridge unavailable');
    }
  })
  .catch(() => {
    updateSubtitle('Clicky bridge unavailable');
  });
