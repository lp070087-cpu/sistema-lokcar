/* ============================================================
   LOK CAR — SISTEMA · telas/prorrogacoes.js
   ------------------------------------------------------------
   §7 a §12: o cliente está com o carro e pede mais dias. Esta
   tela é onde a Lok Car responde a esse pedido.

   POR QUE ESTA TELA É SEPARADA DE RESERVAS
   ------------------------------------------------------------
   Uma reserva é uma promessa sobre um carro que ainda está na
   garagem. Uma prorrogação é uma decisão sobre um carro que JÁ
   SAIU e está na mão de alguém. As duas mexem em datas, e é aí
   que a semelhança acaba: a reserva muda o que foi combinado
   antes da retirada (§2), a prorrogação muda o que está
   acontecendo agora, com o cliente na estrada e um contrato já
   fechado.

   POR QUE ESTA TELA NÃO DECIDE NADA SOZINHA
   ------------------------------------------------------------
   Aprovar aqui NÃO é "marcar como aprovado". É esticar a
   locação, a reserva e o calendário do veículo, e isso tem de
   acontecer num lugar só — `S.decidirProrrogacao` —, que roda a
   MESMA checagem de agenda que o §2 e o §8 usam. Se esta tela
   aprovasse por conta própria, um dia ela diria "livre" onde a
   outra diz "ocupado", e o carro ficaria prometido duas vezes
   sem ninguém perceber. Aqui a tela mostra e pergunta; quem
   grava é a sessão.

   POR QUE A VERIFICAÇÃO APARECE ANTES DO BOTÃO
   ------------------------------------------------------------
   O operador precisa saber ANTES de clicar se o pedido cabe. Um
   "não é possível aprovar" que só aparece depois do clique ensina
   o operador a clicar para descobrir — e na vez seguinte ele
   clica sem ler. Mostrando o resultado da checagem antes, o
   botão APROVAR já chega com o motivo na mão quando não dá.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.prorrogacoes = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  var AVISO_API = 'Disponível após integração do backend.';

  /* ==========================================================
     1 · DE ONDE SAEM OS DADOS
     ========================================================== */
  var extensoes = function () { return S.estado.extensoes || []; };

  var achar = function (id) {
    var lista = extensoes();
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  };

  var veiculoDe = function (e) { return S.veiculo(e.veiculoId); };
  var locacaoDe = function (e) { return e.locacaoId ? S.locacao(e.locacaoId) : null; };

  var nomeCliente = function (e) { return U.nomeCliente(e.clienteId); };

  var carroDe = function (e) {
    var v = veiculoDe(e);
    return v ? v.modelo + ' · ' + v.placa : 'Veículo não informado';
  };

  var dias = function (n) {
    return Number(n) + (Number(n) === 1 ? ' dia' : ' dias');
  };

  /* O valor adicional NUNCA é inventado: nasce de
     `D.valorDaProrrogacao`, que roda a tabela do site duas vezes
     (hoje e hoje + dias) porque a faixa de desconto muda de
     degrau. Quando não dá para calcular, é `null` — e `null` aqui
     vira "a confirmar", jamais R$ 0,00. */
  var valorDe = function (e) {
    var v = e.estimatedAdditionalValue;
    if (v === null || v === undefined || isNaN(v)) return null;
    return Number(v) > 0 ? Number(v) : null;
  };

  var dinheiro = function (e) {
    return valorDe(e) === null
      ? '<span class="falta">a confirmar</span>'
      : D.fmtBRL(valorDe(e));
  };

  var quando = function (dia) { return dia ? D.fmtData(dia) : '—'; };

  /* ==========================================================
     2 · AS ABAS
     ----------------------------------------------------------
     A primeira aba é a que tem trabalho. Abrir em "Todas"
     esconderia o pedido novo no meio de decisões antigas, e esta
     tela existe justamente para o pedido novo não passar batido.
     ========================================================== */
  var ABAS = [
    { id: 'aguardando', rotulo: 'Aguardando',
      nota: 'precisa de uma decisão',
      teste: function (e) { return e.status === 'pendente'; } },
    { id: 'aprovadas', rotulo: 'Aprovadas',
      nota: 'o carro fica mais tempo',
      teste: function (e) { return e.status === 'aprovada' || e.status === 'auto'; } },
    { id: 'recusadas', rotulo: 'Recusadas',
      nota: 'o cliente foi avisado de que não',
      teste: function (e) { return e.status === 'recusada'; } },
    { id: 'todas', rotulo: 'Todas',
      nota: 'o histórico inteiro',
      teste: function () { return true; } }
  ];

  var abaDe = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return ABAS[0];
  };

  var filtrar = function (aba) {
    return extensoes().filter(function (e) { return aba.teste(e); });
  };

  var contar = function (aba) {
    return extensoes().filter(function (e) { return aba.teste(e); }).length;
  };

  /* ==========================================================
     3 · A VERIFICAÇÃO DE AGENDA (§8)
     ----------------------------------------------------------
     Roda a MESMA função que o §2 usa para editar período — aqui
     em modo leitura, só para o operador ver o que vai encontrar
     antes de clicar.

     `e.reservaId` é ignorado na checagem pelo motivo de sempre: a
     reserva desta locação não conflita consigo mesma. A locação
     em curso também não acusa, porque a própria função não conta
     duas vezes o mesmo carro no mesmo período.
     ========================================================== */
  var verificacao = function (e) {
    return D.disponibilidadeNoPeriodo(e.veiculoId, e.currentReturnAt,
                                      e.requestedReturnAt, e.reservaId);
  };

  var ROTULO_MOTIVO = {
    reserva: 'Reserva',
    locacao: 'Locação',
    manutencao: 'Manutenção',
    frota: 'Frota'
  };

  /* ==========================================================
     4 · PEÇAS DE DESENHO — as mesmas do detalhe da reserva
     ========================================================== */
  var ICONE = {
    pedido:  'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    agenda:  'M8 3v3M16 3v3M4 8h16M5 5h14v15H5z',
    decisao: 'M20 6L9 17l-5-5',
    acoes:   'M3 12h4l3 7 4-14 3 7h4'
  };

  var bloco = function (id, titulo, conteudo, extraClasse) {
    return '<section class="bloco' + (extraClasse ? ' ' + extraClasse : '') + '">' +
      '<div class="bloco__h">' +
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONE[id] + '"/></svg>' +
      '  <h2>' + esc(titulo) + '</h2>' +
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

  var cracha = function (e) { return U.cracha(D.STATUS_EXTENSAO, e.status, 'bdg--mini'); };

  /* ==========================================================
     5 · O CARTÃO DO PEDIDO
     ========================================================== */
  var htmlCartao = function (e) {
    var v = veiculoDe(e);
    var ver = verificacao(e);
    var travado = e.status === 'pendente' && !ver.livre;

    return '<a class="pro__c" href="#/prorrogacoes/' + esc(e.id) + '">' +
      '<span class="pro__foto">' +
        (v && v.img
          ? '<img src="' + esc(v.img) + '" alt="" loading="lazy"/>'
          : '<span class="pro__semfoto">sem foto</span>') +
      '</span>' +
      '<span class="pro__bd">' +
        '<span class="pro__l1">' +
          '<b class="pro__quem">' + esc(nomeCliente(e)) + '</b>' +
          cracha(e) +
        '</span>' +
        '<span class="pro__carro">' + esc(carroDe(e)) + '</span>' +
        '<span class="pro__datas">' +
          '<span class="pro__de">' + quando(D.soData(e.currentReturnAt)) + '</span>' +
          '<span class="pro__seta" aria-hidden="true">→</span>' +
          '<span class="pro__para">' + quando(D.soData(e.requestedReturnAt)) + '</span>' +
          '<span class="pro__mais">+' + esc(dias(e.extraDays)) + '</span>' +
        '</span>' +
        '<span class="pro__val">Valor adicional: ' + dinheiro(e) + '</span>' +
        /* O aviso de agenda fica na LISTA, não só no detalhe: é
           ele que faz o operador abrir este pedido em vez daquele. */
        (travado
          ? '<span class="pro__alerta">' +
            U.etiqueta('Conflito de agenda', 'bad') +
            '<span class="pro__alertatx">' +
            esc(ver.motivos.length ? ver.motivos[0].rotulo : 'veículo indisponível') +
            '</span></span>'
          : '') +
      '</span>' +
      '<span class="pro__seta2" aria-hidden="true">›</span>' +
      '</a>';
  };

  var htmlVazio = function (aba) {
    if (extensoes().length === 0) {
      return U.vazio('Nenhuma prorrogação registrada',
        'Esta tela se enche sozinha quando um cliente pede mais dias pelo Portal do Cliente. ' +
        'Nada aqui é criado à mão: o pedido nasce do outro lado, com o cliente.',
        U.botao('Ver locações em campo', 'ir-locacoes', 'out'));
    }
    return U.vazio('Nada ' + aba.rotulo.toLowerCase() + ' agora',
      aba.nota.charAt(0).toUpperCase() + aba.nota.slice(1) +
      '. Use as abas para ver o resto da lista.',
      U.botao('Ver todas', 'aba-todas', 'out'));
  };

  /* ==========================================================
     6 · OS NÚMEROS DO TOPO
     ========================================================== */
  var cartao = function (slot, chave, valor, nota, tom) {
    return '<div class="kpi">' +
      '<span class="kpi__key">' + esc(chave) + '</span>' +
      '<p class="kpi__val' + (tom ? ' kpi__val--' + tom : '') + '" data-kpi="' + slot + '">' +
        esc(valor) + '</p>' +
      (nota ? '<p class="kpi__nota">' + esc(nota) + '</p>' : '') +
      '</div>';
  };

  var htmlCards = function () {
    var aguardando = contar(abaDe('aguardando'));
    var bloqueados = extensoes().filter(function (e) {
      return e.status === 'pendente' && !verificacao(e).livre;
    }).length;
    var autos = extensoes().filter(function (e) { return e.status === 'auto'; }).length;
    var modo = D.modoDeProrrogacao(S.regras());

    return '<div class="kpis kpis--4">' +
      cartao('aguardando', 'Aguardando decisão', String(aguardando),
        aguardando ? 'pedidos de cliente sem resposta' : 'nenhum pedido em aberto',
        aguardando ? 'warn' : '') +
      cartao('conflito', 'Com conflito de agenda', String(bloqueados),
        bloqueados ? 'não podem ser aprovados como estão'
                   : 'todos os pedidos cabem na agenda',
        bloqueados ? 'bad' : '') +
      cartao('auto', 'Aprovadas pela regra', String(autos),
        autos ? 'decididas sem passar por uma pessoa'
              : 'nenhuma decisão tomada pela regra', '') +
      cartao('modo', 'Modo configurado', modo === 'auto' ? 'Automático' : 'Manual',
        modo === 'auto' ? 'aprova sozinho quando o carro está livre'
                        : 'toda prorrogação passa por uma pessoa', '') +
      '</div>';
  };

  var htmlAbas = function (aba) {
    return '<div class="tabs" role="tablist" aria-label="Filtrar prorrogações">' +
      ABAS.map(function (a) {
        return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" ' +
          'data-f="' + a.id + '"' + (a.id === aba.id ? ' aria-selected="true"' : '') + '>' +
          esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
      }).join('') +
      '</div>';
  };

  /* ==========================================================
     7 · A LISTA
     ========================================================== */
  var htmlLista = function () {
    var aba = abaDe(params.f);
    var lista = filtrar(aba);

    return U.pageHead('Prorrogações',
      'Pedidos de mais dias feitos por quem já está com o carro. Aprovar estica a locação, a ' +
      'reserva e a agenda do veículo de uma vez — por isso o sistema confere a agenda antes de ' +
      'deixar aprovar.',
      U.botao('Abrir notificações', 'ir-notificacoes', 'out')) +
      htmlCards() +
      htmlAbas(aba) +
      (lista.length
        ? '<div class="pro__grade">' + lista.map(htmlCartao).join('') + '</div>'
        : htmlVazio(aba)) +
      '<p class="u-xs u-t4 u-mt">Um pedido resolvido sai da pendência do sino na hora: ' +
      'aprovar e recusar são decisões, e decisão não é pendência. Nesta fase o pedido é ' +
      'registrado no próprio navegador. ' + esc(AVISO_API) + '</p>';
  };

  /* ==========================================================
     8 · A VERIFICAÇÃO CONTRA A AGENDA (§8)
     ========================================================== */
  var htmlAvisoAgenda = function (e) {
    var ver = verificacao(e);

    if (ver.livre) {
      return '<div class="aviso aviso--ok">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>' +
        '<span><b>Veículo livre no período extra.</b> Nenhuma reserva, locação ou manutenção ' +
        'ocupa ' + esc(carroDe(e)) + ' entre ' + D.fmtDataHora(e.currentReturnAt) + ' e ' +
        D.fmtDataHora(e.requestedReturnAt) + '.</span></div>';
    }

    var motivos = ver.motivos.map(function (m) {
      return '<li class="pconf__i">' +
        U.etiqueta(ROTULO_MOTIVO[m.tipo] || m.tipo, m.tipo === 'reserva' ? 'warn' : 'bad') +
        '<span class="pconf__n">' + esc(m.rotulo) + '</span></li>';
    }).join('');

    var deOutraPessoa = ver.motivos.some(function (m) {
      return m.tipo === 'reserva' || m.tipo === 'locacao';
    });

    return '<div class="pconf__cx">' +
      '<p class="pconf__t">Não é possível aprovar automaticamente.</p>' +
      '<p class="pconf__s">O período extra cruza outro compromisso deste veículo' +
      (deOutraPessoa ? ' — de outra pessoa.' : '.') +
      ' Aprovar assim marcaria dois compromissos no mesmo carro nos mesmos dias.</p>' +
      '<ul class="pconf__l">' + motivos + '</ul>' +
      (deOutraPessoa
        ? '<p class="pconf__s">Não altere a reserva da outra pessoa. Se o cliente precisa ' +
          'mesmo ficar com o carro, o caminho é oferecer outro veículo ou combinar a troca — ' +
          'nada disso se resolve esticando esta locação.</p>'
        : '') +
      '</div>';
  };

  /* ==========================================================
     9 · O DETALHE (§9, §10)
     ========================================================== */
  var htmlPedido = function (e) {
    var l = locacaoDe(e);

    return bloco('pedido', 'O que o cliente pediu', corpo(ficha([
      ['Cliente', esc(nomeCliente(e))],
      ['Veículo', esc(carroDe(e))],
      ['Locação', l ? esc(l.codigo) : '<span class="falta">não vinculada</span>'],
      ['Devolução atual', D.fmtDataHora(e.currentReturnAt)],
      ['Solicitado', '<b>' + D.fmtDataHora(e.requestedReturnAt) + '</b>'],
      ['Dias adicionais', esc(dias(e.extraDays))],
      ['Valor adicional estimado', dinheiro(e)],
      ['Pedido em', quando(e.createdAt)]
    ])));
  };

  var htmlDecisao = function (e) {
    if (e.status === 'pendente') return '';

    return bloco('decisao', 'Decisão', corpo(ficha([
      ['Resultado', cracha(e)],
      ['Decidido em', quando(e.decidedAt)],
      ['Por', esc(e.decidedBy || '—')],
      ['Motivo', esc(e.decisionReason || '—')]
    ])));
  };

  var htmlDetalhe = function (e) {
    var pendente = e.status === 'pendente';
    var livre = verificacao(e).livre;
    var trava = 'Há conflito de agenda neste período — veja a verificação antes de decidir.';

    return '' +
      '<div class="reg">' +
      '  <a class="reg__voltar" href="#/prorrogacoes">' +
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
      '    Todas as prorrogações' +
      '  </a>' +
      '  <div class="reg__id">' +
      '    <span class="reg__cod">' + esc(String(e.id).toUpperCase()) + '</span>' +
      '    ' + cracha(e) +
      '    <span class="reg__quando"><b>' + esc(nomeCliente(e)) + '</b> · ' +
      '    ' + esc(carroDe(e)) + ' · +' + esc(dias(e.extraDays)) + '</span>' +
      '  </div>' +
      (pendente
        ? '  <div class="reg__acoes">' +
          U.botao('Recusar', 'recusar', 'out', { id: e.id }) +
          U.botao('Aprovar prorrogação', 'aprovar', 'pri', { id: e.id }, !livre, trava) +
          '  </div>'
        : '') +
      '</div>' +

      '<div class="blocos">' +
        htmlPedido(e) +
        bloco('agenda', 'Verificação da agenda', corpo(htmlAvisoAgenda(e)), 'bloco--largo') +
        htmlDecisao(e) +
        (pendente
          ? bloco('acoes', 'O que cada decisão faz', corpo(
              '<p class="u-sm u-t2">Aprovar estica a devolução da locação e da reserva para ' +
              D.fmtDataHora(e.requestedReturnAt) + ', registra a alteração no histórico da ' +
              'reserva e libera o carro por mais ' + esc(dias(e.extraDays)) + '. Recusar ' +
              'mantém a devolução em ' + D.fmtDataHora(e.currentReturnAt) + ' e exige um ' +
              'motivo — o cliente precisa saber o que aconteceu, senão ele liga para ' +
              'perguntar.</p>' +
              '<p class="u-xs u-t4 u-mt">A aprovação automática é uma regra, não este botão: ' +
              'em CONFIGURAÇÕES → RESERVAS E LOCAÇÕES o dono escolhe entre aprovação manual e ' +
              'automática quando possível. ' + esc(AVISO_API) + '</p>'), 'bloco--largo')
          : '') +
      '</div>';
  };

  /* ==========================================================
     10 · A TELA
     ========================================================== */
  var idAlvo = (ctx && ctx.alvo) ? String(ctx.alvo) : null;
  var registro = idAlvo ? achar(idAlvo) : null;

  if (idAlvo && !registro) {
    cx.innerHTML = U.pageHead('Prorrogação não encontrada',
      'O identificador ' + esc(idAlvo) + ' não corresponde a nenhum pedido desta base.') +
      U.vazio('Pedido não encontrado',
        'Ele pode ter sido decidido e retirado da lista, ou o endereço está incompleto.',
        U.botao('Ver todas as prorrogações', 'aba-todas', 'out'));
  } else {
    cx.innerHTML = registro ? htmlDetalhe(registro) : htmlLista();
  }

  /* ==========================================================
     11 · RECUSAR — o formulário (§10)
     ----------------------------------------------------------
     Os quatro motivos são os do §10. "OUTRO" é o único que
     obriga texto: recusar sem explicar é exatamente o que faz o
     cliente pegar o telefone.
     ========================================================== */
  var MOTIVOS = [
    'VEÍCULO JÁ RESERVADO',
    'MANUTENÇÃO PROGRAMADA',
    'PENDÊNCIA FINANCEIRA',
    'OUTRO'
  ];

  var abrirRecusa = function (e) {
    /* A ESCOLHA DO MOTIVO É FECHADA AQUI, e não procurada no DOM
       na hora do clique.

       `U.opcoes` é um grupo de BOTÕES, não um campo: nem
       `U.lerCampos` nem o navegador guardam a escolha em lugar
       nenhum. Alguém tem de lembrar dela entre o clique no motivo
       e o clique em confirmar, e esse alguém é este closure.

       A versão anterior tentava chegar ao corpo do modal por
       `bt.ownerDocument.getElementById('modBd')` dentro de
       `aoClicar`. Isso funciona no navegador, mas é uma volta
       desnecessária: `aoAbrir` já RECEBE o corpo, então guardá-lo
       custa uma linha e não depende de travessia de DOM. */
    var escolhido = '';
    var corpo = null;

    U.abrirModal({
      titulo: 'Recusar prorrogação',
      sub: nomeCliente(e) + ' · ' + carroDe(e) + ' — pedido de +' + dias(e.extraDays) +
           ' (devolução em ' + D.fmtDataHora(e.requestedReturnAt) + ')',
      corpo:
        '<p class="fld__lbl">Motivo da recusa</p>' +
        U.opcoes('motivo', MOTIVOS.map(function (m) { return { valor: m, rotulo: m }; }), '') +
        '<div class="u-mt" data-campo-outro hidden>' +
        U.fldTxt('Observação para o cliente', 'obs', '',
          'O que o cliente vai ler no Portal. Seja específico: "não dá" não ajuda ninguém.',
          'u-mt') +
        '</div>' +
        '<p class="u-xs u-t4 u-mt">A devolução continua em ' + D.fmtDataHora(e.currentReturnAt) +
        '. A recusa não muda data nenhuma — ela encerra o pedido.</p>',
      botoes: [
        { rotulo: 'Voltar', tom: 'sil', acao: 'x' },
        { rotulo: 'Confirmar recusa', tom: 'pri', acao: 'confirmar' }
      ],
      aoAbrir: function (bd) {
        corpo = bd;
        escolhido = '';

        var alternar = function () {
          var cxOutro = bd.querySelector('[data-campo-outro]');
          if (cxOutro) cxOutro.hidden = escolhido !== 'OUTRO';
        };

        bd.addEventListener('click', function (ev) {
          var b = ev.target.closest ? ev.target.closest('[data-opcao]') : null;
          if (!b) return;
          Array.prototype.forEach.call(bd.querySelectorAll('[data-opcao]'), function (o) {
            o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
          });
          escolhido = b.getAttribute('data-opcao');
          alternar();
        });
      },
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'confirmar') { fechar(); return; }

        var campos = U.lerCampos(corpo);
        var obs = (campos && campos.obs ? String(campos.obs) : '').replace(/^\s+|\s+$/g, '');

        if (!escolhido) { U.canto('Escolha o motivo da recusa.', 'erro'); return; }
        if (escolhido === 'OUTRO' && !obs) {
          U.canto('Descreva o motivo em "Outro" antes de confirmar.', 'erro');
          return;
        }

        var motivo = escolhido === 'OUTRO'
          ? 'OUTRO — ' + obs
          : escolhido + (obs ? ' — ' + obs : '');

        var res = S.decidirProrrogacao(e.id, 'recusar', motivo);
        if (res.ok === false) { U.canto(res.mensagem, 'erro'); return; }

        fechar();
        escolhido = '';
        corpo = null;
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  /* ==========================================================
     12 · APROVAR
     ----------------------------------------------------------
     Sem "tem certeza?": é a ação esperada, o operador já viu a
     verificação de agenda na própria tela, e um diálogo em cima
     do que a pessoa veio fazer só treina a clicar sem ler.
     Recusar tem formulário porque recusar precisa de motivo — o
     cliente vai ler esse motivo.
     ========================================================== */
  var aprovar = function (e) {
    var res = S.decidirProrrogacao(e.id, 'aprovada');

    if (res.ok === false) {
      U.canto(res.mensagem, 'erro');
      /* Redesenha para a verificação voltar à vista: se não deu,
         o operador precisa ver QUAL compromisso está no caminho,
         não só que não deu. */
      U.desenhar();
      return;
    }
    U.resultado(res);
    U.desenhar();
  };

  /* ==========================================================
     13 · CLIQUES
     ========================================================== */
  cx.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-acao]') : null;
    if (!alvo) return;

    var id = alvo.getAttribute('data-id');
    var e = id ? achar(id) : registro;

    switch (alvo.getAttribute('data-acao')) {
      case 'filtrar':
        U.navegar('#/prorrogacoes' + (alvo.getAttribute('data-f') === 'aguardando'
          ? '' : '?f=' + alvo.getAttribute('data-f')));
        return;

      case 'aba-todas':
        U.navegar('#/prorrogacoes?f=todas');
        return;

      case 'ir-notificacoes':
        U.navegar('#/notificacoes');
        return;

      case 'ir-locacoes':
        U.navegar('#/locacoes');
        return;

      case 'aprovar':
        if (!e) { U.canto('Solicitação não encontrada.', 'erro'); return; }
        if (e.status !== 'pendente') {
          U.canto('Esta solicitação já foi decidida.', 'aviso');
          return;
        }
        aprovar(e);
        return;

      case 'recusar':
        if (!e) { U.canto('Solicitação não encontrada.', 'erro'); return; }
        if (e.status !== 'pendente') {
          U.canto('Esta solicitação já foi decidida.', 'aviso');
          return;
        }
        abrirRecusa(e);
        return;

      default:
        return;
    }
  });
};
