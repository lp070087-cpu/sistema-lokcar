/* ============================================================
   LOK CAR — SISTEMA · telas/financeiro.js
   ------------------------------------------------------------
   §20 do pedido: os quatro números do topo (a receber, recebido
   no mês, atrasado, cauções), a tabela de lançamentos e o
   registro de pagamento.

   O PROBLEMA CENTRAL DESTA TELA
   ------------------------------------------------------------
   Metade dos lançamentos da base NÃO TEM VALOR. Não porque
   falte dado na base, mas porque o valor de verdade ainda não
   existe: a caução depende de uma política que a Lok Car não
   definiu, o adicional "sob consulta" depende de um orçamento,
   e a despesa de oficina depende de alguém ter consultado a
   oficina.

   A saída fácil seria escrever R$ 0,00. Ela está errada por
   dois motivos, e o segundo é o que importa:

     1) R$ 0,00 afirma que o serviço é gratuito, quando o certo
        é dizer que o preço não foi definido;
     2) SOMAR ZERO É CONTAMINAR O TOTAL. Um "a receber" de
        R$ 12.400 que na verdade é R$ 12.400 MAIS três valores
        desconhecidos é uma mentira sobre o caixa da empresa —
        e é a mentira que o dono da locadora usaria para decidir.

   Então nenhuma soma desta tela esconde o que não somou. Cada
   número que exclui lançamentos diz quantos excluiu.

   NADA DE INTEGRAÇÃO DE PAGAMENTO, como o §20 pede: o que esta
   tela faz é anotar que o dinheiro entrou, não movimentá-lo.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.financeiro = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  /* ==========================================================
     1 · O VALOR DE UM LANÇAMENTO
     ----------------------------------------------------------
     `D.valorDoLancamento` devolve `null` quando o valor não
     existe — e `null` NÃO é zero. Toda a tela é construída sobre
     essa distinção, por isso ela fica explícita aqui em vez de
     espalhada em cada `if`.
     ========================================================== */
  var valorDe = function (f) { return D.valorDoLancamento(f); };

  var semValor = function (f) { return valorDe(f) === null; };

  /* Soma que DECLARA o que deixou de fora. */
  var somar = function (lista) {
    var total = 0, comValor = 0, sem = 0;
    lista.forEach(function (f) {
      var v = valorDe(f);
      if (v === null) { sem++; return; }
      total += v;
      comValor++;
    });
    return { total: total, comValor: comValor, semValor: sem };
  };

  /* Texto do resumo. Quando há lançamento sem valor, o número
     vem acompanhado do que ele não inclui — na mesma frase, não
     num rodapé onde ninguém lê. */
  var textoResumo = function (r, singular, plural) {
    var base = D.fmtBRL(r.total);
    if (!r.semValor) return base;
    return base + ' <span class="u-t4">+ ' + r.semValor + ' ' +
           (r.semValor === 1 ? singular : plural) + '</span>';
  };

  /* ==========================================================
     2 · OS QUATRO NÚMEROS (§20)
     ========================================================== */
  var TIPO_ROTULO = {
    receita: 'Receita',
    caucao: 'Caução',
    despesa: 'Despesa',
    multa: 'Multa'
  };

  var doTipo = function (t) {
    return D.LANCAMENTOS.filter(function (f) { return f.tipo === t; });
  };

  /* Receitas e cauções ainda não recebidas. A cação entra no
     "a receber" porque é dinheiro que a locadora vai receber na
     retirada — mas ela É separada no card próprio, porque não é
     faturamento: é valor retido, que volta para o cliente. */
  var aReceber = function () {
    return D.LANCAMENTOS.filter(function (f) {
      var st = D.statusDoLancamento(f);
      return st !== 'pago' && st !== 'cancelado' && f.tipo !== 'despesa';
    });
  };

  var atrasados = function () {
    return D.LANCAMENTOS.filter(function (f) {
      return D.statusDoLancamento(f) === 'atrasado' && f.tipo !== 'despesa';
    });
  };

  /* Recebido NO MÊS: pago cuja data de pagamento cai no mês
     corrente. Um lançamento pago em agosto não é receita de
     setembro, e somá-lo inflaria o mês. */
  var mesDe = function (iso) { return String(iso || '').slice(0, 7); };

  var hoje = new Date(D.HOJE + 'T12:00:00');

  var nomeDoMes = function () {
    return D.MESES[hoje.getMonth()] + ' de ' + hoje.getFullYear();
  };

  var recebidoNoMes = function () {
    var mes = mesDe(D.HOJE);
    return D.LANCAMENTOS.filter(function (f) {
      return f.status === 'pago' && f.pagoEm && mesDe(f.pagoEm) === mes;
    });
  };

  var htmlCards = function () {
    var receber = somar(aReceber());
    var recebido = somar(recebidoNoMes());
    var atraso = somar(atrasados());
    var caucoes = somar(doTipo('caucao'));

    var cartao = function (titulo, valor, nota, tom) {
      return '<div class="kpi">' +
        '<p class="kpi__key">' + esc(titulo) + '</p>' +
        '<p class="kpi__val' + (tom ? ' kpi__val--' + tom : '') + '">' + valor + '</p>' +
        (nota ? '<p class="kpi__nota">' + nota + '</p>' : '') +
        '</div>';
    };

    return '<div class="kpis kpis--4">' +
      cartao('A receber', textoResumo(receber, 'lançamento sem valor', 'lançamentos sem valor'),
        receber.comValor + (receber.comValor === 1 ? ' lançamento somado' : ' lançamentos somados')) +
      cartao('Recebido no mês', textoResumo(recebido, 'pagamento sem valor', 'pagamentos sem valor'),
        'Mês de ' + esc(nomeDoMes())) +
      cartao('Atrasado',
        atraso.comValor ? textoResumo(atraso, 'em atraso', 'em atraso') : D.fmtBRL(0),
        atraso.semValor ? 'Valor de ' + atraso.semValor + ' em atraso ainda a definir'
                        : 'Nada vencido em aberto',
        atraso.comValor ? 'bad' : '') +
      cartao('Cauções', textoResumo(caucoes, 'caução sem valor', 'cauções sem valor'),
        'Valor retido — não é faturamento') +
    '</div>';
  };

  /* ==========================================================
     3 · LISTA
     ========================================================== */
  var ABAS = [
    { id: 'todos',      rotulo: 'Todos',      teste: function () { return true; } },
    { id: 'receber',    rotulo: 'A receber',  teste: function (f) {
        var st = D.statusDoLancamento(f);
        return st !== 'pago' && st !== 'cancelado' && f.tipo !== 'despesa';
      } },
    { id: 'atrasado',   rotulo: 'Atrasados',  teste: function (f) {
        return D.statusDoLancamento(f) === 'atrasado';
      } },
    { id: 'recebido',   rotulo: 'Recebidos',  teste: function (f) { return f.status === 'pago'; } },
    { id: 'receita',    rotulo: 'Receitas',   teste: function (f) { return f.tipo === 'receita'; } },
    { id: 'caucao',     rotulo: 'Cauções',    teste: function (f) { return f.tipo === 'caucao'; } },
    { id: 'despesa',    rotulo: 'Despesas',   teste: function (f) { return f.tipo === 'despesa'; } }
  ];

  var filtroDe = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return ABAS[0];
  };

  var BUSCA = params.q ? String(params.q) : '';

  var normalizar = function (v) {
    var t = String(v === null || v === undefined ? '' : v).toLowerCase();
    return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
  };

  var alvosDe = function (f) {
    var r = f.reserva ? S.reserva(f.reserva) : null;
    var l = r ? S.locacaoDaReserva(r.id) : null;
    var c = r ? S.cliente(r.clienteId) : null;
    return [f.descricao, f.forma, f.id, TIPO_ROTULO[f.tipo] || f.tipo,
            r ? r.codigo : '', l ? l.codigo : '',
            c ? c.nome : '', c ? c.doc : ''].filter(Boolean);
  };

  var combinaBusca = function (f, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;
    var texto = alvosDe(f).map(normalizar).join(' ');
    return termos.every(function (t) { return texto.indexOf(t) !== -1; });
  };

  var ordenar = function (lista) {
    return lista.slice().sort(function (a, b) {
      var pa = STATUS_PESO[D.statusDoLancamento(a)] || 9;
      var pb = STATUS_PESO[D.statusDoLancamento(b)] || 9;
      if (pa !== pb) return pa - pb;
      return D.diffDias(b.vencimento || D.HOJE, a.vencimento || D.HOJE);
    });
  };

  var STATUS_PESO = { atrasado: 0, pendente: 1, pago: 2, cancelado: 3 };

  var filtrar = function (filtro) {
    return ordenar(D.LANCAMENTOS.filter(function (f) {
      if (!filtro.teste(f)) return false;
      return combinaBusca(f, BUSCA);
    }));
  };

  var contar = function (filtro) {
    return D.LANCAMENTOS.filter(filtro.teste).length;
  };

  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist">' + ABAS.map(function (a) {
      return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" data-f="' + a.id + '"' +
             (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
             esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
    }).join('') + '</div>';
  };

  /* A linha de tipo: um PONTO COLORIDO e a palavra. Cor sozinha
     não informa quem não distingue verde de vermelho — e a
     diferença entre receita, caução e despesa é a diferença
     entre dinheiro que entra, dinheiro que é de terceiro e
     dinheiro que sai. */
  var celulaTipo = function (f) {
    return '<span class="fin__tipo fin__tipo--' + esc(f.tipo) + '">' +
           '<i></i>' + esc(TIPO_ROTULO[f.tipo] || f.tipo) + '</span>';
  };

  var celulaValor = function (f) {
    if (semValor(f)) {
      /* Sem valor, e DIZENDO POR QUÊ. "a definir" sozinho deixa
         o operador procurando o campo errado. */
      return '<span class="falta" title="' + esc(motivoSemValor(f)) + '">a definir</span>';
    }
    return '<span class="u-tab">' + D.fmtBRL(valorDe(f)) + '</span>';
  };

  var motivoSemValor = function (f) {
    if (f.tipo === 'caucao') {
      return 'O valor da caução é uma política da locadora e ainda não foi configurado.';
    }
    if (f.tipo === 'multa') {
      return 'O valor da multa por atraso é uma política da locadora e ainda não foi configurada.';
    }
    if (f.tipo === 'despesa') {
      return 'A despesa é de manutenção e o custo ainda não foi lançado pela oficina.';
    }
    var r = f.reserva ? S.reserva(f.reserva) : null;
    if (r && D.preco(r).incompleto) {
      return 'A reserva de origem tem item sob consulta: a conta não fecha.';
    }
    return 'O lançamento não tem valor definido.';
  };

  var celulaOrigem = function (f) {
    if (!f.reserva) {
      return '<span class="tbl__dim">sem reserva</span>';
    }
    var r = S.reserva(f.reserva);
    if (!r) return '<span class="falta">reserva não encontrada</span>';
    var l = S.locacaoDaReserva(r.id);

    return '<a class="ab" href="#/reservas/' + r.id + '" data-acao="ir" data-para="#/reservas/' + r.id + '">' +
      esc(r.codigo) + '</a>' +
      (l ? '<span class="tbl__dim">locação <span class="mono">' + esc(l.codigo) + '</span></span>'
         : '<span class="tbl__dim">sem locação iniciada</span>');
  };

  var celulaCliente = function (f) {
    var r = f.reserva ? S.reserva(f.reserva) : null;
    var c = r ? S.cliente(r.clienteId) : null;
    if (!c) return '<span class="tbl__dim">—</span>';
    return '<a class="ab" href="#/clientes/' + c.id + '" data-acao="ir" data-para="#/clientes/' + c.id + '">' +
      esc(c.nome) + '</a>';
  };

  var htmlLinha = function (f) {
    var st = D.statusDoLancamento(f);
    var podePagar = st !== 'pago' && st !== 'cancelado' && !semValor(f);

    return '<tr data-abre="' + f.id + '">' +
      '<td>' + celulaCliente(f) + '</td>' +
      '<td>' + celulaOrigem(f) + '</td>' +
      '<td><span class="u-b">' + esc(f.descricao) + '</span>' + celulaTipo(f) + '</td>' +
      '<td>' + celulaValor(f) + '</td>' +
      '<td><span class="u-tab">' + D.fmtData(f.vencimento) + '</span>' +
        (st === 'atrasado'
          ? '<span class="tbl__dim">' + D.diffDias(f.vencimento, D.HOJE) + ' dia(s) de atraso</span>'
          : (f.pagoEm ? '<span class="tbl__dim">pago em ' + D.fmtData(f.pagoEm) + '</span>' : '')) +
      '</td>' +
      '<td>' + U.cracha(D.STATUS_FINANCEIRO, st) +
        (f.forma ? '<span class="tbl__dim">' + esc(f.forma) + '</span>' : '') + '</td>' +
      '<td><div class="tbl__acts">' +
        '<span class="ab' + (podePagar ? ' ab--pri' : '') + '" data-acao="pagar" data-id="' + f.id + '"' +
        (podePagar ? '' : ' aria-disabled="true" title="' + esc(motivoNaoPagavel(f, st)) + '"') +
        '>' + (st === 'pago' ? 'Pago' : 'Registrar pagamento') + '</span>' +
      '</div></td>' +
    '</tr>';
  };

  var motivoNaoPagavel = function (f, st) {
    if (st === 'pago') return 'Este lançamento já está pago.';
    if (st === 'cancelado') return 'Este lançamento está cancelado.';
    return motivoSemValor(f) + ' Sem valor não há o que registrar — o sistema se recusa a ' +
           'confirmar o recebimento de uma quantia que ninguém definiu.';
  };

  var htmlTabela = function (lista) {
    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Cliente</th><th>Reserva / Locação</th><th>Descrição</th>' +
        '<th>Valor</th><th>Vencimento</th><th>Situação</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(htmlLinha).join('') + '</tbody>' +
      '</table></div>';
  };

  var htmlVazio = function () {
    return U.vazio(
      BUSCA ? 'Nenhum lançamento encontrado' : 'Nenhum lançamento nesta situação',
      BUSCA
        ? 'Nenhum lançamento casa com “' + BUSCA + '”. A busca olha descrição, tipo, forma de ' +
          'recebimento, código da reserva e nome do cliente.'
        : 'Nenhum lançamento está nesta situação.',
      BUSCA ? U.botao('Limpar busca', 'limpar', 'out') : ''
    );
  };

  var htmlResumo = function (lista) {
    var t = somar(lista);
    return '<div class="fin__resumo">' +
      '<span>Total nesta visão: <b>' + D.fmtBRL(t.total) + '</b></span>' +
      (t.semValor
        ? '<span class="u-warn">' + t.semValor +
          (t.semValor === 1 ? ' lançamento sem valor definido' : ' lançamentos sem valor definido') +
          ' — <b>não somado</b></span>'
        : '<span>Todos os lançamentos desta visão têm valor definido</span>') +
      '<span>' + lista.length + (lista.length === 1 ? ' lançamento' : ' lançamentos') + '</span>' +
    '</div>';
  };

  var htmlLista = function (filtro, lista) {
    return '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar lançamentos por situação">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'lançamento' : 'lançamentos') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Cliente, reserva, descrição ou tipo" ' +
             'aria-label="Buscar lançamento por cliente, reserva, descrição ou tipo" />' +
      '    </div>' +
           (BUSCA ? '<button class="ab" type="button" data-acao="limpar">Limpar</button>' : '') +
      '  </div>' +
      '</div>' +
      '<div class="card" data-slot="lista">' +
        (lista.length ? htmlTabela(lista) + htmlResumo(lista) : htmlVazio()) +
      '</div>';
  };

  /* ==========================================================
     4 · REGISTRAR PAGAMENTO
     ----------------------------------------------------------
     O diálogo PEDE a forma de recebimento, mas o valor não é
     digitável de propósito: quem define quanto é devido é o
     lançamento, não quem digita. Um campo de valor aqui viraria
     a porta por onde um número inventado entraria no caixa.

     `registrarPagamento` recusa lançamento sem valor. Quando
     isso acontece, o aviso tem de EXPLICAR a recusa — o
     operador acabou de clicar num botão que parecia liberado.
     ========================================================== */
  var abrirPagamento = function (f) {
    var v = valorDe(f);
    var r = f.reserva ? S.reserva(f.reserva) : null;

    U.abrirModal({
      titulo: 'Registrar pagamento',
      sub: f.descricao,
      corpo:
        '<dl class="ficha u-mb">' +
          '<div><dt>Valor</dt><dd class="u-tab"><b>' +
            (v === null ? '<span class="falta">a definir</span>' : D.fmtBRL(v)) + '</b></dd></div>' +
          '<div><dt>Vencimento</dt><dd class="u-tab">' +
            D.fmtData(f.vencimento) + '</dd></div>' +
          '<div><dt>Cliente</dt><dd>' +
            (r ? esc(U.nomeCliente(r.clienteId)) : '<span class="u-t4">sem reserva de origem</span>') +
            '</dd></div>' +
          '<div><dt>Origem</dt><dd>' +
            (r ? '<span class="mono">' + esc(r.codigo) + '</span>'
               : '<span class="u-t4">' + esc(f.descricao) + '</span>') +
            '</dd></div>' +
        '</dl>' +
        /* A primeira opção é vazia e de propósito. Um `<select>`
           sem opção vazia abre com PIX já escolhido, e "PIX" é
           uma AFIRMAÇÃO sobre como o dinheiro entrou — a mesma
           classe de invenção que esta base inteira evita. Com a
           opção vazia o campo abre sem resposta e o sistema
           pergunta. */
        U.fldSel('Forma de recebimento', 'forma', [
          { valor: '', rotulo: 'Selecione a forma de recebimento' },
          { valor: 'PIX', rotulo: 'PIX' },
          { valor: 'Crédito', rotulo: 'Cartão de crédito' },
          { valor: 'Débito', rotulo: 'Cartão de débito' },
          { valor: 'Dinheiro', rotulo: 'Dinheiro' },
          { valor: 'Transferência', rotulo: 'Transferência' }
        ], '') +
        '<p class="u-xs u-t4 u-mt">O sistema registra que o valor entrou. Ele <b>não movimenta ' +
        'dinheiro</b>: não há integração com meio de pagamento nesta fase — o que existe é a anotação ' +
        'do recebimento para o caixa ficar em dia.</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Confirmar recebimento', tom: 'pri', acao: 'pagar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'pagar') return;

        var c = U.lerCampos();
        if (!c.forma) {
          U.canto('Escolha a forma de recebimento.', 'aviso');
          return;
        }

        var res = S.registrarPagamento(f.id, c.forma);
        fechar();

        if (res.ok === false) {
          /* A recusa tem explicação, não só um erro. */
          U.canto(res.mensagem + ' Enquanto a política não estiver em CONFIGURAÇÕES › CONTRATOS, ' +
            'este lançamento fica fora do total para não inflar o caixa com um número inventado.',
            'erro');
          return;
        }

        U.resultado(res);
        U.desenhar();
      }
    });
  };

  /* ==========================================================
     5 · A TELA
     ========================================================== */
  var htmlTela = function () {
    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);

    return U.pageHead('Financeiro',
      'O caixa da locadora: o que está a receber, o que já entrou no mês, o que venceu em aberto e ' +
      'as cauções retidas. Lançamento sem valor aparece como <span class="falta">a definir</span> ' +
      'e fica fora dos totais — um total que soma zero no lugar de um preço desconhecido mente sobre o caixa.',
      U.botao('Exportar', 'exportar', 'out')) +
      htmlCards() +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));

    slot.innerHTML = lista.length
      ? htmlTabela(lista) + htmlResumo(lista)
      : htmlVazio();

    /* O contador e o botão "Limpar" moram FORA do slot da lista —
       por isso são atualizados à mão aqui em vez de redesenhados.
       Redesenhar a tela inteira a cada tecla digitada devolveria o
       foco ao começo do campo e a busca ficaria impossível. */
    if (cont) cont.textContent = lista.length;

    var dir = cx.querySelector('.filtros__dir');
    var botaoLimpar = dir ? dir.querySelector('[data-acao="limpar"]') : null;
    if (dir && BUSCA && !botaoLimpar) {
      var bt = document.createElement('button');
      bt.className = 'ab';
      bt.type = 'button';
      bt.setAttribute('data-acao', 'limpar');
      bt.textContent = 'Limpar';
      dir.appendChild(bt);
    } else if (botaoLimpar && !BUSCA) {
      botaoLimpar.parentNode.removeChild(botaoLimpar);
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
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (link) {
        var h = link.getAttribute('href');
        if (h && h.charAt(0) === '#') {
          if (ev.preventDefault) ev.preventDefault();
          U.navegar(h);
        }
        return;
      }

      var linha = ev.target.closest ? ev.target.closest('tr[data-abre]') : null;
      if (linha) {
        /* A linha abre o lançamento. Não existe tela de detalhe de
           lançamento no pedido, então abrir a linha leva ao que o
           lançamento descreve: a reserva de origem. */
        var f = S.lancamento(linha.getAttribute('data-abre'));
        if (f && f.reserva) {
          if (ev.preventDefault) ev.preventDefault();
          U.navegar('#/reservas/' + f.reserva);
        } else if (f) {
          U.canto(f.descricao + ' — ' + (semValor(f)
            ? 'valor a definir: ' + motivoSemValor(f)
            : D.fmtBRL(valorDe(f))), 'aviso');
        }
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');

    if (alvo.getAttribute('aria-disabled') === 'true') {
      U.canto(alvo.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'filtrar': {
        var f = alvo.getAttribute('data-f');
        U.navegar('#/financeiro' + (!f || f === 'todos' ? '' : '?f=' + f));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'pagar': {
        var lanc = id ? S.lancamento(id) : null;
        if (!lanc) { U.canto('Este lançamento não está mais na base.', 'aviso'); return; }
        abrirPagamento(lanc);
        return;
      }

      case 'ir': {
        var para = alvo.getAttribute('data-para') || alvo.getAttribute('href');
        if (para) U.navegar(para);
        return;
      }

      case 'exportar':
        U.canto('A exportação em planilha depende de um gerador de arquivo no backend. ' +
          'Disponível após integração do backend.', 'aviso');
        return;

      default:
        U.canto('Disponível após integração do backend.', 'aviso');
    }
  });
};
