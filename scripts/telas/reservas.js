/* ============================================================
   LOK CAR — SISTEMA · telas/reservas.js
   ------------------------------------------------------------
   §5, §6 e §7 do pedido: a lista com os sete filtros, o detalhe
   em blocos e as ações contextuais.

   QUATRO DECISÕES QUE VALEM EXPLICAÇÃO
   ------------------------------------------------------------
   1) A LISTA E O DETALHE SÃO A MESMA TELA, e o endereço decide
      qual dos dois abre: `#/reservas` abre a lista, `#/reservas/r04`
      abre o detalhe. É o que o roteador já faz e é o que faz o
      botão "voltar" do navegador funcionar sem nenhuma linha a
      mais. Uma tela separada para o detalhe duplicaria a busca do
      registro e desincronizaria o item marcado no menu.

   2) O FILTRO MORA NO ENDEREÇO (`?f=...`). Não é capricho: o
      painel já aponta para `#/reservas?f=hoje` e
      `#/reservas?f=pronta`, e uma pendência de reserva do site
      leva direto ao registro. Com o filtro no endereço, o link
      funciona, o F5 mantém o filtro e o "voltar" desfaz a troca
      de aba — três coisas que uma variável escondida não dá.

   3) A BUSCA É AO VIVO E NÃO REDESENHA A TELA INTEIRA. Redesenhar
      a cada tecla trocaria o campo por um novo e o cursor cairia
      fora no primeiro caractere. Então a digitação só refaz a
      tabela e o contador; o campo continua sendo o mesmo, com o
      cursor onde estava.

      O termo digitado NÃO vai para o endereço pelo mesmo motivo —
      escrever na barra de endereços dispara o roteador, que
      redesenha tudo. Mas ele É LIDO de `?q=` quando alguém chega
      por um link, e sobrevive à troca de aba.

   4) NENHUMA CONTA DE DINHEIRO ACONTECE AQUI. O bloco financeiro
      imprime o que `D.preco()` devolve, que é a MESMA conta que o
      site faz na tela de reserva. Recalcular nesta tela seria
      criar um segundo lugar capaz de divergir do primeiro — e
      ninguém saberia qual dos dois está certo.

   O QUE ESTA TELA NÃO FAZ, E DIZ QUE NÃO FAZ: criar reserva do
   zero (falta o formulário completo, que é a tela seguinte do
   módulo) e enviar contrato por link/e-mail/WhatsApp (depende do
   backend). As duas aparecem como ação, com o motivo escrito —
   nunca como botão que não responde.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.reservas = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;
  var CFG = window.LOKCAR_CONFIG;

  var params = (ctx && ctx.params) || {};

  /* O registro que o endereço pede (`#/reservas/r04`) chega no
     `alvo`, não nos parâmetros. Os parâmetros são só a consulta
     (`?f=...`, `?q=...`). */
  var ALVO = ctx && ctx.alvo ? String(ctx.alvo) : null;

  /* O texto usado pelo §26 para toda função que depende de algo
     que ainda não existe. Fica numa constante para o sistema
     inteiro dizer a MESMA frase — e para não haver a tentação de
     inventar um caminho falso só para o botão "fazer alguma coisa". */
  var AVISO_API = 'Disponível após integração do backend.';

  /* ==========================================================
     1 · TEXTO E CAMPOS
     ========================================================== */
  var esc = U.esc;

  /* Nome das duas pontas da locação, lidos do config do site.
     Escrever "Levamos até você" à mão aqui criaria uma segunda
     versão do mesmo rótulo — e um dia elas divergiriam. */
  var modoNome = function (id, qual) {
    var op = (qual === 'devolucao' ? CFG.getDevolucao(id) : CFG.getRecebimento(id));
    return op ? op.nome : null;
  };

  /* Endereço em campos → endereço em uma linha, para o mesmo
     formato que o site escreve. Quando falta a rua, devolve o que
     houver em vez de fingir um endereço completo. */
  var enderecoLinha = function (e) {
    if (!e) return null;
    var l1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
    if (e.complemento) l1 += ' · ' + e.complemento;
    var cidade = [e.cidade, e.uf].filter(Boolean).join(' — ');
    var l2 = [e.bairro, cidade].filter(Boolean).join(' · ');
    var l3 = e.cep ? 'CEP ' + e.cep : '';
    var t = [l1, l2, l3].filter(Boolean).join(' · ');
    return t || null;
  };

  /* Quem não foi informado não recebe um nome inventado. */
  var nomeDoCliente = function (r) {
    if (!r.clienteId) return null;
    var c = S.cliente(r.clienteId);
    return c ? c.nome : null;
  };

  var veiculoDe = function (r) { return S.veiculo(r.veiculoId); };

  var avisoApi = function (texto) {
    return '<div class="aviso aviso--neutro">' +
           '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
           '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
           '<span>' + esc(texto) + '</span></div>';
  };

  /* --- Campos de formulário ------------------------------------
     `fld`, `fldSel`, `fldTxt` e `lerCampos` moram no `ui.js` desde
     que outras telas passaram a precisar deles. Manter uma cópia
     aqui seria garantir que a segunda tela a usar o mesmo campo o
     desenhasse de um jeito ligeiramente diferente. */
  var fld = U.fld;
  var fldSel = U.fldSel;
  var fldTxt = U.fldTxt;
  var lerCampos = U.lerCampos;

  var numero = function (v) {
    var n = Number(String(v || '').replace(/[^\d-]/g, ''));
    return isNaN(n) || String(v || '').trim() === '' ? null : n;
  };

  /* ==========================================================
     2 · FILTROS (§5)
     ----------------------------------------------------------
     Os sete do pedido, na ordem do pedido. "Novas" e "Confirmadas"
     são plurais e por isso o filtro casa com o CÓDIGO do status
     ("nova", "confirmada") — nenhuma tela repete o rótulo.

     Duas abas foram acrescentadas às sete: "Contrato pendente" e
     "Pronta para retirada". Não é enfeite. A base tem reservas
     nesses dois estados e, sem as abas, elas só apareciam em
     "Todas" — sete abas somavam doze de quatorze reservas. Numa
     locadora, "o que está esperando assinatura" e "o que está
     esperando o cliente vir buscar" são justamente as duas listas
     que o balcão abre de manhã. O pedido diz "Todas" para a lista
     completa; para "Todas" ser a soma das partes, os dois estados
     precisam de lugar próprio.
     ========================================================== */
  var ABAS = [
    { id: 'todas',      rotulo: 'Todas',                  status: null },
    { id: 'nova',       rotulo: 'Novas',                  status: 'nova' },
    { id: 'aguardando', rotulo: 'Aguardando confirmação', status: 'aguardando' },
    { id: 'confirmada', rotulo: 'Confirmadas',            status: 'confirmada' },
    { id: 'contrato',   rotulo: 'Contrato pendente',      status: 'contrato' },
    { id: 'pronta',     rotulo: 'Prontas p/ retirada',    status: 'pronta' },
    { id: 'andamento',  rotulo: 'Em andamento',           status: 'andamento' },
    { id: 'finalizada', rotulo: 'Finalizadas',            status: 'finalizada' },
    { id: 'cancelada',  rotulo: 'Canceladas',             status: 'cancelada' }
  ];

  var acharAba = function (id) {
    for (var i = 0; i < ABAS.length; i++) {
      if (ABAS[i].id === id) return ABAS[i];
    }
    return null;
  };

  /* Todo filtro da lista passa por aqui e vira a mesma coisa:
     um nome e um teste. Existem três origens possíveis.

     - as abas, que casam por CÓDIGO de status;
     - um status cru que ainda não tenha aba — o endereço é texto
       livre e o painel pode escrever qualquer um deles;
     - dois recortes de operação do dia (`?f=hoje`, `?f=retiradas`),
       que é o que os cartões "Reservas hoje" e "Retiradas hoje"
       querem dizer. O segundo é o que o painel chama de
       "pronta": reserva com retirada marcada para hoje. */
  var filtroDe = function (f) {
    var aba = acharAba(f);
    if (aba) {
      return {
        id: aba.id,
        rotulo: aba.rotulo,
        teste: aba.status ? function (r) { return r.status === aba.status; } : null
      };
    }

    if (f === 'hoje') {
      return {
        id: 'hoje', rotulo: 'Movimentadas hoje', daOperacao: true,
        teste: function (r) { return r.status !== 'cancelada' && (r.de === D.HOJE || r.criadaEm === D.HOJE); }
      };
    }

    if (f === 'retiradas') {
      return {
        id: 'retiradas', rotulo: 'Para retirar hoje', daOperacao: true,
        teste: function (r) {
          return r.de === D.HOJE && (r.status === 'pronta' || r.status === 'confirmada' || r.status === 'contrato');
        }
      };
    }

    if (D.STATUS_RESERVA[f]) {
      return {
        id: f, rotulo: D.STATUS_RESERVA[f].rotulo, daOperacao: true,
        teste: function (r) { return r.status === f; }
      };
    }

    return filtroDe('todas');
  };

  /* O termo digitado sobrevive ao redesenho da tela porque vive
     aqui, e não no campo — o campo é recriado a cada desenho.
     Só é sobrescrito quando alguém chega por um link com `?q=`. */
  var BUSCA = '';
  if (params.q) BUSCA = String(params.q);

  /* Recorte por veículo (`?veiculo=v04`). A tela da frota manda
     para cá por este parâmetro, e ele é o que faz o clique em
     "Ver reservas deste carro" chegar a alguma coisa. Sem ele, o
     link abriria a lista inteira e o operador concluiria que o
     botão não funcionou.

     É um recorte SEPARADO da busca, e não um texto jogado dentro
     dela, porque as duas coisas se somam na cabeça de quem usa:
     "as reservas deste carro, e entre elas as do João". */
  var VEICULO = params.veiculo ? String(params.veiculo) : null;
  if (VEICULO && !S.veiculo(VEICULO)) VEICULO = null;

  var normalizar = function (v) {
    return String(v === null || v === undefined ? '' : v)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  };

  /* Busca por cliente, CPF, telefone e veículo — os quatro do
     pedido, mais o código da reserva e a placa, porque são os dois
     dados que o operador tem na mão quando o cliente liga.
     O documento entra como está na ficha (mascarado) e a busca
     também casa com os dígitos crus do telefone. */
  var alvosDe = function (r) {
    var v = veiculoDe(r);
    var c = r.clienteId ? S.cliente(r.clienteId) : null;

    var partes = [
      r.codigo, r.obs,
      v ? v.modelo : '', v ? v.placa : '',
      c ? c.nome : '', c ? c.doc : '', c ? c.telefone : '', c ? c.email : ''
    ];

    return normalizar(partes.join(' | '));
  };

  var combinaBusca = function (r, termo) {
    if (!termo) return true;
    var alvo = alvosDe(r);
    var pedacos = normalizar(termo).split(/\s+/).filter(Boolean);
    /* Todos os pedaços precisam casar: quem digita "ana 0001"
       quer a reserva da Ana que é a 0001, não todas as da Ana
       mais todas as 0001. */
    for (var i = 0; i < pedacos.length; i++) {
      if (alvo.indexOf(pedacos[i]) === -1) return false;
    }
    return true;
  };

  var ordenar = function (lista) {
    return lista.slice().sort(function (a, b) {
      var d = D.diffDias(a.criadaEm, b.criadaEm);
      if (d !== 0) return d;
      return a.codigo < b.codigo ? 1 : -1;
    });
  };

  var filtrar = function (filtro) {
    return ordenar(S.estado.reservas.filter(function (r) {
      if (VEICULO && r.veiculoId !== VEICULO) return false;
      if (filtro.teste && !filtro.teste(r)) return false;
      return combinaBusca(r, BUSCA);
    }));
  };

  /* O contador da aba respeita o recorte por veículo — senão a
     aba diria "12" e a lista mostraria 2, e o operador ia
     procurar as dez que faltam. */
  var contar = function (aba) {
    return S.estado.reservas.filter(function (r) {
      if (VEICULO && r.veiculoId !== VEICULO) return false;
      return aba.status ? r.status === aba.status : true;
    }).length;
  };

  /* ==========================================================
     3 · AÇÕES DE LINHA (§5)
     ----------------------------------------------------------
     Cada ação de linha é a MESMA ação contextual do detalhe. Não
     existe um caminho "rápido" que pule a trava: o botão só
     aparece habilitado quando `S.acoesDaReserva()` libera aquela
     reserva. É isso que impede a lista de confirmar o que o
     detalhe proíbe.
     ========================================================== */
  var ACAO_LINHA = {
    'confirmar':       { curto: 'Confirmar',   tom: 'pri' },
    'gerar-contrato':  { curto: 'Contrato',    tom: 'out' },
    'iniciar-locacao': { curto: 'Iniciar',     tom: 'out' },
    'cancelar':        { curto: 'Cancelar',    tom: 'out' }
  };

  var podeFazer = function (r, id) {
    var lista = S.acoesDaReserva(r);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  };

  var htmlAcoesLinha = function (r) {
    var html = '<a class="ab ab--pri" href="#/reservas/' + r.id + '" data-acao="ver" data-id="' + r.id + '">Ver</a>';

    Object.keys(ACAO_LINHA).forEach(function (id) {
      var conf = ACAO_LINHA[id];
      var a = podeFazer(r, id);
      if (!a) return;

      /* A ação já concluída não vira botão cinza na lista: a
         lista é para agir. O detalhe é que explica o que falta,
         porque lá há espaço para o motivo escrito. */
      if (!a.liberada) return;

      html += '<button class="ab' + (conf.tom === 'pri' ? ' ab--pri' : '') + '" type="button" ' +
              'data-acao="' + id + '" data-id="' + r.id + '">' + esc(conf.curto) + '</button>';
    });

    return html;
  };

  /* ==========================================================
     4 · TABELA (§5)
     ----------------------------------------------------------
     Nove colunas na ordem do pedido: Código, Cliente, Veículo,
     Data de retirada, Data de devolução, Forma de recebimento,
     Proteção, Valor, Status. Mais a coluna de ações, que o pedido
     pede implicitamente ao listá-las.
     ========================================================== */
  var linhaTabela = function (r) {
    var v = veiculoDe(r);
    var p = D.preco(r);
    var nome = nomeDoCliente(r);

    var clienteCel;
    if (nome) {
      clienteCel = '<span class="tbl__nome">' + esc(nome) + '</span>' +
                   '<span class="tbl__dim">' + esc((r.clienteId ? (S.cliente(r.clienteId) || {}).telefone : '') || 'Telefone a configurar') + '</span>';
    } else {
      clienteCel = '<span class="tbl__nome u-t3">Cliente não informado</span>' +
                   '<span class="tbl__dim">' +
                   (r.origem === 'site' ? 'Reserva recebida pelo site' : 'Cadastro a completar') + '</span>';
    }

    var veiculoCel = v
      ? '<span class="tbl__nome">' + esc(v.modelo) + '</span>' +
        '<span class="tbl__dim mono">' + esc(v.placa) + '</span>'
      : '<span class="falta">Veículo a definir</span>';

    var recebimento = modoNome(r.retiradaModo, 'recebimento') || 'A definir';
    var protecao = p.protecaoNome || 'A definir';

    return '<tr data-abre="' + r.id + '" data-id="' + r.id + '">' +
      '<td><span class="tbl__code">' + esc(r.codigo) + '</span>' +
        (r.origem === 'site' ? '<span class="tbl__dim">site</span>' : '') + '</td>' +
      '<td>' + clienteCel + '</td>' +
      '<td>' + veiculoCel + '</td>' +
      '<td class="tbl__num">' + D.fmtData(r.de) +
        '<span class="tbl__dim">' + esc(r.retiradaHora || '—') + '</span></td>' +
      '<td class="tbl__num">' + D.fmtData(r.ate) +
        '<span class="tbl__dim">' + esc(r.devolucaoHora || '—') + '</span></td>' +
      '<td>' + esc(recebimento) + '</td>' +
      '<td>' + esc(protecao) + '</td>' +
      '<td class="tbl__valor">' + valorNaLista(p) + '</td>' +
      '<td>' + U.crachaReserva(r) + '</td>' +
      '<td><div class="tbl__acts">' + htmlAcoesLinha(r) + '</div></td>' +
      '</tr>';
  };

  /* O valor na lista obedece à regra dura do pedido: sem tabela
     de diária ou com adicional sob consulta, não existe total —
     existe o que falta. Escrever um número menor do que o real
     seria o pior erro possível numa tela de dinheiro. */
  var valorNaLista = function (p) {
    if (p.incompleto) {
      return '<span class="falta" title="' + esc(motivoIncompleto(p)) + '">a definir</span>';
    }
    return D.fmtBRL(p.total);
  };

  var motivoIncompleto = function (p) {
    if (p.semTabela) return 'Este modelo ainda não tem diária na tabela do site.';
    return 'Há adicional sob consulta nesta reserva.';
  };

  var htmlTabela = function (lista) {
    if (!lista.length) {
      if (BUSCA) {
        return U.vazio('Nenhuma reserva para "' + BUSCA + '"',
          'A busca olha o nome do cliente, o documento, o telefone, o e-mail, o modelo, a placa e o código da reserva.');
      }
      return U.vazio('Nenhuma reserva nesta situação',
        'Troque de aba ou limpe a busca para ver a lista completa.');
    }

    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
      '<th>Código</th><th>Cliente</th><th>Veículo</th>' +
      '<th>Retirada</th><th>Devolução</th>' +
      '<th>Recebimento</th><th>Proteção</th><th>Valor</th><th>Status</th>' +
      '<th class="u-right">Ações</th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(linhaTabela).join('') + '</tbody>' +
      '</table></div>';
  };

  /* ==========================================================
     5 · LISTA
     ========================================================== */
  var htmlAbas = function (filtro) {
    var html = '';

    ABAS.forEach(function (aba) {
      var ativa = filtro.id === aba.id;
      html += '<button class="tabs__b" type="button" role="tab" ' +
              'aria-selected="' + (ativa ? 'true' : 'false') + '" ' +
              'data-acao="filtrar" data-f="' + aba.id + '">' +
              esc(aba.rotulo) +
              '<span class="tabs__n">' + contar(aba) + '</span>' +
              '</button>';
    });

    /* Quando o endereço pede um recorte que não é nenhuma das sete
       abas (o caso dos cartões do painel), ele aparece como uma
       aba a mais. Sem isso a lista viria filtrada e nada na tela
       diria por quê — o operador acharia que faltam reservas. */
    if (filtro.daOperacao) {
      html += '<button class="tabs__b tabs__b--extra" type="button" role="tab" ' +
              'aria-selected="true" data-acao="filtrar" data-f="todas">' +
              esc(filtro.rotulo) + '<span class="tabs__n">×</span></button>';
    }

    return html;
  };

  var htmlLista = function (filtro, lista) {
    var veiculo = VEICULO ? S.veiculo(VEICULO) : null;

    return '' +
      /* O recorte por veículo é dito em voz alta no topo da
         lista. Um filtro que age e não se anuncia é a maneira
         mais fácil de alguém concluir que a base perdeu
         registros. */
      (veiculo
        ? '<div class="aviso aviso--neutro u-mb">' +
          '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M4 16h16M5 16V11l2-5h10l2 5v5M7 16v2M17 16v2"/></svg>' +
          '<span>Mostrando só as reservas de <b>' + esc(veiculo.modelo) + '</b> ' +
          '<span class="mono">' + esc(veiculo.placa) + '</span>. ' +
          'As contagens das abas também são só deste carro.</span>' +
          '<button class="ab" type="button" data-acao="limpar-veiculo">Ver todas</button>' +
          '</div>'
        : '') +
      '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar reservas por situação">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'reserva' : 'reservas') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Cliente, CPF, telefone ou veículo" ' +
             'aria-label="Buscar reserva por cliente, documento, telefone ou veículo" />' +
      '    </div>' +
           (BUSCA ? '<button class="ab" type="button" data-acao="limpar">Limpar</button>' : '') +
      '  </div>' +
      '</div>' +
      '<section class="card">' +
      '  <div class="card__body card__body--flush" data-slot="lista">' + htmlTabela(lista) + '</div>' +
      '</section>';
  };

  /* ==========================================================
     6 · DETALHE (§6)
     ========================================================== */
  var BLOCO_ICO = {
    cliente: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    veiculo: 'M4 16h16M5 16V11l2-5h10l2 5v5M7 16v2M17 16v2M7.5 11h9',
    periodo: 'M8 3v3M16 3v3M4 8h16M5 5h14v15H5z',
    entrega: 'M4 12h13M13 7l5 5-5 5M4 19h6',
    devolucao: 'M20 12H7M11 7l-5 5 5 5M20 5h-6',
    protecao: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4',
    adicionais: 'M12 5v14M5 12h14',
    financeiro: 'M3 7h18v11H3zM3 11h18M7 15h3',
    status: 'M3 12h4l3 7 4-14 3 7h4'
  };

  var bloco = function (id, titulo, conteudo, extraClasse, nota) {
    return '<section class="bloco' + (extraClasse ? ' ' + extraClasse : '') + '">' +
      '<div class="bloco__h">' +
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + BLOCO_ICO[id] + '"/></svg>' +
      '  <h2>' + esc(titulo) + '</h2>' +
      (nota ? '<span class="bloco__n">' + esc(nota) + '</span>' : '') +
      '</div>' +
      conteudo +
      '</section>';
  };

  var ficha = function (linhas) {
    return '<dl class="ficha">' + linhas.map(function (l) {
      return '<div><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>';
    }).join('') + '</dl>';
  };

  var corpo = function (html) { return '<div class="bloco__b">' + html + '</div>'; };

  /* --- CLIENTE -------------------------------------------------
     Reserva vinda do site NÃO tem cliente, e isso é de propósito:
     o formulário público guarda a configuração da locação, sem
     dado pessoal. A tela diz isso e oferece o único caminho
     honesto — vincular a ficha de um cliente já cadastrado. */
  var blocoCliente = function (r) {
    var c = r.clienteId ? S.cliente(r.clienteId) : null;

    if (!c) {
      return bloco('cliente', 'Cliente', corpo(
        '<div class="aviso aviso--neutro">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
        '<span>Reserva recebida pelo site <b>sem dados pessoais</b>. O formulário público envia ' +
        'apenas a configuração da locação; o cadastro é completado aqui, como numa locadora ' +
        'de verdade — é o que a pendência "cliente ainda não informado" está cobrando.</span>' +
        '</div>' +
        '<div class="u-mt-lg">' +
        U.botao('Vincular cliente cadastrado', 'vincular-cliente', 'pri', { id: r.id }) +
        '</div>'
      ));
    }

    return bloco('cliente', 'Cliente', corpo(ficha([
      ['Nome', '<a class="ab" href="#/clientes/' + c.id + '" data-acao="ir-cliente" data-id="' + c.id + '">' + esc(c.nome) + '</a>'],
      [c.tipo === 'PJ' ? 'CNPJ' : 'CPF', '<span class="mono">' + esc(c.doc) + '</span>'],
      ['Telefone', esc(c.telefone || '') || '<span class="falta">a configurar</span>'],
      ['E-mail', esc(c.email || '') || '<span class="falta">a configurar</span>'],
      ['CNH', c.cnh ? '<span class="mono">' + esc(c.cnh.numero) + '</span>' : '<span class="falta">não se aplica</span>'],
      ['Validade da CNH', c.cnh && c.cnh.validade ? D.fmtData(c.cnh.validade) : '<span class="falta">a configurar</span>'],
      ['Cliente desde', D.fmtData(c.desde)]
    ])) + (r.origem === 'site'
      ? '<div class="aviso aviso--neutro u-mt"><svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
        '<span>Documentos do cliente são genéricos (' + esc(D.CLIENTES[0].doc) + '): esta base é de demonstração.</span></div>'
      : ''));
  };

  /* --- VEÍCULO ------------------------------------------------- */
  var blocoVeiculo = function (r) {
    var v = veiculoDe(r);
    var p = D.preco(r);

    if (!v) {
      return bloco('veiculo', 'Veículo', corpo('<p class="falta">Veículo ainda não definido nesta reserva.</p>'));
    }

    var diaria = p.diaria === null
      ? '<span class="falta">Sob consulta</span>'
      : D.fmtBRL(p.diaria) + ' <span class="u-t4 u-xs">/ dia</span>';

    return bloco('veiculo', 'Veículo', corpo(
      '<div class="mini u-mb">' +
      '  <img class="mini__img" src="' + esc(v.img) + '" alt="" />' +
      '  <div>' +
      '    <b class="tbl__nome">' + esc(v.modelo) + '</b>' +
      '    <span class="tbl__dim mono">' + esc(v.placa) + ' · ' + v.ano + '</span>' +
      '  </div>' +
      '</div>' +
      ficha([
        ['Categoria', esc(v.categoria)],
        ['Câmbio', esc(v.cambio) + ' · ' + v.lugares + ' lugares'],
        ['Cor', esc(v.cor)],
        ['Quilometragem', v.km === null || v.km === undefined ? '<span class="falta">a configurar</span>' : D.fmtBRL(null) === '' ? '' : v.km.toLocaleString('pt-BR') + ' km'],
        ['Diária', diaria],
        ['Situação', U.crachaVeiculo(v)]
      ]) +
      '<div class="u-mt">' + U.botao('Abrir ficha na frota', 'ir-veiculo', 'out', { id: v.id }) + '</div>'
    ), 'bloco--largo');
  };

  /* --- PERÍODO, ENTREGA E DEVOLUÇÃO ----------------------------
     As três respondem "quando, quantos dias, onde". A entrega só
     mostra endereço quando a opção escolhida pede endereço —
     imprimir "endereço a definir" numa retirada na loja seria
     inventar uma pendência que não existe. */
  var blocoPeriodo = function (r) {
    var p = D.preco(r);
    var dias = r.dias === 1 ? '1 diária' : r.dias + ' diárias';

    return bloco('periodo', 'Período', corpo(ficha([
      ['Retirada', D.fmtData(r.de) + ' <span class="u-t4 u-xs">· ' + esc(D.quando(r.de)) + '</span>'],
      ['Devolução', D.fmtData(r.ate) + ' <span class="u-t4 u-xs">· ' + esc(D.quando(r.ate)) + '</span>'],
      ['Duração', esc(dias)],
      ['Diária', p.diaria === null ? '<span class="falta">Sob consulta</span>' : D.fmtBRL(p.diaria)],
      ['Faixa aplicada', p.pct > 0 ? p.pct + '% de desconto' : 'Sem desconto por faixa']
    ])));
  };

  /* ----------------------------------------------------------
     HISTÓRICO DA RESERVA

     O que foi mexido, quando e por quem. Existe porque alterar o
     período muda o que o cliente contratou, e a pergunta "por que
     esta reserva está com outra data?" precisa ter resposta no
     próprio registro — não na memória de quem atendeu.

     O bloco só aparece quando há o que mostrar. Um card vazio
     dizendo "nenhuma alteração" ocupa espaço para informar o
     óbvio em toda reserva recém-criada.
     ---------------------------------------------------------- */
  var blocoHistorico = function (r) {
    var hist = r.historico || [];
    if (!hist.length) return '';

    var itens = hist.slice().reverse().map(function (h) {
      var antes = D.fmtData(h.de) + (h.deHora ? ' às ' + h.deHora : '');
      var depois = D.fmtData(h.novoAte) + (h.novoAteHora ? ' às ' + h.novoAteHora : '');

      return '<div class="hres__i">' +
        '<div class="hres__top">' +
          U.etiqueta(h.rotulo || 'ALTERAÇÃO', h.tipo === 'prorrogacao' ? 'ok' : 'warn') +
          '<span class="hres__q">' + esc(h.em || '') + (h.hora ? ' às ' + esc(h.hora) : '') + '</span>' +
        '</div>' +
        '<div class="hres__bd">' +
          '<span class="hres__l">De</span> ' +
          '<span class="hres__v">' + esc(antes) + '</span>' +
          '<span class="hres__l">para</span> ' +
          '<span class="hres__v">' + esc(depois) + '</span>' +
          (h.deDias && h.paraDias && h.deDias !== h.paraDias
            ? ' <span class="hres__l">(' + h.deDias + ' → ' + h.paraDias + ' diárias)</span>'
            : '') +
        '</div>' +
        '<div class="hres__og">Origem: ' + esc(h.origem || 'ADMINISTRADOR') + '</div>' +
        '</div>';
    }).join('');

    return bloco('historico', 'Histórico de alterações',
      corpo(itens + (hist.length > 1
        ? '<p class="u-xs u-t4 u-mt">' + hist.length + ' alterações registradas nesta reserva.</p>'
        : '')), 'bloco--largo');
  };

  var blocoEntrega = function (r) {
    var nome = modoNome(r.retiradaModo, 'recebimento');
    var endereco = enderecoLinha(r.retiradaEndereco);
    var porEndereco = r.retiradaModo === 'entrega';

    return bloco('entrega', 'Entrega', corpo(
      '<p class="bloco__destaque">' + esc(nome || 'A definir') + '</p>' +
      ficha([
        ['Horário', esc(r.retiradaHora || '') || '<span class="falta">a configurar</span>'],
        ['Local',
          porEndereco
            ? (endereco ? esc(endereco) : '<span class="falta">Endereço a configurar</span>')
            : (modoNome('locadora', 'recebimento') || 'Unidade da locadora')]
      ]) +
      (porEndereco && endereco
        ? '<div class="u-mt">' + U.botao('Copiar endereço', 'copiar-endereco', 'out', { texto: endereco }) + '</div>'
        : '')
    ));
  };

  var blocoDevolucao = function (r) {
    var nome = modoNome(r.devolucaoModo, 'devolucao');
    var endereco = enderecoLinha(r.devolucaoEndereco);
    var porEndereco = r.devolucaoModo === 'endereco';

    return bloco('devolucao', 'Devolução', corpo(
      '<p class="bloco__destaque">' + esc(nome || 'A definir') + '</p>' +
      ficha([
        ['Horário', esc(r.devolucaoHora || '') || '<span class="falta">a configurar</span>'],
        ['Local',
          porEndereco
            ? (endereco ? esc(endereco) : '<span class="falta">Endereço de busca ainda não informado</span>')
            : (modoNome('locadora', 'devolucao') || 'Unidade da locadora')]
      ])
    ));
  };

  /* --- PROTEÇÃO E ADICIONAIS ----------------------------------- */
  var blocoProtecao = function (r) {
    var p = D.preco(r);
    var prot = p.protecao;

    /* A descrição abre o bloco e os detalhes vêm em lista. Os
       dois textos são os MESMOS que o site mostra na tela de
       reserva — o cliente já leu isto quando escolheu. */
    var detalhes = (prot.detalhes || []).map(function (t) {
      return '<li>' + esc(t) + '</li>';
    }).join('');

    return bloco('protecao', 'Proteção', corpo(
      '<p class="bloco__destaque">' + esc(prot.nome) + '</p>' +
      '<p class="u-sm u-t2">' + esc(prot.descricao || '') + '</p>' +
      ficha([
        ['Valor por dia', prot.valorDia > 0 ? D.fmtBRL(prot.valorDia) : 'Não entra no cálculo'],
        ['No período', prot.valorDia > 0
          ? D.fmtBRL(prot.valorDia) + ' × ' + p.dias + ' = <b>' + D.fmtBRL(p.protTotal) + '</b>'
          : 'Não contratada']
      ]) +
      (detalhes ? '<ul class="lista-check u-mt">' + detalhes + '</ul>' : '')
    ));
  };

  var blocoAdicionais = function (r) {
    var p = D.preco(r);
    var escolhidos = (r.adicionais || []).filter(function (a) { return (Number(a.qtd) || 0) > 0; });

    if (!escolhidos.length) {
      return bloco('adicionais', 'Adicionais', corpo(
        '<p class="u-t3 u-sm">Nenhum serviço adicional escolhido nesta reserva.</p>' +
        '<p class="u-xs u-t4 u-mt">Os adicionais do site (lavagem, motorista, cadeirinha, assento, ' +
        'entrega e retirada) entram no cálculo quando o cliente marca algum.</p>'
      ));
    }

    var linhas = escolhidos.map(function (a) {
      var def = CFG.getAdicional ? CFG.getAdicional(a.id) : null;
      var qtd = Number(a.qtd) || 0;
      var nome = def ? def.nome : (a.nome || 'Adicional');
      var valor;

      if (a.id === null || a.id === undefined) {
        /* Adicional que veio do site sem correspondência na tabela
           atual: não há preço para somar. Ele aparece, e aparece
           como o que é. */
        valor = '<span class="falta">Sob consulta</span>';
      } else if (def && def.sobConsulta) {
        valor = '<span class="falta">' + esc(CFG.textos.rotuloSobConsulta) + '</span>';
      } else if (def) {
        valor = D.fmtBRL(def.valorFixo) + (qtd > 1 ? ' × ' + qtd + ' = <b>' + D.fmtBRL(def.valorFixo * qtd) + '</b>' : '');
      } else {
        valor = '<span class="falta">a definir</span>';
      }

      return [nome + (qtd > 1 ? ' (' + qtd + '×)' : ''), valor];
    });

    return bloco('adicionais', 'Adicionais', corpo(ficha(linhas) +
      '<p class="u-xs u-t4 u-mt">Adicional sob consulta não entra no total: o valor depende da ' +
      'distância e do endereço, e só a locadora pode fechá-lo.</p>'
    ));
  };

  /* --- FINANCEIRA ----------------------------------------------
     A conta inteira vem de `D.preco()`. Quando a reserva usa um
     modelo que não está na tabela do site, ou tem adicional sob
     consulta, o total NÃO é escrito: um número menor que o real
     numa tela de dinheiro é pior que a palavra "a definir". */
  var blocoFinanceiro = function (r) {
    var p = D.preco(r);
    var linhas = [];

    var l = function (rotulo, valor, classe) {
      linhas.push('<div class="conta__l' + (classe ? ' ' + classe : '') + '">' +
                  '<span>' + rotulo + '</span><span>' + valor + '</span></div>');
    };

    if (p.semTabela) {
      l('Diárias (' + p.dias + ' × sob consulta)', '<span class="falta">' + esc(AVISO_API ? 'sem tabela de diária' : '') + '</span>');
    } else {
      l('Diárias — ' + p.dias + ' × ' + D.fmtBRL(p.diaria), D.fmtBRL(p.bruto));
      if (p.pct > 0) {
        l('Desconto de ' + p.pct + '% (' + p.dias + ' dias)', '− ' + D.fmtBRL(p.desconto), 'conta__l--desconto');
      }
    }

    /* Sem proteção contratada a linha NÃO leva "R$ 0,00". Um zero
       escrito como dinheiro afirma "esta proteção custa zero", e o
       que está dito é outra coisa: não há proteção nenhuma. */
    l('Proteção — ' + esc(p.protecaoNome),
      p.protTotal > 0 ? D.fmtBRL(p.protTotal) : '<span class="falta">não contratada</span>');

    p.adicionais.forEach(function (a) {
      linhas.push('<div class="conta__l"><span>' + esc(a.nome) + '</span><span>' +
                  (a.sobConsulta ? '<span class="falta">' + esc(a.valor) + '</span>' : esc(a.valor)) +
                  '</span></div>');
    });

    if (p.taxa > 0) l('Taxa de entrega (uma vez)', D.fmtBRL(p.taxa));

    return bloco('financeiro', 'Financeira',
      '<div class="conta">' + linhas.join('') +
      '<div class="conta__l conta__l--total"><span>Total</span><span>' +
      (p.incompleto ? '<span class="falta">a definir</span>' : D.fmtBRL(p.total)) +
      '</span></div>' +
      '</div>' +
      (p.incompleto
        ? '<div class="conta__aviso">' + esc(motivoIncompleto(p)) +
          ' O valor entra na conta quando a Lok Car definir a diária do modelo, ou quando o ' +
          'adicional sob consulta for fechado no atendimento.</div>'
        : ''), 'bloco--largo', 'a mesma conta do site');
  };

  /* --- STATUS -------------------------------------------------- */
  var blocoStatus = function (r) {
    var k = S.contratoDaReserva(r.id);
    var l = S.locacaoDaReserva(r.id);
    var vSaida = vistoriaDe(r, 'saida');
    var vDevol = l ? S.vistoriasDaLocacao(l.id, 'devolucao')[0] : null;

    var pagamento = {
      pago: '<span class="bdg bdg--ok">Pago</span>',
      pendente: '<span class="bdg bdg--warn">Pagamento pendente</span>',
      cancelado: '<span class="bdg bdg--idle">Pagamento cancelado</span>'
    }[r.pagamento] || '<span class="falta">a definir</span>';

    return bloco('status', 'Status', corpo(
      '<div class="u-flex u-wrap u-between u-mb">' +
      '  <div>' + U.crachaReserva(r) + '</div>' +
      '  <div>' + pagamento + '</div>' +
      '</div>' +
      ficha([
        ['Origem', r.origem === 'site'
          ? 'Formulário do site público'
          : 'Cadastro no sistema'],
        ['Criada em', D.fmtData(r.criadaEm) + ' <span class="u-t4 u-xs">· ' + esc(D.quando(r.criadaEm)) + '</span>'],
        ['Contrato', k
          ? '<a class="ab" href="#/contratos/' + k.id + '" data-acao="ir-contrato" data-id="' + k.id + '">' + esc(k.codigo) + '</a> ' + U.crachaContrato(k)
          : '<span class="falta">não gerado</span>'],
        ['Locação', l
          ? '<a class="ab" href="#/locacoes/' + l.id + '" data-acao="ir-locacao" data-id="' + l.id + '">' + esc(l.codigo) + '</a>'
          : '<span class="falta">não iniciada</span>'],
        ['Vistoria de saída', vSaida
          ? esc(vSaida.codigo) + ' ' + U.crachaVistoria(vSaida)
          : '<span class="falta">não registrada</span>'],
        ['Vistoria de devolução', vDevol
          ? esc(vDevol.codigo) + ' ' + U.crachaVistoria(vDevol)
          : '<span class="falta">não registrada</span>'],
        ['Observação', esc(r.obs || '') || '<span class="falta">sem observação</span>']
      ])
    ));
  };

  /* ==========================================================
     7 · AÇÕES CONTEXTUAIS (§7)
     ----------------------------------------------------------
     As nove ações do pedido, na ordem do pedido. Nenhuma delas
     some quando está bloqueada: ela fica cinza E DIZ POR QUÊ.
     Esconder seria pior que desabilitar — o operador concluiria
     que a ação não existe no sistema, e não que falta um passo.
     ========================================================== */
  var ACAO_ICO = {
    'confirmar': 'M20 6L9 17l-5-5',
    'gerar-contrato': 'M7 3h7l4 4v14H7zM14 3v5h4M10 13h5M10 17h5',
    'enviar-contrato': 'M22 3L11 14M22 3l-7 19-4-8-8-4z',
    'registrar-pagamento': 'M3 7h18v11H3zM3 11h18M7 15h3',
    'iniciar-locacao': 'M4 12h13M13 7l5 5-5 5M4 19h6',
    'vistoria-saida': 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4',
    'finalizar': 'M20 6L9 17l-5-5M4 4h16',
    'vistoria-devolucao': 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM12 8v4M12 15v.01',
    'cancelar': 'M6 6l12 12M18 6L6 18'
  };

  var O_QUE_FALTA = {
    'confirmar': 'Passa a reserva para Confirmada.',
    'gerar-contrato': 'Monta o contrato a partir desta reserva.',
    'enviar-contrato': 'Registra o envio e marca como aguardando assinatura.',
    'registrar-pagamento': 'Marca o lançamento em aberto como recebido.',
    'iniciar-locacao': 'Cria a locação e a vistoria de devolução pendente.',
    'vistoria-saida': 'Libera a retirada do veículo.',
    'finalizar': 'Devolve o veículo para a frota.',
    'vistoria-devolucao': 'Registra como o carro voltou.',
    'cancelar': 'Cancela a reserva e os lançamentos em aberto.'
  };

  var htmlAcoes = function (r) {
    var lista = S.acoesDaReserva(r);

    return '<div class="acoes">' + lista.map(function (a) {
      return '<button class="acao' + (a.liberada && a.tom === 'pri' ? ' acao--pri' : '') + '" type="button" ' +
             'data-acao="reserva-acao" data-qual="' + a.id + '" data-id="' + r.id + '"' +
             (a.liberada ? '' : ' aria-disabled="true" title="' + esc(a.motivo || '') + '"') + '>' +
             '<span class="acao__ico">' +
             '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ACAO_ICO[a.id] || 'M12 8v5M12 16.5v.01') + '"/></svg>' +
             '</span>' +
             '<span class="acao__t">' +
             '<b>' + esc(a.rotulo) + '</b>' +
             '<span>' + esc(a.liberada ? (O_QUE_FALTA[a.id] || '') : (a.motivo || '')) + '</span>' +
             '</span>' +
             '</button>';
    }).join('') + '</div>';
  };

  /* ==========================================================
     8 · AÇÕES QUE ABREM DIÁLOGO
     ----------------------------------------------------------
     Cada ação que precisa de um dado abre o seu modal. O que não
     depende de dado nenhum executa direto — pedir confirmação
     para tudo ensina o operador a clicar sem ler.
     ========================================================== */
  var vistoriaDe = function (r, tipo) {
    var l = S.locacaoDaReserva(r.id);
    var lista = l ? S.vistoriasDaLocacao(l.id, tipo) : S.vistoriasDaLocacao(r.id, tipo);
    return lista[0] || null;
  };

  var combustivelOpcoes = function () {
    return D.NIVEIS_COMBUSTIVEL.map(function (n) { return { valor: n, rotulo: n }; });
  };

  var abrirVistoria = function (r, tipo) {
    var v = vistoriaDe(r, tipo);

    /* A vistoria de saída existe desde a criação da reserva como
       registro pendente. A de devolução nasce junto com a locação.
       Quando não existe nenhuma, ela é criada agora — melhor um
       registro pendente a mais que um registro perdido. */
    if (!v) {
      var criada = S.criarVistoria({
        tipo: tipo, reserva: r.id,
        clienteId: r.clienteId, veiculoId: r.veiculoId
      });
      v = criada.vistoria;
    }

    var titulo = tipo === 'saida' ? 'Vistoria de saída' : 'Vistoria de devolução';

    U.abrirModal({
      titulo: titulo,
      sub: v.codigo + ' · ' + U.nomeVeiculo(r.veiculoId),
      largo: true,
      corpo:
        '<p class="u-sm u-t2">O que a vistoria registra agora é o que dá base para a devolução: ' +
        'quilometragem, combustível e observação de cada avaria.</p>' +
        '<div class="grid2 u-mt">' +
        fld('Quilometragem', 'number', 'km', v.km === null || v.km === undefined ? '' : String(v.km),
            'Leitura do hodômetro', true) +
        fldSel('Combustível', 'combustivel', combustivelOpcoes(), v.combustivel) +
        '</div>' +
        '<div class="grid2 u-mt">' +
        fld('Hora', 'time', 'hora', v.hora || '') +
        fld('Data', 'text', 'data', D.fmtData(v.data || D.HOJE)) +
        '</div>' +
        '<p class="fld__lbl u-mt-lg">Áreas do veículo</p>' +
        '<p class="u-xs u-t4">As seis áreas do pedido. O anexo de foto é o que falta para a ' +
        'vistoria ficar completa — ' + esc(AVISO_API.toLowerCase()) + '</p>' +
        /* A montagem das áreas e das vagas de foto mora no `ui.js`,
           porque as telas de Reservas e de Vistorias precisam da
           MESMA coisa. Duas cópias divergem — foi assim que um
           crachá passou a imprimir a palavra do tom no lugar do
           rótulo do status. */
        U.areasVistoria(v.areas, { classe: 'u-mt' }) +
        fldTxt('Observação', 'obs', v.obs, 'Avaria, limpeza, o que mais importar.'),
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Salvar e concluir', tom: 'pri', acao: 'salvar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'salvar') { fechar(); return; }

        var c = lerCampos();
        var km = numero(c.km);
        if (km === null) {
          U.canto('Informe a quilometragem para concluir a vistoria.', 'erro');
          return;
        }
        if (!c.combustivel) {
          U.canto('Informe o nível de combustível para concluir a vistoria.', 'erro');
          return;
        }

        var r2 = S.salvarVistoria(v.id, {
          km: km, combustivel: c.combustivel, hora: c.hora,
          obs: c.obs, concluir: true
        });

        if (r2.ok === false) { U.canto(r2.mensagem, 'erro'); return; }
        fechar();
        U.resultado(r2);
        U.desenhar();
      }
    });
  };

  var abrirIniciarLocacao = function (r) {
    var v = veiculoDe(r);

    U.abrirModal({
      titulo: 'Iniciar locação',
      sub: r.codigo + ' · ' + U.nomeVeiculo(r.veiculoId),
      corpo:
        '<p class="u-sm u-t2">A locação é o contrato que saiu do papel. Ao iniciar, o sistema cria ' +
        'a locação e já deixa a <b>vistoria de devolução pendente</b> — é ela que impede a locação ' +
        'de ser finalizada sem registro.</p>' +
        '<div class="grid2 u-mt">' +
        fld('Quilometragem de saída', 'number', 'km',
            v && v.km !== null && v.km !== undefined ? String(v.km) : '', 'Leitura do hodômetro', true) +
        fldSel('Combustível de saída', 'combustivel', combustivelOpcoes(), 'Cheio') +
        '</div>' +
        fld('Hora da retirada', 'time', 'hora', r.retiradaHora || ''),
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Iniciar locação', tom: 'pri', acao: 'iniciar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'iniciar') { fechar(); return; }

        var c = lerCampos();
        var km = numero(c.km);
        if (km === null) {
          U.canto('A locação não começa sem a quilometragem de saída.', 'erro');
          return;
        }
        if (!c.combustivel) {
          U.canto('Informe o combustível de saída.', 'erro');
          return;
        }

        var res = S.iniciarLocacao(r.id, { km: km, combustivel: c.combustivel, hora: c.hora });
        if (res.ok === false) { U.canto(res.mensagem, 'erro'); return; }

        fechar();
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  var abrirFinalizar = function (r) {
    var l = S.locacaoDaReserva(r.id);
    if (!l) { U.canto('Não há locação em andamento para esta reserva.', 'aviso'); return; }

    var vd = S.vistoriasDaLocacao(l.id, 'devolucao')[0];

    U.abrirModal({
      titulo: 'Finalizar locação',
      sub: l.codigo + ' · ' + U.nomeVeiculo(l.veiculoId),
      corpo:
        '<p class="u-sm u-t2">Finalizar devolve o veículo para a frota. A quilometragem de entrada ' +
        'atualiza a ficha do carro — é o que mantém o alerta de revisão com a data certa.</p>' +
        '<div class="grid2 u-mt">' +
        fld('Quilometragem de entrada', 'number', 'km',
            vd && vd.km !== null && vd.km !== undefined ? String(vd.km) : '', 'Leitura do hodômetro', true) +
        fldSel('Combustível de entrada', 'combustivel', combustivelOpcoes(), vd ? vd.combustivel : '') +
        '</div>' +
        fld('Hora da devolução', 'time', 'hora', vd && vd.hora ? vd.hora : ''),
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Finalizar', tom: 'pri', acao: 'finalizar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'finalizar') { fechar(); return; }

        var c = lerCampos();
        var km = numero(c.km);
        if (km === null) { U.canto('Informe a quilometragem de entrada.', 'erro'); return; }

        var res = S.finalizarLocacao(l.id, { km: km, combustivel: c.combustivel, hora: c.hora });
        if (res.ok === false) { U.canto(res.mensagem, 'erro'); return; }

        fechar();
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  /* O aditivo de pagamento é lido na hora, e não no desenho da
     tela: entre o desenho e o clique alguém pode ter registrado
     o pagamento noutra aba do sistema. */
  var abrirPagamento = function (r) {
    var aberto = S.estado.lancamentos.filter(function (f) {
      return f.reserva === r.id && (f.status === 'pendente' || f.status === 'atrasado');
    })[0];

    if (!aberto) {
      U.canto('Não há valor em aberto para esta reserva.', 'aviso');
      return;
    }

    var valor = D.valorDoLancamento(aberto);
    if (valor === null) {
      U.canto('Este lançamento ainda não tem valor definido — configure a regra antes de registrar o pagamento.', 'aviso');
      return;
    }

    U.abrirModal({
      titulo: 'Registrar pagamento',
      sub: aberto.descricao,
      corpo:
        '<dl class="ficha">' +
        '<div><dt>Valor</dt><dd><b>' + D.fmtBRL(valor) + '</b></dd></div>' +
        '<div><dt>Vencimento</dt><dd>' + D.fmtData(aberto.vencimento) + '</dd></div>' +
        '<div><dt>Situação atual</dt><dd>' + U.crachaFinanceiro({ status: aberto.status }) + '</dd></div>' +
        '</dl>' +
        '<div class="u-mt">' +
        fldSel('Forma de recebimento', 'forma', [
          { valor: 'PIX', rotulo: 'PIX' },
          { valor: 'Crédito', rotulo: 'Cartão de crédito' },
          { valor: 'Débito', rotulo: 'Cartão de débito' },
          { valor: 'Dinheiro', rotulo: 'Dinheiro' },
          { valor: 'Transferência', rotulo: 'Transferência' }
        ], 'PIX') +
        '</div>' +
        avisoApi('A conciliação automática com a maquininha ou o banco depende da integração. ' +
                 'Aqui o recebimento é registrado à mão, com a data de hoje.'),
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Registrar ' + D.fmtBRL(valor), tom: 'pri', acao: 'pagar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'pagar') { fechar(); return; }
        var c = lerCampos();
        var res = S.registrarPagamento(aberto.id, c.forma);
        if (res.ok === false) { U.canto(res.mensagem, 'erro'); return; }
        fechar();
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  var abrirEnviarContrato = function (r) {
    var k = S.contratoDaReserva(r.id);
    if (!k) { U.canto('Gere o contrato antes de enviar.', 'aviso'); return; }

    U.abrirModal({
      titulo: 'Enviar contrato',
      sub: k.codigo + ' · ' + nomeDoCliente(r),
      corpo:
        '<p class="u-sm u-t2">O sistema registra por onde o contrato saiu e passa o documento para ' +
        '<b>aguardando assinatura</b>. É exatamente o estado em que ele fica: na mão do cliente.</p>' +
        '<div class="u-mt">' +
        fldSel('Via de envio', 'via', [
          { valor: 'Link para assinatura', rotulo: 'Link para assinatura' },
          { valor: 'E-mail', rotulo: 'E-mail' },
          { valor: 'WhatsApp', rotulo: 'WhatsApp' },
          { valor: 'Presencial', rotulo: 'Entregue no balcão' }
        ], 'Link para assinatura') +
        '</div>' +
        avisoApi('O envio por link, e-mail ou WhatsApp e a coleta da assinatura dependem da ' +
                 'integração. O sistema não finge que enviou — ele registra o que o operador fez.'),
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Registrar envio', tom: 'pri', acao: 'enviar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'enviar') { fechar(); return; }
        var c = lerCampos();
        var res = S.enviarContrato(k.id, c.via);
        fechar();
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  var abrirCancelamento = function (r) {
    var emAberto = S.estado.lancamentos.filter(function (f) {
      return f.reserva === r.id && f.status === 'pendente';
    });

    U.confirmar(
      'Cancelar a reserva ' + r.codigo,
      'A reserva vira Cancelada. ' +
      (emAberto.length
        ? 'Os ' + emAberto.length + ' lançamento(s) pendente(s) desta reserva também são cancelados.'
        : 'Não há lançamento pendente nesta reserva.'),
      'Cancelar reserva',
      function () {
        var res = S.cancelarReserva(r.id, '');
        U.resultado(res);
        U.desenhar();
      }
    );
  };

  /* --- Vincular cliente a uma reserva do site ------------------ */
  var abrirVincularCliente = function (r) {
    var clientes = S.estado.clientes;

    U.abrirModal({
      titulo: 'Vincular cliente',
      sub: r.codigo + ' · reserva recebida pelo site sem dados pessoais',
      largo: true,
      corpo:
        '<p class="u-sm u-t2">A reserva veio do formulário público apenas com a configuração da ' +
        'locação. Escolha a ficha do cliente que fez o pedido — o sistema não adivinha quem é.</p>' +
        '<div class="u-mt">' +
        fldSel('Cliente', 'clienteId', clientes.map(function (c) {
          return { valor: c.id, rotulo: c.nome + ' · ' + (c.tipo === 'PJ' ? 'CNPJ ' : 'CPF ') + c.doc };
        }), '') +
        '</div>' +
        avisoApi('Buscar o cliente pelo telefone ou documento informado no site depende da ' +
                 'integração com o formulário. Nesta fase a escolha é manual, na lista de clientes.'),
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Vincular', tom: 'pri', acao: 'vincular' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'vincular') { fechar(); return; }
        var c = lerCampos();
        if (!c.clienteId) { U.canto('Escolha um cliente.', 'erro'); return; }
        var res = S.informarCliente(r.id, c.clienteId);
        fechar();
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  /* --- Nova reserva -------------------------------------------
     Este é o único ponto do módulo que assume não estar pronto, e
     diz o motivo exato. Criar reserva do zero exige o formulário
     de veículo, período, proteção e adicionais — a mesma tela que
     o site público já tem, e que é a próxima entrega do módulo. */
  /* `?veiculo=v04` abre este mesmo aviso JÁ DIZENDO de qual carro
     se trata. A tela da frota manda para cá com esse parâmetro, e
     sem ele o operador que clicou "Nova reserva para este carro"
     cairia num texto genérico e não saberia se o clique pegou.
     O aviso continua sendo o mesmo: o formulário completo é a
     próxima tela do módulo. O que muda é que o carro escolhido
     não se perde no caminho. */
  var abrirNovaReserva = function (veiculoId) {
    var veiculo = veiculoId ? S.veiculo(veiculoId) : null;

    U.abrirModal({
      titulo: 'Nova reserva no balcão',
      sub: veiculo
        ? veiculo.modelo + ' · ' + veiculo.placa
        : 'Criar uma reserva do zero dentro do sistema',
      corpo:
        (veiculo
          ? '<div class="aviso aviso--neutro u-mb">' +
            '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
            '<span>Veículo escolhido: <b>' + esc(veiculo.modelo) + '</b> ' +
            '<span class="mono">' + esc(veiculo.placa) + '</span>.</span></div>'
          : '') +
        '<p class="u-sm u-t2">Hoje a reserva nasce no site público e cai aqui automaticamente — ' +
        'com veículo, período, proteção e adicionais que o cliente escolheu. Para criar uma ' +
        'reserva diretamente no balcão falta o formulário com essas quatro escolhas, que é a ' +
        'próxima tela deste módulo.</p>' +
        '<dl class="ficha u-mt">' +
        '<div><dt>Alternativa agora</dt><dd>Localizar o pedido do site na lista e completar o cadastro do cliente.</dd></div>' +
        '<div><dt>Reservas sem cadastro</dt><dd>' +
        S.estado.reservas.filter(function (r) { return !r.clienteId; }).length + ' aguardando vínculo de cliente</dd></div>' +
        '</dl>' +
        avisoApi('Gravar a reserva no banco de dados depende da integração do backend.'),
      botoes: [
        { rotulo: 'Fechar', tom: 'sil', acao: 'x' },
        { rotulo: 'Ver reservas sem cadastro', tom: 'pri', acao: 'ver-novas' }
      ],
      aoClicar: function (acao, bt, fechar) {
        fechar();
        if (acao === 'ver-novas') U.navegar('#/reservas?f=nova');
      }
    });
  };

  /* ==========================================================
     9 · DETALHE — MONTAGEM
     ========================================================== */
  var htmlDetalhe = function (r) {
    var v = veiculoDe(r);
    var nome = nomeDoCliente(r) || 'Cliente não informado';
    var p = D.preco(r);

    /* A barra do registro resume a reserva em uma linha: quem,
       qual carro, quando e quanto. É o que o operador precisa ter
       na frente enquanto fala ao telefone. */
    var resumo = '<b>' + esc(nome) + '</b> · ' +
                 esc(v ? v.modelo + ' · ' + v.placa : 'Veículo a definir') + ' · ' +
                 D.fmtData(r.de) + ' a ' + D.fmtData(r.ate) + ' · ' +
                 (p.incompleto ? '<span class="falta">valor a definir</span>' : '<b>' + D.fmtBRL(p.total) + '</b>');

    return '' +
      '<div class="reg">' +
      '  <a class="reg__voltar" href="#/reservas" data-acao="voltar">' +
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
      '    Todas as reservas' +
      '  </a>' +
      '  <div class="reg__id">' +
      '    <span class="reg__cod">' + esc(r.codigo) + '</span>' +
      '    ' + U.crachaReserva(r) +
      '    <span class="reg__quando">' + resumo + '</span>' +
      '  </div>' +
      '  <div class="reg__acoes">' +
      (podeMudarPeriodo(r)
        ? U.botao('Alterar período', 'alterar-periodo', 'out', { id: r.id })
        : '') +
      U.botao('Editar reserva', 'editar-reserva', 'out', { id: r.id }) +
      '  </div>' +
      '</div>' +

      '<div class="blocos">' +
        blocoCliente(r) +
        blocoVeiculo(r) +
        blocoPeriodo(r) +
        blocoEntrega(r) +
        blocoDevolucao(r) +
        blocoProtecao(r) +
        blocoAdicionais(r) +
        blocoFinanceiro(r) +
        blocoHistorico(r) +
        bloco('status', 'Ações da reserva', corpo(htmlAcoes(r)) +
          (S.acoesDaReserva(r).some(function (a) { return !a.liberada; })
            ? '<p class="u-xs u-t4 u-mb">As ações em cinza mostram o motivo: cada uma depende de um passo anterior.</p>'
            : ''), 'bloco--largo', 'o que fazer agora') +
      '</div>';
  };

  /* ==========================================================
     10 · LISTA — MONTAGEM
     ========================================================== */
  var htmlListaTela = function () {
    var filtro = filtroDe(params.f);
    var resumo = D.resumoReservas();
    var abertas = resumo.nova + resumo.aguardando + resumo.confirmada + resumo.contrato + resumo.pronta;

    return U.pageHead(
      'Reservas',
      'Do pedido recebido no site até a retirada do veículo. ' +
      '<b>' + abertas + '</b> ' + (abertas === 1 ? 'reserva em andamento' : 'reservas em andamento') +
      ' · <b>' + resumo.andamento + '</b> em locação · <b>' + resumo.finalizada + '</b> finalizadas.',
      U.botao('Nova reserva', 'nova-reserva', 'pri')
    ) + htmlLista(filtro, filtrar(filtro));
  };

  /* ==========================================================
     11 · AÇÕES DO DETALHE
     ========================================================== */
  var executar = function (qual, r) {
    switch (qual) {
      case 'confirmar': {
        var res = S.confirmarReserva(r.id);
        U.resultado(res);
        if (res.ok) U.desenhar();
        return;
      }

      case 'gerar-contrato': {
        var k = S.criarContrato(r.id);
        if (k.ok === false) { U.canto(k.mensagem, 'erro'); return; }
        U.resultado(k);
        U.desenhar();
        /* O contrato nasceu noutro módulo. Redesenhar esta tela
           mostra a reserva já em "Contrato pendente", mas não
           responde a pergunta seguinte do operador — que é ver o
           documento. Antes isto era um aviso dizendo "esta ação
           entra na próxima tela do módulo", o que era falso: a
           tela já existe, e o contrato CT-000N estava a um clique
           de distância. Agora o aviso traz o endereço. */
        U.canto('Contrato ' + k.contrato.codigo + ' gerado. Abra CONTRATOS › ' +
                k.contrato.codigo + ' para conferir a prévia antes de enviar ao cliente.', 'ok');
        return;
      }

      case 'enviar-contrato': abrirEnviarContrato(r); return;
      case 'registrar-pagamento': abrirPagamento(r); return;
      case 'iniciar-locacao': abrirIniciarLocacao(r); return;
      case 'vistoria-saida': abrirVistoria(r, 'saida'); return;
      case 'vistoria-devolucao': abrirVistoria(r, 'devolucao'); return;
      case 'finalizar': abrirFinalizar(r); return;
      case 'cancelar': abrirCancelamento(r); return;
    }

    /* Nenhuma ação do pedido chega aqui. As duas que abrem a
       próxima tela do sistema dizem isso em vez de ficarem mudas. */
    if (qual === 'editar') {
      abrirEdicao(r);
      return;
    }

    U.canto('Esta ação entra na próxima tela deste módulo.', 'aviso');
  };

  /* ----------------------------------------------------------
     O PERÍODO TEM DONO PRÓPRIO

     Enquanto a locação não começou, o dono pode mudar quando o
     carro sai e quando volta — e mudar isso é uma decisão com
     consequência: mexe no preço, na agenda do veículo e no que o
     cliente contratou. Não é a mesma coisa que corrigir o horário
     ou o endereço de entrega, que é ajuste de balcão e não muda o
     que foi combinado.

     Por isso o período saiu do formulário geral e ganhou um
     formulário só dele, com período atual, período novo, o que
     isso faz com o valor e, quando há choque de agenda, QUAL
     compromisso está no caminho. Um "não" sem explicação faz o
     operador tentar de novo achando que errou o clique.
     ---------------------------------------------------------- */

  /* Se existe uma locação para esta reserva, o carro já saiu. É
     essa a pergunta — não o rótulo do status, que continua
     "andamento" também para reservas que ainda não saíram. */
  var jaSaiu = function (r) {
    return S.estado.locacoes.some(function (l) { return l.reserva === r.id; });
  };

  var podeMudarPeriodo = function (r) {
    return !!r && !jaSaiu(r) && r.status !== 'finalizada' && r.status !== 'cancelada';
  };

  var HORAS_SUGERIDAS = ['08:00', '09:00', '10:00', '12:00', '14:00', '18:00'];

  var abrirPeriodo = function (r) {
    var v = veiculoDe(r);
    var antes = { de: r.de, ate: r.ate, retiradaHora: r.retiradaHora, devolucaoHora: r.devolucaoHora };

    U.abrirModal({
      titulo: 'Alterar período · ' + r.codigo,
      sub: (v ? v.modelo + ' · ' + v.placa : 'Veículo a definir') +
           ' — a locação ainda não foi iniciada',
      largo: true,
      corpo:
        '<div class="grid2">' +
          '<div class="pcard">' +
            '<p class="pcard__t">Período atual</p>' +
            ficha([
              ['Retirada', D.fmtData(antes.de) + ' <span class="u-t4 u-xs">· ' + esc(antes.retiradaHora || 'sem hora') + '</span>'],
              ['Devolução', D.fmtData(antes.ate) + ' <span class="u-t4 u-xs">· ' + esc(antes.devolucaoHora || 'sem hora') + '</span>'],
              ['Duração', (r.dias === 1 ? '1 diária' : r.dias + ' diárias')]
            ]) +
          '</div>' +
          '<div class="pcard pcard--novo">' +
            '<p class="pcard__t">Novo período</p>' +
            '<div class="pcard__g">' +
              fld('Nova retirada', 'date', 'de', r.de, '', true) +
              fld('Hora da retirada', 'time', 'retiradaHora', r.retiradaHora) +
            '</div>' +
            '<div class="pcard__g u-mt">' +
              fld('Nova devolução', 'date', 'ate', r.ate, '', true) +
              fld('Hora da devolução', 'time', 'devolucaoHora', r.devolucaoHora) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pcalc" data-calc="1"></div>' +
        '<div class="pconf" data-conf="1"></div>' +
        '<p class="u-xs u-t4 u-mt">O veículo, a proteção e os adicionais já contratados não mudam por aqui. ' +
        'O período só pode ser alterado enquanto a locação não foi iniciada.</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Confirmar alteração', tom: 'pri', acao: 'confirmar' }
      ],
      /* A prévia acompanha a digitação. O operador precisa ver o
         efeito no valor ANTES de confirmar, e não descobrir depois
         que a alteração mexeu no preço — sobretudo quando o novo
         período cruza uma faixa de desconto e o total muda por
         motivo que não é óbvio. */
      aoAbrir: function (bd, fechar) {
        var atualizar = function () {
          var c = U.lerCampos(bd);
          atualizarCalculo(r, {
            de: c.de || r.de,
            ate: c.ate || r.ate,
            retiradaHora: c.retiradaHora || r.retiradaHora,
            devolucaoHora: c.devolucaoHora || r.devolucaoHora
          });
        };
        bd.addEventListener('input', atualizar);
        bd.addEventListener('change', atualizar);
        atualizar();
      },
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'confirmar') { fechar(); return; }

        var c = lerCampos();
        var novo = {
          de: c.de, ate: c.ate,
          retiradaHora: c.retiradaHora || r.retiradaHora,
          devolucaoHora: c.devolucaoHora || r.devolucaoHora
        };

        /* Quem decide se pode é a sessão, e ela é a única que
           grava. A tela não repete a regra de conflito: repetir
           seria a garantia de que um dia as duas discordam. */
        var res = S.mudarPeriodoDaReserva(r.id, novo);

        if (res.ok === false) {
          if (res.conflito) {
            /* O conflito NÃO fecha o diálogo. Fechar obrigaria o
               operador a reabrir e digitar tudo de novo só para
               ler com calma qual reserva está no caminho. */
            mostrarConflito(res.motivos || [], novo);
            U.canto(res.mensagem, 'erro');
            return;
          }
          U.canto(res.mensagem, 'erro');
          return;
        }

        fechar();
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  /* A prévia roda sobre uma CÓPIA da reserva com o período novo.
     É a mesma `D.preco` que o site usa para cobrar — nunca uma
     conta paralela. Se o novo período cruza uma faixa de desconto,
     só esta função sabe disso: "dias × diária" erraria o total
     para mais, que é o erro que o cliente reclama depois.

     Quando não dá para calcular com segurança, diz "a confirmar"
     em vez de arriscar um número. */
  var atualizarCalculo = function (r, novo) {
    var caixa = document.querySelector('[data-calc="1"]');
    if (!caixa) return;

    var linhas = [];
    var dias = D.diffDias(novo.de, novo.ate);
    var antes = { de: r.de, ate: r.ate, retiradaHora: r.retiradaHora, devolucaoHora: r.devolucaoHora };

    linhas.push(['Período',
      D.fmtData(antes.de) + ' → ' + D.fmtData(antes.ate) +
      ' <span class="calc__seta">para</span> ' +
      '<b>' + D.fmtData(novo.de) + ' → ' + D.fmtData(novo.ate) + '</b>']);

    if (dias <= 0) {
      linhas.push(['Duração', '<span class="falta">A devolução precisa ser depois da retirada</span>']);
      caixa.innerHTML = resumoCalculo(
        'O novo período ainda não está válido — confira as datas.', linhas, 'warn');
      return;
    }

    var simulado = {};
    Object.keys(r).forEach(function (k) { simulado[k] = r[k]; });
    simulado.dias = dias;

    var hoje = D.preco(r);
    var depois = D.preco(simulado);

    linhas.push(['Duração', (r.dias === 1 ? '1 diária' : r.dias + ' diárias') +
      ' <span class="calc__seta">para</span> <b>' +
      (dias === 1 ? '1 diária' : dias + ' diárias') + '</b>']);

    if (hoje.diaria === null || depois.diaria === null) {
      linhas.push(['Diária', '<span class="falta">Sob consulta</span>']);
      linhas.push(['Total', '<span class="falta">A confirmar</span>']);
      caixa.innerHTML = resumoCalculo(
        'A diária deste veículo ainda não está configurada no site. O valor segue "a confirmar" ' +
        'até a tabela ser definida.', linhas, 'warn');
      return;
    }

    linhas.push(['Diária', D.fmtBRL(depois.diaria) + (depois.pct > 0
      ? ' <span class="u-t4 u-xs">· ' + depois.pct + '% de desconto por faixa</span>'
      : ' <span class="u-t4 u-xs">· sem desconto por faixa</span>')]);

    linhas.push(['Total', (hoje.incompleto || depois.incompleto)
      ? '<span class="falta">A confirmar</span>'
      : D.fmtBRL(hoje.total) + ' <span class="calc__seta">para</span> <b>' +
        D.fmtBRL(depois.total) + '</b>']);

    if (!hoje.incompleto && !depois.incompleto) {
      var dif = Math.round((depois.total - hoje.total) * 100) / 100;
      linhas.push(['Diferença', dif === 0
        ? 'Sem alteração de valor'
        : (dif > 0
            ? '<b class="calc--mais">+' + D.fmtBRL(dif) + '</b>'
            : '<b class="calc--menos">−' + D.fmtBRL(Math.abs(dif)) + '</b>')]);
    }

    var aviso = null;
    if (dias < Number(r.dias)) {
      aviso = 'O novo período é MENOR que o contratado. A redução é registrada como cortesia ' +
              'combinada com o cliente: o sistema não estorna sozinho, e o motivo fica no histórico.';
    }

    caixa.innerHTML = resumoCalculo(aviso, linhas, aviso ? 'warn' : 'ok');
  };

  var resumoCalculo = function (aviso, linhas, tom) {
    return '<p class="pcalc__t">O que muda</p>' +
      ficha(linhas) +
      (aviso ? '<p class="pcalc__aviso pcalc__aviso--' + tom + '">' + esc(aviso) + '</p>' : '');
  };

  /* Os conflitos vêm com tipo e código: reserva, locação em
     andamento, manutenção ou veículo fora de circulação. A lista
     diz QUAL compromisso está no caminho, porque "não pode" sem o
     nome do outro compromisso não permite decisão nenhuma. */
  var mostrarConflito = function (motivos, novo) {
    var caixa = document.querySelector('[data-conf="1"]');
    if (!caixa) return;

    var html = '<div class="pconf__cx">' +
      '<p class="pconf__t">Este veículo possui conflito de agenda no novo período.</p>' +
      '<p class="pconf__s">' + D.fmtData(novo.de) + ' → ' + D.fmtData(novo.ate) +
      '. Nada foi alterado.</p>' +
      '<ul class="pconf__l">';

    motivos.forEach(function (m) {
      html += '<li class="pconf__i">' +
        U.etiqueta(ROTULO_MOTIVO[m.tipo] || m.tipo, m.tipo === 'reserva' ? 'warn' : 'bad') +
        '<span class="pconf__n">' + esc(m.rotulo) + '</span></li>';
    });

    html += '</ul>' +
      (motivos.some(function (m) { return m.tipo === 'reserva' || m.tipo === 'locacao'; })
        ? '<p class="pconf__s">Não altere a reserva da outra pessoa. Escolha outro período, ' +
          'ou combine a troca de veículo com o cliente.</p>'
        : '') +
      '</div>';

    caixa.innerHTML = html;
  };

  var ROTULO_MOTIVO = {
    reserva: 'Reserva', locacao: 'Locação', manutencao: 'Manutenção', frota: 'Frota'
  };

  /* Edição dos campos que a operação precisa corrigir no balcão:
     horários, formas de recebimento e endereços de entrega. O que
     NÃO se edita aqui e por quê: veículo (trocar de carro é outra
     operação, com contrato e disponibilidade envolvidos), valores
     (vêm da tabela do site), proteção já contratada — e o PERÍODO,
     que passou a ter formulário próprio, com checagem de agenda e
     prévia de valor, porque mudar datas é mudar o que o cliente
     contratou. */
  var abrirEdicao = function (r) {
    var v = veiculoDe(r);

    U.abrirModal({
      titulo: 'Editar reserva ' + r.codigo,
      sub: 'Horários, formas de retirada e devolução',
      largo: true,
      corpo:
        '<div class="grid2">' +
        fldSel('Forma de recebimento', 'retiradaModo', [
          { valor: 'locadora', rotulo: 'Retirar na locadora' },
          { valor: 'entrega', rotulo: 'Levamos até você' }
        ], r.retiradaModo) +
        fld('Hora da retirada', 'time', 'retiradaHora', r.retiradaHora) +
        '</div>' +
        '<div class="grid2 u-mt">' +
        fldSel('Forma de devolução', 'devolucaoModo', [
          { valor: 'locadora', rotulo: 'Devolver na locadora' },
          { valor: 'endereco', rotulo: 'Buscamos no endereço' }
        ], r.devolucaoModo) +
        fld('Hora da devolução', 'time', 'devolucaoHora', r.devolucaoHora) +
        '</div>' +
        '<p class="fld__lbl u-mt-lg">Endereço de entrega</p>' +
        '<div class="grid2">' +
        fld('Logradouro', 'text', 'logradouro', r.retiradaEndereco ? r.retiradaEndereco.logradouro : '', 'Rua, avenida') +
        fld('Número', 'text', 'numeroEnd', r.retiradaEndereco ? r.retiradaEndereco.numero : '') +
        '</div>' +
        '<div class="grid3 u-mt">' +
        fld('Bairro', 'text', 'bairro', r.retiradaEndereco ? r.retiradaEndereco.bairro : '') +
        fld('Cidade', 'text', 'cidade', r.retiradaEndereco ? r.retiradaEndereco.cidade : '') +
        fld('UF', 'text', 'uf', r.retiradaEndereco ? r.retiradaEndereco.uf : '') +
        '</div>' +
        fld('Observação', 'text', 'obs', r.obs, 'O que a operação precisa saber') +
        '<p class="u-xs u-t4 u-mt">Veículo, diária e proteção não mudam por aqui: a diária vem da ' +
        'tabela do site e a troca de veículo passa por contrato e disponibilidade.</p>' +
        (v ? '' : '<p class="falta u-mt">Esta reserva ainda não tem veículo definido.</p>'),
      botoes: [
        { rotulo: 'Cancelar', tom: 'sil', acao: 'x' },
        { rotulo: 'Salvar alterações', tom: 'pri', acao: 'salvar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'salvar') { fechar(); return; }

        var c = lerCampos();
        if (!c.de || !c.ate) { U.canto('Informe as datas de retirada e devolução.', 'erro'); return; }

        var dias = D.diffDias(c.de, c.ate);
        if (dias <= 0) {
          U.canto('A devolução precisa ser depois da retirada.', 'erro');
          return;
        }
        if (dias !== Number(r.dias)) {
          /* Mudar o período muda o preço (desconto por faixa). O
             sistema não recalcula em silêncio: a reserva do site
             foi aceita com aquele número, e reajustar o valor
             sozinho seria alterar o que o cliente contratou. */
          U.canto('A duração passou de ' + r.dias + ' para ' + dias + ' dias — o valor teria de ser ' +
                  'refeito com o cliente. Ajuste pelo balcão e registre uma reserva nova.', 'erro');
          return;
        }

        r.de = c.de;
        r.ate = c.ate;
        r.retiradaHora = c.retiradaHora || r.retiradaHora;
        r.devolucaoHora = c.devolucaoHora || r.devolucaoHora;
        r.retiradaModo = c.retiradaModo || r.retiradaModo;
        r.devolucaoModo = c.devolucaoModo || r.devolucaoModo;
        r.obs = c.obs || '';

        var temEndereco = c.logradouro || c.bairro || c.cidade;
        if (temEndereco) {
          r.retiradaEndereco = {
            cep: (r.retiradaEndereco && r.retiradaEndereco.cep) || '',
            logradouro: c.logradouro || '',
            numero: c.numeroEnd || '',
            complemento: (r.retiradaEndereco && r.retiradaEndereco.complemento) || '',
            bairro: c.bairro || '',
            cidade: c.cidade || '',
            uf: c.uf || ''
          };
        }

        fechar();
        S.avisar('reservas');
        U.canto('Reserva ' + r.codigo + ' atualizada.', 'ok');
        U.desenhar();
      }
    });
  };

  /* ==========================================================
     12 · DESENHO
     ----------------------------------------------------------
     A ORDEM AQUI É O QUE FAZ O MÓDULO FUNCIONAR.

     Primeiro a tela é escrita no container. SÓ DEPOIS as ações
     são ligadas — e ligadas por delegação, num ouvinte preso ao
     container onde os botões já estão.

     A tentação é fazer o contrário: criar uma caixa, pendurar o
     ouvinte nela e desenhar dentro. Não funciona. O primeiro
     `innerHTML` apaga os filhos da caixa, e a caixa continua
     viva no documento mas com o ouvinte falando com ninguém.
     Um clique então não faz nada — ou pior, sobe até o ouvinte
     de outra tela e executa a ação errada.

     E é por isso que o container é criado por este módulo em vez
     de ser o `#pgInner` da casca: o roteador troca o container a
     cada desenho (ver `ui.desenhar`), então o ouvinte abaixo
     morre junto com a tela e não há como dois módulos atenderem
     o mesmo clique.
     ========================================================== */
  var caixa = document.createElement('div');
  caixa.setAttribute('data-tela', 'reservas');

  var acharReserva = function (id) {
    return S.reserva(id) || S.estado.reservas.filter(function (x) { return x.codigo === id; })[0] || null;
  };

  /* --- Desenho -------------------------------------------------- */
  var htmlTela = function () {
    if (ALVO) {
      var r = acharReserva(ALVO);

      if (!r) {
        /* Endereço com um código que não existe (link antigo,
           erro de digitação) não pode cair em tela branca nem na
           lista sem explicação. */
        return U.pageHead('Reserva não encontrada',
          'Nenhuma reserva corresponde ao endereço <code class="mono">#/reservas/' +
          esc(ALVO) + '</code>.') +
          U.vazio('Não encontramos esta reserva',
            'Ela pode ter sido restaurada para o estado inicial da demonstração. ' +
            'A lista abaixo mostra todas as reservas do sistema.',
            U.botao('Ver todas as reservas', 'voltar', 'pri'));
      }

      return htmlDetalhe(r);
    }

    return htmlListaTela();
  };

  /* --- Busca ao vivo -------------------------------------------
     Redesenhar a tela inteira a cada tecla trocaria o campo por
     um novo e o cursor cairia fora. Então a digitação só refaz a
     tabela e o contador; o campo continua sendo o mesmo. */
  var refazerBusca = function () {
    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);

    var slot = caixa.querySelector('[data-slot="lista"]');
    var contador = caixa.querySelector('[data-slot="n"]');
    if (slot) slot.innerHTML = htmlTabela(lista);
    if (contador) contador.textContent = lista.length;

    var botaoLimpar = caixa.querySelector('[data-acao="limpar"]');
    if (!botaoLimpar && BUSCA) {
      var dir = caixa.querySelector('.filtros__dir');
      if (dir) {
        var novo = document.createElement('button');
        novo.className = 'ab';
        novo.setAttribute('type', 'button');
        novo.setAttribute('data-acao', 'limpar');
        novo.textContent = 'Limpar';
        dir.appendChild(novo);
      }
    }
    if (botaoLimpar && !BUSCA && botaoLimpar.parentNode) {
      botaoLimpar.parentNode.removeChild(botaoLimpar);
    }
  };

  /* ==========================================================
     13 · AÇÕES — UM OUVINTE SÓ, POR DELEGAÇÃO
     ----------------------------------------------------------
     Um ouvinte no container atende todos os botões da tela,
     inclusive os que ainda não existem quando ele foi preso.
     É o que permite ligar as ações ANTES de haver botão nenhum
     no documento — e é o que mantém o módulo funcionando quando
     a tabela é refeita pela busca.
     ========================================================== */
  caixa.addEventListener('input', function (ev) {
    var campo = ev.target;
    if (!campo || !campo.getAttribute || campo.getAttribute('data-busca') !== '1') return;
    BUSCA = campo.value || '';
    refazerBusca();
  });

  caixa.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-acao]') : null;

    /* Sem `data-acao` no caminho há dois casos: um link direto
       (item de pendência, atalho para o cliente ou para a
       locação) e um clique no meio da linha da tabela, que abre
       o registro.

       O `preventDefault` fica DENTRO de cada caso, e não solto no
       topo do ouvinte. Solto, ele cancelava também o link sem
       `data-acao` — e o item de pendência, que é um
       `<a href="#/...">`, deixava de navegar. Como o ouvinte não
       chamava `navegar()` para ele, o clique simplesmente não
       fazia nada. */
    if (!alvo) {
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (link) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar(link.getAttribute('href'));
        return;
      }

      var linha = ev.target.closest ? ev.target.closest('tr[data-abre]') : null;
      if (linha) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar('#/reservas/' + linha.getAttribute('data-abre'));
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');
    var alvoReserva = id ? acharReserva(id) : null;

    var semEfeito = function () {
      U.canto('Esta ação entra na próxima tela deste módulo.', 'aviso');
    };

    /* Desabilitado não executa — mas DIZ por quê. Um botão cinza
       que não responde ao clique é a definição de botão morto. */
    if (alvo.getAttribute('aria-disabled') === 'true') {
      U.canto(alvo.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'filtrar': {
        var f = alvo.getAttribute('data-f');
        /* Trocar de aba limpa o recorte por veículo. Manter os
           dois seria mostrar "Todas" com a lista de um carro só:
           um filtro escondido por trás de outro, que é a forma
           mais rápida de fazer o operador achar que faltam
           reservas na base. */
        U.navegar('#/reservas' + (!f || f === 'todas' ? '' : '?f=' + f));
        return;
      }

      case 'limpar-veiculo':
        U.navegar('#/reservas' + (params.f ? '?f=' + params.f : ''));
        return;

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'voltar':
        U.navegar('#/reservas');
        return;

      case 'ver':
      case 'abrir':
        if (alvoReserva) U.navegar('#/reservas/' + alvoReserva.id);
        else semEfeito();
        return;

      case 'editar-reserva':
      case 'editar-reserva-topo':
        if (alvoReserva) abrirEdicao(alvoReserva);
        else semEfeito();
        return;

      case 'alterar-periodo':
        /* O botão só é desenhado quando a locação não começou, mas
           a checagem se repete aqui: a tela pode ter sido desenhada
           antes de outra pessoa iniciar a locação noutra aba. */
        if (!alvoReserva) { semEfeito(); return; }
        if (!podeMudarPeriodo(alvoReserva)) {
          U.canto('A locação já foi iniciada — o período não pode mais ser alterado. ' +
                  'Para esticar a devolução, use a prorrogação.', 'aviso');
          return;
        }
        abrirPeriodo(alvoReserva);
        return;

      case 'vincular-cliente':
        if (alvoReserva) abrirVincularCliente(alvoReserva);
        else semEfeito();
        return;

      case 'nova-reserva':
        abrirNovaReserva(alvo.getAttribute('data-veiculo'));
        return;

      case 'ir-cliente':
        U.navegar('#/clientes/' + id);
        return;

      case 'ir-veiculo':
        U.navegar('#/frota/' + id);
        return;

      case 'ir-contrato':
        U.navegar('#/contratos/' + id);
        return;

      case 'ir-locacao':
        U.navegar('#/locacoes/' + id);
        return;

      case 'copiar-endereco':
        /* Copiar de verdade usa a área de transferência do
           navegador, que exige permissão e não existe em toda
           origem. O endereço está à vista no bloco, então o aviso
           entrega o que o botão prometeu. */
        var texto = alvo.getAttribute('data-texto') || '';
        U.canto(texto ? 'Endereço: ' + texto : 'Endereço ainda não informado.',
                texto ? 'ok' : 'aviso');
        return;
    }

    /* Ações contextuais (§7) — as nove do pedido. */
    if (acao === 'reserva-acao') {
      if (!alvoReserva) { semEfeito(); return; }

      var qual = alvo.getAttribute('data-qual');
      var pode = podeFazer(alvoReserva, qual);
      if (pode && !pode.liberada) {
        U.canto(pode.motivo || 'Esta ação não está disponível agora.', 'aviso');
        return;
      }

      executar(qual, alvoReserva);
      return;
    }

    /* Ações de linha da tabela — as mesmas quatro do detalhe. */
    if (ACAO_LINHA[acao]) {
      if (!alvoReserva) { semEfeito(); return; }
      var p = podeFazer(alvoReserva, acao);
      if (p && !p.liberada) {
        U.canto(p.motivo || 'Esta ação não está disponível agora.', 'aviso');
        return;
      }
      executar(acao, alvoReserva);
      return;
    }

    semEfeito();
  });

  /* ==========================================================
     14 · MONTAGEM: DESENHAR E DEPOIS LIGAR
     ========================================================== */
  caixa.className = 'pg__tela-conteudo';
  caixa.innerHTML = htmlTela();
  cx.appendChild(caixa);

  /* Uma ação pedida por outra tela chega pelo endereço
     (`?fazer=nova&veiculo=v04`, ver `frota.js`).

     Depois de abrir o diálogo, o parâmetro é retirado do
     endereço com `replaceState` — que troca a entrada do
     histórico em vez de acrescentar. Sem isso, fechar o diálogo
     deixaria `?fazer=nova` na barra: bastaria recarregar a
     página para o aviso reabrir sozinho, e o operador não teria
     como sair dele. */
  if (params.fazer === 'nova' && !ALVO) {
    abrirNovaReserva(params.veiculo);

    try {
      var limpo = '#/reservas' +
        (params.f ? '?f=' + params.f : (params.veiculo ? '?veiculo=' + params.veiculo : ''));
      window.history.replaceState(null, '', limpo);
    } catch (e) { /* histórico indisponível: o aviso abriu, que é o que importa */ }
  }
};
