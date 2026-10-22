const { app } = require('electron');
const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const path = require('node:path');

const sampleDir = path.join(__dirname, '..', 'samples');
const sampleNames = readdirSync(sampleDir);
const samplePath = (suffix) => path.join(sampleDir, sampleNames.find((name) => name.endsWith(suffix)));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`(() => {
        document.querySelector('#sample-search').click();
        document.querySelector('#search-button').click();
        const candidates = document.querySelectorAll('.candidate').length;
        document.querySelector('.sidebar .nav-link[data-view="calculator"]').click();
        document.querySelector('#base-date').value = '2026-01-01';
        document.querySelector('#calculate-button').click();
        return {
          candidates,
          visible: !document.querySelector('#calc-results').hidden,
          dates: [...document.querySelectorAll('.date-card strong')].map(el => el.textContent),
          error: document.querySelector('#calc-error').textContent
        };
      })()`);
      assert.ok(result.candidates >= 1);
      assert.equal(result.visible, true, result.error);
      assert.deepEqual(result.dates, ['2031-01-01', '2036-01-01']);
      await window.webContents.executeJavaScript(`(() => {
        document.querySelector('.sidebar .nav-link[data-view="research"]').click();
        window.confirm = () => true;
        const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.id = 'smoke-import-file';
        document.body.append(input);
      })()`);
      window.webContents.debugger.attach('1.3');
      const { root } = await window.webContents.debugger.sendCommand('DOM.getDocument');
      const { nodeId } = await window.webContents.debugger.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: '#smoke-import-file' });

      async function dropFiles(files, selector = '#import-zone') {
        await window.webContents.debugger.sendCommand('DOM.setFileInputFiles', { nodeId, files });
        return window.webContents.executeJavaScript(`(async () => {
          const transfer = new DataTransfer();
          for (const file of document.querySelector('#smoke-import-file').files) transfer.items.add(file);
          const target = document.querySelector(${JSON.stringify(selector)});
          target.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true, cancelable: true }));
          target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
          for (let i = 0; i < 120 && document.querySelector('#import-zone').classList.contains('importing'); i++) {
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          return {
            loaded: [...document.querySelectorAll('.source-card.loaded')].length,
            candidates: document.querySelectorAll('.candidate').length,
            error: document.querySelector('#import-status.error')?.textContent || '',
            message: document.querySelector('#import-status').textContent,
            title: document.querySelector('#source1-title').value,
            date: document.querySelector('#source1-date').value,
            source2: document.querySelector('#source2-text').value.slice(0, 50)
          };
        })()`);
      }

      const dropped = await dropFiles([samplePath('.txt'), samplePath('.docx')]);
      assert.equal(dropped.loaded, 2, dropped.error);
      assert.ok(dropped.candidates >= 1, dropped.message);
      assert.equal(dropped.title, '');
      assert.equal(dropped.date, '');
      const pdf = await dropFiles([samplePath('가상조문.pdf')], '.source-card:nth-child(2)');
      assert.equal(pdf.loaded, 2, pdf.error);
      assert.match(pdf.source2, /제96조/);
      const rejected = await dropFiles([samplePath('이미지형.pdf')], '.source-card:nth-child(2)');
      assert.match(rejected.error, /이미지형 스캔 PDF/);
      assert.match(rejected.source2, /제96조/);
      window.webContents.debugger.detach();
      console.log('Electron document drag-and-drop smoke test passed:', { candidates: dropped.candidates, dates: result.dates, scannedPdfRejected: Boolean(rejected.error) });
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
});
require(process.env.CLAIM_PACKAGED_APP_DIR
  ? path.join(process.env.CLAIM_PACKAGED_APP_DIR, 'main.cjs')
  : '../main.cjs');
