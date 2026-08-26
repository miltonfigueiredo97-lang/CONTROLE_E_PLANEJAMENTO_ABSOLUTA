# Planejador de Obra — motor de datas, auditor e assistente de sequenciamento

> Documento de continuidade. O trabalho acontece em sessões diferentes e em chats
> diferentes; este arquivo é a fonte da verdade sobre o que já foi feito, o que
> falta e por quê cada decisão foi tomada.
>
> **Ritual antes de qualquer coisa:** `git fetch origin && git reset --hard origin/main`.
> O estado local costuma estar dezenas de commits atrás.

## Objetivo

Hoje a conferência do cronograma é manual: linha por linha, predecessora por
predecessora. O objetivo é um sistema que leia o planejamento da obra, encontre o
que não faz sentido, discuta as opções como um planejador profissional discutiria,
e aplique as correções aprovadas.

Divisão de responsabilidade, decidida na análise inicial:

| Camada | O que faz | Precisa de IA? |
|---|---|---|
| Motor de datas | Propagação por predecessora, dias úteis, folga, caminho crítico | Não |
| Auditor | Checagens numéricas de qualidade da rede (linha das 14 do DCMA) | Não |
| Juiz de precedência | "Piso antes de forro faz sentido?" — base de regras com o motivo | Não, depois de montada |
| Entrevistador | Conduz a conversa, aceita contra-argumento, decide, aplica | Sim |

A maior parte roda offline no navegador e nunca depende de rede. A IA entra só no
julgamento e na conversa — se a API cair, o diagnóstico já está na tela.

## Fases

| Fase | Entrega | Estado |
|---|---|---|
| 1 | Calendário de obra + correções no motor de datas | **Concluída — V3.20.0** |
| 1b | Sábado de meio período + clique no dia da prévia | **Concluída — V3.21.0** |
| 3 | CPM completo: backward pass, folga total e livre, caminho crítico | **Concluída — V3.21.0** |
| 2 | Planejador: auditor, regras de precedência, crítica de duração, memória de decisão | **Concluída — V3.21.0** |

> A Fase 3 foi entregue antes da 2 porque o auditor precisa de folga e caminho
> crítico pra apontar folga negativa e falta de lógica na rede.

## Arquitetura final (V3.21.0)

Quatro módulos de cálculo puro, sem DOM e sem Firestore — testáveis com `node -e`:

| Arquivo | Responsabilidade |
|---|---|
| `js/calendario.js` | Dia útil, feriados, exceções, capacidade do dia (0 / 0,5 / 1) e **as duas únicas funções que convertem duração em data** |
| `js/cpm.js` | Forward e backward pass, folga total e livre, caminho crítico, detecção de ciclo |
| `js/regras-precedencia.js` | As 18 regras de precedência tecnológica, com motivo e risco |
| `js/auditor-planejamento.js` | Junta tudo: qualidade da rede, precedência, duração × quantidade, memória de decisão, dossiê |

A tela (`planejamento.js`, `configuracao-obra.js`) só apresenta e aplica. Isso é
o que permite testar o cálculo fora do navegador e é o que faz o diagnóstico
continuar na tela se a internet cair.

## Inversão de vínculo numa EAP hierárquica (V3.21.1)

A EAP é hierárquica: Gesso > Final 01 > 1º ao 20º pavimento, Gesso > Final 02 >
idem, e Contrapiso/Porcelanato na mesma estrutura. **A ordem errada entre dois
serviços não aparece num vínculo — aparece em dezenas, um por local.**

Consequência de projeto: o achado de precedência é **por par de serviços**, não
por par de tarefas, e carrega a lista completa de vínculos. Um achado por vínculo
geraria 40 alertas dizendo a mesma coisa, e inverter um só não muda o cronograma
da obra.

**O pareamento por local sai de graça.** Cada vínculo já liga o par certo (Final
01/3º andar com Final 01/3º andar). Inverter cada um onde está preserva isso — o
sistema nunca tenta adivinhar pareamento a partir do nome. Onde não existe
vínculo, nada é criado; a falta é acusada pelo achado `ordem_global_invertida`.

