/* ============================================================
   LOK CAR — SISTEMA · telas/frota.js
   ------------------------------------------------------------
   §10 do pedido: Foto, Marca, Modelo, Ano, Placa, Categoria,
   Diária, Quilometragem e Status — mais a ficha completa da
   unidade.

   CINCO DECISÕES QUE VALEM EXPLICAÇÃO
   ------------------------------------------------------------
   1) A FROTA É CONTADA EM UNIDADE, NÃO EM MODELO. Existem dois
      HB20 e dois Onix Plus. Uma tela que listasse "modelos"
      mostraria 6 linhas para 11 carros, e o calendário do §11 —
      que é uma linha por carro — perderia o sentido. Por isso a
      mesma foto aparece duas vezes: é o mesmo modelo, e são dois
      carros.

   2) O STATUS MOSTRADO É DEDUZIDO, E O DIGITADO NÃO DESAPARECE.
      `v.status` guarda o que o operador definiu à mão (disponível,
      manutenção, indisponível). O que a tela mostra é
      `D.statusDoVeiculo`, que cruza esse campo com a agenda: um
      carro marcado "disponível" que está com locação em andamento
      aparece LOCADO, porque é o que ele é. O campo digitado
      continua visível na ficha, na linha "Situação declarada" —
      sem isso o operador veria o sistema contradizê-lo sem dizer
      por quê, e concluiria que o sistema errou.

   3) "MARCA" É O COMEÇO DO MODELO. A base guarda o nome completo
      ("Porsche 911", "Hyundai HB20") e não um campo `marca`
      separado, porque o site exibe o nome assim e é o mesmo dado.
      A tela não inventa uma marca concatenando um campo que não
      existe — foi assim que uma versão anterior escreveu
      "undefined Porsche 911" no detalhe da locação.

   4) A DIÁRIA VEM DO SITE E PODE NÃO EXISTIR. Três modelos da
      frota não estão na tabela de preços (`config.js` do site).
      Nesses casos a coluna fica vazia e o CARTÃO diz "a partir
      de" uma vez, no cabeçalho — nunca "R$ 0,00", que seria
      afirmar que o carro é de graça.

   5) ESTA TELA NÃO GUARDA NADA NO ESTADO. Não há mutação de
      veículo na sessão, porque cadastro de frota não estava no
      pedido desta fase. Toda ação que precisaria gravar está
      escrita como o que ela é — e leva ao módulo que hoje é
      dono daquele dado (o contrato, a reserva, o calendário).
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.frota = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;
  var CFG = window.LOKCAR_CONFIG;

  var esc = U.esc;
  var params = (ctx && ctx.params) || {};
  var ALVO = ctx && ctx.alvo ? String(ctx.alvo) : null;

  /* ==========================================================
     1 · ABAS
     ----------------------------------------------------------
     As cinco situações do §10, na ordem do pedido, mais um
     recorte de operação: "Fora de circulação". Ele existe porque
     MANUTENÇÃO e INDISPONÍVEL são coisas diferentes — uma tem
     oficina, a outra não tem — e porque é a lista que o gerente
     abre quando quer saber quantos carros estão parados e por
     quê. O painel aponta para cá por essas abas
     (`#/frota?f=locado`, `?f=disponivel`), então os ids precisam
     ser exatamente os códigos de status.
     ========================================================== */
  var ABAS = [
    { id: 'todos',        rotulo: 'Todos',            teste: null },
    { id: 'disponivel',   rotulo: 'Disponível',       teste: function (v) { return D.statusDoVeiculo(v) === 'disponivel'; } },
    { id: 'reservado',    rotulo: 'Reservado',        teste: function (v) { return D.statusDoVeiculo(v) === 'reservado'; } },
    { id: 'locado',       rotulo: 'Locado',           teste: function (v) { return D.statusDoVeiculo(v) === 'locado'; } },
    { id: 'manutencao',   rotulo: 'Manutenção',       teste: function (v) { return D.statusDoVeiculo(v) === 'manutencao'; } },
    { id: 'indisponivel', rotulo: 'Indisponível',     teste: function (v) { return D.statusDoVeiculo(v) === 'indisponivel'; } },
    { id: 'parado',       rotulo: 'Fora de circulação', daOperacao: true,
      teste: function (v) {
        var s = D.statusDoVeiculo(v);
        return s === 'manutencao' || s === 'indisponivel';
      } }
  ];

  var acharAba = function (id) {
    for (var i = 0; i < ABAS.length; i++) {
      if (ABAS[i].id === id) return ABAS[i];
    }
    return null;
  };

  var filtroDe = function (f) { return acharAba(f) || ABAS[0]; };

  var BUSCA = params.q ? String(params.q) : '';

  var normalizar = function (v) {
    return String(v === null || v === undefined ? '' : v)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  };

  var alvosDe = function (v) {
    return normalizar([
      v.modelo, v.placa, v.categoria, v.cor, v.cambio,
      String(v.ano || ''),
      /* A marca é o primeiro pedaço do modelo. Procurar por
         "Porsche" tem de achar os dois Porsche, e "911" também. */
      v.modelo.split(' ')[0]
    ].join(' | '));
  };

  var combinaBusca = function (v, termo) {
    if (!termo) return true;
    var alvo = alvosDe(v);
    var pedacos = normalizar(termo).split(/\s+/).filter(Boolean);
    for (var i = 0; i < pedacos.length; i++) {
      if (alvo.indexOf(pedacos[i]) === -1) return false;
    }
    return true;
  };

  /* Ordem de trabalho: o que está fora de circulação primeiro,
     depois o que está na rua, depois o que está reservado e por
     último o que está parado no pátio esperando. Depois disso,
     por placa — que é como a frota é organizada no pátio. */
  var PESO = { manutencao: 0, indisponivel: 1, locado: 2, reservado: 3, disponivel: 4 };

  var ordenar = function (lista) {
    return lista.slice().sort(function (a, b) {
      var pa = PESO[D.statusDoVeiculo(a)];
      var pb = PESO[D.statusDoVeiculo(b)];
      if (pa !== pb) return pa - pb;
      return a.placa < b.placa ? -1 : 1;
    });
  };

  var filtrar = function (filtro) {
    return ordenar(S.estado.veiculos.filter(function (v) {
      if (filtro.teste && !filtro.teste(v)) return false;
      return combinaBusca(v, BUSCA);
    }));
  };

  var contar = function (aba) {
    return S.estado.veiculos.filter(function (v) {
      return aba.teste ? aba.teste(v) : true;
    }).length;
  };

  /* ==========================================================
     2 · AGENDA DA UNIDADE
     ----------------------------------------------------------
     Uma passada só pelo estado por veículo, para o cartão poder
     dizer "3 compromissos" e o detalhe poder listar. É a mesma
     fonte do calendário (`D.agendaDaFrota`), com uma janela
     larga: a ficha precisa mostrar o que vem, não só a semana.
     ========================================================== */
  var JANELA = 120;

  var agendaDe = function (v) {
    var ag = D.agendaDaFrota(D.D(-30), JANELA + 30);
    for (var i = 0; i < ag.linhas.length; i++) {
      if (ag.linhas[i].veiculo.id === v.id) return ag.linhas[i].faixas;
    }
    return [];
  };

  var proximos = function (faixas) {
    return faixas.filter(function (f) { return D.diffDias(D.HOJE, f.ate) >= 0; });
  };

  var ocupacao = function (faixas) {
    /* Quantos dias dos próximos 30 têm compromisso. Serve para
       comparar a utilização das unidades de um jeito que o
       número de compromissos não dá: duas reservas de sete dias
       pesam mais que quatro de um dia. */
    var dias = 0;
    var fim = D.D(30);
    for (var i = 0; i < 30; i++) {
      var dia = D.D(i);
      var ocupado = faixas.some(function (f) {
        return D.diffDias(f.de, dia) <= 0 && D.diffDias(dia, f.ate) <= 0;
      });
      if (ocupado) dias += 1;
    }
    return { dias: dias, de: 30, fim: fim };
  };

  var conflitosDe = function (veiculoId) {
    return D.conflitos().filter(function (c) { return c.veiculoId === veiculoId; });
  };

  /* ==========================================================
     3 · CARTÃO (§10)
     ========================================================== */
  var ETIQUETA = function (lista) {
    /* "3 compromissos" e "2 conflitos" — os dois números que o
       cartão mostra além do status. Um conflito é sempre dito em
       vermelho e por extenso, porque é a única situação do
       cartão que exige decisão. */
    var partes = [];
    if (lista.length) {
      partes.push('<span class="u-xs u-t4">' + lista.length +
        (lista.length === 1 ? ' compromisso' : ' compromissos') + '</span>');
    }
    return partes.join('');
  };

  var cartao = function (v) {
    var st = D.statusDoVeiculo(v);
    var diaria = D.diariaDo(v.modelo);
    var faixas = agendaDe(v);
    var futuras = proximos(faixas);
    var conft = conflitosDe(v.id);
    var parada = D.paradasNaOficina().filter(function (p) { return p.veiculo.id === v.id; })[0] || null;

    return '' +
      '<article class="vcl" data-abre="' + v.id + '" data-id="' + v.id + '" tabindex="0" role="link">' +
      '  <div class="vcl__midia">' +
      '    <img src="' + esc(v.img) + '" alt="" loading="lazy" />' +
      '    <span class="vcl__placa">' + esc(v.placa) + '</span>' +
      '    <span class="vcl__st">' + U.crachaVeiculo(v) + '</span>' +
      '  </div>' +
      '  <div class="vcl__b">' +
      '    <div>' +
      '      <p class="vcl__t">' + esc(v.modelo) + '</p>' +
      '      <p class="vcl__sub">' + esc(v.categoria) + ' · ' + v.ano + ' · ' + esc(v.cor) + '</p>' +
      '    </div>' +
           (conft.length
             ? '<span class="atraso"><svg viewBox="0 0 24 24" aria-hidden="true">' +
               '<path d="M10.3 4l8 14H2.3zM12 10v4M12 17v.01"/></svg>' +
               (conft.length === 1 ? 'conflito de agenda' : conft.length + ' conflitos de agenda') +
               '</span>'
             : (parada
                 ? '<span class="u-xs u-t4">' + esc(parada.motivoCurto) + '</span>'
                 : ETIQUETA(futuras))) +
      '    <div class="vcl__rodape">' +
      '      <span class="vcl__diaria">' +
               (diaria === null || diaria === undefined
                 ? '<span class="falta">Sob consulta</span>'
                 : U.reais(diaria) + ' <small>/ dia</small>') +
      '      </span>' +
      '      <span class="vcl__km">' +
               (v.km === null || v.km === undefined
                 ? '<span class="falta">km a configurar</span>'
                 : Number(v.km).toLocaleString('pt-BR') + ' km') +
      '      </span>' +
      '    </div>' +
      '  </div>' +
      '</article>';
  };

  var htmlGrade = function (lista) {
    if (!lista.length) {
      if (BUSCA) {
        return U.vazio('Nenhum veículo para "' + BUSCA + '"',
          'A busca olha o modelo, a marca, a placa, a categoria, a cor, o câmbio e o ano.');
      }
      return U.vazio('Nenhum veículo nesta situação',
        'Troque de aba ou limpe a busca para ver a frota inteira.');
    }
    return '<div class="grade-vcl">' + lista.map(cartao).join('') + '</div>';
  };

  /* ==========================================================
     4 · LISTA
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

    return html;
  };

  var htmlTelaLista = function (filtro, lista) {
    var total = S.estado.veiculos.length;
    var c = D.contagemFrota();

    return U.pageHead('Frota',
      '<b>' + total + '</b> unidades · ' +
      c.disponivel + ' disponíveis · ' + c.reservado + ' reservadas · ' +
      c.locado + ' locadas · ' + (c.manutencao + c.indisponivel) + ' fora de circulação',
      U.botao('Abrir calendário da frota', 'ir-calendario', 'out') +
      U.botao('Programar manutenção', 'ir-manutencoes', 'out')) +

      '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar frota por situação">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'unidade' : 'unidades') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Modelo, placa, categoria ou ano" ' +
             'aria-label="Buscar veículo por modelo, placa, categoria ou ano" />' +
      '    </div>' +
           (BUSCA ? '<button class="ab" type="button" data-acao="limpar">Limpar</button>' : '') +
      '  </div>' +
      '</div>' +
      '<div data-slot="lista">' + htmlGrade(lista) + '</div>';
  };

  /* ==========================================================
     5 · DETALHE (§10) — a ficha da unidade
     ----------------------------------------------------------
     Sete blocos na ordem em que o balcão precisa deles: o que é
     o carro, como ele está agora, o que ele tem marcado, onde
     ele esteve, o que ele já rendeu, o que está pendente nele e
     o que custa.
     ========================================================== */
  var ICO = {
    ficha: 'M4 16h16M5 16V11l2-5h10l2 5v5M7 16v2M17 16v2M7.5 11h9',
    situacao: 'M3 12h4l3 7 4-14 3 7h4',
    agenda: 'M8 3v3M16 3v3M4 8h16M5 5h14v15H5z',
    historico: 'M4 12a8 8 0 1 0 3-6M4 4v4h4M12 8v4l3 2',
    dinheiro: 'M3 7h18v11H3zM3 11h18M7 15h3',
    pendencia: 'M10.3 4l8 14H2.3zM12 10v4M12 17v.01',
    servico: 'M14.7 6.3a4 4 0 0 1 5 5L10 21H5v-5zM14 7l3 3'
  };

  var bloco = function (id, titulo, conteudo, extraClasse, nota) {
    return '<section class="bloco' + (extraClasse ? ' ' + extraClasse : '') + '">' +
      '<div class="bloco__h">' +
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICO[id] || ICO.ficha) + '"/></svg>' +
      '  <h2>' + esc(titulo) + '</h2>' +
      (nota ? '<span class="bloco__n">' + esc(nota) + '</span>' : '') +
      '</div>' + conteudo + '</section>';
  };

  var ficha = function (linhas) {
    return '<dl class="ficha">' + linhas.map(function (l) {
      return '<div><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>';
    }).join('') + '</dl>';
  };

  var corpo = function (html) { return '<div class="bloco__b">' + html + '</div>'; };

  /* --- 1 · FICHA ------------------------------------------------- */
  var blocoFicha = function (v) {
    var marca = v.modelo.split(' ')[0];
    var ano = v.ano || '';

    return bloco('ficha', 'Ficha da unidade', corpo(ficha([
      ['Marca', esc(marca)],
      ['Modelo', esc(v.modelo)],
      ['Ano', ano ? String(ano) : '<span class="falta">a configurar</span>'],
      ['Placa', '<span class="mono">' + esc(v.placa) + '</span>' +
                ' <span class="u-xs u-t4">placa de demonstração</span>'],
      ['Categoria', esc(v.categoria)],
      ['Câmbio', esc(v.cambio)],
      ['Lugares', v.lugares ? v.lugares + ' lugares' : '<span class="falta">a configurar</span>'],
      ['Ar-condicionado', v.ar ? 'Sim' : 'Não'],
      ['Cor', esc(v.cor)],
      ['Quilometragem', v.km === null || v.km === undefined
        ? '<span class="falta">a configurar</span>'
        : Number(v.km).toLocaleString('pt-BR') + ' km'],
      ['Entrada na frota', v.aquisicao ? D.fmtData(v.aquisicao) : '<span class="falta">a configurar</span>']
    ])), 'bloco--largo',
      /* A placa é dita de demonstração no próprio campo, e não
         num rodapé: quem lê a ficha para conferir um dado
         precisa saber, na linha, que aquele dado não é real. */
      null);
  };

  /* --- 2 · SITUAÇÃO ---------------------------------------------- */
  var blocoSituacao = function (v) {
    var st = D.statusDoVeiculo(v);
    var declarado = D.acharStatus(D.STATUS_FROTA, v.status);
    var derivado = D.acharStatus(D.STATUS_FROTA, st);
    var locacoes = S.estado.locacoes.filter(function (l) {
      return l.veiculoId === v.id && l.status !== 'finalizada';
    });
    var reservas = S.estado.reservas.filter(function (r) {
      return r.veiculoId === v.id && D.reservaOcupa(r) && D.diffDias(D.HOJE, r.ate) >= 0;
    });
    var linhas = [];

    linhas.push(['Situação agora',
      '<b>' + esc(derivado.rotulo) + '</b> ' +
      '<span class="u-xs u-t4">deduzida da operação</span>']);

    /* A divergência entre o que foi digitado e o que a operação
       mostra é explicada, nunca escondida. É o que impede o
       operador de achar que o sistema ignorou o que ele marcou. */
    if (st !== v.status) {
      linhas.push(['Situação declarada', esc(declarado.rotulo) +
        '<span class="tbl__dim">O campo do cadastro diz uma coisa e a agenda diz outra. ' +
        'Quem manda na tela é a agenda.</span>']);
    }

    if (locacoes.length) {
      linhas.push(['Locação em curso', locacoes.map(function (l) {
        return '<a class="ab" href="#/locacoes/' + l.id + '" data-acao="ir">' + esc(l.codigo) + '</a>' +
               ' <span class="u-xs u-t3">' + U.crachaLocacao(l) + '</span>';
      }).join('<br />')]);
    }

    if (reservas.length) {
      linhas.push(['Reservas que ocupam', reservas.map(function (r) {
        return '<a class="ab" href="#/reservas/' + r.id + '" data-acao="ir">' + esc(r.codigo) + '</a>' +
               ' <span class="u-xs u-t3">' + D.fmtData(r.de) + ' → ' + D.fmtData(r.ate) + '</span>';
      }).join('<br />')]);
    }

    var conft = conflitosDe(v.id);
    if (conft.length) {
      linhas.push(['Choque de agenda', conft.map(function (c) {
        return '<span class="atraso"><svg viewBox="0 0 24 24" aria-hidden="true">' +
               '<path d="M10.3 4l8 14H2.3zM12 10v4M12 17v.01"/></svg></span> ' +
               esc(c.a.codigo) + ' e ' + esc(c.b.codigo) +
               ' <span class="u-xs u-t4">se cruzam neste veículo</span>';
      }).join('<br />')]);
    }

    if (!locacoes.length && !reservas.length && !conft.length) {
      linhas.push(['Agenda', '<span class="u-t3">Nada marcado. Este carro está no pátio.</span>']);
    }

    return bloco('situacao', 'Situação', corpo(ficha(linhas)));
  };

  /* --- 3 · AGENDA ------------------------------------------------ */
  var blocoAgenda = function (v) {
    var faixas = agendaDe(v);
    var futuras = proximos(faixas);
    var oc = ocupacao(faixas);

    if (!faixas.length) {
      return bloco('agenda', 'Agenda', corpo(
        '<p class="u-t3 u-sm">Nenhum compromisso registrado nos próximos ' +
        JANELA + ' dias. A agenda cruza reservas, locações e manutenções — ' +
        'um carro sem nada marcado aparece aqui igual, e é assim que se sabe ' +
        'que ele está livre.</p>' +
        '<div class="u-mt">' +
        U.botao('Ver no calendário da frota', 'ir-calendario', 'out', { id: v.id }) +
        '</div>'
      ));
    }

    var hoje = D.HOJE;

    var linhas = faixas.map(function (f) {
      var emCurso = D.diffDias(f.de, hoje) <= 0 && D.diffDias(hoje, f.ate) <= 0;
      var passado = D.diffDias(f.ate, hoje) < 0;
      var rota = f.tipo === 'reserva' ? '#/reservas/' + f.id
               : (f.tipo === 'locacao' ? '#/locacoes/' + f.id : '#/manutencoes');
      var cracha = f.tipo === 'reserva' ? U.crachaReserva({ status: f.status })
                 : (f.tipo === 'locacao' ? U.crachaLocacao({ status: f.status, fimPrevisto: f.ate, inicio: f.de })
                    : U.crachaManutencao({ status: f.status }));
      var quem = f.tipo === 'manutencao'
        ? esc(f.alerta || 'Serviço')
        : esc(f.clienteId ? U.nomeCliente(f.clienteId) : 'Cliente não informado');

      return '<li class="hist__i" data-acao="ir-faixa" data-para="' + rota + '">' +
        '<span class="hist__q">' + D.fmtDataCurta(f.de) + '</span>' +
        '<span class="hist__m"><span class="hist__p hist__p--' +
          (f.tipo === 'reserva' ? 'reserva' : (f.tipo === 'locacao' ? 'locacao' : 'reserva')) +
        '"></span></span>' +
        '<span class="hist__t"><b>' +
          (f.tipo === 'reserva' ? 'Reserva ' : (f.tipo === 'locacao' ? 'Locação ' : 'Manutenção ')) +
          esc(f.codigo) + '</b>' +
        '<span>' + quem + ' · ' + D.fmtData(f.de) + ' → ' + D.fmtData(f.ate) +
          (passado ? ' · encerrado' : (emCurso ? ' · em curso' : '')) + '</span>' +
        '<span class="u-mt">' + cracha + '</span></span>' +
        '</li>';
    }).join('');

    return bloco('agenda', 'Agenda', corpo(
      '<div class="kpis kpis--mini u-mb">' +
      '  <div class="kpi"><span class="kpi__key">Compromissos</span>' +
      '    <span class="kpi__val">' + futuras.length + '</span>' +
      '    <span class="kpi__nota">a partir de hoje</span></div>' +
      '  <div class="kpi"><span class="kpi__key">Dias ocupados</span>' +
      '    <span class="kpi__val">' + oc.dias + '<small>/' + oc.de + '</small></span>' +
      '    <span class="kpi__nota">nos próximos 30 dias</span></div>' +
      '  <div class="kpi"><span class="kpi__key">Última saída</span>' +
      '    <span class="kpi__val u-t2" style="font-size:0.86rem">' +
             (futuras.length ? D.fmtDataCurta(futuras[0].de) : '—') + '</span>' +
      '    <span class="kpi__nota">' + (futuras.length ? D.quando(futuras[0].de) : 'sem agenda') + '</span></div>' +
      '</div>' +
      '<ul class="hist">' + linhas + '</ul>' +
      '<div class="u-mt">' +
      U.botao('Ver no calendário da frota', 'ir-calendario', 'out', { id: v.id }) +
      '</div>'
    ));
  };

  /* --- 4 · HISTÓRICO --------------------------------------------- */
  var blocoHistorico = function (v) {
    var antigas = agendaDe(v).filter(function (f) {
      return D.diffDias(f.ate, D.HOJE) < 0;
    }).reverse();

    var locacoes = S.estado.locacoes.filter(function (l) {
      return l.veiculoId === v.id && l.status === 'finalizada';
    });

    var km = null;
    locacoes.forEach(function (l) {
      if (l.kmSaida !== null && l.kmEntrada !== null && l.kmEntrada !== undefined) {
        var d = l.kmEntrada - l.kmSaida;
        if (d > 0) km = (km || 0) + d;
      }
    });

    var receita = null;
    var semTabela = false;
    locacoes.forEach(function (l) {
      if (!l.reserva) return;
      var r = S.reserva(l.reserva);
      if (!r) return;
      var p = D.preco(r);
      if (p.incompleto) { semTabela = true; return; }
      receita = (receita || 0) + p.total;
    });

    var iframe = '';
    if (locacoes.length) {
      iframe += '<p class="u-t3 u-sm"><b>' + locacoes.length + '</b> ' +
        (locacoes.length === 1 ? 'locação encerrada' : 'locações encerradas') + ' com este carro' +
        (km !== null ? ' · <b>' + km.toLocaleString('pt-BR') + ' km</b> rodados com leitura registrada' : '') +
        '.</p>';
    }

    if (receita !== null || semTabela) {
      iframe += '<p class="u-t3 u-sm u-mt">' +
        (receita !== null
          ? 'Soma das locações com tabela de preço: <b>' + D.fmtBRL(receita) + '</b>.'
          : 'Nenhuma locação deste carro tem tabela de preço de origem.') +
        (semTabela
          ? ' <span class="falta">Parte das locações ficou de fora da soma: o modelo não tem diária na tabela do site.</span>'
          : '') +
        '</p>';
    }

    if (!antigas.length && !iframe) {
      return bloco('historico', 'Histórico', corpo(
        '<p class="u-t3 u-sm">Este carro ainda não tem compromisso encerrado na base de demonstração.</p>'
      ));
    }

    return bloco('historico', 'Histórico', corpo(
      iframe +
      (antigas.length
        ? '<ul class="hist u-mt">' + antigas.slice(0, 12).map(function (f) {
            var rota = f.tipo === 'reserva' ? '#/reservas/' + f.id
                     : (f.tipo === 'locacao' ? '#/locacoes/' + f.id : '#/manutencoes');
            return '<li class="hist__i" data-acao="ir-faixa" data-para="' + rota + '">' +
              '<span class="hist__q">' + D.fmtDataCurta(f.ate) + '</span>' +
              '<span class="hist__m"><span class="hist__p hist__p--' +
                (f.tipo === 'locacao' ? 'locacao' : 'reserva') + '"></span></span>' +
              '<span class="hist__t"><b>' +
                (f.tipo === 'reserva' ? 'Reserva ' : (f.tipo === 'locacao' ? 'Locação ' : 'Manutenção ')) +
                esc(f.codigo) + '</b>' +
              '<span>encerrado em ' + D.fmtData(f.ate) + '</span></span>' +
              '</li>';
          }).join('') + '</ul>'
        : '')
    ));
  };

  /* --- 5 · O QUE ESTE CARRO CUSTA --------------------------------- */
  var blocoPreco = function (v) {
    var diaria = D.diariaDo(v.modelo);
    var faixa = D.faixaDo(v.modelo);
    var locacoes = S.estado.locacoes.filter(function (l) { return l.veiculoId === v.id; });
    var comValor = 0;
    var semValor = 0;

    locacoes.forEach(function (l) {
      var r = l.reserva ? S.reserva(l.reserva) : null;
      if (!r) { semValor += 1; return; }
      var p = D.preco(r);
      if (p.incompleto) semValor += 1;
      else comValor += 1;
    });

    var html = ficha([
      ['Diária na tabela', diaria === null || diaria === undefined
        ? '<span class="falta">Sem tabela no site</span>'
        : U.reais(diaria)],
      ['Faixa anunciada', faixa
        ? U.reais(faixa.min) + ' – ' + U.reais(faixa.max)
        : '<span class="falta">Sem tabela no site</span>'],
      ['Locações com valor', comValor + (semValor ? ' · <span class="falta">' +
        semValor + (semValor === 1 ? ' sem tabela' : ' sem tabela') + '</span>' : '')]
    ]);

    if (diaria === null || diaria === undefined) {
      html += '<div class="aviso aviso--neutro u-mt">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
        '<span>Este modelo não está na tabela de preços do site. O sistema não escolhe ' +
        'uma diária por conta própria: enquanto a Lok Car não definir o valor, ' +
        'a ficha mostra <b>“sem tabela”</b> e as locações deste carro ficam com valor a definir.</span>' +
        '</div>';
    } else {
      html += '<div class="aviso aviso--neutro u-mt">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
        '<span>Este valor é o mesmo que o site anuncia. O sistema não mantém uma segunda ' +
        'tabela de preços — ele lê <code class="mono">scripts/config.js</code> do site.</span>' +
        '</div>';
    }

    return bloco('dinheiro', 'Valores', corpo(html));
  };

  /* --- 6 · PENDÊNCIAS E DOCUMENTAÇÃO ------------------------------ */
  var blocoPendencias = function (v) {
    var lista = D.pendencias().filter(function (p) {
      return p.rota && (p.rota.indexOf('/locacoes/') === 0 || p.rota.indexOf('/reservas/') === 0);
    }).filter(function (p) {
      var alvo = p.rota.split('/')[2];
      var r = S.reserva(alvo);
      if (r) return r.veiculoId === v.id;
      var l = S.locacao(alvo);
      if (l) return l.veiculoId === v.id;
      return false;
    });

    var servicos = D.paradasNaOficina().filter(function (p) { return p.veiculo.id === v.id; })[0];

    var ocos = [];

    if (servicos) {
      ocos.push('<li><b>' + esc(servicos.motivo) + '</b>' +
        '<span class="tbl__dim">O carro está fora de circulação e é isso que o prende.</span></li>');
    }

    if (v.km === null || v.km === undefined) {
      ocos.push('<li><b>Quilometragem não informada</b>' +
        '<span class="tbl__dim">Sem km não há como saber quando a próxima revisão vence.</span></li>');
    }

    if (!v.aquisicao) {
      ocos.push('<li><b>Data de entrada na frota não informada</b>' +
        '<span class="tbl__dim">Serve para a locadora calcular a idade do carro na frota.</span></li>');
    }

    var html = '';

    if (lista.length) {
      html += '<div class="pend">' + lista.map(U.itemPendencia).join('') + '</div>';
    }

    if (ocos.length) {
      html += (html ? '<div class="u-mt-lg"></div>' : '') +
        '<div class="aviso u-mb"><svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
        '<span>O que falta neste cadastro:</span></div>' +
        '<ul class="lista-check">' + ocos.join('') + '</ul>';
    }

    if (!html) {
      html = '<div class="aviso aviso--ok">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>' +
        '<span>Nada pendente neste veículo. Nenhum documento vencendo, nenhuma vistoria ' +
        'em aberto e nenhuma devolução atrasada.</span></div>';
    }

    return bloco('pendencia', 'Pendências', corpo(html));
  };

  /* --- 7 · MANUTENÇÕES -------------------------------------------- */
  var blocoManutencoes = function (v) {
    var lista = S.estado.manutencoes.filter(function (m) { return m.veiculoId === v.id; });

    if (!lista.length) {
      return bloco('servico', 'Manutenções', corpo(
        '<p class="u-t3 u-sm">Nenhuma manutenção registrada para este carro.</p>' +
        '<div class="u-mt">' + U.botao('Programar no módulo de manutenções', 'ir-manutencoes', 'out') + '</div>'
      ));
    }

    var linhas = lista.map(function (m) {
      return '<li class="hist__i" data-acao="ir-manutencao" data-id="' + m.id + '">' +
        '<span class="hist__q">' + (m.previsao ? D.fmtDataCurta(m.previsao) : '—') + '</span>' +
        '<span class="hist__m"><span class="hist__p hist__p--reserva"></span></span>' +
        '<span class="hist__t"><b>' + esc(m.alerta) + '</b>' +
        '<span>' + esc(m.descricao) + '</span>' +
        '<span class="u-mt">' + U.crachaManutencao(m) +
        (m.km ? ' <span class="u-xs u-t4">' + Number(m.km).toLocaleString('pt-BR') + ' km</span>' : '') +
        '</span></span></li>';
    }).join('');

    return bloco('servico', 'Manutenções', corpo(
      '<ul class="hist">' + linhas + '</ul>' +
      '<div class="u-mt">' + U.botao('Abrir módulo de manutenções', 'ir-manutencoes', 'out') + '</div>'
    ));
  };

  /* ==========================================================
     6 · AÇÕES DO DETALHE
     ========================================================== */
  var htmlAcoes = function (v) {
    var conft = conflitosDe(v.id);
    var reservas = S.estado.reservas.filter(function (r) {
      return r.veiculoId === v.id && r.status !== 'cancelada';
    }).length;

    return '<div class="reg__acoes">' +
      U.botao('Ver no calendário', 'ir-calendario', 'pri', { id: v.id }) +
      /* O rótulo diz o que o clique faz. "Ver contratos" ou
         "Ver reservas" prometeria a mesma coisa; dizer a
         contagem junto é o que permite decidir se vale clicar. */
      U.botao(reservas
                ? 'Ver ' + reservas + (reservas === 1 ? ' reserva' : ' reservas')
                : 'Ver reservas',
              'ir-reservas', 'out', { id: v.id }, !reservas,
              'Este carro não tem nenhuma reserva registrada.') +
      U.botao('Nova reserva para este carro', 'ir-nova-reserva', 'out', { id: v.id }) +
      (conft.length
        ? U.botao('Resolver conflito de agenda', 'ir-conflito', 'out', { id: v.id })
        : '') +
      '</div>';
  };

  var recadoDe = function (v) {
    var st = D.statusDoVeiculo(v);
    if (st === 'manutencao') {
      var p = D.paradasNaOficina().filter(function (x) { return x.veiculo.id === v.id; })[0];
      return 'Carro na oficina' + (p ? ': ' + p.motivoCurto + '.' : '.') +
        ' Ele não entra em reserva nova enquanto a manutenção não for concluída.';
    }
    if (st === 'indisponivel') {
      return 'Carro fora de circulação' +
        (v.status === 'indisponivel' && !D.paradasNaOficina().filter(function (x) { return x.veiculo.id === v.id; })[0]
          ? ' sem motivo registrado' : '') +
        '. O motivo precisa estar escrito para alguém poder resolver.';
    }
    if (st === 'locado') return 'Carro na rua agora. A devolução é o próximo compromisso da agenda.';
    if (st === 'reservado') return 'Carro no pátio com reserva futura. Está livre até a data da retirada.';
    return 'Carro no pátio e sem compromisso marcado. É a unidade que o balcão pode oferecer hoje.';
  };

  var htmlDetalhe = function (v) {
    var diaria = D.diariaDo(v.modelo);

    return '' +
      '<div class="reg">' +
      '  <a class="reg__voltar" href="#/frota" data-acao="voltar">' +
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
      '    Toda a frota' +
      '  </a>' +
      '  <div class="reg__id">' +
      '    <span class="reg__cod">' + esc(v.placa) + '</span>' +
      '    ' + U.crachaVeiculo(v) +
      '    <span class="reg__quando">' + esc(v.modelo) + ' · ' + v.ano + ' · ' +
             esc(v.categoria) +
             (diaria === null || diaria === undefined
               ? ' · <span class="falta">sem diária na tabela</span>'
               : ' · ' + U.reais(diaria) + ' por dia') +
      '    </span>' +
      '  </div>' +
         htmlAcoes(v) +
      '  <p class="u-xs u-t4">' + esc(recadoDe(v)) + '</p>' +
      '</div>' +

      '<div class="vcl-ficha u-mb">' +
      '  <div class="vcl-foto"><img src="' + esc(v.img) + '" alt="' + esc(v.modelo) + '" /></div>' +
      '  <div>' + blocoFicha(v) + '</div>' +
      '</div>' +

      '<div class="blocos">' +
        blocoSituacao(v) +
        blocoAgenda(v) +
        blocoPendencias(v) +
        blocoPreco(v) +
        blocoHistorico(v) +
        blocoManutencoes(v) +
      '</div>';
  };

  /* ==========================================================
     7 · DESENHO
     ========================================================== */
  var acharVeiculo = function (id) {
    return S.veiculo(id) ||
      S.estado.veiculos.filter(function (x) { return x.placa === id; })[0] ||
      null;
  };

  var htmlTela = function () {
    if (ALVO) {
      var v = acharVeiculo(ALVO);

      if (!v) {
        return U.pageHead('Veículo não encontrado',
          'Nenhuma unidade da frota corresponde ao endereço <code class="mono">#/frota/' +
          esc(ALVO) + '</code>.') +
          U.vazio('Não encontramos este veículo',
            'Ele pode ter sido restaurado para o estado inicial da demonstração. ' +
            'A frota completa está logo abaixo.',
            U.botao('Ver a frota inteira', 'voltar', 'pri'));
      }

      return htmlDetalhe(v);
    }

    var filtro = filtroDe(params.f);
    return htmlTelaLista(filtro, filtrar(filtro));
  };

  /* Busca ao vivo: só a grade e o contador são refeitos, para o
     cursor não cair fora do campo a cada tecla. */
  var refazerBusca = function () {
    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);

    var slot = caixa.querySelector('[data-slot="lista"]');
    var contador = caixa.querySelector('[data-slot="n"]');
    if (slot) slot.innerHTML = htmlGrade(lista);
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

  var caixa = document.createElement('div');
  caixa.setAttribute('data-tela', 'frota');
  caixa.className = 'pg__tela-conteudo';

  caixa.addEventListener('input', function (ev) {
    var campo = ev.target;
    if (!campo || !campo.getAttribute || campo.getAttribute('data-busca') !== '1') return;
    BUSCA = campo.value || '';
    refazerBusca();
  });

  caixa.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var alvo = ev.target.closest ? ev.target.closest('.vcl[data-abre]') : null;
    if (!alvo) return;
    if (ev.preventDefault) ev.preventDefault();
    U.navegar('#/frota/' + alvo.getAttribute('data-abre'));
  });

  caixa.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-acao]') : null;

    /* Sem `data-acao`: um link direto ou o clique no cartão.
       O `preventDefault` fica dentro de cada ramo — solto no
       topo, ele mataria o `<a href>` do item de pendência. */
    if (!alvo) {
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (link) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar(link.getAttribute('href'));
        return;
      }

      var cartaoEl = ev.target.closest ? ev.target.closest('.vcl[data-abre]') : null;
      if (cartaoEl) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar('#/frota/' + cartaoEl.getAttribute('data-abre'));
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
        U.navegar('#/frota' + (!f || f === 'todos' ? '' : '?f=' + f));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'voltar':
        U.navegar('#/frota');
        return;

      case 'ir':
      case 'ir-faixa': {
        var para = alvo.getAttribute('data-para') || alvo.getAttribute('href');
        if (para) U.navegar(para);
        else U.canto('Este registro ainda não tem tela nesta fase.', 'aviso');
        return;
      }

      case 'ir-calendario':
        U.navegar(id ? '#/calendario/' + id : '#/calendario');
        return;

      case 'ir-manutencoes':
        U.navegar('#/manutencoes');
        return;

      case 'ir-manutencao':
        U.navegar('#/manutencoes' + (id ? '/' + id : ''));
        return;

      case 'ir-reservas':
        /* A tela de reservas sabe recortar por veículo desde que
           o recorte passou a existir de verdade ali (`?veiculo=`).
           Mandar para a lista sem recorte seria um botão que abre
           a tela errada. */
        U.navegar(id ? '#/reservas?veiculo=' + id : '#/reservas');
        return;

      case 'ir-nova-reserva':
        /* `?fazer=nova` abre o aviso de criação já dito para este
           carro. É o mesmo caminho que o módulo de reservas usa
           para ações vindas de fora — e é um caminho que
           funciona, ao contrário de um botão que só pisca. */
        U.navegar(id ? '#/reservas?fazer=nova&veiculo=' + id : '#/reservas?fazer=nova');
        return;

      case 'ir-conflito':
        U.navegar(id ? '#/calendario/' + id : '#/calendario');
        return;
    }

    U.canto('Esta ação entra na próxima tela do módulo.', 'aviso');
  });

  caixa.innerHTML = htmlTela();
  cx.appendChild(caixa);
};
