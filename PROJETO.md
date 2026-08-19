# Absoluta Engenharia — Controle e Planejamento de Obras
**Sistema de gestão de obras — aplicação web estática (HTML/CSS/JS puro, sem framework)**

> Última atualização: 14/08/2026. Estado real: **V3.5.0.0** no ar.
> Usar sempre o GitHub como fonte da verdade — nunca confiar no estado local de outra sessão.

---

## ⚠️ GATILHO — MUDANÇA CRÍTICA DE VERSIONAMENTO (14/08/2026) — LEIA ANTES DE QUALQUER COISA

**Se nesta conversa você (Claude) acredita que a versão atual é V2.qualquer-coisa (ex: V2.53, V2.62, V2.63): esse conhecimento está OBSOLETO. Descarte-o.**

Em 14/08/2026 TODAS as 408 versões do histórico foram **renumeradas uma a uma** pela regra A.B.C.D
(seção 2 abaixo, que substitui integralmente a regra antiga). Fatos que você precisa aceitar como verdade:

1. A versão atual do sistema é **V3.5.0.0** — ela fechou o ciclo da renumeração e abriu um novo ciclo.
2. A antiga V2.62.17 hoje se chama **V3.4.23**. Cada versão guarda o número antigo no campo `legado`
   de `js/notas-versao.js` e exibe o badge "antes: V2.xx" na página de Notas de Versão.
3. **NUNCA** crie versão nova continuando a numeração antiga (não existe V2.63.x, V2.64...).
   A próxima versão parte de V3.5.0.0 seguindo a regra da seção 2.
4. Em caso de dúvida, a fonte da verdade é `versaoAtual` em `js/notas-versao.js` no GitHub — não a sua memória de conversa.

---

---

## 1. ACESSO E INFRAESTRUTURA

| Item | Valor |
|---|---|
| Repositório | `github.com/miltonfigueiredo97-lang/CONTROLE_E_PLANEJAMENTO_ABSOLUTA` (privado) |
| Produção | `https://controle-e-planejamento-absoluta.vercel.app` |
| Deploy | Vercel — auto-deploy a cada push na `main` |
| Auth | Firebase Authentication (e-mail/senha) |
| Banco | Firestore |
| Stack | HTML + CSS + JS puro (sem React, sem build, sem bundler) |

**Git config local obrigatório em todo ambiente novo:**
```bash
cd /home/claude/repo-push
git config user.email "milton@absoluta.eng"
git config user.name "Milton Figueiredo"
# Remote com token inline:
git remote set-url origin https://miltonfigueiredo97-lang:TOKEN@github.com/miltonfigueiredo97-lang/CONTROLE_E_PLANEJAMENTO_ABSOLUTA.git
```
> Token: Milton cola pessoalmente — nunca deixar em arquivo commitado.

**Ritual obrigatório no início de TODA sessão:**
```bash
git fetch origin && git reset --hard origin/main
```

---

## 2. VERSIONAMENTO — REGRA OFICIAL A.B.C.D (vigente desde 14/08/2026)

**Formato: `V[A].[B].[C].[D]`** — hierárquico: todo D vive dentro de um C, todo C dentro de um B, todo B dentro de um A. **Quando uma casa sobe, TODAS as casas abaixo dela zeram.** A escala só anda pra frente — nunca renumerar pra trás nem juntar versões: cada mudança publicada é UMA versão com número próprio.

| Casa | Sobe quando | Exemplo real |
|---|---|---|
| **A** (Sistema) | Ciclo de features fechado e sistema novo funcional entregue | V1 = Base · V2 = Reescrita do Planejamento · V3 = marco Suprimentos |
| **B** (Feature) | Módulo novo ou funcionalidade GRANDE que não existia (ex: "Novo módulo: X") | V3.4 → V3.5 |
| **C** (Correção) | Correção de bug dentro da feature vigente | V3.5.0 → V3.5.1 |
| **D** (Sub-feature) | Melhoria/refinamento/funcionalidade menor dentro do que já existe | V3.5.1 → V3.5.1.1 |

**Como classificar (na dúvida, desça uma casa):**
- Consertou algo quebrado → **C**
- Melhorou/refinou/adicionou algo pequeno dentro de módulo existente → **D**
- Entregou módulo/capacidade grande nova → **B** (raro — poucas por ciclo)
- Fechou um ciclo inteiro de features e o sistema virou "outro sistema" → **A** (raríssimo — 3 vezes em toda a história)

