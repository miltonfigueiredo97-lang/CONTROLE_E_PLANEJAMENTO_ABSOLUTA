// ============================================================
// Módulo: Regras de Precedência Tecnológica
// A base de conhecimento de execução de obra.
// ============================================================
//
// POR QUE ESTE ARQUIVO EXISTE
// Verificar vínculo é matemática: falta predecessora, lag negativo, folga
// esquisita. Isso o auditor faz sozinho. Mas saber que PISO ANTES DE FORRO é
// retrabalho garantido não sai de cálculo nenhum — sai de conhecimento de
// execução. Este arquivo é esse conhecimento, escrito, versionado, e com o
// MOTIVO de cada regra ao lado.
//
// O motivo não é enfeite: é o que faz o sistema argumentar como um planejador
// em vez de despejar um alerta genérico. Quando ele diz "piso antes de forro",
// ele diz também por quê, e você pode discordar com base.
//
// COMO EDITAR
// Adicione regra nova ao array REGRAS. Cada uma precisa de:
//   antes / depois : chaves de SERVICOS (o casamento é por palavra no nome da tarefa)
//   motivo         : por que essa ordem existe, em linguagem de obra
//   risco          : o que acontece de concreto se inverter
//   severidade     : 'alta' (retrabalho ou dano garantido) | 'media' (atrito, custo extra)
//
// LIMITE HONESTO DESTA ABORDAGEM
// O casamento é por palavra no nome da tarefa. Cronograma com nome fora do
// padrão ("Serviço 4.2.1") não é reconhecido, e o sistema fica calado em vez de
// chutar. Isso é de propósito: alerta errado destrói a confiança mais rápido do
// que alerta faltando. A cobertura melhora cadastrando apelido em SERVICOS.