**Toda inversão simula antes.** `_simularInversao` clona as tarefas, aplica a
inversão no rascunho, roda o CPM e compara com a rede atual: tarefas deslocadas,
término de → para, e quem entra e sai do caminho crítico. Ciclo criado pela
inversão é detectado e avisado antes de gravar — sinal de que já existe outro
vínculo puxando no sentido contrário.

`_calcularInversao` é usada tanto na simulação quanto na aplicação real: um
caminho de código só.

**Ferramenta manual** (`abrirInverterGrupos`): escolhe dois grupos da EAP, lista
os vínculos entre os descendentes, simula e inverte. Existe porque a decisão de
ordem é do engenheiro e há caso legítimo que nenhuma regra cobre — gesso depois
do contrapiso, por exemplo, é prática comum (o gesseiro usa o contrapiso como
piso de trabalho e referência de nível). **Onde não há consenso técnico, a base
de regras fica calada de propósito** e a ferramenta manual atende.

## Onde continuar

1. **Produtividade real vinda das Medições.** O auditor já aceita
   `opcoes.produtividade` (mapa serviço → unidade/dia por oficial) e prefere esse
   número à faixa TCPO, declarando a fonte no apontamento. O que falta é a
   função que deriva isso de Medições + Diário de Obra. Hoje o gancho é passado
   vazio em `abrirVerificarPlanejamento`.
2. **Mais ações de correção automática.** Hoje só "Inverter o vínculo" é
   aplicável pelo sistema. Candidatas naturais: ajustar duração pro valor
   calculado, criar o vínculo que falta entre dois grupos de serviço, e remover
   predecessora órfã.
3. **Cobertura das regras.** O casamento é por palavra no nome da tarefa. Nome
   fora do padrão não é reconhecido e o sistema fica calado de propósito —
   alerta errado destrói a confiança mais rápido que alerta faltando. Ampliar
   cobertura = cadastrar apelido em `SERVICOS`.
4. **Meio período em exceção.** Exceção com `trabalha:true` rende dia cheio,
   mesmo caindo num dia marcado como meio período. Limitação documentada no
   módulo.
5. **Folga fracionária.** Com meia jornada na semana, a folga sai em 0,5 e o
   caminho crítico fica mais curto do que a intuição sugere. Está provado
   empiricamente que a folga é real (ver comentário 5 em `cpm.js`), mas se algum
   dia precisar desaparecer, o caminho é trabalhar num eixo contínuo de jornadas
   acumuladas — não arredondar o resultado.

---

## Fase 1 — concluída (V3.20.0)

### O que existia antes

O modelo de dados do Planejamento já era bom e melhor do que aparentava:

- Predecessora canônica **por ID**, imune a reordenação (`_predParse`, formato `id|TIPO|lag`)
- Quatro tipos de vínculo: **TI / II / TT / IT** (equivalentes a FS / SS / FF / SF) com defasagem
- Sucessora calculada como inverso, sempre coerente
- Propagação em cadeia de verdade (`_propagarDataEmCascata`), recursiva
- EAP hierárquica, Gantt com setas, import/export XLSX, export MS Project XML

### Os cinco defeitos encontrados

1. **Dias corridos, não dias úteis.** `setDate(getDate() + defasagem + 1)` somava
   dias de folhinha. Nenhum `getDay()` no cálculo — o único do arquivo servia pra
   *pintar* o fim de semana no Gantt. Uma tarefa de 20 dias úteis era agendada
   como 20 dias corridos, ~28% mais curta. Medido: cadeia de 10 tarefas de 20 dias
   dava **79 dias de erro acumulado**.
2. **Convenção de duração diferente do MS Project.** `duracao = término − início`,
   sem o +1. Duração 5 começando 10/set dava término 15/set em vez de 14/set. Toda
   planilha que entrava ou saía do Project desalinhava um dia por tarefa.
3. **TI + TT na mesma tarefa quebrava a barra.** O código pegava o maior início
   entre TI/II e o maior término entre TT/IT e gravava os dois — a barra saía com
   duração diferente da declarada, em silêncio.
4. **Sem backward pass.** Só propagação pra frente. Sem late start, sem folga, sem
   caminho crítico. Não é CPM — é propagação. (Endereçado na Fase 3.)