**Exibição:** o D só aparece quando > 0 (V3.4.23, não V3.4.23.0). Exceção: versões de fechamento de ciclo podem exibir por extenso (V3.5.0.0).

**O que NÃO fazer (erros que já aconteceram):**
- ❌ Cada sub-correção virar Feature (foi assim que a antiga numeração chegou em V2.62 em semanas)
- ❌ Renumerar pra trás ou "compactar" o histórico — a escala nunca retrocede
- ❌ Continuar a numeração antiga V2.x — foi extinta em 14/08/2026 (ver GATILHO no topo)

**Histórico renumerado:** todas as 408 versões têm o campo `legado` com o número antigo em `js/notas-versao.js`. Tabela completa de conferência: gerada na renumeração de 14/08/2026.

**Bump de versão — sempre nos dois lugares:**
```bash
# 1. Todos os HTMLs (badge nav-version na sidebar):
sed -i 's/V3.X.Y/V3.X.Z/g' *.html

# 2. js/notas-versao.js:
#   - versaoAtual: 'V3.X.Z'
#   - Inserir novo objeto no FIM do array versoes (status: 'fechada' — o campo status foi
#     aposentado; a mais recente ganha o selo "● Atual" sozinha no render), com data e tipo corretos
#   - Tipos: lancamento (A) · funcionalidade (B) · correcao (C) · melhoria (D)
```

**Página de Notas de Versão (notas-versao.html):** hero com stats (versões, features, correções, melhorias, dias de projeto, dias c/ entrega), busca, filtros por tipo (a versão mais recente ganha selo "● Atual" automático), cards colapsáveis em timeline. O render escapa HTML dos itens — pode escrever `<select>` etc. nos textos sem quebrar.

---

## 3. VERIFICAÇÃO OBRIGATÓRIA ANTES DE TODO COMMIT

```bash
# 1. Sintaxe
node --check js/ARQUIVO.js

# 2. Funções do return{} existem no módulo (IIFE pattern)
python3 << 'EOF'
import re
with open('js/ARQUIVO.js','r') as f: c=f.read()
rets=list(re.finditer(r'return\s*\{([^}]+)\}',c))
ret=rets[-1]  # sempre o ÚLTIMO return{} — o primeiro pode ser de função interna
fns=[x.strip().split(':')[-1].strip() for x in ret.group(1).split(',') if x.strip()]
missing=[fn for fn in fns if fn and f'function {fn}(' not in c and f'async function {fn}(' not in c]
print("❌ MISSING:", missing) if missing else print(f"✅ {len(fns)} funções OK")
called=set(re.findall(r'(?<![\w.])(_[a-zA-Z]\w*)\s*\(',c))
defined=set(re.findall(r'function\s+(_\w+)\s*\(',c))
undef=[f for f in called if f not in defined]
print("❌ UNDEF:", sorted(undef)) if undef else print(f"✅ internas OK")
EOF
```

> **Esse bug (função no return{} que não existe) já quebrou módulos inteiros ~8 vezes.**
> utils.js usa arrow functions — só `node --check` vale lá.

---

## 4. MÓDULOS EXISTENTES

### 4.1 Estrutura de arquivos

```
*.html              → cada módulo tem seu HTML + script correspondente
js/*.js             → módulos em IIFE: const Modulo = (() => { ... return{...}; })();
css/                → base.css, layout.css, tabelas.css, modulos.css
js/firebase-config.js  → chaves públicas do Firebase
js/database.js      → CRUD genérico: listar/obter/criar/atualizar/deletar
js/router.js        → obra selecionada (localStorage OK aqui — é só cache de sessão)
js/utils.js         → helpers compartilhados (arrow functions, não function declarations)
js/permissions.js   → controle de acesso por perfil
```

### 4.2 Módulos implementados

