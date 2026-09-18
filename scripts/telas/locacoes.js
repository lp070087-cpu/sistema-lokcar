/* ============================================================
   LOK CAR — SISTEMA · telas/locacoes.js
   ------------------------------------------------------------
   §9 do pedido. O pedido insiste numa distinção, e ela governa
   esta tela inteira:

     "Reserva: intenção/agendamento.
      Locação: contrato efetivamente iniciado."

   Por isso a locação NÃO é a reserva com outro nome, e esta tela
   não é a de reservas filtrada. Uma reserva existe porque
   alguém pretende alugar; uma locação existe porque o carro
   saiu do pátio e tem hora de saída, quilometragem de saída e
   combustível de saída registrados. São coisas que só passam a
   existir no minuto da retirada — e é justamente por isso que
   o que interessa aqui é outro conjunto de números.

   CONSEQUÊNCIAS PRÁTICAS DESSA SEPARAÇÃO
   ------------------------------------------------------------
   · O status da locação é DERIVADO do relógio, não digitado
     (`D.statusDaLocacao`). "Devolução hoje" e "Atrasada" não são
     etiquetas que alguém cola: são o resultado de comparar a
     data prevista com hoje. Se ninguém abrir o sistema por três
     dias, a locação que venceu continua aparecendo como atrasada
     quando alguém abrir — porque ninguém teve de lembrar de
     marcá-la.
   · UMA LOCAÇÃO PODE NÃO TER RESERVA. A `l05` da base nasceu
     direto no balcão. É caso real — cliente que aparece sem
     agendar — e a tela diz isso em vez de mostrar um traço
     solto onde deveria haver um código de reserva.
   · O DINHEIRO NÃO SE CALCULA AQUI. O valor vem de `D.preco()`
     sobre a reserva de origem, que é a mesma conta do site. Sem
     reserva, não há tabela de onde tirar o preço — e a tela
     escreve "sem tabela de origem" em vez de inventar um número.
     Uma locação sem origem é uma tabela a combinar no balcão.
   · FINALIZAR SÓ DEPOIS DA VISTORIA DE DEVOLUÇÃO. Quem impede
     é `S.finalizarLocacao`, não a interface: a regra de negócio
     mora numa função só. A tela desabilita o botão e DIZ o
     motivo, e o clique continua sendo recusado se a regra for
     contornada.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.locacoes = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var ALVO = ctx && ctx.alvo ? String(ctx.alvo) : null;

  var esc = U.esc;
  var AVISO_API = 'Disponível após integração do backend.';

  /* ==========================================================
     1 · FAIXAS DE TEMPO
     ----------------------------------------------------------
     Cada locação é uma linha do tempo. Estas três perguntas —
     já saiu? está fora? já era para ter voltado? — decidem quase
     tudo nesta tela, e ficam escritas uma vez só para não haver
     duas versões da mesma resposta.
     ========================================================== */
  var saiu = function (l) {
    return D.diffDias(D.HOJE_ISO, l.inicio) <= 0;
  };

  var fechada = function (l) {
    return D.statusDaLocacao(l) === 'finalizada';
  };

  var emCurso = function (l) {
    return !fechada(l) && saiu(l);
  };

  var atrasoDe = function (l) { return D.atrasoDaLocacao(l); };

  var diasDe = function (l) {
    return l.fimPrevisto ? Math.abs(D.diffDias(l.inicio, l.fimPrevisto)) : null;
  };

  /* Quilometragem rodada. `null` enquanto a locação não fechou —
     e a tela escreve "em curso", porque a diferença entre a
     leitura de saída e uma leitura que ainda não existe não é
     zero. */
  var kmRodada = function (l) {
    if (l.kmSaida === null || l.kmSaida === undefined) return null;
    if (l.kmEntrada === null || l.kmEntrada === undefined) return null;
    return l.kmEntrada - l.kmSaida;
  };

  /* O combustível que voltou, comparado ao que saiu. Só interessa
     quando há diferença: mesma leitura é o esperado e não merece
     uma linha na ficha. */
  var nivelMaisBaixo = function (a, b) {
    var i = D.NIVEIS_COMBUSTIVEL.indexOf(a);
    var j = D.NIVEIS_COMBUSTIVEL.indexOf(b);
    if (i === -1 || j === -1) return null;
    if (j === i) return null;
    return j < i;
  };

  /* ==========================================================
     2 · LISTA
     ========================================================== */
  var ABAS = [
    { id: 'todas',     rotulo: 'Todas',             teste: null },
    { id: 'aguardando', rotulo: 'Aguardando retirada', teste: function (l) { return D.statusDaLocacao(l) === 'aguardando'; } },
    { id: 'andamento', rotulo: 'Em andamento',      teste: function (l) { return D.statusDaLocacao(l) === 'andamento'; } },
    { id: 'hoje',      rotulo: 'Devolução hoje',    teste: function (l) { return D.statusDaLocacao(l) === 'devolucao'; } },
    { id: 'atrasada',  rotulo: 'Atrasadas',         teste: function (l) { return D.statusDaLocacao(l) === 'atrasada'; } },
    { id: 'finalizada', rotulo: 'Finalizadas',      teste: function (l) { return D.statusDaLocacao(l) === 'finalizada'; } }
  ];

  var acharAba = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return null;
  };

  var filtroDe = function (f) {
    return acharAba(f) || ABAS[0];
  };

  var BUSCA = params.q ? String(params.q) : '';

  var normalizar = function (v) {
    var t = String(v === null || v === undefined ? '' : v).toLowerCase();
    return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
  };

  var digitos = function (v) { return String(v || '').replace(/\D/g, ''); };

  var alvosDe = function (l) {
    var c = S.cliente(l.clienteId);
    var v = S.veiculo(l.veiculoId);
    var r = l.reserva ? S.reserva(l.reserva) : null;
    return [l.codigo, l.obs,
            c ? c.nome : '', c ? c.doc : '', c ? c.telefone : '',
            v ? v.modelo : '', v ? v.placa : '',
            r ? r.codigo : ''].filter(Boolean);
  };

  var combinaBusca = function (l, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;

    var texto = alvosDe(l).map(normalizar).join(' ');
    var nums = alvosDe(l).map(digitos).filter(Boolean).join(' ');

    return termos.every(function (t) {
      if (/^[\d\s().-]+$/.test(t)) {
        var d = digitos(t);
        return d ? nums.indexOf(d) !== -1 : true;
      }
      return texto.indexOf(t) !== -1;
    });
  };

  /* Padrão: o que exige decisão primeiro. Atrasada no topo — é
     dinheiro parado fora da locadora, e é o que o operador
     precisa ver antes de qualquer outra coisa. */
  var peso = { atrasada: 0, devolucao: 1, andamento: 2, aguardando: 3, finalizada: 4 };

  var ordenar = function (lista, como) {
    var l = lista.slice();
    if (como === 'cliente') {
      l.sort(function (a, b) {
        return U.nomeCliente(a.clienteId).localeCompare(U.nomeCliente(b.clienteId), 'pt-BR');
      });
    } else if (como === 'valor') {
      l.sort(function (a, b) { return valorDe(b) - valorDe(a); });
    } else {
      l.sort(function (a, b) {
        var pa = peso[D.statusDaLocacao(a)], pb = peso[D.statusDaLocacao(b)];
        if (pa !== pb) return pa - pb;
        return D.diffDias(a.fimPrevisto || a.inicio, b.fimPrevisto || b.inicio);
      });
    }
    return l;
  };

  /* O valor da locação vem sempre da reserva de origem. Sem
     reserva, devolve `null` — que é diferente de zero, e é
     escrito como "sem tabela" em toda a tela. */
  var valorDe = function (l) {
    var r = l.reserva ? S.reserva(l.reserva) : null;
    if (!r) return null;
    var p = D.preco(r);
    if (p.incompleto) return null;
    return p.total;
  };

  var filtrar = function (filtro) {
    return ordenar(D.LOCACOES.filter(function (l) {
      if (filtro.teste && !filtro.teste(l)) return false;
      return combinaBusca(l, BUSCA);
    }), params.o);
  };

  var contar = function (filtro) {
    return D.LOCACOES.filter(function (l) {
      return filtro.teste ? filtro.teste(l) : true;
    }).length;
  };

  /* ==========================================================
     3 · MONTAGEM DA LISTA
     ========================================================== */
  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist">' + ABAS.map(function (a) {
      return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" data-f="' + a.id + '"' +
             (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
             esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
    }).join('') + '</div>';
  };

  /* O medidor de atraso é um crachá com ícone, e o mesmo desenho
     serve para "volta hoje" — são as duas leituras de tempo que
     o balcão persegue. */
  var medidor = function (l) {
    var st = D.statusDaLocacao(l);

    if (st === 'atrasada') {
      var d = atrasoDe(l);
      return '<span class="atraso">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>' +
        d + (d === 1 ? ' dia' : ' dias') + ' de atraso</span>';
    }

    if (st === 'devolucao') return U.etiqueta('Volta hoje', 'warn');
    if (st === 'aguardando') return U.etiqueta('Ainda não saiu', 'go');
    return '';
  };

  var periodo = function (l) {
    var dias = diasDe(l);
    return '<span class="u-tab">' + D.fmtData(l.inicio) + ' → ' +
      (l.fimPrevisto ? D.fmtData(l.fimPrevisto) : '<span class="falta">sem previsão</span>') + '</span>' +
      '<span class="tbl__dim">' +
      (dias !== null ? dias + (dias === 1 ? ' diária' : ' diárias') : 'período não definido') +
      (fechada(l) && l.fimReal ? ' · devolvido em ' + D.fmtData(l.fimReal) : '') +
      '</span>';
  };

  /* Saída → entrada, com a diferença. Enquanto a locação está em
     curso, a segunda leitura ainda não existe: a coluna mostra a
     leitura de saída e diz que a entrada está pendente, em vez
     de mostrar um número que não foi medido. */
  var km = function (l) {
    if (l.kmSaida === null || l.kmSaida === undefined) {
      return '<span class="falta">leitura de saída não registrada</span>';
    }

    var saida = l.kmSaida.toLocaleString('pt-BR');

    if (l.kmEntrada === null || l.kmEntrada === undefined) {
      return '<span class="km"><span class="u-tab">' + saida + '</span>' +
        '<span class="km__seta">→</span>' +
        '<span class="falta">entrada pendente</span></span>';
    }

    var d = kmRodada(l);
    return '<span class="km">' +
      '<span class="u-tab">' + saida + '</span>' +
      '<span class="km__seta">→</span>' +
      '<span class="u-tab">' + l.kmEntrada.toLocaleString('pt-BR') + '</span>' +
      '<span class="km__dif">' + (d > 0 ? '+' : '') + d.toLocaleString('pt-BR') + ' km</span>' +
      '</span>';
  };

  var linhaTabela = function (l) {
    var c = S.cliente(l.clienteId);
    var v = S.veiculo(l.veiculoId);
    var valor = valorDe(l);
    var st = D.statusDaLocacao(l);
    var r = l.reserva ? S.reserva(l.reserva) : null;

    return '<tr data-abre="' + l.id + '"' + (st === 'atrasada' ? ' data-atraso="1"' : '') + '>' +
      '<td><span class="mono">' + esc(l.codigo) + '</span>' +
        (r
          ? '<span class="tbl__dim">reserva ' + esc(r.codigo) + '</span>'
          : '<span class="tbl__dim">direto no balcão</span>') +
      '</td>' +
      '<td>' + (c
        ? '<div class="cli">' +
            '<span class="cli__av' + (c.tipo === 'PJ' ? ' cli__av--pj' : '') + '">' + esc(iniciais(c)) + '</span>' +
            '<span class="cli__t"><b>' + esc(c.nome) + '</b><span>' + esc(c.telefone || c.email || '') + '</span></span>' +
          '</div>'
        : '<span class="falta">cliente não identificado</span>') + '</td>' +
      '<td>' + (v
        ? '<span class="u-b">' + esc(v.modelo) + '</span><span class="tbl__dim mono">' + esc(v.placa) + '</span>'
        : '<span class="falta">veículo não definido</span>') + '</td>' +
      '<td>' + periodo(l) + '</td>' +
      '<td>' + km(l) + '</td>' +
      '<td>' + U.dinheiro(valor, 'sem tabela de origem') + '</td>' +
      '<td>' + U.crachaLocacao(l) + (medidor(l) ? '<span class="u-mt">' + medidor(l) + '</span>' : '') + '</td>' +
      '<td><div class="tbl__acts">' +
        '<span class="ab ab--pri" data-acao="ver" data-id="' + l.id + '">Ver</span>' +
      '</div></td>' +
    '</tr>';
  };

  var iniciais = function (c) {
    return c.nome.trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  };

  var htmlTabela = function (lista) {
    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Locação</th><th>Cliente</th><th>Veículo</th><th>Período</th>' +
        '<th>Quilometragem</th><th>Valor</th><th>Situação</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(linhaTabela).join('') + '</tbody>' +
      '</table></div>';
  };

  var htmlVazio = function () {
    return U.vazio(
      BUSCA ? 'Nenhuma locação encontrada' : 'Nenhuma locação nesta situação',
      BUSCA
        ? 'Nenhuma locação casa com “' + BUSCA + '”. A busca olha código da locação, código da reserva, cliente, CPF/CNPJ, telefone, modelo e placa.'
        : 'Nenhuma locação está nesta situação agora. Locação é o contrato que já saiu do papel: ela nasce quando o carro é retirado, na tela da reserva.',
      BUSCA
        ? U.botao('Limpar busca', 'limpar', 'out')
        : U.botao('Ver as reservas', 'ir-reservas', 'out')
    );
  };

  var htmlLista = function (filtro, lista) {
    var emCursoAgora = D.LOCACOES.filter(emCurso).length;
    var atrasadas = D.LOCACOES.filter(function (l) { return D.statusDaLocacao(l) === 'atrasada'; }).length;

    return '<div class="filtros">' +
      '<div class="busca">' +
        '<svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input class="busca__inp" type="search" data-busca="1" value="' + esc(BUSCA) + '" ' +
        'placeholder="Código, cliente, CPF/CNPJ, telefone, modelo ou placa" />' +
      '</div>' +
      '<div class="filtros__dir">' +
        '<span class="filtros__n" data-slot="n">' +
          lista.length + (lista.length === 1 ? ' locação' : ' locações') +
          ' · ' + emCursoAgora + ' na rua' +
          (atrasadas ? ' · ' + atrasadas + ' atrasada(s)' : '') +
        '</span>' +
      '</div>' +
    '</div>' +
    '<div class="u-mb">' + htmlAbas(filtro) + '</div>' +
    '<div data-slot="lista">' + (lista.length ? htmlTabela(lista) : htmlVazio()) + '</div>';
  };

  /* ==========================================================
     4 · DETALHE
     ----------------------------------------------------------
     A ficha de uma locação responde a três perguntas, nesta
     ordem: o carro está fora? quanto tempo fica fora? quanto
     custa? Tudo o que não serve a essas três foi deixado de
     fora — uma ficha longa demais deixa de ser lida no balcão.
     ========================================================== */
  var ICO = {
    situacao:  'M4 12a8 8 0 1 0 3-6M4 4v4h4M12 8v4l3 2',
    origem:    'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    km:        'M5 17h14M6 17V9l3-2 3 2v8M16 17v-4l2-1 2 1v4M9 9V6',
    vistorias: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4',
    valores:   'M3 7h18v11H3zM3 11h18M7 15h3',
    cliente:   'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'
  };

  var bloco = function (id, titulo, conteudo, extraClasse, nota) {
    return '<section class="bloco' + (extraClasse ? ' ' + extraClasse : '') + '">' +
      '<div class="bloco__h">' +
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICO[id] || ICO.situacao) + '"/></svg>' +
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

  /* ---------------------------------------------------------
     BLOCO 1 · ONDE ESTÁ O CARRO AGORA
     ---------------------------------------------------------
     É a única coisa que o balcão pergunta ao telefone. Por isso
     ele vem primeiro e responde em uma frase.
     --------------------------------------------------------- */
  var blocoSituacao = function (l) {
    var st = D.statusDaLocacao(l);
    var atraso = atrasoDe(l);
    var r = l.reserva ? S.reserva(l.reserva) : null;
    var v = S.veiculo(l.veiculoId);

    var frase, caixaClass;

    if (st === 'finalizada') {
      frase = 'Devolvido em ' + D.fmtData(l.fimReal || l.fimPrevisto) +
        (l.horaEntrada ? ' às ' + esc(l.horaEntrada) : '') +
        '. O veículo ' + (v ? esc(v.modelo) : '') + ' voltou para a frota.';
      caixaClass = 'aviso--neutro';
    } else if (st === 'atrasada') {
      frase = 'A devolução estava prevista para ' + D.fmtData(l.fimPrevisto) + ' e não foi registrada. ' +
        'São ' + atraso + (atraso === 1 ? ' dia' : ' dias') + ' com o veículo fora — ' +
        'a diária adicional depende da política de atraso, que ainda não foi configurada.';
      caixaClass = '';
    } else if (st === 'devolucao') {
      frase = 'A devolução é HOJE. O veículo sai da rua quando a vistoria de devolução for registrada.';
      caixaClass = '';
    } else if (st === 'aguardando') {
      frase = 'A retirada está marcada para ' + D.fmtData(l.inicio) + ' e o veículo ainda está na locadora. ' +
        'A locação entra em andamento no momento da saída.';
      caixaClass = 'aviso--neutro';
    } else {
      frase = 'O veículo está com o cliente desde ' + D.fmtData(l.inicio) +
        (l.horaSaida ? ' (' + esc(l.horaSaida) + ')' : '') +
        '. Devolução prevista para ' + D.fmtData(l.fimPrevisto) + '.';
      caixaClass = 'aviso--neutro';
    }

    return bloco('situacao', 'Onde está o veículo', corpo(
      '<div class="aviso ' + caixaClass + '">' +
      '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/></svg>' +
      '<span>' + frase + '</span></div>' +
      (r
        ? '<p class="u-xs u-t4 u-mt">Esta locação veio da reserva <b>' + esc(r.codigo) + '</b>. ' +
          'A reserva é o agendamento; a locação é o contrato que começou a valer quando o carro saiu.</p>'
        : '<p class="u-xs u-t4 u-mt">Esta locação <b>não tem reserva de origem</b> — foi criada direto no balcão. ' +
          'Por isso não há tabela de preço para consultar: o valor foi combinado na hora e precisa ser ' +
          'lançado no financeiro como lançamento avulso.</p>')
    ), '', D.acharStatus(D.STATUS_LOCACAO, st).rotulo);
  };

  /* ---------------------------------------------------------
     BLOCO 2 · A ORIGEM
     --------------------------------------------------------- */
  var blocoOrigem = function (l) {
    var c = S.cliente(l.clienteId);
    var v = S.veiculo(l.veiculoId);
    var r = l.reserva ? S.reserva(l.reserva) : null;
    var k = r ? S.contratoDaReserva(r.id) : null;

    var linhas = [
      ['Código da locação', '<span class="mono">' + esc(l.codigo) + '</span>'],
      ['Reserva de origem', r
        ? '<a class="ab" href="#/reservas/' + r.id + '" data-acao="ir" data-para="#/reservas/' + r.id + '">' +
          esc(r.codigo) + '</a> ' + U.crachaReserva(r)
        : '<span class="falta">sem reserva — iniciada no balcão</span>'],
      ['Contrato', k
        ? '<a class="ab" href="#/contratos/' + k.id + '" data-acao="ir" data-para="#/contratos/' + k.id + '">' +
          esc(k.codigo) + '</a> ' + U.crachaContrato(k)
        : '<span class="falta">sem contrato vinculado</span>'],
      ['Cliente', c
        ? '<a class="ab" href="#/clientes/' + c.id + '" data-acao="ir" data-para="#/clientes/' + c.id + '">' +
          esc(c.nome) + '</a> ' + '<span class="tbl__dim mono">' + esc(c.doc) + '</span>'
        : '<span class="falta">cliente não identificado</span>'],
      /* O modelo já vem com a marca ("Porsche 911", "Hyundai
         HB20") — não existe campo `marca` no veículo. Concatenar
         um `marca` inexistente escrevia "undefined Porsche 911". */
      ['Veículo', v
        ? '<a class="ab" href="#/frota/' + v.id + '" data-acao="ir" data-para="#/frota/' + v.id + '">' +
          esc(v.modelo) + '</a> ' + '<span class="tbl__dim mono">' + esc(v.placa) + '</span>'
        : '<span class="falta">veículo não definido</span>']
    ];

    return bloco('origem', 'De onde veio', corpo(ficha(linhas)));
  };

  /* ---------------------------------------------------------
     BLOCO 3 · SAÍDA, ENTRADA E QUILOMETRAGEM
     ---------------------------------------------------------
     Leitura de saída e leitura de entrada são medições, não
     campos de texto. Quando uma delas não existe, isto é dito —
     nunca preenchido com zero, que seria uma medição falsa.
     --------------------------------------------------------- */
  var blocoKm = function (l) {
    var linhas = [
      ['Retirada', D.fmtData(l.inicio) + (l.horaSaida ? ' às <span class="u-tab">' + esc(l.horaSaida) + '</span>' : '')],
      ['Devolução prevista', l.fimPrevisto ? D.fmtData(l.fimPrevisto) : '<span class="falta">não informada</span>'],
      ['Devolução real', l.fimReal
        ? D.fmtData(l.fimReal) + (l.horaEntrada ? ' às <span class="u-tab">' + esc(l.horaEntrada) + '</span>' : '')
        : '<span class="falta">ainda não devolvido</span>'],
      ['Quilometragem de saída', l.kmSaida === null || l.kmSaida === undefined
        ? '<span class="falta">não registrada</span>'
        : '<span class="u-tab">' + l.kmSaida.toLocaleString('pt-BR') + ' km</span>'],
      ['Quilometragem de entrada', l.kmEntrada === null || l.kmEntrada === undefined
        ? '<span class="falta">não registrada — a locação ainda está em curso</span>'
        : '<span class="u-tab">' + l.kmEntrada.toLocaleString('pt-BR') + ' km</span>'],
      ['Distância rodada', kmRodada(l) === null
        ? '<span class="falta">a calcular na devolução</span>'
        : '<span class="km"><span class="u-tab">' + kmRodada(l).toLocaleString('pt-BR') + ' km</span>' +
          '<span class="km__dif">' +
          (D.regraValor('kmLivre') === null
            ? 'política de quilometragem não configurada'
            : 'comparar com o limite configurado') +
          '</span></span>'],
      ['Combustível na saída', U.ou(l.combustivelSaida, 'não registrado')],
      ['Combustível na devolução', l.combustivelEntrada
        ? esc(l.combustivelEntrada) + (nivelMaisBaixo(l.combustivelSaida, l.combustivelEntrada)
            ? ' ' + U.etiqueta('Voltou abaixo da saída', 'warn') : '')
        : '<span class="falta">não registrado — a locação ainda está em curso</span>']
    ];

    return bloco('km', 'Saída, devolução e quilometragem', corpo(
      ficha(linhas) +
      '<p class="u-xs u-t4 u-mt">A cobrança por quilometragem excedente, por nível de combustível abaixo do ' +
      'combinado e por diária de atraso depende das regras em CONFIGURAÇÕES → CONTRATOS, que ainda não têm ' +
      'valores definidos. O sistema mede a diferença; não converte a diferença em dinheiro por conta própria.</p>'
    ));
  };

  /* ---------------------------------------------------------
     BLOCO 4 · VISTORIAS
     --------------------------------------------------------- */
  var blocoVistorias = function (l) {
    var saida = S.vistoriasDaLocacao(l.id, 'saida')[0];
    var devolucao = S.vistoriasDaLocacao(l.id, 'devolucao')[0];

    var linha = function (titulo, v) {
      if (!v) {
        return '<tr><td>' + esc(titulo) + '</td>' +
          '<td>' + U.etiqueta('Não criada', 'idle') + '</td>' +
          '<td><span class="tbl__dim">nasce quando a locação começa</span></td>' +
          '<td></td></tr>';
      }
      var feitas = D.AREAS_VISTORIA.filter(function (a) {
        return v.areas && v.areas[a] && v.areas[a].observacao;
      }).length;

      return '<tr>' +
        '<td>' + esc(titulo) + '<span class="tbl__dim mono">' + esc(v.codigo) + '</span></td>' +
        '<td>' + U.crachaVistoria(v) + '</td>' +
        '<td><span class="tbl__dim">' + feitas + ' de ' + D.AREAS_VISTORIA.length +
          ' áreas com observação · ' +
          (v.km !== null && v.km !== undefined ? v.km.toLocaleString('pt-BR') + ' km' : 'sem leitura') +
          '</span></td>' +
        '<td><div class="tbl__acts">' +
          '<span class="ab" data-acao="vistoria" data-id="' + v.id + '">Ver</span>' +
        '</div></td>' +
      '</tr>';
    };

    var pendentes = S.vistoriasPendentes(l.id);

    return bloco('vistorias', 'Vistorias', corpo(
      '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr><th>Vistoria</th><th>Situação</th><th>Áreas</th><th></th></tr></thead>' +
      '<tbody>' +
        linha('Vistoria de saída', saida) +
        linha('Vistoria de devolução', devolucao) +
      '</tbody></table></div>' +
      '<p class="u-xs u-t4 u-mt">' +
      (pendentes.length
        ? 'A locação não pode ser finalizada enquanto a vistoria de devolução não estiver concluída. ' +
          'É `S.finalizarLocacao` que impede — não a interface.'
        : 'Saída e devolução registradas.') +
      ' Registrar fotos e observações área por área abre o módulo Vistorias.</p>'
    ), 'bloco--largo');
  };

  /* ---------------------------------------------------------
     BLOCO 5 · VALORES
     ---------------------------------------------------------
     Duas metades: o que o site já calculou (e que esta tela
     apenas mostra, sem refazer a conta) e o que só existe quando
     houver regra configurada.
     --------------------------------------------------------- */
  var blocoValores = function (l) {
    var r = l.reserva ? S.reserva(l.reserva) : null;

    if (!r) {
      return bloco('valores', 'Valores', corpo(
        '<p><span class="falta">Sem tabela de origem.</span></p>' +
        '<p class="u-sm u-t2 u-mt">Esta locação foi criada direto no balcão e não tem reserva de onde tirar preço. ' +
        'O sistema não estima: um valor estimado numa locação real viraria cobrança errada. ' +
        'O caminho correto é registrar o lançamento no financeiro com o valor combinado.</p>' +
        '<div class="u-mt-lg">' +
          U.botao('Ir para o financeiro', 'ir', 'out', { para: '#/financeiro' }) +
        '</div>'
      ), '', 'sem tabela');
    }

    var p = D.preco(r);

    var linhas = [
      ['Diária' + (p.faixa ? ' (' + esc(p.faixa) + ')' : ''), p.diaria === null
        ? '<span class="falta">modelo sem tabela de diária</span>'
        : D.fmtBRL(p.diaria) + ' × <span class="u-tab">' + p.dias + '</span>'],
      ['Diárias', p.semTabela
        ? '<span class="falta">a definir</span>'
        : '<span class="u-tab">' + D.fmtBRL(p.baseDiarias) + '</span>'],
      ['Desconto de período', p.pct
        ? '<span class="u-tab">−' + D.fmtBRL(p.desconto) + '</span> <span class="tbl__dim">' + p.pct + '% de desconto</span>'
        : '<span class="tbl__dim">abaixo da faixa de desconto</span>'],
      ['Proteção', p.protTotal > 0
        ? esc(p.protecaoNome) + ' · <span class="u-tab">' + D.fmtBRL(p.protTotal) + '</span>'
        : '<span class="falta">não contratada</span>']
    ];

    p.adicionais.forEach(function (a) {
      linhas.push(['Adicional — ' + a.nome, a.sobConsulta
        ? '<span class="falta">sob consulta</span>'
        : '<span class="u-tab">' + D.fmtBRL(a.soma) + '</span>']);
    });

    if (p.taxa) linhas.push(['Taxa de entrega', '<span class="u-tab">' + D.fmtBRL(p.taxa) + '</span>']);

    return bloco('valores', 'Valores', corpo(
      ficha(linhas) +
      '<div class="conta u-mt-lg">' +
        '<div class="conta__l conta__total"><span>Total da locação</span>' +
        '<b>' + (p.incompleto
          ? '<span class="falta">a definir</span>'
          : D.fmtBRL(p.total)) + '</b></div>' +
        (p.incompleto
          ? '<p class="conta__aviso">O total não é exibido porque há item sem valor na tabela. ' +
            'Mostrar uma soma parcial como se fosse o total seria pior do que não mostrar nada.</p>'
          : '') +
      '</div>' +
      '<p class="u-xs u-t4 u-mt">O cálculo é o MESMO do site: `D.preco()` sobre a reserva de origem. ' +
      'Não existe uma segunda aritmética só para o sistema — duas contas iguais acabam divergindo, ' +
      'e a divergência apareceria no valor que o cliente confere.</p>'
    ));
  };

  /* ---------------------------------------------------------
     BLOCO 6 · O QUE AINDA PESA NA LOCAÇÃO
     ---------------------------------------------------------
     Só aparece quando há algo. Uma locação finalizada e em dia
     não ganha uma lista vazia.
     --------------------------------------------------------- */
  var pendenciasDe = function (l) {
    var st = D.statusDaLocacao(l);
    var lista = [];

    if (st === 'atrasada') {
      lista.push({ tipo: 'devolucao', titulo: 'Devolução em atraso',
        apoio: ' ' + D.atrasoDaLocacao(l) + ' dia(s) além do previsto.', acao: 'finalizar' });
    } else if (st === 'devolucao') {
      lista.push({ tipo: 'devolucao', titulo: 'Devolução prevista para hoje',
        apoio: ' registrar a vistoria e fechar a locação.', acao: 'finalizar' });
    }

    S.vistoriasPendentes(l.id).forEach(function (v) {
      lista.push({ tipo: 'vistoria', titulo: 'Vistoria de devolução pendente',
        apoio: ' ' + v.codigo + ' — sem ela a locação não fecha.', acao: 'vistoria' });
    });

    if (!l.reserva) {
      lista.push({ tipo: 'documento', titulo: 'Sem reserva de origem',
        apoio: ' o valor precisa ser lançado no financeiro.', acao: 'financeiro' });
    }

    D.lancamentos(l.id).forEach(function (f) {
      if (D.statusDoLancamento(f) === 'pendente' || D.statusDoLancamento(f) === 'atrasado') {
        lista.push({ tipo: 'pagamento', titulo: 'Lançamento em aberto',
          apoio: ' ' + (f.descricao || 'sem descrição') + ' — ' + U.dinheiro(D.valorDoLancamento(f), 'a definir'),
          acao: 'financeiro' });
      }
    });

    return lista;
  };

  var blocoPendencias = function (l) {
    var pend = pendenciasDe(l);
    if (!pend.length) return '';

    var itens = pend.map(function (p) {
      return U.itemPendencia({
        tipo: p.tipo,
        rota: p.acao === 'financeiro' ? '#/financeiro' : (p.acao ? '#/locacoes/' + l.id + '?fazer=' + p.acao : '#/locacoes/' + l.id),
        titulo: p.titulo,
        apoio: p.apoio
      });
    }).join('');

    return bloco('situacao', 'O que falta nesta locação', corpo(
      '<div class="pend">' + itens + '</div>'
    ), '', pend.length + (pend.length === 1 ? ' item' : ' itens'));
  };

  /* ==========================================================
     5 · AÇÕES
     ----------------------------------------------------------
     Cada botão só existe quando o estado permite. A permissão
     não é decidida aqui: `D.statusDaLocacao` e as funções de
     `sessao.js` dizem o que é possível, e a tela desenha a
     partir disso. Botão desenhado onde a ação não vale seria
     botão morto disfarçado.
     ========================================================== */
  var htmlAcoes = function (l) {
    var st = D.statusDaLocacao(l);
    var atraso = atrasoDe(l);
    var vd = S.vistoriasDaLocacao(l.id, 'devolucao')[0];
    var vistoriaFeita = vd && vd.status === 'concluida';
    var r = l.reserva ? S.reserva(l.reserva) : null;

    var botoes = [];

    if (st !== 'aguardando' && st !== 'finalizada') {
      /* Devolução: registrar a vistoria, e depois fechar. A
         ordem não é sugestão — `finalizarLocacao` recusa sem a
         vistoria concluída. Só o botão da vistoria aparece como
         principal quando ela ainda falta: o de finalizar fica
         desabilitado ao lado, dizendo o motivo no `title`. */
      if (vd) {
        botoes.push({
          rotulo: vistoriaFeita ? 'Revisar vistoria de devolução' : 'Registrar vistoria de devolução',
          acao: 'vistoria-devolucao', tom: vistoriaFeita ? 'out' : 'pri',
          dados: { id: l.id }
        });
      }

      botoes.push({
        rotulo: atraso ? 'Finalizar locação atrasada' : 'Finalizar locação',
        acao: 'finalizar', tom: vistoriaFeita ? 'pri' : 'out',
        dados: { id: l.id },
        desabilitado: !vistoriaFeita,
        motivo: vistoriaFeita ? '' : 'Registre a vistoria de devolução antes de finalizar.'
      });

      var saida = S.vistoriasDaLocacao(l.id, 'saida')[0];
      if (saida) {
        botoes.push({ rotulo: 'Ver vistoria de saída', acao: 'vistoria', tom: 'out',
          dados: { id: saida.id } });
      }
    }

    if (r) {
      botoes.push({ rotulo: 'Abrir a reserva', acao: 'ir', tom: 'out',
        dados: { para: '#/reservas/' + r.id } });
    }

    return '<div class="reg__acoes">' +
      botoes.map(function (b) {
        return U.botao(b.rotulo, b.acao, b.tom, b.dados, b.desabilitado, b.motivo);
      }).join('') +
      '</div>';
  };

  /* Quando não há nada a fazer, a tela DIZ isso em vez de deixar
     o cabeçalho sem ação nenhuma — um cabeçalho vazio faz o
     operador procurar um botão que não existe. */
  var recadoDe = function (l) {
    var st = D.statusDaLocacao(l);
    var r = l.reserva ? S.reserva(l.reserva) : null;

    if (st === 'aguardando') {
      return 'Aguardando a retirada. A locação entra em andamento quando o veículo sair, na tela da reserva' +
        (r ? ' ' + r.codigo : ' de origem') + '.';
    }
    if (st === 'finalizada') {
      return 'Locação encerrada. Nada pendente neste registro.';
    }
    return '';
  };

  var htmlDetalhe = function (l) {
    var st = D.statusDaLocacao(l);
    var c = S.cliente(l.clienteId);
    var v = S.veiculo(l.veiculoId);
    var atraso = atrasoDe(l);

    return '' +
      '<div class="reg">' +
      '  <a class="reg__voltar" href="#/locacoes" data-acao="voltar">' +
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
      '    Todas as locações' +
      '  </a>' +
      '  <div class="reg__id">' +
      '    <span class="reg__cod">' + esc(l.codigo) + '</span>' +
      '    ' + U.crachaLocacao(l) +
      '    ' + (atraso ? '<span class="atraso">' +
             '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>' +
             atraso + (atraso === 1 ? ' dia de atraso' : ' dias de atraso') + '</span>' : '') +
      '    <span class="reg__quando">' +
      (c ? esc(c.nome) : 'cliente não identificado') + ' · ' +
      (v ? esc(v.modelo) + ' <span class="mono">' + esc(v.placa) + '</span>' : 'veículo não definido') +
      ' · ' + D.fmtData(l.inicio) + ' → ' +
      (l.fimPrevisto ? D.fmtData(l.fimPrevisto) : 'sem previsão') +
      '    </span>' +
      '  </div>' +
      htmlAcoes(l) +
      (recadoDe(l) ? '<p class="u-xs u-t4">' + esc(recadoDe(l)) + '</p>' : '') +
      '</div>' +
      '<div class="blocos">' +
        blocoSituacao(l) +
        blocoPendencias(l) +
        blocoOrigem(l) +
        blocoKm(l) +
        blocoVistorias(l) +
        blocoValores(l) +
      '</div>';
  };

  /* ==========================================================
     6 · DIÁLOGOS
     ========================================================== */
  var abrirVistoria = function (v) {
    var l = S.locacao(v.locacao);
    var jaFeita = v.status === 'concluida';

    U.abrirModal({
      titulo: jaFeita ? 'Vistoria de ' + (v.tipo === 'saida' ? 'saída' : 'devolução') : 'Registrar vistoria de devolução',
      sub: v.codigo + (l ? ' · ' + l.codigo : '') + ' · ' +
        D.AREAS_VISTORIA.length + ' áreas, do painel ao porta-malas.',
      largo: true,
      corpo:
        '<div class="grid3">' +
          U.fld('Data', 'date', 'data', v.data) +
          U.fld('Hora', 'text', 'hora', v.hora, '00:00') +
          U.fld('Quilometragem lida', 'number', 'km', v.km === null || v.km === undefined ? '' : v.km) +
        '</div>' +
        '<div class="grid2 u-mt">' +
          U.fldSel('Combustível', 'combustivel',
            [{ valor: '', rotulo: 'Não informado' }].concat(D.NIVEIS_COMBUSTIVEL.map(function (n) {
              return { valor: n, rotulo: n };
            })), v.combustivel || '') +
        '</div>' +
        '<p class="fld__lbl u-mt-lg">Áreas</p>' +
        '<div class="grid2">' + D.AREAS_VISTORIA.map(function (a) {
          var at = (v.areas && v.areas[a]) || { observacao: '' };
          return U.fld(a, 'text', 'area-' + a, at.observacao, 'Sem avaria aparente');
        }).join('') + '</div>' +
        U.fldTxt('Observações gerais', 'obs', v.obs, 'Avaria, item esquecido no veículo, condição dos pneus') +
        '<p class="u-xs u-t4 u-mt-lg">As fotos por área dependem de armazenamento de arquivos — ' +
        esc(AVISO_API) + ' Nesta fase a área registra a observação escrita.</p>',
      botoes: jaFeita
        ? [{ rotulo: 'Fechar', tom: 'out', acao: 'x' }]
        : [
            { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
            { rotulo: 'Concluir vistoria', tom: 'pri', acao: 'salvar' }
          ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'salvar') return;

        var campos = U.lerCampos();
        var areas = {};
        D.AREAS_VISTORIA.forEach(function (a) {
          areas[a] = { observacao: campos['area-' + a] || '', fotos: null };
        });

        var r = S.salvarVistoria(v.id, {
          hora: campos.hora, km: campos.km === '' ? null : Number(campos.km),
          combustivel: campos.combustivel, areas: areas, obs: campos.obs,
          concluir: true
        });

        fechar();
        U.canto(r.mensagem, r.ok ? 'ok' : 'aviso');
        U.desenhar();
      }
    });
  };

  var abrirFinalizar = function (l) {
    var vd = S.vistoriasDaLocacao(l.id, 'devolucao')[0];
    var atraso = atrasoDe(l);

    if (!vd || vd.status !== 'concluida') {
      U.canto('Registre a vistoria de devolução antes de finalizar. É `S.finalizarLocacao` que exige — ' +
        'não é a tela.', 'aviso');
      return;
    }

    U.abrirModal({
      titulo: 'Finalizar locação ' + l.codigo,
      sub: 'A quilometragem de entrada volta para a ficha do veículo e o hodômetro da frota é atualizado.',
      corpo:
        '<div class="grid2">' +
          U.fld('Hora da devolução', 'text', 'hora', l.horaEntrada || '', '00:00') +
          U.fld('Quilometragem de entrada', 'number', 'km',
            l.kmEntrada === null || l.kmEntrada === undefined ? (vd.km || '') : l.kmEntrada) +
        '</div>' +
        '<div class="grid2 u-mt">' +
          U.fldSel('Combustível na devolução', 'combustivel',
            [{ valor: '', rotulo: 'Não informado' }].concat(D.NIVEIS_COMBUSTIVEL.map(function (n) {
              return { valor: n, rotulo: n };
            })), l.combustivelEntrada || vd.combustivel || '') +
        '</div>' +
        (atraso
          ? '<div class="aviso u-mt-lg">' +
            '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>' +
            '<span><b>Devolução com ' + atraso + (atraso === 1 ? ' dia' : ' dias') + ' de atraso.</b> ' +
            'A diária adicional do atraso depende da política de atraso, que ainda não foi configurada em ' +
            'CONFIGURAÇÕES → CONTRATOS. O sistema registra o atraso e deixa a cobrança para ser definida — ' +
            'não inventa o valor.</span></div>'
          : ''),
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Finalizar locação', tom: 'pri', acao: 'finalizar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'finalizar') return;

        var campos = U.lerCampos();
        var r = S.finalizarLocacao(l.id, {
          hora: campos.hora,
          km: campos.km === '' ? null : Number(campos.km),
          combustivel: campos.combustivel
        });

        fechar();
        U.canto(r.mensagem, r.ok ? 'ok' : 'aviso');
        U.desenhar();
      }
    });
  };

  /* ==========================================================
     7 · TELA
     ========================================================== */
  var htmlTela = function () {
    if (ALVO && !S.locacao(ALVO)) {
      return U.pageHead('Locação não encontrada',
        'O código <span class="mono">' + esc(ALVO) + '</span> não corresponde a nenhuma locação.') +
        U.vazio('Locação não encontrada',
          'Pode ser um link antigo, ou a locação foi removida da base.',
          U.botao('Ver todas as locações', 'voltar', 'out'));
    }

    if (ALVO) return htmlDetalhe(S.locacao(ALVO));

    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);

    return U.pageHead('Locações',
      'Os contratos que já saíram do papel: o veículo está na rua, com hora, quilometragem e ' +
      'combustível de saída registrados.',
      filtro.id === 'todas' && !BUSCA
        ? U.botao('Ver as reservas', 'ir-reservas', 'out')
        : '') +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  /* Abre direto o diálogo pedido pela pendência clicada. */
  if (ALVO && params.fazer) {
    var l0 = S.locacao(ALVO);
    if (l0) {
      if (params.fazer === 'finalizar') abrirFinalizar(l0);
      if (params.fazer === 'vistoria') {
        var v0 = S.vistoriasDaLocacao(l0.id, 'devolucao')[0];
        if (v0) abrirVistoria(v0);
      }
    }
  }

  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));
    slot.innerHTML = lista.length ? htmlTabela(lista) : htmlVazio();

    if (cont) {
      var emCursoAgora = D.LOCACOES.filter(emCurso).length;
      var atrasadas = D.LOCACOES.filter(function (l) { return D.statusDaLocacao(l) === 'atrasada'; }).length;
      cont.textContent = lista.length + (lista.length === 1 ? ' locação' : ' locações') +
        ' · ' + emCursoAgora + ' na rua' + (atrasadas ? ' · ' + atrasadas + ' atrasada(s)' : '');
    }
  };

  cx.addEventListener('input', function (ev) {
    var campo = ev.target;
    if (!campo || !campo.getAttribute || campo.getAttribute('data-busca') !== '1') return;
    BUSCA = campo.value || '';
    refazerBusca();
  });

  cx.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-acao]') : null;

    if (!alvo) {
      /* Item de pendência é um `<a href="#/...">` sem `data-acao`.
         O caminho do meio é navegar à mão em vez de deixar o
         navegador seguir o link: seguir o link troca o endereço
         sem passar por `desenhar()`, e a tela continuaria a
         antiga com o hash já novo. Por isso o clique é interceptado
         AQUI, e não com um `preventDefault` no topo do ouvinte —
         um `preventDefault` solto mataria justamente este link. */
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (link) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar(link.getAttribute('href'));
        return;
      }

      var linha = ev.target.closest ? ev.target.closest('tr[data-abre]') : null;
      if (linha) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar('#/locacoes/' + linha.getAttribute('data-abre'));
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');
    var l = ALVO ? S.locacao(ALVO) : null;

    if (alvo.getAttribute('aria-disabled') === 'true') {
      U.canto(alvo.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'filtrar': {
        var f = alvo.getAttribute('data-f');
        U.navegar('#/locacoes' + (!f || f === 'todas' ? '' : '?f=' + f));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'voltar':
        U.navegar('#/locacoes');
        return;

      case 'ir-reservas':
        U.navegar('#/reservas');
        return;

      case 'ver':
        if (S.locacao(id)) U.navegar('#/locacoes/' + id);
        else U.canto('Esta locação não está mais na base.', 'aviso');
        return;

      case 'ir': {
        /* Um item de pendência é um `<a href="#/…">`, e o
           `.reg__voltar` também. Deixar o navegador seguir o
           link faria o hash mudar sem passar pelo roteador — e
           sem `desenhar()`, a tela continuaria a antiga com o
           endereço já trocado. Por isso o endereço é lido do
           href e a navegação é feita à mão. */
        var para = alvo.getAttribute('data-para') || alvo.getAttribute('href');
        if (para) U.navegar(para);
        return;
      }

      case 'vistoria': {
        var v = S.vistoria(id);
        if (v) abrirVistoria(v);
        else U.canto('Esta vistoria não está mais na base.', 'aviso');
        return;
      }

      case 'vistoria-devolucao': {
        if (!l) return;
        var vd = S.vistoriasDaLocacao(l.id, 'devolucao')[0];
        if (vd) abrirVistoria(vd);
        else U.canto('Esta locação não tem vistoria de devolução criada.', 'aviso');
        return;
      }

      case 'finalizar':
        if (l) abrirFinalizar(l);
        return;

      case 'financeiro':
        U.navegar('#/financeiro');
        return;

      default:
        U.canto(AVISO_API, 'aviso');
    }
  });
};
