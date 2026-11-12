# Papéis fixos, conferidos pelo banco

A v2 trouxe três papéis: Admin, Personal e Aluno. Eles são uma lista fixa, com as permissões escritas nas regras de acesso do banco (RLS) e repetidas nas telas só para esconder o que não serve. Um papel novo, como "Nutricionista", é uma migração nova. O Admin é um só, fixo pelo e-mail `brenovambaster5@gmail.com` numa restrição da tabela `usuarios`; não dá para criar outro admin nem desativar ou rebaixar o atual pelo app.

As funções que as regras usam para saber o papel de quem está logado ficam no schema `privado`, fora da API, e rodam como dono (security definer). Assim a regra de `usuarios` não consulta a si mesma.

## Considered Options

- **Papéis configuráveis pelo app** (o Admin cria um perfil e marca o que ele pode fazer): cada regra do banco teria de ler uma tabela de permissões genérica, e ainda não há um segundo tipo de papel em vista. Rejeitado por custo e risco; dá para migrar depois sem perder dados.
- **Conferir o papel só na tela**: mais simples, mas qualquer um com a chave pública (que vai no navegador) leria os dados dos outros direto pela API.

## Consequences

- Admin e Personal leem perfil, séries, medições e ficha de quem acompanham; gravar continua sendo só do dono, exceto a ficha, que admin e personal também alteram.
- Inativo vira "sem convite" para todas as regras: não lê nem grava nada, mas os dados ficam guardados.
- Os outros usuários não são avisados no app de que o Admin vê os dados deles; isso fica para o termo de aceite, que não entrou na v2.
