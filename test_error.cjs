const puppeteer = require('puppeteer-core');

(async () => {
  console.log("Launching browser...");
  // Launch a new Chrome instance
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  
  const page = await browser.newPage();
  
  page.on('pageerror', (err) => {
    console.log("PAGE ERROR:", err.toString());
  });
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    console.log("Navigating to http://localhost:3000...");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Check if there's any error immediately
    console.log("Waiting a bit...");
    await new Promise(r => setTimeout(r, 2000));
    
    // Find the Add Link button (typically inside a category or somewhere)
    // Actually, on initial load, do we get Error 310?
    // Let's click the Add Link button if it exists
    const btn = await page.$('button.add-link');
    if (btn) {
      console.log("Clicking Add Link...");
      await btn.click();
      await new Promise(r => setTimeout(r, 1000));
    } else {
      console.log("Could not find Add Link button. Looking for '+' button");
      // Try to click any button containing '+'
      const buttons = await page.$$('button');
      for (let b of buttons) {
        const text = await b.evaluate(el => el.textContent);
        if (text && text.includes('+')) {
          await b.click();
          await new Promise(r => setTimeout(r, 1000));
          break;
        }
      }
    }
    
    console.log("Done checking for errors.");
  } catch (err) {
    console.error("Puppeteer error:", err);
  } finally {
    await browser.close();
  }
})();
