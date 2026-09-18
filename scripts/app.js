/* ============================================================
   LOK CAR — SISTEMA · app.js
   ------------------------------------------------------------
   O último arquivo a carregar, e o único que liga a máquina.

   A ordem dos <script> no index.html é a ordem das dependências:
   config → dados → sessao → contrato → ui → telas → app.
   Este arquivo só pode rodar depois de todos, porque é ele que
   chama `LOKCAR_UI.iniciar()` — e `iniciar()` já desenha a tela,
   que por sua vez chama a tela do módulo.

   A PONTE COM O SITE
   ------------------------------------------------------------
   Quando alguém conclui uma solicitação no site público, o site
   grava o resumo da reserva em `sessionStorage` (chave
   `lokcar-demo-reserva`) e leva a pessoa para cá. O resumo NÃO
   tem dado pessoal — é só a configuração da locação: modelo,
   período, proteção, adicionais, valores.

   Aqui esse resumo é lido e, se existir, vira uma reserva NOVA
   não confirmada, marcada como `origem: 'site'`. É exatamente o
   que acontece numa locadora de verdade: o pedido chega, alguém
   precisa conferir e completar o cadastro.

   O resumo é apagado em seguida. Se ficasse guardado, recarregar
   a página criaria a mesma reserva de novo, e em cinco
   recarregamentos a locadora teria cinco reservas fantasmas do
   mesmo pedido.

   A conversão de diária para dias é a mesma do site: a data de
   retirada e a de devolução, contadas em dias.
   ============================================================ */

