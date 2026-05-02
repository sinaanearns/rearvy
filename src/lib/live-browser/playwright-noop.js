// No-op implementation of playwright for Vercel/Web environments 
// where browser automation is disabled or handled differently.
module.exports = {
  chromium: {
    launch: async () => {
      console.warn("Playwright chromium.launch is a no-op in this environment.");
      return {
        newContext: async () => ({
          newPage: async () => ({
            goto: async () => {},
            close: async () => {},
          }),
          close: async () => {},
        }),
        close: async () => {},
      };
    },
  },
  firefox: {
    launch: async () => {
      console.warn("Playwright firefox.launch is a no-op in this environment.");
      return {};
    },
  },
  webkit: {
    launch: async () => {
      console.warn("Playwright webkit.launch is a no-op in this environment.");
      return {};
    },
  },
};
