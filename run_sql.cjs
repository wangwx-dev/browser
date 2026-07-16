const puppeteer = require('puppeteer-core');

(async () => {
  let browser;
  try {
    console.log("Connecting to Chrome on port 9222...");
    browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  } catch (err) {
    console.error("Failed to connect to Chrome. Make sure Chrome is running with --remote-debugging-port=9222");
    process.exit(1);
  }

  try {
    console.log("Opening new tab to Supabase SQL Editor...");
    const page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto('https://supabase.com/dashboard/project/getofgqtvxcqhaprsrze/sql/new', { waitUntil: 'networkidle2' });
    
    console.log("Waiting for Monaco editor to load...");
    // Wait for the monaco editor or the run button
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    
    console.log("Injecting SQL into the editor...");
    
    const sql = `
-- 1. 创建导航数据表
CREATE TABLE IF NOT EXISTS user_nav_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  nav_data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 开启行级安全 (Row Level Security)，极其重要！
ALTER TABLE user_nav_configs ENABLE ROW LEVEL SECURITY;

-- 3. 制定安全策略
DROP POLICY IF EXISTS "用户只能看自己的数据" ON user_nav_configs;
CREATE POLICY "用户只能看自己的数据" 
  ON user_nav_configs FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户只能插入自己的数据" ON user_nav_configs;
CREATE POLICY "用户只能插入自己的数据" 
  ON user_nav_configs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户只能更新自己的数据" ON user_nav_configs;
CREATE POLICY "用户只能更新自己的数据" 
  ON user_nav_configs FOR UPDATE 
  USING (auth.uid() = user_id);
    `;

    // Instead of typing, we can execute script in the page context to set the Monaco editor value
    // Supabase uses Monaco editor, which exposes the monaco instance globally sometimes, or we can just find the model
    const success = await page.evaluate((sqlText) => {
      // @ts-ignore
      if (window.monaco) {
        // @ts-ignore
        const models = window.monaco.editor.getModels();
        if (models.length > 0) {
          models[0].setValue(sqlText);
          return true;
        }
      }
      return false;
    }, sql);

    if (!success) {
      console.log("Could not find global monaco object, falling back to clipboard paste...");
      // Click inside the editor
      await page.click('.monaco-editor');
      // Select all and delete
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      
      // We can't write to clipboard easily in headless/remote without permissions, so let's use page.evaluate to create a textarea, paste it, and trigger input? No, monaco doesn't like that.
      // Let's just type it out!
      await page.keyboard.type(sql, { delay: 2 });
    }

    console.log("Clicking the RUN button...");
    // The RUN button in Supabase SQL editor is usually a button with text "Run" or a specific class
    // We'll look for a button containing the text "Run" or "RUN"
    const runButtonSelectors = [
      'button:has-text("Run")',
      'button:has-text("RUN")',
      '//button[contains(., "Run")]',
      '//button[contains(., "RUN")]'
    ];
    
    let clicked = false;
    for (const sel of runButtonSelectors) {
      try {
        if (sel.startsWith('//')) {
          const elements = await page.$x(sel);
          if (elements.length > 0) {
            await elements[0].click();
            clicked = true;
            break;
          }
        } else {
          // Playwright supports :has-text, Puppeteer might not. Let's use evaluate.
        }
      } catch (e) {}
    }
    
    if (!clicked) {
      // Fallback: evaluate and click
      clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const runBtn = buttons.find(b => b.textContent && b.textContent.trim().toLowerCase() === 'run');
        if (runBtn) {
          runBtn.click();
          return true;
        }
        return false;
      });
    }

    if (clicked) {
      console.log("SQL execution triggered successfully!");
      // Wait a moment for the query to run
      await new Promise(r => setTimeout(r, 3000));
      console.log("Done.");
    } else {
      console.log("Could not find the RUN button. Please click it manually in the browser.");
    }
    
  } catch (err) {
    console.error("Error during automation:", err);
  } finally {
    browser.disconnect();
  }
})();
