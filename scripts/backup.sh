#!/usr/bin/env bash
# Backup diário do banco do Caderno de Treino (Supabase), para rodar no seu servidor.
# Precisa de Docker. Guarda os últimos DIAS backups (padrão: 30).
#
# Configuração: crie ~/.caderno-backup.env com
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@<host-do-pooler>:5432/postgres'
# (copie a "Session pooler" em Supabase → Connect; troque [YOUR-PASSWORD] pela senha do banco.
#  Se a senha tiver @ : / ou #, gere outra só com letras e números.)
#
# Agendamento (crontab -e), todo dia às 4h15:
#   15 4 * * * /caminho/para/caderno-treino/scripts/backup.sh >> $HOME/backups/caderno-treino.log 2>&1
set -euo pipefail

[ -f "$HOME/.caderno-backup.env" ] && . "$HOME/.caderno-backup.env"
: "${SUPABASE_DB_URL:?defina SUPABASE_DB_URL em ~/.caderno-backup.env}"
DESTINO="${DESTINO:-$HOME/backups/caderno-treino}"
DIAS="${DIAS:-30}"
IMAGEM="${IMAGEM:-postgres:17}" # mesma versão principal do Postgres do Supabase

mkdir -p "$DESTINO"
ARQ="$DESTINO/caderno-treino-$(date +%F).sql.gz"

# Usuários (para os dados continuarem ligados às mesmas contas) + dados do app.
# O esquema não entra: ele está nas migrações em supabase/migrations.
{
  docker run --rm "$IMAGEM" pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
    --table=auth.users --table=auth.identities
  docker run --rm "$IMAGEM" pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
    --schema=public
} | gzip > "$ARQ.tmp"
mv "$ARQ.tmp" "$ARQ"

find "$DESTINO" -name 'caderno-treino-*.sql.gz' -mtime +"$DIAS" -delete
echo "$(date '+%F %T') ok: $ARQ ($(du -h "$ARQ" | cut -f1))"