5. **Dependência circular engolida.** O `visitados` cortava o laço pra não travar,
   mas nunca avisava que existia.

### O que foi construído

**`js/calendario.js`** — módulo novo, global `Calendario`. Mora sozinho porque
Medições, Semanal, Histograma, Curva S e Dashboard precisam da mesma régua de dia
útil. Nunca reimplemente essa conta em outro módulo.

Decisões que valem registro:

- **Datas são string `'YYYY-MM-DD'`**, e toda conversão passa por `_dt()`, que
  ancora o horário ao **meio-dia local**. `new Date('2026-09-07')` é meia-noite UTC
  e, no fuso do Brasil, `.getDay()` devolve o dia anterior. Meio-dia mata essa
  classe de erro inteira. Nunca troque por `new Date(string)`.
- **Feriados são calculados, não baixados.** O sistema é HTML estático e o cálculo
  de data tem que ser instantâneo e determinístico — API dentro do motor de datas
  significa cronograma que quebra quando a rede cai. Os móveis derivam da Páscoa
  por fórmula fechada (Meeus/Jones/Butcher). Testado contra 2024–2027.
- **Carnaval e Corpus Christi são ponto facultativo, não feriado nacional.** Entram
  como toggle, pré-marcados como parados. Sexta-feira Santa é feriado de verdade.
  20/11 só é nacional a partir de 2024 (Lei 14.759/2023) — o gerador respeita o ano.
- **Nada de feriado é gravado.** Gerados sob demanda por ano. Gravado é só o que o
  usuário decidiu: toggles, feriados manuais, paralisações, exceções.

**Precedência** (do mais forte pro mais fraco). É o que resolve todo caso duvidoso:

1. **Exceção pontual** — manda em tudo. Serve nos dois sentidos: domingo trabalhado
   ou terça de folga.
2. **Paralisação** — faixa de datas parada. Exceção pontual ainda vence.
3. **Feriado** — salvo se `trabalhaFeriado`.
4. **Jornada semanal** — a base.

**Objeto salvo** em `obras/{obraId}.calendario`:

```js
{
  ativo: false,
  jornada: [1,2,3,4,5],                                 // 0=dom … 6=sáb
  trabalhaFeriado: false,
  feriadosAuto: true,
  facultativos: { carnaval: true, corpusChristi: true }, // true = obra PARA
  feriadosManuais: [{ data, nome, tipo }],
  paralisacoes:    [{ ini, fim, motivo }],
  excecoes:        [{ data, trabalha, motivo }],
  aplicado: false, aplicadoEm: ''
}
```

**`js/planejamento.js`** — três funções passaram a ser as **únicas** que convertem
entre duração e data: `_fimPorDuracao`, `_iniPorDuracao`, `_duracaoEntre`. Nunca
faça `setDate(getDate() + duracao)` solto em outro lugar — foi assim que o motor
passou a contar sábado como dia de obra.

`_calcPredecessora` foi reescrita: cada tipo de vínculo restringe **uma** ponta, as
duas restrições viram um piso de início comum, e a duração é sempre preservada.

**Aba Calendário** em Configuração da Obra: jornada clicável, toggles de feriado e
facultativo, listas de feriado manual / paralisação / exceção, e prévia dos 12 meses
pintados com o motivo no passar do mouse.

### Trava de segurança — importante

- O calendário **nasce desligado** em toda obra. Desligado, o sistema conta dias
  corridos exatamente como antes: `somarDiasUteis` cai em `addDiasCorridos`, e a
  convenção antiga de duração é mantida. Verificado por teste.
- **Ligar o calendário não muda data nenhuma.** O recálculo é passo separado:
  Planejamento › Ferramentas › **Aplicar Calendário às Datas**. Simula primeiro
  (quantas tarefas mudam, de → para de cada uma, quanto o término da obra move),
  aplica só depois de confirmar, grava em lote e desfaz com Ctrl+Z.
- Mudar a definição do calendário depois zera `aplicado` (via `Calendario.assinatura`)
  e o aviso volta ao topo do Planejamento. Não fica cronograma incoerente em silêncio.
- A simulação relata quando a rede não converge — quase sempre é ciclo — e diz
  quantas linhas ficaram fora da exibição, se o teto de 250 foi atingido.

### Verificação

