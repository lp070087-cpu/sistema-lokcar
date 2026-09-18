/* ============================================================
   LOK CAR — SISTEMA · telas/documentos.js
   ------------------------------------------------------------
   O CONTROLE de documentos: o que falta, o que venceu e o que
   está em dia.

   POR QUE ESTA TELA NÃO É UM CADASTRO A MAIS
   ------------------------------------------------------------
   Documento é a única coisa do sistema que PIORA sem ninguém
   fazer nada. Uma CNH válida hoje vence sozinha em novembro; um
   comprovante recolhido em janeiro não serve mais em agosto. O
   status guardado no registro é uma fotografia; o que o
   operador precisa é do filme.

   Por isso a SITUAÇÃO exibida aqui não é o status gravado: é o
   status recalculado contra a data de hoje. E quando o
   calendário contradiz o registro, a tela mostra os dois lado a
   lado em vez de escolher um em silêncio — porque um documento
   que o sistema diz em dia e o operador sabe vencido é pior do
   que qualquer um dos dois estados isolados.

   ARQUIVO NÃO EXISTE NESTA FASE
   ------------------------------------------------------------
   O §28 proíbe configurar upload real. O campo `arquivo` é
   `null` em todos os registros e não há servidor para guardar
   arquivo. A tentação é desenhar um retângulo cinza com ícone
   de imagem — e isso é uma mentira visual: parece uma foto que
   não carregou, e o operador espera. Aqui a tela diz, no
   próprio lugar onde o botão de anexar estaria, que o arquivo
   não é guardado nesta fase.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.documentos = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  var AVISO_API = 'Disponível após integração do backend.';

  /* A JANELA DE AVISO É DE 90 DIAS, e não de trinta. Trinta dias
     é o prazo em que já não dá tempo de reagir: o cliente viaja,
     não manda a foto, o prazo chega. Noventa dias é o tempo real
     de uma locadora pedir a CNH renovada, receber, conferir e
     arquivar antes de a data chegar. Um alerta que só toca
     quando o problema já é irreversível não serve para nada. */
  var DIAS_ALERTA = 90;

  /* ==========================================================
     1 · A SITUAÇÃO DE HOJE
     ----------------------------------------------------------
     Quatro perguntas, nesta ordem, e a ordem importa:

       venceu?   → o prazo passou. É o mais grave.
       ausente?  → nunca foi enviado. Não há prazo a vencer.
       vencendo? → ainda vale, mas dentro da janela de aviso.
       resto    → o status gravado decide.

     O status gravado é uma OPINIÃO; a data de validade é um
     fato. Quando os dois discordam, vale o fato — e a tela diz
     que houve discordância, em vez de apagar o registro.
     ========================================================== */
  var situacao = function (d) {
    /* `diffDias(hoje, vence)` positivo = o prazo ainda está à frente. */
    var dias = d.vence ? D.diffDias(D.HOJE, d.vence) : null;
    var gravado = D.acharStatus(D.STATUS_DOCUMENTO, d.status);

    if (dias !== null && dias < 0) {
      var atraso = Math.abs(dias);
      return {
        chave: 'vencido',
        rotulo: 'Vencido',
        tom: 'bad',
        dias: dias,
        nota: 'Venceu em ' + D.fmtData(d.vence) + ' — há ' + atraso +
              (atraso === 1 ? ' dia.' : ' dias.'),
        /* A contradição é SÓ esta: o calendário diz vencido e o
           registro diz outra coisa. Alargar o aviso para "vai
           vencer e o registro não avisou" faria a tela acusar
           divergência em documento nenhum — e um alerta que toca
           sempre é um alerta que ninguém lê. */
        contradiz: d.status !== 'vencido'
      };
    }

    if (d.status === 'ausente') {
      return {
        chave: 'ausente',
        rotulo: 'Não enviado',
        tom: 'bad',
        dias: dias,
        nota: dias !== null
          ? 'Nunca foi recebido. A validade informada é ' + D.fmtData(d.vence) + '.'
          : 'Nunca foi recebido.',
        contradiz: false
      };
    }

    if (dias !== null && dias <= DIAS_ALERTA) {
      return {
        chave: 'vencendo',
        rotulo: 'A vencer',
        tom: 'warn',
        dias: dias,
        nota: dias === 0
          ? 'Vence hoje.'
          : 'Vence em ' + D.fmtData(d.vence) + ' — faltam ' + dias +
            (dias === 1 ? ' dia.' : ' dias.'),
        contradiz: false
      };
    }

    return {
      chave: d.status === 'ok' ? 'ok' : 'pendente',
      rotulo: gravado.rotulo,
      tom: gravado.tom,
      dias: dias,
      nota: dias !== null
        ? 'Válido até ' + D.fmtData(d.vence) + '.'
        : (d.status === 'ok' ? 'Recebido e conferido.' : 'Recebido; falta conferir.'),
      contradiz: false
    };
  };

  /* Um documento está RESOLVIDO quando não exige nada hoje. "A
     vencer" ainda exige: alguém precisa pedir o documento novo
     antes de a data chegar, e é justamente esse pedido que se
     perde quando a tela só olha o status gravado. */
  var resolvido = function (d) {
    var s = situacao(d);
    return s.chave === 'ok' || s.chave === 'pendente';
  };

  /* ==========================================================
     2 · A QUEM PERTENCE
     ----------------------------------------------------------
     Um documento é de um CLIENTE, de um VEÍCULO ou da própria
     locadora. A tela escreve o nome em vez do id porque "d06"
     não diz nada a ninguém, e o operador precisa saber de quem é
     o papel que falta.
     ========================================================== */
  var dono = function (d) {
    if (d.quem === 'veiculo' && d.veiculoId) {
      var v = S.veiculo(d.veiculoId);
      return v
        ? { texto: v.modelo + ' · ' + v.placa, rota: '#/frota/' + v.id, artigo: 'o veículo' }
        : { texto: 'veículo não encontrado', rota: '', artigo: 'o veículo' };
    }
    if (d.clienteId) {
      var c = S.cliente(d.clienteId);
      return c
        ? { texto: U.nomeCliente(c.id), rota: '#/clientes/' + c.id, artigo: 'o cliente' }
        : { texto: 'cliente não encontrado', rota: '', artigo: 'o cliente' };
    }
    return { texto: 'Lok Car', rota: '', artigo: 'a locadora' };
  };

  var tipoDe = function (d) {
    for (var i = 0; i < D.DOCUMENTOS_TIPO.length; i++) {
      if (D.DOCUMENTOS_TIPO[i].id === d.tipo) return D.DOCUMENTOS_TIPO[i];
    }
    return { id: d.tipo, nome: d.tipo, obrigatorio: false, quem: d.quem };
  };

  /* ==========================================================
     3 · ORDENAÇÃO, FILTROS E BUSCA
     ========================================================== */
  var todos = function () {
    /* O que exige ação primeiro, e dentro disso o mais urgente.
       Um documento vencido some da vista se ficar no meio de
       trinta em dia. */
    return S.estado.documentos.slice().sort(function (a, b) {
      var ra = resolvido(a) ? 1 : 0;
      var rb = resolvido(b) ? 1 : 0;
      if (ra !== rb) return ra - rb;

      var da = situacao(a).dias;
      var db = situacao(b).dias;
      /* Sem prazo vai para o fim do seu grupo: não há urgência
         que o calendário possa medir. */
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  };

  var ABAS = [
    { id: 'todos',    rotulo: 'Todos',        teste: function () { return true; } },
    { id: 'resolver', rotulo: 'A resolver',   teste: function (d) { return !resolvido(d); } },
    { id: 'vencido',  rotulo: 'Vencidos',     teste: function (d) { return situacao(d).chave === 'vencido'; } },
    { id: 'ausente',  rotulo: 'Não enviados', teste: function (d) { return situacao(d).chave === 'ausente'; } },
    { id: 'vencendo', rotulo: 'A vencer',     teste: function (d) { return situacao(d).chave === 'vencendo'; } },
    { id: 'ok',       rotulo: 'Em ordem',     teste: function (d) { return resolvido(d); } }
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

  /* A busca olha o nome do papel, o tipo, o dono e a reserva.
     Procurar "CNH" e não achar porque o registro se chama
     "Carteira de habilitação" seria um defeito de quem procura. */
  var alvosDe = function (d) {
    var r = d.reserva ? S.reserva(d.reserva) : null;
    return [d.nome, tipoDe(d).nome, dono(d).texto, r ? r.codigo : ''].filter(Boolean);
  };

  var combinaBusca = function (d, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;
    var texto = alvosDe(d).map(normalizar).join(' ');
    return termos.every(function (t) { return texto.indexOf(t) !== -1; });
  };

  var filtrar = function (filtro) {
    return todos().filter(function (d) {
      return filtro.teste(d) && combinaBusca(d, BUSCA);
    });
  };

  var contar = function (filtro) {
    return S.estado.documentos.filter(filtro.teste).length;
  };

  /* ==========================================================
     4 · NÚMEROS DO TOPO
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
    var lista = S.estado.documentos;
    var por = function (chave) {
      return lista.filter(function (d) { return situacao(d).chave === chave; }).length;
    };
    var ok = lista.filter(resolvido).length;
    var vencidos = por('vencido');
    var divergem = lista.filter(function (d) { return situacao(d).contradiz; }).length;

    return '<div class="kpis kpis--4">' +
      cartao('Não enviados', por('ausente'),
        'Nunca chegaram — não há prazo correndo, há documento faltando') +
      cartao('Vencidos', vencidos,
        divergem
          ? divergem + (divergem === 1 ? ' com registro divergente' : ' com registro divergente')
          : 'Nenhuma validade passada',
        vencidos ? 'bad' : '') +
      cartao('Vencem em ' + DIAS_ALERTA + ' dias', por('vencendo'),
        'Ainda valem, mas é hora de pedir o documento novo') +
      cartao('Em ordem', ok + ' de ' + lista.length,
        Math.round((ok / (lista.length || 1)) * 100) + '% do acervo não exige nada hoje') +
      '</div>';
  };

  /* ==========================================================
     5 · TABELA
     ----------------------------------------------------------
     Duas colunas de situação, de propósito: "Registrado como" e
     "Situação hoje". Numa tela que mostra só uma das duas, a
     divergência fica invisível — e é justamente ela que faz o
     operador deixar de confiar na lista.
     ========================================================== */
  var celulaDono = function (d) {
    var o = dono(d);
    return o.rota
      ? '<a class="ab" href="' + esc(o.rota) + '" data-acao="ir" data-para="' + esc(o.rota) + '">' +
        esc(o.texto) + '</a>'
      : '<span class="tbl__dim">' + esc(o.texto) + '</span>';
  };

  var htmlLinha = function (d) {
    var s = situacao(d);
    var t = tipoDe(d);

    return '<tr data-abre="' + esc(d.id) + '">' +
      '<td><span class="u-b">' + esc(d.nome) + '</span>' +
        '<span class="tbl__dim">' + esc(t.nome) +
        (t.obrigatorio ? ' · obrigatório' : '') + '</span></td>' +
      '<td>' + celulaDono(d) + '</td>' +
      '<td><span class="u-tab">' + (d.vence ? D.fmtData(d.vence) : 'não vence') + '</span>' +
        (s.dias !== null && s.dias >= 0
          ? '<span class="tbl__dim">' + s.dias + (s.dias === 1 ? ' dia' : ' dias') + '</span>'
          : '') + '</td>' +
      '<td>' + U.cracha(D.STATUS_DOCUMENTO, d.status) + '</td>' +
      '<td>' + U.etiqueta(s.rotulo, s.tom) + '</td>' +
      '<td><div class="tbl__acts">' +
        '<a class="ab' + (resolvido(d) ? '' : ' ab--pri') + '" href="#/documentos/' + esc(d.id) + '" ' +
        'data-acao="ver" data-id="' + esc(d.id) + '">' + (resolvido(d) ? 'Ver' : 'Resolver') + '</a>' +
      '</div></td>' +
      '</tr>';
  };

  var htmlTabela = function (lista) {
    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Documento</th><th>De quem</th><th>Validade</th>' +
        '<th>Registrado como</th><th>Situação hoje</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(htmlLinha).join('') + '</tbody>' +
      '</table></div>';
  };

  var htmlVazio = function () {
    return U.vazio(
      BUSCA ? 'Nenhum documento encontrado' : 'Nenhum documento nesta situação',
      BUSCA
        ? 'Nenhum documento casa com “' + BUSCA + '”. A busca olha o nome do documento, o ' +
          'tipo, o cliente ou veículo e o código da reserva.'
        : 'Nenhum documento está nesta situação.',
      BUSCA ? U.botao('Limpar busca', 'limpar', 'out') : ''
    );
  };

  /* A DIVERGÊNCIA VAI EXPLICADA UMA VEZ, EMBAIXO DA TABELA. Ela
     pode aparecer em várias linhas ao mesmo tempo, e repetir o
     mesmo parágrafo em cada uma viraria ruído. Explicar uma vez
     e marcar cada linha mantém as duas coisas. */
  var htmlNota = function () {
    var n = S.estado.documentos.filter(function (d) { return situacao(d).contradiz; }).length;

    var aviso = n
      ? '<div class="aviso u-mt">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 3l9 16H3zM12 9v5M12 17v.01"/></svg>' +
        '<span><b>' + n +
        (n === 1
          ? ' documento está marcado em ordem e já venceu.'
          : ' documentos estão marcados em ordem e já venceram.') +
        '</b> A tela mostra a data, porque ela não depende de ninguém lembrar de atualizar o ' +
        'registro. O status gravado continua na coluna ao lado para que a divergência fique ' +
        'registrada em vez de escondida.</span></div>'
      : '';

    return aviso +
      '<p class="u-xs u-t4 u-mt">' +
      'Esta tela controla quais documentos existem e até quando valem. O arquivo em si — o ' +
      'PDF, a foto do documento — não é guardado nesta fase: ' + esc(AVISO_API) +
      '</p>';
  };

  var htmlPrateleira = function (lista) {
    return (lista.length ? htmlTabela(lista) : htmlVazio()) + htmlNota();
  };

  var htmlLista = function (filtro, lista) {
    return '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar documentos por situação">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'documento' : 'documentos') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Documento, cliente, veículo ou reserva" ' +
             'aria-label="Buscar documento"/>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div data-slot="lista">' + htmlPrateleira(lista) + '</div>';
  };

  /* ==========================================================
     6 · A FICHA
     ========================================================== */
  var ICO = {
    dados:   'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3 4-5 8-5s8 2 8 5',
    arquivo: 'M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    vinculo: 'M9 15l6-6M10.5 6.5l1.8-1.8a3.5 3.5 0 0 1 5 5l-1.8 1.8M13.5 17.5l-1.8 1.8a3.5 3.5 0 0 1-5-5l1.8-1.8'
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

  var blocoSituacao = function (d, s) {
    var gravado = D.acharStatus(D.STATUS_DOCUMENTO, d.status);

    var conteudo = '<div class="bloco__destaque">' +
      '<span class="bdg bdg--' + s.tom + '">' + esc(s.rotulo) + '</span> — ' +
      esc(s.nota) +
      '</div>' +
      ficha([
        ['Status no registro', esc(gravado.rotulo)],
        ['Situação hoje', '<span class="bdg bdg--' + s.tom + '">' + esc(s.rotulo) + '</span>'],
        ['Validade', d.vence
          ? esc(D.fmtData(d.vence)) +
            (s.dias !== null && s.dias >= 0
              ? ' <span class="u-xs u-t4">(' + s.dias +
                (s.dias === 1 ? ' dia' : ' dias') + ' à frente)</span>'
              : '')
          : '<span class="u-t4">sem validade — este documento não vence</span>']
      ]);

    if (s.contradiz) {
      conteudo += '<div class="aviso u-mt">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 3l9 16H3zM12 9v5M12 17v.01"/></svg>' +
        '<span><b>O registro diz outra coisa.</b> Este documento está gravado como “' +
        esc(gravado.rotulo) + '”, mas a data de validade conta outra história. O sistema ' +
        'mostra a data porque ela não depende de ninguém lembrar de atualizar o status — e ' +
        'mostra o registro ao lado para que a divergência não se perca.</span></div>';
    }

    return bloco('dados', 'Situação', corpo(conteudo), 'o que vale hoje');
  };

  var blocoIdentificacao = function (d) {
    var o = dono(d);
    var t = tipoDe(d);
    var para = t.quem === 'veiculo' ? 'a frota'
             : t.quem === 'locacao' ? 'a locação'
             : 'o cadastro do cliente';

    return bloco('dados', 'Identificação', corpo(ficha([
      ['Documento', esc(d.nome)],
      ['Tipo', esc(t.nome) +
        ' <span class="bdg bdg--' + (t.obrigatorio ? 'warn' : 'idle') + '">' +
        (t.obrigatorio ? 'obrigatório' : 'opcional') + '</span>'],
      ['Pertence a', o.rota
        ? '<a href="' + esc(o.rota) + '">' + esc(o.texto) + '</a>'
        : esc(o.texto)],
      ['Exigido para', esc(para)],
      ['Arquivo', '<span class="u-t4">não guardado nesta fase</span>']
    ])), 'o que este documento é e de quem ele é');
  };

  var blocoArquivo = function () {
    return bloco('arquivo', 'Arquivo', corpo(
      '<div class="aviso aviso--neutro">' +
      '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>' +
      '<span><b>O arquivo não é guardado nesta fase.</b> Esta tela controla <i>quais</i> ' +
      'documentos existem e até quando valem — não guarda o PDF nem a foto enviada pelo ' +
      'cliente. Anexar, visualizar e baixar o arquivo exigem armazenamento em servidor, e ' +
      'esta fase não configura upload. ' + esc(AVISO_API) + '</span></div>'
    ), 'depende do backend');
  };

  /* ==========================================================
     7 · AÇÕES DA FICHA
     ----------------------------------------------------------
     "Registrar recebimento" e "Marcar em dia" parecem a mesma
     coisa e não são: a primeira diz que o papel chegou, a
     segunda diz que ele vale. Um documento sem data de validade
     não tem como ficar "em dia" — e o botão explica por quê em
     vez de sumir sem dar motivo (§26). O §28 proíbe upload real,
     então nenhuma das duas grava; o que a tela faz de verdade é
     dizer de que depende.
     ========================================================== */
  var acoesDe = function (d) {
    var lista = [];
    var o = dono(d);

    lista.push({
      id: 'receber', rotulo: 'Registrar recebimento', tom: 'pri',
      liberada: true, motivo: '', dados: { id: d.id }
    });

    lista.push({
      id: 'em-dia', rotulo: 'Marcar em dia', tom: 'out',
      liberada: !!d.vence,
      motivo: 'Este documento não tem data de validade. Sem prazo, não há o que marcar como ' +
              'em dia — o que falta é o arquivo, e isso depende do backend.',
      dados: { id: d.id }
    });

    if (o.rota) {
      lista.push({
        id: 'ir-dono', rotulo: 'Abrir ' + o.artigo, tom: 'sil',
        liberada: true, motivo: '', dados: { id: d.id, rota: o.rota }
      });
    }

    return lista;
  };

  var htmlAcoes = function (d) {
    return acoesDe(d).map(function (a) {
      return U.botao(a.rotulo, a.id, a.tom, a.dados, !a.liberada, a.motivo);
    }).join('');
  };

  /* ==========================================================
     8 · O QUE ESTE DOCUMENTO PRENDE
     ----------------------------------------------------------
     Um documento não existe no vácuo: ele existe porque alguém
     vai retirar um carro, assinar um contrato ou já devolveu.
     Mostrar a reserva e o veículo ao lado é o que transforma
     "falta um comprovante" em "falta um comprovante PARA ESTA
     RETIRADA" — e é assim que o operador decide a quem cobrar.
     ========================================================== */
  var blocoVinculos = function (d) {
    var linhas = [];

    if (d.reserva) {
      var r = S.reserva(d.reserva);
      linhas.push(['Reserva', r
        ? '<a href="#/reservas/' + esc(r.id) + '">' + esc(r.codigo) + '</a> · ' +
          esc(D.fmtData(r.de)) + ' a ' + esc(D.fmtData(r.ate)) + ' · ' +
          esc(D.acharStatus(D.STATUS_RESERVA, r.status).rotulo)
        : '<span class="falta">reserva ' + esc(d.reserva) + ' não encontrada</span>']);
    }

    if (d.veiculoId) {
      var v = S.veiculo(d.veiculoId);
      linhas.push(['Veículo', v
        ? '<a href="#/frota/' + esc(v.id) + '">' + esc(v.modelo) + '</a> · ' +
          '<span class="mono">' + esc(v.placa) + '</span>'
        : '<span class="falta">veículo não encontrado</span>']);
    }

    if (d.clienteId) {
      var c = S.cliente(d.clienteId);
      if (c) {
        var outros = S.estado.documentos.filter(function (x) {
          return x.clienteId === c.id && x.id !== d.id;
        });
        var pendentes = outros.filter(function (x) { return !resolvido(x); }).length;
        linhas.push(['Cliente',
          '<a href="#/clientes/' + esc(c.id) + '">' + esc(U.nomeCliente(c.id)) + '</a> · ' +
          outros.length + (outros.length === 1 ? ' outro documento' : ' outros documentos') +
          (pendentes ? ', ' + pendentes + ' com pendência' : ', nenhum com pendência')]);
      }
    }

    if (!linhas.length) {
      return bloco('vinculo', 'Ligado a', corpo(
        '<p class="u-sm u-t2">Este documento não está preso a uma reserva, a um veículo nem a ' +
        'um cliente. É um papel da própria locadora.</p>'), 'sem vínculo');
    }

    return bloco('vinculo', 'Ligado a', corpo(ficha(linhas)),
      linhas.length + (linhas.length === 1 ? ' vínculo' : ' vínculos'));
  };

  var htmlFicha = function (d) {
    var s = situacao(d);

    return U.pageHead(d.nome,
      tipoDe(d).nome + ' · ' + dono(d).texto + ' · ' + s.rotulo,
      U.botao('Voltar para a lista', 'voltar', 'out')) +

      '<div class="acts u-mb">' + htmlAcoes(d) + '</div>' +

      '<div class="grid2">' +
        blocoSituacao(d, s) +
        blocoIdentificacao(d) +
      '</div>' +
      blocoArquivo() +
      blocoVinculos(d);
  };

  /* ==========================================================
     9 · TELA
     ========================================================== */
  var alvo = (ctx && ctx.alvo) || null;
  var registro = alvo ? S.documento(alvo) : null;

  var htmlTela = function () {
    if (alvo && !registro) {
      return U.pageHead('Documento não encontrado',
        'O registro que veio no endereço não existe na base.',
        U.botao('Voltar para a lista', 'voltar', 'out')) +
        '<div class="card">' + U.vazio('Documento não encontrado',
          'O documento “' + alvo + '” não está na base. Ele pode ter sido criado em outra ' +
          'sessão e não estar mais aqui.',
          U.botao('Ver todos os documentos', 'voltar', 'out')) + '</div>';
    }

    if (registro) return htmlFicha(registro);

    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);

    return U.pageHead('Documentos',
      'O que falta, o que venceu e o que está em dia. A situação é recalculada a cada ' +
      'abertura contra a data de hoje — o sistema não espera ninguém lembrar de marcar um ' +
      'documento como vencido.',
      U.botao('Novo documento', 'novo', 'pri')) +
      htmlCards() +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  /* ==========================================================
     10 · LIGAÇÃO
     ========================================================== */
  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));
    slot.innerHTML = htmlPrateleira(lista);
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
      /* A âncora tem precedência sobre a linha: quem clica no
         nome do cliente quer o cliente, não o documento. */
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
        U.navegar('#/documentos/' + linha.getAttribute('data-abre'));
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
        U.navegar('#/documentos' + (!f || f === 'todos' ? '' : '?f=' + f));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'voltar':
        U.navegar('#/documentos');
        return;

      case 'ver':
        U.navegar('#/documentos/' + id);
        return;

      case 'ir':
      case 'ir-dono': {
        var rota = alvoClicado.getAttribute('data-rota') ||
                   alvoClicado.getAttribute('data-para');
        if (rota) U.navegar(rota);
        return;
      }

      case 'receber':
      case 'em-dia': {
        /* O §26 proíbe botão morto e o §28 proíbe upload real. O
           que a tela pode fazer de verdade é dizer de que a ação
           depende. Dizer "o papel chegou" sem poder guardar o
           papel seria registrar uma conferência que ninguém pode
           verificar depois. */
        var d = S.documento(id);
        if (!d) { U.canto('Documento não encontrado.', 'erro'); return; }

        if (acao === 'em-dia' && !d.vence) {
          U.canto('Este documento não tem data de validade. Sem prazo, não há o que marcar ' +
            'como em dia.', 'aviso');
          return;
        }

        U.canto('O controle de documentos é atualizado pelo backend. ' + AVISO_API, 'aviso');
        return;
      }

      case 'novo':
        U.canto('Cadastrar um documento exige guardar o arquivo e amarrá-lo ao cliente ou ao ' +
          'veículo. ' + AVISO_API, 'aviso');
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
    U.navegar('#/documentos/' + el.getAttribute('data-abre'));
  });

  /* ==========================================================
     11 · DESTAQUE
     ----------------------------------------------------------
     A lista de pendências do painel e o contrato apontam para
     um registro. Quando ele abre a ficha, não há o que destacar
     — a tela inteira já é o registro. O destaque existe para
     quando a tela é a lista e o registro veio na consulta.
     ========================================================== */
  (function destacar() {
    if (!params.destaque) return;
    var linha = cx.querySelector('[data-abre="' + esc(params.destaque) + '"]');
    if (linha && linha.scrollIntoView) {
      try { linha.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* segue */ }
    }
  })();
};
