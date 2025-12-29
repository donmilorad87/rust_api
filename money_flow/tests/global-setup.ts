/**
 * Global Setup for Playwright Tests
 *
 * Ensures the server is ready before running any tests.
 * This prevents 502 errors caused by server restarts.
 */

import https from 'https';

const BASE_URL = 'https://local.rust.com';
const HEALTH_CHECK_PATH = '/sign-in';
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 1000;

async function checkServer(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(): Promise<void> {
  const url = `${BASE_URL}${HEALTH_CHECK_PATH}`;
  console.log(`\n🔄 Waiting for server at ${url}...`);

  for (let i = 1; i <= MAX_RETRIES; i++) {
    const isReady = await checkServer(url);
    if (isReady) {
      console.log(`✅ Server is ready! (attempt ${i}/${MAX_RETRIES})\n`);
      return;
    }

    if (i < MAX_RETRIES) {
      process.stdout.write(`   Attempt ${i}/${MAX_RETRIES} - server not ready, waiting ${RETRY_DELAY_MS}ms...\r`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  throw new Error(`❌ Server at ${url} did not become ready after ${MAX_RETRIES} attempts`);
}

export default async function globalSetup() {
  await waitForServer();
}
