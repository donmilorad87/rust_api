<?php
declare(strict_types=1);

session_start();

$verifier = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
$_SESSION['pkce_code_verifier'] = $verifier;

$challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

$authUrl = 'https://local.rust.com/oauth/authorize?' . http_build_query([
    'client_id' => 'client_ifq65mv9tjlfpnhzkk5djue1vxf1ray7',
    'redirect_uri' => 'https://local.fotobook.com:8889/callback.php',
    'response_type' => 'code',
    'scope' => 'galleries.delete galleries.edit galleries.write galleries.read',
    'state' => base64_encode('fotobook_oauth_state_v1'),
    'code_challenge' => $challenge,
    'code_challenge_method' => 'S256',
]);

header('Location: ' . $authUrl);
exit;
