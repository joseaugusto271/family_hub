<?php
// chat.php — mensagens do chat familiar
// Para uploads de imagem, não usamos o header JSON padrão de db.php
// então definimos manualmente depois

function getDB() {
    $db = new SQLite3(__DIR__ . '/../familyhub.db');
    $db->enableExceptions(true);
    $db->exec("PRAGMA foreign_keys = ON");

    $db->exec("CREATE TABLE IF NOT EXISTS familias (
        id_familia INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(100) NOT NULL,
        codigo VARCHAR(20) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS membros (
        id_membro INTEGER PRIMARY KEY AUTOINCREMENT,
        id_familia INTEGER NOT NULL,
        nome VARCHAR(100) NOT NULL,
        papel VARCHAR(50) NOT NULL,
        avatar VARCHAR(10) DEFAULT 'NA',
        cor VARCHAR(7) DEFAULT '#2a7339',
        pontos INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_familia) REFERENCES familias(id_familia)
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS mensagens (
        id_msg INTEGER PRIMARY KEY AUTOINCREMENT,
        id_familia INTEGER NOT NULL,
        id_membro INTEGER NOT NULL,
        conteudo TEXT,
        tipo VARCHAR(10) DEFAULT 'texto',
        imagem_path VARCHAR(255),
        enviado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_familia) REFERENCES familias(id_familia),
        FOREIGN KEY (id_membro) REFERENCES membros(id_membro)
    )");

    return $db;
}

function startSession() {
    if (session_status() === PHP_SESSION_NONE) session_start();
}

startSession();
$id_familia = $_SESSION['id_familia'] ?? null;

if (!$id_familia) {
    header('Content-Type: application/json');
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Não autenticado']);
    exit();
}

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

// ── GET: buscar mensagens (polling) ──
if ($method === 'GET') {
    header('Content-Type: application/json');
    $desde = $_GET['desde'] ?? 0; // id_msg mínimo para pegar só novas
    $stmt = $db->prepare("
        SELECT m.id_msg, m.conteudo, m.tipo, m.imagem_path, m.enviado_em,
               mb.id_membro, mb.nome, mb.cor
        FROM mensagens m
        JOIN membros mb ON m.id_membro = mb.id_membro
        WHERE m.id_familia = :fam AND m.id_msg > :desde
        ORDER BY m.enviado_em ASC, m.id_msg ASC
        LIMIT 100
    ");
    $stmt->bindValue(':fam', $id_familia);
    $stmt->bindValue(':desde', (int)$desde);
    $result = $stmt->execute();
    $msgs = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $msgs[] = $row;
    }
    echo json_encode(['success' => true, 'data' => $msgs]);
    exit();
}

// ── POST: enviar mensagem de texto ──
if ($method === 'POST' && empty($_FILES)) {
    header('Content-Type: application/json');
    $input = json_decode(file_get_contents('php://input'), true);
    $id_membro = (int)($input['id_membro'] ?? 0);
    $conteudo  = trim($input['conteudo'] ?? '');

    if (!$id_membro || !$conteudo) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Membro e conteúdo obrigatórios']);
        exit();
    }

    // Verify member belongs to family
    $check = $db->query("SELECT id_membro, nome, cor FROM membros WHERE id_membro = $id_membro AND id_familia = $id_familia")->fetchArray(SQLITE3_ASSOC);
    if (!$check) { http_response_code(403); echo json_encode(['success' => false, 'error' => 'Não autorizado']); exit(); }

    $stmt = $db->prepare("INSERT INTO mensagens (id_familia, id_membro, conteudo, tipo) VALUES (:fam, :mb, :con, 'texto')");
    $stmt->bindValue(':fam', $id_familia);
    $stmt->bindValue(':mb', $id_membro);
    $stmt->bindValue(':con', htmlspecialchars($conteudo, ENT_QUOTES, 'UTF-8'));
    $stmt->execute();
    $id = $db->lastInsertRowID();

    $msg = $db->query("SELECT m.id_msg, m.conteudo, m.tipo, m.imagem_path, m.enviado_em, mb.id_membro, mb.nome, mb.cor FROM mensagens m JOIN membros mb ON m.id_membro = mb.id_membro WHERE m.id_msg = $id")->fetchArray(SQLITE3_ASSOC);
    echo json_encode(['success' => true, 'data' => $msg]);
    exit();
}

// ── POST: upload de imagem ──
if ($method === 'POST' && !empty($_FILES['imagem'])) {
    header('Content-Type: application/json');
    $id_membro = (int)($_POST['id_membro'] ?? 0);

    if (!$id_membro) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Membro obrigatório']); exit(); }

    $check = $db->query("SELECT id_membro FROM membros WHERE id_membro = $id_membro AND id_familia = $id_familia")->fetchArray();
    if (!$check) { http_response_code(403); echo json_encode(['success'=>false,'error'=>'Não autorizado']); exit(); }

    $file = $_FILES['imagem'];
    $allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!in_array($file['type'], $allowed)) {
        http_response_code(400);
        echo json_encode(['success'=>false,'error'=>'Apenas imagens JPG, PNG, GIF ou WEBP']);
        exit();
    }

    $maxSize = 5 * 1024 * 1024; // 5MB
    if ($file['size'] > $maxSize) {
        http_response_code(400);
        echo json_encode(['success'=>false,'error'=>'Imagem muito grande (máx. 5MB)']);
        exit();
    }

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'img_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . strtolower($ext);
    $uploadDir = __DIR__ . '/../uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    $dest = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        http_response_code(500);
        echo json_encode(['success'=>false,'error'=>'Falha ao salvar imagem']);
        exit();
    }

    $imgPath = 'uploads/' . $filename;
    $stmt = $db->prepare("INSERT INTO mensagens (id_familia, id_membro, tipo, imagem_path) VALUES (:fam, :mb, 'imagem', :img)");
    $stmt->bindValue(':fam', $id_familia);
    $stmt->bindValue(':mb', $id_membro);
    $stmt->bindValue(':img', $imgPath);
    $stmt->execute();
    $id = $db->lastInsertRowID();

    $msg = $db->query("SELECT m.id_msg, m.conteudo, m.tipo, m.imagem_path, m.enviado_em, mb.id_membro, mb.nome, mb.cor FROM mensagens m JOIN membros mb ON m.id_membro = mb.id_membro WHERE m.id_msg = $id")->fetchArray(SQLITE3_ASSOC);
    echo json_encode(['success' => true, 'data' => $msg]);
    exit();
}

// ── DELETE: apagar mensagem ──
if ($method === 'DELETE') {
    header('Content-Type: application/json');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'ID obrigatório']); exit(); }

    // Delete image file if exists
    $msg = $db->query("SELECT imagem_path FROM mensagens WHERE id_msg = $id AND id_familia = $id_familia")->fetchArray(SQLITE3_ASSOC);
    if ($msg && $msg['imagem_path'] && file_exists(__DIR__ . '/../' . $msg['imagem_path'])) {
        unlink(__DIR__ . '/../' . $msg['imagem_path']);
    }

    $db->exec("DELETE FROM mensagens WHERE id_msg = $id AND id_familia = $id_familia");
    echo json_encode(['success' => true]);
    exit();
}

header('Content-Type: application/json');
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método não permitido']);
?>
