/* ============================================================
   LOK CAR — SISTEMA · telas/configuracoes.js
   ------------------------------------------------------------
   §23 e §24 do pedido: os dados da EMPRESA e as POLÍTICAS DO
   CONTRATO. É a tela que destrava as outras.

   POR QUE ESTA TELA EXISTE
   ------------------------------------------------------------
   Cada contrato gerado neste sistema sai com um punhado de
   "[A DEFINIR]" no meio do texto. Não é falha do gerador: é a
   consequência direta e desejada da regra mais dura do pedido —
   não inventar CNPJ, não inventar franquia, não inventar caução.

   Isso significa que esta tela não é um formulário de cadastro
   a mais. Ela é a ÚNICA origem dos dados que faltam, e o número
   que ela mostra no topo ("quantos dados ainda travam o
   contrato") é o resumo de quanto trabalho jurídico ainda
   existe pela frente.

   POR ISSO O QUE ESTÁ PREENCHIDO APARECE MARCADO
   ------------------------------------------------------------
   Nome fantasia, telefone, WhatsApp, bairro, cidade, UF e
   Instagram vieram do SITE PÚBLICO — dados que a Lok Car já
   divulga. Todo o resto (razão social, CNPJ, inscrição
   estadual, e-mail, endereço completo, representante legal)
   está VAZIO, e a tela diz de onde veio cada um. Sem essa
   distinção, o operador não sabe se está olhando um dado
   confirmado ou um campo que ninguém nunca preencheu.

   A TELA NÃO GRAVA EM SERVIDOR NENHUM
   ------------------------------------------------------------
   O que se digita aqui vive no `localStorage` DESTE navegador.
   Isso está dito em texto, no rodapé, e não escondido numa nota
   de pé de página — porque a diferença entre "salvou" e "salvou
   neste computador" é a diferença entre um sistema e uma
   demonstração, e quem usa precisa saber qual dos dois está
   usando.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.configuracoes = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;
  var C = window.LOKCAR_CONTRATO;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  var AVISO_API = 'Disponível após integração do backend.';
  var AVISO_SITE = 'Publicado pela Lok Car no site.';

  /* ==========================================================
     1 · AS DUAS ABAS
     ----------------------------------------------------------
     Duas, e só duas, porque são duas coisas diferentes: o que a
     empresa É (§23) e o que a locadora DECIDE sobre a locação
     (§24). Misturar as duas numa página só faria a segunda
     parecer parte do cadastro — e não é: são políticas
     comerciais, que mudam por decisão, não por digitação.
     ========================================================== */
  var ABAS = [
    { id: 'empresa', rotulo: 'Empresa',
      sub: 'Razão social, CNPJ, endereço e representante legal. É daqui que o contrato tira a ' +
           'identificação da locadora — e por isso o que estiver vazio sai no documento como ' +
           '"Dado a configurar", nunca com um valor inventado.' },
    { id: 'contratos', rotulo: 'Contratos',
      sub: 'Combustível, quilometragem, caução, franquia, atraso, multas e cancelamento. Nada ' +
           'aqui tem valor sugerido: enquanto a Lok Car não definir, a política sai como ' +
           '"NÃO CONFIGURADO" e o contrato escreve "a definir pela locadora".' }
  ];

  var abaDe = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return ABAS[0];
  };

  /* A ABA VIVA DO DESENHO ATUAL.
     ----------------------------------------------------------
     Três funções precisam saber em que aba estão (o cabeçalho, o
     destaque do `?campo=` e a barra de salvar), e a resposta
     precisa ser a mesma nas três. Por isso ela é calculada UMA
     vez, aqui em cima, em vez de cada uma reler o endereço — três
     leituras independentes de `params` divergem no dia em que
     alguém mexer numa delas. */
  var abaMostrada = null;

  /* A QUE ABA PERTENCE UM CAMPO.
     ----------------------------------------------------------
     Existe porque a pré-visualização do contrato manda só
     `?campo=franquia` — ela não sabe, e não precisa saber, que a
     franquia mora na segunda aba. O endereço diz QUAL campo
     falta; qual aba mostra esse campo é assunto desta tela. */
  var abaDoCampo = function (campo) {
    if (!campo) return null;
    var i;
    for (i = 0; i < D.REGRAS.length; i++) if (D.REGRAS[i].id === campo) return 'contratos';
    for (i = 0; i < D.CAMPOS_EMPRESA.length; i++) if (D.CAMPOS_EMPRESA[i].id === campo) return 'empresa';
    return null;
  };

  /* Qual aba está aberta: o `?aba=` manda; na falta dele, o
     campo pedido decide; na falta dos dois, a primeira. Assim
     `#/configuracoes?campo=cnpj` abre na aba certa em vez de
     abrir na Empresa e procurar em vão por um campo que está na
     outra aba. */
  var escolherAba = function () {
    return abaDe(params.aba || abaDoCampo(params.campo));
  };

  var abaAtual = function () { return abaMostrada || escolherAba(); };

  /* ==========================================================
     2 · ORIGEM DE CADA CAMPO DA EMPRESA
     ----------------------------------------------------------
     Três origens, e a diferença entre elas é o que o operador
     precisa saber antes de mexer:

       'do site'  — a Lok Car já publica esse dado. Confiável.
       'local'    — alguém digitou aqui, neste navegador.
       vazio      — ninguém informou; é o que trava o contrato.

     Sem a primeira, o campo preenchido pareceria digitado; sem a
     segunda, o dado gravado pareceria oficial — e não é: ele
     existe só nesta máquina até o backend existir.
     ========================================================== */
  var veioDoSite = function (campo) {
    var base = D.EMPRESA[campo];
    return base !== null && base !== undefined && String(base).trim() !== '';
  };

  var foiDigitado = function (campo) {
    var texto = function (v) { return v === null || v === undefined ? '' : String(v); };
    return texto(S.empresa()[campo]) !== texto(D.EMPRESA[campo]);
  };

  var vazio = function (campo) { return S.empresaVazia(campo); };

  var contagem = function (grupo) {
    var campos = D.CAMPOS_EMPRESA.filter(function (c) { return c.grupo === grupo; });
    return {
      ok: campos.filter(function (c) { return !vazio(c.id); }).length,
      total: campos.length
    };
  };

  /* Os grupos não são uma lista escrita à mão nesta tela: eles
     saem da própria base. Acrescentar um campo novo em
     `dados.js` já o mostra aqui, no grupo certo, sem uma segunda
     lista para manter em dia — e listas em dia são a primeira
     coisa que sai de dia. */
  var GRUPOS = (function () {
    var vistos = [], saida = [];
    D.CAMPOS_EMPRESA.forEach(function (c) {
      if (vistos.indexOf(c.grupo) === -1) { vistos.push(c.grupo); saida.push(c.grupo); }
    });
    return saida;
  })();

  /* O `id` do grupo é um apelido, não o nome. "Endereço" e
     "Representação" são rótulos para ler; dentro de um atributo
     `id` eles virariam acento, espaço e maiúscula — e um `id`
     assim não pode ser usado sem escape por quem quiser apontar
     para ele. Acentos saem, o resto vira hífen. */
  var apelido = function (texto) {
    return String(texto)
      .replace(/[áàâãä]/gi, 'a').replace(/[éèêë]/gi, 'e')
      .replace(/[íìîï]/gi, 'i').replace(/[óòôõö]/gi, 'o')
      .replace(/[úùûü]/gi, 'u').replace(/ç/gi, 'c')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  /* ==========================================================
     3 · PENDÊNCIAS — O QUE TRAVA UM CONTRATO
     ----------------------------------------------------------
     A pergunta que a tela responde não é "quantos campos estão
     vazios", e sim "quanto disso trava os contratos". Então a
     conta é pedida ao PRÓPRIO TEMPLATE (`C.montar`), a mesma
     função que desenha o documento. Se a conta fosse refeita
     aqui, ela poderia divergir do que o contrato realmente
     escreve — e o operador confiaria no número errado.
     ========================================================== */
  var contratosReais = function () {
    return S.estado.contratos.filter(function (k) { return !k.modelo; });
  };

  var NOMES = (function () {
    var m = {};
    D.CAMPOS_EMPRESA.forEach(function (c) { m[c.id] = { rotulo: c.nome, aba: 'empresa' }; });
    D.REGRAS.forEach(function (r) { m[r.id] = { rotulo: r.nome, aba: 'contratos' }; });
    return m;
  })();

  var travasDaLocadora = function () {
    var total = 0, porCampo = {};

    contratosReais().forEach(function (k) {
      var montado = C.montar(k);
      total += C.resumoPendentes(montado).locadora;

      montado.pendentes.forEach(function (p) {
        if (!p.pendente || !p.deOnde || p.deOnde.tela !== '#/configuracoes') return;
        var chave = p.deOnde.campo || '?';
        porCampo[chave] = (porCampo[chave] || 0) + 1;
      });
    });

    return { total: total, porCampo: porCampo };
  };

  var maisTravam = function (travas) {
    return Object.keys(travas.porCampo).map(function (id) {
      return {
        id: id,
        rotulo: NOMES[id] ? NOMES[id].rotulo : id,
        aba: NOMES[id] ? NOMES[id].aba : 'empresa',
        quantos: travas.porCampo[id]
      };
    }).sort(function (a, b) {
      return b.quantos - a.quantos || a.rotulo.localeCompare(b.rotulo);
    });
  };

  /* ==========================================================
     4 · QUANTO DA CONFIGURAÇÃO JÁ ESTÁ DEFINIDO
     ----------------------------------------------------------
     Uma conta DIFERENTE da de cima, e a diferença importa:

       travas   = quantos "[A DEFINIR]" os contratos JÁ EMITIDOS
                  carregam. Depende de quantos contratos existem.
       cobertura= quantos dos campos e políticas estão
                  definidos, sobre o total. Não depende de
                  contrato nenhum.

     Somar as duas num número só daria uma medida que ninguém
     consegue conferir. Separadas, cada uma responde a uma
     pergunta que o operador realmente faz.
     ========================================================== */
  var cobertura = function () {
    var campos = D.CAMPOS_EMPRESA.filter(function (c) { return !vazio(c.id); }).length;
    var regras = D.REGRAS.filter(function (r) {
      return r.valor !== null && r.valor !== undefined && r.valor !== '';
    }).length;
    var total = D.CAMPOS_EMPRESA.length + D.REGRAS.length;
    var ok = campos + regras;

    return { ok: ok, total: total, pct: total ? Math.round((ok / total) * 100) : 0 };
  };

  var barra = function () {
    var c = cobertura();
    return '<div class="cfg-pend__bar"><i style="width:' + c.pct + '%"></i></div>' +
      '<p class="u-xs u-t4">' + c.ok + ' de ' + c.total +
      ' campos e políticas já estão definidos.</p>';
  };

  /* ==========================================================
     5 · CABEÇALHO E PAINEL DA DIREITA
     ========================================================== */
  var htmlAbas = function (aba) {
    return '<div class="tabs" role="tablist" aria-label="Seções de configuração">' +
      ABAS.map(function (a) {
        return '<button class="tabs__b" type="button" role="tab" data-acao="aba" data-f="' + a.id + '"' +
               (a.id === aba.id ? ' aria-selected="true"' : '') + '>' +
               esc(a.rotulo) + '</button>';
      }).join('') + '</div>';
  };

  /* O painel da direita é o que dá sentido à tela. Sem ele, o
     formulário seria uma lista de campos sem propósito visível —
     ninguém sabe por que preencher "inscrição estadual" até ver
     que ela falta em seis contratos. */
  var htmlTravas = function () {
    var t = travasDaLocadora();
    var contratos = contratosReais().length;

    var cartao = '<section class="card">' +
      '<div class="card__head"><div>' +
        '<h2 class="card__title">O que ainda trava o contrato</h2>' +
        '<p class="card__sub">Contado nos ' + contratos +
          (contratos === 1 ? ' contrato já emitido' : ' contratos já emitidos') + '</p>' +
      '</div></div>' +
      '<div class="card__body">' +
        '<div class="cfg-pend">' +
          '<p class="cfg-pend__n' + (t.total ? '' : ' cfg-pend__n--ok') + '">' + t.total + '</p>' +
          '<p class="cfg-pend__t">' +
            (t.total === 0
              ? 'Nenhum dado da Lok Car falta nos contratos emitidos.'
              : (t.total === 1
                  ? 'dado da Lok Car falta nos contratos emitidos'
                  : 'dados da Lok Car faltam nos contratos emitidos')) +
          '</p>' +
        '</div>' +
        barra() +
        '<p class="u-xs u-t4 u-mt">A contagem de cima vem do próprio gerador de contrato — é a ' +
          'mesma função que desenha o documento. Se esta tela e a pré-visualização ' +
          'discordassem, uma das duas estaria mentindo.</p>' +
      '</div></section>';

    var lista = maisTravam(t);
    var cartaoCampos = '';

    if (lista.length) {
      cartaoCampos = '<section class="card u-mt">' +
        '<div class="card__head"><div>' +
          '<h2 class="card__title">Por onde começar</h2>' +
          '<p class="card__sub">Os campos que mais contratos travam</p>' +
        '</div></div>' +
        '<div class="card__body">' +
        lista.slice(0, 8).map(function (l) {
          /* O atributo NÃO pode se chamar `data-campo`: um
             `[data-campo]` dentro de um formulário é a marca de
             um CAMPO A PREENCHER, e `lerCampos` recolhe todos
             eles. Batizar este atalho de `data-campo` faria o
             link entrar na leitura como se fosse um campo vazio —
             e "Por onde começar" apagaria a configuração do campo
             que ele aponta. Daí `data-alvo-campo`. */
          return '<div class="cfg-falta" data-acao="ir-campo" data-alvo-campo="' + esc(l.id) + '" ' +
            'role="link" tabindex="0" ' +
            'title="Ir para o campo: ' + esc(l.rotulo) + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 5v14M5 12h14"/></svg>' +
            '<b>' + esc(l.rotulo) + '</b>' +
            '<span>' + l.quantos + (l.quantos === 1 ? ' contrato' : ' contratos') + '</span>' +
            '</div>';
        }).join('') +
        '</div></section>';
    }

    var limpar = '<section class="card u-mt"><div class="card__body">' +
      U.botao('Apagar o que foi configurado', 'zerar', 'out', null,
        !S.disponivelArmazenamento,
        'Este navegador não permitiu gravar nada, então não há o que apagar.') +
      '<p class="u-xs u-t4 u-mt">Volta os campos de Empresa e de Contratos ao estado da base — ' +
      'praticamente todos vazios. Os contratos já emitidos não mudam: eles guardam o texto que ' +
      'tinham quando foram gerados.</p>' +
      '</div></section>';

    return '<aside class="pilha">' + cartao + cartaoCampos + limpar + htmlRodape() + '</aside>';
  };

  var htmlRodape = function () {
    var guarda = S.disponivelArmazenamento;

    return '<div class="' + (guarda ? 'cfg-local' : 'cfg-aviso') + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 3l9 4v6c0 5-4 8-9 8s-9-3-9-8V7z"/><path d="M9 12l2 2 4-4"/></svg>' +
      '<span>' +
        (guarda
          ? '<b>Estes dados ficam neste navegador.</b> As configurações são gravadas no ' +
            'armazenamento local da máquina, não em um servidor — não há servidor nesta fase. ' +
            'Outro computador, ou uma janela anônima, verá os campos como estão na base. ' +
            'Quando o backend entrar, é ele que passa a guardar isto.'
          : '<b>Este navegador não permitiu gravar.</b> As configurações valem nesta aba e ' +
            'voltam ao estado da base ao recarregar. Costuma acontecer em navegação privativa ' +
            'ou com armazenamento bloqueado por política.') +
      '</span></div>';
  };

  /* ==========================================================
     6 · ABA EMPRESA (§23)
     ----------------------------------------------------------
     Um campo por linha de `CAMPOS_EMPRESA`, dentro do grupo que
     a base declara. A tela NÃO decide quais campos existem: ela
     desenha a lista.
     ========================================================== */
  var seloOrigem = function (c, falta, doSite, digitado) {
    if (doSite) return '<span class="bdg bdg--mini bdg--go">do site</span>';
    if (digitado) return '<span class="bdg bdg--mini bdg--acc" title="Digitado neste navegador">local</span>';
    if (c.obrigatorio) return '<span class="bdg bdg--mini bdg--warn">obrigatório</span>';
    return '<span class="bdg bdg--mini bdg--idle">opcional</span>';
  };

  var campoEmpresa = function (c) {
    var valor = S.empresa()[c.id];
    var falta = vazio(c.id);
    var doSite = veioDoSite(c.id) && !foiDigitado(c.id);
    var digitado = foiDigitado(c.id);

    var dica = doSite
      ? AVISO_SITE + ' Confira se continua válido antes de gerar contrato.'
      : (falta
          ? 'A preencher. Enquanto estiver vazio, o contrato escreve "[A DEFINIR]" neste ponto.'
          : 'A preencher');

    return '<div class="regra" data-campo-bloco="' + esc(c.id) + '">' +
      '<div class="regra__h">' +
        '<b>' + esc(c.nome) + '</b>' +
        seloOrigem(c, falta, doSite, digitado) +
      '</div>' +
      '<div class="regra__linha">' +
        '<span class="cfg-obrig' + (falta && c.obrigatorio ? ' cfg-obrig--falta' : '') + '">' +
          (falta ? 'não configurado' : 'definido') + '</span>' +
        U.fld(c.nome, 'text', c.id, valor || '', dica) +
      '</div>' +
      '<p class="regra__dica">' + esc(dica) + '</p>' +
      '</div>';
  };

  var htmlEmpresa = function () {
    var faltam = S.empresaPendentes();
    var definidos = D.CAMPOS_EMPRESA.length - faltam.length;

    return '<div class="cfg-grupo">' +
      '<div class="cfg-grupo__h"><h3>Como preencher</h3>' +
        '<span class="cfg-n' + (faltam.length ? '' : ' cfg-n--ok') + '">' +
          definidos + ' de ' + D.CAMPOS_EMPRESA.length + '</span></div>' +
      '<p class="u-sm u-t2">Aqui entra o que o contrato escreve no bloco ' +
        '<b>IDENTIFICAÇÃO DA LOCADORA</b>. Os campos marcados como <b>do site</b> são dados que ' +
        'a Lok Car já publica; os marcados como <b>obrigatório</b> são os que aparecem como ' +
        'pendência na pré-visualização do contrato. O que ninguém informou fica vazio — e vazio ' +
        'é visível, que é o ponto.</p>' +
      '</div>' +

      GRUPOS.map(function (g) {
        var n = contagem(g);
        return '<div class="cfg-grupo" id="cfg-' + esc(apelido(g)) + '">' +
          '<div class="cfg-grupo__h"><h3>' + esc(g) + '</h3>' +
            '<span class="cfg-n' + (n.ok === n.total ? ' cfg-n--ok' : '') + '">' +
              n.ok + ' de ' + n.total + '</span></div>' +
          D.CAMPOS_EMPRESA.filter(function (c) { return c.grupo === g; })
            .map(campoEmpresa).join('') +
          '</div>';
      }).join('') +

      htmlNotaContrato() +
      htmlBarraSalvar('empresa');
  };

  /* A nota que fecha o ciclo: o que foi digitado aqui já aparece
     no contrato, sem passo intermediário. Diz isso com o caso
     concreto, porque "alimenta o contrato" é abstrato demais
     para alguém confiar. */
  var htmlNotaContrato = function () {
    var razao = S.empresa().razaoSocial;

    return '<div class="aviso aviso--neutro u-mt-lg">' +
      '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>' +
      '<span><b>Isto vai direto para o contrato.</b> ' +
        (razao
          ? 'A razão social gravada é "' + esc(razao) + '", e o bloco IDENTIFICAÇÃO DA ' +
            'LOCADORA já a escreve no lugar de "[A DEFINIR]".'
          : 'Enquanto a razão social estiver vazia, o bloco IDENTIFICAÇÃO DA LOCADORA escreve ' +
            '<span class="mono">[A DEFINIR PELA LOCADORA]</span> no lugar do nome da empresa — ' +
            'e não um nome parecido com o real.') +
        ' Nada aqui foi preenchido com valor de exemplo.</span></div>';
  };

  /* ==========================================================
     7 · ABA CONTRATOS (§24)
     ----------------------------------------------------------
     Nenhuma regra vem com sugestão. O campo de caução não começa
     com "500" nem o de multa com "10%": um número plausível
     digitado por engano viraria cláusula contratual.
     ========================================================== */
  var valorDaRegra = function (r) {
    if (r.valor === null || r.valor === undefined || r.valor === '') return null;
    if (r.opcoes && r.opcoes.length) return String(r.valor);
    if (r.unidade === 'R$') return D.fmtBRL(r.valor);
    return String(r.valor) + (r.unidade ? ' ' + r.unidade : '');
  };

  var controleRegra = function (r) {
    if (r.opcoes && r.opcoes.length) {
      /* A primeira opção é VAZIA de propósito. Um `<select>` sem
         opção vazia já vem com a primeira escolhida — e a
         primeira escolha é uma decisão da locadora que ninguém
         tomou. Sem esta linha, "Cheio / Cheio" viraria política
         vigente só por estar no topo da lista. */
      var lista = [{ valor: '', rotulo: '— não configurado —' }].concat(
        r.opcoes.map(function (o) { return { valor: o, rotulo: o }; })
      );
      return U.fldSel('Definição', r.id, lista, r.valor === null ? '' : String(r.valor));
    }

    var preenchido = r.valor === null || r.valor === undefined ? '' : String(r.valor);

    /* Campo de dinheiro é `text`, não `number`: o `number` do
       navegador aceita "1e5" e "3.10" e devolve um número que
       ninguém digitou. Aqui o operador digita dígitos e a dica
       diz o formato — e `salvar()` recusa o que não for isso. */
    if (r.unidade === 'R$') {
      return U.fld('Definição', 'text', r.id, preenchido, 'Somente números — ex.: 2500');
    }

    return U.fld('Definição', 'number', r.id, preenchido,
      r.unidade ? 'Valor em ' + r.unidade : 'Valor');
  };

  var regraLinha = function (r) {
    var definido = valorDaRegra(r) !== null;

    return '<div class="regra" data-campo-bloco="' + esc(r.id) + '">' +
      '<div class="regra__h">' +
        '<b>' + esc(r.nome) + '</b>' +
        '<span class="bdg bdg--mini bdg--' + (definido ? 'ok' : 'warn') + '">' +
          (definido ? 'definido' : 'não configurado') + '</span>' +
        (definido ? '<span class="u-xs u-t3">atual: ' + esc(valorDaRegra(r)) + '</span>' : '') +
      '</div>' +
      '<div class="regra__linha">' +
        '<span class="u-xs u-t4">' + (r.unidade ? 'em ' + esc(r.unidade) : 'escolha') + '</span>' +
        controleRegra(r) +
      '</div>' +
      '<p class="regra__dica">' + esc(r.dica) + '</p>' +
      '</div>';
  };

  var htmlContratos = function () {
    var pendentes = S.regrasPendentes();

    return '<div class="cfg-grupo">' +
      '<div class="cfg-grupo__h"><h3>Políticas da locação</h3>' +
        '<span class="cfg-n' + (pendentes.length ? '' : ' cfg-n--ok') + '">' +
          (D.REGRAS.length - pendentes.length) + ' de ' + D.REGRAS.length + '</span></div>' +
      '<p class="u-sm u-t2">As decisões abaixo são da Lok Car, não do sistema. Enquanto não ' +
        'estiverem definidas, as cláusulas escrevem <span class="mono">a definir pela ' +
        'locadora</span> no lugar do valor. ' +
        (pendentes.length
          ? 'Hoje ' + (pendentes.length === 1
              ? '1 decisão está em aberto.'
              : pendentes.length + ' decisões estão em aberto.')
          : 'Todas estão definidas.') +
      '</p></div>' +

      /* SEPARAR "O CONTRATO ESCREVE ISTO" DE "O SISTEMA DECIDE ASSIM".
         ----------------------------------------------------------
         As regras acima viram cláusula: o que se escolhe ali é o
         que o cliente lê no papel. As duas abaixo não viram
         cláusula nenhuma — são regras de OPERAÇÃO, que mudam como
         o sistema se comporta.

         Juntar as duas famílias numa lista só faria parecer que
         mexer na prorrogação altera o contrato. Não altera. */
      htmlOperacao() +

      /* O filtro é "não é de operação", e não "é de contrato":
         uma regra nova em `dados.js` que ninguém marque continua
         aparecendo na lista do contrato, que é o lugar padrão. O
         contrário — exigir a marcação — faria a regra sumir da
         tela em silêncio até alguém lembrar de marcá-la. */
      D.REGRAS.filter(function (r) { return r.tipo !== 'operacao'; })
        .map(regraLinha).join('') +

      htmlProtecoes() +
      htmlBarraSalvar('contratos');
  };

  /* ==========================================================
     7.1 · RESERVAS E LOCAÇÕES (§11)
     ----------------------------------------------------------
     Como o sistema responde a um pedido de mais dias com o carro
     já na mão do cliente. É a única decisão desta aba que não
     vira texto de contrato — e é a que muda o dia de quem opera.
     ========================================================== */
  var htmlOperacao = function () {
    var regras = D.REGRAS.filter(function (r) { return r.tipo === 'operacao'; });
    if (!regras.length) return '';

    var modo = D.modoDeProrrogacao(S.regras());

    return '<div class="cfg-grupo u-mt-lg" id="cfg-reservas-locacoes">' +
      '<div class="cfg-grupo__h"><h3>Reservas e locações</h3>' +
        '<span class="cfg-n' + (modo === 'auto' ? '' : ' cfg-n--ok') + '">' +
          (modo === 'auto' ? 'aprovação automática' : 'aprovação manual') + '</span></div>' +
      '<p class="u-sm u-t2">Um cliente com o carro na mão pode pedir mais dias. Estas regras ' +
        'dizem quem responde a esse pedido. Nada aqui vai para o contrato: são decisões de ' +
        'operação.</p>' +
      '<div class="aviso aviso--neutro u-mt">' +
        '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>' +
        '<span><b>A aprovação automática só vale quando o veículo está comprovadamente ' +
        'livre.</b> Se houver outra reserva, manutenção programada ou qualquer bloqueio no ' +
        'período extra, o pedido vai para a mão do operador — o sistema nunca estica uma ' +
        'locação para cima do compromisso de outra pessoa.</span></div>' +
      regras.map(regraLinha).join('') +
      '</div>';
  };

  /* Proteções e adicionais são texto CORRIDO, não valor. Não há
     o que configurar num campo — a locadora precisa escrever a
     cobertura de cada nível. O bloco diz isso, e diz o que o
     contrato faz enquanto isso. */
  var htmlProtecoes = function () {
    var nota = '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>';

    return '<div class="cfg-grupo u-mt-lg" id="cfg-protecoes">' +
      '<div class="cfg-grupo__h"><h3>Proteções e adicionais</h3>' +
        '<span class="cfg-n">texto livre</span></div>' +
      '<div class="aviso aviso--neutro">' + nota +
        '<span>' + esc(D.REGRAS_LIVRES.protecoes) + '</span></div>' +
      '<div class="aviso aviso--neutro u-mt">' + nota +
        '<span>' + esc(D.REGRAS_LIVRES.adicionais) + '</span></div>' +
      '<div class="u-mt">' +
        U.botao('Coberturas das proteções', 'editar-protecoes', 'out') + ' ' +
        U.botao('Serviços adicionais', 'editar-adicionais', 'out') +
      '</div>' +
      '<p class="u-xs u-t4 u-mt">Editar e guardar estes textos exige um servidor que os ' +
        'guarde entre navegadores e sessões. ' + esc(AVISO_API) + '</p>' +
      '</div>';
  };

  /* ==========================================================
     8 · A BARRA DE SALVAR
     ----------------------------------------------------------
     Só aparece quando há alteração não gravada. Uma barra
     permanente de "Salvar" ensina a ignorá-la; uma que aparece
     quando muda é um aviso, não um botão a mais.

     O estado "sujo" é o que está NOS CAMPOS contra o que está
     GRAVADO. Se o operador digita e apaga, volta a limpo e a
     barra some — que é o que se espera de um formulário.
     ========================================================== */
  var htmlBarraSalvar = function (aba) {
    /* O atributo vai como `style`, e não como `hidden`.
       `[hidden] { display: none }` é regra do navegador, e
       qualquer `display` declarado numa folha de estilo ganha
       dela. `.cfg-salvar` declara `display: flex` para virar
       barra, então o `hidden` sozinho não esconderia nada — e a
       barra de "salvar" apareceria numa tela sem nada para
       salvar. Já os atributos continuam nos dois sentidos:
       leitor de tela não anuncia barra escondida. */
    var oculta = alterado(aba) ? '' : ' style="display:none"';

    return '<div class="cfg-salvar" data-slot="salvar" aria-hidden="' +
      (alterado(aba) ? 'false' : 'true') + '"' + oculta + '>' +
      '<p data-slot="salvar-txt">' + textoAlterado(aba) + '</p>' +
      '<div class="cfg-salvar__acts">' +
        '<button class="bt bt--sil" type="button" data-acao="descartar">Descartar</button>' +
        '<button class="bt bt--pri" type="button" data-acao="salvar">Salvar</button>' +
      '</div></div>';
  };

  var textoAlterado = function (aba) {
    return aba === 'contratos'
      ? 'Há decisões alteradas e não salvas.'
      : 'Há campos alterados e não salvos.';
  };

  /* Compara campo a campo o que está na tela com o que está
     gravado. Lê do DOM porque é o DOM que tem a verdade do que
     a pessoa está vendo — inclusive do que ela apagou. */
  var alterado = function (aba) {
    var campos = U.lerCampos(cx);

    var gravado = {};
    if (aba === 'contratos') {
      S.regras().forEach(function (r) {
        gravado[r.id] = r.valor === null || r.valor === undefined ? '' : String(r.valor);
      });
    } else {
      var e = S.empresa();
      D.CAMPOS_EMPRESA.forEach(function (c) {
        gravado[c.id] = e[c.id] === null || e[c.id] === undefined ? '' : String(e[c.id]);
      });
    }

    var algum = false;
    Object.keys(gravado).forEach(function (k) {
      if (campos[k] === undefined) return;
      if (String(campos[k]) !== gravado[k]) algum = true;
    });
    return algum;
  };

  /* ==========================================================
     9 · TELA
     ========================================================== */
  var htmlTela = function () {
    /* `abaAtual()`, e não `params.aba` direto: é ela que também
       consulta o `?campo=` para descobrir em que aba um campo
       mora. Com `params.aba` puro, `#/configuracoes?campo=caucao`
       abria na Empresa e procurava a caução na aba errada. */
    var aba = escolherAba();
    var faltam = aba.id === 'empresa' ? S.empresaPendentes().length : S.regrasPendentes().length;

    return U.pageHead('Configurações',
      'Os dados que a Lok Car precisa informar para que os contratos saiam completos. ' +
      '<b>' + faltam + '</b> ' + (faltam === 1 ? 'campo falta' : 'campos faltam') +
      ' nesta seção — o que não for preenchido aparece no contrato como ' +
      '<b>Dado a configurar</b>, nunca como um valor inventado.') +
      htmlAbas(aba) +
      '<p class="u-sm u-t2 u-mt">' + esc(aba.sub) + '</p>' +
      '<div class="duas u-mt-lg">' +
        '<div class="pilha">' + (aba.id === 'empresa' ? htmlEmpresa() : htmlContratos()) + '</div>' +
        htmlTravas() +
      '</div>';
  };

  /* A aba fica travada aqui, no primeiro desenho, e não muda
     mais. Trocar de aba passa pelo endereço, e trocar o endereço
     redesenha a tela — ou seja, uma aba diferente significa
     sempre uma chamada nova desta função, com um `params` novo.
     Guardar o resultado evita que o `?campo=` continue mandando
     na aba depois de o operador já ter clicado noutra. */
  abaMostrada = escolherAba();

  cx.innerHTML = htmlTela();

  /* Redesenha SÓ o miolo e o painel. Redesenhar a tela inteira
     apagaria o que foi digitado — trocar de aba depois de
     preencher dez campos não pode custar os dez campos. */
  var repintar = function () {
    var aba = abaAtual();
    var alvo = cx.querySelector('.duas');
    if (!alvo) return;

    alvo.innerHTML =
      '<div class="pilha">' + (aba.id === 'empresa' ? htmlEmpresa() : htmlContratos()) + '</div>' +
      htmlTravas();

    Array.prototype.forEach.call(cx.querySelectorAll('.tabs__b'), function (b) {
      if (b.getAttribute('data-f') === aba.id) b.setAttribute('aria-selected', 'true');
      else b.removeAttribute('aria-selected');
    });

    /* A barra é montada enquanto o DOM antigo ainda está no
       lugar — a atribuição de `innerHTML` só acontece no fim, e
       as funções que montam o HTML correm antes dela. Então a
       barra nasce decidida por valores que acabaram de deixar de
       existir: logo depois de "Descartar", ela apareceria como
       se ainda houvesse alteração pendente. Reavaliar aqui, com
       o DOM novo, é o que a faz desaparecer de verdade. */
    conferirBarra();
  };

  /* Atualiza só a barra. É a única peça que precisa acompanhar a
     digitação; o resto da tela não depende do que está nos
     campos. */
  var conferirBarra = function () {
    var barra = cx.querySelector('[data-slot="salvar"]');
    if (!barra) return;

    var sujo = alterado(abaAtual().id);

    /* O `style` inline é o que realmente esconde; o atributo é
       para quem não vê a tela. Os dois andam juntos, sempre —
       um sem o outro deixaria a barra invisível para o olho e
       presente para o leitor de tela, ou o contrário. */
    if (sujo) {
      barra.style.display = '';
      barra.setAttribute('aria-hidden', 'false');
    } else {
      barra.style.display = 'none';
      barra.setAttribute('aria-hidden', 'true');
    }

    var txt = cx.querySelector('[data-slot="salvar-txt"]');
    if (txt) txt.textContent = textoAlterado(abaAtual().id);
  };

  /* ==========================================================
     10 · GRAVAR
     ----------------------------------------------------------
     Duas guardas antes de gravar, e as duas existem porque o
     valor digitado vira cláusula de contrato:

       · só os campos DA ABA são gravados. Sem este recorte,
         `salvarEmpresa` receberia também as nove regras e
         gravaria nove chaves que não são campos da empresa.

       · campo em branco vira VAZIO, nunca placeholder. Um campo
         vazio que recebesse "Dado a configurar" viraria o nome
         da empresa no contrato.
     ========================================================== */
  var conferirRegras = function (aba, campos) {
    if (aba !== 'contratos') return null;

    for (var i = 0; i < D.REGRAS.length; i++) {
      var r = D.REGRAS[i];
      if (r.opcoes && r.opcoes.length) continue;

      var bruto = campos[r.id];
      if (bruto === undefined || bruto === '' || bruto === null) continue;

      var n = Number(String(bruto).replace(',', '.'));

      if (isNaN(n)) {
        return 'O valor de "' + r.nome + '" não é um número. ' +
          (r.unidade === 'R$' ? 'Digite só dígitos, sem "R$" nem ponto de milhar — ex.: 2500.'
                              : 'Digite só o número, sem ' + (r.unidade || 'texto') + '.');
      }
      if (n < 0) {
        return 'O valor de "' + r.nome + '" está negativo. Corrija antes de gravar: um número ' +
          'negativo aqui vira cláusula de contrato.';
      }
    }
    return null;
  };

  var salvar = function () {
    var aba = abaAtual();
    var campos = U.lerCampos(cx);
    var recorte = {};

    if (aba.id === 'contratos') {
      D.REGRAS.forEach(function (r) {
        if (campos[r.id] !== undefined) recorte[r.id] = campos[r.id];
      });
    } else {
      D.CAMPOS_EMPRESA.forEach(function (c) {
        if (campos[c.id] !== undefined) recorte[c.id] = campos[c.id];
      });
    }

    var problema = conferirRegras(aba.id, recorte);
    if (problema) { U.canto(problema, 'erro'); return; }

    U.resultado(aba.id === 'contratos' ? S.salvarRegras(recorte) : S.salvarEmpresa(recorte));
    repintar();
  };

  var descartar = function () {
    repintar();
    U.canto('Alterações descartadas. Os campos voltaram ao que estava gravado.', 'aviso');
  };

  var zerar = function () {
    U.confirmar(
      'Apagar o que foi configurado?',
      'Os campos de Empresa e de Contratos voltam ao estado da base — praticamente todos ' +
      'vazios. O que foi digitado neste navegador será perdido. Os contratos já emitidos não ' +
      'mudam: eles guardam o texto que tinham quando foram gerados.',
      'Apagar',
      function () {
        U.resultado(S.zerarConfiguracoes());
        repintar();
      }
    );
  };

  /* ==========================================================
     11 · LIGAÇÃO
     ========================================================== */
  var acoes = function (alvo) {
    var acao = alvo.getAttribute('data-acao');

    if (alvo.getAttribute('aria-disabled') === 'true') {
      U.canto(alvo.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'aba': {
        var f = alvo.getAttribute('data-f');
        var destinoAba = abaDe(f);

        /* Trocar de aba troca o endereço, e trocar o endereço
           redesenha a tela inteira — o que apagaria o que ainda
           não foi gravado. Avisar antes é a diferença entre uma
           decisão e um acidente. */
        if (destinoAba.id !== abaAtual().id && alterado(abaAtual().id)) {
          U.confirmar(
            'Sair sem salvar?',
            textoAlterado(abaAtual().id) + ' Trocar de aba agora descarta o que está nos campos.',
            'Descartar e trocar',
            function () {
              U.navegar('#/configuracoes' +
                (destinoAba.id === 'empresa' ? '' : '?aba=' + destinoAba.id));
            }
          );
          return;
        }

        /* Trocar de aba já visível não muda o endereço, então não
           há redesenho nenhum a esperar. Dizer isso em voz alta é
           melhor do que deixar o clique parecer perdido. */
        if (destinoAba.id === abaAtual().id) {
          U.canto('Esta já é a seção "' + destinoAba.rotulo + '" que está aberta.', 'aviso');
          return;
        }

        /* O endereço é escrito com o parâmetro CRU, e não com um
           `encodeURIComponent`: `navegar` compara a rota pedida
           com a que já está no endereço para decidir se precisa
           redesenhar à mão (o navegador não dispara `hashchange`
           quando a rota não muda). "empresa%20" num lado e
           "empresa" no outro fariam a comparação falhar por
           diferença de escrita, não de destino. */
        U.navegar('#/configuracoes' +
          (destinoAba.id === 'empresa' ? '' : '?aba=' + destinoAba.id));
        return;
      }

      case 'ir-campo': {
        /* Mesmo endereço que o contrato escreve quando o operador
           clica num "[A DEFINIR]" dentro do documento — inclusive
           a codificação, que precisa ser idêntica dos dois lados
           para o endereço bater. `#/configuracoes?campo=cnpj`
           basta: `abaAtual()` descobre em que aba o campo mora. */
        var campo = alvo.getAttribute('data-alvo-campo') || '';
        U.navegar('#/configuracoes' + (campo ? '?campo=' + encodeURIComponent(campo) : ''));
        return;
      }

      case 'salvar': salvar(); return;
      case 'descartar': descartar(); return;
      case 'zerar': zerar(); return;

      case 'editar-protecoes':
      case 'editar-adicionais': {
        var protecoes = acao === 'editar-protecoes';
        U.abrirModal({
          titulo: protecoes ? 'Coberturas das proteções' : 'Serviços adicionais',
          sub: 'Estes textos são redação da Lok Car, não valor de campo.',
          corpo: '<p class="u-sm u-t2">' +
            esc(protecoes ? D.REGRAS_LIVRES.protecoes : D.REGRAS_LIVRES.adicionais) + '</p>' +
            '<p class="u-sm u-t2 u-mt">Editar e guardar este texto exige um servidor que o ' +
            'guarde entre navegadores e sessões. ' + esc(AVISO_API) + '</p>',
          botoes: [{ rotulo: 'Entendi', tom: 'out', acao: 'fechar' }],
          aoClicar: function () { U.fecharModal(); }
        });
        return;
      }

      default:
        U.canto(AVISO_API, 'aviso');
    }
  };

  cx.addEventListener('input', function (ev) {
    var campo = ev.target;
    if (!campo || !campo.getAttribute || !campo.getAttribute('data-campo')) return;
    conferirBarra();
  });

  cx.addEventListener('change', function (ev) {
    var campo = ev.target;
    if (!campo || !campo.getAttribute || !campo.getAttribute('data-campo')) return;
    conferirBarra();
  });

  cx.addEventListener('keydown', function (ev) {
    /* Teclado tem dois casos, e os dois precisam de tratamento
       próprio porque nenhum deles vira `click` num elemento que
       não seja `<button>`:

         · Enter num campo de texto grava — é o que se espera de
           um formulário. Enter dentro de um `<select>` fica de
           fora, porque ali ele confirma a opção escolhida e
           gravar nesse instante tira o operador do fluxo de
           definir as nove políticas em sequência.

         · Enter ou espaço num atalho com `role="link"` aciona o
           atalho. Sem isto, "Por onde começar" seria inalcançável
           por teclado. */
    var alvo = ev.target;
    if (!alvo || !alvo.getAttribute) return;

    if (ev.key === ' ' || ev.key === 'Enter') {
      if (alvo.getAttribute('data-acao') === 'ir-campo') {
        if (ev.preventDefault) ev.preventDefault();
        acoes(alvo);
        return;
      }
    }

    if (ev.key !== 'Enter') return;
    if (!alvo.getAttribute('data-campo')) return;
    if (alvo.tagName !== 'INPUT') return;
    if (ev.preventDefault) ev.preventDefault();
    salvar();
  });

  cx.addEventListener('click', function (ev) {
    var alvo = ev.target.closest ? ev.target.closest('[data-acao]') : null;

    /* Âncora sem `data-acao` também navega. O contrato usa esse
       formato; deixar o clique morrer aqui faria o link parecer
       quebrado. */
    if (!alvo) {
      var link = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (link) {
        var h = link.getAttribute('href');
        if (h && h.charAt(0) === '#') {
          if (ev.preventDefault) ev.preventDefault();
          U.navegar(h);
        }
      }
      return;
    }

    if (ev.preventDefault) ev.preventDefault();
    acoes(alvo);
  });

  /* ==========================================================
     12 · DESTAQUE DO CAMPO PEDIDO
     ----------------------------------------------------------
     O contrato manda `?campo=cnpj` quando o operador clica num
     "[A DEFINIR]". Aqui o campo é focado e trazido à vista — é
     o que fecha o ciclo entre "não configurado" e "configurado".
     ========================================================== */
  (function destacar() {
    var campo = params.campo;
    if (!campo) return;

    /* O valor vem de um endereço, então aspas e colchetes são
       possíveis. Sem escapar, a consulta inteira quebra e o
       destaque — que é o motivo de o operador ter clicado no
       contrato — silenciosamente não acontece. */
    var seguro = esc(campo);

    var bloco = cx.querySelector('[data-campo-bloco="' + seguro + '"]');
    if (!bloco) return;

    var controle = bloco.querySelector('[data-campo="' + seguro + '"]');
    if (controle && typeof controle.focus === 'function') {
      try { controle.focus({ preventScroll: true }); } catch (e) { /* segue sem foco */ }
    }

    /* `scrollIntoView` não existe em toda situação; onde não
       existe, o foco já resolveu o essencial. */
    if (bloco.scrollIntoView) {
      try { bloco.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* segue */ }
    }
  })();
};
