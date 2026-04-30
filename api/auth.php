<?php
require_once 'db.php';
startSession();

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? '';

if ($action === 'check') {
    $id = getFamiliaId();
    if ($id) {
        $f = $db->query("SELECT id_familia, nome, codigo FROM familias WHERE id_familia = $id")->fetchArray(SQLITE3_ASSOC);
        echo json_encode(['success' => true, 'logado' => true, 'familia' => $f]);
    } else {
        echo json_encode(['success' => true, 'logado' => false]);
    }
    exit();
}

if ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true]);
    exit();
}

if ($method === 'POST' && $action === 'cadastrar') {
    $nome = trim($input['nome_familia'] ?? '');
    $codigo = strtoupper(trim($input['codigo'] ?? ''));
    $senha = $input['senha'] ?? '';

    if (!$nome || !$codigo || !$senha) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Todos os campos são obrigatórios']);
        exit();
    }
    if (strlen($codigo) < 3 || strlen($codigo) > 20) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Código deve ter entre 3 e 20 caracteres']);
        exit();
    }

    // Check if code already exists
    $exists = $db->query("SELECT id_familia FROM familias WHERE codigo = '" . SQLite3::escapeString($codigo) . "'")->fetchArray();
    if ($exists) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Esse código já está em uso. Escolha outro.']);
        exit();
    }

    $hash = password_hash($senha, PASSWORD_DEFAULT);
    $stmt = $db->prepare("INSERT INTO familias (nome, codigo, senha) VALUES (:nome, :codigo, :senha)");
    $stmt->bindValue(':nome', $nome);
    $stmt->bindValue(':codigo', $codigo);
    $stmt->bindValue(':senha', $hash);
    $stmt->execute();
    $id = $db->lastInsertRowID();

    $_SESSION['id_familia'] = $id;
    $_SESSION['nome_familia'] = $nome;

    echo json_encode(['success' => true, 'familia' => ['id_familia' => $id, 'nome' => $nome, 'codigo' => $codigo]]);
    exit();
}

if ($method === 'POST' && $action === 'entrar') {
    $codigo = strtoupper(trim($input['codigo'] ?? ''));
    $senha = $input['senha'] ?? '';

    if (!$codigo || !$senha) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Código e senha são obrigatórios']);
        exit();
    }

    $stmt = $db->prepare("SELECT * FROM familias WHERE codigo = :codigo");
    $stmt->bindValue(':codigo', $codigo);
    $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);

    if (!$row || !password_verify($senha, $row['senha'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Código ou senha incorretos']);
        exit();
    }

    $_SESSION['id_familia'] = $row['id_familia'];
    $_SESSION['nome_familia'] = $row['nome'];

    echo json_encode(['success' => true, 'familia' => ['id_familia' => $row['id_familia'], 'nome' => $row['nome'], 'codigo' => $row['codigo']]]);
    exit();
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Ação inválida']);
?>
