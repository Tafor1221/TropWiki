<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$config = require __DIR__ . '/data/config.php';
$dataFile = __DIR__ . '/data/wiki.json';

function response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readWikiData(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }

    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) {
        return null;
    }

    if (($decoded['version'] ?? null) !== 2
        || !is_array($decoded['sections'] ?? null)
        || !is_array($decoded['articles'] ?? null)) {
        return null;
    }

    return $decoded;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$providedKey = $_SERVER['HTTP_X_ADMIN_KEY'] ?? '';
$adminKey = (string) ($config['admin_key'] ?? '');
$isAdmin = $adminKey !== '' && hash_equals($adminKey, $providedKey);

if ($method === 'GET') {
    if ($providedKey !== '' && !$isAdmin) {
        response(403, ['ok' => false, 'error' => 'Invalid admin key']);
    }
    $data = readWikiData($dataFile);
    if ($data !== null && !$isAdmin) {
        $data['articles'] = array_values(array_filter(
            $data['articles'],
            static fn ($article) => ($article['status'] ?? 'published') === 'published'
        ));
    }
    response(200, [
        'ok' => true,
        'initialized' => $data !== null,
        'data' => $data,
    ]);
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    response(405, ['ok' => false, 'error' => 'Method not allowed']);
}

if (!$isAdmin) {
    response(403, ['ok' => false, 'error' => 'Invalid admin key']);
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 12 * 1024 * 1024) {
    response(413, ['ok' => false, 'error' => 'Request is too large']);
}

$data = json_decode($raw, true);
if (!is_array($data)
    || ($data['version'] ?? null) !== 2
    || !is_array($data['sections'] ?? null)
    || !is_array($data['articles'] ?? null)) {
    response(422, ['ok' => false, 'error' => 'Invalid wiki data']);
}

$directory = dirname($dataFile);
if (!is_dir($directory) || !is_writable($directory)) {
    response(500, ['ok' => false, 'error' => 'Wiki data directory is not writable']);
}

$lock = fopen($dataFile . '.lock', 'c');
if ($lock === false || !flock($lock, LOCK_EX)) {
    response(500, ['ok' => false, 'error' => 'Could not lock wiki data']);
}

$encoded = json_encode(
    $data,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);

$tempFile = $dataFile . '.tmp';
$written = $encoded !== false ? file_put_contents($tempFile, $encoded, LOCK_EX) : false;
$saved = $written !== false && rename($tempFile, $dataFile);

if (!$saved && is_file($tempFile)) {
    unlink($tempFile);
}

flock($lock, LOCK_UN);
fclose($lock);

if (!$saved) {
    response(500, ['ok' => false, 'error' => 'Could not save wiki data']);
}

response(200, ['ok' => true]);