(function () {
  'use strict';

  var D = window.LOKCAR_DADOS;
  var S = window.LOKCAR_SESSAO;
  var U = window.LOKCAR_UI;

  var CHAVE_SITE = 'lokcar-demo-reserva';

  /* A outra ponte, do §6: os pedidos de prorrogação feitos pelo
     cliente no Portal do Cliente. Chave diferente da reserva
     porque são coisas diferentes — uma reserva nova e um pedido
     de mais tempo — e misturá-las faria o sistema criar a reserva
     errada. */
  var CHAVE_PORTAL = 'lokcar-portal-prorrogacoes';

  /* ----------------------------------------------------------
     Lê o resumo deixado pelo site. Mesma tolerância do lado do
     site: qualquer falha devolve `null` em vez de derrubar a
     tela. Um dado corrompido no armazenamento não pode impedir
     o operador de abrir o sistema.
     ---------------------------------------------------------- */
  var lerResumoSite = function () {
    try {
      var cru = window.sessionStorage.getItem(CHAVE_SITE);
      if (!cru) return null;
      var dado = JSON.parse(cru);
      return (dado && typeof dado === 'object') ? dado : null;
    } catch (e) {
      return null;
    }
  };

  var limparResumoSite = function () {
    try { window.sessionStorage.removeItem(CHAVE_SITE); } catch (e) { /* nada a fazer */ }
  };

  /* ----------------------------------------------------------
     Converte o resumo do site numa reserva do sistema.

     O QUE ESTE TRECHO NÃO FAZ: não inventa cliente, não inventa
     veículo, não escolhe proteção. Se o resumo vier de um modelo
     que não está na frota, a reserva é criada mesmo assim, com
     `veiculoId: null` — e a tela de reservas mostra isso como
     pendência. Descartar o pedido seria pior: a locadora perderia
     a solicitação de um cliente real.
     ---------------------------------------------------------- */
  var converterResumo = function (resumo) {
    var hoje = D.HOJE;

    var dias = 0;
    if (resumo.de && resumo.ate) {
      dias = resumo.dias || D.diffDias(resumo.de, resumo.ate);
    }
    if (!dias || dias < 1) dias = Number(resumo.dias) || 1;

    /* O veículo do resumo vem pelo MODELO, porque é assim que o
       site o identifica. Aqui vira ID de frota. Quando há duas
       unidades do mesmo modelo, escolhe-se a primeira que não
       esteja em manutenção nem indisponível — o site não sabe
       qual unidade está livre, e entregar o pedido para um carro
       parado seria pior do que escolher por ele. */
    var veiculoId = null;
    var modelo = resumo.modelo;
    if (modelo) {
      var candidatos = S.estado.veiculos.filter(function (v) {
        return v.modelo === modelo;
      });
      var livre = candidatos.filter(function (v) {
        return v.status !== 'manutencao' && v.status !== 'indisponivel';
      })[0];
      var escolhido = livre || candidatos[0];
      if (escolhido) veiculoId = escolhido.id;
    }

    /* A diária vem da tabela do site, nunca do resumo — pelo
       mesmo motivo de sempre: se a tabela mudar, o sistema muda
       junto. O resumo guarda apenas o total que o cliente viu,
       e esse total fica registrado na observação para conferência
       do operador. */
    var diaria = modelo ? D.diariaDo(modelo) : null;

    /* ----------------------------------------------------------
       A TRADUÇÃO DO QUE O CLIENTE ESCOLHEU

       O site guarda o NOME da proteção e o NOME de cada adicional.
       O sistema calcula por `id`. Sem esta tradução a reserva
       chegaria com "Sem proteção" e sem adicionais, e a conta
       sairia para menos — o cliente teria escolhido e o sistema
       não cobraria.

       Quando um nome não é encontrado na tabela atual, o adicional
       é preservado com o nome que veio e `id: null`; a tela de
       reservas mostra isso como pendência. Descartar em silêncio
       seria pior: o pedido do cliente sumiria sem deixar rastro.
       ---------------------------------------------------------- */
    var protecao = D.protecaoPorNome(resumo.protecao);
    var protecaoId = protecao ? protecao.id : '';
    var protecaoNaoAchou = Boolean(resumo.protecao) && !protecao;

    var adicionais = [];
    var adicionaisNaoAchou = [];
    (resumo.adicionais || []).forEach(function (a) {
      var achou = D.adicionalPorNome(a.nome);
      if (achou) {
        adicionais.push({ id: achou.id, qtd: Number(a.qtd) || 1 });
      } else if (a.nome) {
        adicionaisNaoAchou.push(a.nome);
        adicionais.push({ id: null, nome: a.nome, qtd: Number(a.qtd) || 1, sobConsulta: true });
      }
    });

    var cod = S.proximoCodigo('reserva');
    var reserva = {
      id: 'r' + cod.replace(/\D/g, ''),
      codigo: cod,
      criadaEm: hoje,
      clienteId: null,
      veiculoId: veiculoId,
      de: resumo.de || hoje,
      ate: resumo.ate || hoje,
      dias: dias,
      diaria: diaria,
      retiradaModo: resumo.recebimento === 'entrega' ? 'entrega' : 'locadora',
      retiradaHora: '09:00',
      retiradaEndereco: D.enderecoDeLinha(resumo.enderecoEntrega),
      devolucaoModo: resumo.devolucao === 'endereco' ? 'endereco' : 'locadora',
      devolucaoHora: '09:00',
      devolucaoEndereco: D.enderecoDeLinha(resumo.enderecoDevolucao),
      protecaoId: protecaoId,
      adicionais: adicionais,
      taxa: Number(resumo.taxa) || 0,
      status: 'nova',
      origem: 'site',
      pagamento: 'pendente',
      obs: montarObservacao(resumo, veiculoId, protecaoNaoAchou, adicionaisNaoAchou)
    };

    S.estado.reservas.push(reserva);
    return reserva;
  };

  /* A observação é onde fica registrado o que o cliente viu na
     tela e o que o sistema não conseguiu reaproveitar. É o que
     permite ao operador conferir em vez de adivinhar. */
  var montarObservacao = function (resumo, veiculoId, protecaoNaoAchou, adicionaisNaoAchou) {
    var partes = ['Solicitação recebida pelo site.'];

    if (resumo.total) {
      partes.push('Total informado pelo cliente: ' + D.fmtBRL(resumo.total) + '.');
    }
    if (resumo.recebimento) {
      partes.push('Recebimento: ' + resumo.recebimento + '.');
    }
    if (!veiculoId) {
      partes.push('O modelo solicitado não está na frota cadastrada — vincule um veículo antes de confirmar.');
    }
    if (protecaoNaoAchou) {
      partes.push('A proteção "' + resumo.protecao + '" não corresponde a nenhuma opção da tabela atual — confira antes de gerar o contrato.');
    }
    if (adicionaisNaoAchou.length) {
      partes.push('Adicional sem correspondência na tabela: ' + adicionaisNaoAchou.join(', ') + '.');
    }

    return partes.join(' ');
  };

  /* ----------------------------------------------------------
     Aviso de chegada. Aparece uma vez, no canto, e leva direto
     para a reserva que acabou de ser criada. Sem isso, a reserva
     entraria na lista e o operador não saberia que ela veio do
     site agora — a lista tem quarenta itens.
     ---------------------------------------------------------- */
  var anunciarChegada = function (reserva) {
    U.canto('Nova reserva do site: ' + reserva.codigo + '. Confira o veículo e informe o cliente.', 'aviso');
    U.navegar('#/reservas/' + reserva.id);
  };

  /* ----------------------------------------------------------
     A PONTE DO PORTAL (§6 → §7)

     O PEDIDO DE PRORROGAÇÃO FEITO PELO CLIENTE NO SITE.

     O Portal escreve os pedidos em `sessionStorage`, na chave
     `lokcar-portal-prorrogacoes`, e o sistema lê aqui — no mesmo
     lugar do boot onde o resumo da reserva já é lido, e pelo
     mesmo motivo: `sessionStorage` atravessa a navegação dentro
     da mesma aba, que é exatamente o gesto de quem pede a
     prorrogação no site e depois abre o sistema para decidir.

     POR QUE NÃO É UMA RESERVA.

     A tentação seria reaproveitar `converterResumo`. Não serve:
     uma prorrogação não é uma reserva nova — é MAIS TEMPO para um
     carro que já está na mão do cliente. Criada como reserva, ela
     apareceria na agenda como um segundo contrato do mesmo carro
     no mesmo período, e a tela de reservas acusaria um conflito
     que não existe. O caminho certo é `S.solicitarProrrogacao`,
     que é a função que o §5 definiu para isto.

     POR QUE A LOCAÇÃO É REENCONTRADA AQUI.

     O Portal identifica a locação pelo `id`, mas o sistema recria
     seu estado a cada boot — os ids da semente são estáveis
     (`l01`..`l05`), os das locações criadas nesta sessão não são.
     Por isso a locação é procurada primeiro pelo id e, se não
     existir, pela RESERVA de origem. Quando nem isso resolve, o
     pedido é DESCARTADO com registro no console, em vez de virar
     uma solicitação órfã apontando para uma locação inexistente —
     que é o tipo de dado que trava uma tela três telas depois.

     O que NÃO se faz aqui: inventar valor. `S.solicitarProrrogacao`
     recalcula tudo pela tabela do projeto. O valor estimado que o
     cliente viu NÃO é reaproveitado, e a observação da solicitação
     guarda essa diferença para o operador conferir.
     ---------------------------------------------------------- */
  var lerPedidosDoPortal = function () {
    try {
      var cru = window.sessionStorage.getItem(CHAVE_PORTAL);
      if (!cru) return [];
      var dado = JSON.parse(cru);
      var itens = (dado && dado.itens) ? dado.itens : [];
      return Object.prototype.toString.call(itens) === '[object Array]' ? itens : [];
    } catch (e) {
      return [];
    }
  };

  var limparPedidosDoPortal = function () {
    try { window.sessionStorage.removeItem(CHAVE_PORTAL); } catch (e) { /* nada a fazer */ }
  };

  /* A locação que o pedido do cliente aponta, ou null. */
  var acharLocacaoDoPedido = function (pedido) {
    var l = S.locacao(pedido.locacaoId);
    if (l) return l;

    if (pedido.reservaId) {
      var daReserva = S.estado.locacoes.filter(function (x) {
        return x.reserva === pedido.reservaId;
      })[0];
      if (daReserva) return daReserva;
    }

    return null;
  };

  /* Nome de quem pediu, para o operador saber de quem é o pedido
     sem abrir a locação. Vem do cliente da locação, e não do que o
     site mandou: o sistema não aceita identificação vinda de fora. */
  var nomeDoPedido = function (l) {
    var c = l && l.clienteId ? S.cliente(l.clienteId) : null;
    return c ? c.nome : 'Cliente não identificado';
  };

  /* ----------------------------------------------------------
     Converte os pedidos em solicitações de verdade.

     Devolve a lista das solicitações criadas, para o aviso de
     chegada saber quantas foram e para onde levar.
     ---------------------------------------------------------- */
  var importarPedidosDoPortal = function () {
    var pedidos = lerPedidosDoPortal();
    if (!pedidos.length) return [];

    /* Limpa ANTES de converter, como o resumo do site já faz: uma
       falha no meio não pode deixar o pedido voltar a cada
       recarregamento e criar solicitações duplicadas. */
    limparPedidosDoPortal();

    var criadas = [];

    pedidos.forEach(function (pedido) {
      var l = acharLocacaoDoPedido(pedido);
      if (!l) {
        /* Sem locação não há prorrogação possível. Registrar e
           seguir é melhor do que interromper a importação dos
           outros pedidos. */
        if (window.console && console.warn) {
          console.warn('Pedido de prorrogação ignorado: locação não encontrada.', pedido);
        }
        return;
      }

      var quando = String(pedido.requestedReturnAt || '').slice(0, 10);
      if (!D.ehDia(quando)) {
        if (window.console && console.warn) {
          console.warn('Pedido de prorrogação ignorado: data inválida.', pedido);
        }
        return;
      }

      /* `solicitarProrrogacao` já recusa locação encerrada e
         pedido repetido, com a mensagem certa. Não duplicar essa
         regra aqui é o que garante que o sistema tenha uma só
         resposta para o mesmo caso. */
      var res = S.solicitarProrrogacao(l.id, { quando: quando });
      if (!res || !res.ok) {
        if (window.console && console.warn) {
          console.warn('Pedido de prorrogação não registrado: ' + (res && res.mensagem), pedido);
        }
        return;
      }

      /* A ORIGEM. O operador precisa saber que este pedido veio do
         Portal, e não foi digitado por ele — é o que explica o
         texto da solicitação e o valor estimado que o cliente já
         viu na tela. */
      var e = res.extensao;
      e.origem = 'portal';
      e.solicitante = nomeDoPedido(l);
      e.obs = 'Pedido enviado pelo Portal do Cliente. O cliente viu uma estimativa de ' +
              (pedido.estimatedAdditionalValue === null ||
               pedido.estimatedAdditionalValue === undefined
                 ? 'valor a confirmar'
                 : D.fmtBRL(pedido.estimatedAdditionalValue)) +
              '; o valor da solicitação é o recalculado pela tabela do projeto.';

      criadas.push(e);
    });

    return criadas;
  };

  /* ----------------------------------------------------------
     O aviso de chegada.

     Mesmo comportamento da reserva do site: aparece depois que o
     roteador está montado e leva direto à solicitação que acabou
     de chegar. Sem isso, o pedido entraria na lista e o operador
     não saberia que ele chegou agora.

     A aprovação automática é TENTADA aqui — e só aqui — quando a
     configuração permite. É ela que respeita o §11: quando o modo
     é automático e o veículo está livre, a solicitação já chega
     decidida; quando há qualquer conflito, ela continua pendente
     para uma pessoa decidir. Nada é aprovado sem a checagem de
     agenda.
     ---------------------------------------------------------- */
  var anunciarPedidosDoPortal = function (criadas) {
    criadas.forEach(function (e) {
      var res = S.tentarAprovacaoAutomatica(e.id);
      if (res && res.ok && res.extensao && res.extensao.status === 'auto') {
        U.canto('Prorrogação aprovada automaticamente: ' + res.extensao.requestedReturnAt
          .slice(0, 10).split('-').reverse().join('/') + '.', 'ok');
      }
    });

    var primeira = criadas[0];
    var texto = criadas.length === 1
      ? 'Nova solicitação de prorrogação do Portal do Cliente.'
      : criadas.length + ' solicitações de prorrogação chegaram do Portal do Cliente.';

    U.canto(texto, 'aviso');
    U.navegar('#/prorrogacoes/' + primeira.id);
  };

  /* ----------------------------------------------------------
     LARGADA
     ---------------------------------------------------------- */
  var iniciar = function () {
    var resumo = lerResumoSite();
    var criada = null;

    if (resumo) {
      /* Limpa ANTES de criar. Se a criação falhar por qualquer
         motivo, o pedido já foi consumido — melhor uma reserva a
         menos do que uma reserva duplicada a cada recarregamento. */
      limparResumoSite();
      try {
        criada = converterResumo(resumo);
      } catch (e) {
        criada = null;
      }
    }

    /* Os pedidos de prorrogação do Portal seguem o mesmo rito, e
       ANTES de `U.iniciar()`: eles dependem de `S` (sessão), que
       já está pronta neste ponto, e não de `U`. */
    var pedidos = [];
    try {
      pedidos = importarPedidosDoPortal();
    } catch (e) {
      pedidos = [];
    }

    U.iniciar();

    if (criada) {
      /* O aviso vem depois de `iniciar()` para que o roteador já
         esteja montado e o `navegar()` funcione. */
      setTimeout(function () { anunciarChegada(criada); }, 320);
    }

    /* Se as duas pontes vierem juntas, a prorrogação tem
       PRIORIDADE no aviso: ela é um pedido de decisão que trava a
       agenda de um carro que já está na rua, e a reserva é um
       pedido que ainda vai ser analisado com calma. A reserva
       continua criada e visível — muda só para onde a tela abre. */
    if (pedidos.length) {
      setTimeout(function () { anunciarPedidosDoPortal(pedidos); }, 420);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
