import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const results = [];
const candidates = [
  ['default-headless', {}],
  ['full-chromium-headless', { channel: 'chromium' }],
  ['full-chromium-d3d11', { channel: 'chromium', args: ['--use-angle=d3d11'] }],
];
for (const [name, options] of candidates) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...options,
      args: ['--enable-automation', ...(options.args ?? [])] });
    const page = await browser.newPage();
    const webgl = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_debug_renderer_info');
      return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null };
    });
    const cdp = await browser.newBrowserCDPSession();
    const info = await cdp.send('SystemInfo.getInfo');
    const command = await cdp.send('Browser.getBrowserCommandLine');
    results.push({ name, date: new Date().toISOString(), options, version: browser.version(),
      webgl, gpu: info.gpu, arguments: command.arguments });
    console.log(name, webgl.renderer);
  } catch (error) {
    results.push({ name, error: String(error) });
    console.error(name, String(error));
    process.exitCode = 1;
  } finally { await browser?.close(); }
}
mkdirSync('profiling-results', { recursive: true });
writeFileSync('profiling-results/gpu-probe.json', JSON.stringify(results, null, 2));
