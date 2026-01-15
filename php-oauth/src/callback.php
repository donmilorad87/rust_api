<?php
declare(strict_types=1);

session_start();

$code = $_GET['code'] ?? null;
$state = $_GET['state'] ?? '';
$codeChallenge = $_GET['code_challenge'] ?? null;
$codeChallengeMethod = $_GET['code_challenge_method'] ?? null;
$clientId = 'client_ifq65mv9tjlfpnhzkk5djue1vxf1ray7';
$clientSecret =  'DPgSQGjwdORt7BqNVuhdR3wTNok4eaH8Yp8BIxQzqdRZ6trVDN6EtZKCLOzUrJBs';
$codeVerifier = $_GET['code_verifier'] ?? ($_SESSION['pkce_code_verifier'] ?? (getenv('OAUTH_CODE_VERIFIER') ?: ''));

if (!$code) {
    http_response_code(400);
    exit('Missing code');
}

$decodedState = base64_decode($state, true);
if ($decodedState === false) {
    http_response_code(400);
    exit('Invalid state encoding');
}

if (!$clientId || !$clientSecret) {
    http_response_code(500);
    exit('Missing OAUTH_CLIENT_ID or OAUTH_CLIENT_SECRET');
}

$tokenUrl = getenv('OAUTH_TOKEN_URL') ?: 'https://172.28.0.12/oauth/callback/exchange';
$redirectUri = getenv('OAUTH_REDIRECT_URI') ?: 'https://local.fotobook.com:8889/callback.php';

if (!$codeVerifier) {
    if ($codeChallenge && $codeChallengeMethod === 'plain') {
        $codeVerifier = $codeChallenge;
    } elseif ($codeChallenge && $codeChallengeMethod === 'S256') {
        http_response_code(400);
        exit('Missing PKCE code_verifier. Cannot derive code_verifier from S256 code_challenge; use the original verifier.');
    } else {
        http_response_code(400);
        exit('Missing PKCE code_verifier (set OAUTH_CODE_VERIFIER or provide code_verifier)');
    }
}

$payload = http_build_query([
    'code' => $code,
    'redirect_uri' => $redirectUri,
    'client_id' => $clientId,
    'client_secret' => $clientSecret,
    'code_verifier' => $codeVerifier,
    'state' => $state,
]);

$ch = curl_init($tokenUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    // For local self-signed certs only:
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code(400);
    exit('Token exchange failed: ' . $response);
}

$data = json_decode($response, true);
$accessToken = $data['access_token'] ?? null;

if (!$accessToken || substr_count($accessToken, '.') !== 2) {
    http_response_code(400);
    exit('Invalid access_token in response');
}

setcookie(
    'oauth_access_token',
    $accessToken,
    [
        'expires' => time() + 3600,
        'path' => '/',
        'domain' => 'local.fotobook.com',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]
);

header('Location: /galleries.php');
exit;