const RegrasPrecedencia = (() => {

  const _norm = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // tira acento
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Vocabulário de serviços. `termos` casa por palavra inteira no nome da
  // tarefa; `exclui` desfaz o casamento (evita "piso" pegar "rodapé de piso" na
  // regra errada, ou "forro" pegar "forro de PVC de área externa").
  const SERVICOS = {
    estrutura:        { label: 'estrutura / laje',           termos: ['estrutura', 'laje', 'pilar', 'viga', 'concretagem', 'forma', 'armacao'] },
    desforma:         { label: 'desforma / escoramento',     termos: ['desforma', 'escoramento', 'reescoramento'] },
    // Alvenaria de VEDAÇÃO e alvenaria ESTRUTURAL são serviços diferentes e a
    // ordem em relação à laje é INVERTIDA entre eles:
    //   vedação   -> sobe DEPOIS da laje pronta (é só fechamento)
    //   estrutural-> sobe ANTES da laje daquele pavimento (a parede recebe a laje)
    // A regra antiga tratava as duas como "alvenaria" e contrariava o cronograma
    // do RD06 em 43 vínculos de alvenaria estrutural — que estavam corretos.
    alvenaria:        { label: 'alvenaria de vedação',       termos: ['alvenaria', 'bloco', 'vedacao'], exclui: ['estrutural'] },
    alvenariaEstrut:  { label: 'alvenaria estrutural',       termos: ['alvenaria estrutural'] },
    eletrica:         { label: 'instalação elétrica',        termos: ['eletrica', 'eletrico', 'eletrodutos', 'fiacao', 'cabeamento'] },
    hidraulica:       { label: 'instalação hidráulica',      termos: ['hidraulica', 'hidraulico', 'tubulacao', 'esgoto', 'agua fria', 'agua quente', 'prumada'] },
    impermeabilizacao:{ label: 'impermeabilização',          termos: ['impermeabilizacao', 'impermeabilizante', 'manta asfaltica'] },
    estanqueidade:    { label: 'teste de estanqueidade',     termos: ['estanqueidade', 'lamina d agua', 'lamina de agua', 'teste de agua'] },
    reboco:           { label: 'reboco / emboço',            termos: ['reboco', 'emboco', 'emboso', 'massa unica', 'chapisco'] },
    contrapiso:       { label: 'contrapiso',                 termos: ['contrapiso', 'regularizacao'] },
    forro:            { label: 'forro / gesso',              termos: ['forro', 'gesso', 'drywall', 'sancas', 'sanca'] },
    piso:             { label: 'piso / revestimento',        termos: ['piso', 'porcelanato', 'ceramica', 'assentamento', 'revestimento'], exclui: ['rodape', 'contrapiso'] },
    rejunte:          { label: 'rejunte',                    termos: ['rejunte', 'rejuntamento'] },
    rodape:           { label: 'rodapé',                     termos: ['rodape'] },
    esquadria:        { label: 'esquadria / caixilho',       termos: ['esquadria', 'caixilho', 'janela', 'vidro', 'porta'] },
    fachada:          { label: 'fachada',                    termos: ['fachada', 'revestimento externo', 'pele de vidro'] },
    pintura:          { label: 'pintura',                    termos: ['pintura', 'latex', 'acrilica', 'selador', 'massa corrida'] },
    louca:            { label: 'louças e metais',            termos: ['louca', 'loucas', 'metais', 'bacia', 'cuba', 'torneira'] },
    limpeza:          { label: 'limpeza final',              termos: ['limpeza'] },
    marmore:          { label: 'mármore / granito / bancada',termos: ['marmore', 'granito', 'bancada', 'soleira', 'peitoril'] },
  };

  // ---- A BASE ----
  // Ordem: `antes` tem que começar (e em geral terminar) antes de `depois`.
  const REGRAS = [
    { antes: 'estrutura', depois: 'alvenaria', severidade: 'alta',
      motivo: 'Alvenaria de vedação só sobe em laje liberada estruturalmente, e em edifício se mantém uma folga de pavimentos entre a estrutura e a vedação.',
      risco: 'Sobrecarga em laje jovem e conflito com o escoramento que ainda está montado.' },

    // NÃO EXISTE REGRA entre alvenaria estrutural e laje, de propósito.
    // Em prédio de alvenaria estrutural a ordem ALTERNA por pavimento:
    //   laje do 5º -> alvenaria estrutural do 6º -> laje do 6º -> alvenaria do 7º…
    // Os dois sentidos são corretos, e qual vale depende do pavimento — coisa que
    // a regra não vê. Tentei afirmar "alvenaria estrutural antes da laje" e no
    // RD06 isso gerou 17 alertas falsos na hora. Onde a ordem depende de contexto
    // que a regra não enxerga, a regra não opina: quem resolve esse par é o
    // padrão aprendido, que conta os dois sentidos e só acusa desequilíbrio.

    { antes: 'alvenaria', depois: 'eletrica', severidade: 'alta',
      motivo: 'Elétrica embutida é rasgada na alvenaria já executada — a parede precisa existir primeiro.',
      risco: 'Sem a parede não há onde embutir; inverter significa refazer trecho de alvenaria depois.' },

    { antes: 'alvenaria', depois: 'hidraulica', severidade: 'alta',
      motivo: 'Tubulação embutida é rasgada na alvenaria já executada.',
      risco: 'Mesmo caso da elétrica: retrabalho de alvenaria.' },

    { antes: 'eletrica', depois: 'reboco', severidade: 'alta',
      motivo: 'Toda instalação embutida entra antes do reboco fechar a parede.',
      risco: 'Rasgar parede rebocada é demolição parcial: compromete a aderência do reboco em volta e gera fissura no acabamento.' },

    { antes: 'hidraulica', depois: 'reboco', severidade: 'alta',
      motivo: 'Toda instalação embutida entra antes do reboco fechar a parede.',
      risco: 'Rasgar parede rebocada é demolição parcial e fonte de fissura.' },

    // CORRIGIDA. A versão anterior dizia "impermeabilização antes do contrapiso"
    // e contrariava o cronograma real do RD06 42 vezes — e o cronograma estava
    // certo. Existem duas escolas, e a mais comum é: o contrapiso (ou a
    // regularização) executa o CAIMENTO, a impermeabilização vem sobre ele, o
    // teste de lâmina d'água valida, e só então o revestimento. Afirmar a ordem
    // entre impermeabilização e contrapiso produziria dezenas de alertas falsos,
    // então a regra passou a afirmar só o que é inequívoco: a impermeabilização
    // e o teste vêm antes do REVESTIMENTO que os cobre.
    { antes: 'impermeabilizacao', depois: 'piso', severidade: 'alta',
      motivo: 'A impermeabilização fica sob o revestimento em área fria (banheiro, cozinha, área de serviço, sacada).',
      risco: 'Um vazamento descoberto depois do piso assentado obriga a quebrar o piso pronto.' },

    { antes: 'estanqueidade', depois: 'piso', severidade: 'alta',
      motivo: 'O teste de lâmina d\'água valida a impermeabilização antes de ser coberta pelo revestimento. E o teste tem duração própria no cronograma — dias parados, não zero.',
      risco: 'Cobrir sem testar significa descobrir o vazamento com o piso assentado.' },

    { antes: 'contrapiso', depois: 'piso', severidade: 'alta',
      motivo: 'O piso é assentado sobre contrapiso já executado e curado. A cura tem prazo próprio.',
      risco: 'Umidade residual e retração posterior descolam a placa. Se o cronograma emenda os dois sem folga de cura, a data é fictícia.' },

    { antes: 'forro', depois: 'piso', severidade: 'alta',
      motivo: 'Serviço que fica acima vem antes do que fica abaixo. Forro e gesso derrubam massa, poeira e água.',
      risco: 'Piso pronto embaixo de gesso em execução exige proteção física e limpeza pesada — custo que ninguém orçou — e ainda assim aparece risco e mancha de rejunte.' },

    { antes: 'reboco', depois: 'pintura', severidade: 'alta',
      motivo: 'Pintura é acabamento sobre base pronta e curada.',
      risco: 'Pintar sobre reboco verde causa bolha, descolamento e eflorescência.' },

    { antes: 'esquadria', depois: 'pintura', severidade: 'media',
      motivo: 'Com a esquadria instalada o ambiente fica fechado à chuva e ao vento.',
      risco: 'Chuva entrando estraga pintura, forro e piso de madeira, e volta como retrabalho.' },

    { antes: 'fachada', depois: 'pintura', severidade: 'media',
      motivo: 'Fachada vedada protege o acabamento interno.',
      risco: 'Infiltração pela fachada aberta danifica o interno já pronto.' },

    { antes: 'piso', depois: 'rodape', severidade: 'media',
      motivo: 'O rodapé fecha o encontro do piso com a parede, então vem depois do piso assentado.',
      risco: 'Rodapé antes obriga recorte e reassentamento.' },

    { antes: 'piso', depois: 'rejunte', severidade: 'alta',
      motivo: 'Rejunte fecha as juntas do revestimento já assentado, depois da cura da cola.',
      risco: 'Rejuntar antes da cura desalinha a placa e o rejunte trinca.' },

    { antes: 'hidraulica', depois: 'louca', severidade: 'alta',
      motivo: 'Louça e metal são ligados na instalação já pronta e testada.',
      risco: 'Instalar louça antes obriga desmontar pra corrigir a tubulação.' },

    { antes: 'piso', depois: 'limpeza', severidade: 'media',
      motivo: 'Limpeza final é o último serviço do ambiente.',
      risco: 'Limpar antes do piso é limpar duas vezes.' },

    { antes: 'contrapiso', depois: 'marmore', severidade: 'media',
      motivo: 'Soleira, peitoril e bancada assentam sobre base regularizada.',
      risco: 'Sem base pronta o assento fica fora de nível e precisa ser refeito.' },

    { antes: 'desforma', depois: 'alvenaria', severidade: 'media',
      motivo: 'O escoramento ocupa o pavimento; a alvenaria precisa da área liberada.',
      risco: 'Frente de serviço bloqueada e alvenaria executada em volta de escora, com fechamento posterior.' },
  ];

  // ---- Classificação ----

  // Quais serviços o nome desta tarefa menciona. Devolve lista de chaves.
  // Uma tarefa pode citar mais de um ("Contrapiso e impermeabilização") — nesse
  // caso ela não serve pra checar precedência entre esses dois, e o auditor
  // ignora o par (não dá pra saber a ordem dentro de uma tarefa só).
  function classificar(nome) {
    const n = ' ' + _norm(nome) + ' ';
    const achados = [];
    for (const chave in SERVICOS) {
      const s = SERVICOS[chave];
      if (s.exclui && s.exclui.some(e => n.includes(' ' + e))) continue;
      if (s.termos.some(termo => n.includes(' ' + termo))) achados.push(chave);
    }
    return achados;
  }

  function label(chave) { return (SERVICOS[chave] || {}).label || chave; }

  // Regra que governa o par (a, b), em qualquer sentido. Devolve a regra e se a
  // ordem informada está invertida.
  function regraEntre(servicoA, servicoB) {
    for (const r of REGRAS) {
      if (r.antes === servicoA && r.depois === servicoB) return { regra: r, invertido: false };
      if (r.antes === servicoB && r.depois === servicoA) return { regra: r, invertido: true };
    }
    return null;
  }

  function todasAsRegras() { return REGRAS.slice(); }
  function totalRegras() { return REGRAS.length; }
  function servicos() { return SERVICOS; }
  function normalizarNome(s) { return _norm(s); }

  return { classificar, label, regraEntre, todasAsRegras, totalRegras, servicos, normalizarNome };
})();
