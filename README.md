# FamilyHub v2 — Gestão da Familia

## Como Rodar
```bash
cd familyhub
php -S localhost:8080
```
Acesse: http://localhost:8080

## Estrutura
```
familyhub/
├── index.html          ← Frontend (HTML + CSS + JS)
├── familyhub.db        ← SQLite (criado automaticamente)
└── api/
    ├── db.php          ← Tabelas + helpers de sessão
    ├── auth.php        ← Login / Cadastro / Logout
    ├── membros.php     ← CRUD membros + pontos
    ├── atividades.php  ← CRUD atividades + prioridade
    ├── recompensas.php ← Catálogo + resgates
    └── stats.php       ← Dashboard + ranking
```

## Funcionalidades
- Login por família (código único + senha)
- Membros com avatares, cores e pontos
- Atividades com prioridade: Verde/Amarelo/Vermelho
- Sistema de recompensas com troca de pontos
- Exportação para Google Calendar
