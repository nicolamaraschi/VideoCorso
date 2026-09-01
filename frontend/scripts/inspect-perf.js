import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

async function diagnose() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
  });

  const options = {
    logLevel: 'error',
    output: 'json',
    port: chrome.port,
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1.6 * 1024,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 150,
      downloadThroughputKbps: 1.6 * 1024,
      uploadThroughputKbps: 750,
    },
  };

  const runnerResult = await lighthouse('https://main.d26u0xz2smmxfz.amplifyapp.com', options);
  await chrome.kill();

  const audits = runnerResult.lhr.audits;
  console.log('\n--- DIAGNOSI DETTAGLIATA MOBILE ---');
  console.log('LCP Element:', audits['largest-contentful-paint-element']?.displayValue || audits['largest-contentful-paint-element']?.details?.items);
  console.log('\nRender Blocking Resources:');
  console.log(audits['render-blocking-resources']?.details?.items || 'None');
  console.log('\nUnused JavaScript:');
  console.log(audits['unused-javascript']?.details?.items?.map(i => ({ url: i.url, wastedBytes: i.wastedBytes })));
  console.log('\nTotal Byte Weight:');
  console.log(audits['total-byte-weight']?.details?.items?.slice(0, 10).map(i => ({ url: i.url, totalBytes: i.totalBytes })));
}

diagnose().catch(console.error);
