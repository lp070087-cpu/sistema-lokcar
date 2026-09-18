/* ============================================================
   LOK CAR — SISTEMA · sessao.js
   ------------------------------------------------------------
   O que muda durante o uso, e onde isso fica guardado.

   DUAS COISAS DIFERENTES MORAM AQUI:

   1) O ESTADO DA OPERAÇÃO (reservas, contratos, vistorias,
      locações, financeiro). Ele vive só na memória da aba. Ao
      recarregar a página, tudo volta ao estado original de
      `dados.js`. Isso é de propósito: sem banco de dados, um
      sistema que "lembrasse" as alterações daria a impressão de
      estar salvando em algum lugar — e não está.

   2) AS CONFIGURAÇÕES (Empresa e Regras do contrato). Estas SIM
      são gravadas no `localStorage`, e só estas. São dados que
      alguém digita à mão e não pode perder ao recarregar: se a
      razão social sumisse ao apertar F5, ninguém preencheria o
      formulário duas vezes.

   Nada aqui autentica ninguém. Não existe login nesta fase e a
   tela diz isso em vez de fingir uma sessão.
   ============================================================ */

window.LOKCAR_SESSAO = (function () {
  'use strict';

  var D = window.LOKCAR_DADOS;

  var CHAVE_EMPRESA = 'lokcar-sistema-empresa';
  var CHAVE_REGRAS = 'lokcar-sistema-regras';
  var CHAVE_PREF = 'lokcar-sistema-prefs';

  /* ----------------------------------------------------------
     Armazenamento tolerante a falha.

     `localStorage` pode estar bloqueado (navegação privativa,
     política do navegador, cota cheia). Sem este `try`, uma
     exceção aqui derrubaria a tela inteira. Quando ele falha, o
     sistema continua funcionando na memória da aba — só não
     sobrevive ao recarregamento, e o aviso de canto diz isso.
     ---------------------------------------------------------- */
  var disponivel = (function () {
    try {
      var k = '__lokcar_teste__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  var ler = function (chave) {
    if (!disponivel) return null;
    try {
      var cru = window.localStorage.getItem(chave);
      if (!cru) return null;
      var dado = JSON.parse(cru);
      return (dado && typeof dado === 'object') ? dado : null;
    } catch (e) {
      return null;
    }
  };

  var gravar = function (chave, valor) {
    if (!disponivel) return false;
    try {
      window.localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  };

  var apagar = function (chave) {
    if (!disponivel) return;
    try { window.localStorage.removeItem(chave); } catch (e) { /* nada a fazer */ }
  };

  /* ==========================================================
     1 · CÓPIA DE TRABALHO DA OPERAÇÃO
     ----------------------------------------------------------
     `dados.js` é somente leitura: ele é a semente. Aqui as
     tabelas viram arrays clonados, que a interface pode alterar.
     Clonar com `JSON.parse(JSON.stringify())` impede que uma
     alteração numa tela mexa no objeto original — o botão
     "restaurar demonstração" volta a apontar para a semente.
     ========================================================== */
  var clonar = function (v) { return JSON.parse(JSON.stringify(v)); };

  /* A fotografia do estado ORIGINAL. É tirada agora, antes de
     qualquer alteração, e é ela que o botão "restaurar
     demonstração" usa para voltar tudo ao começo. */
  var SEMENTE = clonar({
    reservas: D.RESERVAS,
    locacoes: D.LOCACOES,
    contratos: D.CONTRATOS,
    vistorias: D.VISTORIAS,
    manutencoes: D.MANUTENCOES,
    ocorrencias: D.OCORRENCIAS,
    documentos: D.DOCUMENTOS,
    lancamentos: D.LANCAMENTOS,
    clientes: D.CLIENTES,
    veiculos: D.VEICULOS,
    extensoes: D.EXTENSOES
  });

  /* AS LISTAS DE TRABALHO SÃO AS MESMAS QUE `LOKCAR_DADOS` EXPOE.
     ------------------------------------------------------------
     Isto é deliberado, e é o que evita a pior classe de bug
     possível neste sistema: uma alteração feita na tela aparecer
     numa lista e não aparecer no cartão do painel.

     `dados.js` calcula tudo (contagem de frota, resumo de
     reservas, financeiro, pendências) a partir desses arrays. Se
     a cópia de trabalho fosse um clone separado, marcar um
     pagamento atualizaria a tabela do financeiro e deixaria o
     cartão "recebido no mês" com o número antigo — e não haveria
     como saber qual dos dois está certo.

     Como as funções de `dados.js` leem ESTES arrays, qualquer
     alteração feita aqui se propaga sozinha para todos os
     números do sistema. O que a sessão guarda à parte é apenas
     a `SEMENTE`, para poder voltar atrás.
     ------------------------------------------------------------ */
  var estado = {
    reservas: D.RESERVAS,
    locacoes: D.LOCACOES,
    contratos: D.CONTRATOS,
    vistorias: D.VISTORIAS,
    manutencoes: D.MANUTENCOES,
    ocorrencias: D.OCORRENCIAS,
    documentos: D.DOCUMENTOS,
    lancamentos: D.LANCAMENTOS,
    clientes: D.CLIENTES,
    veiculos: D.VEICULOS,
    extensoes: D.EXTENSOES,
    sequencia: { reserva: 16, contrato: 9, vistoria: 8, locacao: 6, ocorrencia: 5, extensao: 2 }
  };

  /* Recarrega uma lista NO LUGAR, para continuar sendo o mesmo
     array que `dados.js` conhece. */
  var reabastecer = function (destino, fonte) {
    destino.length = 0;
    fonte.forEach(function (item) { destino.push(clonar(item)); });
  };

  /* Contadores de código. O código é gerado aqui, e não na tela,
     para não haver dois caminhos capazes de produzir o mesmo
     "R-0015". */
  var proximoCodigo = function (tipo) {
    var n = estado.sequencia[tipo];
    estado.sequencia[tipo] = n + 1;
    var prefixos = { reserva: 'R-', contrato: 'CT-', vistoria: 'VT-', locacao: 'L-', ocorrencia: 'OC-' };
    var p = prefixos[tipo] || '';
    var s = String(n);
    while (s.length < 4) s = '0' + s;
    return p + s;
  };

  /* ==========================================================
     2 · REGISTRO DE MUDANÇAS
     ----------------------------------------------------------
     As telas se inscrevem e são redibujadas quando o estado
     muda. Sem isto, confirmar uma reserva numa tela deixaria a
     lista lateral com o status antigo — o tipo de incoerência
     que faz o operador desconfiar do sistema inteiro.
     ========================================================== */
  var ouvintes = [];

  var aoMudar = function (fn) {
    ouvintes.push(fn);
  };

  var avisar = function (oQue) {
    ouvintes.forEach(function (fn) {
      try { fn(oQue); } catch (e) { /* uma tela quebrada não derruba as outras */ }
    });
  };

  /* Wrapper obrigatório: toda alteração passa por aqui, para o
     aviso nunca ser esquecido. */
  var alterar = function (oQue, fn) {
    var r = fn();
    avisar(oQue);
    return r;
  };

  /* ==========================================================
     3 · BUSCAS NO ESTADO VIVO
     ----------------------------------------------------------
     Mesmas consultas de `dados.js`, mas lendo a cópia de
     trabalho. A interface sempre usa ESTAS — ler de
     `LOKCAR_DADOS.RESERVAS` mostraria o estado antes das
     alterações.
     ========================================================== */
  var achar = function (lista, id) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  };

  var reserva = function (id) { return achar(estado.reservas, id); };
  var locacao = function (id) { return achar(estado.locacoes, id); };
  var contrato = function (id) { return achar(estado.contratos, id); };
  var vistoria = function (id) { return achar(estado.vistorias, id); };
  var manutencao = function (id) { return achar(estado.manutencoes, id); };
  var ocorrencia = function (id) { return achar(estado.ocorrencias, id); };
  var documento = function (id) { return achar(estado.documentos, id); };
  var lancamento = function (id) { return achar(estado.lancamentos, id); };
  var cliente = function (id) { return achar(estado.clientes, id); };
  var veiculo = function (id) { return achar(estado.veiculos, id); };
  var extensao = function (id) { return achar(estado.extensoes, id); };

  var contratoDaReserva = function (reservaId) {
    for (var i = 0; i < estado.contratos.length; i++) {
      if (estado.contratos[i].reserva === reservaId) return estado.contratos[i];
    }
    return null;
  };

  var locacaoDaReserva = function (reservaId) {
    for (var i = 0; i < estado.locacoes.length; i++) {
      if (estado.locacoes[i].reserva === reservaId) return estado.locacoes[i];
    }
    return null;
  };

  var vistoriasDaLocacao = function (locacaoId, tipo) {
    return estado.vistorias.filter(function (v) {
      if (v.locacao !== locacaoId && v.reserva !== locacaoId) return false;
      if (tipo && v.tipo !== tipo) return false;
      return true;
    });
  };

  var contratosDoCliente = function (clienteId) {
    return estado.contratos.filter(function (k) {
      var r = k.reserva ? reserva(k.reserva) : null;
      return r && r.clienteId === clienteId;
    });
  };

  var reservasDoCliente = function (clienteId) {
    return estado.reservas.filter(function (r) { return r.clienteId === clienteId; });
  };

  var locacoesDoCliente = function (clienteId) {
    return estado.locacoes.filter(function (l) { return l.clienteId === clienteId; });
  };

  var historicoDoCliente = function (clienteId) {
    var movs = [];
    reservasDoCliente(clienteId).forEach(function (r) {
      movs.push({ tipo: 'reserva', data: r.de, item: r });
    });
    locacoesDoCliente(clienteId).forEach(function (l) {
      movs.push({ tipo: 'locacao', data: l.inicio, item: l });
    });
    return movs.sort(function (a, b) { return D.diffDias(a.data, b.data) * -1; });
  };

  /* ==========================================================
     4 · TRANSIÇÕES DE ESTADO
     ----------------------------------------------------------
     Toda ação do operador passa por uma função daqui. A regra é
     simples e é o que o pedido chamou de "não permita ações
     incompatíveis com o status atual": a lista de transições
     permitidas fica escrita em um lugar só, e a interface lê
     essa lista para decidir quais botões desenhar.

     Escrever a regra aqui, em vez de esconder botões no HTML, é
     o que garante que a mesma trava valha para o clique, para o
     teclado e para o futuro atalho de teclado.
     ========================================================== */
  var TRANSICOES_RESERVA = {
    /* de onde         -> para onde o operador pode levar */
    nova:       ['aguardando', 'confirmada', 'cancelada'],
    aguardando: ['confirmada', 'cancelada'],
    confirmada: ['contrato', 'pronta', 'cancelada'],
    contrato:   ['pronta', 'cancelada'],
    pronta:     ['andamento', 'cancelada'],
    andamento:  ['finalizada'],
    finalizada: [],
    cancelada:  []
  };

  var reservaPode = function (r, destino) {
    if (!r) return false;
    return (TRANSICOES_RESERVA[r.status] || []).indexOf(destino) !== -1;
  };

  var mudarReserva = function (id, destino) {
    var r = reserva(id);
    if (!reservaPode(r, destino)) return false;
    r.status = destino;
    avisar('reservas');
    return true;
  };

  /* ----------------------------------------------------------
     A AVALIAÇÃO DAS AÇÕES CONTEXTUAIS DA RESERVA.

     É o coração da tela de detalhe: cada ação do pedido
     (confirmar, gerar contrato, enviar, registrar pagamento,
     iniciar locação, vistoria de saída, finalizar, vistoria de
     devolução) responde aqui se está liberada, e por quê não
     quando não está.

     "por quê não" é o que transforma um botão cinza num sistema
     que ensina: em vez de esconder a ação, a tela diz o que
     falta.
     ---------------------------------------------------------- */
  var acoesDaReserva = function (r) {
    if (!r) return [];

    var k = contratoDaReserva(r.id);
    var l = locacaoDaReserva(r.id);
    var vSaida = l ? vistoriasDaLocacao(l.id, 'saida')[0] : vistoriasDaLocacao(r.id, 'saida')[0];
    var vDevol = l ? vistoriasDaLocacao(l.id, 'devolucao')[0] : null;
    var semCliente = !r.clienteId;

    var motivoCliente = semCliente
      ? 'Reserva recebida pelo site sem cadastro: informe o cliente antes de continuar.'
      : '';

    /* Há lançamento em aberto para esta reserva? É o que decide se
       "Registrar pagamento" faz sentido. A pergunta certa não é
       "a reserva está em andamento?", e sim "ainda falta receber?"
       — uma locação já finalizada e paga não tem o que registrar,
       e um botão que oferece receber de novo é um convite a
       lançar dinheiro que não entrou. */
    var emAberto = estado.lancamentos.filter(function (f) {
      return f.reserva === r.id && (f.status === 'pendente' || f.status === 'atrasado');
    })[0];

    var lista = [
      {
        id: 'confirmar', rotulo: 'Confirmar reserva', tom: 'pri',
        liberada: reservaPode(r, 'confirmada') && !semCliente,
        motivo: semCliente ? motivoCliente : 'A reserva já foi confirmada.'
      },
      {
        id: 'gerar-contrato', rotulo: 'Gerar contrato', tom: 'out',
        liberada: !semCliente && (r.status === 'confirmada' || r.status === 'contrato' || r.status === 'pronta') && !k,
        motivo: semCliente ? motivoCliente
              : (k ? 'Esta reserva já tem o contrato ' + k.codigo + '.'
                   : 'Confirme a reserva antes de gerar o contrato.')
      },
      {
        id: 'enviar-contrato', rotulo: 'Enviar contrato', tom: 'out',
        liberada: Boolean(k) && (k.status === 'gerado' || k.status === 'enviado' || k.status === 'aguardando'),
        motivo: !k ? 'Gere o contrato primeiro.'
                   : (k.status === 'assinado' ? 'O contrato já está assinado.'
                                              : 'O contrato não está pronto para envio.')
      },
      {
        id: 'registrar-pagamento', rotulo: 'Registrar pagamento', tom: 'out',
        liberada: r.status !== 'cancelada' && r.status !== 'nova' &&
                  r.status !== 'aguardando' && Boolean(emAberto),
        motivo: r.status === 'cancelada' ? 'A reserva está cancelada.'
              : (r.status === 'nova' || r.status === 'aguardando'
                  ? 'Confirme a reserva antes de registrar o pagamento.'
                  : 'Não há valor em aberto para esta reserva — o pagamento já foi registrado.')
      },
      {
        id: 'iniciar-locacao', rotulo: 'Iniciar locação', tom: 'pri',
        liberada: r.status === 'pronta' && !l && Boolean(vSaida && vSaida.status === 'concluida'),
        motivo: l ? 'A locação ' + l.codigo + ' já foi iniciada.'
              : (r.status !== 'pronta'
                  ? 'A reserva precisa estar pronta para retirada.'
                  : 'Registre a vistoria de saída antes de iniciar a locação.')
      },
      {
        id: 'vistoria-saida', rotulo: 'Registrar vistoria de saída', tom: 'out',
        liberada: !l && (r.status === 'confirmada' || r.status === 'contrato' || r.status === 'pronta') && !(vSaida && vSaida.status === 'concluida'),
        motivo: l ? 'A locação já começou.'
              : (vSaida && vSaida.status === 'concluida' ? 'A vistoria de saída já foi registrada.'
                                                         : 'Confirme a reserva antes da vistoria.')
      },
      {
        id: 'finalizar', rotulo: 'Finalizar locação', tom: 'out',
        liberada: Boolean(l) && l.status !== 'finalizada' && Boolean(vDevol && vDevol.status === 'concluida'),
        motivo: !l ? 'Não há locação em andamento para esta reserva.'
              : (l.status === 'finalizada' ? 'A locação já foi finalizada.'
                                           : 'Registre a vistoria de devolução antes de finalizar.')
      },
      {
        id: 'vistoria-devolucao', rotulo: 'Registrar vistoria de devolução', tom: 'out',
        liberada: Boolean(l) && l.status !== 'finalizada' && !(vDevol && vDevol.status === 'concluida'),
        motivo: !l ? 'A locação ainda não começou.'
              : (vDevol && vDevol.status === 'concluida' ? 'A vistoria de devolução já foi registrada.'
                                                         : 'A locação já foi finalizada.')
      },
      {
        id: 'cancelar', rotulo: 'Cancelar reserva', tom: 'perigo',
        liberada: reservaPode(r, 'cancelada'),
        motivo: 'Uma reserva em andamento ou já finalizada não pode ser cancelada.'
      }
    ];

    return lista;
  };

  /* ----------------------------------------------------------
     AÇÕES QUE DE FATO MEXEM NO ESTADO.
     Cada uma devolve `{ ok, mensagem }` — a tela só mostra o
     aviso de canto, quem decidiu foi aqui.
     ---------------------------------------------------------- */
  var confirmarReserva = function (id) {
    var r = reserva(id);
    if (!r) return { ok: false, mensagem: 'Reserva não encontrada.' };
    if (!r.clienteId) {
      return { ok: false, mensagem: 'Informe o cliente antes de confirmar — esta reserva veio do site sem dados pessoais.' };
    }
    if (!reservaPode(r, 'confirmada')) {
      return { ok: false, mensagem: 'Esta reserva não pode ser confirmada no status atual.' };
    }
    r.status = 'confirmada';
    avisar('reservas');
    return { ok: true, mensagem: 'Reserva ' + r.codigo + ' confirmada.' };
  };

  var cancelarReserva = function (id, motivo) {
    var r = reserva(id);
    if (!r) return { ok: false, mensagem: 'Reserva não encontrada.' };
    if (!reservaPode(r, 'cancelada')) {
      return { ok: false, mensagem: 'Uma reserva em andamento ou finalizada não pode ser cancelada.' };
    }
    r.status = 'cancelada';
    r.pagamento = 'cancelado';
    if (motivo) r.obs = motivo;
    estado.lancamentos.forEach(function (f) {
      if (f.reserva === id && f.status === 'pendente') f.status = 'cancelado';
    });
    avisar('reservas');
    return { ok: true, mensagem: 'Reserva ' + r.codigo + ' cancelada.' };
  };

  var informarCliente = function (reservaId, clienteId) {
    var r = reserva(reservaId);
    if (!r) return { ok: false, mensagem: 'Reserva não encontrada.' };
    if (!cliente(clienteId)) return { ok: false, mensagem: 'Cliente não encontrado.' };
    r.clienteId = clienteId;
    if (r.origem === 'site') r.origem = 'site';
    avisar('reservas');
    return { ok: true, mensagem: 'Cliente vinculado à reserva ' + r.codigo + '.' };
  };

  var prontaParaRetirada = function (id) {
    var r = reserva(id);
    if (!r) return { ok: false, mensagem: 'Reserva não encontrada.' };
    if (!reservaPode(r, 'pronta')) {
      return { ok: false, mensagem: 'Gere e assine o contrato antes de liberar a retirada.' };
    }
    r.status = 'pronta';
    avisar('reservas');
    return { ok: true, mensagem: 'Reserva ' + r.codigo + ' pronta para retirada.' };
  };

  var registrarPagamento = function (lancamentoId, forma) {
    var f = lancamento(lancamentoId);
    if (!f) return { ok: false, mensagem: 'Lançamento não encontrado.' };
    var valor = D.valorDoLancamento(f);
    if (valor === null) {
      return { ok: false, mensagem: 'Este lançamento ainda não tem valor definido — configure a regra antes de registrar o pagamento.' };
    }
    f.status = 'pago';
    f.pagoEm = D.HOJE;
    f.forma = forma || '';
    avisar('financeiro');
    return { ok: true, mensagem: 'Pagamento de ' + D.fmtBRL(valor) + ' registrado.' };
  };

  /* ----------------------------------------------------------
     CONTRATOS
     ---------------------------------------------------------- */
  var criarContrato = function (reservaId) {
    var r = reserva(reservaId);
    if (!r) return { ok: false, mensagem: 'Reserva não encontrada.' };
    if (contratoDaReserva(reservaId)) {
      return { ok: false, mensagem: 'Esta reserva já tem contrato gerado.' };
    }
    var cod = proximoCodigo('contrato');
    var k = {
      id: 'k' + cod.replace(/\D/g, ''),
      codigo: cod,
      reserva: reservaId, locacao: null,
      criadoEm: D.HOJE, atualizadoEm: D.HOJE,
      status: 'gerado', via: '', enviadoEm: null,
      texto: null, modelo: false
    };
    estado.contratos.push(k);
    if (reservaPode(r, 'contrato')) r.status = 'contrato';
    avisar('contratos');
    return { ok: true, mensagem: 'Contrato ' + k.codigo + ' gerado.', contrato: k };
  };

  /* ----------------------------------------------------------
     CONTRATO AVULSO (§15 — "+ NOVO CONTRATO")

     O caminho normal é a reserva gerar o contrato. Este é o
     outro: o cliente que chegou no balcão e fechou na hora, sem
     ter passado pelo site. Não existe reserva para servir de
     origem, então o contrato guarda o locatário e o veículo
     direto nele.

     Ele nasce SEMPRE em rascunho. Não é preciosismo: um contrato
     avulso não tem tabela de preço atrás — sem reserva, não há
     diária, proteção nem adicional para calcular. Promovê-lo a
     "gerado" produziria um documento de aparência fechada com o
     valor em branco. Em rascunho, o operador vê o que falta
     antes de o papel existir.
     ---------------------------------------------------------- */
  var criarContratoAvulso = function (clienteId, veiculoId) {
    var c = cliente(clienteId);
    if (!c) return { ok: false, mensagem: 'Escolha o locatário do contrato.' };
    if (veiculoId && !veiculo(veiculoId)) {
      return { ok: false, mensagem: 'Veículo não encontrado.' };
    }
    var cod = proximoCodigo('contrato');
    var k = {
      id: 'k' + cod.replace(/\D/g, ''),
      codigo: cod,
      reserva: null, locacao: null,
      cliente: clienteId, veiculo: veiculoId || null,
      criadoEm: D.HOJE, atualizadoEm: D.HOJE,
      status: 'rascunho', via: '', enviadoEm: null,
      texto: null, modelo: false
    };
    estado.contratos.push(k);
    avisar('contratos');
    return {
      ok: true,
      mensagem: 'Rascunho ' + k.codigo + ' criado para ' + c.nome + '.',
      contrato: k
    };
  };

  var enviarContrato = function (id, via) {
    var k = contrato(id);
    if (!k) return { ok: false, mensagem: 'Contrato não encontrado.' };
    k.status = 'aguardando';
    k.via = via || 'A definir';
    k.enviadoEm = D.HOJE;
    k.atualizadoEm = D.HOJE;
    avisar('contratos');
    return { ok: true, mensagem: 'Contrato ' + k.codigo + ' enviado por ' + k.via + '.' };
  };

  var assinarContrato = function (id) {
    var k = contrato(id);
    if (!k) return { ok: false, mensagem: 'Contrato não encontrado.' };
    k.status = 'assinado';
    k.atualizadoEm = D.HOJE;
    avisar('contratos');
    return { ok: true, mensagem: 'Assinatura registrada à mão. Nesta fase o sistema não coleta assinatura digital.' };
  };

  var cancelarContrato = function (id) {
    var k = contrato(id);
    if (!k) return { ok: false, mensagem: 'Contrato não encontrado.' };
    k.status = 'cancelado';
    k.atualizadoEm = D.HOJE;
    avisar('contratos');
    return { ok: true, mensagem: 'Contrato ' + k.codigo + ' cancelado.' };
  };

  var salvarTextoContrato = function (id, texto) {
    var k = contrato(id);
    if (!k) return { ok: false, mensagem: 'Contrato não encontrado.' };
    k.texto = texto;
    k.atualizadoEm = D.HOJE;
    if (k.status === 'rascunho') k.status = 'gerado';
    avisar('contratos');
    return { ok: true, mensagem: 'Contrato ' + k.codigo + ' salvo.' };
  };

  /* ----------------------------------------------------------
     LOCAÇÕES
     ---------------------------------------------------------- */
  var iniciarLocacao = function (reservaId, dados) {
    var r = reserva(reservaId);
    if (!r) return { ok: false, mensagem: 'Reserva não encontrada.' };
    if (locacaoDaReserva(reservaId)) {
      return { ok: false, mensagem: 'Esta reserva já virou locação.' };
    }
    if (r.status !== 'pronta') {
      return { ok: false, mensagem: 'A reserva precisa estar pronta para retirada.' };
    }
    var codL = proximoCodigo('locacao');
    var codSaida = proximoCodigo('vistoria');
    var codDevol = proximoCodigo('vistoria');

    var l = {
      id: 'l' + codL.replace(/\D/g, ''),
      codigo: codL, reserva: reservaId,
      clienteId: r.clienteId, veiculoId: r.veiculoId,
      inicio: D.HOJE, fimPrevisto: r.ate, fimReal: null,
      horaSaida: (dados && dados.hora) || '', horaEntrada: '',
      kmSaida: (dados && dados.km) || null, kmEntrada: null,
      combustivelSaida: (dados && dados.combustivel) || '', combustivelEntrada: '',
      status: 'andamento', obs: ''
    };
    estado.locacoes.push(l);
    r.status = 'andamento';

    /* A vistoria de saída é a garantia do estado do veículo. Ela
       é criada junto com a locação já concluída, porque quem
       inicia a locação acabou de fazer a vistoria. A vistoria de
       devolução nasce junto, PENDENTE: é ela que impede a
       locação de ser finalizada sem o registro, e é ela que
       aparece na lista de "resolver agora" no dia da devolução. */
    estado.vistorias.push({
      id: 't' + codSaida.replace(/\D/g, ''),
      codigo: codSaida,
      tipo: 'saida', locacao: l.id, reserva: reservaId,
      clienteId: r.clienteId, veiculoId: r.veiculoId,
      data: D.HOJE, hora: l.horaSaida, km: l.kmSaida,
      combustivel: l.combustivelSaida,
      areas: D.vistoriaVazia(), status: 'concluida', obs: ''
    });

    estado.vistorias.push({
      id: 't' + codDevol.replace(/\D/g, ''),
      codigo: codDevol,
      tipo: 'devolucao', locacao: l.id, reserva: reservaId,
      clienteId: r.clienteId, veiculoId: r.veiculoId,
      data: r.ate, hora: '', km: null, combustivel: '',
      areas: D.vistoriaVazia(), status: 'pendente', obs: ''
    });

    avisar('locacoes');
    return { ok: true, mensagem: 'Locação ' + l.codigo + ' iniciada.', locacao: l };
  };

  var finalizarLocacao = function (locacaoId, dados) {
    var l = locacao(locacaoId);
    if (!l) return { ok: false, mensagem: 'Locação não encontrada.' };
    if (l.status === 'finalizada') return { ok: false, mensagem: 'Esta locação já foi finalizada.' };

    var vd = vistoriasDaLocacao(l.id, 'devolucao')[0];
    if (!vd || vd.status !== 'concluida') {
      return { ok: false, mensagem: 'Registre a vistoria de devolução antes de finalizar.' };
    }

    l.status = 'finalizada';
    l.fimReal = D.HOJE;
    l.horaEntrada = (dados && dados.hora) || '';
    l.kmEntrada = (dados && dados.km) || vd.km || null;
    l.combustivelEntrada = (dados && dados.combustivel) || vd.combustivel || '';

    /* A quilometragem de entrada volta para a ficha do veículo.
       Sem isso o hodômetro da frota congela na leitura de saída:
       a locação fecha, o carro volta para a fila, e a ficha
       continua mostrando os quilômetros de dias atrás — o que
       atrasa o alerta de revisão e mente na coluna "Quilometragem"
       do módulo Frota.

       O hodômetro só avança. Se alguém digitar uma leitura menor
       que a da saída (troca de unidade, erro de digitação), ela é
       registrada na locação — é o que foi lido — mas não volta
       para o veículo, porque um carro não anda para trás. */
    var vec = veiculo(l.veiculoId);
    if (vec && l.kmEntrada !== null && l.kmEntrada !== '' && l.kmEntrada !== undefined) {
      if (vec.km === null || vec.km === undefined || l.kmEntrada > vec.km) {
        vec.km = l.kmEntrada;
      }
    }

    var r = l.reserva ? reserva(l.reserva) : null;
    if (r && r.status === 'andamento') r.status = 'finalizada';

    avisar('locacoes');
    avisar('frota');
    return { ok: true, mensagem: 'Locação ' + l.codigo + ' finalizada.' };
  };

  /* ----------------------------------------------------------
     VISTORIAS
     ---------------------------------------------------------- */
  var salvarVistoria = function (id, dados) {
    var v = vistoria(id);
    if (!v) return { ok: false, mensagem: 'Vistoria não encontrada.' };

    if (dados.hora !== undefined) v.hora = dados.hora;
    if (dados.km !== undefined) v.km = dados.km;
    if (dados.combustivel !== undefined) v.combustivel = dados.combustivel;
    if (dados.areas !== undefined) v.areas = dados.areas;
    if (dados.obs !== undefined) v.obs = dados.obs;

    var concluir = dados.concluir !== false;
    if (concluir) {
      if (v.km === null || v.km === undefined || v.km === '') {
        return { ok: false, mensagem: 'Informe a quilometragem para concluir a vistoria.' };
      }
      if (!v.combustivel) {
        return { ok: false, mensagem: 'Informe o nível de combustível para concluir a vistoria.' };
      }
      v.status = 'concluida';
      v.data = v.data || D.HOJE;

      /* Ao concluir a vistoria de saída antes da locação, o
         veículo ganha a quilometragem registrada. É isso que
         mantém a ficha do veículo coerente com a operação. */
      if (v.tipo === 'saida') {
        var vec = veiculo(v.veiculoId);
        if (vec && v.km) vec.km = v.km;
      }
    }

    avisar('vistorias');
    return { ok: true, mensagem: v.codigo + ' salva.', vistoria: v };
  };

  var criarVistoria = function (dados) {
    var r = dados.reserva ? reserva(dados.reserva) : null;
    var l = dados.locacao ? locacao(dados.locacao) : null;
    var cod = proximoCodigo('vistoria');
    var v = {
      id: 't' + cod.replace(/\D/g, ''),
      codigo: cod,
      tipo: dados.tipo || 'saida',
      locacao: dados.locacao || null,
      reserva: dados.reserva || null,
      clienteId: dados.clienteId || (r ? r.clienteId : (l ? l.clienteId : null)),
      veiculoId: dados.veiculoId || (r ? r.veiculoId : (l ? l.veiculoId : null)),
      data: D.HOJE, hora: '', km: null, combustivel: '',
      areas: D.vistoriaVazia(), status: 'pendente', obs: ''
    };
    estado.vistorias.push(v);
    avisar('vistorias');
    return { ok: true, mensagem: 'Vistoria ' + cod + ' criada.', vistoria: v };
  };

  /* Quantas vistorias estão pendentes para uma locação — usado
     pelo texto de bloqueio de "finalizar locação". */
  var vistoriasPendentes = function (locacaoId) {
    return estado.vistorias.filter(function (v) {
      return v.locacao === locacaoId && v.status !== 'concluida';
    });
  };

  /* ----------------------------------------------------------
     MANUTENÇÕES E OCORRÊNCIAS
     ---------------------------------------------------------- */
  var salvarManutencao = function (id, dados) {
    var m = manutencao(id);
    if (!m) return { ok: false, mensagem: 'Manutenção não encontrada.' };
    if (dados.status !== undefined) m.status = dados.status;
    if (dados.descricao !== undefined) m.descricao = dados.descricao;
    if (dados.oficina !== undefined) m.oficina = dados.oficina;
    if (dados.custo !== undefined) m.custo = dados.custo;
    if (dados.previsao !== undefined) m.previsao = dados.previsao;
    if (dados.alerta !== undefined) m.alerta = dados.alerta;
    if (m.status === 'concluida' && !m.conclusao) m.conclusao = D.HOJE;

    /* Fechar a manutenção liberta o veículo — mas só se ele
       estava preso POR ela. Um veículo indisponível por
       documentação continua indisponível. */
    var v = veiculo(m.veiculoId);
    if (v && m.status === 'concluida' && v.status === 'manutencao') v.status = 'disponivel';

    avisar('manutencoes');
    return { ok: true, mensagem: 'Manutenção atualizada.' };
  };

  var resolverOcorrencia = function (id, status) {
    var o = ocorrencia(id);
    if (!o) return { ok: false, mensagem: 'Ocorrência não encontrada.' };
    o.status = status || 'resolvida';
    avisar('ocorrencias');
    return { ok: true, mensagem: 'Ocorrência marcada como ' + D.acharStatus(D.STATUS_OCORRENCIA, o.status).rotulo + '.' };
  };

  /* ----------------------------------------------------------
     CLIENTES (cadastro rápido)
     ---------------------------------------------------------- */
  var criarCliente = function (dados) {
    var cod = 'c' + (estado.clientes.length + 1);
    while (cliente(cod)) cod = 'c' + (Number(cod.slice(1)) + 1);

    var c = {
      id: cod,
      nome: dados.nome || 'Cliente sem nome',
      tipo: dados.tipo || 'PF',
      doc: dados.tipo === 'PJ' ? D.CLIENTES[0] && '**.***.***/****-**' : '***.***.***-**',
      telefone: dados.telefone || '',
      email: dados.email || '',
      desde: D.HOJE,
      endereco: dados.endereco || { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
      cnh: dados.tipo === 'PJ' ? null : { numero: '*** *** *** **', categoria: dados.cnhCategoria || '', validade: dados.cnhValidade || '' },
      docs: { cnh: null, residencia: 'ausente', cnpj: null },
      obs: dados.obs || ''
    };
    estado.clientes.push(c);
    avisar('clientes');
    return { ok: true, mensagem: 'Cliente ' + c.nome + ' cadastrado.', cliente: c };
  };

  /* ==========================================================
     5 · CONFIGURAÇÕES (as únicas que sobrevivem ao recarregar)
     ========================================================== */
  var empresa = clonar(D.EMPRESA);
  var salvoEmpresa = ler(CHAVE_EMPRESA);
  if (salvoEmpresa) {
    Object.keys(salvoEmpresa).forEach(function (k) { empresa[k] = salvoEmpresa[k]; });
  }

  var regras = clonar(D.REGRAS);
  var salvoRegras = ler(CHAVE_REGRAS);
  if (salvoRegras) {
    regras = regras.map(function (r) {
      var guardado = salvoRegras[r.id];
      if (guardado === undefined) return r;
      r.valor = guardado;
      return r;
    });
  }

  var salvarEmpresa = function (dados) {
    Object.keys(dados).forEach(function (k) { empresa[k] = dados[k]; });
    var ok = gravar(CHAVE_EMPRESA, empresa);
    avisar('configuracoes');
    return {
      ok: true,
      mensagem: ok
        ? 'Dados da empresa salvos neste navegador.'
        : 'Os dados foram aplicados nesta sessão, mas este navegador não permitiu gravar. Ao recarregar, os campos voltam ao estado anterior.'
    };
  };

  var salvarRegras = function (dados) {
    regras.forEach(function (r) {
      if (dados[r.id] === undefined) return;
      var v = dados[r.id];

      if (v === '' || v === null || v === undefined) {
        r.valor = null;
        return;
      }

      /* Nem toda regra é um número.

         Cinco delas são escolhas entre opções: política de
         combustível, limite de quilometragem, multa por atraso,
         juros e cancelamento. O valor guardado é o TEXTO da opção
         ("Cheio / Cheio", "Limitada por dia"). Passar isso por
         Number() dava NaN, e NaN não sobrevive ao JSON — virava
         null na gravação. O operador escolhia, o contrato
         continuava escrevendo [A DEFINIR], e nada dizia por quê.

         Só as regras com `unidade` numérica são convertidas; as
         que têm `opcoes` guardam o texto exatamente como veio da
         lista, para o contrato repetir o que foi escolhido. */
      if (r.opcoes && r.opcoes.length) {
        r.valor = String(v);
        return;
      }

      var n = Number(v);
      r.valor = isNaN(n) ? null : n;
    });
    var plano = {};
    regras.forEach(function (r) { plano[r.id] = r.valor; });
    var ok = gravar(CHAVE_REGRAS, plano);
    avisar('configuracoes');
    return {
      ok: true,
      mensagem: ok
        ? 'Regras do contrato salvas neste navegador.'
        : 'As regras valem nesta sessão, mas este navegador não permitiu gravar.'
    };
  };

  var empresaVazia = function (campo) {
    var v = empresa[campo];
    return v === null || v === undefined || String(v).trim() === '';
  };

  /* Quantos campos obrigatórios da empresa ainda faltam. É o que
     alimenta o aviso no gerador de contrato. */
  var empresaPendentes = function () {
    return D.CAMPOS_EMPRESA.filter(function (c) {
      return c.obrigatorio && empresaVazia(c.id);
    });
  };

  var regrasPendentes = function () {
    return regras.filter(function (r) { return r.valor === null; });
  };

  /* ----------------------------------------------------------
     PREFERÊNCIAS DE INTERFACE
     Guardadas porque são incômodas de refazer toda vez: o estado
     do menu recolhido e o filtro padrão da lista de reservas.
     ---------------------------------------------------------- */
  var prefs = ler(CHAVE_PREF) || { rail: 'aberto' };

  var salvarPref = function (chave, valor) {
    prefs[chave] = valor;
    gravar(CHAVE_PREF, prefs);
  };

  /* ==========================================================
     6 · PERÍODO DA RESERVA E PRORROGAÇÃO
     ----------------------------------------------------------
     Duas operações parecidas e resolutamente separadas:

     1. MUDAR O PERÍODO DA RESERVA (§2–§4) — antes da retirada.
        O carro ainda não saiu; mexer na data é replanejar.

     2. PRORROGAR A LOCAÇÃO (§5–§12) — depois da retirada.
        O carro está na mão do cliente; mexer na data é pedir mais
        tempo, e quem decide é a locadora.

     As duas terminam no mesmo lugar — uma reserva com `de` e
     `ate` novos —, e é exatamente por isso que o registro do que
     aconteceu muda de nome. "Período alterado" não conta a mesma
     história que "Prorrogação aprovada", e quem abre o histórico
     daqui a três meses precisa saber qual das duas foi.
     ========================================================== */

  /* ----------------------------------------------------------
     MUDAR O PERÍODO (antes da retirada)
     ---------------------------------------------------------- */
  var mudarPeriodoDaReserva = function (id, novo) {
    var r = reserva(id);
    if (!r) return { ok: false, mensagem: 'Reserva não encontrada.' };

    /* O QUE DEFINE "JÁ COMEÇOU" É A LOCAÇÃO EXISTIR.

       Não é o status da reserva. Uma reserva confirmada, pronta e
       até em andamento continua com o período aberto enquanto não
       houver uma locação para ela — e é a criação da locação que
       registra a saída do carro. Olhar o status em vez disso
       bloqueava justamente os casos legítimos: dava para recusar a
       edição de uma reserva que ainda nem tinha sido retirada. */
    var jaSaiu = estado.locacoes.some(function (l) { return l.reserva === id; });
    if (jaSaiu) {
      return { ok: false, mensagem: 'A locação já foi iniciada. O período só pode ser ' +
                                    'alterado antes da retirada do veículo.' };
    }
    if (r.status === 'finalizada' || r.status === 'cancelada') {
      return { ok: false, mensagem: 'Reserva ' + r.codigo + ' está ' +
                                    (r.status === 'finalizada' ? 'finalizada' : 'cancelada') +
                                    ' e não tem período a alterar.' };
    }

    var de = novo.de;
    var ate = novo.ate;
    var dias = D.diffDias(de, ate);

    if (!D.ehDia(de) || !D.ehDia(ate)) {
      return { ok: false, mensagem: 'Informe data de retirada e de devolução.' };
    }
    if (dias <= 0) {
      return { ok: false, mensagem: 'A devolução precisa ser depois da retirada.' };
    }

    /* A checagem de agenda é a MESMA que a prorrogação usa. A
       reserva se ignora a si própria; senão o período antigo
       conflitaria com o novo, e nenhuma edição passaria. */
    var disp = D.disponibilidadeNoPeriodo(r.veiculoId, de, ate, id);
    if (!disp.livre) {
      return {
        ok: false,
        conflito: true,
        motivos: disp.motivos,
        mensagem: disp.motivos.length && disp.motivos[0].tipo === 'frota'
          ? disp.motivos[0].rotulo + '.'
          : 'Este veículo possui conflito de agenda no novo período.'
      };
    }

    var antes = {
      de: r.de, ate: r.ate, dias: r.dias,
      retiradaHora: r.retiradaHora, devolucaoHora: r.devolucaoHora
    };

    /* `dias` é campo GUARDADO, não calculado: `D.preco()` lê
       `r.dias` na hora de somar. Mudar `de`/`ate` sem mexer aqui
       deixaria a tela mostrando o período novo com o preço velho —
       a pior combinação possível, porque parece certo. */
    r.de = de;
    r.ate = ate;
    r.dias = dias;
    if (novo.retiradaHora) r.retiradaHora = novo.retiradaHora;
    if (novo.devolucaoHora) r.devolucaoHora = novo.devolucaoHora;

    registrarAlteracao(r, {
      antes: antes,
      depois: { de: de, ate: ate, dias: dias,
                retiradaHora: r.retiradaHora, devolucaoHora: r.devolucaoHora }
    });

    avisar('reservas');
    return {
      ok: true,
      mensagem: 'Reserva ' + r.codigo + ' atualizada de ' + D.fmtData(antes.de) +
                '–' + D.fmtData(antes.ate) + ' para ' + D.fmtData(de) + '–' + D.fmtData(ate) + '.'
    };
  };

  /* ----------------------------------------------------------
     O REGISTRO DA ALTERAÇÃO
     ----------------------------------------------------------
     `r.historico` é criado na primeira alteração. As reservas da
     base não têm o campo, e todas passam a ter depois da
     primeira — inventar um array vazio em catorze registros só
     para um deles vir a ser usado seria ruído.

     `hora` é a hora real do navegador, e não uma hora fixa da
     demonstração: quem alterou o período fez isso agora, e o
     registro precisa dizer isso.
     ---------------------------------------------------------- */
  /* Um período tem QUATRO dados, não dois: dia e hora de retirada, dia
     e hora de devolução. Guardar só uma hora por lado escondia
     justamente a alteração mais comum — mexer no horário de devolução
     sem mexer no dia. O histórico registra os dois horários dos dois
     lados. */
  var registrarAlteracao = function (r, dados) {
    if (!r.historico) r.historico = [];
    var agora = new Date();
    var hora = (agora.getHours() < 10 ? '0' : '') + agora.getHours() + ':' +
               (agora.getMinutes() < 10 ? '0' : '') + agora.getMinutes();
    r.historico.push({
      tipo: 'periodo',
      rotulo: 'PERÍODO ALTERADO',
      de: dados.antes.de,
      ate: dados.antes.ate,
      deHora: dados.antes.retiradaHora || '',
      ateHora: dados.antes.devolucaoHora || '',
      novoDe: dados.depois.de,
      novoAte: dados.depois.ate,
      novoDeHora: dados.depois.retiradaHora || '',
      novoAteHora: dados.depois.devolucaoHora || '',
      deDias: dados.antes.dias,
      paraDias: dados.depois.dias,
      origem: 'ADMINISTRADOR',
      em: D.HOJE,
      hora: hora
    });
  };

  /* ----------------------------------------------------------
     SOLICITAR PRORROGAÇÃO (lado do cliente)
     ---------------------------------------------------------- */
  var solicitarProrrogacao = function (locacaoId, pedido) {
    var l = locacao(locacaoId);
    if (!l) return { ok: false, mensagem: 'Locação não encontrada.' };
    if (l.status === 'finalizada') {
      return { ok: false, mensagem: 'Esta locação já foi encerrada.' };
    }

    var pendente = D.extensaoPendenteDaReserva(l.reserva);
    if (pendente) {
      return { ok: false, mensagem: 'Já existe uma solicitação aguardando análise ' +
                                    'para esta locação.' };
    }

    var atual = atualDevolucao(l);
    var pedida = pedido.quando;

    /* O formato vem antes da conta. Sem isto, uma data malformada
       caía no `extra <= 0` e o cliente lia "precisa ser depois da
       atual" sobre uma data que era simplesmente inválida — o
       cliente tentando de novo com a mesma data e nada mudando. */
    if (!D.ehDia(pedida)) {
      return { ok: false, mensagem: 'Informe a nova data de devolução.' };
    }

    var extra = D.diffDias(atual, pedida);
    if (extra <= 0) {
      return { ok: false, mensagem: 'A nova devolução precisa ser depois da atual (' +
                                    D.fmtDataHora(atual) + ').' };
    }

    /* `sequencia.extensao` pode não existir num estado restaurado de
       versão anterior; sem a guarda o id sairia 'xundefined', que é
       único o bastante para passar despercebido e impossível de
       rastrear depois. */
    if (typeof estado.sequencia.extensao !== 'number') {
      estado.sequencia.extensao = estado.extensoes.length + 1;
    }
    var numero = String(estado.sequencia.extensao);
    while (numero.length < 2) numero = '0' + numero;

    var e = {
      id: 'x' + numero,
      locacaoId: l.id,
      reservaId: l.reserva,
      clienteId: l.clienteId,
      veiculoId: l.veiculoId,
      currentReturnAt: atual,
      requestedReturnAt: pedida.indexOf('T') === -1 ? pedida + 'T' + (D.horaDe(atual) || '12:00') : pedida,
      extraDays: extra,
      estimatedAdditionalValue: D.valorDaProrrogacao(l, extra),
      status: 'pendente',
      createdAt: D.HOJE,
      decidedAt: null,
      decidedBy: null,
      decisionReason: null
    };
    estado.sequencia.extensao += 1;
    estado.extensoes.push(e);

    avisar('prorrogacoes');
    return {
      ok: true,
      extensao: e,
      mensagem: 'Sua solicitação será analisada pela Lokcar.'
    };
  };

  /* A devolução VIGENTE da locação: a data original enquanto não
     houver prorrogação aprovada; depois dela, a data aprovada.
     É esta a data que o cliente vê como "Devolução atual" e sobre
     a qual o acréscimo é calculado. */
  var atualDevolucao = function (l) {
    var vigente = l.fimPrevisto + 'T' + (l.horaEntrada || '18:00');
    estado.extensoes.forEach(function (e) {
      if (e.locacaoId === l.id && (e.status === 'aprovada' || e.status === 'auto')) {
        vigente = e.requestedReturnAt;
      }
    });
    return vigente;
  };

  /* ----------------------------------------------------------
     A DECISÃO
     ----------------------------------------------------------
     `decidirProrrogacao` é o ÚNICO lugar que muda o status de uma
     solicitação. Aprovar à mão e aprovar automaticamente passam
     por aqui, e é isso que garante que as duas deixem o sistema
     no mesmo estado — mesma data na locação, mesmo histórico,
     mesmo valor. Duas rotas de aprovação que escrevessem em
     lugares diferentes divergiriam no primeiro dia.
     ---------------------------------------------------------- */
  var decidirProrrogacao = function (id, decisao, motivo) {
    var e = D.extensaoPorId(id);
    if (!e) return { ok: false, mensagem: 'Solicitação não encontrada.' };
    if (e.status !== 'pendente') {
      return { ok: false, mensagem: 'Esta solicitação já foi decidida.' };
    }

    /* A PALAVRA DA DECISÃO É NORMALIZADA ANTES DE QUALQUER COISA.

       Antes isto testava `decisao === 'recusar'` — e só isso. Quem
       chamasse com 'recusada' (a palavra do status resultante, que é
       a que vem à cabeça) não entrava no ramo de recusa e caía no de
       APROVAÇÃO. Ou seja: pedir para recusar esticava a locação do
       cliente. Um engano de vocabulário não pode inverter a decisão
       do operador, então as duas grafias valem — e o que não for
       reconhecido é erro, nunca aprovação por omissão. */
    var palavra = String(decisao || '').toLowerCase();
    var recusa = palavra === 'recusar' || palavra === 'recusada' ||
                 palavra === 'rejeitar' || palavra === 'rejeitada';
    var aprova = palavra === 'aprovar' || palavra === 'aprovada' || palavra === 'auto';

    if (!recusa && !aprova) {
      return { ok: false, mensagem: 'Decisão não reconhecida: ' + decisao + '.' };
    }

    var l = locacao(e.locacaoId);
    var r = e.reservaId ? reserva(e.reservaId) : null;

    if (recusa) {
      e.status = 'recusada';
      e.decidedAt = D.HOJE;
      e.decidedBy = 'ADMINISTRADOR';
      e.decisionReason = motivo || 'OUTRO';
      avisar('prorrogacoes');
      return { ok: true, extensao: e, mensagem: 'Prorrogação recusada.' };
    }

    /* A checagem roda MESMO na aprovação manual. Não é
       desconfiança do operador: é que a agenda pode ter mudado
       entre o pedido e a decisão — outra reserva pode ter sido
       criada no meio —, e aprovar sem olhar marcaria dois
       compromissos no mesmo carro. Se houver conflito, a
       solicitação VOLTA A PENDENTE em vez de ser aprovada. */
    var disp = D.disponibilidadeNoPeriodo(e.veiculoId, e.currentReturnAt,
                                         e.requestedReturnAt, e.reservaId);
    if (!disp.livre) {
      return {
        ok: false,
        conflito: true,
        motivos: disp.motivos,
        mensagem: 'Não é possível aprovar automaticamente.'
      };
    }

    e.status = palavra === 'auto' ? 'auto' : 'aprovada';
    e.decidedAt = D.HOJE;
    e.decidedBy = decisao === 'auto' ? 'REGRA AUTOMÁTICA' : 'ADMINISTRADOR';
    e.decisionReason = decisao === 'auto' ? 'VEÍCULO LIVRE NO PERÍODO' : 'APROVADA PELO OPERADOR';
    if (e.estimatedAdditionalValue === null) {
      e.estimatedAdditionalValue = D.valorDaProrrogacao(l, e.extraDays);
    }

    /* A LOCAÇÃO E A RESERVA ANDAM JUNTAS.
       Quem ocupa o carro no calendário é a locação, mas quem
       carrega o preço e o contrato é a reserva. Mudar só uma
       deixaria a agenda dizendo uma data e a fatura dizendo
       outra. */
    var de = D.soData(e.requestedReturnAt);
    if (l) l.fimPrevisto = de;
    if (r) {
      r.ate = de;
      r.dias = D.diffDias(r.de, de);
      registrarAlteracao(r, {
        antes: { de: r.de, ate: e.currentReturnAt ? D.soData(e.currentReturnAt) : r.de,
                 dias: D.diffDias(r.de, D.soData(e.currentReturnAt || r.ate)),
                 retiradaHora: r.retiradaHora, devolucaoHora: r.devolucaoHora },
        depois: { de: r.de, ate: de, dias: r.dias,
                  retiradaHora: r.retiradaHora, devolucaoHora: r.devolucaoHora }
      });
      r.historico[r.historico.length - 1].tipo = 'prorrogacao';
      r.historico[r.historico.length - 1].rotulo =
        e.status === 'auto' ? 'PRORROGAÇÃO APROVADA AUTOMATICAMENTE' : 'PRORROGAÇÃO APROVADA';
    }

    avisar('prorrogacoes');
    avisar('locacoes');
    return {
      ok: true,
      extensao: e,
      mensagem: e.status === 'auto'
        ? 'Prorrogação aprovada automaticamente. Devolução agora em ' +
          D.fmtDataHora(e.requestedReturnAt) + '.'
        : 'Prorrogação aprovada. Devolução agora em ' + D.fmtDataHora(e.requestedReturnAt) + '.'
    };
  };

  /* ----------------------------------------------------------
     APROVAÇÃO AUTOMÁTICA (§11)
     ----------------------------------------------------------
     Só roda se o dono tiver escolhido a opção automática. A REGRA
     É DE MÃO ÚNICA: em qualquer dúvida, a solicitação fica
     pendente para uma pessoa decidir. Ela nunca "aprova porque
     não achou problema" — ela aprova porque CONFIRMOU carro
     livre, e cala quando não conseguiu confirmar.

     Um veículo indisponível ou em manutenção nunca é liberado
     aqui: `disponibilidadeNoPeriodo` devolve o bloqueio de frota,
     e o pedido vai para a mão do operador.
     ---------------------------------------------------------- */
  var tentarAprovacaoAutomatica = function (id) {
    var e = D.extensaoPorId(id);
    if (!e || e.status !== 'pendente') {
      return { ok: false, automatico: false, mensagem: 'Não há solicitação pendente.' };
    }

    if (D.modoDeProrrogacao(regras) !== 'auto') {
      return {
        ok: false, automatico: false, pendente: true,
        mensagem: 'A prorrogação está configurada para aprovação manual.'
      };
    }

    var disp = D.disponibilidadeNoPeriodo(e.veiculoId, e.currentReturnAt,
                                         e.requestedReturnAt, e.reservaId);
    if (!disp.livre) {
      return {
        ok: false, automatico: false, pendente: true, conflito: true,
        motivos: disp.motivos,
        mensagem: 'A aprovação automática não pôde ser aplicada. A solicitação ' +
                  'segue para análise manual.'
      };
    }

    var res = decidirProrrogacao(id, 'auto');
    res.automatico = true;
    return res;
  };

  /* ----------------------------------------------------------
     RESTAURAR
     Volta a operação ao estado original de `dados.js`. Não toca
     nas configurações: apagar o que alguém digitou na mão sem
     avisar seria pior do que o problema que o botão resolve.
     ---------------------------------------------------------- */
  var restaurar = function () {
    Object.keys(SEMENTE).forEach(function (chave) {
      reabastecer(estado[chave], SEMENTE[chave]);
    });
    /* O SEGUNDO literal da sequência. Ele existe porque
       `restaurar()` precisa voltar os contadores, e a lista de
       chaves guarda o mesmo nome do `estado`. Se um dia alguém
       acrescentar um contador aqui e esquecer do `estado` (ou o
       contrário), `proximoCodigo` escreve "undefined" no código
       gerado — vale conferir os dois juntos. */
    estado.sequencia = { reserva: 16, contrato: 9, vistoria: 8, locacao: 6, ocorrencia: 5, extensao: 2 };
    avisar('tudo');
    return { ok: true, mensagem: 'Demonstração restaurada ao estado inicial.' };
  };

  var zerarConfiguracoes = function () {
    apagar(CHAVE_EMPRESA);
    apagar(CHAVE_REGRAS);
    empresa = clonar(D.EMPRESA);
    regras = clonar(D.REGRAS);
    avisar('configuracoes');
    return { ok: true, mensagem: 'Campos de configuração voltaram aos valores iniciais.' };
  };

  return {
    disponivelArmazenamento: disponivel,
    estado: estado,
    aoMudar: aoMudar,
    avisar: avisar,
    alterar: alterar,
    proximoCodigo: proximoCodigo,

    reserva: reserva, locacao: locacao, contrato: contrato,
    vistoria: vistoria, manutencao: manutencao, ocorrencia: ocorrencia,
    documento: documento, lancamento: lancamento,
    cliente: cliente, veiculo: veiculo,
    extensao: extensao,

    contratoDaReserva: contratoDaReserva,
    locacaoDaReserva: locacaoDaReserva,
    vistoriasDaLocacao: vistoriasDaLocacao,
    vistoriasPendentes: vistoriasPendentes,
    contratosDoCliente: contratosDoCliente,
    reservasDoCliente: reservasDoCliente,
    locacoesDoCliente: locacoesDoCliente,
    historicoDoCliente: historicoDoCliente,

    TRANSICOES_RESERVA: TRANSICOES_RESERVA,
    reservaPode: reservaPode,
    acoesDaReserva: acoesDaReserva,

    mudarReserva: mudarReserva,
    confirmarReserva: confirmarReserva,
    cancelarReserva: cancelarReserva,
    informarCliente: informarCliente,
    prontaParaRetirada: prontaParaRetirada,
    registrarPagamento: registrarPagamento,

    criarContrato: criarContrato,
    criarContratoAvulso: criarContratoAvulso,
    enviarContrato: enviarContrato,
    assinarContrato: assinarContrato,
    cancelarContrato: cancelarContrato,
    salvarTextoContrato: salvarTextoContrato,

    iniciarLocacao: iniciarLocacao,
    finalizarLocacao: finalizarLocacao,

    salvarVistoria: salvarVistoria,
    criarVistoria: criarVistoria,
    salvarManutencao: salvarManutencao,
    resolverOcorrencia: resolverOcorrencia,
    criarCliente: criarCliente,

    mudarPeriodoDaReserva: mudarPeriodoDaReserva,
    solicitarProrrogacao: solicitarProrrogacao,
    decidirProrrogacao: decidirProrrogacao,
    tentarAprovacaoAutomatica: tentarAprovacaoAutomatica,
    atualDevolucao: atualDevolucao,

    empresa: function () { return empresa; },
    regras: function () { return regras; },
    salvarEmpresa: salvarEmpresa,
    salvarRegras: salvarRegras,
    empresaVazia: empresaVazia,
    empresaPendentes: empresaPendentes,
    regrasPendentes: regrasPendentes,
    zerarConfiguracoes: zerarConfiguracoes,

    prefs: function () { return prefs; },
    salvarPref: salvarPref,

    restaurar: restaurar
  };
})();
