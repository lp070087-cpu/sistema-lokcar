/* ============================================================
   LOK CAR — SISTEMA · telas/manutencoes.js
   ------------------------------------------------------------
   §22 do pedido: as manutenções da frota e os alertas —
   Revisão próxima, Óleo, Pneus, Documentação.

   A REGRA QUE MANDA NESTA TELA
   ------------------------------------------------------------
   Manutenção não é só dinheiro gasto: é um CARRO PARADO. Cada
   registro aqui tira (ou não tira) uma unidade de circulação, e
   é isso que decide se a Lok Car consegue honrar as reservas do
   dia. Por isso a lista começa dizendo, em cada linha, o que
   aquele registro fez com o veículo — e o topo conta quantos
   carros estão fora por causa de manutenção.

   `agendada` NÃO PARA O CARRO. Uma revisão marcada para daqui a
   uma semana convive com a locação de amanhã; tratá-la como
   indisponibilidade tiraria do cliente um carro que está na
   garagem pronto para sair. `andamento` e `bloqueada` param.

   O CUSTO
   ------------------------------------------------------------
   Todos os registros da base têm `custo: null` — ninguém
   consultou a oficina ainda. A tela mostra "a definir" e diz
   que enquanto não houver custo o valor não entra em conta
   nenhuma. É a mesma regra do financeiro: um número inventado
   numa tela de dinheiro é pior que a ausência do número.
   ============================================================ */

window.LOKCAR_TELAS = window.LOKCAR_TELAS || {};

