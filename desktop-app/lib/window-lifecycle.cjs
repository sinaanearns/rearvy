function registerGlobalWindowShortcuts(app) {
  app.on("browser-window-created", (_event, window) => {
    window.webContents.on("before-input-event", (inputEvent, input) => {
      if (input.type === "keyDown" && input.key === "F12") {
        window.webContents.toggleDevTools();
        inputEvent.preventDefault();
      }

      if (input.type === "keyDown" && input.control && input.shift && input.key.toLowerCase() === "i") {
        window.webContents.toggleDevTools();
        inputEvent.preventDefault();
      }

      if (input.type === "keyDown" && input.control && input.key.toLowerCase() === "r") {
        window.webContents.reload();
        inputEvent.preventDefault();
      }
    });
  });
}

module.exports = {
  registerGlobalWindowShortcuts,
};
