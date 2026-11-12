# MUI como biblioteca de componentes

As telas eram feitas com CSS próprio. Para o app ter cara mais profissional sem desenhar cada componente à mão, passamos a usar o MUI (Material UI, v9) e o MUI X Charts para os gráficos de linha. As cores, as fontes (Barlow Condensed nos títulos, Source Sans 3 no texto) e o claro/escuro ficam no tema (`src/tema.ts`); a pessoa escolhe automático, claro ou escuro em Perfil → Aparência, e a escolha fica guardada no aparelho; as telas usam só componentes MUI e `sx`, sem classes CSS próprias.

O gráfico de atividade dos últimos 30 dias (estilo GitHub) é um componente nosso, feito com peças do MUI: o heatmap do MUI X é da versão paga, e 30 dias cabem num grid simples.

## Considered Options

- **Mantine**: tinha um heatmap pronto e estilo sem custo em tempo de execução, mas a escolha foi pelo MUI, o mais usado e com o maior catálogo.
- **shadcn/ui + Tailwind**: exigiria trocar todo o CSS por Tailwind.
- **Polir o CSS próprio**: sem dependência nova, mas cada componente (diálogos, abas, avisos, gráficos) continuaria sendo feito à mão.

## Consequences

- O JavaScript ficou maior. Para a tela de treino abrir rápido, os gráficos e as telas de ficha, usuários e catálogo são carregados só quando abertos; o service worker guarda todos os pedaços, então o app continua abrindo sem sinal.
- A v9 do MUI não aceita mais props de estilo soltas (`mt`, `color` etc.) nem `InputProps`: use `sx` e `slotProps`.
