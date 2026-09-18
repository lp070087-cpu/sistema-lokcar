/* ============================================================
   LOK CAR — SISTEMA · contrato.js
   ------------------------------------------------------------
   O ÚNICO LUGAR DO SISTEMA ONDE EXISTE TEXTO DE CONTRATO.

   O pedido foi direto: "Não espalhe texto do contrato por vários
   lugares. Crie um template centralizado." É o que este arquivo
   é. A tela de contratos não escreve cláusula nenhuma; ela
   chama `montar()` e imprime o que voltar.

   DUAS COISAS QUE ESTE ARQUIVO NÃO FAZ, DE PROPÓSITO:

   1) NÃO INVENTA DADO JURÍDICO. Razão social, CNPJ, endereço,
      representante legal, caução, franquia, multa, juros,
      tolerância, política de combustível, limite de quilometragem
      — nada disso tem valor aqui. Quando o dado existe (porque a
      Lok Car preencheu em Configurações), ele entra. Quando não
      existe, entra a marcação `[[PENDENTE:...]]`, que a interface
      desenha como um realce âmbar. Um contrato que saísse daqui
      com "CNPJ: 00.000.000/0000-00" seria um documento falso.

   2) NÃO FINJE ASSINATURA DIGITAL. Não há campo de assinatura
      eletrônica, não há hash, não há "assinado em" automático. O
      que existe é a estrutura de assinatura preparada — as duas
      linhas de assinatura em papel, com nome, documento e data —
      e um aviso dizendo que a coleta digital depende de backend.
      Fingir assinatura num contrato de locação seria o pior tipo
      de mentira que este sistema poderia contar.

   O QUE ESTE ARQUIVO SABE É O FORMATO. As 18 cláusulas, a ordem,
   a estrutura, o rodapé de modelo demonstrativo. Isso é redação
   de modelo, e é justamente o que o pedido mandou criar.
   ============================================================ */

