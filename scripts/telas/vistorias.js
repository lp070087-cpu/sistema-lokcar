/* ============================================================
   LOK CAR — SISTEMA · telas/vistorias.js
   ------------------------------------------------------------
   §21 do pedido: a vistoria de SAÍDA e a de DEVOLUÇÃO, com as
   seis áreas (Frente, Traseira, Lateral direita, Lateral
   esquerda, Rodas, Interior) e as vagas de foto.

   O QUE ESTA TELA PRECISA DEIXAR CLARO
   ------------------------------------------------------------
   A tela de LOCAÇÕES já cria e conclui vistoria. Esta tela NÃO
   é uma segunda porta para a mesma coisa: ela é o acervo. Aqui
   se vê o que foi vistoriado, quando, por quem passou o carro,
   com quantos quilômetros e qual foi a observação de cada área —
   e é aqui que se ABRE a vistoria que ficou pendente.

   A diferença importa porque vistoria é PROVA. Numa discussão
   sobre um risco na roda, o que vale é o que ficou registrado
   no dia da saída, com data, hora e quilometragem. Por isso a
   vistoria concluída é somente leitura, e por isso a tela mostra
   as duas pontas da mesma locação lado a lado: é comparando
   saída e devolução que se descobre o que aconteceu com o carro
   entre uma e outra.

   AS FOTOS
   ------------------------------------------------------------
   O §28 proíbe configurar upload real. A tentação é desenhar um
   retângulo cinza com ícone de imagem — e isso é uma mentira
   visual: parece uma foto que não carregou, e o operador espera.
   Aqui as vagas dizem, no próprio texto de apoio e no `title`,
   que o anexo depende do armazenamento de arquivos. A montagem
   vem do `ui.js` para ser a MESMA da tela de reservas.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.vistorias = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  /* ==========================================================
     1 · RÓTULOS
     ========================================================== */
  var ROTULO_TIPO = { saida: 'Saída', devolucao: 'Devolução' };

  var rotuloTipo = function (t) { return ROTULO_TIPO[t] || t; };

  var doTipo = function (t) {
    return D.VISTORIAS.filter(function (v) { return v.tipo === t; });
  };

  /* ==========================================================
     2 · NÚMEROS DO TOPO
     ----------------------------------------------------------
     Quatro contagens, e a quarta é a que importa: uma vistoria
     pendente é uma locação que não fecha. O carro está na rua, a
     devolução aconteceu ou não, e ninguém olhou o veículo. É a
     pendência que trava a finalização e que aparece no painel.
     ========================================================== */
  var htmlCards = function () {
    var pendentes = D.VISTORIAS.filter(function (v) { return v.status !== 'concluida'; });

    var cartao = function (titulo, valor, nota, tom) {
      return '<div class="kpi">' +
        '<p class="kpi__key">' + esc(titulo) + '</p>' +
        '<p class="kpi__val' + (tom ? ' kpi__val--' + tom : '') + '">' + valor + '</p>' +
        (nota ? '<p class="kpi__nota">' + nota + '</p>' : '') +
        '</div>';
    };

    return '<div class="kpis kpis--4">' +
      cartao('Vistorias de saída', doTipo('saida').length,
        'Feitas na hora de entregar o carro ao cliente') +
      cartao('Vistorias de devolução', doTipo('devolucao').length,
        'Feitas quando o carro volta') +
      cartao('Áreas por vistoria', D.AREAS_VISTORIA.length,
        'O conjunto que o pedido exige, do painel ao porta-malas') +
      cartao('Pendentes', pendentes.length,
        pendentes.length
          ? 'A locação não fecha enquanto a vistoria não for concluída'
          : 'Nada em aberto: toda locação tem as duas pontas registradas',
        pendentes.length ? 'bad' : '') +
    '</div>';
  };

  /* ==========================================================
     3 · LISTA
     ========================================================== */
  var ABAS = [
    { id: 'todas',     rotulo: 'Todas',      teste: function () { return true; } },
    { id: 'saida',     rotulo: 'Saída',      teste: function (v) { return v.tipo === 'saida'; } },
    { id: 'devolucao', rotulo: 'Devolução',  teste: function (v) { return v.tipo === 'devolucao'; } },
    { id: 'pendente',  rotulo: 'Pendentes',  teste: function (v) { return v.status !== 'concluida'; } },
    { id: 'concluida', rotulo: 'Concluídas',  teste: function (v) { return v.status === 'concluida'; } }
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

  var alvosDe = function (v) {
    var veic = S.veiculo(v.veiculoId);
    var r = v.reserva ? S.reserva(v.reserva) : null;
    var l = v.locacao ? S.locacao(v.locacao) : null;
    return [v.codigo, rotuloTipo(v.tipo), v.obs,
            veic ? veic.modelo : '', veic ? veic.placa : '',
            r ? r.codigo : '', l ? l.codigo : '',
            U.nomeCliente(v.clienteId)].filter(Boolean);
  };

  var combinaBusca = function (v, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;
    var texto = alvosDe(v).map(normalizar).join(' ');
    return termos.every(function (t) { return texto.indexOf(t) !== -1; });
  };

  var ordenar = function (lista) {
    return lista.slice().sort(function (a, b) {
      /* Pendente primeiro: é o que exige ação. Depois, a mais
         recente — uma vistoria de hoje interessa mais que a de
         duas semanas atrás. */
      var pa = a.status === 'concluida' ? 1 : 0;
      var pb = b.status === 'concluida' ? 1 : 0;
      if (pa !== pb) return pa - pb;
      var d = D.diffDias(a.data, b.data);
      if (d !== 0) return d;
      return String(b.hora || '').localeCompare(String(a.hora || ''));
    });
  };

  var filtrar = function (filtro) {
    return ordenar(D.VISTORIAS.filter(function (v) {
      if (!filtro.teste(v)) return false;
      return combinaBusca(v, BUSCA);
    }));
  };

  var contar = function (filtro) {
    return D.VISTORIAS.filter(filtro.teste).length;
  };

  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist">' + ABAS.map(function (a) {
      return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" data-f="' + a.id + '"' +
             (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
             esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
    }).join('') + '</div>';
  };

  /* Áreas que receberam observação. É o número que diz se aquela
     vistoria registrou alguma coisa além do protocolo. */
  var areasTocadas = function (v) {
    var n = 0;
    Object.keys(v.areas || {}).forEach(function (a) {
      if (v.areas[a] && v.areas[a].observacao) n++;
    });
    return n;
  };

  var celulaVeiculo = function (v) {
    var veic = S.veiculo(v.veiculoId);
    if (!veic) return '<span class="falta">veículo não encontrado</span>';
    return '<a class="ab" href="#/frota/' + veic.id + '" data-acao="ir" data-para="#/frota/' + veic.id + '">' +
      esc(veic.modelo) + '</a>' +
      '<span class="tbl__dim mono">' + esc(veic.placa) + '</span>';
  };

  var celulaOrigem = function (v) {
    var partes = [];
    if (v.reserva) {
      var r = S.reserva(v.reserva);
      partes.push(r
        ? '<a class="ab" href="#/reservas/' + r.id + '" data-acao="ir" data-para="#/reservas/' + r.id + '">' +
          esc(r.codigo) + '</a>'
        : '<span class="falta">reserva não encontrada</span>');
    }
    if (v.locacao) {
      var l = S.locacao(v.locacao);
      partes.push(l
        ? '<a class="ab" href="#/locacoes/' + l.id + '" data-acao="ir" data-para="#/locacoes/' + l.id + '">' +
          esc(l.codigo) + '</a>'
        : '<span class="falta">locação não encontrada</span>');
    }
    if (!partes.length) return '<span class="tbl__dim">sem reserva nem locação</span>';
    return partes.join(' ');
  };

  var celulaKm = function (v) {
    if (v.km === null || v.km === undefined) {
      return '<span class="falta">a informar</span>';
    }
    return '<span class="mono">' + Number(v.km).toLocaleString('pt-BR') + ' km</span>' +
      (v.combustivel ? '<span class="tbl__dim">' + esc(v.combustivel) + '</span>' : '');
  };

  var htmlLinha = function (v) {
    var tocadas = areasTocadas(v);
    var concluida = v.status === 'concluida';

    return '<tr data-abre="' + v.id + '">' +
      '<td><span class="mono u-b">' + esc(v.codigo) + '</span>' +
        '<span class="tbl__dim">' + esc(rotuloTipo(v.tipo)) + '</span></td>' +
      '<td>' + esc(U.nomeCliente(v.clienteId)) + '</td>' +
      '<td>' + celulaVeiculo(v) + '</td>' +
      '<td>' + celulaOrigem(v) + '</td>' +
      '<td><span class="u-tab">' + D.fmtData(v.data) + '</span>' +
        (v.hora ? '<span class="tbl__dim">' + esc(v.hora) + '</span>'
                : (concluida ? '' : '<span class="tbl__dim">hora não informada</span>')) + '</td>' +
      '<td>' + celulaKm(v) + '</td>' +
      '<td>' + (v.km === null || v.km === undefined ? '' :
        '<span class="u-tab">' + areasTocadas(v) + ' de ' + D.AREAS_VISTORIA.length + '</span>' +
        '<span class="tbl__dim">' + (tocadas ? 'com observação' : 'sem avaria') + '</span>') + '</td>' +
      '<td>' + U.cracha(D.STATUS_VISTORIA, D.statusDaVistoria(v)) + '</td>' +
      '<td><div class="tbl__acts">' +
        '<a class="ab' + (concluida ? '' : ' ab--pri') + '" href="#/vistorias/' + v.id + '" ' +
        'data-acao="ver" data-id="' + v.id + '">' +
        (concluida ? 'Ver' : 'Registrar') + '</a>' +
      '</div></td>' +
    '</tr>';
  };

  var htmlTabela = function (lista) {
    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Vistoria</th><th>Cliente</th><th>Veículo</th><th>Reserva / Locação</th>' +
        '<th>Data</th><th>Km / Combustível</th><th>Áreas</th><th>Situação</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(htmlLinha).join('') + '</tbody>' +
      '</table></div>';
  };

  var htmlVazio = function () {
    return U.vazio(
      BUSCA ? 'Nenhuma vistoria encontrada' : 'Nenhuma vistoria nesta situação',
      BUSCA
        ? 'Nenhuma vistoria casa com “' + BUSCA + '”. A busca olha código, tipo, cliente, ' +
          'veículo, placa, reserva, locação e observação.'
        : 'Nenhuma vistoria está nesta situação.',
      BUSCA ? U.botao('Limpar busca', 'limpar', 'out') : ''
    );
  };

  var htmlLista = function (filtro, lista) {
    return '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar vistorias por tipo e situação">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'vistoria' : 'vistorias') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Código, cliente, veículo, placa ou reserva" ' +
             'aria-label="Buscar vistoria por código, cliente, veículo, placa ou reserva" />' +
      '    </div>' +
           (BUSCA ? '<button class="ab" type="button" data-acao="limpar">Limpar</button>' : '') +
      '  </div>' +
      '</div>' +
      '<div class="card" data-slot="lista">' +
        (lista.length ? htmlTabela(lista) : htmlVazio()) +
      '</div>';
  };

  /* ==========================================================
     4 · O PAR SAÍDA × DEVOLUÇÃO
     ----------------------------------------------------------
     O que a ficha tem de mais útil: as duas pontas da MESMA
     locação, uma ao lado da outra. É a comparação entre elas que
     responde "o que aconteceu com o carro nesse período?" — e a
     diferença de quilometragem e de combustível é a primeira
     coisa que o operador procura.
     ========================================================== */
  var parDaLocacao = function (v) {
    if (!v.locacao) return null;
    var lista = D.VISTORIAS.filter(function (x) { return x.locacao === v.locacao; });
    var saida = null, devolucao = null;
    lista.forEach(function (x) {
      if (x.tipo === 'saida') saida = x;
      if (x.tipo === 'devolucao') devolucao = x;
    });
    if (!saida && !devolucao) return null;
    return { saida: saida, devolucao: devolucao };
  };

  var blocoPar = function (v) {
    var par = parDaLocacao(v);
    if (!par) return '';

    /* A vistoria que o operador está olhando NÃO vira link para
       ela mesma. O código aparece como texto e a linha diz "esta
       vistoria" — porque um atalho que leva ao lugar onde a
       pessoa já está é um botão morto disfarçado. */
    var ehAtual = function (x) { return x && x.id === v.id; };

    var celula = function (x, nome) {
      if (!x) {
        return '<div class="par__lado">' +
          '<p class="par__h">' + esc(nome) + '</p>' +
          '<p class="u-t4">Ainda não registrada.</p>' +
          '</div>';
      }
      var concluida = x.status === 'concluida';
      return '<div class="par__lado">' +
        '<p class="par__h">' + esc(nome) + ' ' +
          U.cracha(D.STATUS_VISTORIA, D.statusDaVistoria(x)) + '</p>' +
        '<p class="u-sm">' +
          (ehAtual(x)
            ? '<span class="mono u-b">' + esc(x.codigo) + '</span>' +
              ' <span class="u-t4">— esta vistoria</span>'
            : '<a class="ab" href="#/vistorias/' + x.id + '" data-acao="ir" ' +
              'data-para="#/vistorias/' + x.id + '">' + esc(x.codigo) + '</a>') +
          '<span class="tbl__dim">' + esc(D.fmtData(x.data)) +
            (x.hora ? ' às ' + esc(x.hora) : '') + '</span>' +
        '</p>' +
        '<p class="u-tab u-sm u-mt">' +
          (concluida ? Number(x.km).toLocaleString('pt-BR') + ' km · ' + esc(x.combustivel)
                     : '<span class="falta">quilometragem ainda não informada</span>') +
        '</p>' +
        '</div>';
    };

    return '<section class="bloco">' +
      '<div class="bloco__h">' +
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 3v18M16 3v18"/></svg>' +
      '  <h2>As duas pontas da locação</h2>' +
      '</div>' +
      corpo(
        '<div class="par">' +
          celula(par.saida, 'Saída') +
          celula(par.devolucao, 'Devolução') +
        '</div>' +
        diferenca(par)
      ) +
      '</section>';
  };

  var diferenca = function (par) {
    if (!par.saida || !par.devolucao) return '';
    if (par.saida.km === null || par.devolucao.km === null) {
      return '<p class="u-xs u-t4 u-mt">A diferença de quilometragem aparece quando as duas ' +
             'vistorias tiverem a leitura registrada.</p>';
    }
    var km = Number(par.devolucao.km) - Number(par.saida.km);
    var combustivel = '';
    if (par.saida.combustivel && par.devolucao.combustivel &&
        par.saida.combustivel !== par.devolucao.combustivel) {
      combustivel = ' O combustível saiu em ' + par.saida.combustivel +
                    ' e voltou em ' + par.devolucao.combustivel + '.';
    }
    return '<p class="u-sm u-mt">Rodados no período: <b class="u-tab">' +
      Number(km).toLocaleString('pt-BR') + ' km</b>.' +
      (km < 0 ? ' <span class="u-warn">A devolução registra quilometragem MENOR que a saída — ' +
                'uma das duas leituras está errada.</span>' : '') +
      esc(combustivel) + '</p>';
  };

  /* ==========================================================
     5 · FICHA
     ========================================================== */
  var ICO = {
    dados:   'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3 4-5 8-5s8 2 8 5',
    veiculo: 'M4 16h16M5 16V11l2-5h10l2 5v5M7.5 19h.01M16.5 19h.01',
    areas:   'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
    foto:    'M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5zM12 12.5a3 3 0 1 0 0 .01'
  };

  var bloco = function (id, titulo, conteudo, nota) {
    return '<section class="bloco">' +
      '<div class="bloco__h">' +
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICO[id] || ICO.dados) + '"/></svg>' +
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

  var blocoProtocolo = function (v) {
    var concluida = v.status === 'concluida';
    var veic = S.veiculo(v.veiculoId);
    var l = v.locacao ? S.locacao(v.locacao) : null;

    return bloco('dados', 'Protocolo', corpo(ficha([
      ['Vistoria', '<span class="mono u-b">' + esc(v.codigo) + '</span>'],
      ['Tipo', esc(rotuloTipo(v.tipo))],
      ['Situação', U.cracha(D.STATUS_VISTORIA, D.statusDaVistoria(v))],
      ['Data', esc(D.fmtData(v.data)) + (v.hora ? ' às ' + esc(v.hora) : ' — hora não informada')],
      ['Cliente', esc(U.nomeCliente(v.clienteId))],
      ['Veículo', veic
        ? '<span class="mono">' + esc(veic.placa) + '</span> · ' + esc(veic.modelo)
        : '<span class="falta">veículo não encontrado</span>'],
      ['Quilometragem', v.km === null || v.km === undefined
        ? '<span class="falta">a informar</span>'
        : '<span class="u-tab">' + Number(v.km).toLocaleString('pt-BR') + ' km</span>'],
      ['Combustível', v.combustivel
        ? esc(v.combustivel)
        : '<span class="falta">a informar</span>'],
      ['Locação', l
        ? '<a class="ab" href="#/locacoes/' + l.id + '" data-acao="ir" data-para="#/locacoes/' + l.id + '">' +
          esc(l.codigo) + '</a>'
        : '<span class="u-t4">vistoria não ligada a uma locação</span>']
    ])) + (concluida ? '' :
      '<p class="u-xs u-t4 u-mt">Concluir esta vistoria exige quilometragem e combustível. ' +
      'Sem os dois números ela não vira prova de nada — e é justamente para isso que ela existe.</p>'));
  };

  var blocoAreas = function (v) {
    var concluida = v.status === 'concluida';
    var tocadas = areasTocadas(v);

    return bloco('areas', 'Áreas do veículo',
      corpo(
        '<p class="u-sm u-t4 u-mb">As seis áreas do pedido. ' +
        (tocadas
          ? '<b class="u-warn">' + tocadas + ' com observação</b> — foram essas que a vistoria registrou.'
          : 'Nenhuma recebeu observação: a vistoria não encontrou avaria.') +
        '</p>' +
        U.areasVistoria(v.areas, { somenteLeitura: concluida })
      ),
      tocadas ? tocadas + ' de ' + D.AREAS_VISTORIA.length : '');
  };

  var blocoObservacoes = function (v) {
    return bloco('foto', 'Observação geral', corpo(
      v.obs
        ? '<p class="u-sm">' + esc(v.obs) + '</p>'
        : '<p class="u-sm u-t4">Nenhuma observação geral registrada nesta vistoria.</p>'
    ));
  };

  var PROXIMA = {
    pendente: 'Concluir a vistoria',
    concluida: 'Vistoria fechada'
  };

  /* ==========================================================
     6 · AÇÕES (§7, por analogia)
     ----------------------------------------------------------
     A vistoria concluída é PROVA e não se edita. Deixar
     "editar" disponível numa vistoria fechada seria abrir a
     porta para alguém corrigir o passado depois de o cliente
     ter batido o carro — e aí o documento não serve para nada.
     O que se pode fazer numa vistoria fechada é CONFERIR e
     IMPRIMIR.
     ========================================================== */
  var acoesDe = function (v) {
    var concluida = v.status === 'concluida';
    var motivoFechada = 'A vistoria já foi concluída. Ela é a prova do estado do veículo ' +
      'naquele dia — por isso não se edita depois. Um erro de leitura se corrige com uma ' +
      'vistoria nova, que fica registrada com data e hora.';

    return [
      {
        id: 'registrar',
        rotulo: concluida ? 'Vistoria já concluída' : 'Concluir esta vistoria',
        tom: 'pri',
        liberada: !concluida,
        motivo: concluida ? motivoFechada : ''
      },
      {
        id: 'copiar',
        rotulo: 'Copiar o laudo',
        tom: 'out',
        liberada: true,
        motivo: 'Disponível em qualquer situação: é só a leitura do que ficou registrado.'
      },
      {
        id: 'imprimir',
        rotulo: 'Imprimir',
        tom: 'out',
        liberada: true,
        motivo: 'Disponível em qualquer situação: a via impressa é a cópia que se entrega ao cliente.'
      }
    ];
  };

  var htmlAcoes = function (v) {
    return acoesDe(v).map(function (a) {
      return U.botao(a.rotulo, a.id, a.tom, { id: v.id }, !a.liberada, a.motivo);
    }).join('');
  };

  var htmlFicha = function (v) {
    return U.pageHead('Vistoria ' + v.codigo,
      rotuloTipo(v.tipo) + ' · ' + U.nomeCliente(v.clienteId) + ' · ' + D.fmtData(v.data),
      U.botao('Voltar para a lista', 'voltar', 'out')) +
      '<div class="acts u-mb">' + htmlAcoes(v) + '</div>' +
      '<div class="grid2">' +
        blocoProtocolo(v) +
        blocoObservacoes(v) +
      '</div>' +
      blocoAreas(v) +
      blocoPar(v);
  };

  /* ==========================================================
     7 · O LAUDO EM TEXTO
     ----------------------------------------------------------
     "Copiar o laudo" monta o mesmo conteúdo em texto puro. Não
     existe segunda fonte: o texto sai dos MESMOS campos que a
     tela desenha.
     ========================================================== */
  var linha = function (rot, val) { return rot + ': ' + val; };

  var laudo = function (v) {
    var veic = S.veiculo(v.veiculoId);
    var partes = [];

    partes.push('LOK CAR — LAUDO DE VISTORIA DE VEÍCULO');
    partes.push('Vistoria ' + v.codigo + ' · ' + rotuloTipo(v.tipo));
    partes.push('');
    partes.push(linha('Cliente', U.nomeCliente(v.clienteId)));
    partes.push(linha('Veículo', veic ? veic.modelo + ' · ' + veic.placa : 'não encontrado'));
    partes.push(linha('Data', D.fmtData(v.data) + (v.hora ? ' às ' + v.hora : '')));
    partes.push(linha('Quilometragem', v.km === null || v.km === undefined
      ? 'a informar' : Number(v.km).toLocaleString('pt-BR') + ' km'));
    partes.push(linha('Combustível', v.combustivel || 'a informar'));
    partes.push(linha('Situação', D.STATUS_VISTORIA[D.statusDaVistoria(v)].rotulo));
    partes.push('');
    partes.push('ÁREAS');
    D.AREAS_VISTORIA.forEach(function (a) {
      var at = (v.areas && v.areas[a]) || null;
      partes.push('  ' + a + ': ' + (at && at.observacao ? at.observacao : 'sem avaria aparente'));
    });
    partes.push('');
    partes.push(linha('Observação geral', v.obs || 'nenhuma'));
    partes.push('');
    partes.push('As fotos por área não fazem parte desta via: o anexo de imagem depende do ' +
                'armazenamento de arquivos, que não está integrado nesta fase.');

    return partes.join('\n');
  };

  var copiar = function (v) {
    var texto = laudo(v);
    var nav = window.navigator;

    if (nav && nav.clipboard && nav.clipboard.writeText) {
      try {
        nav.clipboard.writeText(texto);
        U.canto('Laudo de ' + v.codigo + ' copiado — ' + texto.split('\n').length +
          ' linhas, do protocolo às seis áreas.', 'ok');
        return;
      } catch (e) { /* segue para o plano B */ }
    }

    U.abrirModal({
      titulo: 'Laudo de ' + v.codigo,
      sub: 'Selecione o texto abaixo e copie com Ctrl+C.',
      largo: true,
      corpo: '<textarea class="fld__txt" readonly style="min-height:44vh" ' +
             'data-campo="laudo">' + esc(texto) + '</textarea>' +
             '<p class="u-xs u-t4 u-mt">Esta janela existe porque a área de transferência do ' +
             'navegador não está disponível aqui. No aplicativo publicado o botão copia direto.</p>',
      botoes: [{ rotulo: 'Fechar', tom: 'out', acao: 'x' }],
      aoClicar: function (acao, bt, fechar) { fechar(); }
    });
  };

  var imprimir = function (v) {
    U.abrirModal({
      titulo: 'Imprimir o laudo de ' + v.codigo,
      sub: 'A folha sai pela impressão do navegador.',
      corpo:
        '<p class="u-sm">A vistoria vai para o papel em folha limpa, sem o menu, sem a barra ' +
        'lateral e sem os botões — o mesmo tratamento que o contrato recebe.</p>' +
        '<p class="u-xs u-t4 u-mt">Se a janela de impressão não abrir sozinha, use ' +
        '<b>Ctrl+P</b> (' + '<b>Cmd+P</b> no Mac).</p>',
      botoes: [
        { rotulo: 'Fechar', tom: 'out', acao: 'x' },
        { rotulo: 'Abrir a impressão', tom: 'pri', acao: 'imprimir' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'imprimir') return fechar();
        fechar();
        if (window.print) {
          window.print();
        } else {
          U.canto('A impressão é do navegador. Disponível após integração do backend.', 'aviso');
        }
      }
    });
  };

  /* ==========================================================
     8 · CONCLUIR A VISTORIA
     ----------------------------------------------------------
     Quilometragem e combustível são obrigatórios, e é a FUNÇÃO
     que exige — não só a tela. A tela reforça: se algum dos dois
     falta, o botão de concluir já entra desabilitado com o
     motivo escrito, em vez de aceitar o clique e devolver um
     erro depois de o operador preencher seis áreas.
     ========================================================== */
  var abrirConcluir = function (v) {
    var veic = S.veiculo(v.veiculoId);

    U.abrirModal({
      titulo: 'Concluir a vistoria ' + v.codigo,
      sub: rotuloTipo(v.tipo) + ' · ' + (veic ? veic.modelo + ' · ' + veic.placa : 'veículo') +
        ' · ' + D.AREAS_VISTORIA.length + ' áreas',
      largo: true,
      corpo:
        '<div class="grid3">' +
          U.fld('Data', 'date', 'data', v.data || D.HOJE) +
          U.fld('Hora', 'time', 'hora', v.hora || '') +
          U.fld('Quilometragem lida', 'number', 'km',
            v.km === null || v.km === undefined ? '' : v.km, 'O que marca o painel hoje') +
        '</div>' +
        '<div class="grid2 u-mt">' +
          U.fldSel('Combustível', 'combustivel',
            [{ valor: '', rotulo: 'Não informado' }].concat(D.NIVEIS_COMBUSTIVEL.map(function (n) {
              return { valor: n, rotulo: n };
            })), v.combustivel || '') +
        '</div>' +
        '<p class="fld__lbl u-mt-lg">Áreas</p>' +
        '<p class="u-xs u-t4 u-mb">A observação escrita é o que esta fase guarda. ' +
        'As fotos por área continuam dependendo do armazenamento de arquivos.</p>' +
        '<div class="grid2">' + D.AREAS_VISTORIA.map(function (a) {
          var at = (v.areas && v.areas[a]) || { observacao: '' };
          return U.fld(a, 'text', 'area-' + a, at.observacao, 'Sem avaria aparente');
        }).join('') + '</div>' +
        U.fldTxt('Observação geral', 'obs', v.obs,
          'Avaria, item esquecido no veículo, condição dos pneus'),
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Concluir vistoria', tom: 'pri', acao: 'salvar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'salvar') return;

        var campos = U.lerCampos();
        var areas = {};
        D.AREAS_VISTORIA.forEach(function (a) {
          var antes = (v.areas && v.areas[a]) || null;
          var obs = campos['area-' + a] || '';
          areas[a] = {
            observacao: obs,
            /* As fotos já existentes são preservadas. O campo não
               existe nesta fase, mas apagar o que houver seria
               destruir dado alheio. */
            fotos: antes ? antes.fotos : null
          };
        });

        var r = S.salvarVistoria(v.id, {
          hora: campos.hora,
          km: campos.km === '' || campos.km === undefined ? null : Number(campos.km),
          combustivel: campos.combustivel,
          areas: areas,
          obs: campos.obs,
          concluir: true
        });

        /* A recusa da função NÃO fecha a janela: o operador
           acabou de preencher seis áreas e perderia tudo. */
        if (r.ok === false) {
          U.canto(r.mensagem, 'erro');
          return;
        }

        fechar();
        U.resultado(r);
        U.desenhar();
      }
    });
  };

  /* ==========================================================
     9 · A TELA
     ========================================================== */
  var htmlTela = function () {
    if (ctx && ctx.alvo) {
      var v = S.vistoria(ctx.alvo);
      if (!v) {
        return U.pageHead('Vistoria não encontrada',
          'O código que veio no endereço não existe na base.',
          U.botao('Voltar para a lista', 'voltar', 'out')) +
          '<div class="card">' + U.vazio('Vistoria não encontrada',
            'A vistoria ' + ctx.alvo + ' não está na base. Ela pode ter sido criada em outra ' +
            'sessão e não estar mais aqui.', U.botao('Ver todas as vistorias', 'voltar', 'out')) + '</div>';
      }
      return htmlFicha(v);
    }

    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);

    return U.pageHead('Vistorias',
      'O acervo das vistorias de saída e de devolução, com as seis áreas do pedido. A vistoria ' +
      'concluída é somente leitura: ela é a prova do estado do veículo naquele dia — ' +
      'uma correção de leitura se faz com uma vistoria nova, que fica registrada com data e hora.',
      U.botao('Nova vistoria', 'nova', 'pri')) +
      htmlCards() +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));
    slot.innerHTML = lista.length ? htmlTabela(lista) : htmlVazio();
    if (cont) cont.textContent = lista.length;

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
        if (ev.preventDefault) ev.preventDefault();
        U.navegar('#/vistorias/' + linha.getAttribute('data-abre'));
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
        U.navegar('#/vistorias' + (!f || f === 'todas' ? '' : '?f=' + f));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'voltar':
        U.navegar('#/vistorias');
        return;

      case 'ir': {
        var para = alvo.getAttribute('data-para') || alvo.getAttribute('href');
        if (para) U.navegar(para);
        return;
      }

      case 'ver': {
        if (id) U.navegar('#/vistorias/' + id);
        return;
      }

      case 'registrar': {
        var v = id ? S.vistoria(id) : (ctx && ctx.alvo ? S.vistoria(ctx.alvo) : null);
        if (!v) { U.canto('Esta vistoria não está mais na base.', 'aviso'); return; }
        abrirConcluir(v);
        return;
      }

      case 'copiar': {
        var vc = id ? S.vistoria(id) : (ctx && ctx.alvo ? S.vistoria(ctx.alvo) : null);
        if (!vc) { U.canto('Esta vistoria não está mais na base.', 'aviso'); return; }
        copiar(vc);
        return;
      }

      case 'imprimir': {
        var vi = id ? S.vistoria(id) : (ctx && ctx.alvo ? S.vistoria(ctx.alvo) : null);
        if (!vi) { U.canto('Esta vistoria não está mais na base.', 'aviso'); return; }
        imprimir(vi);
        return;
      }

      case 'nova': {
        /* Criar vistoria do zero só faz sentido ligada a uma
           reserva ou a uma locação: sem origem não há cliente,
           veículo nem data de compromisso. Em vez de um
           formulário solto, a tela manda para onde a vistoria
           nasce. */
        var orfas = D.VISTORIAS.filter(function (x) { return x.status !== 'concluida'; });
        U.abrirModal({
          titulo: 'Onde nasce uma vistoria',
          sub: 'A vistoria não é criada solta: ela pertence a uma reserva ou a uma locação.',
          corpo:
            '<p class="u-sm">É a reserva que traz o cliente, o veículo e a data — e é a locação ' +
            'que define se a vistoria é de <b>saída</b> ou de <b>devolução</b>. Criar uma ' +
            'vistoria sem origem produziria um laudo sem dono.</p>' +
            (orfas.length
              ? '<p class="u-sm u-mt">' + orfas.length +
                (orfas.length === 1 ? ' vistoria está pendente e pode ser concluída agora:'
                                    : ' vistorias estão pendentes e podem ser concluídas agora:') +
                '</p><ul class="u-sm u-mt">' + orfas.map(function (x) {
                  return '<li><a class="ab" href="#/vistorias/' + x.id + '" data-acao="ir" ' +
                         'data-para="#/vistorias/' + x.id + '">' + esc(x.codigo) + '</a> ' +
                         esc(rotuloTipo(x.tipo)) + ' · ' + esc(U.nomeCliente(x.clienteId)) + '</li>';
                }).join('') + '</ul>'
              : '<p class="u-sm u-mt u-t4">Nenhuma vistoria pendente no momento.</p>') +
            '<p class="u-xs u-t4 u-mt-lg">No fluxo completo, a vistoria é criada sozinha nos ' +
            'passos "Iniciar locação" e "Finalizar locação", na ficha da reserva e da locação.</p>',
          botoes: [{ rotulo: 'Entendi', tom: 'out', acao: 'x' }],
          aoClicar: function (a, bt, fechar) { fechar(); }
        });
        return;
      }

      default:
        U.canto('Disponível após integração do backend.', 'aviso');
    }
  });
};
