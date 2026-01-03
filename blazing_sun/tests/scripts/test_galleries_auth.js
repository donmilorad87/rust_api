const https = require('https');
const http = require('http');

// Step 1: Sign in and get session cookie
async function signIn() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'djmyle@gmail.com',
      password: 'asdqwE123~~'
    });

    const options = {
      hostname: '172.28.0.10',
      port: 9999,
      path: '/api/v1/auth/sign-in',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Sign-in response status:', res.statusCode);
        console.log('Sign-in response headers:', res.headers);
        console.log('Sign-in response body:', data);

        // Extract JWT token from response body
        try {
          const json = JSON.parse(data);
          if (json.token) {
            console.log('JWT token:', json.token);
            resolve(json.token);
          } else {
            reject(new Error('No token in response'));
          }
        } catch (e) {
          reject(new Error('Failed to parse response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Step 2: Call galleries API with JWT token
async function getGalleries(jwtToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '172.28.0.10',
      port: 9999,
      path: '/api/v1/galleries',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    };

    console.log('\n=== Calling /api/v1/galleries with JWT');

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Galleries API response status:', res.statusCode);
        console.log('Galleries API response headers:', res.headers);
        console.log('Galleries API response body:', data);

        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log('\nParsed JSON structure:', JSON.stringify(json, null, 2));
            console.log('Is array?', Array.isArray(json));
            console.log('Has .galleries property?', 'galleries' in json);
          } catch (e) {
            console.log('Failed to parse JSON:', e.message);
          }
        }

        resolve(data);
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

// Run the test
(async () => {
  try {
    console.log('=== Step 1: Sign in ===');
    const jwtToken = await signIn();

    console.log('\n=== Step 2: Get galleries ===');
    await getGalleries(jwtToken);

  } catch (error) {
    console.error('Error:', error);
  }
})();
