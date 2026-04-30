<?php
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
        avatar VARCHAR(10) DEFAULT '👤',
        cor VARCHAR(7) DEFAULT '#3b82f6',
        pontos INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_familia) REFERENCES familias(id_familia)
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS atividades (
        id_ativ INTEGER PRIMARY KEY AUTOINCREMENT,
        id_familia INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        id_membro INTEGER,
        data_ativ DATE NOT NULL,
        hora_ativ TIME,
        status VARCHAR(20) DEFAULT 'pendente',
        prioridade VARCHAR(10) DEFAULT 'baixa',
        pontos_recompensa INTEGER DEFAULT 10,
        google_event_id VARCHAR(255),
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_familia) REFERENCES familias(id_familia),
        FOREIGN KEY (id_membro) REFERENCES membros(id_membro)
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS recompensas (
        id_recompensa INTEGER PRIMARY KEY AUTOINCREMENT,
        id_familia INTEGER NOT NULL,
        titulo VARCHAR(100) NOT NULL,
        descricao TEXT,
        custo_pontos INTEGER NOT NULL DEFAULT 50,
        icone VARCHAR(10) DEFAULT '🎁',
        ativa INTEGER DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_familia) REFERENCES familias(id_familia)
    )");

    $db->exec("CREATE TABLE IF NOT EXISTS resgates (
        id_resgate INTEGER PRIMARY KEY AUTOINCREMENT,
        id_recompensa INTEGER NOT NULL,
        id_membro INTEGER NOT NULL,
        pontos_gastos INTEGER NOT NULL,
        resgatado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_recompensa) REFERENCES recompensas(id_recompensa),
        FOREIGN KEY (id_membro) REFERENCES membros(id_membro)
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

function getFamiliaId() {
    startSession();
    return $_SESSION['id_familia'] ?? null;
}

function requireAuth() {
    $id = getFamiliaId();
    if (!$id) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Não autenticado']);
        exit();
    }
    return $id;
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