| Módulo | Arquivo JS | Status | Coleções Firestore principais |
|---|---|---|---|
| Planejamento (Gantt) | planejamento.js | ✅ Completo | `tarefas` |
| Editor de Estrutura | (dentro de planejamento.js) | ✅ Completo | `tarefas` |
| Materiais | materiais.js | ✅ Completo | `materiais`, `materiais_vinculos` |
| Mão de Obra | mao-de-obra.js | ✅ Completo | `maoDeObra`, `maoDeObra_vinculos` |
| Semanal | semanal.js | ✅ Completo | `tarefas`, `semanas` |
| Diário de Obra | diario.js | ✅ Completo | `diario` |
| Medições | medicoes.js | ✅ Completo | `tarefas`, `medicoes` |
| Relatórios | relatorios.js | ✅ Completo | `relatorios` |
| Levantamento Fachada | levantamento-fachada.js | ✅ Completo | `levantamentosFachada`, `config/fachadaCfg` |
| Levantamento Piso | levantamento-piso.js | ✅ Completo | `pisoAreas`, `pisoPlantas`, `config/pisoArvore` |
| Levantamento Teto | levantamento-teto.js | ✅ Completo | `tetoAreas`, `tetoPlantas`, `config/tetoArvore` |
| Levantamento Paredes | levantamento-paredes.js | ✅ Completo | `paredesAlvenariaPecas`, `paredesAcabamentoPecas`, `config/paredesArvore` |
| Levantamento Concreto | levantamento-concreto.js | ✅ Completo | `concretoPecas`, `concretoConcretagens`, `config/concretoLevantamento` |
| Levantamento AC | levantamento-ar-condicionado.js | ✅ Completo | `levantamentoAr`, `levantamentoArMaquinas` |
| Levantamento Pintura | levantamento-pintura.html | 🔧 Em dev | `pinturaAreas` |
| Levantamento Solo Grampeado | levantamento-solo-grampeado.js | ✅ Completo | `sgVistas`, `sgExecucoes`, `sgProducaoDiaria`, `sgChumbadores`, `sgAreaExecutada` |
| Levantamento Terraplanagem | levantamento-terraplanagem.js | ✅ Completo | `terraEntregas`, `terraCaminhoes` |
| Controle Concreto | controle-concreto.html | 🔧 Em dev | `concretoPecaConc`, `concretoBTs`, `concretoLancamentos` |
| Controle Solo | controle-solo-grampeado.html | 🔧 Em dev | — |
| Controle Estacas e Fundações | controle-estacas.js | ✅ Completo | ver arquivo (módulo grande) |
| Controle Porcelanatos | controle-porcelanatos.js | ✅ Completo | ver arquivo |
| Produção | producao.html | 🔧 Em dev | — |
| Dashboard | dashboard.html | ✅ Completo | lê `tarefas` de outras coleções |
| Configuração de Obra | configuracao-obra.js | ✅ Completo | `obras/{id}` |
| Restrições | restricoes.html | 🏗 Stub | — |
| Orçamentos | orcamentos.html | 🏗 Stub | — |
| Suprimentos | suprimentos.js | ✅ Completo | `suprimentos`, `config` (seleção/prazos) |
| Histograma | histograma.html | 🏗 Stub | — |
| Admin Permissões | admin-permissoes.js | ✅ Completo | `users`, `permissions` |
| Diagnóstico Técnico | diagnostico.js | ✅ Completo | leitura — ferramenta de debug, acesso só via Dashboard |

---

## 5. PLANEJAMENTO — DETALHES CRÍTICOS

### 5.1 Weighting de % (NUNCA mudar isso)
`peso = Math.max(1, duracao || 1)` — peso por duração, nunca por quantidade.
Weighting por quantidade foi testado e distorce gravemente os resultados.

### 5.2 Número de linha (`_numLinha`)
- Atribuído em `_buildFiltradas()` pela posição na ordem geral (`sorted.forEach((t,i)=>t._numLinha=i+1`)
- **Fixo** — não muda ao filtrar/recolher famílias
- É este número que aparece na coluna `#` e que as predecessoras referenciam (ex: `"3TI+2"`)
- `_remapearPredecessoras()` atualiza automaticamente as referências quando tarefas mudam de posição

### 5.3 Predecessoras
- Formato: `"3TI+2"` onde `3` = número de linha, `TI` = tipo (TI/TT/II/IT), `+2` = defasagem
- Busca por `t._numLinha === parseInt(codPred)` (não por código)
- Ao mover tarefas: `_remapearPredecessoras(mudancasNum)` reescreve os números

### 5.4 Colunas
- `colOrdem`: array definindo a sequência de colunas
- `COL_FIXED`: colunas que não podem ser escondidas (`sel`, `num`, `status`, `nome`, `acoes`)
- `nome` usa `flex:1` por padrão, mas aceita largura fixa se o usuário redimensionar

