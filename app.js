// ═══════════════════════════════════════════════
// VARIÁVEIS GLOBAIS
// Guardadas aqui para ficarem acessíveis em todo o arquivo
// ═══════════════════════════════════════════════

const API = 'api'; // Prefixo base de todas as chamadas à API (pasta /api/)
let membros = [],   // Lista de membros da família carregada da API
    familia = null, // Objeto com dados da família logada (nome, código etc.)
    calDate = new Date(); // Data atual usada para navegar no calendário
let resgateAtual = null; // Guarda temporariamente qual recompensa está sendo resgatada

// Mapeamento de cores por tipo de atividade (usado nos gráficos e calendário)
const TC = {
  Escolar: '#1e4fd8',
  Esporte: '#2a7339',
  Social:  '#be185d',
  'Saúde': '#c47d0e',
  Outro:   '#6b7280'
};

// Lista de ícones disponíveis para recompensas (id + referência ao SVG no HTML)
const REWARD_ICONS = [
  {id:'gift',   svg:'<use href="#i-gift"/>'},
  {id:'star',   svg:'<use href="#i-star"/>'},
  {id:'trophy', svg:'<use href="#i-trophy"/>'},
  {id:'cal',    svg:'<use href="#i-cal"/>'},
  {id:'users',  svg:'<use href="#i-users"/>'},
  {id:'home',   svg:'<use href="#i-home"/>'},
];

// Monta o grid de ícones no modal de criar recompensa
// O primeiro ícone começa selecionado por padrão
document.getElementById('icon-grid').innerHTML = REWARD_ICONS.map((ic,i) =>
  `<div class="icon-opt${i===0?' selected':''}" data-v="${ic.id}" onclick="selIcon(this)">
    <svg width="18" height="18" stroke="var(--green)" fill="none">${ic.svg}</svg>
  </div>`).join('');

// ═══════════════════════════════════════════════
// TEMA (claro / escuro)
// ═══════════════════════════════════════════════

// Alterna entre modo claro e escuro ao clicar no botão de tema
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark'; // Inverte o tema atual
  html.setAttribute('data-theme', next);
  localStorage.setItem('fh-theme', next); // Salva a preferência no navegador
  updateThemeUI(next);
}

// Atualiza o ícone e o texto do botão de tema na sidebar e no topbar
function updateThemeUI(theme) {
  const isDark = theme === 'dark';
  const iconHref = isDark ? '#i-sun' : '#i-moon'; // Sol = tema escuro ativo; Lua = tema claro ativo
  const lbl = isDark ? 'Modo claro' : 'Modo escuro';
  document.getElementById('sb-theme-icon').setAttribute('href', iconHref);
  document.getElementById('topbar-theme-icon').setAttribute('href', iconHref);
  document.getElementById('sb-theme-lbl').textContent = lbl;
}

// Inicialização do tema: roda imediatamente ao carregar a página
// Lê o tema salvo no localStorage ou usa 'light' como padrão
(function() {
  const saved = localStorage.getItem('fh-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeUI(saved);
})();

// ═══════════════════════════════════════════════
// AUTENTICAÇÃO (login / cadastro / logout)
// ═══════════════════════════════════════════════

// Verifica se o usuário já está logado ao abrir o app
// Se estiver logado, vai direto para o app; senão mostra a tela de login
async function checkAuth() {
  const r = await api('auth.php?action=check');
  if (r.logado) { familia = r.familia; showApp(); } else showLogin();
}

// Exibe a tela de login e esconde o app principal
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
}

// Exibe o app principal após login bem-sucedido
// Preenche o nome e código da família na sidebar e carrega o dashboard
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('sb-nome').textContent = familia.nome;
  document.getElementById('sb-cod').textContent  = familia.codigo;
  loadStats(); // Carrega os dados do dashboard imediatamente
}

// Alterna entre as abas "Entrar" e "Cadastrar" na tela de login
function switchTab(t) {
  document.querySelectorAll('.login-tab').forEach((el,i) =>
    el.classList.toggle('active', i===(t==='entrar'?0:1))
  );
  document.getElementById('form-entrar').style.display    = t==='entrar'    ? 'block' : 'none';
  document.getElementById('form-cadastrar').style.display = t==='cadastrar' ? 'block' : 'none';
}

// Faz login com código da família e senha
// Exibe mensagem de erro inline se as credenciais forem inválidas
async function doLogin() {
  const codigo = document.getElementById('login-codigo').value.trim().toUpperCase();
  const senha  = document.getElementById('login-senha').value;
  const err    = document.getElementById('err-entrar');
  err.classList.remove('show');
  if (!codigo||!senha) { err.textContent='Preencha todos os campos'; err.classList.add('show'); return; }
  const r = await api('auth.php?action=entrar','POST',{codigo,senha});
  if (r.success) { familia=r.familia; showApp(); }
  else { err.textContent=r.error; err.classList.add('show'); }
}

