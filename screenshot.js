const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Wait for 3D elements to render
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'dotted-surface-screenshot.png' });
    await browser.close();
    console.log('Screenshot saved to dotted-surface-screenshot.png');
})();
