# Caderno de Treino

App (PWA) para registrar as séries na academia, receber a sugestão de carga do próximo treino e acompanhar a evolução das cargas e das medidas do corpo. Cada usuário entra com o Google, por convite, e vê só os próprios dados.

- **Para colocar no ar:** [SETUP.md](SETUP.md)
- **Vocabulário do projeto:** [CONTEXT.md](CONTEXT.md)
- **Decisões:** [docs/adr](docs/adr)

## Como está organizado

| Pasta | O que tem |
| --- | --- |
| `supabase/migrations` | Esquema do banco, regras de acesso (RLS) e a rotina padrão |
| `src/lib` | Regras puras: sugestão de carga, próximo treino, metas de calorias e proteína |
| `src/dados` | Conversa com o servidor, cópias locais e fila de pendências (IndexedDB) |
| `src/telas` | Treino, Evolução, Medidas, Plano e telas de entrada |
| `scripts/backup.sh` | Backup diário do banco, para rodar no servidor com Docker |

Stack: React + Vite + vite-plugin-pwa, Supabase (Postgres, login Google, API), hospedagem na Vercel.
