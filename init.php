<?php
/**
 * FamilyHub — Inicialização do Banco de Dados
 * Acesse http://localhost:8080/init.php uma vez para criar o banco.
 * O banco também é criado automaticamente ao fazer qualquer requisição à API.
 */

try {
    $db = new SQLite3(__DIR__ . '/familyhub.db');
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
        icone VARCHAR(20) DEFAULT 'gift',
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

    $path = realpath(__DIR__ . '/familyhub.db');
    $size = filesize($path);

    // Create uploads folder
    $uploadsDir = __DIR__ . '/uploads';
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);

    echo "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>
    <title>FamilyHub — Init</title>
    <style>
      body { font-family: system-ui; background: #f2f5f0; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
      .box { background:#fff; border:1.5px solid #d4dbd1; border-radius:12px; padding:32px 40px; max-width:480px; width:100%; box-shadow:0 4px 20px rgba(0,0,0,.08); }
      h1 { font-size:1.2rem; margin-bottom:6px; color:#0f1a0f; }
      p  { font-size:0.88rem; color:#687568; margin-bottom:14px; line-height:1.5; }
      .ok { background:#e4f0e6; border:1px solid #b6d4ba; color:#1b5226; padding:10px 14px; border-radius:8px; font-size:0.85rem; margin-bottom:16px; }
      .info { background:#f0f2ef; border:1px solid #d4dbd1; padding:10px 14px; border-radius:8px; font-size:0.8rem; color:#687568; font-family:monospace; margin-bottom:20px; }
      a { display:inline-block; background:#2a7339; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-size:0.88rem; font-weight:600; }
      a:hover { background:#1b5226; }
    </style></head><body>
    <div class='box'>
      <h1>✅ Banco de dados inicializado</h1>
      <p>O arquivo <strong>familyhub.db</strong> foi criado com sucesso com todas as tabelas necessárias.</p>
      <div class='ok'>Banco criado em: <strong>{$path}</strong></div>
      <div class='info'>
        Tabelas criadas:<br>
        — familias<br>
        — membros<br>
        — atividades<br>
        — recompensas<br>
        — resgates<br>
        — mensagens<br><br>
        Tamanho: " . number_format($size) . " bytes<br>
        Pasta uploads: " . (is_dir($uploadsDir) ? '✓ criada' : '✗ erro') . "
      </div>
      <p>Agora você pode usar o sistema normalmente. O banco também é criado automaticamente pela API.</p>
      <a href='/'>Ir para o FamilyHub →</a>
    </div></body></html>";

} catch (Exception $e) {
    http_response_code(500);
    echo "<pre style='color:red;padding:20px'>ERRO: " . htmlspecialchars($e->getMessage()) . "</pre>";
    echo "<p style='padding:20px'>Verifique se a extensão SQLite3 está habilitada no PHP:<br><code>php -m | grep sqlite</code></p>";
}
?>
