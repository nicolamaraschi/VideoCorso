import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetUrl = process.argv[2] || 'https://main.d26u0xz2smmxfz.amplifyapp.com';

console.log(`\n🚀 Avvio Test di Velocità e Render per: ${targetUrl}\n`);

async function runAudit(url, isMobile = true) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
  });

  const options = {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
    formFactor: isMobile ? 'mobile' : 'desktop',
    screenEmulation: isMobile
      ? {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          disabled: false,
        }
      : {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
    throttling: isMobile
      ? {
          rttMs: 150,
          throughputKbps: 1.6 * 1024,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 150,
          downloadThroughputKbps: 1.6 * 1024,
          uploadThroughputKbps: 750,
        }
      : {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
  };

  try {
    const runnerResult = await lighthouse(url, options);
    await chrome.kill();
    return runnerResult.lhr;
  } catch (error) {
    await chrome.kill();
    throw error;
  }
}

function formatScore(score) {
  const num = Math.round(score * 100);
  if (num >= 90) return `\x1b[32m${num}/100 (Eccellente 🟢)\x1b[0m`;
  if (num >= 50) return `\x1b[33m${num}/100 (Buono/Medio 🟡)\x1b[0m`;
  return `\x1b[31m${num}/100 (Da Ottimizzare 🔴)\x1b[0m`;
}

function formatMetric(displayValue) {
  return `\x1b[36m${displayValue}\x1b[0m`;
}

async function main() {
  console.log('📱 Esecuzione test simulazione SMARTPHONE (4G / CPU Mobile)...');
  const mobileResult = await runAudit(targetUrl, true);

  console.log('💻 Esecuzione test simulazione DESKTOP (Fibra / Fast)...');
  const desktopResult = await runAudit(targetUrl, false);

  console.log('\n' + '='.repeat(65));
  console.log('       📊 REPORT VELOCITÀ DI RENDERING E PRESTAZIONI GOOGLE');
  console.log('='.repeat(65));

  console.log(`\n📱 DISPOSITIVI MOBILI (Smartphone con connessione 4G):`);
  console.log(`- Performance Score               : ${formatScore(mobileResult.categories.performance.score)}`);
  console.log(`- Primo Render (FCP)              : ${formatMetric(mobileResult.audits['first-contentful-paint'].displayValue)}`);
  console.log(`- Contenuto Principale Visibile (LCP): ${formatMetric(mobileResult.audits['largest-contentful-paint'].displayValue)}`);
  console.log(`- Indice di Velocità (Speed Index): ${formatMetric(mobileResult.audits['speed-index'].displayValue)}`);
  console.log(`- Tempo Blocco Interazione (TBT)  : ${formatMetric(mobileResult.audits['total-blocking-time'].displayValue)}`);
  console.log(`- Stabilità Layout Visivo (CLS)   : ${formatMetric(mobileResult.audits['cumulative-layout-shift'].displayValue)}`);

  console.log(`\n💻 COMPUTER / DESKTOP (Connessione Veloce):`);
  console.log(`- Performance Score               : ${formatScore(desktopResult.categories.performance.score)}`);
  console.log(`- Primo Render (FCP)              : ${formatMetric(desktopResult.audits['first-contentful-paint'].displayValue)}`);
  console.log(`- Contenuto Principale Visibile (LCP): ${formatMetric(desktopResult.audits['largest-contentful-paint'].displayValue)}`);
  console.log(`- Indice di Velocità (Speed Index): ${formatMetric(desktopResult.audits['speed-index'].displayValue)}`);
  console.log(`- Tempo Blocco Interazione (TBT)  : ${formatMetric(desktopResult.audits['total-blocking-time'].displayValue)}`);
  console.log(`- Stabilità Layout Visivo (CLS)   : ${formatMetric(desktopResult.audits['cumulative-layout-shift'].displayValue)}`);

  console.log('\n' + '='.repeat(65) + '\n');
}

main().catch((err) => {
  console.error('Errore durante il test di velocità:', err);
  process.exit(1);
});
