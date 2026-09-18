/* ============================================================
   LOK CAR — SISTEMA · telas/dashboard.js
   ------------------------------------------------------------
   §4 do pedido: seis indicadores, reservas recentes, próximas
   retiradas, próximas devoluções, status da frota e pendências.

   O QUE ESTA TELA NÃO FAZ
   ------------------------------------------------------------
   Ela não soma nada por conta própria. Todo número sai de
   `LOKCAR_DADOS` — que, por sua vez, lê os MESMOS arrays que a
   sessão altera. É isso que faz "reservas confirmadas hoje"
   mudar no cartão no instante em que o operador confirma uma
   reserva em outra tela, sem nenhum código de sincronização.

   Os seis indicadores são os SEIS do pedido, na ordem do pedido.
   Nenhum a mais: um painel com dez números não informa, ele
   esconde o que importa no meio do que não importa.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.dashboard = function (cx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  /* ==========================================================
     1 · OS SEIS INDICADORES
     ========================================================== */
  var indicadores = function () {
    var resumo = D.resumoReservas();
    var reservasHoje = D.reservasHoje();
    var retiradas = D.retiradasHoje();
    var devolucoes = D.devolucoesHoje();
    var frota = D.contagemFrota();
    var fin = D.financeiroResumo();

    var totalFrota = S.estado.veiculos.length;

    var devolucoesN = devolucoes.locacoes.length + devolucoes.reservas.length;

    /* --- 1 · RESERVAS HOJE -----------------------------------
       Conta o que foi criado hoje MAIS o que começa hoje, sem as
       canceladas. As duas datas importam: uma reserva feita ontem
       para retirar hoje é operação de hoje; uma reserva feita hoje
       para o mês que vem é trabalho de hoje (alguém precisa
       responder). Contar só uma das duas esconderia metade. */
    var criadasHoje = S.estado.reservas.filter(function (r) {
      return r.criadaEm === D.HOJE && r.status !== 'cancelada';
    }).length;

    var kpis = [
      {
        chave: 'Reservas hoje',
        ico: 'M8 3v3M16 3v3M4 8h16M5 5h14v15H5z',
        valor: reservasHoje.length,
        nota: reservasHoje.length
          ? '<b>' + criadasHoje + '</b> ' + (criadasHoje === 1 ? 'criada' : 'criadas') +
            ' hoje · <b>' + (reservasHoje.length - criadasHoje) + '</b> com início hoje'
          : 'Nenhuma movimentação de reserva hoje',
        barra: totalFrota ? Math.min(100, Math.round(reservasHoje.length / totalFrota * 100)) : 0,
        tom: '',
        rota: '#/reservas?f=hoje'
      },
      {
        chave: 'Retiradas hoje',
        ico: 'M4 12h13M13 7l5 5-5 5M4 19h6',
        valor: retiradas.length,
        nota: retiradas.length
          ? 'Reservas prontas ou confirmadas para sair hoje'
          : 'Nenhuma retirada marcada para hoje',
        barra: totalFrota ? Math.min(100, Math.round(retiradas.length / totalFrota * 100)) : 0,
        tom: 'go',
        rota: '#/reservas?f=pronta'
      },
      {
        chave: 'Devoluções hoje',
        ico: 'M20 12H7M11 7l-5 5 5 5M20 5h-6',
        valor: devolucoesN,
        nota: devolucoesN
          ? '<b>' + devolucoes.locacoes.length + '</b> em andamento · <b>' + devolucoes.reservas.length + '</b> pela agenda'
          : 'Nenhuma devolução prevista para hoje',
        barra: totalFrota ? Math.min(100, Math.round(devolucoesN / totalFrota * 100)) : 0,
        tom: 'warn',
        rota: '#/locacoes'
      },
      {
        chave: 'Veículos locados',
        ico: 'M4 16h16M5 16V11l2-5h10l2 5v5M7 16v2M17 16v2',
        valor: frota.locado,
        nota: 'de <b>' + totalFrota + '</b> unidades na frota',
        barra: totalFrota ? Math.round(frota.locado / totalFrota * 100) : 0,
        tom: 'acc',
        rota: '#/frota?f=locado'
      },
      {
        chave: 'Veículos disponíveis',
        ico: 'M20 6L9 17l-5-5',
        valor: frota.disponivel,
        nota: frota.disponivel
          ? 'Livres para nova locação agora'
          : 'Nenhuma unidade livre neste momento',
        barra: totalFrota ? Math.round(frota.disponivel / totalFrota * 100) : 0,
        tom: frota.disponivel ? 'ok' : 'idle',
        rota: '#/frota?f=disponivel'
      },
      {
        chave: 'Faturamento do mês',
        ico: 'M3 7h18v11H3zM3 11h18M7 15h3',
        valor: null,
        valorTxt: D.fmtBRL(fin.recebidoMes),
        nota: '<b>' + D.fmtBRL(fin.aReceber) + '</b> a receber' +
              (fin.atrasado ? ' · <b>' + D.fmtBRL(fin.atrasado) + '</b> em atraso' : ''),
        barra: (fin.recebidoMes + fin.aReceber) > 0
          ? Math.round(fin.recebidoMes / (fin.recebidoMes + fin.aReceber) * 100) : 0,
        tom: fin.atrasado ? 'warn' : 'ok',
        rota: '#/financeiro'
      }
    ];

    return kpis;
  };

  var htmlKpis = function () {
    return '<div class="kpis">' + indicadores().map(function (k) {
      var conteudo = k.valorTxt !== undefined
        ? '<p class="kpi__val">' + k.valorTxt + '</p>'
        : '<p class="kpi__val">' + k.valor + '</p>';

      return '' +
        '<a class="kpi" href="' + k.rota + '">' +
        '  <span class="kpi__key">' +
        '    <svg class="kpi__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + k.ico + '"/></svg>' +
        U.esc(k.chave) +
        '  </span>' +
        conteudo +
        '  <p class="kpi__nota">' + k.nota + '</p>' +
        '  <span class="kpi__bar kpi__bar--' + (k.tom || 'acc') + '"><i style="width:' + k.barra + '%"></i></span>' +
        '</a>';
    }).join('') + '</div>';
  };

  /* ==========================================================
     2 · RESERVAS RECENTES
     ----------------------------------------------------------
     As últimas que entraram, pela data de criação. É a lista
     que responde "o que chegou desde ontem?", e por isso ela
     mostra a ORIGEM: uma reserva vinda do site é uma pessoa
     esperando resposta.
     ========================================================== */
  var htmlRecentes = function () {
    var lista = S.estado.reservas.slice().sort(function (a, b) {
      var d = D.diffDias(a.criadaEm, b.criadaEm);
      if (d !== 0) return d;
      return a.codigo < b.codigo ? 1 : -1;
    }).slice(0, 6);

    if (!lista.length) {
      return U.vazio('Nenhuma reserva', 'Não há reservas registradas no sistema.');
    }

    return '<div class="mov-lista">' + lista.map(function (r) {
      var v = S.veiculo(r.veiculoId);
      var semCliente = !r.clienteId;

      return '' +
        '<a class="mov" href="#/reservas/' + r.id + '">' +
        '  <span class="mov__q">' + U.esc(r.codigo) + '</span>' +
        '  <span class="mov__t">' +
        '    <b>' + U.esc(semCliente ? 'Cliente não informado' : U.nomeCliente(r.clienteId)) + '</b>' +
        '    <span>' + U.esc(v ? v.modelo + ' · ' + v.placa : 'Veículo não definido') +
        ' · ' + D.fmtDataCurta(r.de) + '–' + D.fmtDataCurta(r.ate) + '</span>' +
        '  </span>' +
        (r.origem === 'site'
          ? '<span class="bdg bdg--acc bdg--mini">site</span>'
          : U.crachaReserva(r)) +
        '</a>';
    }).join('') + '</div>';
  };

  /* ==========================================================
     3 · PRÓXIMAS RETIRADAS E DEVOLUÇÕES
     ----------------------------------------------------------
     A agenda dos próximos dias. A retirada é a linha de frente —
     é onde o cliente aparece e onde o carro precisa estar
     pronto. Por isso ela vem primeiro e com a hora visível.
     ========================================================== */
  var linhaAgenda = function (o) {
    var v = S.veiculo(o.veiculoId);
    var atrasado = Boolean(o.atrasado);

    return '' +
      '<a class="ag" href="' + o.rota + '">' +
      '  <span class="ag__hora">' + U.esc(o.hora || '--:--') +
      '    <small>' + D.quando(o.quando) + '</small>' +
      '  </span>' +
      '  <span class="ag__alvo">' +
      '    <b class="ag__carro">' + U.esc(v ? v.modelo : 'Veículo não definido') + '</b>' +
      '    <span class="ag__placa">' + U.esc(v ? v.placa : '—') + '</span>' +
      '  </span>' +
      '  <span class="ag__cliente">' +
      U.esc(o.clienteId ? U.nomeCliente(o.clienteId) : 'Cliente não informado') +
      '<span>' + U.esc(o.codigo) + ' · ' + D.fmtData(o.quando) + '</span>' +
      '  </span>' +
      (atrasado
        ? '<span class="atraso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17v.01"/><circle cx="12" cy="12" r="9"/></svg>' +
          (o.diasAtraso || 0) + 'd</span>'
        : (o.cracha || '')) +
      '</a>';
  };

  var htmlRetiradas = function () {
    var lista = D.proximasRetiradas(6);

    if (!lista.length) {
      return U.vazio('Sem retiradas marcadas', 'Nenhuma reserva confirmada ou pronta para os próximos dias.');
    }

    return '<div>' + lista.map(function (r) {
      return linhaAgenda({
        rota: '#/reservas/' + r.id,
        hora: r.retiradaHora,
        quando: r.de,
        veiculoId: r.veiculoId,
        clienteId: r.clienteId,
        codigo: r.codigo,
        cracha: U.crachaReserva(r)
      });
    }).join('') + '</div>';
  };

  var htmlDevolucoes = function () {
    var lista = D.proximasDevolucoes(6);

    if (!lista.length) {
      return U.vazio('Sem devoluções marcadas', 'Nenhuma locação em andamento com devolução prevista.');
    }

    return '<div>' + lista.map(function (item) {
      var l = item.locacao;
      var r = item.reserva;

      return linhaAgenda({
        rota: l ? '#/locacoes/' + l.id : '#/reservas/' + r.id,
        /* Na locação a hora de entrada ainda não existe — ela é
           preenchida na devolução. Mostrar "09:00" seria inventar
           um compromisso que ninguém marcou. */
        hora: l ? (l.horaEntrada || '—') : (r.devolucaoHora || ''),
        quando: item.ate,
        veiculoId: item.veiculoId,
        clienteId: item.clienteId,
        codigo: l ? l.codigo : (r ? r.codigo : '—'),
        atrasado: item.atrasada,
        diasAtraso: l ? D.atrasoDaLocacao(l) : 0,
        cracha: l ? U.crachaLocacao(l) : U.crachaReserva(r)
      });
    }).join('') + '</div>';
  };

  /* ==========================================================
     4 · STATUS DA FROTA
     ----------------------------------------------------------
     Uma barra dividida e uma legenda com o número de cada
     situação. É a resposta mais rápida possível para "como está
     a frota agora" — e as situações e as cores são as mesmas do
     crachá usado em toda parte.
     ========================================================== */
  var htmlFrota = function () {
    var c = D.contagemFrota();
    var total = S.estado.veiculos.length || 1;

    var ordem = [
      { id: 'disponivel',   rotulo: 'Disponíveis' },
      { id: 'reservado',    rotulo: 'Reservados' },
      { id: 'locado',       rotulo: 'Locados' },
      { id: 'manutencao',   rotulo: 'Manutenção' },
      { id: 'indisponivel', rotulo: 'Indisponíveis' }
    ];

    var barra = ordem.map(function (o) {
      var pct = c[o.id] / total * 100;
      return pct > 0
        ? '<i class="frota-barra__i--' + o.id + '" style="width:' + pct + '%"></i>'
        : '';
    }).join('');

    var legenda = ordem.map(function (o) {
      return '' +
        '<a class="legenda__i" href="#/frota?f=' + o.id + '">' +
        '  <span class="legenda__p legenda__p--' + o.id + '"></span>' +
        U.esc(o.rotulo) +
        '  <span class="legenda__n">' + c[o.id] + '</span>' +
        '</a>';
    }).join('');

    return '<div class="frota-barra">' + barra + '</div>' +
           '<div class="legenda">' + legenda + '</div>';
  };

  /* ==========================================================
     5 · PENDÊNCIAS
     ----------------------------------------------------------
     A lista mais importante do painel. É o que o pedido chamou
     de "contrato aguardando assinatura, documento pendente,
     pagamento pendente, vistoria pendente, devolução atrasada".

     Ela NÃO é escrita aqui: vem de `D.pendencias()`, que cruza
     contratos, documentos, lançamentos, vistorias, locações e
     conflitos de agenda. O painel mostra as seis primeiras e
     manda o resto para a tela de Notificações.
     ========================================================== */
  var htmlPendencias = function () {
    var lista = D.pendencias();

    if (!lista.length) {
      return '<div class="pend__zero">' +
             '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
             '<b>Nada pendente</b>' +
             '<span>Nenhuma decisão aguardando você neste momento.</span>' +
             '</div>';
    }

    return '<div class="pend">' + lista.slice(0, 7).map(U.itemPendencia).join('') + '</div>' +
           (lista.length > 7
             ? '<div class="pend__mais"><a href="#/notificacoes">Ver as outras ' +
               (lista.length - 7) + ' pendências</a></div>'
             : '');
  };

  /* ==========================================================
     6 · MONTAGEM
     ========================================================== */
  cx.innerHTML = '' +
    U.pageHead(
      'Visão geral',
      'O dia da locadora: o que sai, o que volta e o que precisa de decisão. ' +
      'Todos os números vêm da operação registrada no sistema.',
      U.botao('Nova reserva', 'nova-reserva', 'pri') +
      U.botao('Ver calendário', 'ir-calendario', 'out')
    ) +

    htmlKpis() +

    '<div class="duas">' +

    '  <div class="pilha">' +

    '    <section class="card">' +
    '      <div class="card__head">' +
    '        <div>' +
    '          <h2 class="card__title">Próximas retiradas</h2>' +
    '          <p class="card__sub">Quem vem buscar, quando e com qual carro.</p>' +
    '        </div>' +
    '        <a class="ab" href="#/reservas">Ver reservas</a>' +
    '      </div>' +
    '      <div class="card__body card__body--flush">' + htmlRetiradas() + '</div>' +
    '    </section>' +

    '    <section class="card">' +
    '      <div class="card__head">' +
    '        <div>' +
    '          <h2 class="card__title">Próximas devoluções</h2>' +
    '          <p class="card__sub">O que precisa voltar para a frota.</p>' +
    '        </div>' +
    '        <a class="ab" href="#/locacoes">Ver locações</a>' +
    '      </div>' +
    '      <div class="card__body card__body--flush">' + htmlDevolucoes() + '</div>' +
    '    </section>' +

    '  </div>' +

    '  <aside class="pilha">' +

    '    <section class="card">' +
    '      <div class="card__head">' +
    '        <div>' +
    '          <h2 class="card__title">Pendências</h2>' +
    '          <p class="card__sub">O que exige uma decisão sua.</p>' +
    '        </div>' +
    '      </div>' +
    '      <div class="card__body card__body--flush">' + htmlPendencias() + '</div>' +
    '    </section>' +

    '    <section class="card">' +
    '      <div class="card__head">' +
    '        <div>' +
    '          <h2 class="card__title">Status da frota</h2>' +
    '          <p class="card__sub">Situação das unidades agora.</p>' +
    '        </div>' +
    '      </div>' +
    '      <div class="card__body">' + htmlFrota() + '</div>' +
    '    </section>' +

    '    <section class="card">' +
    '      <div class="card__head">' +
    '        <div>' +
    '          <h2 class="card__title">Reservas recentes</h2>' +
    '          <p class="card__sub">As últimas que entraram.</p>' +
    '        </div>' +
    '      </div>' +
    '      <div class="card__body card__body--flush">' + htmlRecentes() + '</div>' +
    '    </section>' +

    '  </aside>' +

    '</div>';

  /* ==========================================================
     7 · AÇÕES
     ----------------------------------------------------------
     Um só ouvinte no container, lendo `data-acao`. Isso resolve
     o problema clássico de tela redesenhada: listeners presos em
     elementos que já não existem.
     ========================================================== */
  cx.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-acao]') : null;
    if (!alvo) return;

    var acao = alvo.getAttribute('data-acao');

    if (acao === 'nova-reserva') {
      ev.preventDefault();
      U.abrirModal({
        titulo: 'Nova reserva',
        sub: 'A criação de reserva direto no balcão entra junto com o formulário de reservas.',
        corpo: U.vazio(
          'Formulário em construção',
          'A lista e o detalhe de reservas já estão funcionando. Para criar uma reserva nova aqui dentro, ' +
          'falta o formulário com seleção de veículo, período e proteção.'
        ),
        botoes: [{ rotulo: 'Fechar', tom: 'sil', acao: 'x' }],
        aoClicar: function () { U.fecharModal(); }
      });
    }

    /* Nada aqui pode terminar em silêncio. Um clique que não
       produz nada visível é indistinguível de um sistema
       travado, e o operador clica de novo achando que errou. */
    if (acao === 'ir-calendario') {
      ev.preventDefault();
      U.navegar('#/calendario');
      return;
    }

    if (acao === 'ver-todas-reservas') {
      ev.preventDefault();
      U.navegar('#/reservas');
      return;
    }

    if (acao === 'ver-todas-pendencias') {
      ev.preventDefault();
      U.navegar('#/notificacoes');
      return;
    }

    ev.preventDefault();
    U.canto('Esta ação entra junto com o restante do módulo de reservas.', 'aviso');
  });
};
