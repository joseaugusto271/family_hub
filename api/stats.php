<?php
require_once 'db.php';
$db = getDB();
$id_familia = requireAuth();

$totalMembros = $db->query("SELECT COUNT(*) as c FROM membros WHERE id_familia = $id_familia")->fetchArray()['c'];
$totalAtividades = $db->query("SELECT COUNT(*) as c FROM atividades WHERE id_familia = $id_familia")->fetchArray()['c'];
$concluidas = $db->query("SELECT COUNT(*) as c FROM atividades WHERE id_familia = $id_familia AND status = 'concluida'")->fetchArray()['c'];
$pendentes = $db->query("SELECT COUNT(*) as c FROM atividades WHERE id_familia = $id_familia AND status = 'pendente'")->fetchArray()['c'];
$hoje = date('Y-m-d');
$atividadesHoje = $db->query("SELECT COUNT(*) as c FROM atividades WHERE id_familia = $id_familia AND data_ativ = '$hoje'")->fetchArray()['c'];

$tiposResult = $db->query("SELECT tipo, COUNT(*) as total FROM atividades WHERE id_familia = $id_familia GROUP BY tipo");
$tipos = [];
while ($row = $tiposResult->fetchArray(SQLITE3_ASSOC)) $tipos[] = $row;

$em7dias = date('Y-m-d', strtotime('+7 days'));
$proximasResult = $db->query("SELECT a.*, m.nome as nome_membro, m.avatar, m.cor as cor_membro
    FROM atividades a LEFT JOIN membros m ON a.id_membro = m.id_membro
    WHERE a.id_familia = $id_familia AND a.data_ativ BETWEEN '$hoje' AND '$em7dias' AND a.status = 'pendente'
    ORDER BY CASE a.prioridade WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, a.data_ativ, a.hora_ativ LIMIT 6");
$proximas = [];
while ($row = $proximasResult->fetchArray(SQLITE3_ASSOC)) $proximas[] = $row;

// Top members by points
$rankingResult = $db->query("SELECT id_membro, nome, avatar, cor, pontos FROM membros WHERE id_familia = $id_familia ORDER BY pontos DESC LIMIT 5");
$ranking = [];
while ($row = $rankingResult->fetchArray(SQLITE3_ASSOC)) $ranking[] = $row;

// Last 7 days activity count (for line chart)
$ultimos7 = [];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $label = date('d/m', strtotime("-$i days"));
    $total = $db->query("SELECT COUNT(*) as c FROM atividades WHERE id_familia = $id_familia AND data_ativ = '$d'")->fetchArray()['c'];
    $conc  = $db->query("SELECT COUNT(*) as c FROM atividades WHERE id_familia = $id_familia AND data_ativ = '$d' AND status = 'concluida'")->fetchArray()['c'];
    $ultimos7[] = ['dia' => $label, 'total' => (int)$total, 'concluidas' => (int)$conc];
}

// Priority breakdown
$prioridades = [];
foreach (['alta','media','baixa'] as $p) {
    $c = $db->query("SELECT COUNT(*) as c FROM atividades WHERE id_familia = $id_familia AND prioridade = '$p'")->fetchArray()['c'];
    $prioridades[] = ['prioridade' => $p, 'total' => (int)$c];
}

// Member progress (tasks done vs total)
$membProgress = [];
$mpResult = $db->query("SELECT m.id_membro, m.nome, m.cor,
    (SELECT COUNT(*) FROM atividades WHERE id_membro = m.id_membro) as total,
    (SELECT COUNT(*) FROM atividades WHERE id_membro = m.id_membro AND status = 'concluida') as concluidas,
    m.pontos
    FROM membros m WHERE m.id_familia = $id_familia ORDER BY concluidas DESC LIMIT 6");
while ($row = $mpResult->fetchArray(SQLITE3_ASSOC)) $membProgress[] = $row;

echo json_encode([
    'success' => true,
    'data' => [
        'total_membros'    => $totalMembros,
        'total_atividades' => $totalAtividades,
        'concluidas'       => $concluidas,
        'pendentes'        => $pendentes,
        'atividades_hoje'  => $atividadesHoje,
        'por_tipo'         => $tipos,
        'proximas'         => $proximas,
        'ranking'          => $ranking,
        'ultimos7'         => $ultimos7,
        'prioridades'      => $prioridades,
        'membro_progress'  => $membProgress,
    ]
]);
?>
