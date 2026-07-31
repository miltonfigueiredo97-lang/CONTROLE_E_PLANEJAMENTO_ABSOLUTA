# Absoluta Engenharia — Controle e Planejamento de Obras
**Sistema de gestão de obras — aplicação web estática (HTML/CSS/JS puro, sem framework)**

> Última atualização: julho 2026. Estado real: V2.53.0 no ar.
> Usar sempre o GitHub como fonte da verdade — nunca confiar no estado local de outra sessão.

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

## 2. VERSIONAMENTO — CONVENÇÃO CORRETA

**Formato: `V[Major].[Feature].[Fix]`**

| Dígito | Quando sobe | Exemplo |
|---|---|---|
| Major (1º) | Mudança de plataforma/fase — raramente | V2 → V3 |
| Feature (2º) | Módulo novo ou funcionalidade grande nova | V2.3 → V2.4 |
| Fix (3º) | Correção de bug dentro da mesma feature | V2.4.0 → V2.4.1 |

**Regra prática:** se você está corrigindo algo que quebrou ou melhorando algo existente → Fix. Se está entregando algo novo que não existia → Feature.

**O que NÃO fazer:** cada sub-correção de uma feature virar um novo número de Feature. Isso gerou V2.7 → V2.53 em semanas, o que é absurdo.

**Bump de versão — sempre nos dois lugares:**
```bash
# 1. Todos os HTMLs (badge nav-version na sidebar):
sed -i 's/V2.X.Y/V2.X.Z/g' *.html

# 2. js/notas-versao.js:
#   - versaoAtual: 'V2.X.Z'
#   - Fechar versão anterior (status: 'fechada')
#   - Inserir novo objeto de versão (status: 'aberta')
```

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
| Produção | producao.html | 🔧 Em dev | — |
| Dashboard | dashboard.html | ✅ Completo | lê `tarefas` de outras coleções |
| Configuração de Obra | configuracao-obra.js | ✅ Completo | `obras/{id}` |
| Restrições | restricoes.html | 🏗 Stub | — |
| Orçamentos | orcamentos.html | 🏗 Stub | — |
| Suprimentos | suprimentos.html | 🏗 Stub | — |
| Histograma | histograma.html | 🏗 Stub | — |
| Admin Permissões | admin-permissoes.js | ✅ Completo | `users`, `permissions` |

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

## 6.1 MÓDULO DE USUÁRIOS E PERMISSÕES (desde V2.58.0)

### Dados
```
users/{uid}       → { nome, email, perfil:'admin'|'usuario', ativo:bool,
                       status:'convidado'|'ativo'|'desativado',
                       acessoObras:'todas'|[obraId,...] }
permissions/{uid} → { modulos: { <moduloKey>: {ver,criar,editar,excluir,exportar,importar} } }
```
- `perfil:'admin'` = acesso total, ignora `permissions`.
- Catálogo de módulos e ações fica em `js/permissions.js` → `Permissions.MODULOS` (fonte única — a tela de admin gera os checkboxes a partir daqui).
- `Permissions.PAGINA_MODULO` mapeia nome do arquivo HTML → chave do módulo, usado no gate de página. `obras.html`, `login.html`, hubs (`levantamento.html`, `controle.html`) e `notas-versao.html` são propositalmente omitidos (sempre acessíveis a qualquer usuário ativo).

### Convite de usuário (sem provedor de e-mail externo)
1. Admin preenche formulário em `admin-permissoes.html` → `js/admin-permissoes.js` chama `POST /api/usuarios` `{action:'convidar', ...}`.
2. `api/usuarios.js` (Firebase Admin SDK) cria o usuário no Firebase Auth com senha temporária aleatória, `ativo:false`, `status:'convidado'`, e grava `permissions/{uid}`.
3. Front-end chama `auth.sendPasswordResetEmail(email, {url:.../definir-senha.html})` — o e-mail é disparado **pelo próprio Firebase**, sem SendGrid/Resend.
4. Usuário abre `definir-senha.html`, define a senha (`confirmPasswordReset` + login automático), o próprio front marca `ativo:true`.
- **Exige env var `FIREBASE_SERVICE_ACCOUNT_KEY` na Vercel** (JSON da service account do Firebase) — sem ela, `/api/usuarios` falha. Ação manual do Milton — não repetir automaticamente em outra sessão sem confirmar se já foi configurada.

### Enforcement
- `Utils.initPagina()` chama `Permissions.carregar(uid)` → `Permissions.bloquearPaginaSemAcesso()` antes de renderizar qualquer coisa.
- Toda função de mutação (criar/editar/excluir/importar/exportar) de todos os módulos com CRUD real checa `Permissions.pode(modulo,acao)` antes de gravar no Firestore — Planejamento, Materiais, Mão de Obra, Diário, Semanal, Medições, Relatórios, os 9 Levantamentos, os 3 Controles, Produção, Configuração de Obra, Backup de Planejamentos. Restrições/Orçamentos/Suprimentos/Histograma são stub, sem nada a proteger ainda.
- Botões usam `data-perm="modulo:acao"` + `Permissions.aplicarNaTela()` para esconder visualmente — aplicado nos módulos de CRUD simples (Obras, Materiais, Mão de Obra, Diário, Medições, Relatórios, Planejamento). Nos módulos de canvas/mapa (Levantamentos, Controles) o bloqueio funcional já existe mas o botão ainda pode aparecer na tela — refinamento visual pendente, não é falha de segurança (a ação é recusada mesmo se clicada).
- Vários Levantamentos (Piso, Teto, Paredes, Pintura) salvam a árvore de locais num único ponto (`_salvarArvore()`); o guard foi colocado ali, cobrindo todas as ações do Editor de Estrutura de uma vez, em vez de em cada handler de drag&drop separadamente.
- `Database.getObras()` continua retornando todas — o filtro por `acessoObras` é feito na camada de chamada (`Router.popularSeletorObras`, `Obras.carregar`), não dentro do Database.

### Pendente
- Cobertura visual (`data-perm` nos botões) dos módulos de Levantamento/Controle — hoje só o bloqueio funcional existe ali.
- Esconder/desabilitar os cards dos hubs (`levantamento.html`, `controle.html`) conforme permissão do sub-módulo (hoje eles navegam e só bloqueiam na página de destino).
- Regras de segurança do Firestore ainda são as de desenvolvimento (`allow read, write: if request.auth != null` — ver README). Com dados de permissão agora no Firestore, vale endurecer isso; não foi feito nesta rodada.


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
