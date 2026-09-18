/* ============================================================
   LOK CAR — SISTEMA · telas/contratos.js
   ------------------------------------------------------------
   §12 a §19 do pedido: lista, acompanhamento de assinatura,
   gerador, pré-visualização, edição, contrato manual e o
   contrato demonstrativo.

   O QUE ESTA TELA NÃO FAZ — E É O MAIS IMPORTANTE DELA
   ------------------------------------------------------------
   Ela NÃO ESCREVE CONTRATO. Nem uma cláusula, nem um valor, nem
   um dado da empresa. Todo o texto vem de `LOKCAR_CONTRATO.montar()`
   (o template centralizado que o §19 pediu) e todo dado de
   `LOKCAR_SESSAO`. Aqui só existe o desenho da prévia e as ações
   em volta dela.

   A razão é prática: um contrato que aparece na tela e outro que
   sai impresso precisam ser o MESMO documento. No instante em que
   a tela montasse a sua própria versão do texto, existiriam duas
   — e a divergência só apareceria no papel, depois de assinado.

   DUAS HONESTIDADES QUE ESTA TELA FAZ QUESTÃO DE MANTER
   ------------------------------------------------------------
   1) NÃO FINJE ASSINATURA DIGITAL. O botão diz "Registrar
      assinatura presencial" porque é isso que ele faz: anota que
      o papel foi assinado. Não há campo de assinatura eletrônica,
      não há hash, não há "assinado em" automático. A coleta
      digital está escrita como dependência de backend, no lugar
      onde ela ficaria.
   2) NÃO ESCONDE O QUE FALTA. O contrato desta fase sai
      incompleto — sem CNPJ, sem endereço, sem caução, sem
      franquia — porque esses dados são da Lok Car e ninguém os
      forneceu. Em vez de preencher com um número plausível, a
      prévia lista exatamente o que falta e leva ao campo.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.contratos = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;
  var C = window.LOKCAR_CONTRATO;

  var params = (ctx && ctx.params) || {};
  var ALVO = ctx && ctx.alvo ? String(ctx.alvo) : null;

  var esc = U.esc;
  var API = 'Disponível após integração do backend.';

  /* ==========================================================
     1 · SITUAÇÃO DO CONTRATO
     ----------------------------------------------------------
     O pedido lista seis status. Além deles, o operador precisa
     responder três perguntas práticas: em que pé está, o que
     falta agora e qual é a próxima ação. `situacao()` responde as
     três de uma vez, para a lista e a ficha não divergirem.
     ========================================================== */
  var PROXIMA = {
    rascunho:   'Gerar o contrato para sair do rascunho.',
    gerado:     'Enviar ao cliente e marcar como aguardando assinatura.',
    enviado:    'Aguardar o retorno e registrar a assinatura.',
    aguardando: 'Cobrar a assinatura e registrar quando voltar assinado.',
    assinado:   'Nada pendente. A reserva já pode ser liberada para retirada.',
    cancelado:  'Contrato cancelado — não segue para assinatura.'
  };

  var situacao = function (k) {
    var r = k.reserva ? S.reserva(k.reserva) : null;
    var l = k.locacao ? S.locacao(k.locacao) : (r ? S.locacaoDaReserva(r.id) : null);
    var c = r ? S.cliente(r.clienteId) : null;
    var v = r ? S.veiculo(r.veiculoId) : null;

    var gerado = k.status !== 'rascunho';
    var enviado = k.status === 'enviado' || k.status === 'aguardando' || k.status === 'assinado';
    var assinado = k.status === 'assinado';

    return {
      reserva: r, locacao: l, cliente: c, veiculo: v,
      gerado: gerado, enviado: enviado, assinado: assinado,
      proxima: PROXIMA[k.status] || 'Acompanhar o contrato.'
    };
  };

  /* ==========================================================
     2 · LISTA
     ========================================================== */
  var ABAS = [
    { id: 'todos',     rotulo: 'Todos',                 teste: null },
    { id: 'rascunho',  rotulo: 'Rascunhos',             teste: function (k) { return k.status === 'rascunho'; } },
    { id: 'gerado',    rotulo: 'Gerados',               teste: function (k) { return k.status === 'gerado'; } },
    { id: 'enviado',   rotulo: 'Enviados',              teste: function (k) { return k.status === 'enviado'; } },
    { id: 'aguardando', rotulo: 'Aguardando assinatura', teste: function (k) { return k.status === 'aguardando'; } },
    { id: 'assinado',  rotulo: 'Assinados',             teste: function (k) { return k.status === 'assinado'; } },
    { id: 'cancelado', rotulo: 'Cancelados',            teste: function (k) { return k.status === 'cancelado'; } }
  ];

  var acharAba = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return null;
  };

  var filtroDe = function (f) { return acharAba(f) || ABAS[0]; };

  var BUSCA = params.q ? String(params.q) : '';

  var normalizar = function (v) {
    var t = String(v === null || v === undefined ? '' : v).toLowerCase();
    return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
  };

  var digitos = function (v) { return String(v || '').replace(/\D/g, ''); };

  var alvosDe = function (k) {
    var s = situacao(k);
    return [k.codigo, k.via,
            s.cliente ? s.cliente.nome : '', s.cliente ? s.cliente.doc : '',
            s.cliente ? s.cliente.telefone : '',
            s.veiculo ? s.veiculo.modelo : '', s.veiculo ? s.veiculo.placa : '',
            s.reserva ? s.reserva.codigo : '',
            k.modelo ? 'demonstrativo modelo' : ''].filter(Boolean);
  };

  var combinaBusca = function (k, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;

    var alvos = alvosDe(k);
    var texto = alvos.map(normalizar).join(' ');
    var nums = alvos.map(digitos).filter(Boolean).join(' ');

    return termos.every(function (t) {
      if (/^[\d\s().-]+$/.test(t)) {
        var d = digitos(t);
        return d ? nums.indexOf(d) !== -1 : true;
      }
      return texto.indexOf(t) !== -1;
    });
  };

  /* Ordem: o que trava a operação primeiro. "Aguardando assinatura"
     no topo porque é o que impede a retirada do carro — e é o
     contrato que mais depende de uma ligação para o cliente. */
  var peso = { aguardando: 0, enviado: 1, gerado: 2, rascunho: 3, assinado: 4, cancelado: 5 };

  var ordenar = function (lista) {
    return lista.slice().sort(function (a, b) {
      var pa = peso[a.status], pb = peso[b.status];
      if (pa !== pb) return pa - pb;
      return D.diffDias(a.criadoEm, b.criadoEm);
    });
  };

  var filtrar = function (filtro) {
    return ordenar(D.CONTRATOS.filter(function (k) {
      if (filtro.teste && !filtro.teste(k)) return false;
      return combinaBusca(k, BUSCA);
    }));
  };

  var contar = function (filtro) {
    return D.CONTRATOS.filter(function (k) {
      return filtro.teste ? filtro.teste(k) : true;
    }).length;
  };

  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist">' + ABAS.map(function (a) {
      return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" data-f="' + a.id + '"' +
             (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
             esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
    }).join('') + '</div>';
  };

  var linhaTabela = function (k) {
    var s = situacao(k);

    /* O contrato demonstrativo é marcado NA LISTA, não só dentro
       dele. Um contrato de exemplo que pareça um contrato real na
       lista é um contrato de exemplo que alguém vai imprimir e
       mandar assinar. */
    var nome = k.modelo
      ? '<span class="u-b">Contrato demonstrativo</span><span class="tbl__dim">exemplo de formato — não é de nenhum cliente</span>'
      : (s.cliente
          ? '<span class="u-b">' + esc(s.cliente.nome) + '</span><span class="tbl__dim">' + esc(s.cliente.doc) + '</span>'
          : '<span class="falta">sem locatário vinculado</span>');

    var veiculo = k.modelo
      ? '<span class="tbl__dim">veículo de exemplo</span>'
      : (s.veiculo
          ? '<span class="u-b">' + esc(s.veiculo.modelo) + '</span><span class="tbl__dim mono">' + esc(s.veiculo.placa) + '</span>'
          : '<span class="falta">veículo não definido</span>');

    var origem = k.modelo
      ? '<span class="tbl__dim">não vem de reserva</span>'
      : (s.reserva
          ? '<span class="mono">' + esc(s.reserva.codigo) + '</span><span class="tbl__dim">' +
            (s.locacao ? 'locação ' + esc(s.locacao.codigo) : 'reserva') + '</span>'
          : '<span class="falta">sem reserva de origem</span>');

    return '<tr data-abre="' + k.id + '" data-modelo="' + (k.modelo ? '1' : '0') + '">' +
      '<td><span class="mono">' + esc(k.codigo) + '</span>' +
        (k.modelo ? '<span class="tbl__dim">demonstrativo</span>' : '') + '</td>' +
      '<td>' + nome + '</td>' +
      '<td>' + veiculo + '</td>' +
      '<td>' + origem + '</td>' +
      '<td>' + U.crachaContrato(k) + '</td>' +
      '<td><span class="u-tab">' + D.fmtData(k.atualizadoEm || k.criadoEm) + '</span>' +
        '<span class="tbl__dim">criado em ' + D.fmtData(k.criadoEm) + '</span></td>' +
      '<td><div class="tbl__acts">' +
        '<span class="ab ab--pri" data-acao="ver" data-id="' + k.id + '">' +
          (k.modelo ? 'Ver contrato demonstrativo' : 'Ver contrato') + '</span>' +
      '</div></td>' +
    '</tr>';
  };

  var htmlTabela = function (lista) {
    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Contrato</th><th>Locatário</th><th>Veículo</th><th>Origem</th>' +
        '<th>Situação</th><th>Movimento</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(linhaTabela).join('') + '</tbody>' +
      '</table></div>';
  };

  var htmlVazio = function () {
    return U.vazio(
      BUSCA ? 'Nenhum contrato encontrado' : 'Nenhum contrato nesta situação',
      BUSCA
        ? 'Nenhum contrato casa com “' + BUSCA + '”. A busca olha código, locatário, CPF/CNPJ, telefone, veículo, placa e código da reserva.'
        : 'Nenhum contrato está nesta situação. O contrato nasce da reserva confirmada — é na reserva que o operador gera.',
      BUSCA ? U.botao('Limpar busca', 'limpar', 'out')
            : U.botao('Ver as reservas', 'ir-reservas', 'out')
    );
  };

  var htmlLista = function (filtro, lista) {
    var aguardando = D.CONTRATOS.filter(function (k) { return k.status === 'aguardando'; }).length;
    var assinados = D.CONTRATOS.filter(function (k) { return k.status === 'assinado'; }).length;

    return '<div class="filtros">' +
      '<div class="busca">' +
        '<svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input class="busca__inp" type="search" data-busca="1" value="' + esc(BUSCA) + '" ' +
        'placeholder="Código, locatário, CPF/CNPJ, telefone, veículo ou placa" />' +
      '</div>' +
      '<div class="filtros__dir">' +
        '<span class="filtros__n" data-slot="n">' +
          lista.length + (lista.length === 1 ? ' contrato' : ' contratos') +
          ' · ' + aguardando + ' aguardando assinatura' +
          ' · ' + assinados + ' assinado(s)' +
        '</span>' +
      '</div>' +
    '</div>' +
    '<div class="u-mb">' + htmlAbas(filtro) + '</div>' +
    '<div data-slot="lista">' + (lista.length ? htmlTabela(lista) : htmlVazio()) + '</div>';
  };

  /* ==========================================================
     3 · A PRÉVIA DO DOCUMENTO
     ----------------------------------------------------------
     Este é o único lugar do sistema que desenha contrato, e ele
     desenha o que `C.montar()` devolveu — nada mais. Serve para a
     ficha de um contrato, para o gerador e para o contrato
     demonstrativo, porque é literalmente a mesma função.
     ========================================================== */
  var valorDe = function (valor) {
    if (!valor) return '<span class="doc__falta">Dado a configurar</span>';
    if (valor.pendente) {
      /* O texto do pendente é o NOME do dado que falta — e clicar
         nele leva ao campo, quando o template souber dizer onde
         ele fica. É o que transforma "não configurado" em "vou
         configurar agora". */
      var onde = valor.deOnde && valor.deOnde.tela;
      var rot = esc(valor.oQue);
      if (onde) {
        return '<a class="doc__falta" href="#" data-acao="ir-config" data-para="' + esc(onde) +
               '" data-campo="' + esc((valor.deOnde && valor.deOnde.campo) || '') +
               '" title="Configurar: ' + rot + '">' + rot + '</a>';
      }
      return '<span class="doc__falta">' + rot + '</span>';
    }
    return esc(valor.valor);
  };

  var blocoDoc = function (b) {
    return '<div class="doc__b">' +
      '<h4>' + esc(b.t) + '</h4>' +
      '<dl>' + b.linhas.map(function (l) {
        return '<div><dt>' + esc(l.rotulo) + '</dt><dd>' + valorDe(l.valor) + '</dd></div>';
      }).join('') + '</dl>' +
    '</div>';
  };

  var clausulaDoc = function (cl) {
    var paragrafos = cl.p.map(function (p) {
      if (typeof p === 'string') return '<p>' + esc(p) + '</p>';
      var r = S.regras().filter(function (x) { return x.id === p.regra; })[0];
      var semValor = !r || r.valor === null || r.valor === undefined || r.valor === '';
      var v = semValor
        ? '<span class="doc__falta">a definir pela locadora</span>'
        : esc(r.unidade === 'R$' ? 'R$ ' + D.fmtBRL(r.valor).replace('R$ ', '') : String(r.valor));
      return '<p>' + esc(p.antes) + v + esc(p.depois) + '</p>';
    }).join('');
    return '<div class="doc__cl"><h4>CLÁUSULA ' + cl.n + ' — ' + esc(cl.t) + '</h4>' + paragrafos + '</div>';
  };

  var htmlDocumento = function (c) {
    return '<div class="doc" data-slot="doc">' +
      (c.modelo ? '<span class="doc__modelo">' + esc(C.AVISO_MODELO) + '</span>' : '') +
      '<div class="doc__h">' +
        '<h3>' + esc(c.titulo) + '</h3>' +
        '<p>Contrato ' + esc(c.codigo) + '</p>' +
      '</div>' +
      c.blocos.map(blocoDoc).join('') +
      '<div class="doc__b">' +
        '<h4>CLÁUSULAS</h4>' +
        c.clausulas.map(clausulaDoc).join('') +
      '</div>' +
      '<div class="doc__ass">' +
        '<p class="doc__ass-local">' + valorDe(c.assinatura.local) +
          ', ' + D.fmtData(c.assinatura.data) + '</p>' +
        c.assinatura.partes.map(function (p) {
          return '<div class="doc__ass-par">' +
            '<div class="doc__ass-linha"></div>' +
            '<b>' + valorDe(p.nome) + '</b>' +
            '<span>' + esc(p.papel) + ' · ' + valorDe(p.doc) + '</span>' +
          '</div>';
        }).join('') +
        '<p class="doc__nota">' + esc(c.assinatura.nota) + ' A assinatura eletrônica com validade jurídica ' +
        'depende de integração com um provedor de assinatura — ' + esc(API) + '</p>' +
      '</div>' +
      '<p class="doc__pe">' + esc(C.AVISO_MODELO) + '</p>' +
    '</div>';
  };

  /* O aviso de pendências. Ele separa DUAS COISAS, porque a ação
     é diferente: o que depende da Lok Car (Configurações) e o que
     depende do cadastro do cliente ou do veículo. Uma lista única
     de quinze itens não diz por onde começar. */
  var htmlPendentes = function (c) {
    var resumo = C.resumoPendentes(c);
    if (!resumo.total) return '';

    var ico = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 9v4M12 17v.01M10.3 4l8 14H2.3z"/></svg>';

    var itens = c.pendentes.filter(function (p) { return p.pendente; }).slice(0, 8);

    return '<div class="penddoc">' +
      '<p class="penddoc__t">' + ico +
        resumo.total + (resumo.total === 1 ? ' dado falta' : ' dados faltam') +
        ' para este contrato sair completo</p>' +
      '<ul>' + itens.map(function (p) {
        var onde = p.deOnde && p.deOnde.tela === '#/configuracoes'
          ? '<b>Configurações</b>'
          : '<b>Cadastro</b>';
        return '<li>' + onde + ' · ' + esc(p.oQue) + '</li>';
      }).join('') +
      (resumo.total > itens.length ? '<li><b>+</b> mais ' + (resumo.total - itens.length) + '</li>' : '') +
      '</ul>' +
      '<p class="u-xs u-t4 u-mt">' +
        (resumo.locadora
          ? resumo.locadora + ' dependem dos dados da Lok Car em CONFIGURAÇÕES e ' + resumo.cadastro +
            ' do cadastro. Nenhum deles foi preenchido com valor inventado: o que falta aparece no ' +
            'documento como "Dado a configurar".'
          : 'Todos dependem do cadastro do cliente ou do veículo.') +
      '</p>' +
    '</div>';
  };

  /* ==========================================================
     4 · AÇÕES DO CONTRATO
     ----------------------------------------------------------
     As ações existem na fase em que fazem sentido. O contrato
     assinado não oferece "gerar de novo"; o cancelado não oferece
     nada. Botão desenhado onde a ação não vale é botão morto.
     ========================================================== */
  var acoesDe = function (s) {
    var k = s.k;
    var lista = [];
    var ativo = k.status !== 'cancelado';
    var rascunho = k.status === 'rascunho';

    /* A TRAVA MAIS IMPORTANTE DESTA TELA: um contrato cuja locação
       já começou não se edita, não se reenvia e não se cancela.
       Mexer nele é mexer num documento que está na mão de alguém,
       com um carro na rua. O sistema não impede o distrato — só
       não o faz sozinho, por um clique numa tela de lista. */
    var emCurso = Boolean(s.locacao && s.locacao.status !== 'finalizada') ||
                  Boolean(s.reserva && (s.reserva.status === 'andamento' ||
                                        s.reserva.status === 'finalizada'));
    var motivoCurso = 'A locação já começou: este contrato está em vigor e não muda pelo sistema. ' +
                      'Uma alteração de condições agora é distrato ou aditivo, decisão da locadora.';

    /* Estas três nunca bloqueiam — e mesmo assim têm motivo. A
       bancada exige o sexto argumento de `U.botao` em toda ação,
       porque uma ação bloqueada sem motivo é um beco sem saída; a
       regra pegou este caso e estava certa em pegá-lo, ainda que
       aqui o motivo seja "por que está sempre disponível". */
    lista.push({
      id: 'previa', rotulo: 'Ir para o documento', tom: 'out', liberada: true,
      motivo: 'Disponível em qualquer situação: o documento pode ser conferido mesmo cancelado.'
    });

    lista.push({
      id: 'editar', rotulo: rascunho ? 'Revisar e gerar contrato' : 'Editar / salvar rascunho',
      tom: rascunho ? 'pri' : 'out',
      liberada: ativo && !emCurso,
      motivo: !ativo ? 'O contrato está cancelado.' : motivoCurso
    });

    lista.push({
      id: 'enviar', rotulo: 'Enviar ao cliente', tom: 'out',
      liberada: ativo && !emCurso && (k.status === 'gerado' || k.status === 'enviado' ||
                                      k.status === 'aguardando'),
      motivo: !ativo ? 'O contrato está cancelado.'
            : (emCurso ? motivoCurso
            : (rascunho ? 'Gere o contrato antes de enviar.'
            : 'O contrato já está assinado.'))
    });

    lista.push({
      id: 'assinar', rotulo: 'Registrar assinatura presencial',
      tom: k.status === 'aguardando' ? 'pri' : 'out',
      liberada: ativo && !emCurso && (k.status === 'aguardando' || k.status === 'enviado'),
      motivo: !ativo ? 'O contrato está cancelado.'
            : (emCurso ? motivoCurso
            : (k.status === 'assinado' ? 'O contrato já está assinado.'
                                       : 'Envie o contrato antes de registrar a assinatura.'))
    });

    lista.push({
      id: 'copiar', rotulo: 'Copiar texto', tom: 'out', liberada: true,
      motivo: 'Disponível em qualquer situação: é só a leitura do documento em texto puro.'
    });
    lista.push({
      id: 'imprimir', rotulo: 'Imprimir', tom: 'out', liberada: true,
      motivo: 'Disponível em qualquer situação: a via impressa de um contrato cancelado é ' +
              'justamente o que comprova que ele não seguiu.'
    });

    lista.push({
      id: 'cancelar', rotulo: 'Cancelar contrato', tom: 'out',
      liberada: ativo && !emCurso && k.status !== 'assinado',
      motivo: !ativo ? 'O contrato já está cancelado.'
            : (emCurso ? motivoCurso
            : 'Um contrato assinado não é cancelado pelo sistema — o distrato é decisão da locadora.')
    });

    return lista;
  };

  /* ==========================================================
     5 · A FICHA
     ========================================================== */
  var BLOCO_ICO = {
    documento: 'M7 3h7l4 4v14H7zM14 3v5h4',
    fluxo:     'M4 7h10M18 4l3 3-3 3M20 17H10M6 14l-3 3 3 3',
    origem:    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'
  };

  var bloco = function (id, titulo, conteudo, nota) {
    return '<section class="bloco">' +
      '<div class="bloco__h">' +
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (BLOCO_ICO[id] || BLOCO_ICO.documento) + '"/></svg>' +
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
     A · ONDE O CONTRATO ESTÁ NO FLUXO
     ---------------------------------------------------------
     Esta é a resposta ao §19: o pedido quer o caminho
     RESERVA → CLIENTE → VEÍCULO → VALORES → CONTRATO →
     PRÉVIA → ENVIO → ASSINATURA → LOCAÇÃO visível e percorrível.
     Aqui ele aparece como situação, não como promessa: cada
     etapa diz se está cumprida e o que falta nela.
     --------------------------------------------------------- */
  var htmlFluxo = function (k, s) {
    var preco = s.reserva ? D.preco(s.reserva) : null;

    var etapas = [
      /* `U.crachaReserva` e não `D.acharStatus`: a reserva não
         guarda o status final dela, guarda o ESTÁGIO. Um contrato
         assinado de uma locação já em andamento tem uma reserva
         ainda em `pronta` — dizer "Pronta para retirada" aqui
         contradiria o bloco de locação, que mostra o carro na rua. */
      { nome: 'Reserva', feito: Boolean(s.reserva),
        texto: s.reserva ? s.reserva.codigo + ' · ' + U.crachaReserva(s.reserva)
                         : 'este contrato não vem de reserva' },
      { nome: 'Cliente', feito: Boolean(s.cliente),
        texto: s.cliente ? s.cliente.nome : 'sem locatário vinculado' },
      { nome: 'Veículo', feito: Boolean(s.veiculo),
        texto: s.veiculo ? s.veiculo.modelo + ' · ' + s.veiculo.placa : 'sem veículo definido' },
      { nome: 'Valores', feito: Boolean(preco && !preco.incompleto),
        texto: preco
          ? (preco.incompleto ? 'há item sem valor na tabela' : D.fmtBRL(preco.total) + ' de total')
          : 'sem tabela de origem' },
      { nome: 'Contrato', feito: s.gerado,
        texto: s.gerado ? 'gerado em ' + D.fmtData(k.criadoEm) : 'ainda em rascunho' },
      { nome: 'Envio', feito: s.enviado,
        texto: k.enviadoEm ? 'enviado por ' + (k.via || 'via não registrada') + ' em ' + D.fmtData(k.enviadoEm)
                           : 'ainda não enviado' },
      { nome: 'Assinatura', feito: s.assinado,
        texto: s.assinado ? 'registrada em ' + D.fmtData(k.atualizadoEm)
                          : 'o sistema não coleta assinatura digital nesta fase' },
      { nome: 'Locação', feito: Boolean(s.locacao),
        texto: s.locacao ? s.locacao.codigo + ' · ' + U.crachaLocacao(s.locacao)
                         : 'nasce na retirada do veículo' }
    ];

    var feitas = etapas.filter(function (e) { return e.feito; }).length;

    return bloco('fluxo', 'Onde este contrato está no fluxo', corpo(
      '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr><th>Etapa</th><th>Situação</th></tr></thead><tbody>' +
      etapas.map(function (e) {
        return '<tr><td><span class="u-b">' + esc(e.nome) + '</span></td>' +
          '<td>' + (e.feito ? U.etiqueta('Cumprida', 'ok') : U.etiqueta('Pendente', 'idle')) +
          ' <span class="tbl__dim">' + esc(e.texto) + '</span></td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<p class="u-xs u-t4 u-mt">' + feitas + ' de ' + etapas.length + ' etapas cumpridas. ' +
      'A última etapa não é uma ação desta tela: a locação nasce no momento em que o veículo sai, ' +
      'na tela da reserva. O contrato é a etapa imediatamente anterior e é ela que libera a retirada.</p>'
    ), feitas + ' de ' + etapas.length);
  };

  /* ---------------------------------------------------------
     B · AS TRÊS AMARRAÇÕES DO CONTRATO
     ---------------------------------------------------------
     O §12 diz que cada contrato está ligado a CLIENTE +
     RESERVA/LOCAÇÃO + VEÍCULO. Aqui estão as três, com atalho.
     --------------------------------------------------------- */
  var htmlAmarracoes = function (k, s) {
    var linhas = [
      ['Locatário', s.cliente
        ? '<a class="ab" href="#/clientes/' + s.cliente.id + '" data-acao="ir" data-para="#/clientes/' + s.cliente.id + '">' +
          esc(s.cliente.nome) + '</a> <span class="tbl__dim mono">' + esc(s.cliente.doc) + '</span>'
        : '<span class="falta">sem locatário vinculado</span>'],
      ['Reserva', s.reserva
        ? '<a class="ab" href="#/reservas/' + s.reserva.id + '" data-acao="ir" data-para="#/reservas/' + s.reserva.id + '">' +
          esc(s.reserva.codigo) + '</a> ' + U.crachaReserva(s.reserva)
        : '<span class="falta">sem reserva de origem</span>'],
      ['Locação', s.locacao
        ? '<a class="ab" href="#/locacoes/' + s.locacao.id + '" data-acao="ir" data-para="#/locacoes/' + s.locacao.id + '">' +
          esc(s.locacao.codigo) + '</a> ' + U.crachaLocacao(s.locacao)
        : '<span class="falta">ainda não iniciada</span>'],
      ['Veículo', s.veiculo
        ? '<a class="ab" href="#/frota/' + s.veiculo.id + '" data-acao="ir" data-para="#/frota/' + s.veiculo.id + '">' +
          esc(s.veiculo.modelo) + '</a> <span class="tbl__dim mono">' + esc(s.veiculo.placa) + '</span>'
        : '<span class="falta">sem veículo definido</span>'],
      ['Criado em', D.fmtData(k.criadoEm)],
      ['Último movimento', D.fmtData(k.atualizadoEm || k.criadoEm)]
    ];

    return bloco('origem', 'A que este contrato está amarrado', corpo(ficha(linhas)));
  };

  var htmlDetalhe = function (k) {
    var s = situacao(k);
    s.k = k;

    var c = C.montar(k);
    var acoes = acoesDe(s);

    return '' +
      '<div class="reg">' +
      '  <a class="reg__voltar" href="#/contratos" data-acao="voltar">' +
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
      '    Todos os contratos' +
      '  </a>' +
      '  <div class="reg__id">' +
      '    <span class="reg__cod">' + esc(k.codigo) + '</span>' +
      '    ' + U.crachaContrato(k) +
      '    ' + (k.modelo ? U.etiqueta('Demonstrativo', 'warn') : '') +
      '    <span class="reg__quando">' +
          (k.modelo
            ? 'Contrato de exemplo — não pertence a nenhum cliente'
            : (s.cliente ? esc(s.cliente.nome) : 'sem locatário') + ' · ' +
              (s.veiculo ? esc(s.veiculo.modelo) + ' <span class="mono">' + esc(s.veiculo.placa) + '</span>'
                         : 'sem veículo')) +
      '    </span>' +
      '  </div>' +
      '  <div class="reg__acoes">' +
        acoes.map(function (b) {
          return U.botao(b.rotulo, 'acao', b.tom, { qual: b.id }, !b.liberada, b.motivo);
        }).join('') +
      '  </div>' +
      '  <p class="u-xs u-t4">' + esc(s.proxima) + '</p>' +
      '</div>' +

      (k.modelo
        ? '<div class="aviso u-mb">' +
          '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M12 9v4M12 17v.01M10.3 4l8 14H2.3z"/></svg>' +
          '<span><b>Contrato demonstrativo.</b> Ele existe para mostrar o formato do documento — ' +
          'as seções, a ordem das cláusulas, o rodapé. O locatário é "Cliente Demonstração", os documentos ' +
          'estão mascarados e os valores são de exemplo. Nenhum dado aqui é real e nenhum deve ser ' +
          'levado para um contrato de verdade.</span></div>'
        : '') +

      '<div class="blocos">' +
        htmlFluxo(k, s) +
        htmlAmarracoes(k, s) +
        bloco('documento', 'Pré-visualização do contrato', corpo(
          htmlPendentes(c) +
          htmlDocumento(c) +
          (k.texto
            ? '<div class="bloco__b u-mt"><p class="fld__lbl">Observação particular desta locação</p>' +
              '<p class="u-sm">' + esc(k.texto) + '</p>' +
              '<p class="u-xs u-t4">Texto gravado por EDITAR. Não faz parte das cláusulas do template.</p></div>'
            : '') +
          '<p class="u-xs u-t4 u-mt" data-slot="det">O texto vem inteiro de um template único. ' +
          'Esta tela não escreve cláusula nenhuma — ela só desenha o que o template devolveu, ' +
          'para que a prévia e o documento impresso sejam o mesmo documento. ' +
          'A impressão usa a impressão do navegador (Ctrl+P): o sistema esconde o menu e o trilho ' +
          'e mantém o documento.</p>'
        ), c.pendentes.length ? c.pendentes.length + ' a definir' : 'completo')
      '</div>';
  };

  /* ==========================================================
     6 · DIÁLOGOS
     ========================================================== */
  var abrirEnviar = function (k) {
    /* Só a VIA é registrada, porque é só isso que `enviarContrato`
       guarda. Um campo "Para (e-mail)" aqui seria enfeite: o
       operador digitaria o endereço e o sistema o descartaria sem
       avisar. Campo que não vira dado é pior do que campo ausente. */
    U.abrirModal({
      titulo: 'Enviar contrato ' + k.codigo,
      sub: 'O sistema registra por onde o contrato saiu e passa o documento para aguardando assinatura.',
      corpo:
        U.fldSel('Via de envio', 'via', [
          { valor: 'E-mail', rotulo: 'E-mail' },
          { valor: 'WhatsApp', rotulo: 'WhatsApp' },
          { valor: 'Presencial', rotulo: 'Entregue em mão' },
          { valor: 'Link', rotulo: 'Link do documento' }
        ], k.via || 'E-mail') +
        '<p class="u-xs u-t4 u-mt">O envio em si — disparar o e-mail ou a mensagem — depende de serviço ' +
        'transacional, e ' + esc(API) + ' O que o sistema faz agora é registrar <b>por onde</b> saiu e ' +
        '<b>quando</b>, que é o que a lista de acompanhamento precisa para saber há quantos dias o ' +
        'contrato está parado esperando assinatura.</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Registrar envio', tom: 'pri', acao: 'enviar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'enviar') return;
        var c = U.lerCampos();
        var r = S.enviarContrato(k.id, c.via);
        fechar();
        U.resultado(r);
        U.desenhar();
      }
    });
  };

  var abrirAssinar = function (k) {
    var s = situacao(k);

    /* SEM FORMULÁRIO. A tentação aqui é pedir data, via, nome de
       quem assinou, observação — e `assinarContrato(id)` não
       recebe nada disso. Preencher oito campos e guardar zero é
       mentir para o operador. Então o diálogo é uma CONFIRMAÇÃO
       com a explicação do que ele é e do que ele não é. */
    U.confirmar('Registrar a assinatura de ' + k.codigo + '?',
      'Confirma que o documento em papel voltou assinado pelo locatário' +
      (s.cliente ? ' (' + s.cliente.nome + ')' : '') +
      '. O contrato passa a ASSINADO e sai da fila de cobrança.' +
      '\n\nIsto não é assinatura digital: o sistema não coleta assinatura eletrônica nesta fase — ' +
      'não há certificado, hash nem carimbo de tempo. O que este registro anota é que o papel foi ' +
      'assinado, para o acompanhamento saber que o contrato saiu da fila. A coleta com validade ' +
      'jurídica depende de integração com um provedor de assinatura — ' + API,
      'Registrar assinatura', function () {
        U.resultado(S.assinarContrato(k.id));
        U.desenhar();
      });
  };

  /* ----------------------------------------------------------
     EDITAR / SALVAR RASCUNHO (§16)
     ----------------------------------------------------------
     O §16 pede EDITAR / SALVAR RASCUNHO / GERAR CONTRATO. A
     edição aqui NÃO é de cláusula: reescrever uma cláusula à mão
     criaria um contrato que o template não conhece mais, e a
     próxima prévia passaria a divergir do que foi assinado.

     O que se edita é a RESSALVA DO DOCUMENTO — o espaço para o
     que é específico daquela locação e não cabe em cláusula
     padrão. Ela é guardada em `k.texto` (o campo que
     `salvarTextoContrato` já preenche) e aparece no fim da
     prévia, identificada como observação particular.
     ---------------------------------------------------------- */
  var abrirEditar = function (k) {
    var c = C.montar(k);

    U.abrirModal({
      titulo: 'Editar contrato ' + k.codigo,
      sub: 'Ressalvas particulares desta locação, acrescentadas ao documento depois das cláusulas.',
      largo: true,
      corpo:
        '<div class="aviso u-mb">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 9v4M12 17v.01M10.3 4l8 14H2.3z"/></svg>' +
        '<span>As <b>cláusulas 1 a 18 não são editáveis nesta tela</b>. Elas vêm de um template único e é ' +
        'isso que garante que a prévia, o documento impresso e o contrato arquivado sejam o mesmo texto. ' +
        'Alterar uma cláusula de verdade é alterar o template, que é decisão jurídica da locadora — ' +
        'não um ajuste de tela. O que você escreve aqui entra como observação particular, ' +
        'depois das cláusulas.</span></div>' +
        '<div class="grid2 u-mb">' +
          '<div><p class="fld__lbl">Contrato</p><p><span class="mono">' + esc(k.codigo) + '</span> ' +
            U.crachaContrato(k) + '</p></div>' +
          '<div><p class="fld__lbl">Locatário</p><p>' +
            (situacao(k).cliente ? esc(situacao(k).cliente.nome) : '<span class="falta">não vinculado</span>') +
          '</p></div>' +
        '</div>' +
        U.fldTxt('Observação particular', 'texto', k.texto || '',
          'Ex.: o veículo será entregue no endereço informado, com o locatário presente na vistoria de saída.') +
        '<p class="u-xs u-t4 u-mt">Deixar em branco mantém o documento exatamente como o template o montou.' +
        (c.pendentes.length
          ? ' O contrato ainda tem <b>' + c.pendentes.length + '</b> dado(s) a definir — eles continuam ' +
            'sinalizados no documento independentemente do que você escrever aqui.'
          : '') + '</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Salvar rascunho', tom: 'out', acao: 'rascunho' },
        { rotulo: k.status === 'rascunho' ? 'Gerar contrato' : 'Salvar', tom: 'pri', acao: 'salvar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'salvar' && acao !== 'rascunho') return;

        var campos = U.lerCampos();
        /* "Salvar rascunho" grava o texto mas mantém a situação;
           para um contrato em rascunho, é o que permite sair e
           voltar depois. "Gerar contrato" grava e promove — é o
           `salvarTextoContrato` que faz a promoção, porque é ele
           que decide que um rascunho com texto virou contrato. */
        var r = S.salvarTextoContrato(k.id, campos.texto || '');

        if (r.ok !== false && acao === 'rascunho' && k.status !== 'rascunho') {
          U.canto('Observação salva. O contrato já estava gerado, então a situação não mudou.', 'ok');
        } else {
          U.resultado(r);
        }

        fechar();
        U.desenhar();
      }
    });
  };

  var abrirCancelar = function (k) {
    U.confirmar('Cancelar o contrato ' + k.codigo + '?',
      'O contrato sai do fluxo de assinatura e passa a CANCELADO. A reserva de origem não é cancelada ' +
      'por isso — se o locatário desistiu, cancele a reserva separadamente.',
      'Cancelar contrato', function () {
        U.resultado(S.cancelarContrato(k.id));
        U.desenhar();
      });
  };

  var abrirCopiar = function (k) {
    var c = C.montar(k);
    var texto = C.paraTexto(c);

    U.abrirModal({
      titulo: 'Texto do contrato ' + k.codigo,
      sub: 'Versão em texto puro, para colar em e-mail ou editor. O que falta aparece entre colchetes.',
      largo: true,
      corpo: '<textarea class="fld__txt" data-campo="_texto" readonly style="min-height:44vh">' +
             esc(texto) + '</textarea>' +
             '<p class="u-xs u-t4 u-mt">Copiar automaticamente depende de permissão da área de ' +
             'transferência do navegador — ' + esc(API) + ' O texto está aqui para seleção manual.</p>',
      botoes: [
        { rotulo: 'Fechar', tom: 'out', acao: 'x' },
        { rotulo: 'Imprimir', tom: 'pri', acao: 'imprimir' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'imprimir') return;
        fechar();
        /* Imprimir é do navegador, não do sistema. O aviso diz o
           que vai acontecer antes de a caixa do navegador abrir. */
        if (window.print) {
          U.canto('Selecione o contrato na pré-visualização e use Ctrl+P. A impressão do sistema ' +
            'tira o menu e o trilho, mas mantém o documento.', 'aviso');
          window.print();
        }
      }
    });
  };

  /* Rola até o documento em vez de navegar com `?ver=doc`. Navegar
     recarregaria a ficha inteira só para descer a página, e a
     âncora de rota mudaria a URL sem mudar de tela — um passo em
     falso no histórico do navegador, que o botão Voltar revelaria. */
  var irParaDocumento = function () {
    var alvoDoc = cx.querySelector('[data-slot="det"]');
    if (alvoDoc && alvoDoc.scrollIntoView) {
      alvoDoc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    U.canto('O documento está logo abaixo, nesta mesma página.', 'aviso');
  };

  var imprimirFicha = function () {
    /* A impressão do sistema esconde menu, trilho e filtros
       (regra @media print em modulos.css) e mantém o `.doc`, que
       nessa regra perde a altura máxima e a rolagem interna. Ou
       seja: Ctrl+P já imprime o contrato, não a tela. O aviso
       existe para o operador não procurar um botão de imprimir
       dentro da caixa do navegador antes de saber disso. */
    if (!window.print) {
      U.canto('A impressão depende do navegador.', 'aviso');
      return;
    }
    U.canto('Imprimindo o documento. Menu, menu lateral e filtros saem da folha; ' +
      'o contrato sai inteiro.', 'aviso');
    window.print();
  };

  /* ==========================================================
     7 · CONTRATO MANUAL (§15)
     ----------------------------------------------------------
     "+ NOVO CONTRATO" existe para o caso que não passou pelo
     site: cliente que chegou no balcão e fechou na hora. O
     pedido diz que nesta fase o contrato manual é criado SEM
     reserva. Ele escolhe o cliente e o veículo, e o contrato
     nasce em RASCUNHO — nunca assinado, nunca com valor.
     ========================================================== */
  var abrirNovo = function () {
    var clientes = D.CLIENTES.map(function (c) {
      return { valor: c.id, rotulo: c.nome + ' · ' + c.doc };
    });
    var veiculos = D.VEICULOS.map(function (v) {
      return { valor: v.id, rotulo: v.modelo + ' · ' + v.placa };
    });

    U.abrirModal({
      titulo: 'Novo contrato',
      sub: 'Contrato avulso, criado direto no balcão. Nasce em rascunho e sem reserva de origem.',
      corpo:
        '<div class="aviso u-mb">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 9v4M12 17v.01M10.3 4l8 14H2.3z"/></svg>' +
        '<span>Um contrato avulso <b>não tem tabela de preço de origem</b>: sem reserva, não existe o que ' +
        'calcular. O sistema monta o documento com os dados do cliente e do veículo e deixa os valores ' +
        'para o financeiro — em vez de estimar um número que viraria cobrança errada.</span></div>' +
        '<div class="grid2">' +
          U.fldSel('Locatário', 'clienteId',
            [{ valor: '', rotulo: 'Selecione o cliente' }].concat(clientes), '') +
          U.fldSel('Veículo', 'veiculoId',
            [{ valor: '', rotulo: 'Selecione o veículo' }].concat(veiculos), '') +
        '</div>' +
        '<p class="u-xs u-t4 u-mt">O contrato nasce em <b>rascunho</b>. Ele é gerado quando você ' +
        'confirmar os dados na pré-visualização do documento.</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Criar rascunho', tom: 'pri', acao: 'criar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'criar') return;

        var campos = U.lerCampos();
        if (!campos.clienteId) {
          U.canto('Escolha o locatário do contrato.', 'aviso');
          return;
        }

        var res = S.criarContratoAvulso(campos.clienteId, campos.veiculoId);
        if (res.ok === false) { U.canto(res.mensagem, 'erro'); return; }

        fechar();
        U.resultado(res);
        U.navegar('#/contratos/' + res.contrato.id);
      }
    });
  };

  /* ==========================================================
     8 · GERADOR (§19)
     ----------------------------------------------------------
     O caminho RESERVA → … → CONTRATO. O operador escolhe a
     reserva, vê o que vai entrar no documento — cliente,
     veículo, valores e o que ainda falta — e gera. Gerar aqui
     chama a MESMA `S.criarContrato` que a tela de reservas usa:
     uma regra só, dois caminhos para chegar nela.
     ========================================================== */
  var elegiveis = function () {
    return D.RESERVAS.filter(function (r) {
      if (!r.clienteId) return false;
      if (S.contratoDaReserva(r.id)) return false;
      return r.status === 'confirmada' || r.status === 'contrato' || r.status === 'pronta';
    });
  };

  var abrirGerador = function () {
    var lista = elegiveis();

    if (!lista.length) {
      U.canto('Não há reserva confirmada sem contrato. Confirme a reserva antes de gerar.', 'aviso');
      return;
    }

    var opcoes = lista.map(function (r) {
      var c = S.cliente(r.clienteId);
      var v = S.veiculo(r.veiculoId);
      return {
        valor: r.id,
        rotulo: r.codigo + ' · ' + (c ? c.nome : 'sem cliente') + ' · ' +
                (v ? v.modelo + ' ' + v.placa : 'sem veículo') + ' · ' + D.fmtData(r.de)
      };
    });

    var primeira = lista[0];
    var preco = D.preco(primeira);

    U.abrirModal({
      titulo: 'Gerar contrato a partir de uma reserva',
      sub: 'O contrato é montado com os dados da reserva, do cliente e do veículo. Nada é digitado aqui.',
      largo: true,
      corpo:
        '<div class="grid2">' +
          U.fldSel('Reserva', 'reservaId',
            [{ valor: '', rotulo: 'Selecione a reserva' }].concat(opcoes), primeira.id) +
          U.fldSel('Data de emissão', 'emissao', [
            { valor: D.HOJE, rotulo: 'Hoje — ' + D.fmtData(D.HOJE) }
          ], D.HOJE) +
        '</div>' +
        '<p class="fld__lbl u-mt-lg">O que vai entrar no documento</p>' +
        '<div data-slot="previa">' + resumoGerador(primeira.id) + '</div>' +
        '<p class="u-xs u-t4 u-mt-lg">O documento sai em <b>gerado</b>. Depois disso ele pode ser enviado ' +
        'e a assinatura registrada na ficha do contrato. O sistema não altera o valor da reserva ao gerar ' +
        'o contrato: ele apenas transcreve a mesma conta do site.</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Gerar contrato', tom: 'pri', acao: 'gerar' }
      ],
      aoAbrir: function (bd) {
        /* A prévia muda quando troca a reserva. É o que evita
           gerar contrato da reserva errada — e a lista de
           pendências já aparece antes, não depois. */
        var sel = bd.querySelector('[data-campo="reservaId"]');
        if (sel) {
          sel.addEventListener('change', function () {
            var slot = bd.querySelector('[data-slot="previa"]');
            if (slot) slot.innerHTML = resumoGerador(sel.value);
          });
        }
      },
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'gerar') return;

        var campos = U.lerCampos();
        var r = S.criarContrato(campos.reservaId);
        if (r.ok === false) { U.canto(r.mensagem, 'erro'); return; }

        fechar();
        U.resultado(r);
        U.navegar('#/contratos/' + r.contrato.id);
      }
    });
  };

  var resumoGerador = function (reservaId) {
    var r = reservaId ? S.reserva(reservaId) : null;
    if (!r) return '<p class="falta">Selecione uma reserva para ver o que vai entrar no documento.</p>';

    var c = S.cliente(r.clienteId);
    var v = S.veiculo(r.veiculoId);
    var p = D.preco(r);

    /* Uma reserva de balcão recebida pelo site pode chegar sem
       cliente cadastrado. O gerador DIZ isso antes de gerar, em
       vez de produzir um contrato com locatário em branco. */
    var linhas = [
      ['Locatário', c
        ? esc(c.nome) + ' <span class="tbl__dim mono">' + esc(c.doc) + '</span>'
        : '<span class="falta">a reserva não tem cliente vinculado</span>'],
      ['CNH', c && c.cnh && c.cnh.numero
        ? esc(c.cnh.numero) + ' · categoria ' + esc(c.cnh.categoria || '—')
        : '<span class="falta">CNH não cadastrada — entra como dado a configurar</span>'],
      ['Veículo', v ? esc(v.modelo) + ' <span class="tbl__dim mono">' + esc(v.placa) + '</span>'
                    : '<span class="falta">veículo não definido</span>'],
      ['Período', '<span class="u-tab">' + D.fmtData(r.de) + '</span> a ' +
                  '<span class="u-tab">' + D.fmtData(r.ate) + '</span> · ' +
                  r.dias + (r.dias === 1 ? ' diária' : ' diárias')],
      ['Valor', p.incompleto
        ? '<span class="falta">' + (p.semTabela ? 'modelo sem tabela de diária' : 'há item sob consulta') + '</span>'
        : '<span class="u-tab">' + D.fmtBRL(p.total) + '</span>'],
      ['Situação da reserva', U.crachaReserva(r)]
    ];

    return ficha(linhas) +
      (p.incompleto
        ? '<div class="aviso u-mt">' +
          '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M12 9v4M12 17v.01M10.3 4l8 14H2.3z"/></svg>' +
          '<span>O valor desta reserva não fecha. O contrato pode ser gerado — ele vai escrever ' +
          '<b>a definir</b> no lugar do total, em vez de transcrever uma soma parcial como se fosse ' +
          'o preço final.</span></div>'
        : '');
  };

  /* ==========================================================
     9 · A TELA
     ========================================================== */
  var htmlTela = function () {
    if (ALVO && !S.contrato(ALVO)) {
      return U.pageHead('Contrato não encontrado',
        'O código <span class="mono">' + esc(ALVO) + '</span> não corresponde a nenhum contrato.') +
        U.vazio('Contrato não encontrado',
          'Pode ser um link antigo, ou o contrato foi removido da base.',
          U.botao('Ver todos os contratos', 'voltar', 'out'));
    }

    if (ALVO) return htmlDetalhe(S.contrato(ALVO));

    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);
    var demo = S.contrato('k07');

    return U.pageHead('Contratos',
      'O contrato de locação: montado a partir da reserva, enviado ao cliente e acompanhado até a ' +
      'assinatura. O texto vive num template único — esta tela não escreve cláusula nenhuma.',
      U.botao('Novo contrato', 'novo', 'out') +
      U.botao('Gerar a partir de reserva', 'gerar', 'pri')) +
      (demo
        ? '<div class="card u-mb">' +
          '<div class="card__body">' +
            '<div class="u-flex u-between u-wrap" style="gap:1rem;align-items:center">' +
              '<div>' +
                '<p class="card__title">Contrato demonstrativo</p>' +
                '<p class="card__sub">O formato do documento com dados fictícios: locatário ' +
                '"Cliente Demonstração", documentos mascarados e valores de exemplo. Serve para ' +
                'conferir o texto antes de a Lok Car definir as políticas.</p>' +
              '</div>' +
              U.botao('Ver contrato', 'ver', 'out', { id: demo.id }) +
            '</div>' +
          '</div>' +
        '</div>'
        : '') +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));
    slot.innerHTML = lista.length ? htmlTabela(lista) : htmlVazio();

    if (cont) {
      var aguardando = D.CONTRATOS.filter(function (k) { return k.status === 'aguardando'; }).length;
      var assinados = D.CONTRATOS.filter(function (k) { return k.status === 'assinado'; }).length;
      cont.textContent = lista.length + (lista.length === 1 ? ' contrato' : ' contratos') +
        ' · ' + aguardando + ' aguardando assinatura' +
        ' · ' + assinados + ' assinado(s)';
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
        U.navegar('#/contratos/' + linha.getAttribute('data-abre'));
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');
    var k = ALVO ? S.contrato(ALVO) : null;

    if (alvo.getAttribute('aria-disabled') === 'true') {
      U.canto(alvo.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'filtrar': {
        var f = alvo.getAttribute('data-f');
        U.navegar('#/contratos' + (!f || f === 'todos' ? '' : '?f=' + f));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'voltar':
        U.navegar('#/contratos');
        return;

      case 'ir-reservas':
        U.navegar('#/reservas');
        return;

      case 'ver': {
        var alvoK = id ? S.contrato(id) : k;
        if (alvoK) U.navegar('#/contratos/' + alvoK.id);
        else U.canto('Este contrato não está mais na base.', 'aviso');
        return;
      }

      case 'novo':
        abrirNovo();
        return;

      case 'gerar':
        abrirGerador();
        return;

      /* As ações da ficha chegam todas com `data-qual`, porque
         `data-acao="acao"` é genérico de propósito: um único
         caminho de leitura para sete botões. */
      case 'acao': {
        if (!k) return;
        var qual = alvo.getAttribute('data-qual');
        if (qual === 'previa') { irParaDocumento(); return; }
        if (qual === 'editar') { abrirEditar(k); return; }
        if (qual === 'enviar') { abrirEnviar(k); return; }
        if (qual === 'assinar') { abrirAssinar(k); return; }
        if (qual === 'copiar') { abrirCopiar(k); return; }
        if (qual === 'imprimir') { imprimirFicha(); return; }
        if (qual === 'cancelar') { abrirCancelar(k); return; }
        U.canto(API, 'aviso');
        return;
      }

      case 'ir': {
        var para = alvo.getAttribute('data-para') || alvo.getAttribute('href');
        if (para) U.navegar(para);
        return;
      }

      case 'ir-config': {
        /* O dado que falta leva ao campo. A tela de configurações
           recebe `?campo=` e rola até ele — é o que fecha o ciclo
           entre "não configurado" e "configurado". */
        var paraCfg = alvo.getAttribute('data-para') || '#/configuracoes';
        var campo = alvo.getAttribute('data-campo') || '';
        U.navegar(paraCfg + (campo ? '?campo=' + encodeURIComponent(campo) : ''));
        return;
      }

      default:
        U.canto(API, 'aviso');
    }
  });
};
