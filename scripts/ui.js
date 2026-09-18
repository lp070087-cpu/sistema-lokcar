/* ============================================================
   LOK CAR — SISTEMA · ui.js
   ------------------------------------------------------------
   A camada que todas as telas usam: roteador, menu, crachás,
   modal, aviso de canto e os ajudantes de montagem.

   POR QUE O MENU É MONTADO AQUI, E NÃO ESCRITO NO HTML
   ------------------------------------------------------------
   O menu é gerado a partir da MESMA lista que o roteador usa
   (`MODULOS`). Se ele fosse escrito à mão no index.html, bastaria
   alguém renomear uma rota para o menu apontar para uma tela que
   não existe mais — e o operador só descobriria clicando. Aqui o
   menu e o roteador não conseguem sair de sincronia.

   O MESMO VALE PARA OS CRACHÁS DE STATUS. Os rótulos e as cores
   saem de `dados.js`. Nenhuma tela escreve "Confirmada" nem
   escolhe cor de crachá por conta própria: ela chama `cracha()`.
   ============================================================ */

window.LOKCAR_UI = (function () {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;

  /* ==========================================================
     1 · MÓDULOS
     ----------------------------------------------------------
     Os cinco grupos são exatamente os do pedido. A ordem dentro
     de cada grupo também é a do pedido: a visão geral primeiro,
     depois a operação do dia, depois os documentos, depois os
     números e por último a configuração.

     `pode` é o que permite uma tela se declarar "ainda não
     integrada" sem que exista botão morto: o item aparece, é
     clicável, e a tela explica o que falta. Esconder o módulo
     seria pior — o operador pensaria que ele não existe.
     ========================================================== */
  var MODULOS = [
    { grupo: 'VISÃO GERAL', id: 'dashboard', rota: '#/dashboard', nome: 'Dashboard',
      desc: 'O dia da locadora em uma tela.',
      ico: 'M3 12h4l3 7 4-14 3 7h4' },

    { grupo: 'OPERAÇÃO', id: 'reservas', rota: '#/reservas', nome: 'Reservas',
      desc: 'Pedidos recebidos pelo site e pelo balcão.',
      ico: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z' },
    { grupo: 'OPERAÇÃO', id: 'locacoes', rota: '#/locacoes', nome: 'Locações',
      desc: 'Contratos que já saíram do papel.',
      ico: 'M5 17h14M6 17V9l3-2 3 2v8M16 17v-4l2-1 2 1v4' },
    { grupo: 'OPERAÇÃO', id: 'clientes', rota: '#/clientes', nome: 'Clientes',
      desc: 'Cadastro, documentos e histórico.',
      ico: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
    { grupo: 'OPERAÇÃO', id: 'frota', rota: '#/frota', nome: 'Frota',
      desc: 'Cada unidade, com ficha e situação.',
      ico: 'M4 16h16M5 16V11l2-5h10l2 5v5M7 16v2M17 16v2M7.5 11h9' },
    { grupo: 'OPERAÇÃO', id: 'calendario', rota: '#/calendario', nome: 'Calendário da Frota',
      desc: 'Quem está com qual carro, e quando.',
      ico: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M13 14h3' },
    /* Prorrogação fica na OPERAÇÃO, e não em GESTÃO, porque é
       trabalho de balcão: o cliente está com o carro agora e
       precisa de resposta agora. O pedido chega pelo Portal do
       Cliente e é aqui que alguém diz sim ou não. */
    { grupo: 'OPERAÇÃO', id: 'prorrogacoes', rota: '#/prorrogacoes', nome: 'Prorrogações',
      desc: 'Pedidos de mais dias feitos por quem já está com o carro.',
      ico: 'M4 12a8 8 0 1 0 3-6M4 4v4h4M12 8v4l3 2' },

    { grupo: 'DOCUMENTOS', id: 'contratos', rota: '#/contratos', nome: 'Contratos',
      desc: 'Gerar, enviar e acompanhar assinatura.',
      ico: 'M7 3h7l4 4v14H7zM14 3v5h4M10 13h5M10 17h5' },
    { grupo: 'DOCUMENTOS', id: 'vistorias', rota: '#/vistorias', nome: 'Vistorias',
      desc: 'Saída e devolução, área por área.',
      ico: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4' },
    { grupo: 'DOCUMENTOS', id: 'documentos', rota: '#/documentos', nome: 'Documentos',
      desc: 'O que falta e o que está vencendo.',
      ico: 'M8 3h6l4 4v14H8zM14 3v5h4M4 7v14h10' },

    { grupo: 'GESTÃO', id: 'financeiro', rota: '#/financeiro', nome: 'Financeiro',
      desc: 'A receber, recebido, atrasado e cauções.',
      ico: 'M3 7h18v11H3zM3 11h18M7 15h3' },
    { grupo: 'GESTÃO', id: 'manutencoes', rota: '#/manutencoes', nome: 'Manutenções',
      desc: 'Revisão, óleo, pneus e documentação.',
      ico: 'M14.7 6.3a4 4 0 0 1 5 5L10 21H5v-5zM14 7l3 3' },
    { grupo: 'GESTÃO', id: 'ocorrencias', rota: '#/ocorrencias', nome: 'Ocorrências',
      desc: 'O que saiu do roteiro.',
      ico: 'M10.3 4l8 14H2.3zM12 10v4M12 17v.01' },

    { grupo: 'SISTEMA', id: 'notificacoes', rota: '#/notificacoes', nome: 'Notificações',
      desc: 'Tudo o que precisa de decisão.',
      ico: 'M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0' },
    { grupo: 'SISTEMA', id: 'configuracoes', rota: '#/configuracoes', nome: 'Configurações',
      desc: 'Dados da empresa e regras do contrato.',
      ico: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z' }
  ];

  var moduloPorId = function (id) {
    for (var i = 0; i < MODULOS.length; i++) {
      if (MODULOS[i].id === id) return MODULOS[i];
    }
    return null;
  };

  var GRUPOS = ['VISÃO GERAL', 'OPERAÇÃO', 'DOCUMENTOS', 'GESTÃO', 'SISTEMA'];

  /* ==========================================================
     2 · ESTADO DA TELA ATUAL
     ----------------------------------------------------------
     `rota` é a rota do módulo (`#/reservas`).
     `foco` é o alvo dentro dela (`r04`), porque a mesma tela
     serve para a lista e para o detalhe, e porque um aviso de
     pendência precisa poder abrir direto o registro que ele cita.

     Manter os dois separados é o que faz o botão "voltar" do
     navegador funcionar de verdade: cada mudança de rota vira
     uma entrada no histórico.
     ========================================================== */
  var atual = { modulo: 'dashboard', foco: null, parametros: {} };

  /* ==========================================================
     3 · CRACHÁ
     ----------------------------------------------------------
     Um crachá é rótulo + tom. O tom vem do vocabulário de
     `dados.js`. O crachá sempre tem um ponto colorido E o texto:
     cor sozinha não informa quem não distingue verde de
     vermelho, e num sistema de locadora isso não é detalhe.
     ========================================================== */
  var cracha = function (mapa, codigo, extra) {
    var s = D.acharStatus(mapa, codigo);
    return '<span class="bdg bdg--' + s.tom + (extra ? ' ' + extra : '') + '">' +
           escapar(s.rotulo) + '</span>';
  };

  var crachaReserva = function (r) { return cracha(D.STATUS_RESERVA, r.status); };
  var crachaLocacao = function (l) { return cracha(D.STATUS_LOCACAO, D.statusDaLocacao(l)); };
  var crachaVeiculo = function (v) { return cracha(D.STATUS_FROTA, D.statusDoVeiculo(v)); };
  var crachaContrato = function (k) { return cracha(D.STATUS_CONTRATO, k.status); };
  var crachaFinanceiro = function (f) { return cracha(D.STATUS_FINANCEIRO, f.status); };
  var crachaVistoria = function (v) { return cracha(D.STATUS_VISTORIA, D.statusDaVistoria(v)); };
  var crachaManutencao = function (m) { return cracha(D.STATUS_MANUTENCAO, m.status); };
  var crachaDocumento = function (d) { return cracha(D.STATUS_DOCUMENTO, d.status); };
  var crachaOcorrencia = function (o) { return cracha(D.STATUS_OCORRENCIA, o.status); };

  /* ----------------------------------------------------------
     ETIQUETA — O CRACHÁ DE RÓTULO PRONTO
     ----------------------------------------------------------
     `cracha()` tem DUAS entradas e a primeira é um MAPA de
     status, não um rótulo: `cracha(D.STATUS_FROTA, v.status)`.

     Havia um segundo caso, muito comum, em que o texto já estava
     pronto e só faltava a cor — "Volta hoje", "Vencida", "Não
     criada". Escrito como `cracha('Vencida', 'bad')`, ele NÃO
     produz um crachá vermelho escrito "Vencida". 'Vencida' é
     procurada como CHAVE do mapa (que é a string 'bad',
     inexistente em qualquer tabela de status), a busca não acha,
     e `acharStatus` devolve o fallback `{rotulo: codigo}` — ou
     seja, o próprio código. O resultado na tela era um crachá
     cinza escrito **bad**, **ok**, **warn**.

     Eram dez pontos assim, em três telas. Nenhum erro levantado,
     nenhuma verificação vermelha: o defeito era visível só para
     quem olhasse a tela. Esta função é o caminho correto para
     esse caso, e o nome diferente é proposital — quem lê
     `etiqueta('Vencida', 'bad')` não tem como confundir com a
     leitura de uma tabela de status.
     ---------------------------------------------------------- */
  var etiqueta = function (rotulo, tom, extra) {
    return '<span class="bdg bdg--' + (tom || 'idle') + (extra ? ' ' + extra : '') + '">' +
           escapar(rotulo) + '</span>';
  };

  /* ==========================================================
     3b · AS SEIS ÁREAS DA VISTORIA (§21) E AS VAGAS DE FOTO
     ----------------------------------------------------------
     As áreas do veículo aparecem em dois lugares com a mesma
     necessidade: a vistoria que já existe (só leitura, com a
     observação de cada área) e a que está sendo feita (com os
     campos). Em vez de cada tela montar o seu, a montagem mora
     aqui — e é isso que impede a segunda cópia de divergir da
     primeira, que foi exatamente como um crachá começou a
     imprimir a palavra do tom em vez do rótulo.

     `AVISO_FOTO` é o texto de dependência de backend, e ele NÃO
     fica solto na tela: ele É o conteúdo das vagas de foto. Uma
     vaga cinza com ícone de imagem seria lida como "a foto não
     carregou" e o operador ficaria esperando ela aparecer. Aqui
     a vaga diz, no próprio title, que o anexo depende do
     armazenamento de arquivos — que o §28 manda não configurar.

     `valores` é o mapa `{ área: { observacao, fotos } }`. Quando
     ele vem, a área mostra a observação e ganha a marca de
     "tocada"; quando não vem, a área é só cabeçalho e vagas.
     ========================================================== */
  var AVISO_FOTO = 'Anexo de foto — Disponível após integração do backend.';

  var ICONE_FOTO =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>' +
    '<circle cx="12" cy="12.5" r="3.2"/></svg>';

  /* Quantas vagas por área. Três é o que o §21 desenha, e é
     suficiente para o que uma vistoria de balcão realmente
     registra: o conjunto, o detalhe da avaria e uma segunda
     tomada do mesmo ponto. */
  var VAGAS_FOTO = 3;

  var vagasFoto = function () {
    var html = '';
    for (var i = 1; i <= VAGAS_FOTO; i++) {
      html += '<span class="foto" title="' + escapar(AVISO_FOTO) + '">' +
              (i === 1 ? ICONE_FOTO : '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                                      '<path d="M12 5v14M5 12h14"/></svg>') +
              '<span class="foto__n">' + i + '/' + VAGAS_FOTO + '</span>' +
              '</span>';
    }
    return '<div class="fotos">' + html + '</div>';
  };

  /* `somenteLeitura` troca as vagas de foto por uma linha de
     texto: é o modo de uma vistoria JÁ CONCLUÍDA, onde mostrar
     vaga vazia sugeriria que ainda há algo a anexar depois de a
     vistoria estar fechada. A opção se chama "somente leitura" e
     não "ligado" porque a primeira versão usava `ligado` e as
     duas telas que a chamam a passaram invertida — um nome que
     admite as duas leituras produz as duas. */
  var areasVistoria = function (valores, opcoes) {
    var o = opcoes || {};
    var somenteLeitura = o.somenteLeitura === true;

    return '<div class="areas' + (o.classe ? ' ' + o.classe : '') + '">' +
      D.AREAS_VISTORIA.map(function (area) {
        var v = (valores && valores[area]) || null;
        var obs = v && v.observacao ? v.observacao : '';
        var tocada = Boolean(obs);

        /* A área tocada se anuncia de dois jeitos que não
           dependem de cor: a borda muda E a observação escrita
           aparece no lugar do "sem avaria". Um crachá a mais só
           repetiria o que o texto já diz. */
        return '<div class="area' + (tocada ? ' area--tocada' : '') + '">' +
          '<div class="area__h">' +
            '<b>' + escapar(area) + '</b>' +
          '</div>' +
          '<div class="area__b">' +
            (obs ? '<p class="area__obs">' + escapar(obs) + '</p>'
                 : '<p class="u-xs u-t4">' + (somenteLeitura ? 'Sem avaria registrada nesta área.'
                                                              : 'Sem avaria aparente.') + '</p>') +
            /* Numa vistoria já salva não existe mais o que anexar:
               a vistoria está fechada. Prometer upload seria a
               mesma promessa falsa de "assinatura digital". */
            (somenteLeitura
              ? '<p class="u-xs u-t4 u-mt">Foto: <b>não anexada</b> — ' +
                'armazenamento de arquivos não integrado nesta fase.</p>'
              : vagasFoto()) +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
  };

  /* ==========================================================
     4 · ESCAPE
     ----------------------------------------------------------
     Toda tela monta HTML em texto. Nome de cliente, observação
     de vistoria e descrição de ocorrência são digitados por
     gente. Sem escapar, um "&" quebraria o layout e um "<"
     abriria a porta para injetar marcação. É uma linha de
     código que evita as duas coisas.
     ========================================================== */
  var escapar = function (v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* ==========================================================
     5 · AJUDANTES DE MONTAGEM
     ========================================================== */
  var el = function (id) { return document.getElementById(id); };

  /* Valor monetário ou "a definir". A regra é a do pedido: sem
     valor, escreve-se que falta configurar — nunca R$ 0,00,
     porque zero afirmaria que o serviço é gratuito. */
  var dinheiro = function (v, quandoFalta) {
    if (v === null || v === undefined) {
      return '<span class="falta">' + escapar(quandoFalta || 'a definir') + '</span>';
    }
    return '<span class="u-tab">' + D.fmtBRL(v) + '</span>';
  };

  var data = function (s) { return D.fmtData(s); };

  /* Valor em reais para CABEÇALHO DE COLUNA ou de cartão, onde o
     "R$" está no cabeçalho e a célula mostra só o número. A
     diferença para `dinheiro` é o que acontece quando o valor não
     existe: aqui devolve string VAZIA, porque a ausência é dita
     uma vez, no cabeçalho ("Diária a partir de"), e repetir
     "a definir" em cada célula transformaria a coluna numa
     parede de avisos.

     `null` NUNCA vira "R$ 0,00". Zero é uma afirmação sobre o
     preço; falta de tabela não é preço nenhum. */
  var reais = function (v) {
    if (v === null || v === undefined || isNaN(v)) return '';
    return D.fmtBRL(v);
  };


  /* Texto que pode não existir. Escrever "—" num campo de nome
     é aceitável; escrever "—" onde deveria estar a razão social
     da empresa não é. Por isso há duas funções. */
  var ou = function (v, alternativa) {
    return (v === null || v === undefined || String(v).trim() === '')
      ? '<span class="falta">' + escapar(alternativa || '—') + '</span>'
      : escapar(v);
  };

  var nomeCliente = function (id) {
    var c = S.cliente(id);
    return c ? c.nome : 'Cliente não informado';
  };

  var nomeVeiculo = function (id) {
    var v = S.veiculo(id);
    return v ? v.modelo + ' · ' + v.placa : 'Veículo não definido';
  };

  /* ==========================================================
     6 · AVISO DE CANTO
     ----------------------------------------------------------
     Substitui o `alert()`. Um aviso que interrompe a operação
     para dizer "salvo" é atrito puro; e se a mensagem é "não foi
     possível salvar", o alerta trava a tela justamente quando o
     operador mais precisa continuar trabalhando.
     ========================================================== */
  var canto = function (mensagem, tipo) {
    var cx = el('canto');
    if (!cx) return;

    var item = document.createElement('div');
    item.className = 'canto__i canto__i--' + (tipo || 'ok');
    item.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');

    var ico = tipo === 'erro'
      ? '<path d="M12 3l9 18H3zM12 9v5M12 17.5v.01"/>'
      : (tipo === 'aviso'
          ? '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'
          : '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>');

    item.innerHTML =
      '<svg class="canto__ico" viewBox="0 0 24 24" aria-hidden="true">' + ico + '</svg>' +
      '<b>' + escapar(mensagem) + '</b>' +
      '<button class="canto__x" type="button" aria-label="Fechar aviso">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';

    var fechar = function () {
      item.classList.add('sai');
      setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 180);
    };

    /* O botão de fechar é opcional na checagem, mas obrigatório
       na marcação: se por algum motivo ele não vier no HTML
       acima, o aviso não pode derrubar a ação que o chamou. Um
       erro ao exibir "reserva confirmada" seria pior do que o
       aviso ficar sem botão. */
    var bx = item.querySelector('.canto__x');
    if (bx) bx.addEventListener('click', fechar);

    cx.appendChild(item);
    setTimeout(fechar, tipo === 'erro' ? 7000 : 4200);
  };

  /* Atalho para o caso mais comum: {ok, mensagem} devolvido
     pelas funções de `sessao.js`. */
  var resultado = function (r) {
    if (!r) return;
    canto(r.mensagem, r.ok === false ? 'erro' : 'ok');
  };

  /* ==========================================================
     7 · MODAL
     ----------------------------------------------------------
     Modal único do sistema. `abrir()` recebe o conteúdo pronto e
     os botões; `fechar()` limpa tudo. O foco é levado para
     dentro ao abrir e devolvido de onde veio ao fechar — sem
     isso, quem navega por teclado perde o lugar na tela.
     ========================================================== */
  var focoAnterior = null;

  var abrirModal = function (opcoes) {
    var mod = el('mod');
    var cx = el('modCx');
    var t = el('modT');
    var sub = el('modSub');
    var bd = el('modBd');
    var ft = el('modFt');

    if (!mod) return;

    focoAnterior = document.activeElement;

    t.textContent = opcoes.titulo || '';
    if (opcoes.sub) {
      sub.textContent = opcoes.sub;
      sub.hidden = false;
    } else {
      sub.textContent = '';
      sub.hidden = true;
    }

    bd.innerHTML = opcoes.corpo || '';
    bd.className = 'mod__bd' + (opcoes.semEspaco ? ' mod__bd--flush' : '');

    cx.className = 'mod__cx' +
      (opcoes.largo ? ' mod--largo' : '') +
      (opcoes.folha ? ' mod--folha' : '');

    /* Os botões do rodapé são declarados como dados, e não como
       HTML, justamente para que `data-acao` seja a única ponte
       entre o clique e a função. Sem isso, cada modal precisaria
       amarrar seus próprios listeners. */
    if (opcoes.botoes && opcoes.botoes.length) {
      ft.hidden = false;
      ft.className = 'mod__ft' + (opcoes.espalha ? ' mod__ft--espalha' : '');
      ft.innerHTML = opcoes.botoes.map(function (b) {
        return '<button class="bt bt--' + (b.tom || 'out') + '" type="button" ' +
               'data-acao="' + escapar(b.acao || 'x') + '"' +
               (b.desabilitado ? ' aria-disabled="true"' : '') + '>' +
               escapar(b.rotulo) + '</button>';
      }).join('');

      /* O rodapé pode ter sido preenchido por uma tela que
         preferiu montar os botões à mão em vez de declarar. Nesse
         caso `opcoes.aoRodape` roda depois. */
      Array.prototype.forEach.call(ft.querySelectorAll('[data-acao]'), function (bt) {
        bt.addEventListener('click', function () {
          if (bt.getAttribute('aria-disabled') === 'true') {
            canto(bt.getAttribute('data-motivo') || 'Esta ação não está disponível agora.', 'aviso');
            return;
          }
          if (opcoes.aoClicar) opcoes.aoClicar(bt.getAttribute('data-acao'), bt, fecharModal);
        });
      });
    } else {
      ft.hidden = true;
      ft.innerHTML = '';
    }

    if (opcoes.aoAbrir) opcoes.aoAbrir(bd, fecharModal);

    mod.setAttribute('data-aberto', 'true');
    document.body.classList.add('sis-locked');

    /* Foco no primeiro controle de verdade. Se o modal só tem
       texto, o foco vai para a caixa, para o Esc funcionar.

       `focus` só existe em elemento que pode receber foco. Uma
       <div> não pode, e o código antigo mirava justamente nela
       quando não achava controle — o que levantava exceção a cada
       abertura de modal informativo. */
    var alvo = cx.querySelector('.fld__inp, .fld__sel, .fld__txt, .bt:not([aria-disabled="true"])') || cx;
    setTimeout(function () {
      if (alvo && typeof alvo.focus === 'function') {
        try { alvo.focus(); } catch (e) { /* elemento sem foco: Esc continua funcionando no documento */ }
      }
    }, 40);
  };

  var fecharModal = function () {
    var mod = el('mod');
    if (!mod) return;
    mod.setAttribute('data-aberto', 'false');
    document.body.classList.remove('sis-locked');
    if (focoAnterior && focoAnterior.focus) {
      try { focoAnterior.focus(); } catch (e) { /* elemento saiu da tela */ }
    }
  };

  var modalAberto = function () {
    var mod = el('mod');
    return mod && mod.getAttribute('data-aberto') === 'true';
  };

  /* Confirmação. Existe como função própria porque toda ação
     destrutiva do sistema (cancelar reserva, cancelar contrato)
     precisa do mesmo formato de pergunta. */
  var confirmar = function (titulo, mensagem, rotuloOk, aoConfirmar) {
    abrirModal({
      titulo: titulo,
      sub: mensagem,
      corpo: '',
      botoes: [
        { rotulo: 'Voltar', tom: 'sil', acao: 'nao' },
        { rotulo: rotuloOk, tom: 'pri', acao: 'sim' }
      ],
      aoClicar: function (acao, bt) {
        if (acao === 'sim') {
          fecharModal();
          aoConfirmar();
        } else {
          fecharModal();
        }
      }
    });
  };

  /* ==========================================================
     8 · MENU
     ========================================================== */
  var montarMenu = function () {
    var nav = el('railNav');
    if (!nav) return;

    var html = '';
    GRUPOS.forEach(function (grupo) {
      var itens = MODULOS.filter(function (m) { return m.grupo === grupo; });
      if (!itens.length) return;

      html += '<div class="rail__group">' +
              '<p class="rail__groupT"><span>' + escapar(grupo) + '</span></p>';

      itens.forEach(function (m) {
        html += '<a class="rail__link" href="' + m.rota + '" data-modulo="' + m.id + '" title="' + escapar(m.nome) + '">' +
                '<svg class="rail__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + m.ico + '"/></svg>' +
                '<span class="rail__txt">' + escapar(m.nome) + '</span>' +
                (m.tag ? '<span class="rail__tag">' + escapar(m.tag) + '</span>' : '') +
                '</a>';
      });

      html += '</div>';
    });

    nav.innerHTML = html;

    /* O menu usa links de verdade (href="#/rota"), então o
       histórico do navegador funciona sem nenhum código extra.
       Só o estado visual precisa ser sincronizado. */
    nav.addEventListener('click', function (ev) {
      if (window.innerWidth <= 1024) fecharGaveta();
      var a = ev.target.closest ? ev.target.closest('.rail__link') : null;
      if (a) ev.preventDefault(), navegar(a.getAttribute('href'));
    });
  };

  var marcarMenu = function (id) {
    var links = document.querySelectorAll('.rail__link');
    Array.prototype.forEach.call(links, function (a) {
      var m = a.getAttribute('data-modulo');
      if (m === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };

  /* Etiqueta numérica no menu: quantas pendências aquele módulo
     tem agora. É o que faz o menu informar em vez de só listar.
     Recalculada a cada mudança de estado. */
  var marcarEtiquetas = function () {
    var pend = D.pendencias();

    var contagem = {};
    pend.forEach(function (p) {
      var dono = {
        'contrato': 'contratos',
        'documento': 'documentos',
        'pagamento': 'financeiro',
        'vistoria': 'vistorias',
        'devolucao': 'locacoes',
        'reserva': 'reservas',
        'conflito': 'calendario',
        'frota': 'frota',
        'manutencao': 'manutencoes'
      }[p.tipo];
      if (!dono) return;
      contagem[dono] = (contagem[dono] || 0) + 1;
    });

    Array.prototype.forEach.call(document.querySelectorAll('.rail__link'), function (a) {
      var id = a.getAttribute('data-modulo');
      var antigo = a.querySelector('.rail__tag');
      if (antigo) antigo.parentNode.removeChild(antigo);

      var n = contagem[id] || 0;
      /* Notificações mostra o número total: é o resumo de tudo. */
      if (id === 'notificacoes') n = pend.length;

      if (n > 0) {
        var tag = document.createElement('span');
        tag.className = 'rail__tag';
        tag.textContent = n;
        a.appendChild(tag);
      }
    });

    /* O sino do topo repete o total. Um só lugar mostraria o
       número e o operador aprenderia a não olhar para o outro. */
    var sinoN = el('topSinoN');
    var sino = el('topSino');
    if (sinoN) {
      sinoN.textContent = pend.length;
      sinoN.hidden = pend.length === 0;
    }
    if (sino) {
      sino.setAttribute('aria-label', pend.length
        ? pend.length + (pend.length === 1 ? ' pendência' : ' pendências')
        : 'Sem pendências');
    }
  };

  /* ==========================================================
     9 · GAVETA (celular) E TRILHO RECOLHIDO
     ========================================================== */
  var abrirGaveta = function () {
    var sis = el('sis');
    if (!sis) return;
    sis.setAttribute('data-gaveta', 'aberta');
    var veu = el('veu');
    if (veu) { veu.hidden = false; veu.setAttribute('data-aberto', 'true'); }
    var b = el('topBurger');
    if (b) b.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sis-locked');
  };

  var fecharGaveta = function () {
    var sis = el('sis');
    if (!sis) return;
    sis.setAttribute('data-gaveta', 'fechada');
    var veu = el('veu');
    if (veu) { veu.setAttribute('data-aberto', 'false'); veu.hidden = true; }
    var b = el('topBurger');
    if (b) b.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sis-locked');
  };

  var alternarTrilho = function () {
    var sis = el('sis');
    if (!sis) return;
    var fechado = sis.getAttribute('data-rail') === 'fechado';
    var novo = fechado ? 'aberto' : 'fechado';
    sis.setAttribute('data-rail', novo);
    S.salvarPref('rail', novo);
    var b = el('topRecolher');
    if (b) {
      b.setAttribute('aria-expanded', fechado ? 'true' : 'false');
      b.setAttribute('aria-label', fechado ? 'Recolher o menu' : 'Expandir o menu');
    }
  };

  /* ==========================================================
     10 · ROTEADOR
     ----------------------------------------------------------
     A rota tem o formato `#/modulo/alvo`. O que muda entre a
     lista e o detalhe de uma mesma tela é o `alvo`; o módulo é
     o mesmo. Isso mantém uma rota só por módulo, o que é o que
     faz o menu continuar marcando o item certo no detalhe.

     Módulo inexistente NÃO cai em branco: mostra a lista de
     módulos disponíveis. Tela branca é o pior resultado possível
     de um endereço digitado errado.
     ========================================================== */
  var lerRota = function () {
    var bruto = (window.location.hash || '').replace(/^#\/?/, '');
    if (!bruto) return { modulo: 'dashboard', alvo: null, params: {} };

    /* A consulta sai do caminho ANTES de partir a rota em
       módulo/alvo.

       Sem isso, `#/financeiro?mes=2026-09` vira o módulo
       "financeiro?mes=2026-09" — que não existe — e o sistema
       responde "módulo não encontrado" para uma rota que está
       certa. E `#/reservas/r04?aba=documentos` deixa o alvo como
       "r04?aba=documentos", que não acha registro nenhum e abre
       a lista em vez do detalhe.

       Isso importa agora porque as telas de lista guardam filtro
       e busca no endereço: o filtro precisa sobreviver ao
       recarregamento e ao botão voltar. */
    var corte = bruto.split('?');
    var caminho = corte[0];
    var consulta = corte[1] || '';

    var pedacos = caminho.split('/').filter(Boolean);
    var modulo = pedacos[0] || 'dashboard';
    var alvo = pedacos[1] || null;

    try {
      modulo = decodeURIComponent(modulo);
      if (alvo) alvo = decodeURIComponent(alvo);
    } catch (e) { /* endereço com % solto: fica como veio */ }

    var params = {};
    if (consulta) {
      consulta.split('&').forEach(function (par) {
        if (!par) return;
        var kv = par.split('=');
        if (!kv[0]) return;
        try {
          params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
        } catch (e) {
          params[kv[0]] = kv[1] || '';
        }
      });
    }

    return { modulo: modulo, alvo: alvo, params: params };
  };

  var navegar = function (rota) {
    var destino = rota.charAt(0) === '#' ? rota : '#/' + rota;
    if (window.location.hash === destino) {
      /* Mesma rota: o navegador não dispara `hashchange`, então
         quem clicou precisa ver a tela desenhar mesmo assim. */
      desenhar();
      return;
    }
    window.location.hash = destino;
  };

  var desenhar = function () {
    var r = lerRota();
    var mod = moduloPorId(r.modulo);

    /* UM DIÁLOGO PERTENCE À TELA QUE O ABRIU.
       Trocar de rota não pode deixá-lo em cima da tela seguinte:
       o botão "Registrar" do formulário continuaria agindo sobre o
       registro antigo, com os campos do antigo, enquanto a tela
       atrás já é outra. Acontece de verdade pelo botão VOLTAR do
       navegador — a gaveta lateral e o véu do modal ficam atrás
       dele, mas o histórico não. Fechar aqui é o único lugar que
       cobre todos os caminhos: link da barra, menu, e voltar. */
    if (modalAberto()) fecharModal();

    /* ----------------------------------------------------------
       O CONTAINER DA TELA É NOVO A CADA DESENHO. Não é detalhe
       de estilo — é o que impede o defeito mais silencioso do
       sistema.

       Cada tela pendura o seu ouvinte de clique no container que
       recebe. Se esse container fosse sempre o mesmo `#pgInner`,
       o ouvinte de cada tela ficaria pendurado nele para sempre:
       depois de visitar o painel e as reservas, um clique numa
       ação de reserva seria atendido DUAS vezes — uma pela tela
       certa e outra pelo `data-acao` herdado do painel. O
       resultado é o pior tipo de bug: o botão parece funcionar,
       mas executa a coisa errada.

       Trocando o container a cada desenho, o ouvinte da tela
       anterior vai embora junto com o elemento onde ele morava.
       Por isso o `#pgInner` da casca é mantido só como moldura:
       ele nunca recebe ouvinte nenhum.
       ---------------------------------------------------------- */
    var moldura = el('pgInner');

    var novoInner = function (html) {
      var caixa = document.createElement('div');
      caixa.className = 'pg__tela';
      if (html) caixa.innerHTML = html;
      moldura.innerHTML = '';
      moldura.appendChild(caixa);
      return caixa;
    };

    if (!mod) {
      atual = { modulo: null, foco: null, parametros: {} };
      marcarMenu(null);
      el('topTrilha').innerHTML = '<b>Não encontrado</b><span aria-hidden="true">/</span><i id="topTela">Módulo inexistente</i>';
      novoInner(naoEncontrado(r.modulo));
      document.title = 'Módulo não encontrado | LOK CAR';
      return;
    }

    atual = { modulo: r.modulo, foco: r.alvo, parametros: r.params };

    marcarMenu(r.modulo);
    el('topTrilha').innerHTML =
      '<b>' + escapar(mod.grupo.charAt(0) + mod.grupo.slice(1).toLowerCase()) + '</b>' +
      '<span aria-hidden="true">/</span><i id="topTela">' + escapar(mod.nome) + '</i>';

    document.title = mod.nome + ' | LOK CAR · Gestão da locadora';

    /* O módulo registra sua função de desenho em
       `LOKCAR_TELAS`. Se ele não existir (arquivo faltando), a
       tela avisa — de novo, nunca em branco. */
    var tela = window.LOKCAR_TELAS && window.LOKCAR_TELAS[r.modulo];

    var inner = novoInner();
    if (typeof tela === 'function') {
      tela(inner, { alvo: r.alvo, params: r.params, atual: atual });
    } else {
      inner.innerHTML = emBreve(mod);
    }

    /* Rola para o topo ao trocar de módulo, mas NÃO quando a
       navegação é para abrir um registro dentro do mesmo módulo
       (é o caso do detalhe da reserva). Rolar nesse momento
       tiraria o detalhe da vista de quem acabou de clicar. */
    if (window.__lokcarModuloAnterior !== r.modulo) {
      window.scrollTo(0, 0);
      var pg = el('pg');
      if (pg) pg.focus({ preventScroll: true });
    }
    window.__lokcarModuloAnterior = r.modulo;

    fecharGaveta();
    marcarEtiquetas();
  };

  var naoEncontrado = function (qual) {
    var html = '' +
      '<div class="pghd">' +
      '  <div>' +
      '    <h1 class="pghd__title">Módulo não encontrado</h1>' +
      '    <p class="pghd__sub">Endereço <code class="mono">#/' + escapar(qual) +
      '</code> não corresponde a nenhuma tela do sistema. Use o menu ao lado ou um dos módulos abaixo.</p>' +
      '  </div>' +
      '</div>' +
      '<div class="atalhos">';

    MODULOS.forEach(function (m) {
      html += '<a class="atalho" href="' + m.rota + '">' +
              '<svg class="atalho__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + m.ico + '"/></svg>' +
              '<b>' + escapar(m.nome) + '</b>' +
              '<span>' + escapar(m.desc) + '</span>' +
              '</a>';
    });

    html += '</div>';
    return html;
  };

  var emBreve = function (mod) {
    return '' +
      '<div class="pghd">' +
      '  <div>' +
      '    <h1 class="pghd__title">' + escapar(mod.nome) + '</h1>' +
      '    <p class="pghd__sub">' + escapar(mod.desc) + '</p>' +
      '  </div>' +
      '</div>' +
      '<div class="aviso">' +
      '  <svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
      '  <span>A tela deste módulo não foi carregada. Recarregue a página; se o aviso continuar, o arquivo do módulo não foi encontrado.</span>' +
      '</div>';
  };

  /* ==========================================================
     11 · TÍTULOS DE TELA E FILTROS REUTILIZÁVEIS
     ========================================================== */
  var pageHead = function (titulo, sub, acoes) {
    return '' +
      '<div class="pghd">' +
      '  <div>' +
      '    <h1 class="pghd__title">' + escapar(titulo) + '</h1>' +
      (sub ? '<p class="pghd__sub">' + sub + '</p>' : '') +
      '  </div>' +
      (acoes ? '<div class="pghd__acts">' + acoes + '</div>' : '') +
      '</div>';
  };

  /* `motivo` é o que o botão bloqueado DIZ ao ser clicado. Sem
     ele, um botão cinza é a definição de botão morto: o operador
     clica, nada acontece, e ele não sabe se errou o alvo ou se a
     ação não existe. Vai no `title` E é lido no clique, porque o
     `title` sozinho só aparece com o ponteiro parado em cima. */
  var botao = function (rotulo, acao, tom, dados, desabilitado, motivo) {
    var attrs = '';
    if (dados) {
      Object.keys(dados).forEach(function (k) {
        attrs += ' data-' + k + '="' + escapar(dados[k]) + '"';
      });
    }
    return '<button class="bt bt--' + (tom || 'out') + '" type="button" data-acao="' + escapar(acao) + '"' +
           attrs + (desabilitado ? ' aria-disabled="true"' : '') +
           (desabilitado && motivo ? ' title="' + escapar(motivo) + '"' : '') +
           '>' + escapar(rotulo) + '</button>';
  };

  /* ==========================================================
     12 · FILTRO VAZIO
     ----------------------------------------------------------
     Toda lista do sistema usa o mesmo vazio. Nada de tabela com
     cabeçalho e nenhuma linha: isso parece erro de carregamento.
     ========================================================== */
  var vazio = function (titulo, descricao, acaoHtml) {
    return '<div class="vazio">' +
           '<svg class="vazio__ico" viewBox="0 0 24 24" aria-hidden="true">' +
           '<path d="M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6"/></svg>' +
           '<p class="vazio__t">' + escapar(titulo) + '</p>' +
           '<p class="vazio__d">' + escapar(descricao) + '</p>' +
           (acaoHtml || '') +
           '</div>';
  };

  /* ==========================================================
     12·B · CAMPOS DE FORMULÁRIO E LEITURA DO QUE FOI DIGITADO
     ----------------------------------------------------------
     Estes quatro moravam dentro da tela de reservas. Enquanto só
     havia uma tela, tudo bem. Com clientes, locações, frota e
     contratos chegando, cada uma copiaria os quatro — e a quinta
     cópia já teria uma diferença. Um campo que existe em cinco
     versões é um campo que se comporta de cinco jeitos.

     O sistema não usa `<form>`. Um formulário de verdade aqui só
     traria o comportamento de recarregar a página, que é o
     oposto do que se quer numa tela única. Os valores são lidos
     pelos `data-campo`, e é `lerCampos` que faz essa ponte.
     ========================================================== */
  var fld = function (rot, tipo, campo, valor, dica, obrigatorio) {
    return '<label class="fld">' +
           '<span class="fld__lbl">' + escapar(rot) + (obrigatorio ? ' *' : '') + '</span>' +
           '<input class="fld__inp" type="' + tipo + '" data-campo="' + escapar(campo) + '"' +
           (valor ? ' value="' + escapar(valor) + '"' : '') +
           (dica ? ' placeholder="' + escapar(dica) + '"' : '') + ' />' +
           '</label>';
  };

  var fldSel = function (rot, campo, opcoes, valor) {
    return '<label class="fld">' +
           '<span class="fld__lbl">' + escapar(rot) + '</span>' +
           '<select class="fld__sel" data-campo="' + escapar(campo) + '">' +
           opcoes.map(function (o) {
             return '<option value="' + escapar(o.valor) + '"' +
                    (String(o.valor) === String(valor === null || valor === undefined ? '' : valor) ? ' selected' : '') + '>' +
                    escapar(o.rotulo) + '</option>';
           }).join('') +
           '</select></label>';
  };

  var fldTxt = function (rot, campo, valor, dica, classe) {
    return '<label class="fld' + (classe ? ' ' + classe : ' u-mt') + '">' +
           '<span class="fld__lbl">' + escapar(rot) + '</span>' +
           '<textarea class="fld__txt" data-campo="' + escapar(campo) + '"' +
           (dica ? ' placeholder="' + escapar(dica) + '"' : '') + '>' +
           escapar(valor || '') + '</textarea></label>';
  };

  /* Lê o que o operador digitou, procurando dentro de um elemento
     (por padrão, o corpo do modal). A ordem das tentativas
     importa: primeiro a propriedade `value`, que o navegador
     mantém viva enquanto se digita; depois o atributo, que é o
     que sobra quando o campo já veio preenchido do HTML.

     A leitura aceita uma raiz diferente do modal porque uma tela
     pode montar um formulário no próprio corpo, fora do diálogo. */
  var lerCampos = function (raiz) {
    var caixa = raiz || el('modBd');
    var saida = {};
    if (!caixa) return saida;

    Array.prototype.forEach.call(caixa.querySelectorAll('input, select, textarea'), function (c) {
      var nome = c.getAttribute('data-campo');
      if (!nome) return;

      var v = c.value;

      if (v === '' || v === undefined || v === null) {
        if (c.tagName === 'SELECT') {
          var marcada = c.querySelector('option[selected]');
          if (marcada) v = marcada.getAttribute('value');
        } else if (c.tagName === 'TEXTAREA') {
          v = c.textContent || '';
        } else {
          v = c.getAttribute('value') || '';
        }
      }

      saida[nome] = (c.getAttribute('type') === 'checkbox') ? Boolean(c.checked) : String(v);
    });

    return saida;
  };

  /* Marca um grupo de botões de escolha. Usado onde o operador
     escolhe UMA entre poucas opções curtas (porte do veículo,
     tipo de pessoa) e um `<select>` seria exagero. */
  var opcoes = function (campo, lista, valor) {
    return '<div class="opcoes" data-campo="' + escapar(campo) + '">' + lista.map(function (o) {
      var ativo = String(o.valor) === String(valor === null || valor === undefined ? '' : valor);
      return '<button class="opcoes__b" type="button" data-opcao="' + escapar(o.valor) + '"' +
             (ativo ? ' aria-pressed="true"' : '') + '>' +
             escapar(o.rotulo) + '</button>';
    }).join('') + '</div>';
  };

  /* ==========================================================
     13 · PENDÊNCIA COMO ITEM DE LISTA
     ========================================================== */
  var itemPendencia = function (p) {
    var ico = {
      'contrato': 'M7 3h7l4 4v14H7zM14 3v5h4',
      'documento': 'M8 3h6l4 4v14H8zM14 3v5h4',
      'pagamento': 'M3 7h18v11H3zM3 11h18',
      'vistoria': 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
      'devolucao': 'M4 12a8 8 0 1 0 3-6M4 4v4h4',
      'reserva': 'M8 3v3M16 3v3M4 8h16M5 5h14v15H5z',
      'conflito': 'M10.3 4l8 14H2.3zM12 10v4M12 17v.01',
      'frota': 'M4 16h16M5 16V11l2-5h10l2 5v5',
      'manutencao': 'M14.7 6.3a4 4 0 0 1 5 5L10 21H5v-5z'
    }[p.tipo] || 'M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z';

    return '<a class="pend__i" href="' + escapar(p.rota) + '">' +
           '<svg class="pend__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ico + '"/></svg>' +
           '<span class="pend__t"><b>' + escapar(p.titulo) + '</b>' + escapar(p.apoio) + '</span>' +
           '<span class="pend__seta" aria-hidden="true">' +
           '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>' +
           '</a>';
  };

  /* ==========================================================
     14 · LARGADA
     ========================================================== */
  var iniciar = function () {
    var sis = el('sis');
    if (sis) sis.setAttribute('data-rail', (S.prefs().rail === 'fechado') ? 'fechado' : 'aberto');

    montarMenu();
    marcarEtiquetas();

    /* Navegação por hash: uma única escuta, e o roteador faz o
       resto. O `hashchange` também cobre o botão voltar. */
    window.addEventListener('hashchange', desenhar);

    var burger = el('topBurger');
    if (burger) burger.addEventListener('click', abrirGaveta);

    var veu = el('veu');
    if (veu) veu.addEventListener('click', fecharGaveta);

    var recolher = el('topRecolher');
    if (recolher) recolher.addEventListener('click', alternarTrilho);

    var fechar = el('modFechar');
    if (fechar) fechar.addEventListener('click', fecharModal);

    var modVeu = document.querySelector('[data-fecha-mod]');
    if (modVeu) modVeu.addEventListener('click', fecharModal);

    /* Esc fecha o modal e, se não houver modal, fecha a gaveta.
       Sem isto, quem usa teclado fica preso na gaveta do celular. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (modalAberto()) fecharModal();
      else if (sis && sis.getAttribute('data-gaveta') === 'aberta') fecharGaveta();
    });

    /* O sino do topo não abre um painel solto: ele leva para a
       tela de notificações, que é a mesma lista de pendências
       com o contexto completo. */
    var sino = el('topSino');
    if (sino) {
      sino.addEventListener('click', function () {
        if (sino.getAttribute('aria-haspopup') === 'dialog') {
          abrirModal({
            titulo: 'Notificações',
            sub: 'Tudo o que precisa de decisão agora. A lista completa fica em Notificações.',
            corpo: listaNotificacoes(),
            botoes: [
              { rotulo: 'Ver todas', tom: 'pri', acao: 'ir' },
              { rotulo: 'Fechar', tom: 'sil', acao: 'x' }
            ],
            aoClicar: function (acao) {
              fecharModal();
              if (acao === 'ir') navegar('#/notificacoes');
            }
          });
        }
      });
    }

    var railUser = el('railUser');
    if (railUser) railUser.addEventListener('click', perfil);

    var railSair = el('railSair');
    if (railSair) railSair.addEventListener('click', function (ev) {
      ev.stopPropagation();
      sair();
    });

    /* Preenche o rodapé do trilho com o operador. Sem login nesta
       fase, e a tela diz exatamente isso. */
    var u = D.USUARIO;
    var n = el('railNome'); if (n) n.textContent = u.nome;
    var c = el('railCargo'); if (c) c.textContent = u.cargo;
    var av = el('railAvatar'); if (av) av.textContent = u.iniciais;

    /* Quando o estado muda, os números do menu e do sino mudam.
       Redesenhar a tela inteira seria exagero; a etiqueta é
       barata de recalcular e é ela que carrega a informação. */
    S.aoMudar(function () {
      marcarEtiquetas();
    });

    if (!window.location.hash) window.location.hash = '#/dashboard';
    desenhar();
  };

  var listaNotificacoes = function () {
    var pend = D.pendencias();
    if (!pend.length) {
      return vazio('Nada pendente', 'Nenhuma decisão aguardando você neste momento.');
    }
    return '<div class="pend">' + pend.slice(0, 6).map(itemPendencia).join('') + '</div>' +
           (pend.length > 6
             ? '<p class="u-xs u-t3 u-mt">Mais ' + (pend.length - 6) + ' itens na tela de Notificações.</p>'
             : '');
  };

  /* ==========================================================
     15 · PERFIL E SAÍDA
     ----------------------------------------------------------
     Não existe autenticação nesta fase. Em vez de desenhar uma
     tela de login falsa, o sistema diz o que é: sessão local,
     sem login. Quando o backend entrar, é aqui que ele pluga.
     ========================================================== */
  var perfil = function () {
    var u = D.USUARIO;
    var e = S.empresa();

    abrirModal({
      titulo: 'Sessão',
      sub: 'Não existe login nesta fase. É um operador só, na máquina local.',
      corpo:
        '<div class="perfil">' +
        '  <span class="perfil__avatar" aria-hidden="true">' + escapar(u.iniciais) + '</span>' +
        '  <div>' +
        '    <p class="perfil__nome">' + escapar(u.nome) + '</p>' +
        '    <p class="perfil__cargo">' + escapar(u.cargo) + '</p>' +
        '  </div>' +
        '</div>' +
        '<dl class="ficha">' +
        '  <div><dt>Perfil</dt><dd>' + escapar(u.perfil) + '</dd></div>' +
        '  <div><dt>Locadora</dt><dd>' + ou(e.nomeFantasia, 'Dado a configurar') + '</dd></div>' +
        '  <div><dt>Cidade</dt><dd>' + ou(e.cidade, 'Dado a configurar') + '</dd></div>' +
        '  <div><dt>Armazenamento local</dt><dd>' +
        (S.disponivelArmazenamento
          ? 'Disponível — as configurações ficam salvas neste navegador.'
          : 'Indisponível — as configurações valem só nesta sessão.') +
        '</dd></div>' +
        '</dl>' +
        '<div class="aviso aviso--neutro">' +
        '  <svg class="aviso__ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' +
        '  <span>Login, perfis de acesso e trilha de auditoria ficam para quando o backend existir. ' +
        'O sistema não finge uma sessão que não tem.</span>' +
        '</div>',
      botoes: [
        { rotulo: 'Restaurar demonstração', tom: 'out', acao: 'restaurar' },
        { rotulo: 'Fechar', tom: 'sil', acao: 'x' }
      ],
      aoClicar: function (acao) {
        if (acao === 'restaurar') {
          fecharModal();
          confirmar(
            'Restaurar a demonstração',
            'Todas as alterações feitas nesta sessão — reservas confirmadas, contratos gerados, pagamentos registrados — voltam ao estado inicial. As configurações da empresa e das regras NÃO são apagadas.',
            'Restaurar',
            function () {
              resultado(S.restaurar());
              desenhar();
            }
          );
          return;
        }
        fecharModal();
      }
    });
  };

  var sair = function () {
    abrirModal({
      titulo: 'Sair do sistema',
      sub: 'Esta é uma demonstração. Sair não encerra sessão nenhuma — não há login.',
      corpo:
        '<p class="u-t2 u-sm">O sistema volta para o site público da locadora, que continua exatamente como está aprovado. ' +
        'Nada do que foi feito aqui é perdido a não ser que você recarregue esta aba, porque a operação vive em memória.</p>',
      botoes: [
        { rotulo: 'Voltar', tom: 'sil', acao: 'x' },
        { rotulo: 'Ir para o site', tom: 'pri', acao: 'site' }
      ],
      aoClicar: function (acao) {
        if (acao === 'site') window.location.href = '../index.html';
        else fecharModal();
      }
    });
  };

  return {
    MODULOS: MODULOS,
    GRUPOS: GRUPOS,
    moduloPorId: moduloPorId,

    iniciar: iniciar,
    desenhar: desenhar,
    navegar: navegar,
    atual: function () { return atual; },

    cracha: cracha,
    crachaReserva: crachaReserva,
    crachaLocacao: crachaLocacao,
    crachaVeiculo: crachaVeiculo,
    crachaContrato: crachaContrato,
    crachaFinanceiro: crachaFinanceiro,
    crachaVistoria: crachaVistoria,
    crachaManutencao: crachaManutencao,
    crachaDocumento: crachaDocumento,
    crachaOcorrencia: crachaOcorrencia,
    etiqueta: etiqueta,
    areasVistoria: areasVistoria,
    AVISO_FOTO: AVISO_FOTO,

    el: el,
    esc: escapar,
    dinheiro: dinheiro,
    reais: reais,
    data: data,
    ou: ou,
    nomeCliente: nomeCliente,
    nomeVeiculo: nomeVeiculo,

    canto: canto,
    resultado: resultado,
    confirmar: confirmar,

    abrirModal: abrirModal,
    fecharModal: fecharModal,
    modalAberto: modalAberto,

    pageHead: pageHead,
    botao: botao,
    vazio: vazio,
    itemPendencia: itemPendencia,

    /* campos de formulário — a partir da §12·B */
    fld: fld,
    fldSel: fldSel,
    fldTxt: fldTxt,
    lerCampos: lerCampos,
    opcoes: opcoes,

    marcarEtiquetas: marcarEtiquetas,
    abrirGaveta: abrirGaveta,
    fecharGaveta: fecharGaveta,
    alternarTrilho: alternarTrilho,

    perfil: perfil
  };
})();
