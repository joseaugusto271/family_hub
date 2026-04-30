<?php
require_once 'db.php';
$db = getDB();
$id_familia = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch ($method) {
    case 'GET':
        $result = $db->query("SELECT m.*, 
            (SELECT COUNT(*) FROM atividades WHERE id_membro = m.id_membro) as total_atividades,
            (SELECT COUNT(*) FROM atividades WHERE id_membro = m.id_membro AND status = 'concluida') as concluidas
            FROM membros m WHERE m.id_familia = $id_familia ORDER BY m.nome");
        $membros = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $membros[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $membros]);
        break;

    case 'POST':
        if (empty($input['nome']) || empty($input['papel'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Nome e papel são obrigatórios']);
            break;
        }
        $stmt = $db->prepare("INSERT INTO membros (id_familia, nome, papel, avatar, cor) VALUES (:id_familia, :nome, :papel, :avatar, :cor)");
        $stmt->bindValue(':id_familia', $id_familia);
        $stmt->bindValue(':nome', $input['nome']);
        $stmt->bindValue(':papel', $input['papel']);
        $stmt->bindValue(':avatar', $input['avatar'] ?? '👤');
        $stmt->bindValue(':cor', $input['cor'] ?? '#3b82f6');
        $stmt->execute();
        $id = $db->lastInsertRowID();
        $membro = $db->query("SELECT * FROM membros WHERE id_membro = $id")->fetchArray(SQLITE3_ASSOC);
        echo json_encode(['success' => true, 'data' => $membro]);
        break;

    case 'DELETE':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID obrigatório']); break; }
        // Verify belongs to family
        $check = $db->query("SELECT id_membro FROM membros WHERE id_membro = $id AND id_familia = $id_familia")->fetchArray();
        if (!$check) { http_response_code(403); echo json_encode(['success' => false, 'error' => 'Não autorizado']); break; }
        $db->exec("DELETE FROM resgates WHERE id_membro = $id");
        $db->exec("UPDATE atividades SET id_membro = NULL WHERE id_membro = $id");
        $db->exec("DELETE FROM membros WHERE id_membro = $id");
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método não permitido']);
}
?>
