/* ============================================================
   LOK CAR — SISTEMA · telas/calendario.js
   ------------------------------------------------------------
   §11 do pedido: "uma linha por veículo mostrando reservas e
   locações ao longo dos dias". Exemplo dado: PORSCHE | [
   reservado ][ locado ].

   QUATRO DECISÕES QUE VALEM EXPLICAÇÃO
   ------------------------------------------------------------
   1) A BARRA É POSICIONADA POR `grid-column`, NÃO POR PIXEL. Cada
      compromisso ocupa `<primeiro dia> / span <dias>`. É o que faz
      a barra acompanhar a largura da tela sem medir nada — e é o
      que o CSS desta tela já esperava (`.cal__fundo` usa
      `repeat(var(--dias), ...)`).

   2) BARRA LONGA É MONTADA EM TRECHOS, UM POR SEQUÊNCIA DE DIAS
      ÚTEIS. O calendário dá ao sábado e ao domingo a mesma largura
      dos outros dias (é um calendário, não uma escala de tempo),
      então uma reserva de sexta a terça desenhada de uma peça só
      passaria por cima do fim de semana como se ele fosse mais dois
      dias de locação. Partindo a barra no fim de semana, cada
      trecho cai na largura exata dos dias que ocupa e o vão
      aparece — sem que o compromisso deixe de ocupar sábado e
      domingo, porque `grid-column` continua contando todos os
      dias. Os trechos se emendam por dentro (canto reto e divisa
      apagada), então a leitura continua sendo "uma barra só".
      Custa quatro regras escritas direto no elemento e economiza
      uma classe nova e um desenho mentiroso.

   3) O PERÍODO MORA NO ENDEREÇO (`?de=2026-09-15&dias=21`). Sem
      isso, "avançar três semanas" não sobrevive a um F5, não
      sobrevive ao botão voltar e não pode ser mandado por link
      para outra pessoa. É a mesma razão pela qual o filtro da
      lista de reservas mora no endereço.

   4) CONFLITO DE AGENDA É A RAZÃO DE A TELA EXISTIR. Qualquer
      calendário mostra barras; o que este mostra a mais é o
      choque — dois compromissos no mesmo carro em dias que se
      cruzam. E ele aparece ANTES do calendário, porque é o único
      item da tela que cobra decisão hoje.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.calendario = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var esc = U.esc;
  var params = (ctx && ctx.params) || {};

  /* ==========================================================
     1 · A JANELA DE DIAS
     ----------------------------------------------------------
     Padrão: 21 dias começando três dias atrás. Começar no passado
     é deliberado — sem os três dias anteriores, o carro que saiu
     ontem apareceria com a barra cortada na borda esquerda e
     pareceria ter ficado livre.
     ========================================================== */
  var DIAS_PADRAO = 21;
  var DIAS_PERMITIDOS = [14, 21, 28];
  var RECUO_PADRAO = -3;

  var INICIO = (params.de && /^\d{4}-\d{2}-\d{2}$/.test(params.de))
    ? params.de
    : D.D(RECUO_PADRAO);

  var DIAS = (function () {
    var n = Number(params.dias);
    return DIAS_PERMITIDOS.indexOf(n) === -1 ? DIAS_PADRAO : n;
  })();

  var RECUO = D.diffDias(D.HOJE, INICIO);

  /* A lista de dias é montada uma vez, para o cabeçalho e a grade
     não calcularem datas em separado e saírem de sincronia. */
  var LISTA_DIAS = (function () {
    var l = [];
    for (var i = 0; i < DIAS; i++) {
      var iso = D.D(RECUO + i);
      var d = D.emData(iso);
      l.push({
        iso: iso,
        dia: d ? d.getDate() : '',
        mes: d ? D.MESES_CURTO[d.getMonth()] : '',
        semana: d ? D.DIAS_SEMANA[d.getDay()] : '',
        fds: d ? (d.getDay() === 0 || d.getDay() === 6) : false,
        hoje: iso === D.HOJE
      });
    }
    return l;
  })();

  var rotulo = function (iso) {
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return Number(p[2]) + ' de ' + D.MESES[Number(p[1]) - 1] + ' de ' + p[0];
  };

  var FIM = LISTA_DIAS.length ? LISTA_DIAS[LISTA_DIAS.length - 1].iso : INICIO;
  var PERIODO = rotulo(INICIO) + ' a ' + rotulo(FIM);

  var agenda = D.agendaDaFrota(INICIO, DIAS);

  /* ==========================================================
     2 · RECORTE POR VEÍCULO
     ----------------------------------------------------------
     `#/calendario/<id>` é a rota que a ficha do carro e o aviso
     de conflito usam. O identificador chega em `ctx.alvo`, não em
     `params` — foi assim que a casca foi escrita.

     O recorte é validado antes de tudo: um endereço com veículo
     inexistente mostraria uma tela vazia sem dizer por quê.
     ========================================================== */
  var ALVO = ctx && ctx.alvo ? String(ctx.alvo) : null;
  var veiculoFoco = ALVO ? S.veiculo(ALVO) : null;
  if (!veiculoFoco) ALVO = null;

  var linhas = agenda.linhas.filter(function (l) {
    return !ALVO || l.veiculo.id === ALVO;
  });

  /* ==========================================================
     3 · CHOQUE DE AGENDA
     ----------------------------------------------------------
     `D.conflitos()` olha a agenda inteira. Aqui só interessa o
     que cai no período que está na frente do operador — mas o que
     ficou de fora NÃO pode desaparecer calado, senão a tela
     afirmaria "nenhum choque" enquanto o sistema conhece um. A
     contagem do que sobrou fora vai escrita no texto.
     ========================================================== */
  var TODOS = ALVO
    ? D.conflitos().filter(function (c) { return c.veiculoId === ALVO; })
    : D.conflitos();

  /* DOIS COMPROMISSOS SE CRUZAM QUANDO O PRIMEIRO COMEÇA ANTES DE O
     ÚLTIMO TERMINAR — a mesma comparação inclusiva de `D.cruzam`.
     Quem está na frente do operador é o choque cujo intervalo
     [a.de, b.ate] encosta na janela [INICIO, FIM]:

       a.de  <= FIM      →  diffDias(FIM,   c.a.de) <= 0
       b.ate >= INICIO   →  diffDias(INICIO, c.b.ate) >= 0

     `diffDias(x, y)` é (y − x). As duas linhas têm sinais opostos, e
     é aí que se erra: basta trocar um deles para o teste nunca dar
     verdadeiro e a tela anunciar "nenhum choque de agenda" com três
     choques dentro do período, desenhando as barras sobrepostas sem
     uma palavra de explicação.

     Foi o que aconteceu — a primeira linha estava invertida, e o
     aviso passou a afirmar o contrário do que a grade mostrava. Uma
     conta escrita ao contrário não é a mesma coisa que a conta certa:
     uma é a tela funcionando, a outra é a tela mentindo com
     segurança. */
  var naJanela = function (c) {
    return D.diffDias(FIM, c.a.de) <= 0 && D.diffDias(INICIO, c.b.ate) >= 0;
  };

  var CONFLITOS = TODOS.filter(naJanela);
  var FORA = TODOS.length - CONFLITOS.length;

  var AQUI = ALVO ? '#/calendario/' + ALVO : '#/calendario';

  /* ==========================================================
     4 · GEOMETRIA DE UMA BARRA
     ========================================================== */
  var coluna = function (iso) { return D.diffDias(INICIO, iso); };

  /* Recorta o compromisso na janela. `de` e `ate` são dias
     OCUPADOS, por isso o `+1` na contagem. */
  var posicao = function (f) {
    var a = coluna(f.de);
    var b = coluna(f.ate);
    var i = Math.max(0, a);
    var j = Math.min(DIAS - 1, b);
    if (j < 0 || i > DIAS - 1) return null;
    return { i: i, n: j - i + 1, esquerda: a < 0, direita: b > DIAS - 1 };
  };

  /* Parte a barra onde o calendário tem fim de semana. Cada trecho
     sabe quantos dias ocupa, e é esse número que vira o `span` do
     `grid-column`. */
  var trechos = function (p) {
    var saida = [];
    var k = 0;

    while (k < p.n) {
      var d = LISTA_DIAS[p.i + k];
      var fds = d ? d.fds : false;
      var n = 1;

      while (k + n < p.n) {
        var prox = LISTA_DIAS[p.i + k + n];
        if (!prox || prox.fds !== fds) break;
        n++;
      }

      saida.push({
        col: p.i + k,
        n: n,
        primeiro: k === 0,
        ultimo: k + n === p.n,
        so: p.n === n,
        cortaEsq: p.esquerda && k === 0,
        cortaDir: p.direita && k + n === p.n
      });

      k += n;
    }

    return saida;
  };

  var CLASSE = {
    'reserva:nova':       'cal__faixa--reserva-nova',
    'reserva:aguardando': 'cal__faixa--reserva-aguardando',
    'reserva:confirmada': 'cal__faixa--reserva-confirmada',
    'reserva:contrato':   'cal__faixa--reserva-contrato',
    'reserva:pronta':     'cal__faixa--reserva-pronta',
    'reserva:andamento':  'cal__faixa--reserva-andamento',
    'locacao:andamento':  'cal__faixa--locacao-andamento',
    'locacao:devolucao':  'cal__faixa--locacao-devolucao',
    'locacao:atrasada':   'cal__faixa--locacao-atrasada',
    'locacao:aguardando': 'cal__faixa--locacao-aguardando',
    'manutencao:agendada':  'cal__faixa--manutencao',
    'manutencao:andamento': 'cal__faixa--manutencao',
    'manutencao:bloqueada': 'cal__faixa--manutencao'
  };

  var ROTULO = function (f) {
    if (f.tipo === 'manutencao') return f.alerta || 'Manutenção';
    return f.codigo;
  };

  var rotaDe = function (f) {
    if (f.tipo === 'reserva') return '#/reservas/' + f.id;
    if (f.tipo === 'locacao') return '#/locacoes/' + f.id;
    /* O serviço vai pelo ID, e não pela lista de manutenções. Uma
       barra que diz "Revisão próxima" e leva para a lista obriga o
       operador a procurar de novo o que ele já achou. */
    return '#/manutencoes/' + f.id;
  };

  /* O que o ponteiro diz ao parar sobre a barra. A barra é
     estreita e só cabe o código; cliente e datas completas
     precisam existir em algum lugar, e o `title` é o único que
     não custa altura. */
  var dica = function (f, v) {
    var oQue = f.tipo === 'reserva' ? 'Reserva'
             : (f.tipo === 'locacao' ? 'Locação' : 'Manutenção');
    var quem = f.tipo === 'manutencao'
      ? (f.alerta || 'Serviço na oficina')
      : (f.clienteId ? U.nomeCliente(f.clienteId) : 'Cliente não informado');

    return oQue + ' ' + f.codigo + ' · ' + v.modelo + ' ' + v.placa + '\n' +
           quem + '\n' + D.fmtData(f.de) + ' → ' + D.fmtData(f.ate) +
           (f.atraso
             ? '\n' + f.atraso + (f.atraso === 1 ? ' dia de atraso' : ' dias de atraso')
             : '');
  };

  var faixa = function (f, v) {
    var p = posicao(f);
    if (!p) return '';

    var cls = 'cal__faixa ' + (CLASSE[f.tipo + ':' + f.status] || 'cal__faixa--reserva-confirmada');
    var titulo = esc(dica(f, v));
    var href = rotaDe(f);

    return trechos(p).map(function (t) {
      var regras = 'grid-column:' + (t.col + 1) + ' / span ' + t.n;

      /* Emenda interna: canto reto e a divisa apagada, para os
         trechos lerem como uma barra só. */
      if (t.so) regras += ';border-radius:4px';
      else if (t.primeiro) regras += ';border-radius:4px 0 0 4px';
      else if (t.ultimo) regras += ';border-radius:0 4px 4px 0';
      else regras += ';border-radius:0';
      if (!t.primeiro) regras += ';border-left-color:transparent';

      /* Um dia de largura não comporta o respiro lateral: sem
         isto o código do registro sai cortado na primeira letra. */
      if (t.n <= 2) regras += ';padding:0;justify-content:center';

      return '<a class="' + cls + '" style="' + regras + '" href="' + href + '" ' +
        'data-acao="ir" aria-label="' + titulo + '" title="' + titulo + '">' +
        (t.cortaEsq ? '<span aria-hidden="true">‹</span>' : '') +
        '<span class="cal__faixa-t">' + esc(ROTULO(f)) + '</span>' +
        (t.cortaDir ? '<span aria-hidden="true">›</span>' : '') +
        '</a>';
    }).join('');
  };

  var FUNDO = function () {
    return LISTA_DIAS.map(function (d) {
      var cls = d.hoje ? 'cal__d--hoje' : (d.fds ? 'cal__d--fds' : '');
      return '<i class="' + cls + '"></i>';
    }).join('');
  };

  var trilha = function (l) {
    return '<div class="cal__trilha" style="--dias:' + DIAS + '">' +
      '<div class="cal__fundo" aria-hidden="true">' + FUNDO() + '</div>' +
      l.faixas.map(function (f) { return faixa(f, l.veiculo); }).join('') +
      '</div>';
  };

  /* ==========================================================
     5 · GRADE
     ========================================================== */
  var LARGURA_NOME = 'minmax(172px, 224px)';

  var cabecalho = function () {
    return '<div class="cal__hd" style="grid-template-columns:' + LARGURA_NOME +
      ' repeat(' + DIAS + ', minmax(34px, 1fr))">' +
      '<div class="cal__hd-vazio">Veículo</div>' +
      LISTA_DIAS.map(function (d) {
        return '<div class="cal__d' + (d.hoje ? ' cal__d--hoje' : '') +
          (d.fds ? ' cal__d--fds' : '') + '"' +
          (d.hoje ? ' title="Hoje"' : '') + '>' +
          '<span>' + esc(d.semana) + '</span>' +
          '<b>' + d.dia + '</b>' +
          '<span>' + esc(d.mes) + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  };

  /* Frota parada primeiro. A ordem de `agendaDaFrota` é a ordem de
     cadastro, que não diz nada a quem lê um calendário. */
  var PESO = { manutencao: 0, indisponivel: 1, locado: 2, reservado: 3, disponivel: 4 };

  var ORDENADAS = linhas.slice().sort(function (a, b) {
    if (PESO[a.status] !== PESO[b.status]) return PESO[a.status] - PESO[b.status];
    return a.veiculo.placa < b.veiculo.placa ? -1 : 1;
  });

  var LIVRES = ORDENADAS.filter(function (l) { return !l.faixas.length; }).length;

  /* A legenda ensina COR. Não lista os treze status — isso seria uma
     segunda tabela. Lista as situações que o operador precisa
     distinguir de longe. */
  var LEGENDA = [
    { cls: 'cal__faixa--reserva-nova',       txt: 'Reserva nova, sem confirmação' },
    { cls: 'cal__faixa--reserva-confirmada', txt: 'Reserva confirmada' },
    { cls: 'cal__faixa--reserva-pronta',     txt: 'Reserva pronta para retirada' },
    { cls: 'cal__faixa--locacao-andamento',  txt: 'Locação em andamento' },
    { cls: 'cal__faixa--locacao-atrasada',   txt: 'Devolução atrasada' },
    { cls: 'cal__faixa--manutencao',         txt: 'Na oficina (hachurado)' }
  ];

  var htmlGrade = function () {
    if (!ORDENADAS.length) {
      return U.vazio('Nenhum veículo para mostrar',
        ALVO ? 'O veículo deste endereço não está na frota.'
             : 'A frota está vazia nesta demonstração.');
    }

    return '<section class="cal">' +
      '<div class="cal__rolagem">' +
      '<div class="cal__grade">' +
        cabecalho() +
        ORDENADAS.map(function (l) {
          var v = l.veiculo;
          var quantos = l.faixas.length;

          return '<div class="cal__linha" style="grid-template-columns:' + LARGURA_NOME +
            ' minmax(0, 1fr)">' +
            '<a class="cal__nome" href="#/frota/' + v.id + '" data-acao="ir" title="' +
              esc(v.modelo + ' · ' + v.placa + ' · ' +
                  (quantos === 0
                    ? 'nenhum compromisso na janela'
                    : quantos + (quantos === 1 ? ' compromisso' : ' compromissos'))) + '">' +
              U.crachaVeiculo(v) +
              '<span style="min-width:0">' +
                '<b>' + esc(v.modelo) + '</b>' +
                '<span>' + esc(v.placa) + '</span>' +
              '</span>' +
            '</a>' +
            trilha(l) +
            '</div>';
        }).join('') +
      '</div>' +
      '</div>' +
      '<div class="cal__legenda">' +
        LEGENDA.map(function (l) {
          return '<span><i class="' + l.cls + '"></i>' + esc(l.txt) + '</span>';
        }).join('') +
        '<span style="margin-left:auto">Sábado e domingo contam como dia ocupado — ' +
        'a barra só parte ali para não medir o fim de semana como dois dias de locação.</span>' +
      '</div>' +
      '</section>';
  };

  /* ==========================================================
     6 · NAVEGAÇÃO DE PERÍODO
     ----------------------------------------------------------
     Anda três semanas por clique, e não sete dias: um deslocamento
     menor que a largura de uma barra faz o operador clicar quatro
     vezes, ver a mesma coisa e concluir que o botão travou.
     ========================================================== */
  var query = function (de, dias) {
    var q = [];
    if (de !== D.D(RECUO_PADRAO)) q.push('de=' + de);
    if (dias !== DIAS_PADRAO) q.push('dias=' + dias);
    return q.length ? '?' + q.join('&') : '';
  };

  /* A janela e o recorte por veículo são escolhas independentes.
     Sem manter o recorte aqui, quem abrisse `#/calendario/v07` para
     ver a agenda de um carro e clicasse em "Três semanas depois"
     cairia na frota inteira, sem ter pedido. */
  var rotaCom = function (de, dias) {
    return AQUI + query(de, dias);
  };

  /* A mesma janela, SEM o recorte. É o que o botão "ver todos os
     carros" precisa e é onde é fácil errar: devolver `rotaCom`
     levaria de `#/calendario/v07` para `#/calendario/v07` — um
     botão que promete mostrar a frota inteira e não sai do lugar. */
  var rotaSemAlvo = function (de, dias) {
    return '#/calendario' + query(de, dias);
  };

  var htmlNav = function () {
    return '<div class="cal__nav u-mb">' +
      U.botao('‹ Três semanas antes', 'ir-periodo', 'out',
        { de: D.D(RECUO - 21), dias: DIAS }) +
      U.botao('A partir de hoje', 'ir-hoje', 'out') +
      U.botao('Três semanas depois ›', 'ir-periodo', 'out',
        { de: D.D(RECUO + 21), dias: DIAS }) +
      '<b>' + esc(PERIODO) + '</b>' +
      '<div class="opcoes" style="margin-left:auto">' +
        DIAS_PERMITIDOS.map(function (n) {
          return '<button class="opcoes__b" type="button" data-acao="ir-dias" data-dias="' +
            n + '"' + (n === DIAS ? ' aria-pressed="true"' : '') + '>' + n + ' dias</button>';
        }).join('') +
      '</div>' +
      '</div>';
  };

  /* ==========================================================
     7 · CHOQUE DE AGENDA
     ----------------------------------------------------------
     Fica ACIMA do calendário. É o único item da tela que cobra
     decisão; o resto é consulta. Abaixo de onze fileiras ninguém
     rolaria até lá para descobrir que havia um problema.
     ========================================================== */
  var htmlConflitos = function () {
    if (!CONFLITOS.length) {
      return '<div class="aviso aviso--ok u-mb">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>' +
        '<span>Nenhum choque de agenda' + (ALVO ? ' neste veículo' : '') +
        ' no período de ' + esc(PERIODO) + '. Nenhuma reserva, locação ou manutenção ocupa ' +
        'um carro em dias que se cruzam.' +
        (FORA
          ? ' <b>' + FORA + '</b> ' + (FORA === 1 ? 'choque existe' : 'choques existem') +
            ' fora deste período — mude o período para alcançá-lo' +
            (ALVO ? ', ou abra a frota inteira.' : '.')
          : '') +
        '</span></div>';
    }

    var itens = CONFLITOS.map(function (c) {
      var v = S.veiculo(c.veiculoId);
      var nome = v ? v.modelo + ' · ' + v.placa : 'Veículo';
      var daFrota = c.b.tipo === 'frota';

      /* O NOME DO COMPROMISSO MUDA COM O TIPO. O aviso já falou de
         manutenção outras vezes e chamou a revisão de "reserva",
         porque o rótulo estava escrito à mão em vez de sair do
         dado. */
      var comoChamar = function (t) {
        if (t === 'reserva') return 'a reserva';
        if (t === 'locacao') return 'a locação';
        if (t === 'manutencao') return 'a manutenção';
        return 'o serviço';
      };

      var descricao = function (x) {
        return esc(x.codigo) + ' (' + D.fmtData(x.de) + ' → ' + D.fmtData(x.ate) + ')';
      };

      var texto = daFrota
        ? 'O carro está fora de circulação (' +
          esc(D.acharStatus(D.STATUS_FROTA, c.b.status).rotulo.toLowerCase()) +
          '), mas tem <b>' + esc(c.a.codigo) + '</b> marcado de ' +
          D.fmtData(c.a.de) + ' a ' + D.fmtData(c.a.ate) + '.'
        : (c.a.tipo === 'manutencao' || c.b.tipo === 'manutencao')
          ? (function () {
              var servico = c.a.tipo === 'manutencao' ? c.a : c.b;
              var cliente = servico === c.a ? c.b : c.a;
              return 'O carro está na oficina (' + esc(servico.codigo) + ') e tem ' +
                '<b>' + esc(cliente.codigo) + '</b> marcado para o mesmo período. ' +
                'A oficina e ' + comoChamar(cliente.tipo) + ' disputam o mesmo carro: ' +
                'um dos dois tem de sair do dia.';
            })()
          : '<b>' + esc(c.a.codigo) + '</b> (' + D.fmtData(c.a.de) + ' → ' +
            D.fmtData(c.a.ate) + ') e <b>' + esc(c.b.codigo) + '</b> (' +
            D.fmtData(c.b.de) + ' → ' + D.fmtData(c.b.ate) + ') ocupam o mesmo carro em ' +
            'dias que se cruzam.';

      return '<li class="hist__i">' +
        '<span class="hist__q">' + D.fmtDataCurta(c.a.de) + '</span>' +
        '<span class="hist__m"><span class="hist__p hist__p--locacao"></span></span>' +
        '<span class="hist__t">' +
          '<b>' + esc(nome) + '</b>' +
          '<span>' + texto + '</span>' +
          '<span class="u-xs u-t4">' + descricao(c.a) + ' · ' + descricao(c.b) + '</span>' +
          '<span class="u-flex u-wrap u-mt">' +
            U.botao('Abrir ' + comoChamar(c.a.tipo), 'ir-para', 'out', { para: rotaDe(c.a) }) +
            (c.b.tipo === 'frota'
              ? U.botao('Ver o motivo do bloqueio', 'ir-frota', 'out', { id: c.veiculoId })
              : U.botao('Abrir ' + comoChamar(c.b.tipo), 'ir-para', 'out', { para: rotaDe(c.b) })) +
            U.botao('Ver a ficha do carro', 'ir-frota', 'sil', { id: c.veiculoId }) +
          '</span>' +
        '</span>' +
        '</li>';
    }).join('');

    return '<div class="card u-mb">' +
      '<div class="card__head"><div>' +
        '<p class="card__title">' + CONFLITOS.length +
          (CONFLITOS.length === 1 ? ' choque de agenda' : ' choques de agenda') + '</p>' +
        '<p class="card__sub">Dois compromissos no mesmo carro em dias que se cruzam. ' +
        'O sistema avisa em vez de decidir sozinho — uma devolução pela manhã e uma retirada ' +
        'à tarde no mesmo dia contam como o dia inteiro comprometido.</p>' +
      '</div></div>' +
      '<ul class="hist" style="padding:1.15rem 1.3rem 0.2rem">' + itens + '</ul>' +
      '</div>';
  };

  /* ==========================================================
     8 · HOJE, POR CARRO
     ----------------------------------------------------------
     A leitura que o calendário não dá: a grade mostra a mancha da
     janela, não a lista de tarefas do balcão. Um carro pode ter
     barra colorida a janela inteira e continuar sem nada para
     fazer hoje.
     ========================================================== */
  var ICO = {
    retirada:  'M4 12h13M13 7l5 5-5 5M4 19h6',
    devolucao: 'M20 12H7M11 7l-5 5 5 5M20 5h-6',
    vistoria:  'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z'
  };

  var NOME = { retirada: 'Retirada', devolucao: 'Devolução', vistoria: 'Vistoria' };

  var htmlHoje = function () {
    var lista = D.paradasHoje();
    if (ALVO) {
      lista = lista.filter(function (p) { return p.veiculo && p.veiculo.id === ALVO; });
    }

    if (!lista.length) {
      return '<div class="pend__zero">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
        '<b>Nada marcado para hoje</b>' +
        '<span>Nenhuma retirada, devolução ou vistoria' +
        (ALVO ? ' deste carro' : '') + ' aguardando o balcão hoje.</span>' +
        '</div>';
    }

    return '<div class="pend">' + lista.map(function (p) {
      return '<a class="pend__i" href="' + esc(p.rota) + '">' +
        '<svg class="pend__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="' + (ICO[p.tipo] || ICO.retirada) + '"/></svg>' +
        '<span class="pend__t">' +
          '<b>' + NOME[p.tipo] + ' · ' + esc(p.hora || '--:--') + ' · ' +
            esc(p.codigo) + '</b>' +
          esc(p.veiculo ? p.veiculo.modelo + ' · ' + p.veiculo.placa : 'Veículo não definido') +
          ' · ' + esc(p.apoio) +
          (p.quando === 'atrasada' ? ' <span class="atraso">Atrasado</span>' : '') +
        '</span>' +
        '<span class="pend__seta" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>' +
        '</a>';
    }).join('') + '</div>';
  };

  /* ==========================================================
     9 · TELA
     ========================================================== */
  var htmlTela = function () {
    var c = D.contagemFrota();
    var parados = c.manutencao + c.indisponivel;

    return U.pageHead('Calendário da Frota',
      (veiculoFoco
        ? 'Só <b>' + esc(veiculoFoco.modelo) + '</b> <span class="mono">' +
          esc(veiculoFoco.placa) + '</span>'
        : '<b>' + S.estado.veiculos.length + '</b> unidades · ' + c.locado +
          ' na rua · ' + c.reservado + ' reservadas · ' + parados +
          ' fora de circulação') +
      ' · ' + esc(PERIODO) +
      (LIVRES
        ? ' · <b>' + LIVRES + '</b> ' + (LIVRES === 1 ? 'unidade livre' : 'unidades livres') +
          ' na janela'
        : ''),
      U.botao('Ver a frota', 'ir-frota', 'out')) +

      (veiculoFoco
        ? '<div class="aviso aviso--neutro u-mb">' +
          '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M4 16h16M5 16V11l2-5h10l2 5v5M7 16v2M17 16v2"/></svg>' +
          '<span>Mostrando a agenda de <b>' + esc(veiculoFoco.modelo) + '</b> ' +
          '<span class="mono">' + esc(veiculoFoco.placa) + '</span>.</span>' +
          '<button class="ab" type="button" data-acao="voltar-calendario">Ver todos os carros</button>' +
          '</div>'
        : '') +

      htmlNav() +
      htmlConflitos() +

      '<div class="u-between u-wrap u-mb">' +
        '<h2 class="u-t2" style="font-family:var(--f-display);font-size:0.95rem;' +
          'font-weight:700;letter-spacing:-0.01em">Agenda por veículo</h2>' +
        '<span class="u-xs u-t4">Cada barra é um compromisso — clique para abrir o registro.</span>' +
      '</div>' +

      htmlGrade() +

      '<div class="card u-mt">' +
        '<div class="card__head"><div>' +
          '<p class="card__title">Hoje, por carro</p>' +
          '<p class="card__sub">Retiradas, devoluções e vistorias que o balcão precisa ' +
          'resolver hoje — a agenda do dia, que a grade da janela não mostra.</p>' +
        '</div></div>' +
        '<div class="card__body card__body--flush">' + htmlHoje() + '</div>' +
      '</div>';
  };

  /* ==========================================================
     10 · AÇÕES
     ========================================================== */
  var caixa = document.createElement('div');
  caixa.setAttribute('data-tela', 'calendario');
  caixa.className = 'pg__tela-conteudo';

  caixa.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-acao]') : null;

    /* Sem `data-acao`: só pode ser um link direto. Os itens de
       "hoje, por carro" são `<a href="#/…">` e é aqui que eles
       navegam. */
    if (!alvo) {
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!link) return;
      if (ev.preventDefault) ev.preventDefault();
      U.navegar(link.getAttribute('href'));
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');

    switch (acao) {
      case 'ir':
        U.navegar(alvo.getAttribute('href') || AQUI);
        return;

      case 'ir-para': {
        var para = alvo.getAttribute('data-para');
        if (para) U.navegar(para);
        return;
      }

      case 'ir-periodo':
        U.navegar(rotaCom(alvo.getAttribute('data-de'),
                          Number(alvo.getAttribute('data-dias'))));
        return;

      case 'ir-dias':
        U.navegar(rotaCom(INICIO, Number(alvo.getAttribute('data-dias'))));
        return;

      case 'ir-hoje':
        /* LEVA O HOJE PARA A PRIMEIRA COLUNA, e não para o lugar
           onde ele estava.

           A distinção importa porque o botão tem de fazer alguma
           coisa sempre. Na janela padrão o hoje já está na quarta
           coluna: mandar para o endereço padrão de novo seria um
           botão que não faz nada, que é justamente o que o §26
           proíbe. Com a janela começando HOJE, a leitura é "a partir
           de agora" — o que sobra de compromisso para frente, sem
           gastar um terço da tela com o que já passou.

           O recorte por veículo cai: o botão é da janela, não do
           carro, e quem quiser voltar ao carro tem a ficha dele. */
        U.navegar(rotaSemAlvo(D.HOJE, DIAS));
        return;

      case 'voltar-calendario':
        U.navegar(rotaSemAlvo(INICIO, DIAS));
        return;

      case 'ir-frota':
        U.navegar(id ? '#/frota/' + id : '#/frota');
        return;

      case 'ir-manutencoes':
        U.navegar('#/manutencoes');
        return;
    }

    U.canto('Esta ação entra na próxima tela do módulo.', 'aviso');
  });

  caixa.innerHTML = htmlTela();
  cx.appendChild(caixa);
};