- `node --check` em todos os arquivos alterados
- Checagem do `return{}` do projeto (`_esc`, `_vIni`, `_vFim` são falsos positivos
  conhecidos: são arrow functions)
- 29 testes do `Calendario`: Páscoa 2024–2027, feriados móveis, fuso, precedência
  completa, ida-e-volta `somarDiasUteis` × `contarDiasUteis` para 1..40 dias
- 12 testes de integração no motor, extraindo o código real do arquivo: paridade
  com o comportamento antigo quando desligado, TI/II/TT/IT com o calendário
  ligado, lag em dias úteis, duração 1, e o defeito TI+TT

---

## Fase 2 — Planejador (a fazer)

Botão **Verificar Planejamento**: uma passada por clique, não vigilância contínua.
Motor, auditor e base de regras montam um dossiê compacto offline; só o dossiê vai
pra IA — não a planilha inteira. Uma obra de 800 tarefas vira um resumo pequeno.

**Autoridade, em dois portões separados** (definido pelo Milton):

1. Mexer em vínculo e ordem — precisa de aprovação.
2. Reagendar datas quando a cascata não resolver — precisa de **nova** aprovação.
   O assistente volta e relata: "troquei a predecessora, a cascata não trouxe data
   coerente, autoriza reagendar?"

**Auditor** — checagens numéricas, offline, na linha das 14 do DCMA: tarefa sem
predecessora ou sem sucessora, lag negativo, excesso de II/TT, restrição rígida,
folga alta, folga negativa, duração fora de faixa, data real no futuro, previsto no
passado, ciclo (já detectado pelo motor), tarefa vencida sem avanço.

**Base de regras de precedência tecnológica** — versionada, cada regra com o motivo
técnico. É o que faz o argumento ser fundamentado em vez de genérico. Núcleo inicial:

| Regra | Motivo |
|---|---|
| Forro/gesso antes de piso final | Serviço superior derruba massa, poeira e água. Piso pronto embaixo exige proteção física — custo que ninguém orçou |
| Instalação embutida antes de reboco/contrapiso | Rasgar parede rebocada ou contrapiso curado é demolição parcial; compromete aderência e gera fissura |
| Impermeabilização + teste de estanqueidade antes de regularização | Vazamento achado depois do piso assentado = quebrar tudo. O teste tem duração própria no cronograma, não é zero |
| Contrapiso curado antes de assentar porcelanato | Umidade residual e retração descolam a placa. Cura tem prazo — emendar os dois é data fictícia |
| Fachada vedada / esquadria antes de acabamento interno sensível | Chuva destrói forro, pintura e piso de madeira |
| Alvenaria com liberação estrutural e folga de pavimentos | Sobrecarga em laje jovem e conflito de escoramento |

**Crítica de duração** — é cálculo, não opinião. O sistema já tem os levantamentos
(piso, teto, paredes, concreto, fachada, pintura, terraplanagem, solo grampeado), o
campo `quantidade`, o campo `equipeAlocada` e o vínculo levantamento→tarefa:

```
duração necessária (dias úteis) = (Quantidade × Hh por unidade) ÷ (Nº equipe × jornada)
```

TCPO/SINAPI entra como **semente**, em faixa. A verdade é a produtividade da própria
equipe, derivada de Medições e Diário de Obra, que já guardam executado por data.
O argumento então fica concreto: *"tua equipe entregou 43 m²/dia nas últimas 6
medições; teu cronograma pede 96 m²/dia."* Onde não houver histórico, cai na faixa
de referência e avisa que está usando referência.

**Memória de decisão** — obrigatória, não opcional. Cada exceção aceita fica gravada
na obra: regra violada, justificativa ("ordem da diretoria, piso liberado em 12/09"),
quem decidiu, quando. Na próxima análise aquele ponto aparece como *decidido*, não
como erro. Sem isso o assistente repete o mesmo alerta toda vez, vira ruído e o
Milton para de usar. De brinde, gera o histórico de *por que* a obra foi planejada
assim.

## Fase 3 — CPM completo (a fazer)

Backward pass, folga total e folga livre, caminho crítico marcado no Gantt. Depende
da Fase 1 (sem calendário, folga em dias corridos não significa nada).