### 5.5 Virtual scroll
- `ROW_H = 30px` por linha
- Renderiza só as linhas visíveis ± 3 de margem
- **`_editandoCelula = true`** enquanto há input aberto — `_paintRows()` não reconstrói a tabela enquanto isso

### 5.6 Vínculos com Levantamento
Módulos disponíveis (em `LEVANTAMENTO_MODULOS`):
- `fachada` → `levantamentosFachada` (usa tipos nos docs)
- `piso` → `pisoAreas` (campos: `areaM2`, `mlRodape`, `tipoContrapiso`, `impermeabilizacao`)
- `teto` → `tetoAreas` (campos: `areaM2`, `mlTabica`, `tipoDryWall`, `tipoPlacaGesso`, `temPintura`)
- `paredes` → `paredesAlvenariaPecas` + `paredesAcabamentoPecas` (**campos BRUTOS** — `areaLiquida` não é gravada, recalculada)
- `concreto` → `concretoPecas` (`volume`)
- `arCondicionado` → `levantamentoAr` (`qtdEquipamentos`, `btus`)
- `pintura` → `pinturaAreas` (stub)

**Importante:** Paredes salva campos brutos (`comprimento`, `altura` em cm, `vaos[]`). `_calcParedeBruta()` e `_calcAcabBruta()` recalculam `areaLiquida` e `pinturaM2` localmente no Planejamento.

### 5.7 Editor de Estrutura (`modoView='arvore'`)
- Botão "🌳 Editor de Estrutura" na toolbar
- Drag & drop: `stopPropagation()` obrigatório em `_arvDragOver` e `_arvDrop`
- **Local-first**: move atualiza a tela imediatamente, save vai ao Firestore em background
- Salva só as tarefas que mudaram (`changed = sorted.filter(...)`)
- `_undoPush()` chamado antes de toda operação destrutiva

---

## 6. REGRAS DE DADOS

### localStorage — o que pode e o que não pode
| Uso | Situação |
|---|---|
| `obra_selecionada` (router.js) | ✅ OK — cache de sessão de UI |
| `todo_seed_v1`, tutorial visto | ✅ OK — flags de UI |
| Configurações de cálculo da obra | ❌ Migrado para Firestore em V2.32 |
| Dados de levantamento | ❌ Migrado para Firestore em V2.32 |

### Firestore — estrutura principal
```
obras/{obraId}/
  tarefas/          → cronograma (planejamento)
  semanas/          → fechamentos semanais
  diario/           → lançamentos do diário de obra
  materiais/        → biblioteca de materiais
  materiais_vinculos/
  maoDeObra/        → biblioteca de mão de obra
  maoDeObra_vinculos/
  medicoes/
  relatorios/
  levantamentosFachada/
  pisoAreas/
  tetoAreas/
  paredesAlvenariaPecas/
  paredesAcabamentoPecas/
  concretoPecas/
  levantamentoAr/
  ...
  config/
    fachadaCfg      → configuração de cálculo de vãos/ML da fachada
    paredesConfig   → configuração de cálculo de vãos/ML das paredes
    pisoArvore      → árvore hierárquica Torre→Andar→Apto
    tetoArvore      → idem
    paredesArvore   → idem
    concretoLevantamento → lista de peças do levantamento de concreto
    mapaVisao       → imagem do mapa da visão geral da fachada
```

---

## 6.1 MÓDULO DE USUÁRIOS E PERMISSÕES (desde V2.58.0, permissões por obra desde V3.14.0.0)

