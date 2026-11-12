# Supabase como banco, login e API

O app precisa de banco de dados, login com Google por convite e uma API que sirva o PWA agora e um app nativo depois. Escolhemos o Supabase (plano grátis), com o PWA em React/Vite hospedado na Vercel, porque ele entrega Postgres, login e API prontos, e o objetivo da v1 é usar o app o quanto antes. O plano grátis pausa o projeto após 7 dias sem uso e não faz backup automático; por isso um backup diário do banco roda no servidor próprio.

## Considered Options

- **Spring Boot + Postgres no servidor próprio**: controle total e sem pausa, e é a stack que já dominamos. Rejeitado porque exigiria escrever login e API antes de o app ser útil.
- **PocketBase no servidor próprio**: quase tão rápido quanto o Supabase e sem pausa, mas o banco é SQLite em vez de Postgres.
