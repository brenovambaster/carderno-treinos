# Caderno de Treino

App (PWA) para registrar as séries na academia, receber a sugestão de carga do próximo treino e acompanhar a evolução das cargas e das medidas do corpo. Cada usuário entra com o Google, por convite, e tem a própria ficha de treino. O Admin convida e gerencia os usuários; o Personal monta a ficha dos alunos dele.

- **Para colocar no ar:** [SETUP.md](SETUP.md)
- **Vocabulário do projeto:** [CONTEXT.md](CONTEXT.md)
- **Decisões:** [docs/adr](docs/adr)

## Como está organizado

| Pasta | O que tem |
| --- | --- |
| `supabase/migrations` | Esquema do banco, regras de acesso (RLS), catálogo e Ficha padrão |
| `src/lib` | Regras puras: sugestão de carga, próximo treino, edição da ficha, metas de calorias e proteína |
| `src/dados` | Conversa com o servidor, cópias locais e fila de pendências (IndexedDB) |
| `src/telas` | Treino, Evolução, Medidas, Perfil, Ficha, Usuários, Catálogo e telas de entrada |
| `src/componentes` | Peças das telas: navegação, cronômetro, gráficos, atividade dos últimos 30 dias, editor de ficha |
| `src/tema.ts` | Tema MUI: cores, fontes e modo escuro |
| `scripts/backup.sh` | Backup diário do banco, para rodar no servidor com Docker |

Stack: React + Vite + vite-plugin-pwa, MUI (componentes) e MUI X Charts (gráficos), Supabase (Postgres, login Google, API), hospedagem na Vercel.