### Dados
```
users/{uid}       → { nome, email, perfil:'admin'|'usuario', ativo:bool,
                       status:'convidado'|'ativo'|'desativado',
                       acessoObras:'todas'|[obraId,...] }
permissions/{uid} → {
  global:  { obras:{criar,editar}, admin:{ver,convidar,editar,excluir} },  // NÃO depende de obra
  modulos: { <moduloKey>: {ver,criar,editar,excluir,exportar,importar,...} }, // usado quando acessoObras==='todas', e como FALLBACK de qualquer obra restrita ainda sem config própria
  porObra: { [obraId]: { <moduloKey>: {...} } }  // usado quando acessoObras==='restrito' — cada obra da lista pode ter permissões diferentes
}
```
- `perfil:'admin'` = acesso total, ignora `permissions`.
- Catálogo de módulos e ações fica em `js/permissions.js` → `Permissions.MODULOS` (fonte única — a tela de admin gera os checkboxes a partir daqui). `Permissions.GLOBAL_MODULOS` (`['obras','admin']`) lista os que NÃO são obra-escopados.
- `Permissions.pode(modulo, acao)` decide sozinho onde olhar: se o módulo é global, olha `permissoesGlobais`; senão olha a config da OBRA ATIVA (`Router.getObraId()`) — usa `porObra[obraAtiva]` se existir, senão cai no `modulos` (fallback). Isso funciona automaticamente ao trocar de obra pelo seletor da sidebar, sem precisar recarregar nada — a maioria dos módulos troca de obra via `onObraChanged()` (sem reload de página) e `pode()` já lê a obra ativa em tempo real a cada chamada.
- `Permissions.PAGINA_MODULO` mapeia nome do arquivo HTML → chave do módulo, usado no gate de página. `obras.html`, `login.html`, hubs (`levantamento.html`, `controle.html`) e `notas-versao.html` são propositalmente omitidos (sempre acessíveis a qualquer usuário ativo).

### Tela de admin (`admin-permissoes.html` / `js/admin-permissoes.js`)
- Seção "Permissões gerais" (Obras, Admin) sempre visível, um conjunto único — não depende de Todas/Restrito.
- Quando "Restrito": abaixo da lista de obras aparecem ABAS (uma por obra marcada). Trocar de aba comita o checklist visível em memória (`_modalPorObra[obraId]`) antes de mostrar o da obra seguinte. Botão "📋 Copiar pra todas" aplica a config da aba atual em todas as obras marcadas (reduz o trabalho de configurar uma por uma).
- Quando "Todas": um único checklist (`_modalModulosFallback`), igual ao comportamento anterior à V3.14.
- Ao salvar: comita a aba visível, monta `porObra` só com as obras marcadas (obra desmarcada é removida do documento), e nunca sobrescreve o `modulos` (fallback) quando o modo é Restrito.

### Convite de usuário (sem provedor de e-mail externo)
1. Admin preenche formulário em `admin-permissoes.html` → `js/admin-permissoes.js` chama `POST /api/usuarios` `{action:'convidar', ...}`.
2. `api/usuarios.js` (Firebase Admin SDK) cria o usuário no Firebase Auth com senha temporária aleatória, `ativo:false`, `status:'convidado'`, e grava `permissions/{uid}` com os três campos (`global`, `modulos`, `porObra`).
3. Front-end chama `auth.sendPasswordResetEmail(email, {url:.../definir-senha.html})` — o e-mail é disparado **pelo próprio Firebase**, sem SendGrid/Resend. Se o domínio não estiver em Authorized Domains, cai num fallback pro link padrão do Firebase (com aviso na tela).
4. Usuário abre `definir-senha.html`, define a senha (`confirmPasswordReset` + login automático), o próprio front marca `ativo:true` (com `.set(merge:true)`, nunca `.update()` — usuários pré-V2.58 não tinham doc em `permissions/{uid}`).
- **Exige env var `FIREBASE_SERVICE_ACCOUNT_KEY` na Vercel** (JSON da service account do Firebase) — sem ela, `/api/usuarios` falha. Já configurada.

### Enforcement
- `Utils.initPagina()` chama `Permissions.carregar(uid)` → `Permissions.bloquearPaginaSemAcesso()` antes de renderizar qualquer coisa.
- Toda função de mutação (criar/editar/excluir/importar/exportar) de todos os módulos com CRUD real checa `Permissions.pode(modulo,acao)` antes de gravar no Firestore — Planejamento, Materiais, Mão de Obra, Diário, Semanal, Medições, Relatórios, os 9 Levantamentos, os 5 Controles (Concreto, Solo, Terraplanagem, Estacas, Porcelanatos), Produção, Suprimentos, Configuração de Obra, Backup de Planejamentos. Restrições/Orçamentos/Histograma/Escadinha/Gantt/Linha-de-Balanço são stub, sem nada a proteger ainda.
- Botões usam `data-perm="modulo:acao"` + `Permissions.aplicarNaTela()` para esconder visualmente — cobertura completa em todos os módulos reais.
- Links de menu que são **hubs** (agrupam vários módulos — "Levantamentos", "Controle") usam `data-perm-hub="levantamento"` / `data-perm-hub="controle"` em vez de `data-perm`. `Permissions.podeHub(hub)` (mapa `HUBS` em `permissions.js`) checa se o usuário tem "ver" em pelo menos um dos módulos daquele grupo, na obra ativa.
- `Permissions.aplicarNaTela()` também esconde o título de categoria da sidebar (`.sidebar-section-title`) automaticamente quando nenhum link visível sobra embaixo dela.
- Vários Levantamentos salvam a árvore de locais num único ponto (`_salvarArvore()`); o guard foi colocado ali, cobrindo todas as ações do Editor de Estrutura de uma vez.
- Os hubs (`levantamento.html`, `controle.html`) filtram os cards por `data-perm="modulo:ver"`.
- `Database.getObras()` continua retornando todas — o filtro por `acessoObras` é feito na camada de chamada (`Router.popularSeletorObras`, `Obras.carregar`).

