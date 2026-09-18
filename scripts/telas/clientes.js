/* ============================================================
   LOK CAR — SISTEMA · telas/clientes.js
   ------------------------------------------------------------
   §8 do pedido: a lista (Nome, CPF/CNPJ, Telefone, E-mail,
   Quantidade de locações, Última locação, Status) e o detalhe
   (DADOS PESSOAIS, ENDEREÇO, CNH, DOCUMENTOS, HISTÓRICO).

   QUATRO DECISÕES QUE VALEM EXPLICAÇÃO
   ------------------------------------------------------------
   1) O "STATUS" DO CLIENTE NÃO É UM CAMPO. Não existe
      `cliente.status` na base, e não deve existir. O que
      interessa na lista é "esta pessoa pode retirar um carro
      hoje?", e isso é DERIVADO do que ela tem pendente: CNH
      vencida, documento faltando, endereço incompleto, locação
      atrasada. Um campo `status` seria uma segunda verdade,
      digitada à mão, que envelhece sozinha — o operador marca
      "OK" e a CNH vence no mês seguinte sem ninguém mexer.

   2) A MESMA TELA É LISTA E DETALHE, e o endereço decide. É como
      a tela de reservas funciona, e é o que faz o botão voltar
      do navegador dar certo sem uma linha a mais.

   3) O HISTÓRICO JUNTA RESERVA E LOCAÇÃO porque são coisas
      diferentes (§9): a reserva é a intenção, a locação é o
      contrato que começou de verdade. Mostrar só uma das duas
      daria ao operador meia resposta sobre o que o cliente já
      fez com a locadora.

   4) CADASTRAR CLIENTE FUNCIONA. `S.criarCliente` grava de
      verdade na base da sessão. O documento nasce MASCARADO
      (`***.***.***-**`), nunca com o que o operador digitou:
      guardar CPF real numa base de demonstração é exatamente o
      que o §25 proíbe.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.clientes = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var ALVO = ctx && ctx.alvo ? String(ctx.alvo) : null;

  var esc = U.esc;
  var AVISO_API = 'Disponível após integração do backend.';

  /* ==========================================================
     1 · O QUE TORNA UM CLIENTE INAPTO HOJE
     ----------------------------------------------------------
     A pergunta que o balcão faz é uma só: "posso entregar o
     carro para esta pessoa?". A resposta tem origens que são
     FATOS da base — nenhuma é opinião do sistema.
     ========================================================== */
  var impedimentos = function (c) {
    if (!c) return [];

    var lista = [];
    var hoje = D.HOJE_ISO;

    /* CNH — só para pessoa física. A PJ não tem CNH: quem assina
       é o representante legal, indicado no contrato. */
    if (c.tipo === 'PF') {
      if (!c.cnh || !c.cnh.validade) {
        lista.push({ tom: 'aviso', texto: 'CNH sem validade registrada.' });
      } else if (D.diffDias(hoje, c.cnh.validade) < 0) {
        lista.push({ tom: 'grave', texto: 'CNH vencida desde ' + D.fmtData(c.cnh.validade) + '.' });
      } else if (D.diffDias(hoje, c.cnh.validade) <= 30) {
        lista.push({ tom: 'aviso', texto: 'CNH vence ' + D.quando(c.cnh.validade) + '.' });
      }

      if (c.docs && c.docs.cnh === 'pendente') {
        lista.push({ tom: 'aviso', texto: 'CNH sem conferência registrada.' });
      }
    }

    if (c.docs && c.docs.residencia === 'ausente') {
      lista.push({ tom: 'aviso', texto: 'Comprovante de residência não entregue.' });
    }

    if (c.tipo === 'PJ' && (!c.docs || c.docs.cnpj !== 'ok')) {
      lista.push({ tom: 'aviso', texto: 'Cartão CNPJ não conferido.' });
    }

    if (!c.endereco || !c.endereco.logradouro || !c.endereco.cidade) {
      lista.push({ tom: 'aviso', texto: 'Endereço incompleto — a entrega não pode ser cotada.' });
    }

    if (!c.telefone && !c.email) {
      lista.push({ tom: 'aviso', texto: 'Sem telefone e sem e-mail de contato.' });
    }

    /* A locação atrasada não é problema de cadastro: é dinheiro
       parado fora da locadora. Por isso é o único item 'grave',
       e o único que leva direto ao registro. */
    S.locacoesDoCliente(c.id).forEach(function (l) {
      if (D.statusDaLocacao(l) === 'atrasada') {
        lista.unshift({
          tom: 'grave',
          texto: 'Locação ' + l.codigo + ' atrasada há ' + D.atrasoDaLocacao(l) + ' dia(s).',
          ir: '#/locacoes/' + l.id
        });
      }
    });

    return lista;
  };

  var statusDoCliente = function (c) {
    var imp = impedimentos(c);
    if (imp.some(function (i) { return i.tom === 'grave'; })) {
      return { id: 'atencao', rotulo: 'Requer atenção', tom: 'bad' };
    }
    if (imp.length) return { id: 'pendencia', rotulo: 'Com pendência', tom: 'warn' };
    return { id: 'ok', rotulo: 'Em dia', tom: 'ok' };
  };

  /* ==========================================================
     2 · LISTA
     ========================================================== */
  var ABAS = [
    { id: 'todos',     rotulo: 'Todos', teste: null },
    { id: 'ok',        rotulo: 'Em dia', teste: function (c) { return statusDoCliente(c).id === 'ok'; } },
    { id: 'pendencia', rotulo: 'Com pendência', teste: function (c) { return statusDoCliente(c).id === 'pendencia'; } },
    { id: 'atencao',   rotulo: 'Requer atenção', teste: function (c) { return statusDoCliente(c).id === 'atencao'; } },
    { id: 'pf',        rotulo: 'Pessoa física', teste: function (c) { return c.tipo === 'PF'; } },
    { id: 'pj',        rotulo: 'Pessoa jurídica', teste: function (c) { return c.tipo === 'PJ'; } }
  ];

  var acharAba = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return null;
  };

  var filtroDe = function (f) {
    var aba = acharAba(f);
    if (aba) return { id: aba.id, rotulo: aba.rotulo, teste: aba.teste };
    return filtroDe('todos');
  };

  var BUSCA = '';
  if (params.q) BUSCA = String(params.q);

  /* Sem acento e sem caixa. "sofia" precisa achar "Sófia". */
  var normalizar = function (v) {
    var t = String(v === null || v === undefined ? '' : v).toLowerCase();
    return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
  };

  var digitos = function (v) { return String(v || '').replace(/\D/g, ''); };

  var alvosDe = function (c) {
    var t = [c.nome, c.telefone, c.email, c.doc, c.obs];
    if (c.endereco) t = t.concat([c.endereco.cidade, c.endereco.bairro, c.endereco.cep, c.endereco.logradouro]);
    if (c.representante) t = t.concat([c.representante.nome, c.representante.doc]);
    S.reservasDoCliente(c.id).forEach(function (r) { t.push(r.codigo); });
    S.locacoesDoCliente(c.id).forEach(function (l) { t.push(l.codigo); });
    return t.filter(Boolean);
  };

  /* Todos os termos digitados precisam casar. É o que faz
     "ana beira" achar a Ana Beatriz da Av. Beira Mar, e o que
     evita que digitar mais estreite o resultado — que é o
     comportamento esperado de quem está refinando a busca. */
  var combinaBusca = function (c, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;

    var texto = alvosDe(c).map(normalizar).join(' ');
    var nums = alvosDe(c).map(digitos).filter(Boolean).join(' ');

    return termos.every(function (t) {
      if (/^[\d\s().-]+$/.test(t)) {
        var d = digitos(t);
        return d ? nums.indexOf(d) !== -1 : true;
      }
      return texto.indexOf(t) !== -1;
    });
  };

  /* Data da última locação. `null` quando nunca houve — e a
     lista escreve isso, em vez de inventar uma data. */
  var ultimaDe = function (c) {
    var datas = S.locacoesDoCliente(c.id).map(function (l) { return l.inicio; })
      .concat(S.reservasDoCliente(c.id).map(function (r) { return r.de; }))
      .filter(Boolean);
    if (!datas.length) return null;
    return datas.sort()[datas.length - 1];
  };

  var ordenar = function (lista, como) {
    var l = lista.slice();
    if (como === 'nome') {
      l.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    } else if (como === 'locacoes') {
      l.sort(function (a, b) { return S.locacoesDoCliente(b.id).length - S.locacoesDoCliente(a.id).length; });
    } else if (como === 'recentes') {
      l.sort(function (a, b) {
        var ua = ultimaDe(a), ub = ultimaDe(b);
        if (!ua) return 1;
        if (!ub) return -1;
        return D.diffDias(ua, ub);
      });
    } else {
      /* Padrão: pendência primeiro. É a ordem em que o balcão
         precisa ver a lista — quem tem algo a resolver vem antes
         de quem está em dia. */
      var peso = { atencao: 0, pendencia: 1, ok: 2 };
      l.sort(function (a, b) {
        var pa = peso[statusDoCliente(a).id], pb = peso[statusDoCliente(b).id];
        if (pa !== pb) return pa - pb;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
    }
    return l;
  };

  var filtrar = function (filtro) {
    return ordenar(D.CLIENTES.filter(function (c) {
      if (filtro.teste && !filtro.teste(c)) return false;
      return combinaBusca(c, BUSCA);
    }), params.o);
  };

  var contar = function (filtro) {
    return D.CLIENTES.filter(function (c) {
      return filtro.teste ? filtro.teste(c) : true;
    }).length;
  };

  /* ==========================================================
     3 · LISTA — MONTAGEM
     ========================================================== */
  var iniciais = function (c) {
    return c.nome.trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  };

  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist">' + ABAS.map(function (a) {
      return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" data-f="' + a.id + '"' +
             (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
             esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
    }).join('') + '</div>';
  };

  var linhaTabela = function (c) {
    var st = statusDoCliente(c);
    var locs = S.locacoesDoCliente(c.id);
    var ultima = ultimaDe(c);
    var imp = impedimentos(c);

    return '<tr data-abre="' + c.id + '">' +
      '<td><div class="cli">' +
        '<span class="cli__av' + (c.tipo === 'PJ' ? ' cli__av--pj' : '') + '">' + esc(iniciais(c)) + '</span>' +
        '<span class="cli__t"><b>' + esc(c.nome) + '</b>' +
        '<span>' + (c.tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica') +
        (c.desde ? ' · cliente desde ' + D.fmtData(c.desde) : '') + '</span></span>' +
      '</div></td>' +
      '<td><span class="mono">' + esc(c.doc) + '</span></td>' +
      '<td><span class="u-tab">' + esc(c.telefone || '') + '</span>' +
        (c.email ? '<span class="tbl__dim">' + esc(c.email) + '</span>' : '') + '</td>' +
      '<td><span class="tbl__num">' + locs.length + '</span></td>' +
      '<td>' + (ultima
        ? '<span class="u-tab">' + D.fmtData(ultima) + '</span><span class="tbl__dim">' + esc(D.quando(ultima)) + '</span>'
        : '<span class="falta">nunca locou</span>') + '</td>' +
      '<td>' + U.cracha(st.rotulo, st.tom) +
        (imp.length ? '<span class="tbl__dim">' + esc(imp[0].texto) + '</span>' : '') + '</td>' +
      '<td><div class="tbl__acts">' +
        '<span class="ab" data-acao="ver" data-id="' + c.id + '">Ver</span>' +
      '</div></td>' +
    '</tr>';
  };

  var htmlTabela = function (lista) {
    return '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Cliente</th><th>CPF / CNPJ</th><th>Contato</th>' +
        '<th>Locações</th><th>Última locação</th><th>Status</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(linhaTabela).join('') + '</tbody>' +
      '</table></div>';
  };

  var htmlVazio = function () {
    return U.vazio(
      BUSCA ? 'Nenhum cliente encontrado' : 'Nenhum cliente nesta situação',
      BUSCA
        ? 'Nenhum cadastro casa com “' + BUSCA + '”. A busca olha nome, CPF/CNPJ, telefone, e-mail, cidade e código de reserva ou locação.'
        : 'Nenhum cliente está nesta situação agora.',
      BUSCA ? U.botao('Limpar busca', 'limpar', 'out') : ''
    );
  };

  var htmlLista = function (filtro, lista) {
    return '<div class="filtros">' +
      '<div class="busca">' +
        '<svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input class="busca__inp" type="search" data-busca="1" value="' + esc(BUSCA) + '" ' +
        'placeholder="Nome, CPF/CNPJ, telefone, e-mail, cidade ou código" />' +
      '</div>' +
      '<div class="filtros__dir">' +
        '<span class="filtros__n" data-slot="n">' + lista.length +
        (lista.length === 1 ? ' cliente' : ' clientes') +
        (BUSCA ? ' para “' + esc(BUSCA) + '”' : '') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="u-mb">' + htmlAbas(filtro) + '</div>' +
    '<div data-slot="lista">' + (lista.length ? htmlTabela(lista) : htmlVazio()) + '</div>';
  };

  /* ==========================================================
     4 · DETALHE (§8)
     ----------------------------------------------------------
     Cinco blocos, na ordem do pedido, com uma exceção: a
     SITUAÇÃO vem antes de tudo. Quem abre a ficha no balcão
     precisa saber primeiro se pode entregar o carro; o resto é
     consulta.
     ========================================================== */
  var ICO = {
    situacao: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
    dados:    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3 4-5 8-5s8 2 8 5',
    endereco: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 10a1.5 1.5 0 1 0 0 .01',
    cnh:      'M3 6h18v12H3zM7 12h4M7 15h6M17 11h.01M17 14h.01',
    docs:     'M8 3h6l4 4v14H8zM14 3v5h4M10.5 13l1.5 1.5L15 11',
    historico:'M4 12a8 8 0 1 0 3-6M4 4v4h4M12 8v4l3 2'
  };

  var bloco = function (id, titulo, conteudo, extraClasse, nota) {
    return '<section class="bloco' + (extraClasse ? ' ' + extraClasse : '') + '">' +
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

  var blocoSituacao = function (c) {
    var imp = impedimentos(c);
    var st = statusDoCliente(c);

    if (!imp.length) {
      return bloco('situacao', 'Situação para retirada', corpo(
        '<div class="aviso aviso--ok">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' +
        '<span>Nada pendente: cadastro, CNH, comprovante de residência e endereço estão completos. ' +
        'O cliente está apto a retirar um veículo.</span>' +
        '</div>' +
        '<p class="u-xs u-t4 u-mt">Esta situação é CALCULADA a partir do cadastro e das locações. ' +
        'Não existe um campo "status do cliente" para alguém esquecer de atualizar.</p>'
      ), '', st.rotulo);
    }

    /* `itemPendencia` é a MESMA função que o painel usa para as
       pendências. Reusar aqui é o que garante que "documento
       pendente" signifique a mesma coisa nas duas telas — e é o
       item que leva direto ao registro citado. */
    var comRota = imp.filter(function (i) { return i.ir; });
    var semRota = imp.filter(function (i) { return !i.ir; });

    var links = comRota.map(function (i) {
      return U.itemPendencia({
        tipo: 'devolucao', rota: i.ir,
        titulo: i.texto, apoio: ' Abrir a locação'
      });
    }).join('');

    /* O peso do item não se diz por cor de texto. Dizer "grave"
       com vermelho num parágrafo é o tipo de coisa que passa
       batido no balcão; o que marca é o crachá escrito. */
    var texto = semRota.map(function (i) {
      return '<li>' + (i.tom === 'grave' ? U.etiqueta('Grave', 'bad') + ' ' : '') + esc(i.texto) + '</li>';
    }).join('');

    return bloco('situacao', 'Situação para retirada', corpo(
      (texto ? '<div class="aviso aviso--neutro">' +
                 '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
                 '<path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>' +
                 '<span><b>' + imp.length + ' pendência(s) impedem a retirada agora.</b>' +
                 '<ul class="lista-check u-mt">' + texto + '</ul></span>' +
               '</div>' : '') +
      (links ? '<div class="pend' + (texto ? ' u-mt' : '') + '">' + links + '</div>' : '') +
      '<p class="u-xs u-t4 u-mt">A lista é derivada do que está registrado no cadastro e nas locações — ' +
      'não é um campo digitado à mão.</p>'
    ), '', st.rotulo);
  };

  var blocoDados = function (c) {
    var linhas = [
      ['Nome', esc(c.nome)],
      ['Tipo', c.tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'],
      ['CPF / CNPJ', '<span class="mono">' + esc(c.doc) + '</span>'],
      ['Telefone', U.ou(c.telefone, 'a cadastrar')],
      ['E-mail', U.ou(c.email, 'a cadastrar')],
      ['Cliente desde', D.fmtData(c.desde)]
    ];

    if (c.tipo === 'PJ' && c.representante) {
      linhas.push(['Representante legal', esc(c.representante.nome)]);
      linhas.push(['CPF do representante', '<span class="mono">' + esc(c.representante.doc) + '</span>']);
      linhas.push(['Cargo', U.ou(c.representante.cargo, 'a informar')]);
    }

    return bloco('dados', 'Dados pessoais', corpo(
      ficha(linhas) +
      (c.obs ? '<div class="aviso aviso--neutro u-mt-lg">' +
               '<svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true">' +
               '<path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>' +
               '<span><b>Observações.</b> ' + esc(c.obs) + '</span></div>' : '') +
      '<p class="u-xs u-t4 u-mt-lg">O documento aparece sempre mascarado. Esta base é de demonstração ' +
      'e não guarda CPF, CNPJ ou CNH de pessoa real (§25).</p>'
    ));
  };

  var enderecoLinha = function (e) {
    if (!e) return null;
    var l1 = [e.logradouro, e.numero].filter(Boolean).join(', ');
    if (e.complemento) l1 += ' · ' + e.complemento;
    var l2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join(' — ')].filter(Boolean).join(' · ');
    var t = [l1, l2, e.cep ? 'CEP ' + e.cep : ''].filter(Boolean).join(' · ');
    return t || null;
  };

  var blocoEndereco = function (c) {
    var e = c.endereco || {};
    var linha = enderecoLinha(e);

    if (!linha) {
      return bloco('endereco', 'Endereço', corpo(
        '<p><span class="falta">Endereço não cadastrado.</span></p>' +
        '<p class="u-xs u-t4 u-mt">Sem endereço, a entrega do veículo não pode ser cotada — o site trata ' +
        'o adicional de entrega como "sob consulta" justamente porque o valor depende da distância.</p>'
      ));
    }

    return bloco('endereco', 'Endereço', corpo(
      ficha([
        ['CEP', U.ou(e.cep, 'a cadastrar')],
        ['Logradouro', U.ou([e.logradouro, e.numero].filter(Boolean).join(', '), 'a cadastrar')],
        ['Complemento', U.ou(e.complemento, 'sem complemento')],
        ['Bairro', U.ou(e.bairro, 'a cadastrar')],
        ['Cidade', U.ou([e.cidade, e.uf].filter(Boolean).join(' — '), 'a cadastrar')]
      ]) +
      '<div class="u-mt-lg">' +
        U.botao('Copiar endereço', 'copiar-endereco', 'out', { id: c.id }) +
      '</div>' +
      '<p class="u-xs u-t4 u-mt">Buscar o CEP automaticamente depende de um serviço externo — ' +
      esc(AVISO_API) + '</p>'
    ));
  };

  var blocoCNH = function (c) {
    if (c.tipo === 'PJ') {
      return bloco('cnh', 'CNH', corpo(
        '<p class="u-sm u-t2">Pessoa jurídica não tem CNH no cadastro. Quem assina pela empresa é o ' +
        'representante legal' + (c.representante ? ' (' + esc(c.representante.nome) + ')' : '') +
        '; quem dirige é indicado no contrato.</p>'
      ));
    }

    var cnh = c.cnh;
    if (!cnh || !cnh.numero) {
      return bloco('cnh', 'CNH', corpo(
        '<p><span class="falta">CNH não cadastrada.</span></p>' +
        '<p class="u-xs u-t4 u-mt">Sem CNH registrada, a locação não deve ser iniciada.</p>'
      ));
    }

    var dias = cnh.validade ? D.diffDias(D.HOJE_ISO, cnh.validade) : null;
    var situacao;

    if (dias === null) situacao = '<span class="falta">validade não informada</span>';
    else if (dias < 0) situacao = U.etiqueta('Vencida', 'bad');
    else if (dias <= 30) situacao = U.etiqueta('Vence ' + D.quando(cnh.validade), 'warn');
    else situacao = U.etiqueta('Válida', 'ok');

    return bloco('cnh', 'CNH', corpo(
      ficha([
        ['Número', '<span class="mono">' + esc(cnh.numero) + '</span>'],
        ['Categoria', U.ou(cnh.categoria, 'a informar')],
        ['Validade', cnh.validade ? D.fmtData(cnh.validade) : '<span class="falta">a informar</span>'],
        ['Situação', situacao]
      ]) +
      '<p class="u-xs u-t4 u-mt">A categoria da CNH precisa cobrir o veículo da reserva. ' +
      'O sistema ainda não cruza as duas coisas — fica registrado como pendência conhecida.</p>'
    ));
  };

  var blocoDocumentos = function (c) {
    var linhas = D.DOCUMENTOS_TIPO.filter(function (d) { return d.quem === 'cliente'; })
      .map(function (tipo) {
        var estado = c.docs ? c.docs[tipo.id] : null;
        var rotulo, tom;

        if (estado === 'ok') { rotulo = 'Conferido'; tom = 'ok'; }
        else if (estado === 'pendente') { rotulo = 'Aguardando conferência'; tom = 'warn'; }
        else if (estado === 'ausente') { rotulo = 'Não entregue'; tom = 'warn'; }
        else if (c.tipo === 'PJ' && tipo.id === 'cnh') { rotulo = 'Não se aplica'; tom = 'idle'; }
        else { rotulo = 'Sem registro'; tom = 'idle'; }

        return '<tr>' +
          '<td>' + esc(tipo.nome) + (tipo.obrigatorio ? '' : '<span class="tbl__dim">opcional</span>') + '</td>' +
          '<td>' + U.cracha(rotulo, tom) + '</td>' +
          '<td><span class="tbl__dim">' + (tipo.obrigatorio ? 'obrigatório' : 'opcional') + '</span></td>' +
        '</tr>';
      }).join('');

    return bloco('docs', 'Documentos', corpo(
      '<div class="tbl__wrap"><table class="tbl">' +
      '<thead><tr><th>Documento</th><th>Estado</th><th></th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div>' +
      '<p class="u-xs u-t4 u-mt">Anexar arquivo e marcar a conferência dependem do backend — ' +
      esc(AVISO_API) + ' Hoje o estado é o que ficou registrado no cadastro.</p>'
    ), 'bloco--largo');
  };

  var blocoHistorico = function (c) {
    var movs = S.historicoDoCliente(c.id); /* já vem do mais recente para o mais antigo */

    var cont = {
      reservas: S.reservasDoCliente(c.id).length,
      locacoes: S.locacoesDoCliente(c.id).length,
      concluidas: S.locacoesDoCliente(c.id).filter(function (l) {
        return D.statusDaLocacao(l) === 'finalizada';
      }).length
    };

    /* O total sai de `D.preco()` da reserva de origem — a MESMA
       conta que o site faz. Refazer a aritmética aqui criaria uma
       segunda soma, capaz de divergir da primeira, e a divergência
       apareceria justamente no número que o cliente confere. */
    var semValor = 0;
    var total = 0;

    S.locacoesDoCliente(c.id).forEach(function (l) {
      var r = l.reserva ? S.reserva(l.reserva) : null;
      if (!r) { semValor++; return; }
      var p = D.preco(r);
      if (p.incompleto) { semValor++; return; }
      total += p.total;
    });

    if (!movs.length) {
      return bloco('historico', 'Histórico', corpo(
        '<p class="u-sm u-t2">Este cliente ainda não tem reserva nem locação registrada.</p>' +
        '<p class="u-xs u-t4 u-mt">Cadastrado em ' + D.fmtData(c.desde) + '.</p>'
      ), 'bloco--largo');
    }

    /* A linha do tempo tem TRÊS colunas: data (84px), o marcador
       (22px) e o texto. Quem costura os eventos é o fio vertical
       desenhado pelo próprio `.hist__m`, por isso o marcador vai
       sozinho na coluna do meio — pôr o título ali espremeria o
       texto nos 22px seguintes. */
    var linhas = movs.map(function (m) {
      if (m.tipo === 'reserva') {
        var r = m.item;
        return '<li class="hist__i" data-acao="ir" data-para="#/reservas/' + r.id + '">' +
          '<span class="hist__q">' + D.fmtDataCurta(r.de) + '</span>' +
          '<span class="hist__m"><span class="hist__p hist__p--reserva"></span></span>' +
          '<span class="hist__t"><b>Reserva ' + esc(r.codigo) + '</b>' +
          '<span>' + esc(U.nomeVeiculo(r.veiculoId)) + ' · ' +
          D.fmtData(r.de) + ' a ' + D.fmtData(r.ate) + '</span>' +
          '<span class="u-mt">' + U.crachaReserva(r) + '</span></span>' +
        '</li>';
      }

      var l = m.item;
      return '<li class="hist__i" data-acao="ir" data-para="#/locacoes/' + l.id + '">' +
        '<span class="hist__q">' + D.fmtDataCurta(l.inicio) + '</span>' +
        '<span class="hist__m"><span class="hist__p hist__p--locacao"></span></span>' +
        '<span class="hist__t"><b>Locação ' + esc(l.codigo) + '</b>' +
        '<span>' + esc(U.nomeVeiculo(l.veiculoId)) +
        (l.kmSaida ? ' · saiu com ' + l.kmSaida.toLocaleString('pt-BR') + ' km' : '') + '</span>' +
        '<span class="u-mt">' + U.crachaLocacao(l) + '</span></span>' +
      '</li>';
    }).join('');

    return bloco('historico', 'Histórico', corpo(
      '<div class="kpis kpis--mini u-mb">' +
        '<div class="kpi"><span class="kpi__key">Reservas</span>' +
          '<span class="kpi__val">' + cont.reservas + '</span></div>' +
        '<div class="kpi"><span class="kpi__key">Locações</span>' +
          '<span class="kpi__val">' + cont.locacoes + '</span></div>' +
        '<div class="kpi"><span class="kpi__key">Concluídas</span>' +
          '<span class="kpi__val">' + cont.concluidas + '</span></div>' +
      '</div>' +
      '<ul class="hist">' + linhas + '</ul>' +
      '<p class="u-xs u-t4 u-mt">' +
        (semValor
          ? 'O total movimentado não é somado: ' + semValor + ' locação(ões) usa(m) modelo sem tabela ' +
            'de diária, ou têm adicional sob consulta. Somar só as outras daria um número menor que a ' +
            'verdade, e número menor aqui é dinheiro que sumiu.'
          : 'Total movimentado: <b>' + D.fmtBRL(total) + '</b> — a mesma conta que o site faz na tela de ' +
            'reserva, sem arredondamento paralelo.') +
      '</p>'
    ), 'bloco--largo');
  };

  var htmlDetalhe = function (c) {
    var st = statusDoCliente(c);

    return '' +
      '<div class="reg">' +
      '  <a class="reg__voltar" href="#/clientes" data-acao="voltar">' +
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
      '    Todos os clientes' +
      '  </a>' +
      '  <div class="reg__id">' +
      '    <span class="reg__cod">' + esc(c.nome) + '</span>' +
      '    ' + U.cracha(st.rotulo, st.tom) +
      '    <span class="reg__quando">' +
      esc(c.tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica') + ' · ' +
      '<span class="mono">' + esc(c.doc) + '</span>' +
      (c.telefone ? ' · ' + esc(c.telefone) : '') +
      '    </span>' +
      '  </div>' +
      '  <div class="reg__acoes">' +
      U.botao('Nova reserva', 'nova-reserva-cliente', 'pri', { id: c.id }) +
      U.botao('Editar cadastro', 'editar-cliente', 'out', { id: c.id }) +
      '  </div>' +
      '</div>' +
      '<div class="blocos">' +
        blocoSituacao(c) +
        blocoDados(c) +
        blocoEndereco(c) +
        blocoCNH(c) +
        blocoDocumentos(c) +
        blocoHistorico(c) +
      '</div>';
  };

  /* ==========================================================
     5 · AÇÕES QUE ABREM DIÁLOGO
     ========================================================== */
  var abrirCadastro = function () {
    U.abrirModal({
      titulo: 'Novo cliente',
      sub: 'O documento é gravado mascarado. Esta base é de demonstração e não guarda CPF, CNPJ ou CNH real (§25).',
      corpo:
        '<div class="grid2">' +
          U.fldSel('Tipo', 'tipo', [
            { valor: 'PF', rotulo: 'Pessoa física' },
            { valor: 'PJ', rotulo: 'Pessoa jurídica' }
          ], 'PF') +
          U.fld('Nome completo / razão social', 'text', 'nome', '', 'Como aparece no documento', true) +
        '</div>' +
        '<div class="grid2 u-mt">' +
          U.fld('CPF / CNPJ', 'text', 'doc', '', 'Opcional — o sistema guarda mascarado') +
          U.fld('Telefone', 'tel', 'telefone', '', '(00) 00000-0000') +
        '</div>' +
        '<div class="u-mt">' + U.fld('E-mail', 'email', 'email', '', 'nome@exemplo.com') + '</div>' +
        U.fldTxt('Observações', 'obs', '', 'Preferências, condições combinadas, histórico relevante') +
        '<p class="u-xs u-t4 u-mt-lg">CNH e endereço entram na edição, depois que o cliente existir. ' +
        'Criar do zero com todos os campos é formulário longo demais para o balcão, onde o telefone ' +
        'costuma tocar no meio do cadastro.</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Cadastrar cliente', tom: 'pri', acao: 'criar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'criar') return;

        var v = U.lerCampos();
        if (!String(v.nome || '').trim()) {
          U.canto('Informe o nome do cliente.', 'aviso');
          return;
        }

        var r = S.criarCliente({
          nome: v.nome, tipo: v.tipo, telefone: v.telefone, email: v.email, obs: v.obs
        });

        fechar();
        U.canto(r.mensagem, 'ok');
        U.navegar('#/clientes/' + r.cliente.id);
      }
    });
  };

  var abrirEdicao = function (c) {
    var e = c.endereco || {};

    U.abrirModal({
      titulo: 'Editar cadastro',
      sub: c.nome + ' · ' + c.doc,
      largo: true,
      corpo:
        '<div class="grid2">' +
          U.fld('Telefone', 'tel', 'telefone', c.telefone, '(00) 00000-0000') +
          U.fld('E-mail', 'email', 'email', c.email, 'nome@exemplo.com') +
        '</div>' +
        (c.tipo === 'PF'
          ? '<div class="grid3 u-mt">' +
              U.fld('Categoria da CNH', 'text', 'cnhCategoria', c.cnh ? c.cnh.categoria : '', 'B, AB…') +
              U.fld('Validade da CNH', 'date', 'cnhValidade', c.cnh ? c.cnh.validade : '') +
            '</div>'
          : '') +
        '<p class="fld__lbl u-mt-lg">Endereço</p>' +
        '<div class="grid3">' +
          U.fld('CEP', 'text', 'cep', e.cep, '00000-000') +
          U.fld('Logradouro', 'text', 'logradouro', e.logradouro) +
          U.fld('Número', 'text', 'numero', e.numero) +
        '</div>' +
        '<div class="grid3 u-mt">' +
          U.fld('Complemento', 'text', 'complemento', e.complemento) +
          U.fld('Bairro', 'text', 'bairro', e.bairro) +
          U.fld('Cidade', 'text', 'cidade', e.cidade) +
        '</div>' +
        '<div class="grid3 u-mt">' + U.fld('UF', 'text', 'uf', e.uf, 'PE') + '</div>' +
        U.fldTxt('Observações', 'obs', c.obs, '') +
        '<p class="u-xs u-t4 u-mt-lg">CPF/CNPJ e número da CNH não são editáveis aqui: em produção eles ' +
        'vêm do documento conferido no balcão, não de digitação livre.</p>',
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Salvar alterações', tom: 'pri', acao: 'salvar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'salvar') return;

        var v = U.lerCampos();

        c.telefone = v.telefone || '';
        c.email = v.email || '';
        c.obs = v.obs || '';
        c.endereco = {
          cep: v.cep || '', logradouro: v.logradouro || '', numero: v.numero || '',
          complemento: v.complemento || '', bairro: v.bairro || '', cidade: v.cidade || '', uf: v.uf || ''
        };

        if (c.tipo === 'PF') {
          c.cnh = c.cnh || { numero: '*** *** *** **', categoria: '', validade: '' };
          if (v.cnhCategoria) c.cnh.categoria = v.cnhCategoria;
          if (v.cnhValidade) c.cnh.validade = v.cnhValidade;
        }

        S.avisar('clientes');
        fechar();
        U.canto('Cadastro de ' + c.nome + ' atualizado.', 'ok');
      }
    });
  };

  var abrirNovaReserva = function (c) {
    U.canto('Levando para as reservas com a busca já preenchida com ' + c.nome + '.', 'ok');
    U.navegar('#/reservas?q=' + encodeURIComponent(c.nome));
  };

  /* ==========================================================
     6 · MONTAGEM: DESENHAR E DEPOIS LIGAR
     ----------------------------------------------------------
     A tela monta o HTML, escreve no container e SÓ DEPOIS
     pendura o ouvinte — no container que o roteador criou para
     ESTE desenho. Pendurar no `#pgInner` faria o ouvinte
     sobreviver à tela e responder por ela no desenho seguinte.
     ========================================================== */
  var htmlTela = function () {
    if (ALVO && !S.cliente(ALVO)) {
      return U.pageHead('Cliente não encontrado',
        'O código <span class="mono">' + esc(ALVO) + '</span> não corresponde a nenhum cadastro.') +
        U.vazio('Cliente não encontrado',
          'Pode ser um link antigo, ou o cadastro foi removido da base.',
          U.botao('Ver todos os clientes', 'voltar', 'out'));
    }

    if (ALVO) return htmlDetalhe(S.cliente(ALVO));

    var filtro = filtroDe(params.f);
    var lista = filtrar(filtro);

    return U.pageHead('Clientes',
      'Quem já alugou, quem está alugando e quem tem pendência para resolver.',
      U.botao('Novo cliente', 'novo-cliente', 'pri')) +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  /* Refaz só a lista, sem tocar no campo de busca — senão o
     cursor sai do lugar a cada tecla digitada. */
  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(params.f));
    slot.innerHTML = lista.length ? htmlTabela(lista) : htmlVazio();

    if (cont) {
      cont.textContent = lista.length + (lista.length === 1 ? ' cliente' : ' clientes') +
        (BUSCA ? ' para “' + BUSCA + '”' : '');
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
      /* O item de pendência é um `<a href="#/...">`. Se o
         navegador seguir o link, o endereço muda sem passar por
         `desenhar()` e a tela fica na antiga com o hash novo —
         então a navegação é feita à mão. O `preventDefault` fica
         AQUI dentro, e não solto no topo do ouvinte: solto, ele
         mataria justamente o link que precisa funcionar. */
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (link) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar(link.getAttribute('href'));
        return;
      }

      var linha = ev.target.closest ? ev.target.closest('tr[data-abre]') : null;
      if (linha) {
        if (ev.preventDefault) ev.preventDefault();
        U.navegar('#/clientes/' + linha.getAttribute('data-abre'));
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();

    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');
    var c = id ? S.cliente(id) : (ALVO ? S.cliente(ALVO) : null);

    /* Desabilitado não executa — mas DIZ por quê. Um botão cinza
       que não responde ao clique é a definição de botão morto. */
    if (alvo.getAttribute('aria-disabled') === 'true') {
      U.canto(alvo.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'filtrar': {
        var f = alvo.getAttribute('data-f');
        U.navegar('#/clientes' + (!f || f === 'todos' ? '' : '?f=' + f));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'voltar':
        U.navegar('#/clientes');
        return;

      case 'ver':
        if (c) U.navegar('#/clientes/' + c.id);
        else U.canto('Este cliente não está mais na base.', 'aviso');
        return;

      case 'novo-cliente':
        abrirCadastro();
        return;

      case 'editar-cliente':
        if (c) abrirEdicao(c);
        return;

      case 'nova-reserva-cliente':
        if (c) abrirNovaReserva(c);
        return;

      case 'ir': {
        var para = alvo.getAttribute('data-para');
        if (para) U.navegar(para);
        return;
      }

      case 'copiar-endereco': {
        var linhaEnd = enderecoLinha(c && c.endereco);
        if (!linhaEnd) {
          U.canto('Este cliente ainda não tem endereço cadastrado.', 'aviso');
          return;
        }
        U.canto('Endereço: ' + linhaEnd, 'ok');
        return;
      }

      default:
        U.canto(AVISO_API, 'aviso');
    }
  });
};