window.LOKCAR_CONTRATO = (function () {
  'use strict';

  var D = window.LOKCAR_DADOS;

  var AVISO_MODELO = 'MODELO DEMONSTRATIVO — SUJEITO À REVISÃO JURÍDICA E À DEFINIÇÃO DAS POLÍTICAS DA LOCADORA.';

  /* ==========================================================
     1 · PENDÊNCIA
     ----------------------------------------------------------
     Uma pendência é um dado que o contrato precisa e que
     ninguém forneceu. Ela viaja junto com o texto para que a
     pré-visualização saiba destacar exatamente onde falta
     informação — sem que o texto precise carregar marcação
     visível.
     ========================================================== */
  var pend = function (oQue, deOnde) {
    return { pendente: true, oQue: oQue, deOnde: deOnde };
  };

  var texto = function (v) {
    return { pendente: false, valor: String(v === 0 ? '0' : (v || '')) };
  };

  /* Um dado da empresa: se estiver vazio, vira pendência com o
     caminho exato onde preencher. É isso que permite ao operador
     clicar e ir direto ao campo. */
  var daEmpresa = function (campo, rotulo) {
    var e = window.LOKCAR_SESSAO.empresa();
    var v = e[campo];
    if (v === null || v === undefined || String(v).trim() === '') {
      return pend(rotulo, { tela: '#/configuracoes', campo: campo });
    }
    return texto(v);
  };

  /* Um valor de regra. Enquanto a Lok Car não definir, escreve-se
     que será definido — nunca um número escolhido por nós. */
  var daRegra = function (id, rotulo) {
    var r = window.LOKCAR_SESSAO.regras().filter(function (x) { return x.id === id; })[0];
    if (!r) return pend(rotulo, { tela: '#/configuracoes', campo: id });
    if (r.valor === null || r.valor === undefined) {
      return pend(rotulo, { tela: '#/configuracoes', campo: id });
    }
    var unidade = r.unidade === 'R$' ? 'R$ ' + D.fmtBRL(r.valor).replace('R$ ', '')
                : (r.unidade ? r.valor + ' ' + r.unidade : String(r.valor));
    return texto(unidade);
  };

  /* Quando a regra tem OPÇÕES (política de combustível, multa,
     cancelamento), o que foi escolhido é guardado em `valor`
     como texto, não como número. */
  var daOpcao = function (id, rotulo) {
    var r = window.LOKCAR_SESSAO.regras().filter(function (x) { return x.id === id; })[0];
    if (!r || r.valor === null || r.valor === undefined || r.valor === '') {
      return pend(rotulo, { tela: '#/configuracoes', campo: id });
    }
    return texto(r.valor);
  };

  /* ==========================================================
     2 · FICHA DE CADA BLOCO
     ----------------------------------------------------------
     Cada bloco do contrato é uma lista de pares rótulo/valor.
     A função `ficha()` transforma uma lista dessas em linhas
     prontas para desenhar, e é o que mantém todas as seções com
     a mesma cara sem repetir marcação.
     ========================================================== */
  var linha = function (rotulo, valor) {
    return { rotulo: rotulo, valor: valor };
  };

  /* ==========================================================
     3 · MONTAGEM
     ----------------------------------------------------------
     `montar(k)` recebe um contrato e devolve a estrutura
     completa: identificação, blocos e cláusulas. Nada aqui lê o
     DOM. É por isso que o mesmo `montar()` serve para a
     pré-visualização na tela e para a impressão.
     ========================================================== */
  var montar = function (k) {
    var S = window.LOKCAR_SESSAO;

    var ehModelo = Boolean(k && k.modelo);
    var reserva = k && k.reserva ? S.reserva(k.reserva) : null;
    var locacao = (k && k.locacao ? S.locacao(k.locacao) : null) || (reserva ? S.locacaoDaReserva(reserva.id) : null);

    /* CONTRATO AVULSO (§15).
       O contrato nascido no balcão não tem reserva de origem, mas
       TEM locatário e veículo — o operador escolheu os dois. Sem
       as duas linhas abaixo, esse contrato procuraria o cliente
       através de uma reserva que não existe e imprimiria
       "Locatário: a definir" com o nome escolhido a um palmo de
       distância, na tela anterior. É o mesmo dado, por outro
       caminho. */
    var cliente = (reserva && reserva.clienteId ? S.cliente(reserva.clienteId) : null) ||
                  (k && k.cliente ? S.cliente(k.cliente) : null);
    var veiculo = (reserva ? S.veiculo(reserva.veiculoId) : null) ||
                  (k && k.veiculo ? S.veiculo(k.veiculo) : null);
    var preco = reserva ? D.preco(reserva) : null;

    /* ------------------------------------------------------------
       CONTRATO DEMONSTRATIVO
       ------------------------------------------------------------
       O contrato que existe em CONTRATOS → CONTRATO DEMONSTRATIVO
       não aponta para reserva nenhuma: ele existe para mostrar o
       formato. Por isso ele usa "Cliente Demonstração", documentos
       mascarados e valores de exemplo — e é o ÚNICO que faz isso.
       Todo contrato real escreve "Cliente não informado" quando o
       cliente não existe, jamais um nome inventado.
       ------------------------------------------------------------ */
    var nomeCliente, docCliente, endCliente, cnhCliente;

    if (ehModelo) {
      nomeCliente = texto('Cliente Demonstração');
      docCliente = texto('***.***.***-** (fictício)');
      endCliente = texto('Endereço de exemplo — dado fictício');
      cnhCliente = texto('*** *** *** ** — categoria B (fictício)');
    } else if (cliente) {
      nomeCliente = texto(cliente.nome);
      docCliente = texto(cliente.doc);
      var e = cliente.endereco;
      endCliente = texto(
        [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ') +
        (e.bairro ? ' — ' + e.bairro : '') +
        (e.cidade ? ', ' + e.cidade : '') +
        (e.uf ? '/' + e.uf : '') +
        (e.cep ? ' · CEP ' + e.cep : '')
      );
      cnhCliente = cliente.cnh
        ? texto(cliente.cnh.numero + ' — categoria ' + (cliente.cnh.categoria || '—') +
                (cliente.cnh.validade ? ' · validade ' + D.fmtData(cliente.cnh.validade) : ''))
        : pend('CNH do locatário', { tela: '#/clientes', campo: 'cnh' });
    } else {
      nomeCliente = pend('Locatário', { tela: '#/reservas', campo: 'clienteId' });
      docCliente = pend('CPF/CNPJ do locatário', { tela: '#/reservas', campo: 'clienteId' });
      endCliente = pend('Endereço do locatário', { tela: '#/clientes', campo: 'endereco' });
      cnhCliente = pend('CNH do locatário', { tela: '#/clientes', campo: 'cnh' });
    }

    var nomeVeiculo = veiculo ? texto(veiculo.modelo) : pend('Veículo', { tela: '#/reservas', campo: 'veiculoId' });
    var placaVeiculo = veiculo ? texto(veiculo.placa) : pend('Placa', { tela: '#/reservas', campo: 'veiculoId' });

    var periodo, diasTxt;
    if (reserva) {
      diasTxt = texto(reserva.dias + (reserva.dias === 1 ? ' diária' : ' diárias'));
      periodo = texto(
        D.fmtData(reserva.de) + ' às ' + (reserva.retiradaHora || '—') +
        '  até  ' +
        D.fmtData(reserva.ate) + ' às ' + (reserva.devolucaoHora || '—')
      );
    } else {
      diasTxt = pend('Prazo da locação', { tela: '#/reservas', campo: 'dias' });
      periodo = pend('Período da locação', { tela: '#/reservas', campo: 'de' });
    }

    /* Valores. O contrato NUNCA arredonda nem recalcula: ele
       imprime o que `preco()` devolveu, que é a mesma conta da
       tela de reserva do site. Quando o preço está incompleto
       (modelo sem tabela, ou adicional "sob consulta"), a linha
       também fica pendente — porque um total que não fecha não
       pode virar cláusula contratual. */
    var valores = [];
    if (ehModelo) {
      valores = [
        linha('Diária', texto('Valor de exemplo — a definir pela locadora')),
        linha('Período', texto('Período de exemplo')),
        linha('Proteção', texto('Nível escolhido pelo locatário')),
        linha('Adicionais', texto('Conforme seleção')),
        linha('Taxa de entrega', texto('Quando houver entrega em endereço')),
        linha('Total', pend('Total da locação — depende das políticas da locadora',
                            { tela: '#/configuracoes', campo: 'caucao' }))
      ];
    } else if (preco) {
      valores.push(linha('Diária', preco.diaria === null
        ? pend('Diária deste modelo', { tela: '#/frota', campo: 'diaria' })
        : texto(D.fmtBRL(preco.diaria))));
      valores.push(linha('Diárias (' + preco.dias + ')', texto(
        preco.bruto === null ? '—' : D.fmtBRL(preco.bruto))));
      valores.push(linha('Desconto aplicado', texto(
        preco.pct ? preco.pct + '% — ' + D.fmtBRL(preco.desconto) : 'Sem desconto')));
      valores.push(linha('Proteção — ' + (preco.protecaoNome || 'Sem proteção'), texto(
        D.fmtBRL(preco.protTotal))));
      preco.adicionais.forEach(function (a) {
        valores.push(linha('Adicional — ' + a.nome, a.sobConsulta
          ? pend('Valor do adicional "' + a.nome + '"', { tela: '#/configuracoes', campo: 'adicionais' })
          : texto(a.valor)));
      });
      valores.push(linha('Taxa de entrega', texto(preco.taxa ? D.fmtBRL(preco.taxa) : 'Não se aplica')));
      valores.push(linha('Total', preco.incompleto
        ? pend('Total — falta valor para fechar a conta', { tela: '#/configuracoes', campo: 'caucao' })
        : texto(D.fmtBRL(preco.total))));

      valores.push(linha('Caução', daRegra('caucao', 'Valor de caução')));
      valores.push(linha('Franquia', daRegra('franquia', 'Valor de franquia')));
      valores.push(linha('Forma de recebimento', texto(
        reserva.pagamento === 'pago' ? 'Pago' : 'A combinar na retirada')));
    }

    /* ------------------------------------------------------------
       DADOS DA EMPRESA (a locadora)
       Cada campo vazio vira uma pendência apontando para
       Configurações › Empresa. É o mecanismo que o pedido pediu:
       "esses dados deverão alimentar automaticamente os
       contratos" — e, enquanto não existirem, "Dado a configurar".
       ------------------------------------------------------------ */
    var locadora = [
      linha('Razão social', daEmpresa('razaoSocial', 'Razão social da locadora')),
      linha('Nome fantasia', daEmpresa('nomeFantasia', 'Nome fantasia')),
      linha('CNPJ', daEmpresa('cnpj', 'CNPJ da locadora')),
      linha('Inscrição estadual', daEmpresa('inscricaoEstadual', 'Inscrição estadual')),
      linha('Endereço', daEmpresa('endereco', 'Endereço da locadora')),
      linha('Cidade', daEmpresa('cidade', 'Cidade')),
      linha('UF', daEmpresa('uf', 'UF')),
      linha('Telefone', daEmpresa('telefone', 'Telefone')),
      linha('E-mail', daEmpresa('email', 'E-mail da locadora')),
      linha('Representante legal', daEmpresa('representante', 'Representante legal')),
      linha('Cargo do representante', daEmpresa('representanteCargo', 'Cargo do representante'))
    ];

    var locatario = [
      linha('Nome / Razão social', nomeCliente),
      linha('CPF / CNPJ', docCliente),
      linha('Endereço', endCliente),
      linha('CNH', cnhCliente),
      linha('Telefone', cliente ? texto(cliente.telefone) : pend('Telefone do locatário', { tela: '#/clientes', campo: 'telefone' })),
      linha('E-mail', cliente ? texto(cliente.email) : pend('E-mail do locatário', { tela: '#/clientes', campo: 'email' }))
    ];

    var identificacaoVeiculo = [
      linha('Marca / Modelo', nomeVeiculo),
      linha('Placa', placaVeiculo),
      linha('Ano', veiculo ? texto(veiculo.ano) : pend('Ano do veículo', { tela: '#/frota', campo: 'ano' })),
      linha('Categoria', veiculo ? texto(veiculo.categoria) : pend('Categoria', { tela: '#/frota', campo: 'categoria' })),
      linha('Cor', veiculo ? texto(veiculo.cor) : pend('Cor', { tela: '#/frota', campo: 'cor' })),
      linha('Câmbio', veiculo ? texto(veiculo.cambio) : pend('Câmbio', { tela: '#/frota', campo: 'cambio' })),
      linha('Quilometragem na entrega', locacao && locacao.kmSaida
        ? texto(locacao.kmSaida.toLocaleString('pt-BR') + ' km')
        : texto('Registrada na vistoria de saída'))
    ];

    var periodoBloco = [
      linha('Retirada', periodo.pendente ? periodo : texto(
        D.fmtData(reserva.de) + ' às ' + (reserva.retiradaHora || '—'))),
      linha('Devolução prevista', reserva ? texto(
        D.fmtData(reserva.ate) + ' às ' + (reserva.devolucaoHora || '—'))
        : pend('Devolução prevista', { tela: '#/reservas', campo: 'ate' })),
      linha('Prazo', diasTxt),
      linha('Local de retirada', reserva ? texto(descreverPonto(reserva, 'retirada')) : pend('Local de retirada', { tela: '#/reservas', campo: 'retiradaModo' })),
      linha('Local de devolução', reserva ? texto(descreverPonto(reserva, 'devolucao')) : pend('Local de devolução', { tela: '#/reservas', campo: 'devolucaoModo' }))
    ];

    /* ------------------------------------------------------------
       CLÁUSULAS
       ------------------------------------------------------------
       Dezoito cláusulas. As que dependem de política da locadora
       recebem a pendência e escrevem "a definir pela locadora" —
       nunca uma condição inventada. As de redação geral (foro,
       vistoria, responsabilidade) são texto de modelo
       demonstrativo, e é exatamente por isso que o rodapé do
       documento diz que ele está sujeito a revisão jurídica.
       ------------------------------------------------------------ */
    var clausulas = [
      {
        n: 1, t: 'DO OBJETO',
        p: ['A LOCADORA cede ao LOCATÁRIO, em regime de locação, o veículo identificado neste contrato, ' +
            'destinado exclusivamente ao uso particular, sendo vedada a sublocação, a cessão, o empréstimo ou ' +
            'qualquer forma de transferência do veículo a terceiros sem autorização escrita da LOCADORA.']
      },
      {
        n: 2, t: 'DO PRAZO',
        p: ['A locação tem o prazo indicado no bloco PERÍODO, contado a partir da entrega efetiva do veículo, ' +
            'comprovada pela vistoria de saída.', {
              regra: 'toleranciaAtraso',
              antes: 'A tolerância para devolução após o horário previsto é de ',
              depois: '.'
            }]
      },
      {
        n: 3, t: 'DO PAGAMENTO',
        p: ['O LOCATÁRIO paga à LOCADORA o valor indicado no bloco VALORES, na forma e na data nele ' +
            'consignadas. O pagamento não desobriga o LOCATÁRIO de responder por danos, multas e encargos ' +
            'posteriores à devolução.', {
              regra: 'juros',
              antes: 'Encargos sobre valores em atraso: ',
              depois: '.'
            }]
      },
      {
        n: 4, t: 'DA CAUÇÃO',
        p: [{
              regra: 'caucao',
              antes: 'O LOCATÁRIO entrega, na retirada, a título de caução, o valor de ',
              depois: ', a ser devolvido após a vistoria de devolução, descontados eventuais danos, ' +
                      'multas e valores em aberto.'
            },
            'A devolução da caução não implica quitação do LOCATÁRIO por obrigações descobertas depois.']
      },
      {
        n: 5, t: 'DA FRANQUIA E DAS PROTEÇÕES',
        p: [{
              regra: 'franquia',
              antes: 'A responsabilidade do LOCATÁRIO por danos ao veículo limita-se ao valor de franquia de ',
              depois: ', conforme o nível de proteção contratado.'
            },
            'Os níveis de proteção oferecidos pela LOCADORA dependem da definição das coberturas, ' +
            'que é política da locadora e não está definida no sistema.']
      },
      {
        n: 6, t: 'DA QUILOMETRAGEM',
        p: [{
              regra: 'quilometragem',
              antes: 'A quilometragem da locação é ',
              depois: '.'
            },
            'A quilometragem inicial é a registrada na vistoria de saída e a final é a registrada na vistoria ' +
            'de devolução, cujos apontamentos prevalecem sobre qualquer alegação posterior.']
      },
      {
        n: 7, t: 'DO COMBUSTÍVEL',
        p: [{
              regra: 'combustivel',
              antes: 'Política de combustível: ',
              depois: '.'
            },
            'O nível de combustível na entrega e na devolução é o registrado nas vistorias, que acompanham ' +
            'este contrato.']
      },
      {
        n: 8, t: 'DO USO E DA CONSERVAÇÃO',
        p: ['O LOCATÁRIO obriga-se a manter o veículo em bom estado de conservação, a zelar pelo seu uso ' +
            'regular e a comunicar imediatamente à LOCADORA qualquer acidente, avaria, furto ou apreensão, ' +
            'ainda que de terceiros, apresentando o boletim de ocorrência quando cabível.']
      },
      {
        n: 9, t: 'DAS VEDAÇÕES',
        p: ['É vedado ao LOCATÁRIO: conduzir o veículo em desacordo com a legislação de trânsito; permitir ' +
            'sua condução por pessoa não habilitada ou não indicada; utilizá-lo em competições, provas, ' +
            'treinos ou testes; utilizá-lo para transporte remunerado de passageiros ou de carga; ' +
            'transportar produto ilícito; e retirar o veículo do território nacional sem autorização escrita.']
      },
      {
        n: 10, t: 'DAS MULTAS E INFRAÇÕES',
        p: ['Correm por conta do LOCATÁRIO todas as multas, taxas, pedágios, estacionamentos e encargos ' +
            'relativos ao período em que o veículo esteve sob sua posse, ainda que notificadas após a ' +
            'devolução, incluindo os valores repassados pela LOCADORA e o custo administrativo de ' +
            'transferência da responsabilidade.', {
              regra: 'multasAdministrativas',
              antes: 'Custo administrativo por multa: ',
              depois: '.'
            }]
      },
      {
        n: 11, t: 'DA DEVOLUÇÃO',
        p: ['O LOCATÁRIO devolve o veículo no local, na data e no horário indicados no bloco PERÍODO, ' +
            'nas mesmas condições da entrega, ressalvado o desgaste natural decorrente do uso regular. ' +
            'A devolução fora do prazo depende de autorização prévia da LOCADORA.', {
              regra: 'multaAtraso',
              antes: 'Atraso na devolução: ',
              depois: '.'
            }]
      },
      {
        n: 12, t: 'DA VISTORIA',
        p: ['A vistoria de saída registra o estado do veículo na entrega e a vistoria de devolução registra ' +
            'o estado na restituição. Ambas são assinadas pelas partes, valem como prova do estado do ' +
            'veículo e integram este contrato para todos os efeitos.']
      },
      {
        n: 13, t: 'DA RESPONSABILIDADE CIVIL E PENAL',
        p: ['O LOCATÁRIO responde civil e criminalmente por todos os atos praticados com o veículo durante ' +
            'a locação, incluindo danos a terceiros, respondendo por si e por quem o conduza. Nada nesta ' +
            'cláusula transfere à LOCADORA responsabilidade que a lei lhe atribua.']
      },
      {
        n: 14, t: 'DO SEGURO E DA INDENIZAÇÃO',
        p: ['As coberturas de proteção e os valores de indenização são política da LOCADORA e dependem de ' +
            'definição, assim como a eventual existência de seguro próprio. Enquanto não definidos, ' +
            'prevalece o valor de franquia indicado na cláusula 5.', {
              regra: 'franquia',
              antes: 'Franquia aplicável: ',
              depois: '.'
            }]
      },
      {
        n: 15, t: 'DA RESCISÃO',
        p: ['A LOCADORA pode rescindir o contrato e retomar o veículo, independentemente de notificação, ' +
            'em caso de descumprimento de qualquer obrigação, de uso indevido ou de inadimplemento, ' +
            'respondendo o LOCATÁRIO pelos valores devidos até a efetiva devolução.']
      },
      {
        n: 16, t: 'DO CANCELAMENTO DA RESERVA',
        p: [{
              regra: 'cancelamento',
              antes: 'Política de cancelamento: ',
              depois: '.'
            },
            'O cancelamento não exime o LOCATÁRIO de responder pelos valores já devidos conforme a política ' +
            'acima.']
      },
      {
        n: 17, t: 'DA PROTEÇÃO DE DADOS',
        p: ['As partes declaram que os dados pessoais informadas neste contrato são tratados para as ' +
            'finalidades da locação, do cumprimento de obrigações legais e do exercício regular de direitos, ' +
            'nos termos da Lei nº 13.709/2018, mantendo-se as partes os dados sob sigilo.']
      },
      {
        n: 18, t: 'DO FORO',
        p: ['As partes elegem o foro da comarca da sede da LOCADORA para dirimir qualquer controvérsia ' +
            'decorrente deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.']
      }
    ];

    return {
      aviso: AVISO_MODELO,
      modelo: ehModelo,
      codigo: (k && k.codigo) || '—',
      titulo: 'CONTRATO DE LOCAÇÃO DE VEÍCULO',
      status: k ? k.status : 'rascunho',
      statusRotulo: k ? D.acharStatus(D.STATUS_CONTRATO, k.status).rotulo : 'Rascunho',
      blocos: [
        { id: 'locadora', t: 'IDENTIFICAÇÃO DA LOCADORA', linhas: locadora },
        { id: 'locatario', t: 'IDENTIFICAÇÃO DO LOCATÁRIO', linhas: locatario },
        { id: 'veiculo', t: 'IDENTIFICAÇÃO DO VEÍCULO', linhas: identificacaoVeiculo },
        { id: 'periodo', t: 'PERÍODO', linhas: periodoBloco },
        { id: 'valores', t: 'VALORES', linhas: valores }
      ],
      clausulas: clausulas,
      reserva: reserva,
      locacao: locacao,
      cliente: cliente,
      veiculo: veiculo,
      preco: preco,

      /* Assinatura PREPARADA, não fingida. `via` diz como o
         contrato está sendo assinado nesta fase — sempre em
         papel ou por meio externo, nunca pelo sistema. */
      assinatura: {
        local: daEmpresa('cidade', 'Cidade da assinatura'),
        data: D.HOJE,
        partes: [
          { papel: 'LOCADORA', nome: daEmpresa('representante', 'Representante legal'), doc: daEmpresa('representanteDoc', 'Documento do representante') },
          { papel: 'LOCATÁRIO', nome: nomeCliente, doc: docCliente }
        ],
        nota: 'Assinatura em papel. O sistema não coleta assinatura digital nesta fase.'
      },

      /* Tudo o que ficou faltando, achatado numa lista só. É o que
         alimenta o aviso no topo da pré-visualização: "faltam 6
         dados da Lok Car para este contrato sair completo". */
      pendentes: coletarPendentes(locadora, locatario, identificacaoVeiculo, periodoBloco, valores, clausulas)
    };
  };

  /* Descreve onde o veículo é retirado ou devolvido, do mesmo
     jeito que a tela de reserva do site descreve. */
  var descreverPonto = function (r, qual) {
    var modo = qual === 'retirada' ? r.retiradaModo : r.devolucaoModo;
    var end = qual === 'retirada' ? r.retiradaEndereco : r.devolucaoEndereco;
    if (modo === 'locadora') return 'Na unidade da LOCADORA';
    if (!end) return 'Endereço a confirmar';
    return [end.logradouro, end.numero, end.complemento].filter(Boolean).join(', ') +
           (end.bairro ? ' — ' + end.bairro : '') +
           (end.cidade ? ', ' + end.cidade : '') + (end.uf ? '/' + end.uf : '');
  };

  /* Percorre blocos e cláusulas juntando toda pendência. O texto
     de cada cláusula pode ser uma string (redação fixa) ou um
     objeto com `regra`, que é onde mora a pendência. */
  var coletarPendentes = function () {
    var lista = [];
    var vistos = {};

    var visita = function (v) {
      if (!v || !v.pendente) return;
      var chave = v.oQue;
      if (vistos[chave]) return;
      vistos[chave] = true;
      lista.push(v);
    };

    Array.prototype.slice.call(arguments).forEach(function (bloco) {
      if (!bloco) return;
      bloco.forEach(function (linhaOuClausula) {
        if (linhaOuClausula && linhaOuClausula.linhas) {
          linhaOuClausula.linhas.forEach(function (l) { visita(l.valor); });
        } else if (linhaOuClausula && linhaOuClausula.t) {
          linhaOuClausula.p.forEach(function (p) {
            if (typeof p === 'object' && p.regra) lista.push(p);
          });
        }
      });
    });

    /* As regras aparecem como objetos `{regra:...}` dentro das
       cláusulas; viram pendência aqui, com o mesmo formato das
       outras, para a interface tratar tudo igual. */
    return lista.filter(function (item) {
      if (item.pendente) return true;
      if (!item.regra) return false;
      var r = window.LOKCAR_SESSAO.regras().filter(function (x) { return x.id === item.regra; })[0];
      if (r && r.valor !== null && r.valor !== undefined && r.valor !== '') return false;
      item.pendente = true;
      item.oQue = (r ? r.nome : item.regra);
      item.deOnde = { tela: '#/configuracoes', campo: item.regra };
      return true;
    });
  };

  /* Quantas pendências são de DADOS DA LOK CAR (empresa ou regra)
     e quantas são de dados do cliente/veículo. O aviso separa as
     duas coisas porque a ação é diferente: uma depende da
     locadora, a outra do cadastro. */
  var resumoPendentes = function (c) {
    var daLocadora = 0, doCadastro = 0;
    c.pendentes.forEach(function (p) {
      if (p.pendente && p.deOnde && p.deOnde.tela === '#/configuracoes') daLocadora += 1;
      else doCadastro += 1;
    });
    return { locadora: daLocadora, cadastro: doCadastro, total: c.pendentes.length };
  };

  /* ==========================================================
     4 · TEXTO PURO
     ----------------------------------------------------------
     Para "copiar o contrato" e para impressão em que não se
     queira a marcação visual. Aqui as pendências viram texto
     simples entre colchetes — porque um contrato copiado para
     um editor precisa continuar legível.
     ========================================================== */
  var render = function (valor) {
    if (!valor) return '—';
    if (valor.pendente) return '[A DEFINIR: ' + valor.oQue + ']';
    return valor.valor;
  };

  var paraTexto = function (c) {
    var linhas = [];

    linhas.push(c.titulo);
    linhas.push('Contrato ' + c.codigo);
    if (c.modelo) linhas.push(AVISO_MODELO);
    linhas.push('');

    c.blocos.forEach(function (b) {
      linhas.push('== ' + b.t + ' ==');
      b.linhas.forEach(function (l) {
        linhas.push(l.rotulo + ': ' + render(l.valor));
      });
      linhas.push('');
    });

    linhas.push('== CLÁUSULAS ==');
    linhas.push('');
    c.clausulas.forEach(function (cl) {
      linhas.push('CLÁUSULA ' + cl.n + ' — ' + cl.t);
      cl.p.forEach(function (p) {
        var s;
        if (typeof p === 'string') {
          s = p;
        } else {
          var r = window.LOKCAR_SESSAO.regras().filter(function (x) { return x.id === p.regra; })[0];
          var v = (r && r.valor !== null && r.valor !== undefined && r.valor !== '')
            ? (r.unidade === 'R$' ? 'R$ ' + D.fmtBRL(r.valor).replace('R$ ', '') : String(r.valor))
            : '[A DEFINIR PELA LOCADORA]';
          s = p.antes + v + p.depois;
        }
        linhas.push('  ' + s);
      });
      linhas.push('');
    });

    linhas.push('== ASSINATURA ==');
    linhas.push(render(c.assinatura.local) + ', ' + D.fmtData(c.assinatura.data));
    linhas.push('');
    c.assinatura.partes.forEach(function (p) {
      linhas.push('_______________________________________');
      linhas.push(p.papel + ' — ' + render(p.nome) + ' · ' + render(p.doc));
      linhas.push('');
    });
    linhas.push(c.assinatura.nota);
    linhas.push('');
    linhas.push(AVISO_MODELO);

    return linhas.join('\n');
  };

  return {
    AVISO_MODELO: AVISO_MODELO,
    montar: montar,
    render: render,
    paraTexto: paraTexto,
    resumoPendentes: resumoPendentes,
    descreverPonto: descreverPonto
  };
})();
