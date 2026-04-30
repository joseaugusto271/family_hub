<?php
require_once 'db.php';
$db = getDB();
$id_familia = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch ($method) {
    case 'GET':
        $where = ["a.id_familia = $id_familia"];
        $params = [];

        if (!empty($_GET['mes']) && !empty($_GET['ano'])) {
            $where[] = "strftime('%m', a.data_ativ) = :mes AND strftime('%Y', a.data_ativ) = :ano";
            $params[':mes'] = str_pad($_GET['mes'], 2, '0', STR_PAD_LEFT);
            $params[':ano'] = $_GET['ano'];
        }
        if (!empty($_GET['id_membro'])) {
            $where[] = "a.id_membro = :id_membro";
            $params[':id_membro'] = (int)$_GET['id_membro'];
        }
        if (!empty($_GET['tipo'])) {
            $where[] = "a.tipo = :tipo";
            $params[':tipo'] = $_GET['tipo'];
        }
        if (!empty($_GET['prioridade'])) {
            $where[] = "a.prioridade = :prioridade";
            $params[':prioridade'] = $_GET['prioridade'];
        }

        $sql = "SELECT a.*, m.nome as nome_membro, m.avatar, m.cor as cor_membro
                FROM atividades a
                LEFT JOIN membros m ON a.id_membro = m.id_membro
                WHERE " . implode(' AND ', $where) . "
                ORDER BY CASE a.prioridade WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, a.data_ativ ASC, a.hora_ativ ASC";

        $stmt = $db->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $result = $stmt->execute();

        $atividades = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $atividades[] = $row;
        echo json_encode(['success' => true, 'data' => $atividades]);
        break;

    case 'POST':
        if (empty($input['descricao']) || empty($input['tipo']) || empty($input['data_ativ'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Campos obrigatórios faltando']);
            break;
        }
        $prioridade = $input['prioridade'] ?? 'baixa';
        $pontos = match($prioridade) { 'alta' => 30, 'media' => 20, default => 10 };
        if (isset($input['pontos_recompensa'])) $pontos = (int)$input['pontos_recompensa'];

        $stmt = $db->prepare("INSERT INTO atividades (id_familia, descricao, tipo, id_membro, data_ativ, hora_ativ, status, prioridade, pontos_recompensa, google_event_id)
                               VALUES (:id_familia, :descricao, :tipo, :id_membro, :data_ativ, :hora_ativ, :status, :prioridade, :pontos, :geid)");
        $stmt->bindValue(':id_familia', $id_familia);
        $stmt->bindValue(':descricao', $input['descricao']);
        $stmt->bindValue(':tipo', $input['tipo']);
        $stmt->bindValue(':id_membro', !empty($input['id_membro']) ? (int)$input['id_membro'] : null);
        $stmt->bindValue(':data_ativ', $input['data_ativ']);
        $stmt->bindValue(':hora_ativ', $input['hora_ativ'] ?? null);
        $stmt->bindValue(':status', 'pendente');
        $stmt->bindValue(':prioridade', $prioridade);
        $stmt->bindValue(':pontos', $pontos);
        $stmt->bindValue(':geid', $input['google_event_id'] ?? null);
        $stmt->execute();
        $id = $db->lastInsertRowID();
        $ativ = $db->query("SELECT a.*, m.nome as nome_membro, m.avatar, m.cor as cor_membro FROM atividades a LEFT JOIN membros m ON a.id_membro = m.id_membro WHERE a.id_ativ = $id")->fetchArray(SQLITE3_ASSOC);
        echo json_encode(['success' => true, 'data' => $ativ]);
        break;

    case 'PUT':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID obrigatório']); break; }

        // Verify belongs to family
        $ativ = $db->query("SELECT * FROM atividades WHERE id_ativ = $id AND id_familia = $id_familia")->fetchArray(SQLITE3_ASSOC);
        if (!$ativ) { http_response_code(403); echo json_encode(['success' => false, 'error' => 'Não autorizado']); break; }

        if (isset($input['status'])) {
            $newStatus = $input['status'];
            $stmt = $db->prepare("UPDATE atividades SET status = :status WHERE id_ativ = :id");
            $stmt->bindValue(':status', $newStatus);
            $stmt->bindValue(':id', $id);
            $stmt->execute();

            // Award points when completing
            if ($newStatus === 'concluida' && $ativ['status'] !== 'concluida' && $ativ['id_membro']) {
                $pontos = (int)$ativ['pontos_recompensa'];
                $db->exec("UPDATE membros SET pontos = pontos + $pontos WHERE id_membro = " . (int)$ativ['id_membro']);
                echo json_encode(['success' => true, 'pontos_ganhos' => $pontos]);
                break;
            }
            // Remove points if un-completing
            if ($newStatus === 'pendente' && $ativ['status'] === 'concluida' && $ativ['id_membro']) {
                $pontos = (int)$ativ['pontos_recompensa'];
                $db->exec("UPDATE membros SET pontos = MAX(0, pontos - $pontos) WHERE id_membro = " . (int)$ativ['id_membro']);
            }
        }

        if (isset($input['prioridade'])) {
            $stmt = $db->prepare("UPDATE atividades SET prioridade = :p WHERE id_ativ = :id");
            $stmt->bindValue(':p', $input['prioridade']);
            $stmt->bindValue(':id', $id);
            $stmt->execute();
        }

        echo json_encode(['success' => true]);
        break;

    case 'DELETE':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID obrigatório']); break; }
        $check = $db->query("SELECT id_ativ FROM atividades WHERE id_ativ = $id AND id_familia = $id_familia")->fetchArray();
        if (!$check) { http_response_code(403); echo json_encode(['success' => false, 'error' => 'Não autorizado']); break; }
        $db->exec("DELETE FROM atividades WHERE id_ativ = $id");
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método não permitido']);
}
?>