// Cria uma nova família com nome, código único e senha
async function doRegister() {
  const nome_familia = document.getElementById('reg-nome').value.trim();
  const codigo       = document.getElementById('reg-codigo').value.trim().toUpperCase();
  const senha        = document.getElementById('reg-senha').value;
  const err          = document.getElementById('err-cadastrar');
  err.classList.remove('show');
  if (!nome_familia||!codigo||!senha) { err.textContent='Preencha todos os campos'; err.classList.add('show'); return; }
  const r = await api('auth.php?action=cadastrar','POST',{nome_familia,codigo,senha});
  if (r.success) { familia=r.familia; showApp(); toast('Família criada!'); }
  else { err.textContent=r.error; err.classList.add('show'); }
}

// Faz logout: limpa os dados da sessão em memória e volta para a tela de login
async function doLogout() {
  await api('auth.php?action=logout');
  familia=null; membros=[];
  showLogin();
}

// Atalho de teclado: pressionar Enter na tela de login faz login ou cadastro
document.addEventListener('keydown', e => {
  if (e.key!=='Enter') return;
  const fe = document.getElementById('form-entrar');
  if (fe && fe.style.display!=='none') doLogin(); else doRegister();
});

// ═══════════════════════════════════════════════
// NAVEGAÇÃO entre páginas
// ═══════════════════════════════════════════════

// Lista de IDs das páginas e seus títulos exibidos no topbar
const PAGES  = ['dashboard','membros','atividades','calendario','recompensas','graficos'];
const TITLES = {
  dashboard:   'Dashboard',
  membros:     'Membros',
  atividades:  'Atividades',
  calendario:  'Calendário',
  recompensas: 'Recompensas',
  graficos:    'Gráficos',
};

// Troca a página ativa, atualiza o título e os botões de ação do topbar
// Cada página carrega seus próprios dados ao ser exibida
function showPage(id) {
  // Remove a classe 'active' de todas as páginas e itens do menu
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n,i) => n.classList.toggle('active', PAGES[i]===id));
  document.getElementById('page-'+id).classList.add('active');
  document.getElementById('page-title').textContent = TITLES[id];

  // Limpa os botões do topbar e adiciona o botão correto para cada página
  const ta = document.getElementById('topbar-actions');
  ta.innerHTML = '';
  if      (id==='membros')     { mkBtn(ta,'Novo membro',()=>openM('modal-membro')); loadMembros(); }
  else if (id==='atividades')  { mkBtn(ta,'Nova atividade',()=>openM('modal-ativ')); loadAtividades(); }
  else if (id==='dashboard')   { loadStats(); }
  else if (id==='calendario')  { renderCalendar(); }
  else if (id==='recompensas') { mkBtn(ta,'Nova recompensa',()=>openM('modal-recomp')); loadRecompensas(); loadRankingRecomp(); loadHistorico(); }
  else if (id==='graficos')    { loadGraficos(); }
}

// Cria um botão de ação e o adiciona ao container do topbar
function mkBtn(ta, lbl, fn) {
  const b = document.createElement('button');
  b.className='btn btn-primary';
  b.innerHTML=`<svg width="13" height="13"><use href="#i-plus"/></svg> ${lbl}`;
  b.onclick=fn; ta.appendChild(b);
}

// ═══════════════════════════════════════════════
// COMUNICAÇÃO COM A API (fetch wrapper)
// ═══════════════════════════════════════════════

// Função central que faz todas as requisições ao backend PHP
// ep = endpoint (ex: 'auth.php?action=check')
// method = GET, POST, PUT ou DELETE
// body = objeto que será enviado como JSON no corpo da requisição
async function api(ep, method='GET', body=null) {
  const o = {method, headers:{'Content-Type':'application/json'}, credentials:'same-origin'};
  if (body) o.body = JSON.stringify(body);
  try {
    return await (await fetch(`${API}/${ep}`, o)).json();
  } catch(e) {
    return {success:false, error:e.message}; // Retorna erro padronizado em caso de falha de rede
  }
}

// ═══════════════════════════════════════════════
// TOAST (notificação temporária na tela)
// ═══════════════════════════════════════════════

// Exibe uma mensagem de feedback por 3 segundos
// warn=true usa cor de alerta (vermelho); warn=false usa cor de sucesso (verde)
function toast(msg, warn=false) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.className = 'toast show' + (warn?' warn':'');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000); // Remove automaticamente após 3s
}

// ═══════════════════════════════════════════════
// MODAIS (janelas pop-up)
// ═══════════════════════════════════════════════

// Abre e fecha modais pelo ID do elemento
function openM(id)  { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }

// Fecha o modal ao clicar no fundo escuro (fora do conteúdo)
document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); })
);

// ═══════════════════════════════════════════════
// PICKERS (seletores de cor, ícone e prioridade)
// ═══════════════════════════════════════════════

// Seleciona uma cor no seletor de cores do membro e atualiza o preview do avatar
function selCor(el) {
  document.querySelectorAll('.color-opt').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  updatePreview();
}

