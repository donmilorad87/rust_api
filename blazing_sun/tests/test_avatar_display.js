const { chromium } = require('playwright');

async function testAvatarDisplay() {
    console.log('=== Testing Avatar Display ===\n');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Sign in
        console.log('1. Signing in...');
        await page.goto('http://172.28.0.10:9999/sign-in');
        await page.waitForLoadState('networkidle');

        await page.fill('input[type="email"]', 'djmyle@gmail.com');
        await page.fill('input[type="password"]', 'asdqwE123~~');

        await Promise.all([
            page.waitForNavigation({ timeout: 10000 }),
            page.click('button[type="submit"]')
        ]);

        await page.waitForLoadState('networkidle');
        console.log('   ✓ Signed in successfully');

        // Navigate to profile page
        console.log('\n2. Navigating to profile page...');
        await page.goto('http://172.28.0.10:9999/profile');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        console.log('   ✓ Profile page loaded');

        // Check avatar container
        console.log('\n3. Checking avatar container...');
        const avatarContainer = await page.locator('#avatarContainer');
        const isVisible = await avatarContainer.isVisible();
        console.log(`   Avatar container visible: ${isVisible}`);

        // Check avatar image
        const avatarImage = await page.locator('#avatarImage');
        const imageVisible = await avatarImage.isVisible();
        const imageSrc = await avatarImage.getAttribute('src');

        console.log(`   Avatar image visible: ${imageVisible}`);
        console.log(`   Avatar image src: ${imageSrc}`);

        // Check if image loads without error
        if (imageSrc) {
            const imageLoaded = await avatarImage.evaluate((img) => {
                return img.complete && img.naturalWidth > 0;
            });
            console.log(`   Avatar image loaded: ${imageLoaded}`);
        }

        // Take screenshot
        await page.screenshot({
            path: '/tmp/claude/profile-avatar-test.png',
            fullPage: true
        });
        console.log('\n   ✓ Screenshot saved to /tmp/claude/profile-avatar-test.png');

        // Check console for errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`   [CONSOLE ERROR] ${msg.text()}`);
            }
        });

        // Check for failed network requests
        page.on('response', response => {
            if (response.status() >= 400 && response.url().includes('avatar')) {
                console.log(`   [NETWORK ERROR] ${response.status()} ${response.url()}`);
            }
        });

        console.log('\n✅ Avatar display test completed!');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

testAvatarDisplay();
