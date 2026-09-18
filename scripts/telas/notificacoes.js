/* ============================================================
   LOK CAR — SISTEMA · telas/notificacoes.js
   ------------------------------------------------------------
   §4 e §26: a lista de tudo que está esperando uma decisão de
   alguém da locadora, agrupada por área e com o caminho de volta
   para o registro que a gerou.

   ESTA TELA NÃO INVENTA NENHUMA PENDÊNCIA
   ------------------------------------------------------------
   O sino do topo, a etiqueta do menu, o cartão do painel e esta
   tela mostram o MESMO número. A única forma de isso continuar
   verdade é haver uma única derivação — `D.pendencias()` — e
   todo mundo ler dela. Se esta tela recalculasse o que é
   pendência por conta própria, bastaria um critério diferente
   em um dos quatro lugares para que o sistema passasse a
   discordar de si mesmo, e a partir daí ninguém mais confiaria
   no número. Aqui a lista vem pronta; o que esta tela faz é
   organizar, explicar e dar saída.

   POR QUE AGRUPAR POR ÁREA, E NÃO POR TIPO
   ------------------------------------------------------------
   Sete pendências de contrato, duas de frota e uma de
   financeiro não são dez problemas iguais: são TRÊS PESSOAS
   diferentes com trabalho a fazer. A lista corrida esconde
   isso, e o efeito prático é que a pessoa que resolve frota
   rola a tela inteira para achar as duas linhas dela — ou pior,
   desiste. Agrupar por área transforma a lista de leitura em
   lista de trabalho.

   POR QUE "LIDA" É SEPARADO DE "RESOLVIDA"
   ------------------------------------------------------------
   Marcar uma pendência como lida NÃO a resolve: o contrato
   continua aguardando assinatura. As duas coisas parecem
   próximas e são opostas. Se "lida" resolvesse, o operador
   limparia a tela num clique e a locadora perderia a lista de
   pendências reais — que é o único motivo de a tela existir.
   Por isso "lida" é só um lembrete visual de onde ela parou de
   ler, e fica guardado nas preferências desta máquina: nesta
   fase não há usuário autenticado, e inventar uma marcação
   compartilhada sem backend seria fingir um servidor que não
   existe (§28).
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.notificacoes = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  /* A lista vem de `D.notificacoes()`, que por sua vez é
     `D.pendencias()` com nome de recado. As duas referências
     abaixo são só apelido: se um dia a derivação mudar, muda
     num lugar só. */
  var todas = function () { return D.notificacoes(); };
  var pendencias = function () { return D.pendencias(); };

  /* ==========================================================
     1 · A ÁREA DE CADA PENDÊNCIA
     ----------------------------------------------------------
     O tipo já existe na pendência e é específico demais para
     agrupar: 'conflito' e 'frota' são a mesma pessoa, 'contrato'
     e 'documento' são a mesma mesa. A área é o nível acima — o
     que a locadora chamaria de "quem cuida disso".

     A ORDEM NÃO É ALFABÉTICA NEM POR QUANTIDADE. É a ordem em
     que uma locadora pequena resolve o dia: primeiro o que
     impede o carro de sair (contrato, documento, vistoria),
     depois o que já saiu e está dando problema (locação),
     depois o dinheiro, e só então a agenda e a oficina. A ordem
     vive aqui, em uma lista só, para não se perder nos filtros.
     ========================================================== */
  var AREAS = [
    {
      id: 'contrato',
      nome: 'Contrato e assinatura',
      nota: 'sem contrato assinado o carro não sai',
      tipos: ['contrato']
    },
    {
      id: 'documento',
      nome: 'Documentos',
      nota: 'o que precisa existir antes da retirada',
      tipos: ['documento']
    },
    {
      id: 'vistoria',
      nome: 'Vistorias',
      nota: 'o carro não volta a circular sem elas',
      tipos: ['vistoria']
    },
    {
      id: 'locacao',
      nome: 'Locações em campo',
      nota: 'carro na rua e devolução atrasada',
      tipos: ['devolucao']
    },
    {
      id: 'financeiro',
      nome: 'Financeiro',
      nota: 'o que entrou e o que não entrou',
      tipos: ['pagamento']
    },
    {
      id: 'agenda',
      nome: 'Agenda da frota',
      nota: 'dois compromissos no mesmo carro',
      tipos: ['conflito', 'frota', 'reserva']
    },
    {
      id: 'oficina',
      nome: 'Manutenção',
      nota: 'o carro fora de circulação',
      tipos: ['manutencao']
    },
    /* PRORROGAÇÃO TEM ÁREA PRÓPRIA, e não vai para "Agenda da
       frota". A diferença decide quem resolve: um choque de agenda
       na frota é um problema de calendário, que se resolve
       mexendo em horários. Uma prorrogação pendente é um CLIENTE
       esperando resposta sobre o carro que já está na mão dele —
       se ela caísse no meio dos choques de agenda, o pedido
       viraria mais um item de calendário e ninguém responderia à
       pessoa. `prorrogacao-ok` entra junto porque é o aviso de que
       a devolução mudou, e quem cuida da frota precisa saber. */
    {
      id: 'prorrogacao',
      nome: 'Prorrogações',
      nota: 'mais dias com o carro na mão do cliente',
      tipos: ['prorrogacao', 'prorrogacao-ok']
    }
  ];

  var areaDe = function (tipo) {
    for (var i = 0; i < AREAS.length; i++) {
      if (AREAS[i].tipos.indexOf(tipo) !== -1) return AREAS[i];
    }
    /* Um tipo novo em `D.pendencias()` não pode sumir da tela por
       não estar na lista acima — cairia no silêncio. */
    return { id: 'outros', nome: 'Outras pendências', nota: 'sem área definida', tipos: [] };
  };

  var agrupar = function (lista) {
    var porArea = {};

    lista.forEach(function (p) {
      var a = areaDe(p.tipo);
      if (!porArea[a.id]) porArea[a.id] = { area: a, itens: [] };
      porArea[a.id].itens.push(p);
    });

    /* O grupo "outros" só entra se tiver item; e entra no fim,
       porque é onde ele significa alguma coisa: "o resto". */
    var ordem = AREAS.map(function (a) { return a.id; }).concat(['outros']);
    return ordem
      .filter(function (id) { return porArea[id]; })
      .map(function (id) { return porArea[id]; });
  };

  /* ==========================================================
     2 · O QUE JÁ FOI LIDO
     ----------------------------------------------------------
     Guardado em `lokcar-sistema-prefs`, na mesma chave do estado
     do menu. Fica no navegador desta máquina, não na conta de
     ninguém — porque conta não existe nesta fase.

     A CHAVE DE IDENTIDADE DE UMA NOTIFICAÇÃO É `rota` + `alvo`.
     O `id` que `D.notificacoes()` devolve é a POSIÇÃO na lista
     ('n1', 'n2'…), e a posição muda assim que uma pendência é
     resolvida: marcar 'n5' como lida hoje faria a pendência de
     amanhã nascer lida. Rota e alvo apontam para o registro —
     é o que a pendência É, não onde ela estava sentada.
     ========================================================== */
  var CHAVE = 'notificacoes-lidas';

  var chaveDe = function (p) {
    return (p.alvo ? p.alvo : '') + '|' + (p.rota || '');
  };

  var lidasSalvas = function () {
    var v = S.prefs()[CHAVE];
    return (v && v.length) ? v : [];
  };

  var LIDAS = lidasSalvas();

  var estaLida = function (p) { return LIDAS.indexOf(chaveDe(p)) !== -1; };

  var gravarLidas = function () {
    /* A lista é podada contra as pendências de hoje. Sem isso,
       um mês de uso deixaria centenas de chaves de pendências
       que já não existem, e o filtro "não lidas" começaria a
       errar por acúmulo. */
    var vivas = {};
    pendencias().forEach(function (p) { vivas[chaveDe(p)] = 1; });
    LIDAS = LIDAS.filter(function (k) { return vivas[k]; });

    S.salvarPref(CHAVE, LIDAS);
  };

  /* ==========================================================
     3 · QUANTOS SÃO
     ----------------------------------------------------------
     O número do topo desta tela PRECISA bater com a etiqueta do
     menu e com o sino, porque os três saem de `D.pendencias()`.
     Se divergirem, o operador deixa de confiar no número — e é
     o número que faz ele abrir a tela.

     Os dois contadores são FUNÇÃO, e não número guardado. Eles
     aparecem em três lugares (os cartões, as abas e a contagem
     da direita) e mudam quando uma linha é marcada como vista.
     Um número calculado uma vez no carregamento da tela
     continuaria dizendo "12 não lidas" depois de o operador ter
     marcado nove delas — e aí a própria tela se contradiz.
     ========================================================== */
  var totalAgora = function () { return pendencias().length; };

  var naoLidasAgora = function () {
    return todas().filter(function (p) { return !estaLida(p); }).length;
  };

  /* ==========================================================
     4 · FILTRO E BUSCA
     ========================================================== */
  var ABAS = [
    {
      id: 'todas',
      rotulo: 'Todas',
      nota: 'tudo que está esperando alguém',
      teste: function () { return true; }
    },
    {
      id: 'novas',
      rotulo: 'Não lidas',
      nota: 'o que você ainda não abriu',
      teste: function (p) { return !estaLida(p); }
    },
    {
      id: 'lidas',
      rotulo: 'Já vistas',
      nota: 'abertas uma vez e ainda pendentes',
      teste: function (p) { return estaLida(p); }
    }
  ];

  var filtroDe = function (id) {
    for (var i = 0; i < ABAS.length; i++) {
      if (ABAS[i].id === id) return ABAS[i];
    }
    return ABAS[0];
  };

  var BUSCA = params.q ? String(params.q) : '';

  var normalizar = function (v) {
    var t = String(v === null || v === undefined ? '' : v).toLowerCase();
    return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
  };

  var alvosDe = function (p) {
    return [p.titulo, p.apoio, areaDe(p.tipo).nome].filter(Boolean);
  };

  var combinaBusca = function (p, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;
    var texto = alvosDe(p).map(normalizar).join(' ');
    return termos.every(function (t) { return texto.indexOf(t) !== -1; });
  };

  /* Dentro da área, o que NÃO foi lido vem primeiro: é o que o
     operador ainda tem por fazer e o que ele não sabe de cor. */
  var ordenar = function (lista) {
    return lista.slice().sort(function (a, b) {
      var la = estaLida(a) ? 1 : 0;
      var lb = estaLida(b) ? 1 : 0;
      return la - lb;
    });
  };

  var filtrar = function (filtro) {
    return ordenar(todas().filter(function (p) {
      return filtro.teste(p) && combinaBusca(p, BUSCA);
    }));
  };

  var contar = function (filtro) {
    return todas().filter(filtro.teste).length;
  };

  /* ==========================================================
     5 · O ITEM
     ----------------------------------------------------------
     A linha é a MESMA do sino do topo e do cartão do painel:
     `U.itemPendencia`. Não é economia de código — é a garantia
     de que abrir a notificação pelo sino ou pela tela mostra a
     mesma frase. Se cada lugar desenhasse a sua, a mesma
     pendência apareceria com dois textos diferentes e o operador
     acharia que são duas.
     ========================================================== */
  var htmlItem = function (p) {
    var lida = estaLida(p);
    var rota = destinoDe(p);

    var acoes = '<div class="nt__acoes">' +
      '<button class="nt__ir" type="button" data-acao="lida" data-chave="' +
        esc(chaveDe(p)) + '" data-estado="' + (lida ? '0' : '1') + '" ' +
        'title="' + (lida
          ? 'Voltar a marcar como não lida'
          : 'Marcar como vista — a pendência continua aberta') + '">' +
        (lida ? 'Não lida' : 'Vista') + '</button>' +
      '</div>';

    /* O destino já vai resolvido no `href` do item — por isso o
       clique não precisa traduzir nada: o link funciona sozinho,
       e funciona igual com o teclado e com "abrir em nova aba",
       que um ouvinte de clique não alcança. */
    return '<div class="nt' + (lida ? ' nt--lida' : '') + '">' +
      U.itemPendencia({
        tipo: p.tipo, titulo: p.titulo, apoio: p.apoio, rota: rota
      }) +
      acoes +
      '</div>';
  };

  /* ==========================================================
     6 · ONDE A PENDÊNCIA ABRE
     ----------------------------------------------------------
     `D.pendencias()` aponta para a LISTA do módulo e leva o
     registro em `alvo`. Isso é certo como padrão — o operador vê
     o registro no contexto do resto. Mas quando o módulo sabe
     abrir um registro direto pelo endereço, abrir a ficha é
     melhor: é um clique a menos para quem veio do sino com
     pressa.

     O MAPA É CONSERVADOR DE PROPÓSITO. Só entra aqui o módulo em
     que eu conferi, no próprio arquivo dele, que `ctx.alvo` é
     lido do endereço. FINANCEIRO não entra: ele lê `params.q` e
     ignora `ctx.alvo`, então mandar '#/financeiro/<id>' cairia
     na lista sem filtro nenhum e o operador não acharia o
     lançamento que veio ver.

     Para os módulos sem ficha, a rota continua sendo a da lista
     — e aí o caminho certo não é um endereço torto, é usar os
     mecanismos que o módulo JÁ oferece para apontar um registro:
     `params.q` no financeiro e `params.destaque` nas outras.
     ========================================================== */
  var FICHA = {
    documentos: 'documentos',
    ocorrencias: 'ocorrencias',
    contratos: 'contratos',
    reservas: 'reservas',
    locacoes: 'locacoes',
    vistorias: 'vistorias',
    manutencoes: 'manutencoes',
    frota: 'frota',
    clientes: 'clientes',
    /* A rota da pendência é `#/prorrogacoes` com `alvo: e.id`.
       Sem esta linha o `alvo` não viraria caminho — a pendência
       abriria a lista inteira, com `?q=x01` pendurado na barra, e
       o operador teria de caçar o pedido à mão justamente no
       momento em que ele estava a um clique de distância. */
    prorrogacoes: 'prorrogacoes'
  };

  var destinoDe = function (p) {
    var rota = p.rota || '#/dashboard';
    if (!p.alvo) return rota;

    var partes = rota.replace(/^#\//, '').split('/');
    var modulo = partes[0];

    if (FICHA[modulo]) return '#/' + FICHA[modulo] + '/' + p.alvo;

    /* Calendário já entende `#/calendario/<veiculoId>`. */
    if (modulo === 'calendario') return '#/calendario/' + p.alvo;

    if (rota.indexOf('?') !== -1) return rota;
    return rota + '?q=' + encodeURIComponent(p.alvo);
  };

  /* ==========================================================
     7 · OS NÚMEROS DO TOPO
     ----------------------------------------------------------
     Cada valor mora num `data-kpi`. Não é decoração: quando o
     operador marca uma linha como vista, "não lidas" e "já
     vistas" mudam, e os dois cartões precisam mudar junto. O
     valor é reescrito pelo slot em vez de o cartão inteiro ser
     trocado por outro — trocar o cartão exigiria mexer no pai,
     e um número certo com um cartão trocado é mais frágil do
     que um número reescrito.
     ========================================================== */
  var cartao = function (slot, chave, valor, nota, tom) {
    return '<div class="kpi">' +
      '<span class="kpi__key">' + esc(chave) + '</span>' +
      '<p class="kpi__val' + (tom ? ' kpi__val--' + tom : '') +
        '" data-kpi="' + slot + '">' + esc(valor) + '</p>' +
      (nota ? '<p class="kpi__nota" data-kpi-nota="' + slot + '">' + nota + '</p>' : '') +
      '</div>';
  };

  /* Os quatro números, num lugar só, para que o desenho e a
     atualização não possam divergir. */
  var numeros = function () {
    var total = totalAgora();
    var naoLidas = naoLidasAgora();

    var grupos = agrupar(todas());
    var maior = grupos.length
      ? grupos.slice().sort(function (a, b) { return b.itens.length - a.itens.length; })[0]
      : null;

    var atrasadas = pendencias().filter(function (p) {
      return p.tipo === 'pagamento' && p.titulo.indexOf('atraso') !== -1;
    }).length;

    return [
      {
        slot: 'total', chave: 'Pendências abertas', valor: String(total),
        nota: atrasadas
          ? atrasadas + (atrasadas === 1 ? ' pagamento em atraso' : ' pagamentos em atraso')
          : 'nenhum pagamento em atraso',
        tom: atrasadas ? 'bad' : ''
      },
      {
        slot: 'nao-lidas', chave: 'Não lidas', valor: String(naoLidas),
        nota: naoLidas ? 'você ainda não abriu' : 'tudo já passou pela sua vista',
        tom: naoLidas ? '' : 'ok'
      },
      {
        slot: 'vistas', chave: 'Já vistas', valor: String(total - naoLidas),
        nota: 'abertas uma vez e ainda pendentes — vista não é resolvida',
        tom: ''
      },
      {
        slot: 'area', chave: 'Área mais carregada',
        valor: maior ? maior.area.nome : '—',
        nota: maior
          ? maior.itens.length + (maior.itens.length === 1 ? ' item' : ' itens') +
            ' — ' + esc(maior.area.nota)
          : 'sem pendência em nenhuma área',
        tom: ''
      }
    ];
  };

  var htmlCards = function () {
    return '<div class="kpis kpis--4">' + numeros().map(function (n) {
      return cartao(n.slot, n.chave, n.valor, n.nota, n.tom);
    }).join('') + '</div>';
  };

  /* ==========================================================
     8 · A LISTA
     ========================================================== */
  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist" aria-label="Filtrar notificações">' +
      ABAS.map(function (a) {
        return '<button class="tabs__b" type="button" role="tab" ' +
          'data-acao="filtrar" data-f="' + a.id + '"' +
          (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
          esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
      }).join('') +
      '</div>';
  };

  var htmlVazio = function () {
    if (BUSCA) {
      return U.vazio('Nenhuma notificação encontrada',
        'Nenhuma pendência tem “' + BUSCA + '” no título, no apoio ou na área. A busca olha ' +
        'a notificação, não o registro que a gerou.',
        U.botao('Limpar busca', 'limpar', 'out'));
    }

    /* Este caso não é erro: é o sistema dizendo que o trabalho
       acabou. A tentação é deixar um espaço vazio com "sem
       dados" — e "sem dados" e "nada pendente" são coisas
       completamente diferentes para quem abre esta tela. */
    return U.vazio('Nada pendente agora',
      'Nenhum contrato aguardando assinatura, nenhum documento vencendo, nenhuma devolução ' +
      'atrasada e nenhum conflito de agenda. Esta lista se enche sozinha quando algo sair ' +
      'do lugar — não é preciso marcar nada para que apareça aqui.',
      U.botao('Ir para o painel', 'painel', 'out'));
  };

  var htmlGrupo = function (g) {
    return '<section class="nt-grupo">' +
      '<div class="nt-grupo__h">' +
      '  <h2>' + esc(g.area.nome) + '</h2>' +
      '  <span class="nt-grupo__n">' + g.itens.length + '</span>' +
      '  <span class="u-xs u-t4">' + esc(g.area.nota) + '</span>' +
      '</div>' +
      '<div class="card">' + g.itens.map(htmlItem).join('') + '</div>' +
      '</section>';
  };

  var htmlPrateleira = function (lista) {
    if (!lista.length) return htmlVazio();
    return agrupar(lista).map(htmlGrupo).join('');
  };

  var htmlLista = function (filtro, lista) {
    return '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar notificações por leitura">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'item' : 'itens') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Pendência, apoio ou área" ' +
             'aria-label="Buscar notificação"/>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div data-slot="lista">' + htmlPrateleira(lista) + '</div>';
  };

  /* ==========================================================
     9 · A NOTA DE RODAPÉ
     ----------------------------------------------------------
     "Vista" é uma marca deste navegador. Dizer isso na tela não
     é excesso de honestidade: é o que impede o operador de
     acreditar que a colega viu a mesma pendência. Um aviso
     pequeno aqui economiza uma cobrança errada amanhã.
     ========================================================== */
  var htmlNota = function () {
    return '<p class="u-xs u-t4 u-mt">' +
      'Esta lista sai de uma derivação única: as mesmas pendências que alimentam o sino do ' +
      'topo, a etiqueta do menu e o cartão do painel. Nada aqui é criado à mão — resolver o ' +
      'registro é o que tira a linha daqui. A marca “vista” fica guardada neste navegador e ' +
      'não é compartilhada entre pessoas: marcar uma pendência como vista não a resolve e ' +
      'não a esconde de ninguém.</p>';
  };

  /* ==========================================================
     10 · TELA
     ========================================================== */
  var filtro = filtroDe(params.f);

  var htmlTela = function () {
    return U.pageHead('Notificações',
      'Tudo que está esperando uma decisão de alguém da locadora, na ordem em que o dia de ' +
      'uma locadora costuma pedir: primeiro o que impede o carro de sair, depois o que já ' +
      'saiu e está dando problema, depois o dinheiro. Vista não é resolvida — abrir a ' +
      'pendência é que resolve.',
      U.botao('Abrir o painel', 'painel', 'pri')) +
      htmlCards() +
      htmlLista(filtro, filtrar(filtro)) +
      htmlNota();
  };

  cx.innerHTML = htmlTela();

  /* ==========================================================
     11 · LIGAÇÃO
     ========================================================== */
  var refazer = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));
    slot.innerHTML = htmlPrateleira(lista);
    if (cont) cont.textContent = lista.length;

    /* Os números do topo mudam junto: marcar uma linha como vista
       altera "não lidas" e "já vistas", e deixar os cartões
       parados faria a tela se contradizer — 12 não lidas no topo
       e 3 no filtro logo abaixo. */
    numeros().forEach(function (n) {
      var v = cx.querySelector('[data-kpi="' + n.slot + '"]');
      if (v) {
        v.textContent = n.valor;
        v.className = 'kpi__val' + (n.tom ? ' kpi__val--' + n.tom : '');
      }
      var nota = cx.querySelector('[data-kpi-nota="' + n.slot + '"]');
      if (nota) nota.innerHTML = n.nota;
    });

    var dir = cx.querySelector('.filtros__dir');
    var limpar = dir ? dir.querySelector('[data-acao="limpar"]') : null;
    if (dir && BUSCA && !limpar) {
      var bt = document.createElement('button');
      bt.className = 'ab';
      bt.type = 'button';
      bt.setAttribute('data-acao', 'limpar');
      bt.textContent = 'Limpar';
      dir.appendChild(bt);
    } else if (limpar && !BUSCA) {
      limpar.parentNode.removeChild(limpar);
    }
  };

  cx.addEventListener('input', function (ev) {
    var campo = ev.target;
    if (!campo || !campo.getAttribute || campo.getAttribute('data-busca') !== '1') return;
    BUSCA = campo.value || '';
    refazer();
  });

  cx.addEventListener('click', function (ev) {
    var alvoClicado = ev.target.closest ? ev.target.closest('[data-acao]') : null;

    if (!alvoClicado) {
      /* O item de pendência é um `<a href="#/...">`. Ele já
         funciona sozinho — o ouvinte existe só para o roteador
         ser chamado sem depender do `hashchange`. */
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (link) {
        var href = link.getAttribute('href');
        if (href && href.charAt(0) === '#') {
          if (ev.preventDefault) ev.preventDefault();
          U.navegar(href);
        }
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvoClicado.getAttribute('data-acao');

    if (acao === 'filtrar') {
      var f = alvoClicado.getAttribute('data-f');
      U.navegar('#/notificacoes' + (!f || f === 'todas' ? '' : '?f=' + f));
      return;
    }

    if (acao === 'limpar') {
      BUSCA = '';
      U.desenhar();
      return;
    }

    if (acao === 'painel') {
      U.navegar('#/dashboard');
      return;
    }

    if (acao === 'lida') {
      var chave = alvoClicado.getAttribute('data-chave');
      var querLida = alvoClicado.getAttribute('data-estado') === '1';

      if (querLida) {
        if (LIDAS.indexOf(chave) === -1) LIDAS.push(chave);
      } else {
        LIDAS = LIDAS.filter(function (k) { return k !== chave; });
      }

      gravarLidas();
      refazer();

      U.canto(querLida
        ? 'Marcada como vista. A pendência continua aberta — vista não é resolvida.'
        : 'Marcada como não lida.', 'ok');
      return;
    }

    /* `data-acao` com qualquer outro valor veio do botão "Voltar"
       de um estado vazio (`U.botao`). Nada a fazer. */
  });
};