// Seleciona um ícone no grid de ícones de recompensa
function selIcon(el) {
  document.querySelectorAll('.icon-opt').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
}

// Seleciona a prioridade da atividade (baixa/média/alta)
// Também ajusta automaticamente os pontos de recompensa conforme a prioridade
function selPri(el) {
  document.querySelectorAll('.pri-opt').forEach(p => p.classList.remove('sel'));
  el.classList.add('sel');
  // Alta = 30 pts, Média = 20 pts, Baixa = 10 pts
  document.getElementById('a-pontos').value = el.dataset.v==='alta'?30:el.dataset.v==='media'?20:10;
}

// Atualiza o preview do avatar do membro com as iniciais e a cor selecionada
function updatePreview() {
  const nome = document.getElementById('m-nome').value;
  const cor  = document.querySelector('.color-opt.selected')?.dataset.v || '#2a7339';
  const p    = document.getElementById('init-prev');
  p.style.background = cor;
  p.textContent = getInits(nome) || 'AB';
}

// ═══════════════════════════════════════════════
// UTILITÁRIOS (funções auxiliares reutilizáveis)
// ═══════════════════════════════════════════════

// Gera as iniciais de um nome (ex: "João Silva" → "JS", "Maria" → "MA")
function getInits(n) {
  if (!n) return '?';
  const p = n.trim().split(/\s+/);
  return p.length>=2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : n.slice(0,2).toUpperCase();
}

