<?php
require_once 'db.php';
$db = getDB();
$id_familia = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? '';

// Redeem a reward
if ($action === 'resgatar' && $method === 'POST') {
    $id_recompensa = (int)($input['id_recompensa'] ?? 0);
    $id_membro = (int)($input['id_membro'] ?? 0);

    $recomp = $db->query("SELECT * FROM recompensas WHERE id_recompensa = $id_recompensa AND id_familia = $id_familia AND ativa = 1")->fetchArray(SQLITE3_ASSOC);
    if (!$recomp) { http_response_code(404); echo json_encode(['success' => false, 'error' => 'Recompensa não encontrada']); exit(); }

    $membro = $db->query("SELECT * FROM membros WHERE id_membro = $id_membro AND id_familia = $id_familia")->fetchArray(SQLITE3_ASSOC);
    if (!$membro) { http_response_code(404); echo json_encode(['success' => false, 'error' => 'Membro não encontrado']); exit(); }

    if ($membro['pontos'] < $recomp['custo_pontos']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Pontos insuficientes! Precisa de ' . $recomp['custo_pontos'] . ' pontos.']);
        exit();
    }

    $custo = (int)$recomp['custo_pontos'];
    $db->exec("UPDATE membros SET pontos = pontos - $custo WHERE id_membro = $id_membro");
    $stmt = $db->prepare("INSERT INTO resgates (id_recompensa, id_membro, pontos_gastos) VALUES (:ir, :im, :pg)");
    $stmt->bindValue(':ir', $id_recompensa);
    $stmt->bindValue(':im', $id_membro);
    $stmt->bindValue(':pg', $custo);
    $stmt->execute();

    $novos_pontos = $membro['pontos'] - $custo;
    echo json_encode(['success' => true, 'pontos_restantes' => $novos_pontos, 'mensagem' => 'Recompensa resgatada! 🎉']);
    exit();
}

switch ($method) {
    case 'GET':
        if ($action === 'historico') {
            $result = $db->query("SELECT r.*, rc.titulo, rc.icone, m.nome as nome_membro, m.avatar
                FROM resgates r
                JOIN recompensas rc ON r.id_recompensa = rc.id_recompensa
                JOIN membros m ON r.id_membro = m.id_membro
                WHERE rc.id_familia = $id_familia
                ORDER BY r.resgatado_em DESC LIMIT 20");
            $hist = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $hist[] = $row;
            echo json_encode(['success' => true, 'data' => $hist]);
            break;
        }
        $result = $db->query("SELECT * FROM recompensas WHERE id_familia = $id_familia AND ativa = 1 ORDER BY custo_pontos ASC");
        $recompensas = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $recompensas[] = $row;
        echo json_encode(['success' => true, 'data' => $recompensas]);
        break;

    case 'POST':
        if (empty($input['titulo']) || empty($input['custo_pontos'])) {
            http_response_code(400); echo json_encode(['success' => false, 'error' => 'Título e custo são obrigatórios']); break;
        }
        $stmt = $db->prepare("INSERT INTO recompensas (id_familia, titulo, descricao, custo_pontos, icone) VALUES (:if, :t, :d, :c, :i)");
        $stmt->bindValue(':if', $id_familia);
        $stmt->bindValue(':t', $input['titulo']);
        $stmt->bindValue(':d', $input['descricao'] ?? '');
        $stmt->bindValue(':c', (int)$input['custo_pontos']);
        $stmt->bindValue(':i', $input['icone'] ?? '🎁');
        $stmt->execute();
        $id = $db->lastInsertRowID();
        $r = $db->query("SELECT * FROM recompensas WHERE id_recompensa = $id")->fetchArray(SQLITE3_ASSOC);
        echo json_encode(['success' => true, 'data' => $r]);
        break;

    case 'DELETE':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID obrigatório']); break; }
        $db->exec("UPDATE recompensas SET ativa = 0 WHERE id_recompensa = $id AND id_familia = $id_familia");
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método não permitido']);
}
?>
