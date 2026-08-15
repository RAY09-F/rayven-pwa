const BACKEND_URL = "https://rayven-backend.rayanfahil2.workers.dev";

chrome.alarms.create('rayvenPoll', { periodInMinutes: 0.1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'rayvenPoll') pollOnce();
});

pollOnce();

async function pollOnce() {
  try {
    const res = await fetch(`${BACKEND_URL}/browser/poll`);
    const data = await res.json();
    if (data.command) await handleCommand(data.command);
  } catch (e) { console.error('Poll failed', e); }
}

async function reportResult(id, success, resultData) {
  try {
    await fetch(`${BACKEND_URL}/browser/result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, success, data: resultData })
    });
  } catch (e) { console.error('Report failed', e); }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---- chrome.debugger helpers, used for exact-coordinate click/type ----

function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || '';
        if (msg.includes('already attached')) return resolve();
        return reject(new Error(msg));
      }
      resolve();
    });
  });
}

function detachDebugger(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => resolve());
  });
}

function sendDebuggerCommand(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (result) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(result);
    });
  });
}

async function getDevicePixelRatio(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.devicePixelRatio || 1
  });
  return result || 1;
}

async function dispatchClick(tabId, cssX, cssY) {
  await sendDebuggerCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed', x: cssX, y: cssY, button: 'left', clickCount: 1
  });
  await sendDebuggerCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: cssX, y: cssY, button: 'left', clickCount: 1
  });
}

async function dispatchType(tabId, text) {
  for (const char of text) {
    await sendDebuggerCommand(tabId, 'Input.dispatchKeyEvent', { type: 'char', text: char });
  }
}

async function handleCommand(cmd) {
  const { id, action, params } = cmd;
  try {
    if (action === 'navigate') {
      await chrome.tabs.create({ url: params.url });
      await reportResult(id, true, `Opened ${params.url} in a new tab.`);
    } else if (action === 'click') {
      const tab = await getActiveTab();
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          const all = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]'));
          const match = all.find(el => el.innerText && el.innerText.trim().toLowerCase().includes(text.toLowerCase()));
          if (match) { match.click(); return true; }
          return false;
        },
        args: [params.text]
      });
      await reportResult(id, !!result, result ? `Clicked "${params.text}".` : `Couldn't find anything to click matching "${params.text}".`);
    } else if (action === 'type') {
      const tab = await getActiveTab();
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (hint, text) => {
          const inputs = Array.from(document.querySelectorAll('input, textarea'));
          let target = null;
          if (hint) {
            target = inputs.find(el =>
              (el.placeholder || '').toLowerCase().includes(hint.toLowerCase()) ||
              (el.name || '').toLowerCase().includes(hint.toLowerCase()) ||
              (el.id || '').toLowerCase().includes(hint.toLowerCase())
            );
          }
          if (!target) {
            target = (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'))
              ? document.activeElement : inputs[0];
          }
          if (!target) return false;
          target.focus();
          target.value = text;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        },
        args: [params.fieldHint || '', params.text]
      });
      await reportResult(id, !!result, result ? 'Typed into the field.' : "Couldn't find a field to type into.");
    } else if (action === 'read') {
      const tab = await getActiveTab();
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 4000)
      });
      await reportResult(id, true, result || '(page appears empty)');
    } else if (action === 'scroll') {
      const tab = await getActiveTab();
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (dir) => window.scrollBy(0, dir === 'down' ? 600 : -600),
        args: [params.direction]
      });
      await reportResult(id, true, `Scrolled ${params.direction}.`);
    } else if (action === 'screenshot') {
      const tab = await getActiveTab();
      if (!tab) { await reportResult(id, false, 'No active tab found.'); return; }
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 });
      const base64 = dataUrl.split(',')[1];
      const [{ result: viewport }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 })
      });
      await reportResult(id, true, { screenshot: base64, viewport, url: tab.url });
    } else if (action === 'click_coords') {
      const tab = await getActiveTab();
      if (!tab) { await reportResult(id, false, 'No active tab found.'); return; }
      const dpr = await getDevicePixelRatio(tab.id);
      await attachDebugger(tab.id);
      try {
        await dispatchClick(tab.id, params.x / dpr, params.y / dpr);
      } finally {
        await detachDebugger(tab.id);
      }
      await reportResult(id, true, `Clicked at (${params.x}, ${params.y}).`);
    } else if (action === 'type_coords') {
      const tab = await getActiveTab();
      if (!tab) { await reportResult(id, false, 'No active tab found.'); return; }
      const dpr = await getDevicePixelRatio(tab.id);
      await attachDebugger(tab.id);
      try {
        if (params.x != null && params.y != null) {
          await dispatchClick(tab.id, params.x / dpr, params.y / dpr);
        }
        await dispatchType(tab.id, params.text);
      } finally {
        await detachDebugger(tab.id);
      }
      await reportResult(id, true, `Typed "${params.text}" at (${params.x}, ${params.y}).`);
    } else {
      await reportResult(id, false, `Unknown action: ${action}`);
    }
  } catch (e) {
    await reportResult(id, false, `Action failed: ${e.message}`);
  }
}
