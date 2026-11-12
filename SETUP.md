# Como colocar o Caderno de Treino no ar

## O que já está pronto

- **Banco no Supabase**: projeto `caderno-treino`, região São Paulo, plano grátis. Já tem as tabelas, as regras de acesso e a rotina padrão (6 treinos, 40 exercícios).
- **O app** (esta pasta): o arquivo `.env` já aponta para esse projeto. A chave que está nele é a "publishable", feita para ir no navegador; quem protege os dados são as regras do banco.

Falta o que depende das suas contas: liberar seu e-mail, ligar o login do Google, publicar na Vercel e agendar o backup.

## 1. Liberar o seu e-mail

No Supabase, abra **SQL Editor** e rode, com o e-mail da conta Google que você vai usar:

```sql
insert into public.convites (email) values ('seu-email@gmail.com');
```

O mesmo comando serve para convidar outra pessoa. Para tirar alguém: `delete from public.convites where email = '...'`. Para apagar também os dados dessa pessoa, apague o usuário em **Authentication → Users**.

## 2. Publicar na Vercel

1. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o repositório `caderno-treino` do GitHub.
2. A Vercel reconhece o Vite sozinha. Não precisa configurar variáveis de ambiente, porque elas estão no `.env`.
3. Clique em **Deploy** e anote o endereço gerado (ex.: `https://caderno-treino.vercel.app`). Nos passos abaixo, `SEU-ENDERECO` é esse endereço.

## 3. Ligar o login com Google

Guia oficial, com imagens: <https://supabase.com/docs/guides/auth/social-login/auth-google>

**No Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com)):

1. Crie um projeto (ex.: "Caderno de Treino").
2. Em **Google Auth Platform**, configure a tela de consentimento: nome do app, seu e-mail de suporte e público **Externo**. Depois, em **Público**, clique em **Publicar app**. Enquanto o app estiver em "Teste", só entra quem você cadastrar como testador.
3. Em **Clientes → Criar cliente**, escolha **Aplicativo da Web** e preencha:
   - Origens JavaScript autorizadas: `SEU-ENDERECO` e `http://localhost:5173`
   - URIs de redirecionamento autorizados: `https://gfbjkzzevzbfpsczgrvd.supabase.co/auth/v1/callback`
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.

**No Supabase**:

1. Em **Authentication → Sign In / Providers → Google**, ative o provedor, cole o ID e a chave secreta e salve.
2. Em **Authentication → URL Configuration**:
   - Site URL: `SEU-ENDERECO`
   - Redirect URLs: `SEU-ENDERECO/**` e `http://localhost:5173/**`

## 4. Instalar no celular

Abra `SEU-ENDERECO` e entre com o Google. Depois:

- **Android (Chrome)**: menu ⋮ → **Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari)**: botão Compartilhar → **Adicionar à Tela de Início**.

Instalado, o app abre sem a barra do navegador e a tela de treino funciona sem sinal. No iPhone, use sempre o ícone da tela inicial: o Safari pode apagar os dados de sites que ficam muitos dias sem ser abertos, mas o app instalado tem o próprio armazenamento.

## 5. Backup diário no seu servidor

O plano grátis do Supabase não faz backup. O script `scripts/backup.sh` faz um por dia com Docker e guarda os últimos 30.

1. No Supabase, clique em **Connect** e copie a string **Session pooler** (porta 5432). Troque `[YOUR-PASSWORD]` pela senha do banco; se não lembrar, gere outra em **Database → Settings**, só com letras e números.
2. No servidor, crie o arquivo `~/.caderno-backup.env`:
   ```sh
   SUPABASE_DB_URL='postgresql://postgres.gfbjkzzevzbfpsczgrvd:SENHA@HOST-DO-POOLER:5432/postgres'
   ```
   Depois rode `chmod 600 ~/.caderno-backup.env`.
3. Teste uma vez: `./scripts/backup.sh`. O resultado vai para `~/backups/caderno-treino/`.
4. Agende com `crontab -e`:
   ```
   15 4 * * * /caminho/para/caderno-treino/scripts/backup.sh >> $HOME/backups/caderno-treino.log 2>&1
   ```

**Para restaurar** num projeto novo: aplique as migrações `..._esquema.sql` e `..._ajustes_seguranca.sql` (a rotina vem no próprio backup) e rode `gunzip -c arquivo.sql.gz | psql "$SUPABASE_DB_URL"`.

## Rodar no computador

```sh
npm install
npm run demo   # telas com dados de exemplo, sem login (servidor de mentira na memória)
npm run dev    # app de verdade, ligado ao Supabase (precisa do passo 3)
npm test       # regras: sugestão de carga, próximo treino, metas, fila sem sinal
npm run test:banco  # regras de acesso do banco, num Postgres local (PGlite)
```

No modo demo dá para ver as telas de entrada com `?tela=login`, `?tela=perfil` ou `?tela=convite` na URL.

## Pausa do plano grátis

O Supabase pausa o projeto depois de 7 dias sem uso. Os dados não se perdem: para voltar, abra o painel e clique em **Restore project**.
