# Sem sinal, só a tela de treino funciona

Academias costumam ter sinal ruim, mas um app totalmente offline exigiria sincronizar e resolver conflitos em todas as telas. Decidimos que só a tela de treino funciona sem sinal: a rotina e a última vez de cada exercício ficam guardadas no aparelho (IndexedDB), e as séries marcadas entram numa fila de pendências que sobe quando o sinal volta. Evolução, Medidas e Plano exigem internet.

## Consequences

- Quando dois aparelhos discordam sobre a mesma série, vale o que foi digitado por último, pela hora da alteração e não pela hora em que chegou ao servidor.
- O app mostra quantas séries estão pendentes, para o usuário lembrar de abrir o aparelho que ficou sem sinal.
- A fila guarda dados no IndexedDB e não no localStorage, porque o código que roda em segundo plano no PWA só consegue ler o IndexedDB.