window.LOKCAR_TELAS.manutencoes = function (cx, ctx) {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var params = (ctx && ctx.params) || {};
  var esc = U.esc;

  var ALERTAS = ['Revisão próxima', 'Óleo', 'Pneus', 'Documentação'];

  /* Os mesmos dois ícones do `.atalho` da casca (`ui.js`), porque
     os quatro alertas são atalhos de verdade: levam à lista já
     recortada por motivo. */
  var ICO_ALERTA =
    '<svg class="atalho__ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M14.7 6.3a4 4 0 0 1 5 5L10 21H5v-5z"/></svg>';
  var ICO_DOC =
    '<svg class="atalho__ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M8 3h6l4 4v14H8zM14 3v5h4"/></svg>';

  /* Todo `<svg>` dentro de `.aviso` precisa de `fill="none"`
     inline: o CSS de `.aviso__ico` só define `stroke`, então um
     `<path>` sem `fill` sai preenchido de preto sólido. */
  var ICO_NOTA =
    '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/></svg>';
  var ICO_OK =
    '<svg class="aviso__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>';

  /* ==========================================================
     1 · O QUE A MANUTENÇÃO FAZ COM O VEÍCULO
     ----------------------------------------------------------
     É a informação que o operador precisa antes de qualquer
     outra: esse carro pode sair hoje?
     ========================================================== */
  var paraOCarro = function (m) {
    if (m.status === 'concluida') {
      return { rotulo: 'Liberado', tom: 'ok',
               texto: 'Serviço concluído — o veículo voltou a circular.' };
    }
    if (m.status === 'andamento') {
      return { rotulo: 'Fora de circulação', tom: 'bad',
               texto: 'Está na oficina agora. Não pode ser reservado nem retirado.' };
    }
    if (m.status === 'bloqueada') {
      return { rotulo: 'Fora de circulação', tom: 'bad',
               texto: 'Bloqueado por documentação. Não pode circular até regularizar — ' +
                      'e o serviço não depende da oficina, depende de papel.' };
    }
    return { rotulo: 'Continua circulando', tom: 'go',
             texto: 'Está agendada. O veículo segue disponível para locação até a entrada ' +
                    'na oficina — uma revisão marcada não tira o carro da garagem.' };
  };

  /* Um CARRO parado, não uma manutenção. Dois serviços no mesmo
     veículo são UM carro fora, e não dois: contar registros
     inflaria justamente o número que o operador usa para saber
     quantos carros ele ainda tem para alugar.

     A pergunta é feita ao estado DEDUZIDO do veículo
     (`D.statusDoVeiculo`), e não ao campo `status` dele. O campo
     guarda o que o operador definiu à mão; o que a operação
     mostra é o campo cruzado com a agenda. Um carro marcado
     "disponível" que já está na oficina pela manutenção em
     andamento apareceria como disponível se esta conta olhasse o
     campo — e a tela diria que há um carro livre que não existe. */
  var veiculosParados = function () {
    var vistos = {};
    var quantos = 0;

    D.MANUTENCOES.forEach(function (m) {
      if (m.status === 'concluida') return;
      var v = S.veiculo(m.veiculoId);
      if (!v || vistos[v.id]) return;
      var s = D.statusDoVeiculo(v);
      if (s !== 'manutencao' && s !== 'indisponivel') return;
      vistos[v.id] = true;
      quantos += 1;
    });

    return quantos;
  };

  /* ==========================================================
     2 · NÚMEROS DO TOPO
     ========================================================== */
  var htmlCards = function () {
    var abertas = D.MANUTENCOES.filter(function (m) { return m.status !== 'concluida'; });
    var parados = veiculosParados();
    var agendadas = D.MANUTENCOES.filter(function (m) { return m.status === 'agendada'; });
    var atrasadas = abertas.filter(function (m) {
      return m.previsao && D.diffDias(m.previsao, D.HOJE) > 0;
    });

    var cartao = function (titulo, valor, nota, tom) {
      return '<div class="kpi">' +
        '<p class="kpi__key">' + esc(titulo) + '</p>' +
        '<p class="kpi__val' + (tom ? ' kpi__val--' + tom : '') + '">' + valor + '</p>' +
        (nota ? '<p class="kpi__nota">' + nota + '</p>' : '') +
        '</div>';
    };

    return '<div class="kpis kpis--4">' +
      cartao('Manutenções abertas', abertas.length,
        abertas.length
          ? 'Agendadas, em andamento ou bloqueadas'
          : 'Nenhum serviço em aberto na frota') +
      cartao('Veículos fora de circulação', parados,
        parados
          ? 'Não podem ser reservados enquanto o serviço não fechar'
          : 'Toda a frota operacional está liberada',
        parados ? 'bad' : '') +
      cartao('Agendadas', agendadas.length,
        'O carro segue disponível até entrar na oficina') +
      cartao('Previsão vencida', atrasadas.length,
        atrasadas.length
          ? 'Passou da data prevista e o serviço não fechou'
          : 'Nenhuma previsão estourou',
        atrasadas.length ? 'bad' : '') +
    '</div>';
  };

  /* ==========================================================
     3 · OS QUATRO ALERTAS DO PEDIDO (§22)
     ----------------------------------------------------------
     Revisão próxima, Óleo, Pneus, Documentação. O alerta é o
     MOTIVO do serviço, e cada um tem a sua contagem: é assim
     que a locadora enxerga que tem três carros pedindo óleo e
     decide comprar em lote.
     ========================================================== */
  var htmlAlertas = function () {
    return '<div class="atalhos u-mb">' + ALERTAS.map(function (a) {
      var lista = D.MANUTENCOES.filter(function (m) { return m.alerta === a; });
      var abertas = lista.filter(function (m) { return m.status !== 'concluida'; });
      var concluidas = lista.length - abertas.length;
      var doc = a === 'Documentação';

      return '<a class="atalho" href="#/manutencoes?f=' + encodeURIComponent(a) + '" ' +
        'data-acao="filtrar" data-f="' + esc(a) + '">' +
        (doc ? ICO_DOC : ICO_ALERTA) +
        '<b>' + esc(a) + '</b>' +
        '<span>' +
          (abertas.length
            ? abertas.length + (abertas.length === 1 ? ' serviço em aberto' : ' serviços em aberto')
            : 'Nada em aberto') +
          (concluidas
            ? ' · ' + concluidas + ' já ' + (concluidas === 1 ? 'concluído' : 'concluídos')
            : '') +
        '</span>' +
        '</a>';
    }).join('') + '</div>';
  };

  /* ==========================================================
     4 · LISTA NO FORMATO `.man`
     ----------------------------------------------------------
     O CSS já define a linha como `alerta | conteúdo | ação`, e
     a linha de conteúdo é onde mora o veículo — porque a
     pergunta é sempre sobre um carro específico.
     ========================================================== */
  var ABAS = [
    { id: 'todas',      rotulo: 'Todas',      teste: function () { return true; } },
    { id: 'agendada',   rotulo: 'Agendadas',  teste: function (m) { return m.status === 'agendada'; } },
    { id: 'andamento',  rotulo: 'Em andamento', teste: function (m) { return m.status === 'andamento'; } },
    { id: 'bloqueada',  rotulo: 'Bloqueadas', teste: function (m) { return m.status === 'bloqueada'; } },
    { id: 'concluida',  rotulo: 'Concluídas', teste: function (m) { return m.status === 'concluida'; } }
  ];

  var filtroDe = function (id) {
    for (var i = 0; i < ABAS.length; i++) if (ABAS[i].id === id) return ABAS[i];
    return ABAS[0];
  };

  var BUSCA = params.q ? String(params.q) : '';
  var ALERTA = params.f && ALERTAS.indexOf(params.f) !== -1 ? params.f : '';

  var normalizar = function (v) {
    var t = String(v === null || v === undefined ? '' : v).toLowerCase();
    return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
  };

  var alvosDe = function (m) {
    var v = S.veiculo(m.veiculoId);
    return [m.descricao, m.alerta, m.tipo, m.oficina,
            v ? v.modelo : '', v ? v.placa : '',
            D.STATUS_MANUTENCAO[m.status] ? D.STATUS_MANUTENCAO[m.status].rotulo : m.status]
      .filter(Boolean);
  };

  var combinaBusca = function (m, termo) {
    var termos = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!termos.length) return true;
    var texto = alvosDe(m).map(normalizar).join(' ');
    return termos.every(function (t) { return texto.indexOf(t) !== -1; });
  };

  var ordenar = function (lista) {
    var peso = { andamento: 0, bloqueada: 1, agendada: 2, concluida: 3 };
    return lista.slice().sort(function (a, b) {
      var pa = peso[a.status] === undefined ? 9 : peso[a.status];
      var pb = peso[b.status] === undefined ? 9 : peso[b.status];
      if (pa !== pb) return pa - pb;
      /* Dentro do mesmo estado, a previsão mais próxima primeiro.
         Sem previsão vai para o fim: não há prazo correndo. */
      if (!a.previsao) return 1;
      if (!b.previsao) return -1;
      return D.diffDias(a.previsao, b.previsao);
    });
  };

  var filtrar = function (filtro) {
    return ordenar(D.MANUTENCOES.filter(function (m) {
      if (!filtro.teste(m)) return false;
      if (ALERTA && m.alerta !== ALERTA) return false;
      return combinaBusca(m, BUSCA);
    }));
  };

  var contar = function (filtro) {
    return D.MANUTENCOES.filter(function (m) {
      return filtro.teste(m) && (!ALERTA || m.alerta === ALERTA);
    }).length;
  };

  var htmlAbas = function (filtro) {
    return '<div class="tabs" role="tablist">' + ABAS.map(function (a) {
      return '<button class="tabs__b" type="button" role="tab" data-acao="filtrar" data-f="' + a.id + '"' +
             (a.id === filtro.id ? ' aria-selected="true"' : '') + '>' +
             esc(a.rotulo) + '<span class="tabs__n">' + contar(a) + '</span></button>';
    }).join('') + '</div>';
  };

  var textoPrazo = function (m) {
    if (m.status === 'concluida') {
      return 'Concluída em ' + D.fmtData(m.conclusao || m.previsao);
    }
    if (!m.previsao) return 'Sem previsão definida';

    var d = D.diffDias(m.previsao, D.HOJE);
    if (d > 0) {
      return 'Previsão vencida há ' + d + (d === 1 ? ' dia' : ' dias') +
             ' — era ' + D.fmtData(m.previsao);
    }
    if (d === 0) return 'Previsão é hoje — ' + D.fmtData(m.previsao);
    return 'Prevista para ' + D.fmtData(m.previsao) +
           ' (em ' + Math.abs(d) + (Math.abs(d) === 1 ? ' dia)' : ' dias)');
  };

  /* A LINHA INTEIRA É O BOTÃO, E O "ABRIR" É SÓ A APARÊNCIA DELE.
     A versão anterior punha um `<a>` de verdade dentro de um `<div
     role="button">` — dois alvos interativos aninhados, que num
     leitor de tela viram dois controles para a mesma ação e no
     teclado dão duas paradas de tabulação. Aqui o `<span>` veste o
     `.ab` sem ser clicável por conta própria; quem recebe o clique
     e o Enter é a linha, que já tem `data-acao`, `role` e
     `tabindex`. */
  var linhaMan = function (m) {
    var v = S.veiculo(m.veiculoId);
    var efeito = paraOCarro(m);
    var vencida = m.status !== 'concluida' && m.previsao && D.diffDias(m.previsao, D.HOJE) > 0;
    var doc = m.alerta === 'Documentação';

    return '<div class="man man--' + (doc ? 'documentacao' : 'preventiva') + '" ' +
      'data-acao="abrir" data-id="' + m.id + '" ' +
      'role="link" tabindex="0" title="Abrir a manutenção: ' + esc(m.descricao) + '">' +
      '<span class="man__alerta">' + esc(m.alerta || m.tipo) + '</span>' +
      '<div class="man__t">' +
        '<b>' + esc(m.descricao) + '</b>' +
        '<span>' +
          (v
            ? '<span class="mono">' + esc(v.placa) + '</span> · ' + esc(v.modelo)
            : '<span class="falta">veículo não encontrado</span>') +
          (m.km === null || m.km === undefined
            ? ''
            : ' · ' + Number(m.km).toLocaleString('pt-BR') + ' km') +
          ' · ' + esc(textoPrazo(m)) +
        '</span>' +
        '<span>' + esc(efeito.texto) + '</span>' +
      '</div>' +
      '<div class="tbl__acts">' +
        (vencida ? U.etiqueta('Vencida', 'bad') : '') +
        '<span class="ab' + (m.status === 'concluida' ? '' : ' ab--pri') + '">Abrir</span>' +
      '</div>' +
    '</div>';
  };

  var htmlVazio = function () {
    if (BUSCA) {
      return U.vazio('Nenhuma manutenção encontrada',
        'Nenhum serviço casa com “' + BUSCA + '”. A busca olha descrição, alerta, tipo, ' +
        'oficina, modelo, placa e situação.',
        U.botao('Limpar busca', 'limpar', 'out'));
    }
    if (ALERTA) {
      return U.vazio('Nada com o alerta ' + ALERTA,
        'Nenhum serviço com este alerta está nesta situação.',
        U.botao('Ver todas as manutenções', 'limpar-alerta', 'out'));
    }
    return U.vazio('Nenhuma manutenção nesta situação',
      'Troque de aba para ver as outras situações da frota.');
  };

  var htmlLista = function (filtro, lista) {
    return '<div class="filtros">' +
      '  <div class="tabs" role="tablist" aria-label="Filtrar manutenções por situação">' +
           htmlAbas(filtro) +
      '  </div>' +
      '  <div class="filtros__dir">' +
      '    <span class="filtros__n"><b data-slot="n">' + lista.length + '</b> ' +
             (lista.length === 1 ? 'serviço' : 'serviços') + '</span>' +
      '    <div class="busca">' +
      '      <svg class="busca__ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '      <input class="busca__inp" type="search" data-busca="1" ' +
             'value="' + esc(BUSCA) + '" ' +
             'placeholder="Descrição, placa, modelo, oficina ou alerta" ' +
             'aria-label="Buscar manutenção por descrição, placa, modelo, oficina ou alerta" />' +
      '    </div>' +
           (BUSCA ? '<button class="ab" type="button" data-acao="limpar">Limpar</button>' : '') +
      '  </div>' +
      '</div>' +
      (ALERTA
        ? '<div class="aviso aviso--neutro u-mb">' + ICO_NOTA +
          '<span>Mostrando só os serviços com o alerta <b>' + esc(ALERTA) + '</b>. ' +
          '<a class="ab" href="#/manutencoes" data-acao="limpar-alerta">Ver todas</a></span>' +
          '</div>'
        : '') +
      '<div class="card" data-slot="lista">' +
        (lista.length ? lista.map(linhaMan).join('') : htmlVazio()) +
      '</div>';
  };

  /* ==========================================================
     5 · FICHA
     ========================================================== */
  var ICO = {
    dados:   'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3 4-5 8-5s8 2 8 5',
    frota:   'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
    servico: 'M14.7 6.3a4 4 0 0 1 5 5L10 21H5v-5z',
    veiculo: 'M4 16h16M5 16V11l2-5h10l2 5v5M7.5 19h.01M16.5 19h.01'
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

  /* A PENDÊNCIA DE DADOS É A REGRA DO §24 NESTA TELA.
     "Não invente valores" vale também para o custo do serviço: o
     `null` não vira zero, ele vira uma frase que diz o que falta
     e por que aquilo ainda não entra em conta nenhuma. */
  var pendencia = function (m) {
    var falta = [];
    if (!m.oficina) falta.push('oficina');
    if (m.custo === null || m.custo === undefined) falta.push('custo');
    if (!m.previsao && m.status !== 'concluida') falta.push('previsão de conclusão');
    if (!falta.length) return '';

    return '<div class="aviso aviso--neutro u-mt">' + ICO_NOTA + '<span>' +
      (falta.length === 1 ? 'Falta registrar <b>' : 'Faltam registrar <b>') +
      esc(falta.join(', ')) + '</b>. ' +
      (m.custo === null || m.custo === undefined
        ? 'O custo não entra em conta nenhuma enquanto não for lançado pela oficina — um valor ' +
          'estimado aqui viraria número inventado no financeiro.'
        : '') +
      '</span></div>';
  };

  var blocoServico = function (m) {
    var v = S.veiculo(m.veiculoId);

    return bloco('dados', 'O serviço', corpo(
      ficha([
        ['Descrição', esc(m.descricao)],
        ['Tipo', esc(m.tipo)],
        ['Alerta', '<span class="man__alerta">' + esc(m.alerta) + '</span>'],
        ['Situação', U.crachaManutencao(m)],
        ['Veículo', v
          ? '<a class="ab" href="#/frota/' + v.id + '" data-acao="ir" ' +
            'data-para="#/frota/' + v.id + '">' + esc(v.modelo) + '</a> ' +
            '<span class="mono">' + esc(v.placa) + '</span>'
          : '<span class="falta">veículo não encontrado</span>'],
        ['Quilometragem', m.km === null || m.km === undefined
          ? '<span class="falta">a informar</span>'
          : '<span class="u-tab">' + Number(m.km).toLocaleString('pt-BR') + ' km</span>'],
        ['Entrada na oficina', m.entrada
          ? esc(D.fmtData(m.entrada))
          : '<span class="u-t4">ainda não entrou — serviço agendado</span>'],
        ['Previsão de conclusão', m.previsao
          ? esc(D.fmtData(m.previsao)) +
            (m.status !== 'concluida' && D.diffDias(m.previsao, D.HOJE) > 0
              ? ' ' + U.etiqueta('Vencida', 'bad') : '')
          : '<span class="falta">a definir</span>'],
        ['Conclusão', m.conclusao
          ? esc(D.fmtData(m.conclusao))
          : '<span class="u-t4">serviço em aberto</span>'],
        ['Oficina', m.oficina ? esc(m.oficina) : '<span class="falta">a definir</span>'],
        ['Custo', m.custo === null || m.custo === undefined
          ? '<span class="falta">a definir</span>'
          : '<span class="u-tab">' + D.fmtBRL(m.custo) + '</span>']
      ]) +
      pendencia(m)
    ));
  };

  var blocoEfeito = function (m) {
    var efeito = paraOCarro(m);
    var v = S.veiculo(m.veiculoId);
    var ruim = efeito.tom === 'bad';

    /* A faixa vermelha de `.aviso` (sem modificador) é a mesma das
       pendências do sistema: aqui ela significa o que o operador
       teme — carro parado. Quando o serviço não para o carro, a
       faixa verde confirma isso, porque "continua circulando"
       também é uma resposta que se quer ver escrita. */
    var faixa = ruim
      ? '<div class="aviso">' + ICO_NOTA + '<span><b>' + esc(efeito.rotulo) + '.</b> ' +
        esc(efeito.texto) + '</span></div>'
      : '<div class="aviso aviso--ok">' + ICO_OK + '<span><b>' + esc(efeito.rotulo) + '.</b> ' +
        esc(efeito.texto) + '</span></div>';

    return bloco('frota', 'O que isto faz com o veículo', corpo(
      faixa +
      '<p class="u-xs u-t4 u-mt">O estado do veículo é DEDUZIDO da operação, não do campo ' +
      'gravado à mão: enquanto o serviço está em andamento ou bloqueado, o carro sai da fila ' +
      'de disponíveis. Fechar o serviço o devolve para a frota — desde que ele não esteja ' +
      'indisponível por outro motivo, porque um carro parado por documentação não volta a ' +
      'circular só porque o mecânico terminou.</p>' +
      (v ? '<p class="u-sm u-mt">Situação do veículo agora: ' + U.crachaVeiculo(v) + '</p>'
         : '<p class="u-sm u-mt"><span class="falta">Veículo não encontrado na base.</span></p>')
    ));
  };

  /* Interesses cruzados entre manutenção e agenda.
     Um serviço agendado sobre um período já reservado é a mesma
     confusão de dois clientes para um carro, e é o que o
     calendário acusa como choque. A ficha traz o choque para
     perto de quem está decidindo a data do serviço. */
  var blocoChoque = function (m) {
    var meus = D.conflitos().filter(function (c) {
      var meu = function (x) { return x.tipo === 'manutencao' && x.id === m.id; };
      return meu(c.a) || meu(c.b);
    });
    if (!meus.length) return '';

    var v = S.veiculo(m.veiculoId);

    return bloco('veiculo', 'Choque de agenda', corpo(
      meus.map(function (c) {
        var meu = function (x) { return x.tipo === 'manutencao' && x.id === m.id; };
        var outro = meu(c.a) ? c.b : c.a;
        var oQue = outro.tipo === 'reserva' ? 'Reserva'
                 : (outro.tipo === 'locacao' ? 'Locação' : 'Veículo fora de circulação');
        var rota = outro.tipo === 'reserva' ? '#/reservas/' + outro.id
                 : (outro.tipo === 'locacao' ? '#/locacoes/' + outro.id
                 : '#/frota/' + c.veiculoId);

        return '<div class="aviso u-mb">' + ICO_NOTA + '<span>' +
          'Este serviço cruza <b>' + esc(oQue) + ' ' + esc(outro.codigo) + '</b>' +
          ' (' + esc(D.fmtData(outro.de)) + ' a ' + esc(D.fmtData(outro.ate)) + ')' +
          (v ? ' em <span class="mono">' + esc(v.placa) + '</span>' : '') + '. ' +
          '<a class="ab" href="' + rota + '" data-acao="ir" data-para="' + rota + '">' +
          'Ver o compromisso</a></span></div>';
      }).join('') +
      '<p class="u-xs u-t4">O mesmo cálculo desenha o calendário da frota. Enquanto as duas ' +
      'telas não disserem a mesma coisa, uma delas está mentindo.</p>'
    ), meus.length + (meus.length === 1 ? ' cruzamento' : ' cruzamentos'));
  };

  var PROXIMA = {
    agendada:  'Dar entrada na oficina',
    andamento: 'Concluir o serviço',
    bloqueada: 'Regularizar e liberar',
    concluida: 'Serviço fechado'
  };

  /* ==========================================================
     6 · AÇÕES
     ----------------------------------------------------------
     Qual transição faz sentido de cada estado é uma decisão de
     operação, e ela fica escrita aqui em vez de espalhada em
     botões. `concluida` é terminal: um serviço fechado não
     reabre — se o problema voltou, é um serviço novo, com data
     nova, e é assim que o histórico conta a verdade.
     ========================================================== */
  var acoesDe = function (m) {
    var concluida = m.status === 'concluida';
    var motivoFechada = 'O serviço já foi concluído e liberou o veículo. Reabrir apagaria a ' +
      'data em que o carro voltou a circular — se o problema voltou, abra uma manutenção nova.';

    return [
      {
        id: 'editar', rotulo: 'Atualizar serviço', tom: concluida ? 'out' : 'pri',
        liberada: !concluida,
        motivo: concluida ? motivoFechada : ''
      },
      {
        id: 'ir-veiculo', rotulo: 'Abrir a ficha do veículo', tom: 'out',
        liberada: Boolean(S.veiculo(m.veiculoId)),
        motivo: S.veiculo(m.veiculoId) ? '' : 'O veículo desta manutenção não está na base.'
      },
      {
        id: 'imprimir', rotulo: 'Imprimir a ordem', tom: 'out', liberada: true,
        motivo: 'Disponível em qualquer situação: é a folha que vai para a oficina.'
      }
    ];
  };

  var htmlAcoes = function (m) {
    return acoesDe(m).map(function (a) {
      return U.botao(a.rotulo, a.id, a.tom, { id: m.id }, !a.liberada, a.motivo);
    }).join('');
  };

  /* O histórico do carro fica na ficha do serviço porque é a
     pergunta seguinte: "esse carro vive na oficina?" */
  var blocoHistorico = function (m) {
    var lista = D.MANUTENCOES.filter(function (x) { return x.veiculoId === m.veiculoId; });
    if (lista.length < 2) return '';

    var ordenada = lista.slice().sort(function (a, b) {
      var da = a.conclusao || a.previsao || a.entrada || D.HOJE;
      var db = b.conclusao || b.previsao || b.entrada || D.HOJE;
      return D.diffDias(da, db);
    });

    return bloco('servico', 'Histórico deste veículo', corpo(
      ordenada.map(function (x) {
        var atual = x.id === m.id;
        var data = x.conclusao || x.previsao || x.entrada || D.HOJE;

        /* A LINHA INTEIRA É O BOTÃO, E O "ABRIR" É SÓ A
           APARÊNCIA DELE. A versão anterior punha um `<a>` de
           verdade dentro de um `<div role="button">` — dois alvos
           interativos aninhados, que num leitor de tela viram dois
           controles para a mesma ação e no teclado dão duas paradas
           de tabulação. Aqui o `<span>` veste o `.ab` sem ser
           clicável por conta própria; quem recebe o clique é a
           linha, que já tem `data-acao`, `role` e `tabindex`.

           E a linha da manutenção que o operador já está olhando
           NÃO vira link para ela mesma: um atalho que leva ao lugar
           onde a pessoa está é um botão morto disfarçado. Ela
           aparece como texto e diz "esta manutenção". */
        return '<div class="man man--' +
          (x.alerta === 'Documentação' ? 'documentacao' : 'preventiva') + '"' +
          (atual ? '' : ' data-acao="abrir" data-id="' + x.id + '"' +
                        ' role="link" tabindex="0" title="Abrir: ' + esc(x.descricao) + '"') + '>' +
          '<span class="man__alerta">' + esc(x.alerta) + '</span>' +
          '<div class="man__t">' +
            '<b>' + esc(x.descricao) + '</b>' +
            '<span>' + esc(D.fmtData(data)) + ' · ' +
              esc(D.acharStatus(D.STATUS_MANUTENCAO, x.status).rotulo) +
              (atual ? ' · esta manutenção' : '') + '</span>' +
          '</div>' +
          '<div class="tbl__acts">' +
            (atual ? '<span class="u-xs u-t4">aberta agora</span>'
                   : '<span class="ab">Abrir</span>') +
          '</div>' +
        '</div>';
      }).join('')
    ), lista.length + ' no total');
  };

  var htmlFicha = function (m) {
    var v = S.veiculo(m.veiculoId);
    var st = D.acharStatus(D.STATUS_MANUTENCAO, m.status);

    return U.pageHead(m.alerta,
      (v ? v.modelo + ' · ' + v.placa : 'veículo não encontrado') + ' · ' + st.rotulo +
      ' · ' + PROXIMA[m.status],
      U.botao('Voltar para a lista', 'voltar', 'out')) +
      '<div class="acts u-mb">' + htmlAcoes(m) + '</div>' +
      '<div class="grid2">' +
        blocoServico(m) +
        blocoEfeito(m) +
      '</div>' +
      blocoChoque(m) +
      blocoHistorico(m);
  };

  /* ==========================================================
     7 · ATUALIZAR O SERVIÇO
     ========================================================== */
  var abrirEditar = function (m) {
    var v = S.veiculo(m.veiculoId);

    U.abrirModal({
      titulo: 'Atualizar o serviço',
      sub: (v ? v.modelo + ' · ' + v.placa + ' · ' : '') + m.descricao,
      largo: true,
      corpo:
        '<div class="grid2">' +
          U.fldSel('Alerta (o motivo do serviço)', 'alerta', ALERTAS.map(function (a) {
            return { valor: a, rotulo: a };
          }), m.alerta) +
          U.fldSel('Situação', 'status', [
            { valor: 'agendada',  rotulo: 'Agendada — o carro continua circulando' },
            { valor: 'andamento', rotulo: 'Em andamento — o carro sai de circulação' },
            { valor: 'bloqueada', rotulo: 'Bloqueada — fora de circulação' },
            { valor: 'concluida', rotulo: 'Concluída — libera o veículo' }
          ], m.status) +
        '</div>' +
        '<div class="grid2 u-mt">' +
          U.fld('Oficina', 'text', 'oficina', m.oficina, 'Nome da oficina') +
          U.fld('Previsão de conclusão', 'date', 'previsao', m.previsao || '') +
        '</div>' +
        '<div class="grid2 u-mt">' +
          U.fld('Custo (R$)', 'number', 'custo',
            m.custo === null || m.custo === undefined ? '' : m.custo,
            'Deixe vazio enquanto a oficina não passar o valor') +
        '</div>' +
        '<p class="u-xs u-t4 u-mt">O custo vazio NÃO vira zero: fica como valor a definir e não ' +
        'entra em conta nenhuma. A despesa de manutenção é um lançamento próprio no financeiro, ' +
        'que também espera o valor real da oficina.</p>' +
        U.fldTxt('Descrição do serviço', 'descricao', m.descricao, 'O que vai ser feito'),
      botoes: [
        { rotulo: 'Cancelar', tom: 'out', acao: 'x' },
        { rotulo: 'Salvar', tom: 'pri', acao: 'salvar' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao === 'x') return fechar();
        if (acao !== 'salvar') return;

        var c = U.lerCampos();
        var custo = (c.custo === '' || c.custo === undefined || c.custo === null)
          ? null : Number(c.custo);

        if (custo !== null && (isNaN(custo) || custo < 0)) {
          U.canto('O custo precisa ser um número — ou ficar vazio enquanto a oficina não passar ' +
                  'o valor.', 'aviso');
          return;
        }

        var res = S.salvarManutencao(m.id, {
          status: c.status,
          descricao: c.descricao,
          oficina: c.oficina,
          previsao: c.previsao ? c.previsao : null,
          alerta: c.alerta,
          custo: custo
        });

        fechar();
        U.resultado(res);
        U.desenhar();
      }
    });
  };

  var imprimir = function (m) {
    var v = S.veiculo(m.veiculoId);

    U.abrirModal({
      titulo: 'Ordem de serviço',
      sub: m.alerta + (v ? ' · ' + v.modelo + ' · ' + v.placa : ''),
      corpo:
        '<dl class="ficha">' +
          '<div><dt>Serviço</dt><dd>' + esc(m.descricao) + '</dd></div>' +
          '<div><dt>Veículo</dt><dd>' + (v
            ? esc(v.modelo) + ' · <span class="mono">' + esc(v.placa) + '</span>'
            : '<span class="falta">veículo não encontrado</span>') + '</dd></div>' +
          '<div><dt>Quilometragem</dt><dd>' + (m.km === null || m.km === undefined
            ? '<span class="falta">a informar</span>'
            : '<span class="u-tab">' + Number(m.km).toLocaleString('pt-BR') + ' km</span>') +
            '</dd></div>' +
          '<div><dt>Previsão</dt><dd>' + (m.previsao
            ? esc(D.fmtData(m.previsao)) : '<span class="falta">a definir</span>') + '</dd></div>' +
          '<div><dt>Oficina</dt><dd>' + (m.oficina
            ? esc(m.oficina) : '<span class="falta">a definir</span>') + '</dd></div>' +
        '</dl>' +
        '<p class="u-xs u-t4 u-mt">A folha sai pela impressão do navegador, em papel limpo: sem ' +
        'menu, sem barra lateral e sem botões. Se a janela não abrir sozinha, use <b>Ctrl+P</b>.</p>',
      botoes: [
        { rotulo: 'Fechar', tom: 'out', acao: 'x' },
        { rotulo: 'Abrir a impressão', tom: 'pri', acao: 'imprimir' }
      ],
      aoClicar: function (acao, bt, fechar) {
        if (acao !== 'imprimir') return fechar();
        fechar();
        if (window.print) window.print();
        else U.canto('A impressão é do navegador: ' + 'disponível após integração do backend.',
                     'aviso');
      }
    });
  };

  /* ==========================================================
     8 · A TELA
     ========================================================== */
  /* Quando o recorte é por ALERTA (`?f=Óleo`), as abas não valem:
     `params.f` guarda o alerta, não a situação. Um só parâmetro
     serve aos dois porque os vocabulários não se cruzam — nenhum
     id de aba se chama "Óleo". Se precisassem de dois parâmetros,
     trocar de aba perderia o recorte de alerta, ou o contrário.

     Fica DEFINIDA antes de `htmlTela` porque é ela que a tela
     chama para saber qual aba marcar. Uma função atribuída a uma
     variável só existe depois da linha que a atribui: declarada
     abaixo, `htmlTela` a encontraria como `undefined` no primeiro
     desenho — e a tela morreria na primeira abertura. */
  var parametroAba = function () {
    for (var i = 0; i < ABAS.length; i++) {
      if (ABAS[i].id === params.f) return params.f;
    }
    return 'todas';
  };

  var htmlTela = function () {
    if (ctx && ctx.alvo) {
      var m = S.manutencao(ctx.alvo);
      if (!m) {
        return U.pageHead('Manutenção não encontrada',
          'O identificador que veio no endereço não existe na base.',
          U.botao('Voltar para a lista', 'voltar', 'out')) +
          '<div class="card">' + U.vazio('Manutenção não encontrada',
            'A manutenção ' + ctx.alvo + ' não está na base.',
            U.botao('Ver todas as manutenções', 'voltar', 'out')) + '</div>';
      }
      return htmlFicha(m);
    }

    var filtro = filtroDe(parametroAba());
    var lista = filtrar(filtro);

    return U.pageHead('Manutenções',
      '<b>' + D.MANUTENCOES.length + '</b> serviços registrados · <b>' + veiculosParados() +
      '</b> veículos fora de circulação. O alerta diz o motivo do serviço — Revisão próxima, ' +
      'Óleo, Pneus ou Documentação. Serviço em andamento ou bloqueado tira o carro de ' +
      'circulação; agendado, não.',
      U.botao('Nova manutenção', 'nova', 'pri')) +
      htmlCards() +
      htmlAlertas() +
      htmlLista(filtro, lista);
  };

  cx.innerHTML = htmlTela();

  /* A busca NÃO redesenha a tela.

     Redesenhar devolveria o foco ao começo do campo a cada tecla
     digitada, e a busca ficaria impossível de usar. Por isso só
     o slot da lista e o contador são trocados aqui — os dois
     moram fora um do outro e por isso são atualizados à mão. */
  var refazerBusca = function () {
    var slot = cx.querySelector('[data-slot="lista"]');
    var cont = cx.querySelector('[data-slot="n"]');
    if (!slot) return;

    var lista = filtrar(filtroDe(parametroAba()));
    slot.innerHTML = lista.length ? lista.map(linhaMan).join('') : htmlVazio();
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

    /* Link sem `data-acao` também navega.

       O item de pendência, o atalho de alerta e o link da ficha
       são âncoras: uma âncora clicada não passa por `case`
       nenhum. Sem este trecho, clicar neles não faria nada — e o
       `href` existe, então o operador veria o endereço mudar no
       navegador sem a tela responder. */
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

    var acao = alvo.getAttribute('data-acao');
    var id = alvo.getAttribute('data-id');

    /* A manutenção vem do botão ou do endereço. Os três botões da
       ficha mandam o id no `data-id`, então `m` resolve sempre —
       mas quando a ação parte da ficha aberta sem id (improvável,
       e por isso o desvio existe) o `ctx.alvo` é o mesmo dado. */
    var m = id ? S.manutencao(id) : (ctx && ctx.alvo ? S.manutencao(ctx.alvo) : null);

    if (alvo.getAttribute('aria-disabled') === 'true') {
      U.canto(alvo.getAttribute('title') || 'Esta ação não está disponível agora.', 'aviso');
      return;
    }

    switch (acao) {
      case 'filtrar': {
        var f = alvo.getAttribute('data-f');
        /* Os atalhos dos alertas e as abas compartilham a mesma
           rota porque `params.f` aceita os dois vocabulários:
           nenhum id de aba se chama "Óleo". */
        U.navegar('#/manutencoes' + (!f || f === 'todas' ? '' : '?f=' + encodeURIComponent(f)));
        return;
      }

      case 'limpar':
        BUSCA = '';
        U.desenhar();
        return;

      case 'limpar-alerta':
      case 'voltar':
        U.navegar('#/manutencoes');
        return;

      case 'abrir': {
        if (id) U.navegar('#/manutencoes/' + id);
        return;
      }

      case 'ir': {
        var para = alvo.getAttribute('data-para') || alvo.getAttribute('href');
        if (para) U.navegar(para);
        return;
      }

      case 'editar': {
        if (!m) { U.canto('Esta manutenção não está mais na base.', 'aviso'); return; }
        abrirEditar(m);
        return;
      }

      case 'imprimir': {
        if (!m) { U.canto('Esta manutenção não está mais na base.', 'aviso'); return; }
        imprimir(m);
        return;
      }

      case 'ir-veiculo': {
        if (!m || !m.veiculoId) {
          U.canto('O veículo desta manutenção não está na base.', 'aviso');
          return;
        }
        U.navegar('#/frota/' + m.veiculoId);
        return;
      }

      case 'nova': {
        /* Mesma razão da vistoria: uma manutenção sem veículo não
           tem dono. Em vez de um formulário solto, a tela diz onde
           ela nasce — na ficha do carro, que é onde estão a
           quilometragem e o histórico de serviços. */
        U.abrirModal({
          titulo: 'Onde nasce uma manutenção',
          sub: 'Todo serviço é de um veículo — e é a ficha dele que tem a quilometragem.',
          corpo:
            '<p class="u-sm">A ficha do veículo mostra o histórico de serviços, a quilometragem ' +
            'atual e se o carro está em circulação. É de lá que se programa o serviço, e é o ' +
            'veículo que passa a aparecer como “em manutenção” na frota e no calendário.</p>' +
            '<p class="u-xs u-t4 u-mt-lg">Abra <b>Frota</b>, escolha o carro e use ' +
            '<b>Programar manutenção</b>.</p>',
          botoes: [
            { rotulo: 'Fechar', tom: 'out', acao: 'x' },
            { rotulo: 'Abrir a frota', tom: 'pri', acao: 'ir-frota' }
          ],
          aoClicar: function (a, bt, fechar) {
            fechar();
            if (a === 'ir-frota') U.navegar('#/frota');
          }
        });
        return;
      }

      default:
        U.canto('Disponível após integração do backend.', 'aviso');
    }
  });
};
