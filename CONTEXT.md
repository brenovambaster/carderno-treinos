# Caderno de Treino

App para cada usuário registrar suas sessões de musculação, acompanhar a evolução de carga e as medições do corpo.

## Language

### Planejamento

**Rotina**:
O conjunto ordenado de treinos que um usuário segue em ciclo.
_Avoid_: Ficha, plano, programa, treino

**Rotina padrão**:
A rotina única que todos os usuários seguem; nenhum usuário a altera pelo app.
_Avoid_: Treino padrão, ficha padrão

**Treino**:
Um modelo nomeado dentro da rotina (ex.: "Pernas A"), com os exercícios prescritos e, para cada um, séries, faixa de repetições e descanso.
_Avoid_: Dia, ficha, divisão

**Exercício**:
Um movimento específico (ex.: "Leg press 45°") prescrito dentro de um treino. Variações de equipamento indicadas no nome (livre ou Smith, barra ou máquina) contam como o mesmo exercício.
_Avoid_: Atividade, aparelho

**Exercício com peso do corpo**:
Um exercício cuja evolução é medida pelas repetições, não pela carga (ex.: barra fixa, mergulho, elevação de pernas).
_Avoid_: Exercício livre, calistenia

**Faixa de repetições**:
O mínimo e o máximo de repetições prescritos para cada série de um exercício; o máximo é o topo da faixa.
_Avoid_: Meta de reps, alvo

**Próximo treino**:
O treino que vem, na ordem da rotina, depois do treino da sessão mais recente do usuário; não depende do dia da semana.
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
A orientação dada para um exercício a partir da última sessão em que ele foi feito: manter a carga e somar repetições, ou subir a carga quando todas as séries chegaram ao topo da faixa.
_Avoid_: Progressão automática, recomendação

**Série pendente**:
Uma série marcada no aparelho que ainda não chegou à conta do usuário.
_Avoid_: Série offline, rascunho

### Usuário

**Usuário**:
Quem usa o app, com conta liberada por um convite.
_Avoid_: Aluno, atleta, cliente, pessoa

**Convite**:
A liberação de um e-mail para virar usuário do app.
_Avoid_: Cadastro, acesso

**Perfil**:
Os dados de um usuário que definem suas metas de calorias, proteína e sessões por semana: sexo, data de nascimento, altura, tipo de trabalho, objetivo e meta semanal. Não inclui o peso, que vem das medições.
_Avoid_: Cadastro, conta

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