// Formata data do formato ISO (AAAA-MM-DD) para o formato BR (DD/MM/AAAA)
function fmtDate(s) {
  if(!s) return '';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// Formata data e hora: se for hoje mostra só o horário, senão mostra data + hora
function fmtDT(s) {
  if(!s) return '';
  const d = new Date(s), now = new Date();
  const hm = d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  return d.toDateString()===now.toDateString() ? hm : fmtDate(s.slice(0,10))+' '+hm;
}

// Retorna a cor associada a cada nível de prioridade
function priColor(p) { return p==='alta'?'#c0392b':p==='media'?'#c47d0e':'#2a7339'; }

// Escapa caracteres HTML para evitar XSS ao inserir texto do usuário no DOM
function esc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Gera o HTML de "estado vazio" com ícone e mensagem (usado quando não há dados)
function emptyEl(icon, msg) {
  return `<div class="empty">
    <div class="empty-icon"><svg width="19" height="19" stroke="var(--muted)" fill="none"><use href="#${icon}"/></svg></div>
    <p>${msg}</p>
  </div>`;
}

// Anima um número subindo de 0 até o valor alvo em 500ms (efeito contador)
function animCount(id, val) {
  const el = document.getElementById(id); if(!el) return;
  const dur=500, s=performance.now();
  const step = n => {
    const p = Math.min((n-s)/dur, 1);
    el.textContent = Math.round(p*val);
    if(p<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════
// DASHBOARD (resumo geral da família)
// ═══════════════════════════════════════════════

// Carrega todas as estatísticas e renderiza os 4 cards, próximas atividades,
// ranking de pontos e gráfico de atividades por tipo
async function loadStats() {
  const r = await api('stats.php'); if(!r.success) return;
  const d = r.data;

  // Anima os números nos cards do topo do dashboard
  animCount('s-mb', d.total_membros);
  animCount('s-co', d.concluidas);
  animCount('s-pe', d.pendentes);
  animCount('s-hj', d.atividades_hoje);

  // Renderiza a lista de próximas atividades (próximos 7 dias)
  const pl = document.getElementById('d-prox');
  pl.innerHTML = d.proximas.length ? d.proximas.map((a,i) => `
    <div class="ai" style="animation-delay:${i*.06}s">
      <div class="ai-pri" style="background:${priColor(a.prioridade)}"></div>
      <div class="ai-info">
        <div class="ai-name">${esc(a.descricao)}</div>
        <div class="ai-meta">${fmtDate(a.data_ativ)}${a.hora_ativ?' · '+a.hora_ativ.slice(0,5):''}${a.nome_membro?' · '+esc(a.nome_membro):''}</div>
      </div>
      <span class="tipo-badge tipo-${a.tipo}">${a.tipo}</span>
    </div>`).join('') : emptyEl('i-cal','Sem atividades nos próximos 7 dias');

  // Renderiza o ranking de membros por pontos com medalhas ouro/prata/bronze
  const mLabels=['1°','2°','3°']; const mClass=['gold','silver','bronze'];
  const rl = document.getElementById('d-rank');
  rl.innerHTML = d.ranking.length ? d.ranking.map((m,i) => `
    <div class="ranking-item" style="animation-delay:${i*.07}s">
      <div class="rank-medal ${mClass[i]||'other'}">${mLabels[i]||i+1}</div>
      <div class="rank-av" style="background:${m.cor}">${getInits(m.nome)}</div>
      <div class="rank-name">${esc(m.nome)}</div>
      <div class="rank-pts">${m.pontos} pts</div>
    </div>`).join('') : emptyEl('i-trophy','Sem membros ainda');

  // Renderiza as barras horizontais por tipo de atividade
  const tipos = document.getElementById('d-tipos');
  if(!d.por_tipo.length) { tipos.innerHTML=emptyEl('i-grid','Sem atividades'); return; }
  const max = Math.max(1,...d.por_tipo.map(t=>t.total));
  tipos.innerHTML = d.por_tipo.map(t => `
    <div class="bar-row">
      <div class="bar-lbl"><span>${t.tipo}</span><span>${t.total}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${t.total/max*100}%;background:${TC[t.tipo]||'#6b7280'}"></div></div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════
// MEMBROS
// ═══════════════════════════════════════════════

// Carrega e renderiza todos os membros da família como cards
async function loadMembros() {
  const r = await api('membros.php'); if(!r.success) return;
  membros = r.data;
  updateSelects(); // Atualiza os dropdowns de membros em todos os formulários
  const g = document.getElementById('members-grid');
  g.innerHTML = membros.length ? membros.map(m => `
    <div class="member-card" style="--mc:${m.cor}">
      <button class="member-del" onclick="delMembro(${m.id_membro})" title="Remover">
        <svg width="12" height="12" stroke="currentColor" fill="none"><use href="#i-x"/></svg>
      </button>
      <div class="member-av" style="background:${m.cor}">${getInits(m.nome)}</div>
      <div class="member-name">${esc(m.nome)}</div>
      <div class="member-role">${m.papel}</div>
      <div class="member-pts-wrap">
        <svg width="12" height="12" stroke="var(--green-d)" fill="none"><use href="#i-star"/></svg>
        <span class="member-pts">${m.pontos} pts</span>
      </div>
      <div class="member-sub">${m.concluidas||0} de ${m.total_atividades||0} concluídas</div>
    </div>`).join('') : emptyEl('i-users','Nenhum membro. Adicione sua família!');
}

// Sincroniza os dropdowns de filtro e seleção com a lista atual de membros
function updateSelects() {
  ['f-membro','a-membro'].forEach(id => {
    const s = document.getElementById(id); if(!s) return;
    // f-membro = filtro de atividades (opção "Todos"); a-membro = atribuição (opção "Família toda")
    const first = id==='f-membro'
      ? '<option value="">Todos os membros</option>'
      : '<option value="">Família toda</option>';
    s.innerHTML = first + membros.map(m =>
      `<option value="${m.id_membro}">${getInits(m.nome)} ${esc(m.nome)}</option>`
    ).join('');
  });
}

// Salva um novo membro via API com nome, papel e cor selecionada
async function saveMembro() {
  const nome  = document.getElementById('m-nome').value.trim();
  const papel = document.getElementById('m-papel').value;
  const cor   = document.querySelector('.color-opt.selected')?.dataset.v || '#2a7339';
  if(!nome) { toast('Informe o nome',true); return; }
  const r = await api('membros.php','POST',{nome,papel,avatar:getInits(nome),cor});
  if(r.success) {
    closeM('modal-membro');
    document.getElementById('m-nome').value='';
    updatePreview();
    toast('Membro adicionado!');
    loadMembros();
  } else toast(r.error,true);
}

// Remove um membro após confirmação do usuário
async function delMembro(id) {
  if(!confirm('Remover este membro?')) return;
  const r = await api('membros.php?id='+id,'DELETE');
  if(r.success) { toast('Membro removido'); loadMembros(); }
}

// ═══════════════════════════════════════════════
// ATIVIDADES
// ═══════════════════════════════════════════════

// Carrega atividades aplicando os filtros ativos (tipo, membro, prioridade, status)
async function loadAtividades() {
  // Garante que a lista de membros está carregada (necessário para os dropdowns)
  if(!membros.length) { const r=await api('membros.php'); if(r.success){membros=r.data;updateSelects();} }

  // Lê os valores dos filtros da interface
  const tipo   = document.getElementById('f-tipo')?.value   || '';
  const membro = document.getElementById('f-membro')?.value || '';
  const pri    = document.getElementById('f-pri')?.value    || '';
  const status = document.getElementById('f-status')?.value || '';

  // Monta a query string com os filtros ativos
  let qs=[]; if(tipo)qs.push('tipo='+tipo); if(membro)qs.push('id_membro='+membro); if(pri)qs.push('prioridade='+pri);
  const r = await api('atividades.php'+(qs.length?'?'+qs.join('&'):''));
  if(!r.success) return;

  // Filtro de status é feito no frontend (a API não filtra por status diretamente)
  let data = r.data; if(status) data=data.filter(a=>a.status===status);

  // Renderiza cada atividade com checkbox, descrição, prioridade e ações
  const list = document.getElementById('acts-list');
  list.innerHTML = data.length ? data.map(a => `
    <div class="act-row ${a.status} pri-${a.prioridade}" id="act-${a.id_ativ}">
      <!-- Checkbox que alterna o status entre pendente e concluída -->
      <div class="act-check" onclick="toggleAtiv(${a.id_ativ},'${a.status}')">
        ${a.status==='concluida'?'<svg width="10" height="10" stroke="#fff" fill="none"><use href="#i-check"/></svg>':''}
      </div>
      <div class="act-desc">${esc(a.descricao)}</div>
      <div class="act-meta">
        <!-- Dropdown inline para trocar a prioridade sem abrir modal -->
        <select class="pri-select s-${a.prioridade}" onchange="changePri(${a.id_ativ},this.value)">
          <option value="baixa"${a.prioridade==='baixa'?' selected':''}>Baixa</option>
          <option value="media"${a.prioridade==='media'?' selected':''}>Média</option>
          <option value="alta"${a.prioridade==='alta'?' selected':''}>Alta</option>
        </select>
        <span class="tipo-badge tipo-${a.tipo}">${a.tipo}</span>
        <span class="act-date">${fmtDate(a.data_ativ)}${a.hora_ativ?' · '+a.hora_ativ.slice(0,5):''}</span>
        ${a.nome_membro?`<span style="font-size:0.72rem;color:var(--muted)">${esc(a.nome_membro)}</span>`:''}
        <span class="act-pts">${a.pontos_recompensa} pts</span>
      </div>
      <button class="act-del" onclick="delAtiv(${a.id_ativ})" title="Remover">
        <svg width="12" height="12" stroke="currentColor" fill="none"><use href="#i-trash"/></svg>
      </button>
    </div>`).join('') : emptyEl('i-check2','Nenhuma atividade encontrada');
}

// Salva uma nova atividade com todos os campos do formulário
async function saveAtiv() {
  const descricao        = document.getElementById('a-desc').value.trim();
  const tipo             = document.getElementById('a-tipo').value;
  const id_membro        = document.getElementById('a-membro').value || null;
  const data_ativ        = document.getElementById('a-data').value;
  const hora_ativ        = document.getElementById('a-hora').value;
  const prioridade       = document.querySelector('.pri-opt.sel')?.dataset.v || 'baixa';
  const pontos_recompensa = parseInt(document.getElementById('a-pontos').value) || 10;
  if(!descricao||!data_ativ) { toast('Preencha descrição e data',true); return; }
  const r = await api('atividades.php','POST',{descricao,tipo,id_membro,data_ativ,hora_ativ,prioridade,pontos_recompensa});
  if(r.success) {
    closeM('modal-ativ');
    document.getElementById('a-desc').value='';
    document.getElementById('a-hora').value='';
    toast('Atividade adicionada!');
    // Só recarrega a lista se a página de atividades estiver visível
    if(document.getElementById('page-atividades').classList.contains('active')) loadAtividades();
  } else toast(r.error,true);
}

// Alterna o status de uma atividade entre 'pendente' e 'concluida'
// Se ganhou pontos ao concluir, exibe o toast com os pontos ganhos
async function toggleAtiv(id, cur) {
  const newS = cur==='concluida' ? 'pendente' : 'concluida';
  const r = await api('atividades.php?id='+id,'PUT',{status:newS});
  if(r.success) { if(r.pontos_ganhos) toast('+'+r.pontos_ganhos+' pontos!'); loadAtivdades(); }
}i

// Muda a prioridade de uma atividade diretamente pelo dropdown na lista
async function changePri(id, p) { await api('atividades.php?id='+id,'PUT',{prioridade:p}); loadAtividades(); }

// Remove uma atividade após confirmação
async function delAtiv(id) {
  if(!confirm('Remover atividade?')) return;
  const r = await api('atividades.php?id='+id,'DELETE');
  if(r.success) { toast('Removida'); loadAtividades(); }
}

// ═══════════════════════════════════════════════
// CALENDÁRIO
// ═══════════════════════════════════════════════

// Renderiza o calendário do mês atual com as atividades agrupadas por dia
async function renderCalendar() {
  const y=calDate.getFullYear(), mo=calDate.getMonth();
  const ms=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('cal-lbl').textContent = ms[mo]+' '+y;

  // Busca atividades do mês inteiro de uma vez
  const r = await api(`atividades.php?mes=${mo+1}&ano=${y}`);
  const ativs = r.success ? r.data : [];

  // Agrupa as atividades por data (chave = 'AAAA-MM-DD')
  const byD = {};
  ativs.forEach(a => { if(!byD[a.data_ativ]) byD[a.data_ativ]=[]; byD[a.data_ativ].push(a); });

  // Monta a legenda de cores por tipo no rodapé do calendário
  const tipos = [...new Set(ativs.map(a => a.tipo))];
  document.getElementById('cal-leg').innerHTML = tipos.map(t =>
    `<div class="leg-item"><div class="leg-dot" style="background:${TC[t]||'#6b7280'}"></div><span>${t}</span></div>`
  ).join('');

  // Renderiza o grid: cabeçalho com os dias + células do mês
  const days=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const fd  = new Date(y,mo,1).getDay();       // Dia da semana do 1º dia do mês (0=Dom)
  const dim = new Date(y,mo+1,0).getDate();    // Total de dias no mês
  const today = new Date().toISOString().slice(0,10);

  let h = days.map(d => `<div class="cal-dh">${d}</div>`).join('');

  // Células em branco antes do primeiro dia do mês
  for(let i=0; i<fd; i++) h += '<div class="cal-day empty"></div>';

  for(let d=1; d<=dim; d++) {
    const ds   = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const acts = byD[ds] || [];
    const isT  = ds===today; // Destaca o dia de hoje

    // Mostra até 3 atividades por célula, com indicador "+N mais" se houver mais
    const evts = acts.slice(0,3).map(a =>
      `<div class="cal-evt" style="background:${TC[a.tipo]||'#6b7280'}20;color:${TC[a.tipo]||'#6b7280'};border-left:2px solid ${TC[a.tipo]||'#6b7280'}">${esc(a.descricao)}</div>`
    ).join('');
    const more = acts.length>3 ? `<div style="font-size:0.57rem;color:var(--muted)">+${acts.length-3} mais</div>` : '';

    h += `<div class="cal-day${isT?' today':''}" onclick="calDayClick('${ds}')">
      <div class="cal-day-num">${d}</div>${evts}${more}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML = h;
}

// Avança ou retrocede o mês no calendário (+1 ou -1)
function calNav(d) { calDate.setMonth(calDate.getMonth()+d); renderCalendar(); }

// Ao clicar em um dia, pré-preenche a data no formulário e abre o modal de nova atividade
function calDayClick(ds) {
  document.getElementById('a-data').value = ds;
  openM('modal-ativ');
}

// ═══════════════════════════════════════════════
// RECOMPENSAS
// ═══════════════════════════════════════════════

// Carrega e renderiza o catálogo de recompensas disponíveis
async function loadRecompensas() {
  // Garante que a lista de membros está disponível (para o modal de resgate)
  if(!membros.length) { const r=await api('membros.php'); if(r.success) membros=r.data; }
  const r = await api('recompensas.php'); if(!r.success) return;
  const g = document.getElementById('rewards-grid');
  g.innerHTML = r.data.length ? r.data.map(rc => {
    const ic = REWARD_ICONS.find(x=>x.id===rc.icone) || REWARD_ICONS[0];
    return `<div class="reward-card">
      <button class="reward-del" onclick="delRecomp(${rc.id_recompensa})">
        <svg width="12" height="12" stroke="currentColor" fill="none"><use href="#i-x"/></svg>
      </button>
      <div class="reward-icon-wrap"><svg width="20" height="20" stroke="var(--green)" fill="none">${ic.svg}</svg></div>
      <div class="reward-title">${esc(rc.titulo)}</div>
      ${rc.descricao?`<div class="reward-desc">${esc(rc.descricao)}</div>`:''}
      <div class="reward-cost">
        <svg width="11" height="11" stroke="currentColor" fill="none"><use href="#i-star"/></svg> ${rc.custo_pontos} pts
      </div>
      <button class="btn btn-primary btn-sm" onclick="abrirResgate(${rc.id_recompensa},'${esc(rc.titulo)}',${rc.custo_pontos})">Resgatar</button>
    </div>`;}).join('') : emptyEl('i-gift','Nenhuma recompensa ainda.');
}

// Carrega o ranking de membros por pontos na aba de recompensas
async function loadRankingRecomp() {
  const r = await api('stats.php'); if(!r.success) return;
  const mL=['1°','2°','3°'], mC=['gold','silver','bronze'];
  document.getElementById('r-rank').innerHTML = r.data.ranking.length ? r.data.ranking.map((m,i) => `
    <div class="ranking-item" style="animation-delay:${i*.07}s">
      <div class="rank-medal ${mC[i]||'other'}">${mL[i]||i+1}</div>
      <div class="rank-av" style="background:${m.cor}">${getInits(m.nome)}</div>
      <div class="rank-name">${esc(m.nome)}</div>
      <div class="rank-pts">${m.pontos} pts</div>
    </div>`).join('') : emptyEl('i-trophy','Sem membros');
}

// Carrega e exibe o histórico de resgates de recompensas
async function loadHistorico() {
  const r = await api('recompensas.php?action=historico'); if(!r.success) return;
  document.getElementById('r-hist').innerHTML = r.data.length ? r.data.map((x,i) => {
    const ic = REWARD_ICONS.find(ri=>ri.id===x.icone) || REWARD_ICONS[0];
    return `<div class="ai" style="animation-delay:${i*.05}s">
      <div style="width:28px;height:28px;background:var(--green-l);border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="14" height="14" stroke="var(--green)" fill="none">${ic.svg}</svg>
      </div>
      <div class="ai-info">
        <div class="ai-name">${esc(x.nome_membro)} → <strong>${esc(x.titulo)}</strong></div>
        <div class="ai-meta">${x.pontos_gastos} pts · ${fmtDT(x.resgatado_em)}</div>
      </div>
    </div>`;}).join('') : emptyEl('i-history','Nenhum resgate ainda');
}

// Cria uma nova recompensa com título, descrição, custo em pontos e ícone
async function saveRecomp() {
  const titulo       = document.getElementById('rc-titulo').value.trim();
  const descricao    = document.getElementById('rc-desc').value.trim();
  const custo_pontos = parseInt(document.getElementById('rc-custo').value) || 50;
  const icone        = document.querySelector('.icon-opt.selected')?.dataset.v || 'gift';
  if(!titulo) { toast('Informe o título',true); return; }
  const r = await api('recompensas.php','POST',{titulo,descricao,custo_pontos,icone});
  if(r.success) {
    closeM('modal-recomp');
    document.getElementById('rc-titulo').value='';
    document.getElementById('rc-desc').value='';
    toast('Recompensa criada!');
    loadRecompensas();
  } else toast(r.error,true);
}

// Remove uma recompensa após confirmação
async function delRecomp(id) {
  if(!confirm('Remover?')) return;
  const r = await api('recompensas.php?id='+id,'DELETE');
  if(r.success) { toast('Removida'); loadRecompensas(); }
}

// Abre o modal de resgate mostrando quais membros têm pontos suficientes
function abrirResgate(id_r, titulo, custo) {
  resgateAtual = {id_r, custo}; // Salva qual recompensa está sendo resgatada
  document.getElementById('rsg-titulo').textContent = `Resgatar: ${titulo} (${custo} pts)`;

  // Renderiza a lista de membros indicando se têm pontos suficientes ou não
  document.getElementById('rsg-list').innerHTML = membros.map(m => `
    <div class="msl-item" onclick="selRsg(this,${m.id_membro})" data-mid="${m.id_membro}">
      <div class="msl-av" style="background:${m.cor}">${getInits(m.nome)}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:0.84rem">${esc(m.nome)}</div>
        <div style="font-size:0.71rem;color:var(--muted)">${m.pontos} pts disponíveis</div>
      </div>
      ${m.pontos>=custo
        ? '<span style="color:var(--green);font-size:0.71rem;font-weight:600">Ok</span>'
        : `<span style="color:var(--red);font-size:0.71rem">Faltam ${custo-m.pontos}</span>`}
    </div>`).join('');
  openM('modal-resgatar');
}

// Marca o membro selecionado no modal de resgate
function selRsg(el) {
  document.querySelectorAll('.msl-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
}

// Confirma o resgate: desconta os pontos do membro e registra no histórico
async function confirmarResgate() {
  const sel = document.querySelector('.msl-item.selected');
  if(!sel) { toast('Selecione um membro',true); return; }
  const id_membro = parseInt(sel.dataset.mid);
  const r = await api('recompensas.php?action=resgatar','POST',{id_recompensa:resgateAtual.id_r,id_membro});
  if(r.success) {
    closeM('modal-resgatar');
    toast(r.mensagem);
    // Atualiza os pontos na lista local sem precisar recarregar do servidor
    const m = membros.find(x=>x.id_membro===id_membro);
    if(m) m.pontos = r.pontos_restantes;
    loadRecompensas(); loadRankingRecomp(); loadHistorico();
  } else toast(r.error,true);
}

// ═══════════════════════════════════════════════
// GRÁFICOS (página de visualização de dados)
// ═══════════════════════════════════════════════

// Carrega os dados da API e distribui para cada gráfico específico
async function loadGraficos() {
  const r = await api('stats.php'); if(!r.success) return;
  const d = r.data;
  drawLine(d.ultimos7||[]);          // Gráfico de linha: atividades nos últimos 7 dias
  drawDonut(d.prioridades||[]);      // Gráfico de rosca: distribuição por prioridade
  drawMembers(d.membro_progress||[]); // Barras horizontais: progresso de cada membro
  drawTipos(d.por_tipo||[]);         // Barras horizontais: total por tipo de atividade
}

// Desenha o gráfico de linha (atividades dos últimos 7 dias) usando SVG puro
// Inclui grid de referência, área preenchida, linha, pontos e rótulos
function drawLine(data) {
  const wrap = document.getElementById('chart-line-wrap'); if(!wrap) return;
  const W=wrap.offsetWidth||600, H=155;
  const pad={t:14,r:14,b:30,l:26}; // Margens internas do gráfico
  const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
  const maxV = Math.max(1,...data.map(d=>d.total));

  // Funções de escala: convertem valor em posição X ou Y no SVG
  const xS = i => pad.l+(i/(data.length-1||1))*iW;
  const yS = v => pad.t+iH-(v/maxV)*iH;

  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">`;

  // Linhas de grade horizontais com rótulos de valores
  [0,.25,.5,.75,1].forEach(p => {
    const y = pad.t+iH*(1-p);
    svg += `<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="var(--border)" stroke-dasharray="3 3"/>`;
    svg += `<text x="${pad.l-4}" y="${y+3.5}" text-anchor="end" class="lc-lbl">${Math.round(maxV*p)}</text>`;
  });

  // Área preenchida e linha do gráfico (só desenhadas se houver mais de 1 ponto)
  if(data.length>1) {
    const areaPts = `${pad.l},${pad.t+iH} `+data.map((d,i)=>`${xS(i)},${yS(d.total)}`).join(' ')+` ${W-pad.r},${pad.t+iH}`;
    const linePts = data.map((d,i)=>`${xS(i)},${yS(d.total)}`).join(' ');
    svg += `<polygon points="${areaPts}" fill="#2a7339" opacity=".1"/>`; // Área semitransparente
    svg += `<polyline points="${linePts}" fill="none" stroke="#2a7339" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Pontos circulares, valores acima de cada ponto e rótulos de dia abaixo
  data.forEach((d,i) => {
    const x=xS(i), y=yS(d.total);
    svg += `<circle cx="${x}" cy="${y}" r="3.5" fill="#2a7339"/>`;
    if(d.total>0) svg += `<text x="${x}" y="${y-7}" text-anchor="middle" class="lc-val">${d.total}</text>`;
    svg += `<text x="${x}" y="${H-3}" text-anchor="middle" class="lc-lbl">${d.dia}</text>`;
  });
  svg += '</svg>';
  wrap.innerHTML = svg;
}

// Desenha o gráfico de rosca (donut) com a distribuição de prioridades
// Calculado com arcos SVG a partir dos ângulos de cada fatia
function drawDonut(prioridades) {
  const svg = document.getElementById('donut-svg');
  const leg = document.getElementById('donut-legend');
  if(!svg||!leg) return;
  const total = prioridades.reduce((s,p)=>s+p.total,0);
  const colors = {alta:'#c0392b', media:'#c47d0e', baixa:'#2a7339'};
  const labels = {alta:'Alta', media:'Média', baixa:'Baixa'};

  // Estado vazio: mostra um círculo cinza com texto "Sem dados"
  if(!total) {
    svg.innerHTML = `<circle cx="55" cy="55" r="40" fill="none" stroke="var(--border)" stroke-width="16"/>
    <text x="55" y="59" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Figtree">Sem dados</text>`;
    leg.innerHTML = ''; return;
  }

  const cx=55, cy=55, r=38, sw=16;
  let angle = -Math.PI/2; // Começa do topo (12h)
  let paths = '';

  prioridades.forEach(p => {
    if(!p.total) return;
    const frac=p.total/total, a=frac*2*Math.PI, end=angle+a;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    const x2=cx+r*Math.cos(end),   y2=cy+r*Math.sin(end);
    // large-arc-flag=1 quando a fatia ocupa mais de 180°
    paths += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${a>Math.PI?1:0} 1 ${x2} ${y2}" fill="none" stroke="${colors[p.prioridade]||'#6b7280'}" stroke-width="${sw}"><title>${labels[p.prioridade]}: ${p.total}</title></path>`;
    angle = end;
  });

  // Total no centro do donut
  svg.innerHTML = paths +
    `<text x="55" y="51" text-anchor="middle" font-size="17" font-weight="700" fill="var(--text)" font-family="Figtree">${total}</text>
     <text x="55" y="64" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="Figtree">total</text>`;

  // Legenda colorida abaixo do gráfico
  leg.innerHTML = prioridades.map(p =>
    `<div class="d-leg"><div class="d-dot" style="background:${colors[p.prioridade]||'#6b7280'}"></div><span class="d-lbl">${labels[p.prioridade]||p.prioridade}</span><span class="d-val">${p.total}</span></div>`
  ).join('');
}

// Desenha barras horizontais mostrando o percentual de conclusão de cada membro
function drawMembers(members) {
  const el = document.getElementById('chart-members'); if(!el) return;
  if(!members.length) { el.innerHTML=emptyEl('i-users','Sem membros'); return; }
  el.innerHTML = members.map(m => {
    const pct = m.total>0 ? Math.round(m.concluidas/m.total*100) : 0; // Percentual de conclusão
    return `<div class="hbar">
      <div class="hbar-av" style="background:${m.cor}">${getInits(m.nome)}</div>
      <div class="hbar-info">
        <div class="hbar-name">${esc(m.nome)}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${m.cor}"></div></div>
      </div>
      <div class="hbar-pct">${pct}%</div>
    </div>`;}).join('');
}

// Desenha barras horizontais com o total de atividades por tipo
// A barra mais longa representa o tipo com mais atividades (100%)
function drawTipos(tipos) {
  const el = document.getElementById('chart-tipos'); if(!el) return;
  if(!tipos.length) { el.innerHTML=emptyEl('i-grid','Sem atividades'); return; }
  const max = Math.max(1,...tipos.map(t=>t.total)); // Valor máximo para normalizar as barras
  el.innerHTML = tipos.map(t => `
    <div class="bar-row">
      <div class="bar-lbl"><span>${t.tipo}</span><span>${t.total}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${t.total/max*100}%;background:${TC[t.tipo]||'#6b7280'}"></div></div>
    </div>`).join('');
}
