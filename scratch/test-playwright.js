const { chromium } = require('playwright');

(async () => {
  try {
    console.log('Attempting to launch Chromium...');
    const browser = await chromium.launch({ headless: true });
    console.log('Chromium launched successfully!');
    const page = await browser.newPage();
    await page.goto('https://example.com');
    console.log('Page title:', await page.title());
    await browser.close();
    console.log('Browser closed.');
  } catch (error) {
    console.error('Failed to launch Chromium:', error);
  }
})();
