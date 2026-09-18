/* ============================================================
   LOK CAR — SISTEMA · telas/ocorrencias.js
   ------------------------------------------------------------
   § do menu GESTÃO: "O que saiu do roteiro."

   POR QUE ESTA TELA EXISTE SEPARADA DE MANUTENÇÕES
   ------------------------------------------------------------
   Manutenção é o carro na oficina: um serviço agendado, com
   custo, oficina e previsão. Ocorrência é outra coisa — é o que
   NÃO ESTAVA NO PLANO. Um risco achado na devolução, o tanque
   abaixo do nível de saída, uma reserva marcada para um carro
   que está parado, um documento vencido que tirou o carro de
   circulação. Nenhuma dessas coisas é um serviço; todas elas
   exigem uma DECISÃO de alguém.

   É por isso que a ocorrência tem três estados e não cinco:
   aberta (ninguém olhou), em análise (alguém está decidindo) e
   resolvida (decidido). O que a tela tem de mostrar com clareza
   é quanto tempo cada uma está parada — uma ocorrência aberta há
   nove dias é uma decisão que ninguém tomou, e é isso que
   corrói a operação.

   O VALOR A COBRAR
   ------------------------------------------------------------
   A ocorrência de combustível da base diz, no próprio texto, que
   a diferença a cobrar depende da política de combustível, que
   está NÃO CONFIGURADA. A tentação é calcular um número — litros
   × preço — e é exatamente o que o §25 proíbe. A tela mostra o
   que falta e leva ao campo que resolve, em vez de inventar um
   valor.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.ocorrencias = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  var AVISO_API = 'Disponível após integração do backend.';

  /* ==========================================================
     1 · A QUANTOS DIAS ELA ESTÁ PARADA
     ----------------------------------------------------------
     `diffDias(data, hoje)` positivo = a data é anterior a hoje.
     A ocorrência nasce quando o fato acontece; o que a torna
     grave não é o fato, é o tempo desde ele.
     ========================================================== */
  var idade = function (o) {
    return Math.abs(D.diffDias(o.data, D.HOJE));
  };

  var parada = function (o) {
    var dias = idade(o);
    var texto = dias === 0 ? 'hoje'
              : dias === 1 ? 'há 1 dia'
              : 'há ' + dias + ' dias';

    /* Em análise, o tempo é esperado — alguém está decidindo. É
       o estado NATURAL de uma ocorrência em andamento, e pintá-lo
       de vermelho ensinaria o operador a ignorar o vermelho. */
    if (o.status === 'resolvida') {
      return { texto: texto, tom: 'idle', dias: dias };
    }
    if (o.status === 'analise') {
      return { texto: texto, tom: dias > 7 ? 'warn' : 'idle', dias: dias };
    }
    return { texto: texto, tom: dias >= 5 ? 'bad' : (dias >= 2 ? 'warn' : 'idle'), dias: dias };
  };

  /* ==========================================================
     2 · O QUE PRECISA SER DECIDIDO ANTES DE MEXER NO CARRO
     ----------------------------------------------------------
     Uma ocorrência de veículo pode exigir uma manutenção nova —
     o risco na roda vira orçamento de funilaria. O sistema NÃO
     cria essa manutenção sozinho: quem decide se o risco vira
     serviço é a oficina, não a tela. O que a tela faz é dizer
     se já existe uma manutenção aberta para aquele carro, para
     o operador não abrir a segunda.
     ========================================================== */
  var manutencaoDoVeiculo = function (veiculoId) {
    var abertas = S.estado.manutencoes.filter(function (m) {
      return m.veiculoId === veiculoId && m.status !== 'concluida';
    });
    return abertas.length ? abertas[0] : null;
  };

  /* ==========================================================
     3 · DE ONDE VEIO A OCORRÊNCIA
     ----------------------------------------------------------
     Uma ocorrência sem vínculo nenhum é uma nota solta — e uma
     nota solta é uma decisão que ninguém vai conseguir tomar
     depois, porque não há a que amarrá-la. Aqui a tela tenta
     reconstruir o vínculo a partir do que existe: reserva,
     locação, veículo e cliente.
     ========================================================== */
  var vinculosDe = function (o) {
    var v = o.veiculoId ? S.veiculo(o.veiculoId) : null;
    var r = o.reserva ? S.reserva(o.reserva) : null;
    var l = o.locacao ? S.locacao(o.locacao) : null;
    var c = o.clienteId ? S.cliente(o.clienteId) : null;

    return {
      veiculo: v, reserva: r, locacao: l, cliente: c,
      quantos: [v, r, l, c].filter(Boolean).length
    };
  };

  /* ==========================================================
     4 · AGRUPAMENTO POR TIPO
     ----------------------------------------------------------
     "Veículo preso em manutenção", "Combustível", "Avaria" e
     "Documentação" são quatro problemas com quatro donos
     diferentes dentro da locadora: frota, conferência de
     devolução, oficina e administrativo. Listar tudo numa pilha
     só esconde qual área está devendo.
     ========================================================== */
  var tipos = function () {
    var vistos = [];
    S.estado.ocorrencias.forEach(function (o) {
      if (vistos.indexOf(o.tipo) === -1) vistos.push(o.tipo);
    });
    return vistos;
  };

  var TIPOS = tipos();

  var quantasDoTipo = function (t) {
    return S.estado.ocorrencias.filter(function (o) { return o.tipo === t; }).length;
  };

  /* ==========================================================
     5 · LISTA, FILTROS E BUSCA
     ========================================================== */
  var abertas = function () {
    return S.estado.ocorrencias.filter(function (o) { return o.status !== 'resolvida'; });
  };

  var abertasHa5 = function () {
    return abertas().filter(function (o) {
      var p = parada(o);
      return o.status === 'aberta' && p.dias >= 5;
    });
  };

  /* Ordenação: o que está aberto e velho primeiro. Uma
     ocorrência resolvida há dez dias não interessa a quem abre a
     tela hoje, e ela não deve empurrar a de ontem para baixo. */
  var ordenar = function (lista) {
    return lista.slice().sort(function (a, b) {
      var ra = a.status === 'resolvida' ? 1 : 0;
      var rb = b.status === 'resolvida' ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return D.diffDias(b.data, a.data);
    });
  };

  var ABAS = [
    { id: 'todas',     rotulo: 'Todas',       teste: function () { return true; } },
    { id: 'aberta',    rotulo: 'Abertas',     teste: function (o) { return o.status === 'aberta'; } },
    { id: 'analise',   rotulo: 'Em análise',  teste: function (o) { return o.status === 'analise'; } },
    { id: 'resolvida', rotulo: 'Resolvidas',  teste: function (o) { return o.status === 'resolvida'; } },
    { id: 'paradas',   rotulo: 'Paradas há 5 dias',
      teste: function (o) {
        return o.status === 'aberta' && parada(o).dias >= 5;
      } }
  ];

  var filtroDe = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return ABAS[0];
  };

  var BUSCA = params.q ? String(params.q) : '';
  var TIPO = params.t ? String(params.t) : '';

  var normalizar = function (v) {
    var t = String(v === null || v === undefined ? '' : v).toLowerCase();
    return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
  };

  var alvosDe = function (o) {
    var v = vinculosDe(o);
    return [
      o.tipo, o.descricao,
      v.veiculo ? v.veiculo.modelo : '',
      v.veiculo ? v.veiculo.placa : '',
      v.reserva ? v.reserva.codigo : '',
      v.locacao ? v.locacao.codigo : '',
      v.cliente ? U.nomeCliente(v.cliente.id) : ''
    ].filter(Boolean);
  };

  var combinaBusca = function (o, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;
    var texto = alvosDe(o).map(normalizar).join(' ');
    return termos.every(function (t) { return texto.indexOf(t) !== -1; });
  };

  var filtrar = function (filtro) {
    return ordenar(S.estado.ocorrencias.filter(function (o) {
      if (!filtro.teste(o)) return false;
      if (TIPO && o.tipo !== TIPO) return false;
      return combinaBusca(o, BUSCA);
    }));
  };

  var contar = function (filtro) {
    return S.estado.ocorrencias.filter(function (o) {
      if (!filtro.teste(o)) return false;
      return !TIPO || o.tipo === TIPO;
    }).length;
  };

  /* ==========================================================
     6 · NÚMEROS DO TOPO
     ========================================================== */
  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist">' + ABAS.map(function (a) {
      return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" data-f="' + a.id + '"' +
             (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
             esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
    }).join('') + '</div>';
  };

  var cartao = function (titulo, valor, nota, tom) {
    return '<div class="kpi">' +
      '<p class="kpi__key">' + esc(titulo) + '</p>' +
      '<p class="kpi__val' + (tom ? ' kpi__val--' + tom : '') + '">' + valor + '</p>' +
      (nota ? '<p class="kpi__nota">' + nota + '</p>' : '') +
      '</div>';
  };

  var htmlCards = function () {
    var lista = S.estado.ocorrencias;
    var por = function (st) {
      return lista.filter(function (o) { return o.status === st; }).length;
    };
    var velhas = abertasHa5();

    return '<div class="kpis kpis--4">' +
      cartao('Abertas', por('aberta'),
        'Ninguém olhou ainda — é onde a decisão está faltando') +
      cartao('Em análise', por('analise'),
        'Alguém está decidindo o que fazer') +
      cartao('Paradas há 5 dias ou mais', velhas.length,
        velhas.length
          ? 'Decisão pendente há mais de uma semana'
          : 'Nenhuma ocorrência envelhecendo em aberto',
        velhas.length ? 'bad' : '') +
      cartao('Resolvidas', por('resolvida'),
        'Fechadas — o histórico que explica decisões futuras') +
      '</div>' +
      htmlTipos();
  };

  /* Os quatro tipos são atalhos de verdade: levam à lista já
     recortada. Um cartão que não leva a lugar nenhum seria um
     número que o operador lê e não pode usar. */
  var ICO_TIPO =
    '<svg class="atalho__ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M10.3 4l8 14H2.3zM12 10v4M12 17v.01"/></svg>';

  var htmlTipos = function () {
    if (!TIPOS.length) return '';

    return '<div class="atalhos u-mt-lg">' + TIPOS.map(function (t) {
      var lista = S.estado.ocorrencias.filter(function (o) { return o.tipo === t; });
      var emAberto = lista.filter(function (o) { return o.status !== 'resolvida'; }).length;
      var ativo = TIPO === t;

      return '<a class="atalho" href="#/ocorrencias?t=' + encodeURIComponent(t) + '" ' +
        'data-acao="filtrar-tipo" data-t="' + esc(t) + '"' +
        (ativo ? ' aria-current="true"' : '') + '>' +
        ICO_TIPO +
        '<b>' + esc(t) + '</b>' +
        '<span>' +
          (emAberto
            ? emAberto + (emAberto === 1 ? ' em aberto' : ' em aberto') +
              ' · ' + lista.length + (lista.length === 1 ? ' no total' : ' no total')
            : 'Nada em aberto · ' + lista.length +
              (lista.length === 1 ? ' registrada' : ' registradas')) +
        '</span>' +
        '</a>';
    }).join('') + '</div>';
  };

  /* ==========================================================
     7 · TABELA
     ========================================================== */
  var celulaOrigem = function (o) {
    var v = vinculosDe(o);
    var partes = [];

    if (v.reserva) {
      partes.push('<a class="ab" href="#/reservas/' + esc(v.reserva.id) + '" ' +
        'data-acao="ir" data-para="#/reservas/' + esc(v.reserva.id) + '">' +
        esc(v.reserva.codigo) + '</a>');
    }
    if (v.locacao) {
      partes.push('<a class="ab" href="#/locacoes/' + esc(v.locacao.id) + '" ' +
        'data-acao="ir" data-para="#/locacoes/' + esc(v.locacao.id) + '">' +
        esc(v.locacao.codigo) + '</a>');
    }

    if (!partes.length) return '<span class="tbl__dim">sem reserva nem locação</span>';
    return partes.join(' ');
  };

  var celulaVeiculo = function (o) {
    var v = o.veiculoId ? S.veiculo(o.veiculoId) : null;
    if (!v) return '<span class="tbl__dim">—</span>';
    return '<a class="ab" href="#/frota/' + esc(v.id) + '" ' +
      'data-acao="ir" data-para="#/frota/' + esc(v.id) + '">' + esc(v.modelo) + '</a>' +
      '<span class="tbl__dim mono">' + esc(v.placa) + '</span>';
  };

  var htmlLinha = function (o) {
    var p = parada(o);
    var st = D.acharStatus(D.STATUS_OCORRENCIA, o.status);

    return '<tr data-abre="' + esc(o.id) + '">' +
      '<td><span class="u-b">' + esc(o.tipo) + '</span>' +
        '<span class="tbl__dim">' +
        esc(o.descricao.length > 78 ? o.descricao.slice(0, 78) + '…' : o.descricao) +
        '</span></td>' +
      '<td>' + celulaVeiculo(o) + '</td>' +
      '<td>' + celulaOrigem(o) + '</td>' +
      '<td><span class="u-tab">' + D.fmtData(o.data) + '</span>' +
        '<span class="tbl__dim">' + esc(p.texto) + '</span></td>' +
      '<td>' + U.cracha(D.STATUS_OCORRENCIA, o.status) + '</td>' +
      '<td><div class="tbl__acts">' +
        '<a class="ab' + (o.status === 'resolvida' ? '' : ' ab--pri') + '" ' +
        'href="#/ocorrencias/' + esc(o.id) + '" data-acao="ver" data-id="' + esc(o.id) + '">' +
        (o.status === 'resolvida' ? 'Ver' : 'Decidir') + '</a>' +
      '</div></td>' +
      '</tr>';
  };

  var htmlTabela = function (lista) {
    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Ocorrência</th><th>Veículo</th><th>Reserva / Locação</th>' +
        '<th>Registrada</th><th>Situação</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(htmlLinha).join('') + '</tbody>' +
      '</table></div>';
  };

  var htmlVazio = function () {
    var recorte = TIPO ? ' do tipo “' + TIPO + '”' : '';
    return U.vazio(
      BUSCA ? 'Nenhuma ocorrência encontrada' : 'Nenhuma ocorrência nesta situação',
      BUSCA
        ? 'Nenhuma ocorrência casa com “' + BUSCA + '”. A busca olha o tipo, a descrição, o ' +
          'veículo, a placa, a reserva, a locação e o cliente.'
        : 'Nenhuma ocorrência' + recorte + ' está nesta situação.',
      (BUSCA || TIPO)
        ? '<div class="acts" style="justify-content:center">' +
          (BUSCA ? U.botao('Limpar busca', 'limpar', 'out') : '') +
          (TIPO ? U.botao('Ver todos os tipos', 'limpar-tipo', 'out') : '') +
          '</div>'
        : ''
    );
  };

  var htmlLista = function (filtro, lista) {
    return '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar ocorrências por situação">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'ocorrência' : 'ocorrências') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Tipo, descrição, veículo, placa ou reserva" ' +
             'aria-label="Buscar ocorrência"/>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div data-slot="lista">' + (lista.length ? htmlTabela(lista) : htmlVazio()) + '</div>';
  };

  /* ==========================================================
     8 · A FICHA
     ========================================================== */
  var ICO = {
    dados:    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3 4-5 8-5s8 2 8 5',
    veiculo:  'M4 16h16M5 16V11l2-5h10l2 5v5M7.5 19h.01M16.5 19h.01',
    decisao:  'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9'
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

  var corpo = function (html) { return '<div class="bloco__b">' + html + '</div>'; };

  var ficha = function (linhas) {
    return '<dl class="ficha">' + linhas.map(function (l) {
      return '<div><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>';
    }).join('') + '</dl>';
  };

  var blocoSituacao = function (o) {
    var p = parada(o);
    var st = D.acharStatus(D.STATUS_OCORRENCIA, o.status);

    var conteudo = '<div class="bloco__destaque">' +
      '<span class="bdg bdg--' + st.tom + '">' + esc(st.rotulo) + '</span> — ' +
      'registrada ' + esc(p.texto) + ', em ' + esc(D.fmtData(o.data)) + '.' +
      '</div>';

    if (o.status === 'aberta') {
      conteudo += '<p class="u-sm u-t2 u-mt">' +
        'Ninguém registrou ainda o que vai ser feito. Enquanto a ocorrência estiver aberta, ' +
        'não existe decisão — e é a decisão que libera o carro ou fecha a cobrança.' +
        '</p>';
    }
    if (o.status === 'analise') {
      conteudo += '<p class="u-sm u-t2 u-mt">' +
        'Em análise: alguém já pegou a ocorrência para decidir. O tempo aqui é esperado, ' +
        'não é atraso.' +
        '</p>';
    }
    if (o.status === 'resolvida') {
      conteudo += '<p class="u-sm u-t2 u-mt">' +
        'Resolvida. O texto abaixo é o que ficou registrado do fato — ele não é reescrito ' +
        'quando a ocorrência fecha, porque é justamente ele que explica a decisão depois.' +
        '</p>';
    }

    return bloco('dados', 'Situação', corpo(conteudo),
      p.dias + (p.dias === 1 ? ' dia' : ' dias') + ' desde o registro');
  };

  var blocoRelato = function (o) {
    return bloco('dados', 'O que aconteceu', corpo(
      '<p class="bloco__destaque">' + esc(o.tipo) + '</p>' +
      '<p class="u-sm u-t2">' + esc(o.descricao) + '</p>'
    ), 'o relato original');
  };

  /* ----------------------------------------------------------
     BLOCO "O QUE FALTA PARA DECIDIR"

     A ocorrência de combustível da base diz que a diferença a
     cobrar depende de uma política NÃO CONFIGURADA. Mostrar isso
     e parar aí deixa o operador sem saída. Aqui a tela procura a
     regra que resolveria o caso e leva direto ao campo — o mesmo
     endereço que o contrato escreve quando o operador clica num
     [A DEFINIR] dentro do documento.
     ---------------------------------------------------------- */
  var regraQueResolve = function (o) {
    var chave = normalizar(o.tipo + ' ' + o.descricao);
    var procuradas = [];

    if (chave.indexOf('combustivel') !== -1) procuradas = ['combustivel'];
    else if (chave.indexOf('avaria') !== -1 || chave.indexOf('risco') !== -1 ||
             chave.indexOf('dano') !== -1) procuradas = ['franquia', 'caucao'];
    else if (chave.indexOf('atraso') !== -1) procuradas = ['multaAtraso', 'toleranciaAtraso', 'juros'];
    else if (chave.indexOf('documenta') !== -1) procuradas = [];

    for (var i = 0; i < procuradas.length; i++) {
      for (var j = 0; j < D.REGRAS.length; j++) {
        if (D.REGRAS[j].id === procuradas[i] && D.REGRAS[j].valor === null) return D.REGRAS[j];
      }
    }
    return null;
  };

  var blocoFalta = function (o) {
    var r = regraQueResolve(o);

    if (!r) {
      /* Documentação não tem regra contratual que a resolva: o
         que falta ali é o documento, e o lugar do documento é a
         tela de documentos. */
      if (normalizar(o.tipo).indexOf('documenta') !== -1) {
        return bloco('decisao', 'O que falta para resolver', corpo(
          '<p class="u-sm u-t2">Esta ocorrência depende de regularizar a documentação do ' +
          'veículo. O controle do que falta e do que vence fica na tela de Documentos.</p>' +
          '<div class="acts u-mt">' +
            '<a class="bt bt--out" href="#/documentos">Ver os documentos</a>' +
          '</div>'
        ), 'depende de um documento');
      }
      return '';
    }

    return bloco('decisao', 'O que falta para resolver', corpo(
      '<div class="aviso">' +
      '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 3l9 16H3zM12 9v5M12 17v.01"/></svg>' +
      '<span><b>Não há valor a cobrar ainda.</b> Esta ocorrência depende da política de ' +
      '<i>' + esc(r.nome) + '</i>, que está <b>não configurada</b>. O sistema não calcula um ' +
      'número a partir de uma política que ninguém definiu — qualquer valor que ele ' +
      'mostrasse aqui seria inventado.</span></div>' +
      '<div class="acts u-mt">' +
        '<a class="bt bt--pri" href="#/configuracoes?campo=' + encodeURIComponent(r.id) + '">' +
        'Configurar ' + esc(r.nome) + '</a>' +
      '</div>'
    ), 'depende de uma configuração');
  };

  var blocoVeiculo = function (o) {
    var v = o.veiculoId ? S.veiculo(o.veiculoId) : null;
    if (!v) return '';

    var st = D.acharStatus(D.STATUS_FROTA, v.status);
    var manut = manutencaoDoVeiculo(v.id);
    var reservasFuturas = S.estado.reservas.filter(function (r) {
      return r.veiculoId === v.id && r.status !== 'cancelada' && r.status !== 'finalizada' &&
             D.diffDias(D.HOJE, r.de) >= 0;
    });

    var conteudo = ficha([
      ['Veículo', '<a href="#/frota/' + esc(v.id) + '">' + esc(v.modelo) + '</a>'],
      ['Placa', '<span class="mono">' + esc(v.placa) + '</span>'],
      ['Categoria', esc(v.categoria)],
      ['Situação na frota', '<span class="bdg bdg--' + st.tom + '">' + esc(st.rotulo) + '</span>'],
      ['Manutenção aberta', manut
        ? '<a href="#/manutencoes/' + esc(manut.id) + '">' + esc(manut.alerta) + '</a> · ' +
          esc(D.acharStatus(D.STATUS_MANUTENCAO, manut.status).rotulo)
        : '<span class="u-t4">nenhuma</span>'],
      ['Reservas futuras', reservasFuturas.length
        ? reservasFuturas.map(function (r) {
            return '<a href="#/reservas/' + esc(r.id) + '">' + esc(r.codigo) + '</a> (' +
                   esc(D.fmtData(r.de)) + ')';
          }).join(', ')
        : '<span class="u-t4">nenhuma marcada</span>']
    ]);

    if (reservasFuturas.length && (v.status === 'manutencao' || v.status === 'indisponivel')) {
      conteudo += '<div class="aviso u-mt">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 3l9 16H3zM12 9v5M12 17v.01"/></svg>' +
        '<span><b>Este carro está fora de circulação e tem reserva marcada.</b> São ' +
        reservasFuturas.length + (reservasFuturas.length === 1
          ? ' compromisso que precisa' : ' compromissos que precisam') +
        ' de outro veículo ou de uma data nova — e é uma decisão com prazo, não uma ' +
        'observação.</span></div>';
    }

    return bloco('veiculo', 'O veículo', corpo(conteudo), 'o que a ocorrência atinge');
  };

  var blocoVinculos = function (o) {
    var v = vinculosDe(o);
    var linhas = [];

    if (v.reserva) {
      linhas.push(['Reserva',
        '<a href="#/reservas/' + esc(v.reserva.id) + '">' + esc(v.reserva.codigo) + '</a> · ' +
        esc(D.fmtData(v.reserva.de)) + ' a ' + esc(D.fmtData(v.reserva.ate)) + ' · ' +
        esc(D.acharStatus(D.STATUS_RESERVA, v.reserva.status).rotulo)]);
    }

    if (v.locacao) {
      linhas.push(['Locação',
        '<a href="#/locacoes/' + esc(v.locacao.id) + '">' + esc(v.locacao.codigo) + '</a> · ' +
        esc(D.acharStatus(D.STATUS_LOCACAO, v.locacao.status).rotulo)]);
    }

    if (v.cliente) {
      linhas.push(['Cliente',
        '<a href="#/clientes/' + esc(v.cliente.id) + '">' + esc(U.nomeCliente(v.cliente.id)) +
        '</a>']);
    }

    if (!linhas.length) {
      return bloco('dados', 'Ligado a', corpo(
        '<p class="u-sm u-t2">Esta ocorrência não está presa a uma reserva, a uma locação nem ' +
        'a um cliente. É um registro da operação sobre um veículo.</p>'), 'sem vínculo');
    }

    return bloco('dados', 'Ligado a', corpo(ficha(linhas)),
      linhas.length + (linhas.length === 1 ? ' vínculo' : ' vínculos'));
  };

  /* ==========================================================
     9 · AÇÕES
     ----------------------------------------------------------
     Três botões, um por transição. "Resolver" some quando já
     está resolvida, e "Reabrir" só aparece nesse caso: uma
     ocorrência resolvida por engano precisa de saída, e apagar
     o registro seria perder o fato.

     Todas as três gravam DE VERDADE — `resolverOcorrencia` é uma
     função da sessão, não do backend. O que NÃO existe nesta
     fase é cobrar o valor ou abrir a manutenção: essas duas
     dependem de dados que a locadora ainda não definiu.
     ========================================================== */
  var acoesDe = function (o) {
    var lista = [];

    if (o.status === 'aberta') {
      lista.push({ id: 'analisar', rotulo: 'Marcar em análise', tom: 'out',
        liberada: true, motivo: '' });
    }

    if (o.status !== 'resolvida') {
      lista.push({ id: 'resolver', rotulo: 'Resolver ocorrência', tom: 'pri',
        liberada: true, motivo: '' });
    }

    if (o.status === 'resolvida') {
      lista.push({ id: 'reabrir', rotulo: 'Reabrir', tom: 'out',
        liberada: true, motivo: '' });
    }

    lista.push({ id: 'cobrar', rotulo: 'Gerar cobrança', tom: 'sil',
      liberada: false,
      motivo: 'Gerar a cobrança exige a política de preço e o lançamento no financeiro. ' +
              AVISO_API });

    return lista;
  };

  var htmlAcoes = function (o) {
    return acoesDe(o).map(function (a) {
      return U.botao(a.rotulo, a.id, a.tom, { id: o.id }, !a.liberada, a.motivo);
    }).join('');
  };

  var htmlFicha = function (o) {
    var st = D.acharStatus(D.STATUS_OCORRENCIA, o.status);

    return U.pageHead(o.tipo,
      'Ocorrência ' + o.id.toUpperCase() + ' · ' + st.rotulo + ' · ' +
      D.fmtData(o.data),
      U.botao('Voltar para a lista', 'voltar', 'out')) +

      '<div class="acts u-mb">' + htmlAcoes(o) + '</div>' +

      '<div class="grid2">' +
        blocoSituacao(o) +
        blocoRelato(o) +
      '</div>' +
      blocoFalta(o) +
      blocoVeiculo(o) +
      blocoVinculos(o);
  };

  /* ==========================================================
     10 · TELA
     ========================================================== */
  var alvo = (ctx && ctx.alvo) || null;
  var registro = alvo ? S.ocorrencia(alvo) : null;

  var htmlTela = function () {
    if (alvo && !registro) {
      return U.pageHead('Ocorrência não encontrada',
        'O registro que veio no endereço não existe na base.',
        U.botao('Voltar para a lista', 'voltar', 'out')) +
        '<div class="card">' + U.vazio('Ocorrência não encontrada',
          'A ocorrência “' + alvo + '” não está na base. Ela pode ter sido criada em outra ' +
          'sessão e não estar mais aqui.',
          U.botao('Ver todas as ocorrências', 'voltar', 'out')) + '</div>';
    }

    if (registro) return htmlFicha(registro);

    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);
    var velhas = abertasHa5().length;

    return U.pageHead('Ocorrências',
      'O que saiu do roteiro: avarias, combustível, documentação e veículo preso com reserva ' +
      'marcada. Uma ocorrência não é um serviço — é uma decisão que alguém precisa tomar, e ' +
      (velhas
        ? ' há ' + velhas + (velhas === 1 ? ' decisão parada' : ' decisões paradas') +
          ' há cinco dias ou mais.'
        : ' nenhuma está envelhecendo em aberto agora.'),
      U.botao('Nova ocorrência', 'nova', 'pri')) +
      htmlCards() +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  /* ==========================================================
     11 · LIGAÇÃO
     ========================================================== */
  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));
    slot.innerHTML = lista.length ? htmlTabela(lista) : htmlVazio();
    if (cont) cont.textContent = lista.length;

    /* O botão "Limpar" é criado e removido, e não escondido: um
       botão escondido continua sendo alcançado pelo teclado. */
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
    var alvoClicado = ev.target.closest ? ev.target.closest('[data-acao]') : null;

    if (!alvoClicado) {
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
        U.navegar('#/ocorrencias/' + linha.getAttribute('data-abre'));
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvoClicado.getAttribute('data-acao');
    var id = alvoClicado.getAttribute('data-id');

    if (alvoClicado.getAttribute('aria-disabled') === 'true') {
      U.canto(alvoClicado.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'filtrar': {
        var f = alvoClicado.getAttribute('data-f');
        var extra = TIPO ? '&t=' + encodeURIComponent(TIPO) : '';
        U.navegar('#/ocorrencias' + (!f || f === 'todas' ? '' : '?f=' + f) +
          (extra ? (f && f !== 'todas' ? extra : '?t=' + encodeURIComponent(TIPO)) : ''));
        return;
      }

      case 'filtrar-tipo': {
        var t = alvoClicado.getAttribute('data-t') || '';
        /* Clicar no tipo que já está ativo LIMPA o recorte: sem
           isso o atalho vira uma armadilha — o operador entra
           pelo tipo e não tem como sair sem editar o endereço. */
        var mesmoTipo = t && t === TIPO;
        if (mesmoTipo) {
          U.navegar('#/ocorrencias' + (params.f ? '?f=' + params.f : ''));
          return;
        }
        U.navegar('#/ocorrencias?t=' + encodeURIComponent(t) +
          (params.f ? '&f=' + params.f : ''));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'limpar-tipo':
        TIPO = '';
        U.navegar('#/ocorrencias');
        return;

      case 'voltar':
        U.navegar('#/ocorrencias');
        return;

      case 'ver':
        U.navegar('#/ocorrencias/' + id);
        return;

      case 'ir': {
        var rota = alvoClicado.getAttribute('data-para') ||
                   alvoClicado.getAttribute('data-rota');
        if (rota) U.navegar(rota);
        return;
      }

      case 'analisar':
      case 'resolver':
      case 'reabrir': {
        var novo = acao === 'analisar' ? 'analise'
                  : acao === 'resolver' ? 'resolvida'
                  : 'aberta';

        var o = S.ocorrencia(id);
        if (!o) { U.canto('Ocorrência não encontrada.', 'erro'); return; }

        if (o.status === novo) {
          U.canto('Esta ocorrência já está ' +
            D.acharStatus(D.STATUS_OCORRENCIA, novo).rotulo.toLowerCase() + '.', 'aviso');
          return;
        }

        /* Reabrir é a única transição que desfaz uma decisão.
           Ela pede confirmação porque o operador precisa saber
           que está mexendo num registro já fechado. */
        if (acao === 'reabrir') {
          U.confirmar('Reabrir a ocorrência?',
            'A ocorrência volta para "Aberta" e sai do histórico de resolvidas. ' +
            'O relato original não muda.',
            'Reabrir',
            function () {
              U.resultado(S.resolverOcorrencia(id, 'aberta'));
              U.desenhar();
            });
          return;
        }

        U.resultado(S.resolverOcorrencia(id, novo));
        U.desenhar();
        return;
      }

      case 'cobrar':
        U.canto('Gerar a cobrança exige a política de preço e o lançamento no financeiro. ' +
          AVISO_API, 'aviso');
        return;

      case 'nova':
        U.canto('Registrar uma ocorrência nova exige gravá-la no servidor para que ela ' +
          'apareça em todas as telas e para todo mundo. ' + AVISO_API, 'aviso');
        return;

      default:
        U.canto(AVISO_API, 'aviso');
    }
  });

  /* Enter e espaço na linha da tabela. O `tr` só recebe foco
     porque tem `tabindex`; sem este ouvinte o teclado chegaria
     até ele e não aconteceria nada. */
  cx.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    if (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT') return;
    if (!el.getAttribute('data-abre')) return;
    if (ev.preventDefault) ev.preventDefault();
    U.navegar('#/ocorrencias/' + el.getAttribute('data-abre'));
  });
};
