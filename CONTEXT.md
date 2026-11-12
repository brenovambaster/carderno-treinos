# Caderno de Treino

App para cada usuário registrar suas sessões de musculação, acompanhar a evolução de carga e as medições do corpo.

## Language

### Planejamento

**Ficha de treino**:
O conjunto ordenado de treinos que um usuário segue em ciclo. Cada usuário tem a sua, uma só, que vai sendo editada; não há versões.
_Avoid_: Rotina, plano, programa, treino

**Ficha padrão**:
A ficha que todo usuário recebe como cópia no primeiro acesso. Só o Admin a altera, e mudar a padrão não muda a ficha de quem já tem a sua.
_Avoid_: Rotina padrão, modelo de ficha

**Treino**:
Um modelo nomeado dentro da ficha (ex.: "Pernas A"), com os exercícios prescritos e, para cada um, séries, faixa de repetições e descanso. Uma ficha tem de 1 a 7 treinos.
_Avoid_: Dia, ficha, divisão

**Treino arquivado**:
Um treino que saiu da ficha mas tem sessões registradas. Some da ficha e da tela de treino; o histórico continua apontando para ele. Treino sem histórico que sai da ficha é apagado.
_Avoid_: Treino excluído, treino antigo

**Exercício**:
Um movimento específico (ex.: "Leg press 45°"), cadastrado uma vez no catálogo com nome, grupo, incremento de carga e dica. Variações de equipamento indicadas no nome (livre ou Smith, barra ou máquina) contam como o mesmo exercício. A evolução e a sugestão de carga seguem o exercício, em qualquer treino em que ele apareça.
_Avoid_: Atividade, aparelho

**Exercício do treino**:
Um exercício como prescrito num treino: séries, faixa de repetições, descanso e ordem. O mesmo exercício pode estar em treinos diferentes com prescrições diferentes, mas não duas vezes no mesmo treino.
_Avoid_: Prescrição, item da ficha

**Catálogo**:
A lista única de exercícios que podem entrar nas fichas, igual para todos. Admin e Personal cadastram; só o Admin corrige ou apaga, e só o que não está em uso.
_Avoid_: Biblioteca, banco de exercícios

**Grupo**:
O grupo muscular principal de um exercício, de uma lista fixa (Peito, Costas, Ombros, Bíceps, Tríceps, Quadríceps, Posterior de coxa, Glúteo, Panturrilha, Abdômen). Cada exercício tem um só. Serve para filtrar o catálogo.
_Avoid_: Músculo, categoria

**Trocar exercício**:
Tirar um exercício de um treino e pôr outro no lugar, na ficha. Vale da próxima sessão em diante; as séries já registradas do exercício que saiu continuam na Evolução.
_Avoid_: Substituir, trocar só hoje

**Exercício com peso do corpo**:
Um exercício cuja evolução é medida pelas repetições, não pela carga (ex.: barra fixa, mergulho, elevação de pernas).
_Avoid_: Exercício livre, calistenia

**Faixa de repetições**:
O mínimo e o máximo de repetições prescritos para cada série de um exercício; o máximo é o topo da faixa.
_Avoid_: Meta de reps, alvo

**Próximo treino**:
O treino que vem, na ordem da ficha, depois do treino da sessão mais recente do usuário; não depende do dia da semana. Se esse treino saiu da ficha, o próximo é o primeiro.
_Avoid_: Treino do dia, treino de hoje

### Execução

**Sessão**:
Uma execução de um treino por um usuário em uma data. Existe a partir da primeira série marcada, mesmo que o treino fique incompleto.
_Avoid_: Treino (para o que foi feito), registro, workout

**Série**:
Um registro de carga × repetições de um exercício dentro de uma sessão.
_Avoid_: Set, rodada

**Carga**:
O peso, em kg, anotado numa série.
_Avoid_: Peso (reservado para o peso corporal da Medição)

**Sugestão de carga**:
A orientação dada para um exercício a partir da última sessão em que ele foi feito, em qualquer treino: manter a carga e somar repetições, ou subir a carga quando todas as séries chegaram ao topo da faixa.
_Avoid_: Progressão automática, recomendação

**Série pendente**:
Uma série marcada no aparelho que ainda não chegou à conta do usuário.
_Avoid_: Série offline, rascunho

### Usuário

**Usuário**:
Quem usa o app, com conta liberada por um convite. Todo usuário treina, qualquer que seja o papel.
_Avoid_: Atleta, cliente, pessoa

**Convite**:
A liberação de um e-mail para virar usuário do app, já com o papel e, para aluno, o personal. Só o Admin convida.
_Avoid_: Cadastro, acesso

**Papel**:
O que um usuário pode fazer além de treinar: Admin, Personal ou Aluno. A lista é fixa (ADR 0003).
_Avoid_: Perfil de acesso, função, cargo

**Admin**:
O único usuário com todas as permissões, fixo pelo e-mail: convida, ativa e desativa, muda papéis, liga aluno a personal, vê e altera a ficha de qualquer um e a Ficha padrão, e corrige o catálogo.
_Avoid_: Administrador, dono

**Personal**:
O papel de quem monta a ficha dos próprios alunos: vê os dados deles e altera só a ficha. Não convida nem desativa ninguém.
_Avoid_: Treinador, professor, instrutor

**Aluno**:
O papel de quem só treina. Tem nenhum ou um personal; com personal, não altera a própria ficha.
_Avoid_: Cliente

**Ativo**:
Usuário que pode usar o app. O inativo não entra, mas os dados ficam guardados e voltam se ele for reativado.
_Avoid_: Bloqueado, excluído

**Perfil**:
Os dados de um usuário que definem suas metas de calorias, proteína e sessões por semana: sexo, data de nascimento, altura, tipo de trabalho, objetivo e meta semanal. Não inclui o peso, que vem das medições.
_Avoid_: Cadastro, conta, perfil de acesso (isso é o Papel)

**Tipo de trabalho**:
Quanto o usuário se movimenta no trabalho: sentado, em pé ou braçal.
_Avoid_: Nível de atividade, fator de atividade

**Objetivo**:
O que o usuário busca com o treino: perder gordura, manter ou ganhar massa.
_Avoid_: Meta, foco

**Meta semanal**:
Quantas sessões por semana o usuário pretende fazer.
_Avoid_: Frequência, dias de treino

### Corpo

**Medição**:
Um registro, em uma data, do peso, da cintura e/ou da média de passos de um usuário. A primeira é feita no cadastro.
_Avoid_: Medida, pesagem
