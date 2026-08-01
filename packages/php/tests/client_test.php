<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/KotobaseException.php';
require_once __DIR__ . '/../src/QueryResult.php';
require_once __DIR__ . '/../src/KotobaseClient.php';

use NetKotobase\KotobaseClient;

$captured = null;
$transport = function ($url, $headers, $body, $timeout) use (&$captured): array {
    $captured = compact('url', 'headers', 'body', 'timeout');
    return [200, json_encode([
        'ok' => true,
        'language' => 'cypher',
        'data' => ['rows' => [['Ada']]],
        'meta' => ['requestId' => 'req-1', 'elapsedMs' => 2],
    ], JSON_THROW_ON_ERROR)];
};

$client = new KotobaseClient('https://example.test/', 'secret', $transport);
$result = $client->cypher('MATCH (n:users) RETURN n.name');
assert($captured['url'] === 'https://example.test/xrpc/ai.gftd.apps.kotobase.query.execute');
assert($captured['headers']['authorization'] === 'Bearer secret');
assert($result->data['rows'][0][0] === 'Ada');
echo "ok\n";