### Sub-permissões (granularidade por botão — desde V3.14.0.1)
`Permissions.SUBACOES[modulo][acaoGrossa]` = array de `{key,label}`. Ex: `SUBACOES.planejamento.editar` tem `celula`, `estrutura`, `predecessora`, `vinculo`, `recalculo`, `datasReais`, `frentes`, `nivel`.

- **Chave de armazenamento:** `"editar"` = grupo inteiro (libera tudo abaixo); `"editar:celula"` = só aquele item.
- **`pode(m,'editar')`** → true se o grupo estiver marcado OU qualquer sub dele estiver (= "pode editar alguma coisa"). Isso mantém compatível qualquer guard antigo que só checava a ação grossa.
- **`pode(m,'editar:celula')`** → true se o grupo inteiro estiver marcado OU aquele sub específico estiver.
- **`data-perm` aceita 3 partes:** `data-perm="planejamento:exportar:png"`. `aplicarNaTela()` faz `shift()` do módulo e junta o resto — não usar destructuring de 2 elementos ali (foi bug já corrigido).
- **Módulo/ação sem entrada em `SUBACOES`** = comportamento antigo, uma caixinha só. Adicionar granularidade é incremental e retrocompatível.
- **UI:** grupo com subs ganha botão "▸ detalhar" que expande os itens; marcar o grupo desabilita os individuais (mas não apaga o que estava marcado neles).
- **Ao criar sub-ação nova:** adicionar em `SUBACOES`, migrar o guard no módulo (`pode(m,'grupo:sub')`) e o `data-perm` do botão. Há um script de validação no histórico desta sessão que confere se todo `data-perm`/`pode()` aponta pra ação/sub existente — vale reexecutar depois de mexer nisso.

Mapeado até agora (60 subs): Planejamento (24), Diário, Materiais, Mão de Obra, Medições, Semanal, Suprimentos, Relatórios, Configuração de Obra.
**Ainda em ações grossas:** os 9 Levantamentos e os 5 Controles.

### Pendente
- Auditoria de permissões é um trabalho contínuo: sempre que um módulo novo grande for criado, checar se `Permissions.MODULOS`/`PAGINA_MODULO` foram atualizados e se as funções de mutação têm guard — já aconteceu duas vezes (Suprimentos, e antes disso outros) de um módulo novo nascer sem nenhuma checagem.
- Regras de segurança do Firestore ainda são as de desenvolvimento (`allow read, write: if request.auth != null` — ver README). Não foi endurecido ainda.


---

## 7. PADRÃO DE COMUNICAÇÃO

- Responder sempre em **português brasileiro**
- Após cada entrega: **"Publicado. Ctrl+Shift+R."** + resumo objetivo
- Edições cirúrgicas (`str_replace`) — nunca reescrever módulo estável inteiro
- Nunca prometer que algo está corrigido sem ter verificado (sintaxe + funções + lógica)
- Quando há múltiplas sessões paralelas: `git fetch origin && git reset --hard origin/main` antes de qualquer edição

---

## 8. PENDÊNCIAS CONHECIDAS

- Módulo Pintura (levantamento-pintura.html) — em desenvolvimento
- Controle Concreto, Solo Grampeado, Produção — parcialmente implementados
- Restrições, Orçamentos, Suprimentos, Histograma — stubs vazios
- Predecessoras: o cálculo automático de datas (inicio/fim) existe mas pode ter edge cases
- Relatório do Diário de Obra — formato ainda sendo amadurecido
