<?php
declare(strict_types=1);

$token = $_COOKIE['oauth_access_token'] ?? '';
$token = trim($token, " \t\n\r\0\x0B\"'");

if ($token === '') {
    http_response_code(401);
    exit('Missing oauth_access_token cookie');
}

if (substr_count($token, '.') !== 2) {
    http_response_code(400);
    exit('Invalid access token format');
}

$apiUrl = 'https://172.28.0.12/api/v1/oauth/galleries?limit=16&offset=0';

if (isset($_GET['gallery_id'])) {
    $galleryId = (int) $_GET['gallery_id'];
    $imagesUrl = 'https://172.28.0.12/api/v1/oauth/galleries/' . $galleryId . '/images?limit=16&offset=0';

    $ch = curl_init($imagesUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'request_error',
            'error_description' => $curlErr,
            'url' => $deleteUrl,
        ]);
        exit;
    }

    http_response_code($httpCode);
    header('Content-Type: application/json');
    if ($response === '' || $response === false) {
        echo json_encode([
            'error' => 'empty_response',
            'error_description' => 'Empty response from API',
            'http_code' => $httpCode,
        ]);
        exit;
    }
    echo $response;
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    if (!is_array($data)) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'invalid_request', 'error_description' => 'Invalid JSON']);
        exit;
    }

    $deleteGalleryId = isset($data['delete_gallery_id']) ? (int) $data['delete_gallery_id'] : 0;
    $deletePictureId = isset($data['delete_picture_id']) ? (int) $data['delete_picture_id'] : 0;

    if ($deleteGalleryId > 0) {
        $deleteUrl = 'https://172.28.0.12/api/v1/oauth/galleries/' . $deleteGalleryId;
    } elseif ($deletePictureId > 0) {
        $deleteUrl = 'https://172.28.0.12/api/v1/oauth/pictures/' . $deletePictureId;
    } else {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'invalid_request', 'error_description' => 'Missing delete id']);
        exit;
    }

    $ch = curl_init($deleteUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'request_error', 'error_description' => $curlErr]);
        exit;
    }

    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo $response;
    exit;
}

$ch = curl_init($apiUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
    ],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(500);
    exit('Request error: ' . $curlErr);
}

function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

http_response_code($httpCode);
header('Content-Type: text/html; charset=UTF-8');

if ($httpCode < 200 || $httpCode >= 300) {
    $message = $response ?: 'Failed to load galleries';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Galleries</title></head><body>';
    echo '<h1>Galleries</h1><p>' . e($message) . '</p></body></html>';
    exit;
}

$payload = json_decode($response, true);
if (!is_array($payload)) {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Galleries</title></head><body>';
    echo '<h1>Galleries</h1><p>Invalid response.</p></body></html>';
    exit;
}

$galleries = $payload['galleries'] ?? [];

