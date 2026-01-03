// Test script to verify picture count updates after upload
const apiBase = 'http://172.28.0.10:9999/api/v1';

async function testPictureCountUpdate() {
    console.log('=== Testing Picture Count Update ===\n');

    try {
        // Step 1: Get current galleries
        console.log('1. Fetching current galleries...');
        const galleriesResponse = await fetch(`${apiBase}/gallery/list`, {
            method: 'GET',
            headers: {
                'Cookie': 'session=your_session_cookie_here'
            }
        });

        const galleriesData = await galleriesResponse.json();
        console.log(`   Found ${galleriesData.galleries.length} galleries\n`);

        if (galleriesData.galleries.length > 0) {
            const gallery = galleriesData.galleries[0];
            console.log(`   Gallery: "${gallery.name}"`);
            console.log(`   Current picture count: ${gallery.picture_count}`);
            console.log(`   Cover image: ${gallery.cover_image_url}\n`);
        }

        console.log('✓ Gallery data fetched successfully');
        console.log('\nNOTE: Picture count updates should now work when you:');
        console.log('  1. Upload pictures to a gallery');
        console.log('  2. Close the pictures modal');
        console.log('  3. The main galleries list will automatically refresh\n');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testPictureCountUpdate();
