/* ============================================================
   LOK CAR — config.js
   ------------------------------------------------------------
   ÚNICO lugar onde vivem os números da demonstração de reserva.
   Nada de valor solto no HTML ou no app.js: para mudar um preço,
   um desconto ou um serviço, mexa SOMENTE aqui.

   ATENÇÃO — LEIA ANTES DE ALTERAR
   Os valores abaixo são ILUSTRATIVOS. Servem para mostrar como a
   tela de reserva vai funcionar. Eles NÃO são a tabela comercial
   da Lok Car e não foram fornecidos pela locadora. Antes de ir
   ao ar, cada número precisa ser confirmado pelo proprietário.

   Também não há, nesta versão, nenhuma cobertura de seguro
   descrita: as proteções são apenas nomes e valores de exemplo,
   sem franquia, sem indenização e sem promessa de cobertura.
   Os textos de cada proteção usam de propósito "exemplo",
   "consulte condições" e "conforme contrato".
   ============================================================ */

window.LOKCAR_CONFIG = (function () {
  'use strict';

  /* ----------------------------------------------------------
     1 · VEÍCULOS

     A CHAVE precisa bater exatamente com o atributo data-model
     usado no index.html (tanto nos cards da frota quanto no
     seletor da reserva). Se um nome for escrito diferente aqui,
     o card daquele carro fica sem preço e sem seleção.

     `diariaMin` e `diariaMax` formam a faixa exibida no card.
     ---------------------------------------------------------- */
  var veiculos = {
    'Porsche 911':            { diariaMin: 700, diariaMax: 900 },
    'Porsche Cayenne':        { diariaMin: 700, diariaMax: 900 },
    'Mercedes-Benz Classe C': { diariaMin: 400, diariaMax: 600 },
    'Audi A5 Sportback':      { diariaMin: 400, diariaMax: 600 },
    'Hyundai HB20':           { diariaMin: 150, diariaMax: 220 },
    'Chevrolet Onix Plus':    { diariaMin: 150, diariaMax: 220 }
  };

  /* Valor usado na SIMULAÇÃO do total.
     A faixa exibida no card é diariaMin–diariaMax; o cálculo
     precisa de um número só, então usamos o piso da faixa. */
  var diariaParaCalculo = 'min';

  /* ----------------------------------------------------------
     2 · DESCONTO PROGRESSIVO POR DIÁRIAS
     Quanto mais dias, maior o desconto. Vale a MAIOR faixa
     cujo `minDias` o período alcança.
     ---------------------------------------------------------- */
  var descontos = [
    { minDias: 7, percentual: 10 },
    { minDias: 4, percentual: 7 },
    { minDias: 3, percentual: 5 },
    { minDias: 2, percentual: 3 },
    { minDias: 1, percentual: 0 }
  ];

  /* ----------------------------------------------------------
     3 · PROTEÇÃO DO VEÍCULO
     Valores por dia. Repetimos: são ILUSTRATIVOS e não descrevem
     cobertura, franquia ou indenização de nenhum tipo.
     `id` vazio = opção "sem proteção adicional".

     `detalhes` alimenta o botão "Ver detalhes" de cada card.
     Nenhuma linha promete cobertura: são níveis de uma
     demonstração, e as condições ficam com a locadora.
     ---------------------------------------------------------- */
  var protecoes = [
    {
      id: '',
      nome: 'Sem proteção adicional',
      descricao: 'Você segue com a cobertura básica já incluída na locação.',
      valorDia: 0,
      detalhes: [
        'Nenhum valor de proteção entra no cálculo da diária.',
        'Você segue com as condições padrão já previstas na locação.',
        'Condições finais conforme contrato, informadas pela equipe.'
      ]
    },
    {
      id: 'simples',
      nome: 'Proteção Simples',
      descricao: 'Uma camada extra de tranquilidade para o seu período.',
      valorDia: 29,
      detalhes: [
        'Nível mais leve das opções desta demonstração.',
        'Costuma ser escolhida em roteiros curtos, de 1 a 3 dias.',
        'Franquia e condições definidas pela locadora.',
        'Exemplo demonstrativo — consulte condições no atendimento.'
      ]
    },
    {
      id: 'basica',
      nome: 'Proteção Básica',
      descricao: 'Opção intermediária, a mais escolhida nos roteiros maiores.',
      valorDia: 59,
      detalhes: [
        'Nível intermediário das opções desta demonstração.',
        'Costuma ser escolhida em roteiros de vários dias.',
        'Franquia e condições definidas pela locadora.',
        'Exemplo demonstrativo — consulte condições no atendimento.'
      ]
    },
    {
      id: 'completa',
      nome: 'Proteção Completa',
      descricao: 'A opção mais ampla desta demonstração.',
      valorDia: 99,
      detalhes: [
        'Nível mais amplo entre as opções desta demonstração.',
        'Costuma ser escolhida em períodos longos e viagens.',
        'Franquia e condições definidas pela locadora.',
        'Exemplo demonstrativo — consulte condições no atendimento.'
      ]
    }
  ];

  /* ----------------------------------------------------------
     4 · SERVIÇOS ADICIONAIS

     `valorFixo` é cobrado uma vez. `sobConsulta` mostra "Sob
     consulta" no lugar do preço e não entra no total — porque
     depende do endereço e da distância.

     `permiteQtd` liga o controle de quantidade (− 1 +) no card
     e multiplica o valor pelo número escolhido. `maxQtd` é o
     teto do controle, para a demonstração não virar carrinho
     de supermercado.
     ---------------------------------------------------------- */
  var adicionais = [
    {
      id: 'lavagem',
      nome: 'Lavagem na devolução',
      descricao: 'Devolvemos o carro lavado, sem você precisar parar.',
      valorFixo: 50,
      sobConsulta: false,
      permiteQtd: false
    },
    {
      id: 'lavagem-premium',
      nome: 'Lavagem premium',
      descricao: 'Limpeza detalhada, interna e externa.',
      valorFixo: 90,
      sobConsulta: false,
      permiteQtd: false
    },
    {
      id: 'motorista',
      nome: 'Motorista adicional',
      descricao: 'Segundo condutor autorizado na locação.',
      valorFixo: 150,
      sobConsulta: false,
      permiteQtd: false
    },
    {
      id: 'cadeirinha',
      nome: 'Cadeirinha infantil',
      descricao: 'Para crianças de até 4 anos.',
      valorFixo: 40,
      sobConsulta: false,
      permiteQtd: true,
      maxQtd: 3
    },
    {
      id: 'assento',
      nome: 'Assento de elevação',
      descricao: 'Para crianças de 4 a 7 anos.',
      valorFixo: 30,
      sobConsulta: false,
      permiteQtd: true,
      maxQtd: 3
    },
    {
      id: 'entrega',
      nome: 'Entrega e retirada',
      descricao: 'Vamos até você buscar e devolver o veículo.',
      valorFixo: 0,
      sobConsulta: true,
      permiteQtd: false
    }
  ];

  /* ----------------------------------------------------------
     5 · TAXA DE ENTREGA

     Entra no cálculo SOMENTE quando o cliente escolhe receber
     ou devolver o veículo em um endereço (ver a decisão de
     retirada/entrega na seção de reserva). É um valor único de
     demonstração — na operação real ele depende da região.
     ---------------------------------------------------------- */
  var taxaEntrega = {
    valor: 80,
    rotulo: 'Taxa de entrega',
    nota: 'Valor demonstrativo. Na operação real, a taxa varia conforme a região.'
  };

  /* ----------------------------------------------------------
     6 · O QUE A LOCAÇÃO INCLUI

     Lista demonstrativa. NÃO é condição contratual: o aviso em
     `rotuloCondicoes` acompanha a lista na tela, e o texto de
     cada item evita qualquer promessa que a locadora não tenha
     confirmado.
     ---------------------------------------------------------- */
  var inclusos = [
    'Quilometragem livre',
    'Suporte durante a locação',
    'Assistência básica',
    'Alteração de reserva sujeita à disponibilidade',
    'Entrega e retirada conforme a região selecionada'
  ];

  /* ----------------------------------------------------------
     7 · TEXTOS DE APOIO

     Só o que o código realmente lê. Rótulos fixos de interface
     ("a partir de", "/dia") e o aviso de demonstração continuam
     escritos no index.html de propósito: são texto de página, e
     mantê-los lá deixa a marcação legível para quem for editar
     o site à mão.

     IMPORTANTE: este arquivo NÃO guarda nome, descrição, preço
     nem categoria de veículo. Isso é conteúdo editorial e vive
     no index.html — assim o proprietário edita o site inteiro
     (inclusive os carros) sem abrir um arquivo de script.
     A ficha de cada carro (categoria, câmbio, lugares, ar) segue
     a mesma regra: são atributos data-* no botão do seletor.
     ---------------------------------------------------------- */
  var textos = {
    rotuloSobConsulta: 'Sob consulta',
    rotuloCondicoes: 'Condições demonstrativas para apresentação. ' +
                     'Regras finais definidas pela locadora.',
    rotuloEnderecoUnidade: 'Retirada diretamente na unidade Lok Car. ' +
                           'O endereço da unidade será informado na ' +
                           'confirmação da reserva.',
    rotuloFicha: 'Ficha demonstrativa. Confirme a configuração do ' +
                 'veículo com a nossa equipe.'
  };

  /* ----------------------------------------------------------
     8 · FORMAS DE RECEBER E DEVOLVER
     Os dois lados da locação. `id` é o que o app.js guarda no
     estado; `endereco: true` é a opção que abre o formulário de
     endereço e liga a taxa de entrega.
     ---------------------------------------------------------- */
  var recebimento = [
    {
      id: 'locadora',
      nome: 'Retirar na locadora',
      descricao: 'Você busca o veículo na nossa unidade.',
      endereco: false
    },
    {
      id: 'entrega',
      nome: 'Levamos até você',
      descricao: 'Entregamos no endereço que você informar.',
      endereco: true
    }
  ];

  var devolucao = [
    {
      id: 'locadora',
      nome: 'Devolver na locadora',
      descricao: 'Você entrega o veículo na nossa unidade.',
      endereco: false
    },
    {
      id: 'endereco',
      nome: 'Retirada no endereço',
      descricao: 'Buscamos o veículo onde você estiver.',
      endereco: true
    }
  ];

  /* ----------------------------------------------------------
     Consultas — usadas pelo app.js
     ---------------------------------------------------------- */
  var getVeiculo = function (modelo) {
    return veiculos[modelo] || null;
  };

  var getDiaria = function (modelo) {
    var v = getVeiculo(modelo);
    if (!v) return 0;
    return diariaParaCalculo === 'max' ? v.diariaMax : v.diariaMin;
  };

  /* Devolve o MAIOR percentual cujo minDias o período alcança.
     Percorre a lista inteira de propósito: assim a ordem em que
     as faixas estiverem escritas não muda o resultado. */
  var getDesconto = function (dias) {
    var melhor = 0;

    for (var i = 0; i < descontos.length; i++) {
      if (dias >= descontos[i].minDias && descontos[i].percentual > melhor) {
        melhor = descontos[i].percentual;
      }
    }

    return melhor;
  };

  var getProtecao = function (id) {
    for (var i = 0; i < protecoes.length; i++) {
      if (protecoes[i].id === (id || '')) return protecoes[i];
    }
    return protecoes[0];
  };

  var getAdicional = function (id) {
    for (var i = 0; i < adicionais.length; i++) {
      if (adicionais[i].id === id) return adicionais[i];
    }
    return null;
  };

  /* Percorre uma lista de opções (recebimento/devolução) e
     devolve a que casa com o id. Cai na primeira quando o id
     ainda não foi escolhido — quem chamar decide se usa. */
  var acharOpcao = function (lista, id) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  };

  var getRecebimento = function (id) { return acharOpcao(recebimento, id); };
  var getDevolucao = function (id) { return acharOpcao(devolucao, id); };

  return {
    veiculos: veiculos,
    descontos: descontos,
    protecoes: protecoes,
    adicionais: adicionais,
    taxaEntrega: taxaEntrega,
    inclusos: inclusos,
    textos: textos,
    recebimento: recebimento,
    devolucao: devolucao,
    getVeiculo: getVeiculo,
    getDiaria: getDiaria,
    getDesconto: getDesconto,
    getProtecao: getProtecao,
    getAdicional: getAdicional,
    getRecebimento: getRecebimento,
    getDevolucao: getDevolucao
  };
})();