echo '<!doctype html><html lang="en">';
echo '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
echo '<title>Galleries</title>';
echo '<style>
    :root { color-scheme: light; }
    body { font-family: "Georgia", "Times New Roman", serif; background: #f7f4ef; color: #1f1f1f; margin: 0; padding: 32px; }
    h1 { font-size: 28px; margin: 0 0 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
    .card { background: #fff; border: 1px solid #e2ddd6; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    .cover { width: 100%; height: 180px; object-fit: cover; background: #e9e4dd; }
    .card-body { padding: 16px; }
    .meta { font-size: 12px; color: #666; margin-top: 6px; }
    .thumbs { display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 8px; margin-top: 12px; }
    .thumb { width: 100%; height: 64px; object-fit: cover; border-radius: 8px; background: #f0ece6; }
    .empty { color: #777; font-size: 14px; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; background: #efe7db; color: #4a3f2b; margin-left: 6px; }
    .btn { margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid #d8d0c6; border-radius: 999px; padding: 6px 12px; font-size: 12px; background: #f7f3ee; cursor: pointer; }
    .btn--danger { background: #ffe9e8; border-color: #f3b8b4; color: #7d1f1f; }
    .btn:disabled { opacity: 0.6; cursor: default; }
    .images-wrap { margin-top: 10px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  </style></head><body>';
echo '<h1>Galleries</h1>';

if (!is_array($galleries) || count($galleries) === 0) {
    echo '<p class="empty">No galleries found.</p>';
} else {
    echo '<div class="grid">';
    foreach ($galleries as $gallery) {
        $name = e((string) ($gallery['title'] ?? 'Untitled'));
        $desc = e((string) ($gallery['description'] ?? ''));
        $cover = (string) ($gallery['cover_image_url'] ?? '');
        $count = (int) ($gallery['picture_count'] ?? 0);
        $public = !empty($gallery['is_public']) ? 'Public' : 'Private';
        $created = e((string) ($gallery['created_at'] ?? ''));
        $galleryId = (int) ($gallery['id'] ?? 0);
        $imagesEndpoint = '/galleries.php?gallery_id=' . $galleryId;

        echo '<div class="card">';
        echo '<img class="cover" src="' . e($cover) . '" alt="' . $name . ' cover">';
        echo '<div class="card-body">';
        echo '<strong>' . $name . '</strong><span class="pill">' . e($public) . '</span>';
        if ($desc !== '') {
            echo '<p>' . $desc . '</p>';
        }
        echo '<div class="meta">Images: ' . $count . ' | Created: ' . $created . '</div>';
        echo '<div class="actions">';
        echo '<button class="btn" data-gallery-id="' . $galleryId . '" data-images-url="' . e($imagesEndpoint) . '">Load images</button>';
        echo '<button class="btn btn--danger" data-delete-gallery="' . $galleryId . '">Delete gallery</button>';
        echo '</div>';
        echo '<div class="images-wrap" id="images-' . $galleryId . '"></div>';
        echo '</div></div>';
    }
    echo '</div>';
}

echo '<script>
  const buttons = document.querySelectorAll("[data-images-url]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-gallery-id");
      const container = document.getElementById("images-" + targetId);
      const url = btn.getAttribute("data-images-url");
      if (!container || !url) return;
      btn.disabled = true;
      btn.textContent = "Loading...";
      try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (!resp.ok) {
          container.innerHTML = "<p class=\\"empty\\">Failed to load images.</p>";
          return;
        }
        const images = Array.isArray(data.images) ? data.images : [];
        if (images.length === 0) {
          container.innerHTML = "<p class=\\"empty\\">No images found.</p>";
          return;
        }
        const thumbs = images.map((img) => {
          const src = img.image_url || "";
          const alt = img.title || "";
          const id = img.id;
          return `
            <div>
              <img class="thumb" src="${src}" alt="${alt}">
              <button class="btn btn--danger" data-delete-picture="${id}">Delete</button>
            </div>
          `;
        });
        container.innerHTML = `<div class="thumbs">${thumbs.join("")}</div>`;
      } catch (e) {
        container.innerHTML = "<p class=\\"empty\\">Failed to load images.</p>";
      } finally {
        btn.disabled = false;
        btn.textContent = "Load images";
      }
    });
  });

  async function handleDelete(payload) {
    const resp = await fetch("/galleries.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      if (resp.status === 403) {
        if (data && data.error === "insufficient_scope") {
          alert("You do not have scope access for deletion.");
          return { ok: false, forbidden: true };
        }
        alert("Deletion is not possible. Only the owner can delete this item.");
        return { ok: false, forbidden: true };
      }
      const message = data && data.error_description ? data.error_description : "Delete failed.";
      alert(message);
      return { ok: false };
    }
    return { ok: true, data };
  }

  document.addEventListener("click", async (event) => {
    const galleryBtn = event.target.closest("[data-delete-gallery]");
    if (galleryBtn) {
      const galleryId = parseInt(galleryBtn.getAttribute("data-delete-gallery"), 10);
      if (!galleryId) return;
      const result = await handleDelete({ delete_gallery_id: galleryId });
      if (result.ok) {
        const card = galleryBtn.closest(".card");
        if (card) card.remove();
      }
      return;
    }

    const pictureBtn = event.target.closest("[data-delete-picture]");
    if (pictureBtn) {
      const pictureId = parseInt(pictureBtn.getAttribute("data-delete-picture"), 10);
      if (!pictureId) return;
      const result = await handleDelete({ delete_picture_id: pictureId });
      if (result.ok) {
        const wrapper = pictureBtn.parentElement;
        if (wrapper) wrapper.remove();
      }
    }
  });
</script>';
echo '</body></html>';
