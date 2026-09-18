/* ============================================================
   LOK CAR — SISTEMA · dados.js
   ------------------------------------------------------------
   TODOS os dados desta área de gestão nascem AQUI.

   LEIA ANTES DE MEXER

   1) ESTES DADOS SÃO FICTÍCIOS. Foram escritos para demonstrar o
      sistema. Não há CPF, CNH, CNPJ, placa ou endereço real de
      pessoa alguma. Os documentos aparecem SEMPRE mascarados, e
      as placas usam o prefixo "DEM" justamente para não haver
      dúvida de que nenhum veículo aqui é um veículo de verdade.

   2) OS PREÇOS NÃO SÃO INVENTADOS AQUI. Diária, desconto,
      proteção, adicional e taxa de entrega saem do
      `scripts/config.js` do site — o mesmo arquivo que alimenta a
      tela de reserva do público. É por isso que este arquivo
      carrega `config.js` antes de si e por isso que a função
      `preco()` existe: uma reserva mostrada no sistema e a mesma
      reserva mostrada no site precisam dar o MESMO número.

   3) O QUE A LOK CAR AINDA NÃO DEFINIU FICA VAZIO. Nada de
      franquia, caução, multa, juros ou limite de quilometragem
      tem valor aqui. Esses campos vivem em `REGRAS` com
      `valor: null`, e a interface mostra "NÃO CONFIGURADO".
      Preencher isso por conta própria seria inventar condição
      jurídica — exatamente o que não pode acontecer.

   4) NÃO HÁ BANCO DE DADOS. Isto é um objeto em memória. Recarregar
      a página restaura tudo ao estado original, menos o que foi
      salvo em `sessionStorage`/`localStorage` pela própria
      interface (configurações da empresa e das regras).
   ============================================================ */

window.LOKCAR_DADOS = (function () {
  'use strict';

  var CFG = window.LOKCAR_CONFIG;

  /* ==========================================================
     1 · SERVIÇOS DE DATA
     ----------------------------------------------------------
     Tudo é calculado a partir do dia de HOJE, não de datas fixas.
     Assim a demonstração continua fazendo sentido quando for
     aberta daqui a um mês: as retiradas de hoje continuam sendo
     hoje, e a devolução atrasada continua atrasada.
     ========================================================== */
  var iso = function (d) {
    var m = d.getMonth() + 1;
    var dia = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dia < 10 ? '0' : '') + dia;
  };

  var HOJE = (function () {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  var HOJE_ISO = iso(HOJE);

  /* `n` dias a partir de hoje. Negativo anda para trás. */
  var D = function (n) {
    var d = new Date(HOJE.getTime());
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  /* A HORA GRUDADA NA DATA.

     A prorrogação guarda data e hora juntas — '2026-09-21T19:00' —
     porque devolver às 09h e devolver às 18h do mesmo dia são
     períodos diferentes. As funções de data abaixo existiam antes
     disso e partiam a string no '-' para achar dia, mês e ano: com
     a hora junto, o "dia" virava '21T19:00', a data virava
     `Invalid Date` e `diffDias` devolvia NaN — que contamina
     qualquer conta em que entre. `soData` corta o sufixo no 'T'
     antes de partir, e é o único ponto onde isso é decidido. */
  var soData = function (s) {
    return String(s).split('T')[0];
  };

  /* "2026-09-21" é dia; "2026-09-21T19:00" é dia com hora e serve;
     undefined, '' e 'amanhã' não servem.

     Existe porque `soData` transforma QUALQUER coisa em texto —
     inclusive a palavra 'undefined' —, e uma string dessas passa
     por todo `if` de data sem reclamar. Pior: `diffDias` sobre lixo
     devolve NaN, e `NaN <= 0` é falso, então um período sem data
     nenhuma passava na checagem de conflito como se fosse válido.
     A pergunta "isto é um dia?" tem de ser feita antes, e num lugar
     só. */
  var ehDia = function (s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(soData(s || ''));
  };

  var horaDe = function (s) {
    var p = String(s).split('T');
    return p.length > 1 ? p[1] : '';
  };

  var emData = function (s) {
    if (!s) return null;
    var p = soData(s).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };

  var diffDias = function (a, b) {
    var d1 = emData(a);
    var d2 = emData(b);
    if (!d1 || !d2) return 0;
    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  };

  var fmtData = function (s) {
    if (!s) return '—';
    var p = soData(s).split('-');
    if (p.length !== 3) return '—';
    return p[2] + '/' + p[1] + '/' + p[0];
  };

  var fmtDataCurta = function (s) {
    if (!s) return '—';
    var p = soData(s).split('-');
    if (p.length !== 3) return '—';
    return p[2] + '/' + p[1];
  };

  /* '2026-09-21T19:00' → '21/09/2026 às 19:00'. Sem hora, devolve
     só a data — uma extensão sem hora (dado antigo ou incompleto)
     não deve inventar "00:00". */
  var fmtDataHora = function (s) {
    if (!s) return '—';
    var h = horaDe(s);
    return fmtData(s) + (h ? ' às ' + h : '');
  };

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                     'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  var fmtBRL = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var s = Math.round(Number(n) * 100) / 100;
    var neg = s < 0;
    s = Math.abs(s);
    var inteiro = Math.floor(s);
    var centavos = Math.round((s - inteiro) * 100);
    if (centavos === 100) { centavos = 0; inteiro += 1; }
    var t = String(inteiro);
    var saida = '';
    while (t.length > 3) {
      saida = '.' + t.slice(-3) + saida;
      t = t.slice(0, -3);
    }
    saida = t + saida;
    return (neg ? '-' : '') + 'R$ ' + saida + ',' +
           (centavos < 10 ? '0' : '') + centavos;
  };

  /* "hoje", "amanhã", "em 4 dias", "há 2 dias" — usado nas telas
     de agenda, onde a data exata importa menos que a distância. */
  var quando = function (s) {
    var d = diffDias(HOJE_ISO, s);
    if (d === 0) return 'hoje';
    if (d === 1) return 'amanhã';
    if (d === -1) return 'ontem';
    if (d > 1) return 'em ' + d + ' dias';
    return 'há ' + Math.abs(d) + ' dias';
  };

  /* ==========================================================
     2 · VOCABULÁRIO DE STATUS
     ----------------------------------------------------------
     Cada status tem um código (usado no código), um rótulo (o que
     aparece na tela) e um tom (a cor do crachá). Manter o mapa em
     um lugar só é o que garante que "Confirmada" seja escrita do
     mesmo jeito no quadro, na lista, no filtro e no detalhe.
     ========================================================== */
  var TOM = ['ok', 'go', 'warn', 'bad', 'acc', 'idle', 'vip'];

  var STATUS_RESERVA = {
    nova:       { rotulo: 'Nova',                  tom: 'acc' },
    aguardando: { rotulo: 'Aguardando confirmação', tom: 'warn' },
    confirmada: { rotulo: 'Confirmada',            tom: 'go' },
    contrato:   { rotulo: 'Contrato pendente',     tom: 'warn' },
    pronta:     { rotulo: 'Pronta para retirada',  tom: 'ok' },
    andamento:  { rotulo: 'Em andamento',          tom: 'ok' },
    finalizada: { rotulo: 'Finalizada',            tom: 'idle' },
    cancelada:  { rotulo: 'Cancelada',             tom: 'bad' }
  };

  var STATUS_LOCACAO = {
    aguardando: { rotulo: 'Aguardando retirada', tom: 'go' },
    andamento:  { rotulo: 'Em andamento',        tom: 'ok' },
    devolucao:  { rotulo: 'Devolução hoje',      tom: 'warn' },
    atrasada:   { rotulo: 'Atrasada',            tom: 'bad' },
    finalizada: { rotulo: 'Finalizada',          tom: 'idle' }
  };

  var STATUS_FROTA = {
    disponivel:   { rotulo: 'Disponível',   tom: 'ok' },
    reservado:    { rotulo: 'Reservado',    tom: 'go' },
    locado:       { rotulo: 'Locado',       tom: 'acc' },
    manutencao:   { rotulo: 'Manutenção',   tom: 'warn' },
    indisponivel: { rotulo: 'Indisponível', tom: 'idle' }
  };

  var STATUS_CONTRATO = {
    rascunho:   { rotulo: 'Rascunho',              tom: 'idle' },
    gerado:     { rotulo: 'Gerado',                tom: 'go' },
    enviado:    { rotulo: 'Enviado',               tom: 'go' },
    aguardando: { rotulo: 'Aguardando assinatura', tom: 'warn' },
    assinado:   { rotulo: 'Assinado',              tom: 'ok' },
    cancelado:  { rotulo: 'Cancelado',             tom: 'bad' }
  };

  var STATUS_FINANCEIRO = {
    pendente:  { rotulo: 'Pendente',  tom: 'warn' },
    pago:      { rotulo: 'Pago',      tom: 'ok' },
    atrasado:  { rotulo: 'Atrasado',  tom: 'bad' },
    cancelado: { rotulo: 'Cancelado', tom: 'idle' }
  };

  var STATUS_VISTORIA = {
    pendente:   { rotulo: 'Pendente',   tom: 'warn' },
    concluida:  { rotulo: 'Concluída',  tom: 'ok' }
  };

  var STATUS_MANUTENCAO = {
    agendada:   { rotulo: 'Agendada',   tom: 'go' },
    andamento:  { rotulo: 'Em andamento', tom: 'warn' },
    concluida:  { rotulo: 'Concluída',  tom: 'ok' },
    bloqueada:  { rotulo: 'Bloqueada',  tom: 'bad' }
  };

  var STATUS_DOCUMENTO = {
    ok:       { rotulo: 'Em dia',      tom: 'ok' },
    pendente: { rotulo: 'Pendente',    tom: 'warn' },
    vencido:  { rotulo: 'Vencido',     tom: 'bad' },
    ausente:  { rotulo: 'Não enviado', tom: 'idle' }
  };

  var STATUS_OCORRENCIA = {
    aberta:    { rotulo: 'Aberta',      tom: 'bad' },
    analise:   { rotulo: 'Em análise',  tom: 'warn' },
    resolvida: { rotulo: 'Resolvida',   tom: 'ok' }
  };

  /* Os quatro estados de uma solicitação de prorrogação.
     `auto` é separado de `aprovada` de propósito: quem aprovou
     importa. "Aprovada" foi uma pessoa que pode ser cobrada pela
     decisão; "Aprovada automaticamente" foi a regra configurada,
     e o operador precisa conseguir distinguir as duas na lista. */
  var STATUS_EXTENSAO = {
    pendente: { rotulo: 'Aguardando aprovação',           tom: 'warn' },
    aprovada: { rotulo: 'Prorrogação aprovada',           tom: 'ok' },
    auto:     { rotulo: 'Aprovada automaticamente',       tom: 'go' },
    recusada: { rotulo: 'Prorrogação recusada',           tom: 'bad' }
  };

  var acharStatus = function (mapa, codigo) {
    return mapa[codigo] || { rotulo: codigo || '—', tom: 'idle' };
  };

  /* ==========================================================
     3 · CATEGORIAS E DOCUMENTOS
     ----------------------------------------------------------
     São listas fechadas de propósito. Um campo de texto livre
     para categoria de veículo vira "SUV", "suv", "Suv de luxo" e
     "SUV de Luxo" em uma semana.
     ========================================================== */
  var CATEGORIAS = [
    'Esportivo', 'SUV de luxo', 'Sedan executivo', 'Sedan',
    'Sportback', 'Hatch'
  ];

  var DOCUMENTOS_TIPO = [
    { id: 'cnh',        nome: 'CNH',                    obrigatorio: true,  quem: 'cliente' },
    { id: 'residencia', nome: 'Comprovante de residência', obrigatorio: true, quem: 'cliente' },
    { id: 'doc-veic',   nome: 'Documento do veículo',   obrigatorio: true,  quem: 'veiculo' },
    { id: 'contrato',   nome: 'Contrato assinado',      obrigatorio: true,  quem: 'locacao' },
    { id: 'vistoria',   nome: 'Vistoria',               obrigatorio: true,  quem: 'locacao' },
    { id: 'cnpj',       nome: 'Cartão CNPJ',            obrigatorio: false, quem: 'cliente' }
  ];

  /* ==========================================================
     4 · FROTA
     ----------------------------------------------------------
     ONZE UNIDADES, e não seis modelos. Uma locadora conta
     UNIDADE, não modelo: existem dois HB20 e dois Onix Plus na
     frota, e é isso que faz o calendário da frota ter graça.

     A diária NÃO está escrita aqui. Ela vem de
     `CFG.veiculos`, pelo mesmo motivo do cabeçalho deste arquivo:
     o preço que o cliente viu no site é o preço que o sistema
     precisa mostrar.

     `diaria: null` significa que aquele modelo ainda não tem
     tabela no site. Nesses casos a interface escreve
     "Sob consulta" — nunca um número escolhido por mim.

     As PLACAS usam o prefixo DEM (DEM1A23). É formato válido da
     placa Mercosul e é, ao mesmo tempo, impossível de confundir
     com a placa de um veículo real.
     ========================================================== */
  var VEICULOS = [
    {
      id: 'v01', modelo: 'Porsche 911', placa: 'DEM1A23', ano: 2022,
      categoria: 'Esportivo', cambio: 'Automático', lugares: 4, ar: true,
      cor: 'Preto', img: '../Public/porsche%20preta.jpg',
      km: 28450, status: 'disponivel',
      aquisicao: '2022-03-14'
    },
    {
      id: 'v02', modelo: 'Porsche Cayenne', placa: 'DEM2B45', ano: 2023,
      categoria: 'SUV de luxo', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Preto', img: '../Public/porsche-bg-lateral.jpg.webp',
      km: 31200, status: 'reservado',
      aquisicao: '2023-01-20'
    },
    {
      id: 'v03', modelo: 'Mercedes-Benz Classe C', placa: 'DEM3C67', ano: 2022,
      categoria: 'Sedan executivo', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Preto', img: '../Public/mercedes%20preta.jpg',
      km: 44180, status: 'locado',
      aquisicao: '2022-07-08'
    },
    {
      id: 'v04', modelo: 'Audi A5 Sportback', placa: 'DEM4D89', ano: 2023,
      categoria: 'Sportback', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Preto', img: '../Public/audi%20preta.jpg',
      km: 23960, status: 'reservado',
      aquisicao: '2023-04-02'
    },
    {
      id: 'v05', modelo: 'Hyundai HB20', placa: 'DEM5E10', ano: 2021,
      categoria: 'Hatch', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Prata', img: '../Public/OIP%20(1).jpg',
      km: 61240, status: 'reservado',
      aquisicao: '2021-09-30'
    },
    {
      id: 'v06', modelo: 'Hyundai HB20', placa: 'DEM6F32', ano: 2022,
      categoria: 'Hatch', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Prata', img: '../Public/hb20-prata.webp',
      km: 39710, status: 'reservado',
      aquisicao: '2022-11-11'
    },
    {
      id: 'v07', modelo: 'Chevrolet Onix Plus', placa: 'DEM7G54', ano: 2022,
      categoria: 'Sedan', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Branco', img: '../Public/Onix-Plus-Branco.jpg',
      /* A GALERIA. `img` continua sendo a principal — é ela que a
         ficha do veículo, o cartão da frota e a prévia da reserva
         já leem, e renomear o campo quebraria os três de uma vez.
         A galeria é ADITIVA: lista as outras fotos do mesmo carro,
         e é sobre `img` + `imgs` que o trocador de imagem trabalha.
         Os dois arquivos existem em Public/ e não são usados por
         nenhuma tela do sistema hoje. */
      imgs: ['../Public/onix.png', '../Public/onix-branco.png'],
      km: 57890, status: 'locado',
      aquisicao: '2022-05-19'
    },
    {
      id: 'v08', modelo: 'Mercedes-Benz GLC', placa: 'DEM8H76', ano: 2023,
      categoria: 'SUV de luxo', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Branco', img: '../Public/mercedes-glc-branco.webp',
      km: 18420, status: 'reservado',
      aquisicao: '2023-08-25'
    },
    {
      id: 'v09', modelo: 'Audi Q8', placa: 'DEM9I98', ano: 2023,
      categoria: 'SUV de luxo', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Branco', img: '../Public/audi-q8-branco.webp',
      km: 15380, status: 'locado',
      aquisicao: '2023-10-06'
    },
    {
      id: 'v10', modelo: 'Chevrolet Onix', placa: 'DEM0J21', ano: 2021,
      categoria: 'Hatch', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Branco', img: '../Public/onix-branco.webp',
      km: 72350, status: 'manutencao',
      aquisicao: '2021-06-17'
    },
    {
      id: 'v11', modelo: 'Chevrolet Onix Plus', placa: 'DEM1K43', ano: 2023,
      categoria: 'Sedan', cambio: 'Automático', lugares: 5, ar: true,
      cor: 'Branco', img: '../Public/Onix-Plus-Branco.jpg',
      km: 9840, status: 'indisponivel',
      aquisicao: '2023-12-01'
    }
  ];

  var veiculoPorId = function (id) {
    for (var i = 0; i < VEICULOS.length; i++) {
      if (VEICULOS[i].id === id) return VEICULOS[i];
    }
    return null;
  };

  /* Diária de um veículo, pelo MODELO, lida do config do site.
     Devolve null quando o modelo não tem tabela — a interface
     traduz isso como "Sob consulta". */
  var diariaDo = function (modelo) {
    if (!CFG || !CFG.getVeiculo) return null;
    var v = CFG.getVeiculo(modelo);
    if (!v) return null;
    return Number(CFG.getDiaria(modelo)) || 0;
  };

  /* A faixa exibida nos cards do site ("R$ 700–900"). Usada na
     ficha do veículo, nunca no cálculo. */
  var faixaDo = function (modelo) {
    if (!CFG || !CFG.getVeiculo) return null;
    var v = CFG.getVeiculo(modelo);
    if (!v) return null;
    return { min: v.diariaMin, max: v.diariaMax };
  };

  /* ==========================================================
     5 · CLIENTES
     ----------------------------------------------------------
     Nove clientes fictícios. Os documentos são guardados como
     já mascarados (`'***.***.***-**'`) — o sistema nunca recebe
     o número, então não há como ele vazar para uma tela ou para
     um contrato por descuido. Quem precisar do número inteiro
     vai ler do banco de dados, quando ele existir.
     ========================================================== */
  var MASK_CPF = '***.***.***-**';
  var MASK_CNPJ = '**.***.***/****-**';
  var MASK_CNH = '*** *** *** **';

  var CLIENTES = [
    {
      id: 'c01', nome: 'Ana Beatriz Moraes', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0001', email: 'ana.moraes@exemplo.com',
      desde: '2023-05-12',
      endereco: { cep: '54500-000', logradouro: 'Av. Beira Mar', numero: '120', complemento: 'Apto 402', bairro: 'Reserva do Paiva', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'B', validade: '2027-08-14' },
      docs: { cnh: 'ok', residencia: 'ok', cnpj: null },
      obs: 'Prefere retirada na unidade.'
    },
    {
      id: 'c02', nome: 'Carlos Eduardo Lima', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0002', email: 'carlos.lima@exemplo.com',
      desde: '2022-11-03',
      endereco: { cep: '54510-000', logradouro: 'Rua do Sol', numero: '45', complemento: '', bairro: 'Centro', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'AB', validade: '2026-11-30' },
      docs: { cnh: 'pendente', residencia: 'ok', cnpj: null },
      obs: 'CNH vence em novembro — avisar antes da próxima locação.'
    },
    {
      id: 'c03', nome: 'Mariana Ferreira de Souza', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0003', email: 'mariana.souza@exemplo.com',
      desde: '2024-01-22',
      endereco: { cep: '51020-000', logradouro: 'Rua dos Navegantes', numero: '980', complemento: 'Sala 12', bairro: 'Boa Viagem', cidade: 'Recife', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'B', validade: '2028-02-19' },
      docs: { cnh: 'ok', residencia: 'ok', cnpj: null },
      obs: ''
    },
    {
      id: 'c04', nome: 'Rafael Nogueira Alves', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0004', email: 'rafael.alves@exemplo.com',
      desde: '2024-06-09',
      endereco: { cep: '54515-000', logradouro: 'Rua das Acácias', numero: '233', complemento: '', bairro: 'Rosário', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'B', validade: '2027-04-05' },
      docs: { cnh: 'ok', residencia: 'ausente', cnpj: null },
      obs: 'Falta o comprovante de residência para o contrato de hoje.'
    },
    {
      id: 'c05', nome: 'Juliana Prado Camargo', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0005', email: 'juliana.camargo@exemplo.com',
      desde: '2025-02-17',
      endereco: { cep: '52011-000', logradouro: 'Rua Amélia', numero: '310', complemento: 'Apto 801', bairro: 'Graças', cidade: 'Recife', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'B', validade: '2029-01-11' },
      docs: { cnh: 'ok', residencia: 'ok', cnpj: null },
      obs: ''
    },
    {
      id: 'c06', nome: 'Rodrigo Tavares Bezerra', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0006', email: 'rodrigo.bezerra@exemplo.com',
      desde: '2022-03-28',
      endereco: { cep: '54518-000', logradouro: 'Av. Central', numero: '1500', complemento: 'Casa 3', bairro: 'Ponte dos Carvalhos', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'AB', validade: '2028-09-27' },
      docs: { cnh: 'ok', residencia: 'ok', cnpj: null },
      obs: 'Cliente frequente desde 2022.'
    },
    {
      id: 'c07', nome: 'Vetor Logística e Serviços', tipo: 'PJ',
      doc: MASK_CNPJ, telefone: '(81) 90000-0007', email: 'contratos@vetor-exemplo.com',
      desde: '2023-10-04',
      endereco: { cep: '54520-000', logradouro: 'Rod. BR-101 Sul', numero: '4500', complemento: 'Galpão 2', bairro: 'Distrito Industrial', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      cnh: null,
      representante: { nome: 'Diego Sales', doc: MASK_CPF, cargo: 'Responsável por contratos' },
      docs: { cnh: null, residencia: 'ok', cnpj: 'ok' },
      obs: 'Contrato empresarial. Emite nota fiscal e pede faturamento mensal.'
    },
    {
      id: 'c08', nome: 'Sofia Menezes Ribeiro', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0008', email: 'sofia.ribeiro@exemplo.com',
      desde: '2025-07-30',
      endereco: { cep: '51110-000', logradouro: 'Rua Ribeiro de Brito', numero: '77', complemento: 'Apto 1502', bairro: 'Boa Viagem', cidade: 'Recife', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'B', validade: '2030-06-18' },
      docs: { cnh: 'ok', residencia: 'ok', cnpj: null },
      obs: ''
    },
    {
      id: 'c09', nome: 'Petrus Andrade Cavalcanti', tipo: 'PF',
      doc: MASK_CPF, telefone: '(81) 90000-0009', email: 'petrus.cavalcanti@exemplo.com',
      desde: '2025-11-14',
      endereco: { cep: '54522-000', logradouro: 'Rua do Comércio', numero: '61', complemento: '', bairro: 'Centro', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      cnh: { numero: MASK_CNH, categoria: 'B', validade: '2029-03-08' },
      docs: { cnh: 'ok', residencia: 'ok', cnpj: null },
      obs: 'Locação cancelada a pedido do cliente.'
    }
  ];

  var clientePorId = function (id) {
    for (var i = 0; i < CLIENTES.length; i++) {
      if (CLIENTES[i].id === id) return CLIENTES[i];
    }
    return null;
  };

  /* ==========================================================
     6 · PREÇO DE UMA RESERVA
     ----------------------------------------------------------
     Espelha exatamente a conta que o site faz na tela de
     reserva: diária × dias, desconto progressivo por faixa,
     proteção por dia, adicionais (mensais os fixos, "sob
     consulta" fora da soma) e a taxa de entrega cobrada UMA vez.

     Está aqui, e não espalhada por cada tela, porque o mesmo
     número precisa aparecer igual no detalhe da reserva, no
     financeiro e no contrato. Qualquer tela que recalcule por
     conta própria vai divergir um dia.
     ========================================================== */
  var preco = function (r) {
    var dias = Number(r.dias) || 0;
    var diaria = (r.diaria === null || r.diaria === undefined) ? null : Number(r.diaria);

    var bruto = diaria === null ? null : diaria * dias;
    var pct = dias > 0 ? CFG.getDesconto(dias) : 0;
    var desconto = bruto === null ? null : Math.round(bruto * pct / 100);
    var baseDiarias = bruto === null ? null : bruto - desconto;

    var prot = CFG.getProtecao(r.protecaoId || '');
    var protTotal = prot.valorDia * dias;

    var addsTotal = 0;
    var addsLinhas = [];

    CFG.adicionais.forEach(function (a) {
      var qtd = 0;
      (r.adicionais || []).forEach(function (escolhido) {
        if (escolhido.id === a.id) qtd = Number(escolhido.qtd) || 0;
      });
      if (qtd <= 0) return;

      var nome = a.nome + (qtd > 1 ? ' (' + qtd + '×)' : '');

      if (a.sobConsulta) {
        addsLinhas.push({ nome: nome, valor: CFG.textos.rotuloSobConsulta, soma: 0, sobConsulta: true });
      } else {
        var soma = a.valorFixo * qtd;
        addsTotal += soma;
        addsLinhas.push({ nome: nome, valor: fmtBRL(soma), soma: soma, sobConsulta: false });
      }
    });

    var taxa = Number(r.taxa) || 0;

    /* Adicional que veio do site sem correspondência na tabela
       atual (`id: null`). Ele NÃO entra na soma — não há valor
       para somar — mas entra como linha "sob consulta" e marca
       a conta como incompleta. É o que impede o total de sair
       fechado quando na verdade falta um preço. */
    (r.adicionais || []).forEach(function (escolhido) {
      if (escolhido.id !== null && escolhido.id !== undefined) return;
      addsLinhas.push({
        nome: (escolhido.nome || 'Adicional') + (escolhido.qtd > 1 ? ' (' + escolhido.qtd + '×)' : ''),
        valor: CFG.textos.rotuloSobConsulta,
        soma: 0,
        sobConsulta: true
      });
    });

    /* Sem tabela de diária e sem "sob consulta" o número ainda
       não existe. Por isso os dois casos abaixo deformam o
       total, e a interface tem de saber disso antes de exibir
       o valor como se fosse fechado. */
    var semTabela = diaria === null;
    var temSobConsulta = addsLinhas.some(function (l) { return l.sobConsulta; });

    var subtotal = (baseDiarias === null ? 0 : baseDiarias) + protTotal + addsTotal + taxa;

    return {
      dias: dias,
      diaria: diaria,
      faixa: semTabela ? faixaDo(r.modelo) : null,
      bruto: bruto,
      pct: pct,
      desconto: desconto,
      baseDiarias: baseDiarias,
      protecao: prot,
      protecaoNome: prot.nome,
      protTotal: protTotal,
      adicionais: addsLinhas,
      addsTotal: addsTotal,
      taxa: taxa,
      subtotal: subtotal,
      total: subtotal,
      semTabela: semTabela,
      temSobConsulta: temSobConsulta,
      incompleto: semTabela || temSobConsulta
    };
  };

  /* ----------------------------------------------------------
     QUANTO CUSTA ACRESCENTAR DIAS
     ----------------------------------------------------------
     Não existe preço novo aqui. O que existe é a MESMA conta da
     reserva rodada duas vezes: uma com os dias de hoje, outra com
     os dias mais os pedidos. A diferença entre as duas é o
     acréscimo.

     Isto é o que faz o desconto por faixa se comportar sozinho.
     Passar de 3 para 5 dias não custa necessariamente duas
     diárias: a faixa muda (3 dias dão 5%, 5 dias dão 7%), e a
     conta repetida já aplica o desconto novo. Somar "extraDias ×
     diária" daria um número maior que o real — e seria um preço
     inventado, que é exatamente o que não pode acontecer.

     Nunca devolve zero para "não sei": devolve null, que a
     interface escreve como "a confirmar". Um acréscimo de
     R$ 0,00 afirmaria que os dias a mais são gratuitos.
     ---------------------------------------------------------- */
  var valorDaProrrogacao = function (l, extraDias) {
    if (!l || !extraDias || extraDias <= 0) return null;

    var r = l.reserva ? reservaPorId(l.reserva) : null;
    if (!r) return null;

    var hoje = preco(r);
    if (hoje.incompleto) return null;

    var simulado = {};
    Object.keys(r).forEach(function (k) { simulado[k] = r[k]; });
    simulado.dias = Number(r.dias || 0) + Number(extraDias);

    var depois = preco(simulado);
    if (depois.incompleto) return null;

    return Math.round((depois.total - hoje.total) * 100) / 100;
  };

  /* Valor de um serviço adicional, lido do config do site.
     Existe para que nenhuma tela precise escrever "150" na mão:
     se a tabela do site mudar, o sistema muda junto. */
  var valorAdicional = function (id, qtd) {
    var a = CFG.getAdicional ? CFG.getAdicional(id) : null;
    if (!a || a.sobConsulta) return null;
    return a.valorFixo * (Number(qtd) || 1);
  };

  /* Atalho usado na montagem da tabela de lançamentos, que roda
     antes de `valorAdicional` existir. Mesmo corpo, nome curto. */
  var adicional = function (id, qtd) { return valorAdicional(id, qtd); };

  /* ----------------------------------------------------------
     IDENTIFICADORES PELO NOME

     O site público guarda no resumo da solicitação o NOME da
     proteção e o NOME de cada adicional — porque é isso que ele
     mostra na tela. O sistema trabalha com o `id`, porque é isso
     que ele usa para calcular.

     Sem esta tradução, a reserva que chega do site perderia a
     proteção e os adicionais escolhidos pelo cliente: o sistema
     criaria a reserva com "Sem proteção" e a tela diria que
     ninguém escolheu nada. O cliente teria escolhido, sim — e a
     conta sairia errada, para menos.

     A comparação ignora acento e caixa porque é um nome vindo de
     outra tela, e não uma chave.
     ---------------------------------------------------------- */
  var semAcento = function (s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  var protecaoPorNome = function (nome) {
    if (!nome) return null;
    var alvo = semAcento(nome);
    var achou = null;
    CFG.protecoes.forEach(function (p) {
      if (semAcento(p.nome) === alvo) achou = p;
    });
    return achou;
  };

  var adicionalPorNome = function (nome) {
    if (!nome) return null;
    var alvo = semAcento(nome);
    var achou = null;
    CFG.adicionais.forEach(function (a) {
      if (semAcento(a.nome) === alvo) achou = a;
    });
    return achou;
  };

  /* O resumo do site traz o endereço já escrito numa frase
     ("Rua X, 10 · Bairro · Cidade — UF · CEP 00000-000"). O
     sistema guarda endereço em campos. Esta função faz o caminho
     de volta, para que o endereço de entrega não se perca na
     viagem de uma tela para a outra. Quando não consegue separar,
     devolve o texto inteiro no campo de rua — melhor um endereço
     inteiro num campo só do que um endereço vazio. */
  var enderecoDeLinha = function (linha) {
    if (!linha || !String(linha).trim()) return null;
    var partes = String(linha).split('·').map(function (p) { return p.trim(); }).filter(Boolean);

    var e = { cep: '', rua: '', num: '', comp: '', bairro: '', cidade: '', uf: '', ref: '' };

    partes.forEach(function (p) {
      if (/^CEP/i.test(p)) { e.cep = p.replace(/^CEP\s*/i, '').trim(); return; }
      if (/—/.test(p) && /^[A-Za-zÀ-ÿ\s]+—\s*[A-Z]{2}$/.test(p)) {
        var cu = p.split('—');
        e.cidade = cu[0].trim();
        e.uf = cu[1].trim();
        return;
      }
      if (!e.rua) {
        var m = p.match(/^(.*?),\s*(.+)$/);
        if (m) { e.rua = m[1].trim(); e.num = m[2].trim(); }
        else e.rua = p;
        return;
      }
      if (!e.bairro) { e.bairro = p; return; }
      if (!e.comp) e.comp = p;
    });

    if (!e.rua && !e.cidade) return null;
    return e;
  };

  /* ==========================================================
     7 · RESERVAS
     ----------------------------------------------------------
     A reserva é a INTENÇÃO. A locação é o contrato que começou.

     `status: 'andamento'` numa reserva significa que existe uma
     locação aberta para ela (ver `LOCACOES`). As duas listas são
     ligadas por `reserva` / `locacao`.

     `origem: 'site'` marca a reserva que veio da tela pública.
     Ela NÃO TEM CLIENTE, e isso é de propósito: o site guarda
     apenas a configuração da locação, sem dado pessoal. O
     sistema mostra "Cliente não informado" e cria a pendência —
     exatamente o que acontece numa locadora de verdade quando o
     pedido chega pelo formulário e alguém precisa completar o
     cadastro.
     ========================================================== */
  var RESERVAS = [
    {
      id: 'r01', codigo: 'R-0001', criadaEm: D(-18),
      clienteId: 'c01', veiculoId: 'v01',
      de: D(-12), ate: D(-9), dias: 3, diaria: diariaDo('Porsche 911'),
      retiradaModo: 'locadora', retiradaHora: '09:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '09:00', devolucaoEndereco: null,
      protecaoId: 'completa', adicionais: [{ id: 'lavagem', qtd: 1 }], taxa: 0,
      status: 'finalizada', origem: 'sistema', pagamento: 'pago', obs: ''
    },
    {
      id: 'r02', codigo: 'R-0002', criadaEm: D(-11),
      clienteId: 'c02', veiculoId: 'v02',
      de: D(-6), ate: D(-2), dias: 4, diaria: diariaDo('Porsche Cayenne'),
      retiradaModo: 'entrega', retiradaHora: '14:00',
      retiradaEndereco: { cep: '54510-000', logradouro: 'Rua do Sol', numero: '45', complemento: '', bairro: 'Centro', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      devolucaoModo: 'endereco', devolucaoHora: '14:00', devolucaoEndereco: null,
      protecaoId: 'basica', adicionais: [], taxa: 80,
      status: 'finalizada', origem: 'sistema', pagamento: 'pago', obs: ''
    },
    {
      id: 'r03', codigo: 'R-0003', criadaEm: D(-9),
      clienteId: 'c03', veiculoId: 'v03',
      de: D(0), ate: D(3), dias: 3, diaria: diariaDo('Mercedes-Benz Classe C'),
      retiradaModo: 'locadora', retiradaHora: '08:30', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '18:00', devolucaoEndereco: null,
      protecaoId: 'basica', adicionais: [{ id: 'motorista', qtd: 1 }], taxa: 0,
      status: 'andamento', origem: 'sistema', pagamento: 'pendente', obs: ''
    },
    {
      id: 'r04', codigo: 'R-0004', criadaEm: D(-6),
      clienteId: 'c04', veiculoId: 'v04',
      de: D(0), ate: D(4), dias: 4, diaria: diariaDo('Audi A5 Sportback'),
      retiradaModo: 'entrega', retiradaHora: '10:00',
      retiradaEndereco: { cep: '54515-000', logradouro: 'Rua das Acácias', numero: '233', complemento: '', bairro: 'Rosário', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      devolucaoModo: 'locadora', devolucaoHora: '10:00', devolucaoEndereco: null,
      protecaoId: 'simples', adicionais: [{ id: 'cadeirinha', qtd: 1 }], taxa: 80,
      status: 'pronta', origem: 'sistema', pagamento: 'pendente', obs: 'Comprovante de residência ainda não enviado.'
    },
    {
      id: 'r05', codigo: 'R-0005', criadaEm: D(-4),
      clienteId: 'c05', veiculoId: 'v05',
      de: D(1), ate: D(4), dias: 3, diaria: diariaDo('Hyundai HB20'),
      retiradaModo: 'locadora', retiradaHora: '11:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '11:00', devolucaoEndereco: null,
      protecaoId: '', adicionais: [], taxa: 0,
      status: 'confirmada', origem: 'sistema', pagamento: 'pendente', obs: ''
    },
    {
      id: 'r06', codigo: 'R-0006', criadaEm: D(-8),
      clienteId: 'c07', veiculoId: 'v07',
      de: D(-3), ate: D(0), dias: 4, diaria: diariaDo('Chevrolet Onix Plus'),
      retiradaModo: 'locadora', retiradaHora: '07:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '19:00', devolucaoEndereco: null,
      protecaoId: 'basica', adicionais: [], taxa: 0,
      status: 'andamento', origem: 'sistema', pagamento: 'pendente', obs: 'Contrato empresarial. Devolução prevista para hoje.'
    },
    {
      id: 'r07', codigo: 'R-0007', criadaEm: D(-3),
      clienteId: 'c08', veiculoId: 'v08',
      de: D(2), ate: D(8), dias: 6, diaria: diariaDo('Mercedes-Benz GLC'),
      retiradaModo: 'entrega', retiradaHora: '09:30',
      retiradaEndereco: { cep: '51110-000', logradouro: 'Rua Ribeiro de Brito', numero: '77', complemento: 'Apto 1502', bairro: 'Boa Viagem', cidade: 'Recife', uf: 'PE' },
      devolucaoModo: 'endereco', devolucaoHora: '09:30', devolucaoEndereco: null,
      protecaoId: 'completa', adicionais: [{ id: 'lavagem-premium', qtd: 1 }], taxa: 80,
      status: 'contrato', origem: 'sistema', pagamento: 'pendente', obs: 'Contrato gerado e enviado; aguardando assinatura.'
    },
    {
      id: 'r08', codigo: 'R-0008', criadaEm: D(-26),
      clienteId: 'c06', veiculoId: 'v01',
      de: D(-20), ate: D(-17), dias: 3, diaria: diariaDo('Porsche 911'),
      retiradaModo: 'locadora', retiradaHora: '10:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '10:00', devolucaoEndereco: null,
      protecaoId: 'completa', adicionais: [{ id: 'lavagem', qtd: 1 }], taxa: 0,
      status: 'finalizada', origem: 'sistema', pagamento: 'pago', obs: ''
    },
    {
      id: 'r09', codigo: 'R-0009', criadaEm: D(-7),
      clienteId: 'c09', veiculoId: 'v04',
      de: D(-4), ate: D(-1), dias: 3, diaria: diariaDo('Audi A5 Sportback'),
      retiradaModo: 'locadora', retiradaHora: '15:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '15:00', devolucaoEndereco: null,
      protecaoId: 'simples', adicionais: [], taxa: 0,
      status: 'cancelada', origem: 'sistema', pagamento: 'cancelado',
      obs: 'Cancelada pelo cliente antes da confirmação.'
    },
    {
      id: 'r10', codigo: 'R-0010', criadaEm: D(-1),
      clienteId: 'c06', veiculoId: 'v06',
      de: D(4), ate: D(8), dias: 4, diaria: diariaDo('Hyundai HB20'),
      retiradaModo: 'locadora', retiradaHora: '12:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '12:00', devolucaoEndereco: null,
      protecaoId: 'simples', adicionais: [{ id: 'assento', qtd: 2 }], taxa: 0,
      status: 'confirmada', origem: 'sistema', pagamento: 'pendente', obs: ''
    },
    {
      id: 'r11', codigo: 'R-0011', criadaEm: D(-1),
      clienteId: 'c07', veiculoId: 'v10',
      de: D(6), ate: D(10), dias: 4, diaria: diariaDo('Chevrolet Onix'),
      retiradaModo: 'locadora', retiradaHora: '08:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '18:00', devolucaoEndereco: null,
      protecaoId: 'basica', adicionais: [], taxa: 0,
      status: 'aguardando', origem: 'sistema', pagamento: 'pendente',
      obs: 'Aguardando confirmação — o veículo está em manutenção nesta data.'
    },
    {
      id: 'r12', codigo: 'R-0012', criadaEm: D(0),
      clienteId: null, veiculoId: 'v02',
      de: D(10), ate: D(13), dias: 3, diaria: diariaDo('Porsche Cayenne'),
      retiradaModo: 'entrega', retiradaHora: '16:00',
      retiradaEndereco: { cep: '54500-000', logradouro: 'Av. Beira Mar', numero: '120', complemento: 'Apto 402', bairro: 'Reserva do Paiva', cidade: 'Cabo de Santo Agostinho', uf: 'PE' },
      devolucaoModo: 'locadora', devolucaoHora: '16:00', devolucaoEndereco: null,
      protecaoId: 'basica', adicionais: [], taxa: 80,
      status: 'nova', origem: 'site', pagamento: 'pendente',
      obs: 'Solicitação recebida pelo formulário do site.'
    },
    {
      id: 'r13', codigo: 'R-0013', criadaEm: D(0),
      clienteId: 'c03', veiculoId: 'v06',
      de: D(12), ate: D(14), dias: 2, diaria: diariaDo('Hyundai HB20'),
      retiradaModo: 'locadora', retiradaHora: '09:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '09:00', devolucaoEndereco: null,
      protecaoId: '', adicionais: [], taxa: 0,
      status: 'nova', origem: 'sistema', pagamento: 'pendente', obs: ''
    },
    {
      id: 'r14', codigo: 'R-0014', criadaEm: D(-36),
      clienteId: 'c02', veiculoId: 'v03',
      de: D(-30), ate: D(-25), dias: 5, diaria: diariaDo('Mercedes-Benz Classe C'),
      retiradaModo: 'locadora', retiradaHora: '09:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '09:00', devolucaoEndereco: null,
      protecaoId: 'basica', adicionais: [{ id: 'lavagem', qtd: 1 }], taxa: 0,
      status: 'finalizada', origem: 'sistema', pagamento: 'pago', obs: ''
    },
    {
      /* A RESERVA QUE SUSTENTA A PRORROGAÇÃO DESTA DEMONSTRAÇÃO.

         Sem ela, "estender locação" no Portal do Cliente não teria
         em que se apoiar: as reservas confirmadas da base ou já
         viraram locação (r04, r06) ou pertencem a outros clientes
         (r05 é da c05, r07 da c08). O cliente de demonstração do
         site é a Ana Paula (c01).

         `confirmada` e não `pronta`: o carro está reservado para
         a Ana, mas a retirada é daqui a três dias e ainda não há
         locação aberta. É exatamente o estado em que o dono ainda
         pode mexer no período (§2) — e é a existência (ou não) da
         locação que decide isso, não o rótulo do status. O carro é
         o Onix Plus, cuja diária de demonstração é a mais barata e
         está tabelada — nenhum preço foi inventado para caber
         aqui. */
      id: 'r15', codigo: 'R-0015', criadaEm: D(-2),
      clienteId: 'c01', veiculoId: 'v07',
      de: D(3), ate: D(6), dias: 3, diaria: diariaDo('Chevrolet Onix Plus'),
      retiradaModo: 'locadora', retiradaHora: '09:00', retiradaEndereco: null,
      devolucaoModo: 'locadora', devolucaoHora: '09:00', devolucaoEndereco: null,
      protecaoId: 'simples', adicionais: [{ id: 'lavagem', qtd: 1 }], taxa: 0,
      status: 'confirmada', origem: 'sistema', pagamento: 'pendente', obs: ''
    }
  ];

  var reservaPorId = function (id) {
    for (var i = 0; i < RESERVAS.length; i++) {
      if (RESERVAS[i].id === id) return RESERVAS[i];
    }
    return null;
  };

  var reservaPorCodigo = function (cod) {
    for (var i = 0; i < RESERVAS.length; i++) {
      if (RESERVAS[i].codigo === cod) return RESERVAS[i];
    }
    return null;
  };

  /* ==========================================================
     8 · LOCAÇÕES
     ----------------------------------------------------------
     A locação nasce de uma reserva (ou é criada direto no balcão,
     com `reserva: null`). Guarda o estado do veículo NA SAÍDA —
     quilometragem e combustível — porque é contra esse número
     que a devolução vai ser cobrada.
     ========================================================== */
  var LOCACOES = [
    {
      id: 'l01', codigo: 'L-0001', reserva: 'r01',
      clienteId: 'c01', veiculoId: 'v01',
      inicio: D(-12), fimPrevisto: D(-9), fimReal: D(-9),
      horaSaida: '09:12', horaEntrada: '08:55',
      kmSaida: 28450, kmEntrada: 28890,
      combustivelSaida: 'Cheio', combustivelEntrada: 'Cheio',
      status: 'finalizada', locacao: null
    },
    {
      id: 'l02', codigo: 'L-0002', reserva: 'r02',
      clienteId: 'c02', veiculoId: 'v02',
      inicio: D(-6), fimPrevisto: D(-2), fimReal: D(-2),
      horaSaida: '14:20', horaEntrada: '13:40',
      kmSaida: 30980, kmEntrada: 31200,
      combustivelSaida: 'Cheio', combustivelEntrada: '3/4',
      status: 'finalizada', locacao: null
    },
    {
      id: 'l03', codigo: 'L-0003', reserva: 'r03',
      clienteId: 'c03', veiculoId: 'v03',
      inicio: D(-2), fimPrevisto: D(3), fimReal: null,
      horaSaida: '08:34', horaEntrada: '',
      kmSaida: 44180, kmEntrada: null,
      combustivelSaida: 'Cheio', combustivelEntrada: '',
      status: 'andamento', locacao: null
    },
    {
      id: 'l04', codigo: 'L-0004', reserva: 'r06',
      clienteId: 'c07', veiculoId: 'v07',
      inicio: D(-3), fimPrevisto: D(0), fimReal: null,
      horaSaida: '06:55', horaEntrada: '',
      kmSaida: 57890, kmEntrada: null,
      combustivelSaida: 'Cheio', combustivelEntrada: '',
      status: 'andamento', locacao: null
    },
    {
      id: 'l05', codigo: 'L-0005', reserva: null,
      clienteId: 'c02', veiculoId: 'v09',
      inicio: D(-6), fimPrevisto: D(-1), fimReal: null,
      horaSaida: '17:10', horaEntrada: '',
      kmSaida: 15380, kmEntrada: null,
      combustivelSaida: 'Cheio', combustivelEntrada: '',
      status: 'atrasada',
      obs: 'Locação criada direto no balcão. Devolução não registrada.'
    }
  ];

  var locacaoPorId = function (id) {
    for (var i = 0; i < LOCACOES.length; i++) {
      if (LOCACOES[i].id === id) return LOCACOES[i];
    }
    return null;
  };

  /* O status da locação NÃO é lido do campo `status` cru: ele é
     derivado das datas, como acontece na operação real. Uma
     locação que venceu ontem está atrasada hoje, mesmo que
     ninguém tenha mexido no registro — e uma que vence hoje
     passa a "Devolução hoje" sozinha. O campo `status` só é
     respeitado quando diz 'finalizada'. */
  var statusDaLocacao = function (l) {
    if (!l) return 'aguardando';
    if (l.status === 'finalizada') return 'finalizada';
    if (!l.inicio || diffDias(HOJE_ISO, l.inicio) > 0) return 'aguardando';
    if (!l.fimPrevisto) return 'andamento';
    var d = diffDias(HOJE_ISO, l.fimPrevisto);
    if (d < 0) return 'atrasada';
    if (d === 0) return 'devolucao';
    return 'andamento';
  };

  /* Quantos dias de atraso. Zero quando não há atraso. */
  var atrasoDaLocacao = function (l) {
    if (!l || l.status === 'finalizada' || !l.fimPrevisto) return 0;
    var d = diffDias(l.fimPrevisto, HOJE_ISO);
    return d > 0 ? d : 0;
  };

  /* ==========================================================
     8-B · SOLICITAÇÕES DE PRORROGAÇÃO
     ----------------------------------------------------------
     Prorrogar é pedir MAIS TEMPO com o carro que já está na mão
     do cliente. Não confundir com editar o período da reserva
     (que só vale antes da retirada) nem com uma reserva nova.

     `currentReturnAt` e `requestedReturnAt` guardam DATA E HORA
     juntas, em ISO com hora — '2026-09-21T18:00'. A data sozinha
     não bastaria: devolver às 09h e devolver às 18h do mesmo dia
     são períodos diferentes, e é isso que o contrato cobra.

     A DECISÃO NUNCA É IMPLÍCITA.
     Nasce `pendente` e só sai daí por aprovação, recusa ou pela
     regra de aprovação automática. Abrir a solicitação não decide
     nada — é o que mantém de pé a regra "não marque uma pendência
     como resolvida só porque ela foi vista".

     A BASE TRAZ UMA SOLICITAÇÃO PENDENTE, E ELA CONFLITA DE
     PROPÓSITO. É a do Onix Plus que já está na rua com o cliente
     c07, pedindo mais quatro dias — e o mesmo carro tem a
     retirada da R-0015 marcada dois dias antes do fim pedido.
     Sem esse caso na base, o bloqueio de conflito (§8) só
     apareceria se alguém o construísse à mão para ver.
     ---------------------------------------------------------- */
  var EXTENSOES = [
    {
      id: 'x01',
      locacaoId: 'l04', reservaId: 'r06',
      clienteId: 'c07', veiculoId: 'v07',
      currentReturnAt: D(0) + 'T19:00',
      requestedReturnAt: D(4) + 'T19:00',
      extraDays: 4,
      estimatedAdditionalValue: null,
      status: 'pendente',
      createdAt: D(0),
      decidedAt: null,
      decidedBy: null,
      decisionReason: null
    }
  ];

  var extensaoPorId = function (id) {
    for (var i = 0; i < EXTENSOES.length; i++) {
      if (EXTENSOES[i].id === id) return EXTENSOES[i];
    }
    return null;
  };

  var extensoesDaLocacao = function (locacaoId) {
    return EXTENSOES.filter(function (e) { return e.locacaoId === locacaoId; });
  };

  var extensoesDoCliente = function (clienteId) {
    return EXTENSOES.filter(function (e) { return e.clienteId === clienteId; });
  };

  /* A solicitação que ainda espera decisão, se houver. Uma locação
     não pode ter duas ao mesmo tempo: o operador aprovaria a
     segunda sem saber que a primeira mudou a data de devolução. */
  var extensaoPendenteDaReserva = function (reservaId) {
    for (var i = 0; i < EXTENSOES.length; i++) {
      if (EXTENSOES[i].reservaId === reservaId && EXTENSOES[i].status === 'pendente') {
        return EXTENSOES[i];
      }
    }
    return null;
  };

  var extensaoJaDecidida = function (e) {
    return e.status === 'aprovada' || e.status === 'auto' || e.status === 'recusada';
  };

  /* ==========================================================
     9 · CONTRATOS
     ----------------------------------------------------------
     `texto` só é preenchido quando alguém abriu o contrato e
     salvou. Contrato sem texto é contrato que ainda não foi
     montado — a interface regenera a partir do template central
     (`scripts/contrato.js`), que é o único lugar do sistema onde
     existe texto de contrato.

     `modelo: true` marca o CONTRATO DEMONSTRATIVO, aquele que
     existe para mostrar o formato. Ele é o único que aparece com
     "Cliente Demonstração" e valores de exemplo.
     ========================================================== */
  var CONTRATOS = [
    {
      id: 'k01', codigo: 'CT-0001', reserva: 'r07', locacao: null,
      criadoEm: D(-3), atualizadoEm: D(-1),
      status: 'aguardando', via: 'E-mail', enviadoEm: D(-1),
      texto: null, modelo: false
    },
    {
      id: 'k02', codigo: 'CT-0002', reserva: 'r04', locacao: null,
      criadoEm: D(-4), atualizadoEm: D(-4),
      status: 'gerado', via: '', enviadoEm: null,
      texto: null, modelo: false
    },
    {
      id: 'k03', codigo: 'CT-0003', reserva: 'r01', locacao: 'l01',
      criadoEm: D(-13), atualizadoEm: D(-12),
      status: 'assinado', via: 'Presencial', enviadoEm: D(-13),
      texto: null, modelo: false
    },
    {
      id: 'k04', codigo: 'CT-0004', reserva: 'r03', locacao: 'l03',
      criadoEm: D(-3), atualizadoEm: D(-2),
      status: 'assinado', via: 'Presencial', enviadoEm: D(-3),
      texto: null, modelo: false
    },
    {
      id: 'k05', codigo: 'CT-0005', reserva: 'r05', locacao: null,
      criadoEm: D(-4), atualizadoEm: D(-2),
      status: 'enviado', via: 'WhatsApp', enviadoEm: D(-2),
      texto: null, modelo: false
    },
    {
      id: 'k06', codigo: 'CT-0006', reserva: 'r02', locacao: 'l02',
      criadoEm: D(-7), atualizadoEm: D(-6),
      status: 'assinado', via: 'E-mail', enviadoEm: D(-7),
      texto: null, modelo: false
    },
    {
      id: 'k07', codigo: 'CT-0007', reserva: null, locacao: null,
      criadoEm: D(0), atualizadoEm: D(0),
      status: 'rascunho', via: '', enviadoEm: null,
      texto: null, modelo: true
    },
    {
      id: 'k08', codigo: 'CT-0008', reserva: 'r09', locacao: null,
      criadoEm: D(-7), atualizadoEm: D(-6),
      status: 'cancelado', via: '', enviadoEm: null,
      texto: null, modelo: false
    }
  ];

  var contratoPorId = function (id) {
    for (var i = 0; i < CONTRATOS.length; i++) {
      if (CONTRATOS[i].id === id) return CONTRATOS[i];
    }
    return null;
  };

  /* ==========================================================
     10 · FINANCEIRO
     ----------------------------------------------------------
     Cada lançamento aponta para uma reserva. O VALOR não fica
     escrito aqui: ele sai de `preco(reserva)`. Um lançamento com
     valor próprio divergiria da reserva na primeira alteração.

     `tipo` é 'receita', 'caucao' (que é dinheiro de terceiro,
     devolvido depois — por isso tem card próprio) ou 'despesa'.

     `vencimento` em atraso é o que alimenta o card ATRASADO.
     Não existe integração de pagamento: `pago` e `pagoEm` são
     marcados à mão pelo operador, como num caixa real.
     ========================================================== */
  var LANCAMENTOS = [
    { id: 'f01', reserva: 'r01', tipo: 'receita', descricao: 'Locação 3 dias — Porsche 911', vencimento: D(-12), status: 'pago', pagoEm: D(-12), forma: 'PIX' },
    { id: 'f02', reserva: 'r08', tipo: 'receita', descricao: 'Locação 3 dias — Porsche 911', vencimento: D(-20), status: 'pago', pagoEm: D(-20), forma: 'Crédito' },
    { id: 'f03', reserva: 'r14', tipo: 'receita', descricao: 'Locação 5 dias — Mercedes-Benz Classe C', vencimento: D(-30), status: 'pago', pagoEm: D(-30), forma: 'PIX' },
    { id: 'f04', reserva: 'r02', tipo: 'receita', descricao: 'Locação 4 dias — Porsche Cayenne', vencimento: D(-6), status: 'pago', pagoEm: D(-6), forma: 'Crédito' },
    { id: 'f05', reserva: 'r03', tipo: 'receita', descricao: 'Locação 5 dias — Mercedes-Benz Classe C', vencimento: D(3), status: 'pendente', pagoEm: null, forma: '' },
    { id: 'f06', reserva: 'r06', tipo: 'receita', descricao: 'Locação 5 dias — Chevrolet Onix Plus (empresarial)', vencimento: D(2), status: 'pendente', pagoEm: null, forma: '' },
    { id: 'f07', reserva: 'r04', tipo: 'receita', descricao: 'Locação 4 dias — Audi A5 Sportback', vencimento: D(0), status: 'pendente', pagoEm: null, forma: '' },
    { id: 'f08', reserva: 'r07', tipo: 'receita', descricao: 'Locação 6 dias — Mercedes-Benz GLC', vencimento: D(2), status: 'pendente', pagoEm: null, forma: '' },
    { id: 'f09', reserva: 'r05', tipo: 'receita', descricao: 'Locação 3 dias — Hyundai HB20', vencimento: D(1), status: 'pendente', pagoEm: null, forma: '' },
    { id: 'f10', reserva: 'r03', tipo: 'caucao', descricao: 'Caução — Mercedes-Benz Classe C', vencimento: D(-2), status: 'pago', pagoEm: D(-2), forma: 'Crédito' },
    { id: 'f11', reserva: 'r06', tipo: 'caucao', descricao: 'Caução — Chevrolet Onix Plus', vencimento: D(-3), status: 'pago', pagoEm: D(-3), forma: 'PIX' },
    { id: 'f12', reserva: 'r12', tipo: 'caucao', descricao: 'Caução — Porsche Cayenne (a receber na retirada)', vencimento: D(10), status: 'pendente', pagoEm: null, forma: '' },
    /* Este lançamento tem valor PRÓPRIO (`valorManual`) porque
       ele é um adicional cobrado à parte, não o total da
       locação. E o valor vem da tabela do site, não escrito à
       mão: `adicional()` lê de config.js. */
    { id: 'f13', reserva: 'r03', tipo: 'receita', descricao: 'Adicional — motorista autorizado', vencimento: D(-5), status: 'atrasado', pagoEm: null, forma: '', valorManual: adicional('motorista', 1) },
    /* A despesa de manutenção não tem valor: nenhuma oficina foi
       consultada. Fica "a definir" até alguém lançar o custo. */
    { id: 'f14', reserva: null, tipo: 'despesa', descricao: 'Manutenção corretiva — Chevrolet Onix', vencimento: D(-2), status: 'pendente', pagoEm: null, forma: '' }
  ];

  /* O status do lançamento também é derivado: um lançamento
     "pendente" cujo vencimento passou já está atrasado. Só
     'pago' e 'cancelado' são estados finais. */
  var statusDoLancamento = function (f) {
    if (f.status === 'pago' || f.status === 'cancelado') return f.status;
    if (f.vencimento && diffDias(HOJE_ISO, f.vencimento) < 0) return 'atrasado';
    return 'pendente';
  };

  /* ==========================================================
     11 · VISTORIAS
     ----------------------------------------------------------
     As áreas são as que o pedido listou. Cada uma tem seis
     posições de foto, e as fotos NÃO existem: `fotos: null`
     quer dizer "não anexada", e a interface diz que o anexo
     depende do backend. Inventar caminho de imagem aqui seria
     mostrar uma vistoria que nunca foi feita.
     ========================================================== */
  var AREAS_VISTORIA = [
    'Frente', 'Traseira', 'Lateral direita',
    'Lateral esquerda', 'Rodas', 'Interior'
  ];

  var NIVEIS_COMBUSTIVEL = ['Reserva', '1/4', '1/2', '3/4', 'Cheio'];

  var vistoriaVazia = function () {
    var a = {};
    AREAS_VISTORIA.forEach(function (area) {
      a[area] = { observacao: '', fotos: null };
    });
    return a;
  };

  var VISTORIAS = [
    {
      id: 't01', codigo: 'VT-0001', tipo: 'saida', locacao: 'l01', reserva: 'r01',
      clienteId: 'c01', veiculoId: 'v01',
      data: D(-12), hora: '09:05', km: 28450, combustivel: 'Cheio',
      areas: vistoriaVazia(), status: 'concluida',
      obs: 'Veículo entregue limpo, sem avarias aparentes.'
    },
    {
      id: 't02', codigo: 'VT-0002', tipo: 'devolucao', locacao: 'l01', reserva: 'r01',
      clienteId: 'c01', veiculoId: 'v01',
      data: D(-9), hora: '08:50', km: 28890, combustivel: 'Cheio',
      areas: (function () {
        var a = vistoriaVazia();
        a['Rodas'] = { observacao: 'Risco leve na roda traseira direita.', fotos: null };
        return a;
      })(),
      status: 'concluida',
      obs: 'Risco leve na roda traseira direita — registrado como ocorrência.'
    },
    {
      id: 't03', codigo: 'VT-0003', tipo: 'saida', locacao: 'l03', reserva: 'r03',
      clienteId: 'c03', veiculoId: 'v03',
      data: D(-2), hora: '08:28', km: 44180, combustivel: 'Cheio',
      areas: vistoriaVazia(), status: 'concluida', obs: ''
    },
    {
      id: 't04', codigo: 'VT-0004', tipo: 'saida', locacao: 'l04', reserva: 'r06',
      clienteId: 'c07', veiculoId: 'v07',
      data: D(-3), hora: '06:50', km: 57890, combustivel: 'Cheio',
      areas: vistoriaVazia(), status: 'concluida', obs: ''
    },
    {
      id: 't05', codigo: 'VT-0005', tipo: 'saida', locacao: 'l05', reserva: null,
      clienteId: 'c02', veiculoId: 'v09',
      data: D(-6), hora: '17:05', km: 15380, combustivel: 'Cheio',
      areas: vistoriaVazia(), status: 'concluida', obs: ''
    },
    {
      id: 't06', codigo: 'VT-0006', tipo: 'saida', locacao: null, reserva: 'r04',
      clienteId: 'c04', veiculoId: 'v04',
      data: D(0), hora: '', km: null, combustivel: '',
      areas: vistoriaVazia(), status: 'pendente',
      obs: 'Vistoria de saída prevista para hoje, na entrega em domicílio.'
    },
    {
      id: 't07', codigo: 'VT-0007', tipo: 'devolucao', locacao: 'l05', reserva: null,
      clienteId: 'c02', veiculoId: 'v09',
      data: D(0), hora: '', km: null, combustivel: '',
      areas: vistoriaVazia(), status: 'pendente',
      obs: 'Devolução em atraso — vistoria ainda não realizada.'
    }
  ];

  var vistoriaPorId = function (id) {
    for (var i = 0; i < VISTORIAS.length; i++) {
      if (VISTORIAS[i].id === id) return VISTORIAS[i];
    }
    return null;
  };

  var statusDaVistoria = function (v) {
    if (v.status === 'concluida') return 'concluida';
    return 'pendente';
  };

  /* ==========================================================
     12 · MANUTENÇÕES
     ----------------------------------------------------------
     `alerta` é o vocabulário do pedido: Revisão próxima, Óleo,
     Pneus, Documentação. Um veículo com manutenção 'agendada'
     mas ainda dentro da janela continua operando; um com
     'andamento' ou 'bloqueada' está fora de circulação.
     ========================================================== */
  var MANUTENCOES = [
    {
      id: 'm01', veiculoId: 'v10', tipo: 'Preventiva', alerta: 'Revisão próxima',
      descricao: 'Revisão dos freios e troca de pastilhas',
      entrada: D(-2), previsao: D(3), conclusao: null,
      km: 72350, custo: null, oficina: '', status: 'andamento'
    },
    {
      id: 'm02', veiculoId: 'v11', tipo: 'Documentação', alerta: 'Documentação',
      descricao: 'Aguardando regularização de documentação para voltar a circular',
      entrada: D(-9), previsao: null, conclusao: null,
      km: 9840, custo: null, oficina: '', status: 'bloqueada'
    },
    {
      id: 'm03', veiculoId: 'v03', tipo: 'Preventiva', alerta: 'Óleo',
      descricao: 'Troca de óleo e filtros',
      entrada: null, previsao: D(4), conclusao: null,
      km: 44180, custo: null, oficina: '', status: 'agendada'
    },
    {
      id: 'm04', veiculoId: 'v08', tipo: 'Preventiva', alerta: 'Pneus',
      descricao: 'Substituição do par de pneus dianteiros',
      entrada: null, previsao: D(7), conclusao: null,
      km: 18420, custo: null, oficina: '', status: 'agendada'
    },
    {
      id: 'm05', veiculoId: 'v02', tipo: 'Preventiva', alerta: 'Revisão próxima',
      descricao: 'Revisão programada dos 30.000 km',
      entrada: null, previsao: D(11), conclusao: null,
      km: 31200, custo: null, oficina: '', status: 'agendada'
    },
    {
      id: 'm06', veiculoId: 'v05', tipo: 'Preventiva', alerta: 'Óleo',
      descricao: 'Troca de óleo',
      entrada: D(-19), previsao: D(-18), conclusao: D(-18),
      km: 60400, custo: null, oficina: '', status: 'concluida'
    },
    {
      id: 'm07', veiculoId: 'v01', tipo: 'Preventiva', alerta: 'Revisão próxima',
      descricao: 'Revisão preventiva intermediária',
      entrada: null, previsao: D(24), conclusao: null,
      km: 28450, custo: null, oficina: '', status: 'agendada'
    }
  ];

  /* ==========================================================
     13 · OCORRÊNCIAS
     ----------------------------------------------------------
     O que saiu do roteiro: atraso, avaria, conflito de agenda.
     Fica separado da manutenção porque nem toda ocorrência vira
     manutenção, e nem toda manutenção é uma ocorrência.
     ========================================================== */
  var OCORRENCIAS = [
    {
      id: 'o01', tipo: 'Veículo preso em manutenção', veiculoId: 'v10', locacao: null,
      clienteId: 'c07', reserva: 'r11', data: D(-1), status: 'aberta',
      descricao: 'Reserva aguardando confirmação para um período em que o veículo está em manutenção.'
    },
    {
      id: 'o02', tipo: 'Combustível', veiculoId: 'v02', locacao: 'l02',
      clienteId: 'c02', reserva: 'r02', data: D(-2), status: 'analise',
      descricao: 'Veículo devolvido com 3/4 de tanque, abaixo do nível de saída. A diferença a cobrar depende da política de combustível, que ainda está NÃO CONFIGURADA.'
    },
    {
      id: 'o03', tipo: 'Avaria', veiculoId: 'v01', locacao: 'l01',
      clienteId: 'c01', reserva: 'r01', data: D(-9), status: 'analise',
      descricao: 'Risco leve na roda traseira direita, registrado na vistoria de devolução.'
    },
    {
      id: 'o04', tipo: 'Documentação', veiculoId: 'v11', locacao: null,
      clienteId: null, reserva: null, data: D(-9), status: 'aberta',
      descricao: 'Veículo fora de circulação enquanto a documentação não for regularizada.'
    }
  ];

  /* ==========================================================
     14 · DOCUMENTOS
     ----------------------------------------------------------
     Só o CONTROLE: o que falta, o que venceu, o que está em dia.
     O arquivo em si não existe nesta fase — não há armazenamento.
     ========================================================== */
  var DOCUMENTOS = [
    { id: 'd01', tipo: 'cnh', quem: 'cliente', clienteId: 'c02', veiculoId: null, reserva: null, nome: 'CNH — Carlos Eduardo Lima', vence: '2026-11-30', status: 'pendente', arquivo: null },
    { id: 'd02', tipo: 'residencia', quem: 'cliente', clienteId: 'c04', veiculoId: null, reserva: 'r04', nome: 'Comprovante de residência — Rafael Nogueira Alves', vence: null, status: 'ausente', arquivo: null },
    { id: 'd03', tipo: 'cnpj', quem: 'cliente', clienteId: 'c07', veiculoId: null, reserva: null, nome: 'Cartão CNPJ — Vetor Logística e Serviços', vence: null, status: 'ok', arquivo: null },
    { id: 'd04', tipo: 'doc-veic', quem: 'veiculo', clienteId: null, veiculoId: 'v11', reserva: null, nome: 'Documento do veículo — Chevrolet Onix Plus · DEM1K43', vence: null, status: 'pendente', arquivo: null },
    { id: 'd05', tipo: 'doc-veic', quem: 'veiculo', clienteId: null, veiculoId: 'v05', reserva: null, nome: 'Documento do veículo — Hyundai HB20 · DEM5E10', vence: '2026-10-31', status: 'pendente', arquivo: null },
    { id: 'd06', tipo: 'contrato', quem: 'locacao', clienteId: 'c08', veiculoId: 'v08', reserva: 'r07', nome: 'Contrato CT-0001 — aguardando assinatura', vence: null, status: 'pendente', arquivo: null },
    { id: 'd07', tipo: 'vistoria', quem: 'locacao', clienteId: 'c04', veiculoId: 'v04', reserva: 'r04', nome: 'Vistoria de saída VT-0006 — pendente', vence: null, status: 'pendente', arquivo: null },
    { id: 'd08', tipo: 'contrato', quem: 'locacao', clienteId: 'c01', veiculoId: 'v01', reserva: 'r01', nome: 'Contrato CT-0003 — assinado', vence: null, status: 'ok', arquivo: null },
    { id: 'd09', tipo: 'contrato', quem: 'locacao', clienteId: 'c03', veiculoId: 'v03', reserva: 'r03', nome: 'Contrato CT-0004 — assinado', vence: null, status: 'ok', arquivo: null },
    { id: 'd10', tipo: 'vistoria', quem: 'locacao', clienteId: 'c03', veiculoId: 'v03', reserva: 'r03', nome: 'Vistoria de saída VT-0003 — concluída', vence: null, status: 'ok', arquivo: null }
  ];

  /* ==========================================================
     15 · EMPRESA
     ----------------------------------------------------------
     Só o que o SITE JÁ DIZ em público está preenchido: o nome, o
     telefone/WhatsApp, a cidade, o estado e a região. Todo o
     resto vem vazio, com o rótulo "Dado a configurar".

     Não há CNPJ, razão social, inscrição estadual nem endereço
     completo aqui — esses dados não foram fornecidos pela
     locadora, e inventá-los seria criar um dado jurídico falso
     dentro de um contrato. Quando a Lok Car informar, é só
     preencher em Configurações › Empresa que os contratos
     passam a usar o dado real.
     ========================================================== */
  var VAZIO = 'Dado a configurar';

  var EMPRESA = {
    nomeFantasia: 'LOK CAR',
    razaoSocial: '',
    cnpj: '',
    inscricaoEstadual: '',
    telefone: '(81) 99753-0453',
    whatsapp: '(81) 99753-0453',
    email: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: 'Reserva do Paiva',
    cidade: 'Cabo de Santo Agostinho',
    uf: 'PE',
    representante: '',
    representanteDoc: '',
    representanteCargo: '',
    desde: '2014',
    instagram: '@lokcar_locadorape'
  };

  var CAMPOS_EMPRESA = [
    { id: 'razaoSocial',       nome: 'Razão social',              grupo: 'Identificação', obrigatorio: true },
    { id: 'nomeFantasia',      nome: 'Nome fantasia',             grupo: 'Identificação', obrigatorio: true },
    { id: 'cnpj',              nome: 'CNPJ',                      grupo: 'Identificação', obrigatorio: true, mascara: 'cnpj' },
    { id: 'inscricaoEstadual', nome: 'Inscrição estadual',        grupo: 'Identificação', obrigatorio: false },
    { id: 'telefone',          nome: 'Telefone',                  grupo: 'Contato', obrigatorio: true, mascara: 'fone' },
    { id: 'whatsapp',          nome: 'WhatsApp',                  grupo: 'Contato', obrigatorio: true, mascara: 'fone' },
    { id: 'email',             nome: 'E-mail',                    grupo: 'Contato', obrigatorio: true },
    { id: 'cep',               nome: 'CEP',                       grupo: 'Endereço', obrigatorio: false, mascara: 'cep' },
    { id: 'endereco',          nome: 'Endereço',                  grupo: 'Endereço', obrigatorio: false },
    { id: 'numero',            nome: 'Número',                    grupo: 'Endereço', obrigatorio: false },
    { id: 'complemento',       nome: 'Complemento',               grupo: 'Endereço', obrigatorio: false },
    { id: 'bairro',            nome: 'Bairro',                    grupo: 'Endereço', obrigatorio: false },
    { id: 'cidade',            nome: 'Cidade',                    grupo: 'Endereço', obrigatorio: false },
    { id: 'uf',                nome: 'UF',                        grupo: 'Endereço', obrigatorio: false },
    { id: 'representante',     nome: 'Representante legal',       grupo: 'Representação', obrigatorio: true },
    { id: 'representanteDoc',  nome: 'Documento do representante', grupo: 'Representação', obrigatorio: false },
    { id: 'representanteCargo', nome: 'Cargo do representante',   grupo: 'Representação', obrigatorio: false }
  ];

  /* ==========================================================
     16 · REGRAS DO CONTRATO
     ----------------------------------------------------------
     TODOS os valores começam em `null`, e isso é obrigatório.
     O pedido foi explícito: não inventar franquia, caução,
     multa, limite de quilometragem, política de combustível,
     juros nem tolerância de atraso. Enquanto estiverem nulos, a
     tela mostra "NÃO CONFIGURADO" e o contrato escreve
     "a definir pela locadora".

     `dica` explica o que aquele campo decide, em português. Não
     é enfeite: é o que permite ao proprietário preencher sem
     consultar ninguém.
     ========================================================== */
  /* As duas opções de prorrogação, exportadas para serem LIDAS e
     não reescritas. A escolha do dono é gravada como texto da
     opção; `modoDeProrrogacao` precisa comparar com a mesma
     string que foi gravada. */
  var PRORROGACAO_MANUAL = '( ) APROVAÇÃO MANUAL';
  var PRORROGACAO_AUTO = '( ) APROVAÇÃO AUTOMÁTICA QUANDO POSSÍVEL';

  var REGRAS = [
    {
      id: 'combustivel', nome: 'Política de combustível', valor: null,
      unidade: '', opcoes: ['Cheio / Cheio', 'Cheio / Cheio ou taxa', 'Livre'],
      dica: 'Como o veículo sai e como precisa voltar. O contrato repete exatamente o que for escolhido aqui.'
    },
    {
      id: 'quilometragem', nome: 'Limite de quilometragem', valor: null,
      unidade: 'km', opcoes: ['Livre', 'Limitada por dia', 'Limitada por locação'],
      dica: 'O site hoje anuncia "Quilometragem livre" entre os inclusos da demonstração. Confirme antes de levar isso para o contrato.'
    },
    {
      id: 'caucao', nome: 'Valor de caução', valor: null,
      unidade: 'R$', opcoes: [],
      dica: 'Valor retido na retirada e devolvido depois da vistoria de devolução.'
    },
    {
      id: 'franquia', nome: 'Valor de franquia', valor: null,
      unidade: 'R$', opcoes: [],
      dica: 'Valor de responsabilidade do locatário em caso de dano. Precisa ser definido por nível de proteção.'
    },
    {
      id: 'multaAtraso', nome: 'Multa por atraso na devolução', valor: null,
      unidade: '', opcoes: ['Percentual sobre a diária', 'Diária cheia por dia de atraso', 'Valor fixo'],
      dica: 'O que acontece quando o veículo volta depois do previsto.'
    },
    {
      id: 'toleranciaAtraso', nome: 'Tolerância de atraso', valor: null,
      unidade: 'horas', opcoes: [],
      dica: 'Janela em que o atraso não é cobrado.'
    },
    {
      id: 'juros', nome: 'Juros e encargos', valor: null,
      unidade: '', opcoes: ['Sem juros', 'Percentual ao mês', 'Conforme tabela da locadora'],
      dica: 'Encargos sobre valores em atraso.'
    },
    {
      id: 'multasAdministrativas', nome: 'Multas administrativas', valor: null,
      unidade: 'R$', opcoes: [],
      dica: 'Valor repassado ao locatário por infração cometida durante a locação.'
    },
    {
      id: 'cancelamento', nome: 'Política de cancelamento', valor: null,
      unidade: '', opcoes: ['Sem cobrança até 24h antes', 'Cobra a primeira diária', 'Conforme análise'],
      dica: 'Como a reserva pode ser desfeita e o que é cobrado.'
    },
    {
      /* A única regra que NÃO vai para o contrato: ela não descreve
         o que a locadora cobra, descreve como o próprio sistema
         decide. Fica nesta lista mesmo assim porque é configurável
         e precisa do mesmo lugar de sempre.

         O VALOR GUARDADO É O TEXTO DA OPÇÃO — é o que
         `salvarRegras` faz com toda regra que tem `opcoes`. Por
         isso as duas opções vivem em constantes exportadas, e não
         escritas à mão duas vezes: quem lê a decisão compara com
         as MESMAS strings que a tela gravou. Reescrever uma aqui
         e não na leitura faria a escolha do dono ser ignorada em
         silêncio, que é o pior desfecho possível. */
      id: 'prorrogacao', nome: 'Prorrogação de locação', valor: null,
      unidade: '', opcoes: [PRORROGACAO_MANUAL, PRORROGACAO_AUTO], tipo: 'operacao',
      dica: 'Como responder a um pedido de mais dias com o carro na mão do cliente. A aprovação automática só vale quando o veículo está comprovadamente livre; qualquer dúvida vai para a mão do operador.'
    }
  ];

  var REGRAS_LIVRES = {
    protecoes: 'Os níveis de proteção exibidos no site são ilustrativos. Nenhum deles descreve cobertura, franquia ou indenização, e nenhum foi confirmado pela locadora. Enquanto o texto de cada nível não for definido aqui, o contrato escreve apenas o nome da proteção escolhida.',
    adicionais: 'Os serviços adicionais e a taxa de entrega seguem a tabela de demonstração do site. A taxa de entrega é única e depende da região — o sistema não calcula distância.'
  };

  /* ==========================================================
     17 · SESSÃO
     ----------------------------------------------------------
     Não existe autenticação nesta fase. Há UM operador, e a tela
     diz isso em vez de fingir um login. Quando o backend entrar,
     é esta estrutura que ele substitui.
     ========================================================== */
  var USUARIO = {
    nome: 'Administrador',
    iniciais: 'AD',
    cargo: 'Sessão local · sem login',
    email: '',
    perfil: 'Proprietário'
  };

  /* ==========================================================
     18 · CONSULTAS DERIVADAS
     ----------------------------------------------------------
     Tudo o que o painel precisa e que envolve mais de uma
     tabela vive aqui. As telas não cruzam dados por conta
     própria; elas pedem daqui. Assim, se um dia a regra mudar
     (por exemplo, "reservado" passar a incluir contrato
     pendente), muda em um lugar só.
     ========================================================== */

  /* Reservas que ainda ocupam o veículo no futuro. Cancelada e
     finalizada não ocupam mais nada. */
  var OCUPA = ['nova', 'aguardando', 'confirmada', 'contrato', 'pronta', 'andamento'];

  var reservaOcupa = function (r) {
    return OCUPA.indexOf(r.status) !== -1;
  };

  var reservasDoVeiculo = function (veiculoId) {
    return RESERVAS.filter(function (r) {
      return r.veiculoId === veiculoId && r.status !== 'cancelada';
    });
  };

  var locacoesDoVeiculo = function (veiculoId) {
    return LOCACOES.filter(function (l) { return l.veiculoId === veiculoId; });
  };

  /* Existe conflito quando dois períodos do mesmo veículo se
     cruzam. A conta é em dias, não em horas: uma devolução de
     manhã e uma retirada à tarde no mesmo dia é o dia inteiro
     comprometido nesta demonstração — o sistema avisa em vez de
     decidir sozinho. */
  var cruzam = function (a1, a2, b1, b2) {
    if (!a1 || !a2 || !b1 || !b2) return false;
    return diffDias(a1, b2) > 0 && diffDias(b1, a2) > 0;
  };

  /* Lista os choques de agenda da frota inteira. Devolve um
     objeto por par em conflito, com o motivo pronto para exibir. */
  var conflitos = function () {
    var saida = [];
    var porVeiculo = {};

    RESERVAS.forEach(function (r) {
      if (!reservaOcupa(r)) return;

      /* A reserva que já virou locação não é uma segunda ocupação.
         A locação nasce da reserva e cobre o mesmo carro no mesmo
         período: contá-las como dois itens acusaria choque de agenda
         em toda locação em andamento, e o operador iria caçar um
         problema que não existe. Quem ocupa o carro é a locação; a
         reserva é o registro de origem.
         A MESMA REGRA desenha o calendário — se as duas
         divergissem, a tela mostraria uma barra e o aviso falaria
         de outra. */
      var virouLocacao = LOCACOES.some(function (o) { return o.reserva === r.id; });
      if (virouLocacao) return;

      if (!porVeiculo[r.veiculoId]) porVeiculo[r.veiculoId] = [];
      porVeiculo[r.veiculoId].push({
        tipo: 'reserva', id: r.id, codigo: r.codigo,
        de: r.de, ate: r.ate, clienteId: r.clienteId, status: r.status
      });
    });

    LOCACOES.forEach(function (l) {
      if (l.status === 'finalizada') return;
      if (!porVeiculo[l.veiculoId]) porVeiculo[l.veiculoId] = [];
      porVeiculo[l.veiculoId].push({
        tipo: 'locacao', id: l.id, codigo: l.codigo,
        de: l.inicio, ate: l.fimReal || l.fimPrevisto,
        clienteId: l.clienteId, status: l.status
      });
    });

    /* A MANUTENÇÃO TAMBÉM OCUPA O CARRO.
       Faltava aqui, e a falta tinha consequência visível: o
       calendário desenhava a revisão por cima da reserva e o aviso
       de choque não dizia nada, porque a manutenção não entrava na
       conta. O operador via duas barras sobrepostas sem uma linha
       de explicação — pior do que não avisar.
       Carro na oficina e carro reservado no mesmo dia é o mesmo
       choque físico de dois clientes para um carro. */
    MANUTENCOES.forEach(function (m) {
      if (m.status === 'concluida') return;
      var de = m.entrada || m.previsao;
      var ate = m.conclusao || m.previsao;
      if (!de || !ate) return;
      if (!porVeiculo[m.veiculoId]) porVeiculo[m.veiculoId] = [];
      porVeiculo[m.veiculoId].push({
        tipo: 'manutencao', id: m.id, codigo: m.alerta,
        de: de, ate: ate, status: m.status
      });
    });

    Object.keys(porVeiculo).forEach(function (veiculoId) {
      var lista = porVeiculo[veiculoId];
      for (var i = 0; i < lista.length; i++) {
        for (var j = i + 1; j < lista.length; j++) {
          if (cruzam(lista[i].de, lista[i].ate, lista[j].de, lista[j].ate)) {
            saida.push({
              veiculoId: veiculoId,
              a: lista[i], b: lista[j]
            });
          }
        }
      }
    });

    /* Veículo fora de circulação com compromisso marcado também
       é conflito — e é o que está acontecendo com o Onix. */
    VEICULOS.forEach(function (v) {
      if (v.status !== 'manutencao' && v.status !== 'indisponivel') return;
      (porVeiculo[v.id] || []).forEach(function (item) {
        /* O serviço que motivou o bloqueio não é compromisso contra
           ele mesmo. Sem esta linha, um carro na oficina com a
           revisão aberta se acusaria de estar na oficina durante a
           revisão. */
        if (item.tipo === 'manutencao') return;
        if (diffDias(HOJE_ISO, item.ate) >= 0) {
          saida.push({
            veiculoId: v.id,
            a: item,
            b: { tipo: 'frota', id: v.id, codigo: v.placa, de: HOJE_ISO, ate: item.ate, status: v.status }
          });
        }
      });
    });

    return saida;
  };

  /* ==========================================================
     DISPONIBILIDADE NUM PERÍODO
     ----------------------------------------------------------
     Responde uma pergunta só: "este carro está livre de X a Y?".
     É a pergunta que a edição de período (§2), a verificação
     antes da aprovação (§8) e a aprovação automática (§11) fazem
     — as três, sempre a mesma. Por isso mora aqui e não em cada
     tela: se as três respondessem por conta própria, cedo ou
     tarde uma diria sim onde a outra diz não, e o sistema
     marcaria dois compromissos no mesmo carro sem avisar.

     Ignora:
     - a própria reserva que está sendo editada (`ignorarReserva`),
       senão ela se acusaria de conflitar consigo mesma;
     - a locação que nasceu DELA. A reserva que já virou locação
       não é uma segunda ocupação — é o mesmo carro no mesmo
       período. `conflitos()` tem a mesma regra, pelo mesmo motivo;
     - o serviço de manutenção que motivou o próprio bloqueio do
       veículo, que também não é compromisso contra si mesmo.

     Devolve `{livre, motivos[]}`, e cada motivo já sai com `tipo`,
     `codigo` e `rotulo` prontos: quem chamar não precisa montar
     frase, e as três telas escrevem a MESMA justificativa.
     ---------------------------------------------------------- */
  var ROTULO_CONFLITO = {
    reserva:    'Reserva',
    locacao:    'Locação em andamento',
    manutencao: 'Manutenção'
  };

  var disponibilidadeNoPeriodo = function (veiculoId, inicioISO, fimISO, ignorarReserva) {
    var motivos = [];

    /* Datas que não são datas precisam morrer AQUI.

       `diffDias` sobre lixo devolve NaN, e `NaN <= 0` é falso — então
       um período sem data nenhuma passava por toda a checagem como se
       fosse válido, e a alteração era gravada com "—" no lugar do dia.
       Formato conferido na entrada é mais honesto do que confiar que
       ninguém vai chamar isso sem data. */
    if (!veiculoId || !ehDia(inicioISO) || !ehDia(fimISO)) {
      return { livre: false, verificado: false, motivos: motivos };
    }
    if (diffDias(inicioISO, fimISO) <= 0) {
      return { livre: false, verificado: false, motivos: motivos };
    }

    RESERVAS.forEach(function (r) {
      if (r.id === ignorarReserva) return;
      if (r.veiculoId !== veiculoId) return;
      if (!reservaOcupa(r)) return;
      if (LOCACOES.some(function (o) { return o.reserva === r.id; })) return;
      if (!cruzam(inicioISO, fimISO, r.de, r.ate)) return;

      motivos.push({
        tipo: 'reserva', id: r.id, codigo: r.codigo,
        de: r.de, ate: r.ate, status: r.status,
        rotulo: ROTULO_CONFLITO.reserva + ' ' + r.codigo +
                ' (' + fmtData(r.de) + ' a ' + fmtData(r.ate) + ')'
      });
    });

    LOCACOES.forEach(function (l) {
      if (l.veiculoId !== veiculoId) return;
      if (l.status === 'finalizada') return;
      if (l.reserva === ignorarReserva) return;
      var ate = l.fimReal || l.fimPrevisto;
      if (!cruzam(inicioISO, fimISO, l.inicio, ate)) return;

      motivos.push({
        tipo: 'locacao', id: l.id, codigo: l.codigo,
        de: l.inicio, ate: ate, status: l.status,
        rotulo: ROTULO_CONFLITO.locacao + ' ' + l.codigo +
                ' (' + fmtData(l.inicio) + ' a ' + fmtData(ate) + ')'
      });
    });

    MANUTENCOES.forEach(function (m) {
      if (m.veiculoId !== veiculoId) return;
      if (m.status === 'concluida') return;
      var de = m.entrada || m.previsao;
      var ate = m.conclusao || m.previsao;
      if (!de || !ate) return;
      if (!cruzam(inicioISO, fimISO, de, ate)) return;

      motivos.push({
        tipo: 'manutencao', id: m.id, codigo: m.alerta,
        de: de, ate: ate, status: m.status,
        rotulo: ROTULO_CONFLITO.manutencao + ' ' + (m.alerta || m.id) +
                ' (' + fmtData(de) + ' a ' + fmtData(ate) + ')'
      });
    });

    /* Carro fora de circulação não tem janela livre nenhuma. Não é
       choque de agenda — é o veículo parado —, e por isso o motivo
       diz o que é em vez de acusar duas reservas se cruzando.

       A frase é escrita por extenso, e não montada a partir do
       rótulo do status: "Veículo DEM0J21 está manutenção" é o que
       sai da composição automática, e um aviso mal escrito num
       bloqueio é um aviso que o operador lê duas vezes. */
    var v = veiculoPorId(veiculoId);
    if (v && (v.status === 'manutencao' || v.status === 'indisponivel')) {
      motivos.push({
        tipo: 'frota', id: v.id, codigo: v.placa, de: null, ate: null,
        status: v.status,
        rotulo: v.status === 'manutencao'
          ? 'Veículo ' + v.placa + ' está em manutenção'
          : 'Veículo ' + v.placa + ' está indisponível para locação'
      });
    }

    return { livre: motivos.length === 0, verificado: true, motivos: motivos };
  };

  /* Status do veículo DEDUZIDO da operação.
     O campo `status` guarda o que o operador definiu à mão
     (disponível, manutenção, indisponível). O que a operação
     mostra é isto aqui, que é o campo cruzado com a agenda. */
  var statusDoVeiculo = function (v) {
    if (!v) return 'indisponivel';
    if (v.status === 'manutencao' || v.status === 'indisponivel') return v.status;

    var locacoes = locacoesDoVeiculo(v.id).filter(function (l) {
      return l.status !== 'finalizada';
    });
    if (locacoes.length) return 'locado';

    var futuras = reservasDoVeiculo(v.id).filter(function (r) {
      return reservaOcupa(r) && diffDias(HOJE_ISO, r.ate) >= 0;
    });
    if (futuras.length) return 'reservado';

    return 'disponivel';
  };

  var contagemFrota = function () {
    var c = { disponivel: 0, reservado: 0, locado: 0, manutencao: 0, indisponivel: 0 };
    VEICULOS.forEach(function (v) {
      c[statusDoVeiculo(v)] += 1;
    });
    return c;
  };

  /* Índice da frota para o painel. */
  var resumoReservas = function () {
    var porStatus = { nova: 0, aguardando: 0, confirmada: 0, contrato: 0, pronta: 0, andamento: 0, finalizada: 0, cancelada: 0 };
    RESERVAS.forEach(function (r) { porStatus[r.status] += 1; });
    return porStatus;
  };

  var reservasHoje = function () {
    return RESERVAS.filter(function (r) {
      return r.status !== 'cancelada' && (r.de === HOJE_ISO || r.criadaEm === HOJE_ISO);
    });
  };

  var retiradasHoje = function () {
    return RESERVAS.filter(function (r) {
      return r.de === HOJE_ISO &&
             (r.status === 'pronta' || r.status === 'confirmada' || r.status === 'contrato');
    });
  };

  var devolucoesHoje = function () {
    var daAgenda = RESERVAS.filter(function (r) {
      return r.ate === HOJE_ISO && r.status === 'andamento';
    });
    var dasLocacoes = LOCACOES.filter(function (l) {
      return l.status !== 'finalizada' && l.fimPrevisto === HOJE_ISO;
    });
    return { reservas: daAgenda, locacoes: dasLocacoes };
  };

  var proximasRetiradas = function (quantos) {
    var hoje = retiradasHoje();
    var futuras = RESERVAS.filter(function (r) {
      return diffDias(HOJE_ISO, r.de) > 0 &&
             (r.status === 'pronta' || r.status === 'confirmada' || r.status === 'contrato' || r.status === 'aguardando');
    }).sort(function (a, b) { return diffDias(a.de, b.de); });
    var tudo = hoje.concat(futuras);
    return quantos ? tudo.slice(0, quantos) : tudo;
  };

  var proximasDevolucoes = function (quantos) {
    var ativas = LOCACOES.filter(function (l) { return l.status !== 'finalizada'; })
      .map(function (l) {
        return {
          locacao: l, clienteId: l.clienteId, veiculoId: l.veiculoId,
          de: l.inicio, ate: l.fimPrevisto, atrasada: atrasoDaLocacao(l) > 0
        };
      });
    var deReservas = RESERVAS.filter(function (r) {
      return r.status === 'andamento' && diffDias(HOJE_ISO, r.ate) >= 0;
    }).map(function (r) {
      return { reserva: r, clienteId: r.clienteId, veiculoId: r.veiculoId, de: r.de, ate: r.ate, atrasada: false };
    });
    var tudo = ativas.concat(deReservas).sort(function (a, b) { return diffDias(a.ate, b.ate); });
    return quantos ? tudo.slice(0, quantos) : tudo;
  };

  /* Contratos do mês corrente, por status. Usado nos cards. */
  var contratosPorStatus = function () {
    var c = { rascunho: 0, gerado: 0, enviado: 0, aguardando: 0, assinado: 0, cancelado: 0 };
    CONTRATOS.forEach(function (k) { c[k.status] += 1; });
    return c;
  };

  /* ----------------------------------------------------------
     FINANCEIRO
     Cada lançamento recebe o valor da reserva a que pertence.
     Lançamento sem reserva (despesa) tem `valorManual` — e
     quando ele é nulo, o card mostra "a definir", nunca zero:
     zero seria dizer que a despesa custou nada.
     ---------------------------------------------------------- */
  var valorDoLancamento = function (f) {
    if (f.valorManual !== undefined && f.valorManual !== null) return f.valorManual;
    var r = f.reserva ? reservaPorId(f.reserva) : null;
    if (!r) return null;
    var p = preco(r);
    if (p.incompleto) return null;

    /* A caução não sai do total da locação — ela é dinheiro de
       terceiro, retido na retirada e devolvido depois. Enquanto
       a Lok Car não definir o valor em Configurações ›
       Contratos, este lançamento fica "a definir". */
    if (f.tipo === 'caucao') return regraValor('caucao');

    /* A multa por atraso, pelo mesmo motivo, vem da regra
       configurada — nunca de um percentual escolhido por mim. */
    if (f.tipo === 'multa') return regraValor('multaAtraso');

    return p.total;
  };

  /* Valor NUMÉRICO de uma regra configurada. Devolve null
     enquanto estiver "NÃO CONFIGURADO" — é esse null que faz a
     interface escrever "a definir" em vez de R$ 0,00, que
     afirmaria que o serviço é gratuito.

     Algumas regras não têm número nenhum: são escolhas entre
     opções ("Cheio / Cheio", "Limitada por dia"). Para essas,
     Number() daria NaN — e NaN num total contamina a soma
     inteira, transformando o valor de um lançamento em nada. Se
     o que está guardado não é número, aqui a resposta é null:
     "não há valor a aplicar", que é diferente de "é zero". */
  var regraValor = function (id) {
    for (var i = 0; i < REGRAS.length; i++) {
      if (REGRAS[i].id === id) {
        var v = REGRAS[i].valor;
        if (v === null || v === undefined || v === '') return null;
        var n = Number(v);
        return isNaN(n) ? null : n;
      }
    }
    return null;
  };

  /* ----------------------------------------------------------
     MODO DE PRORROGAÇÃO
     ----------------------------------------------------------
     Lê a escolha do dono. `regras` é o parâmetro, não uma busca
     interna, e isso é deliberado: `dados.js` tem a SEMENTE das
     regras, mas quem o operador edita é a cópia VIVA, que mora na
     sessão. Ler a semente aqui devolveria "manual" para sempre —
     o dono mudaria para automático, a tela salvaria, e o sistema
     continuaria decidindo à mão sem dizer por quê.

     Por isso quem chama passa a lista viva. Sem lista, o padrão é
     o mais conservador: aprovação manual. */
  var modoDeProrrogacao = function (regras) {
    var lista = regras || REGRAS;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === 'prorrogacao') {
        return lista[i].valor === PRORROGACAO_AUTO ? 'auto' : 'manual';
      }
    }
    return 'manual';
  };

  var lancamentos = function () {
    return LANCAMENTOS.map(function (f) {
      var r = f.reserva ? reservaPorId(f.reserva) : null;
      return {
        dados: f,
        reserva: r,
        valor: valorDoLancamento(f),
        status: statusDoLancamento(f)
      };
    });
  };

  var financeiroResumo = function () {
    var lista = lancamentos();
    var aReceber = 0, recebidoMes = 0, atrasado = 0, caucoes = 0;
    var mes = HOJE.getMonth();
    var ano = HOJE.getFullYear();

    lista.forEach(function (item) {
      var v = item.valor || 0;
      var f = item.dados;
      if (item.status === 'cancelado') return;

      if (item.status === 'pendente') aReceber += v;
      if (item.status === 'atrasado') { atrasado += v; aReceber += v; }

      if (item.status === 'pago' && f.pagoEm) {
        var p = emData(f.pagoEm);
        if (p && p.getMonth() === mes && p.getFullYear() === ano) recebidoMes += v;
      }

      /* Caução em poder da locadora: recebida e ainda não
         devolvida. Como a devolução não é controlada nesta
         fase, entra a caução paga que pertence a uma locação
         ainda aberta. */
      if (f.tipo === 'caucao' && item.status === 'pago' && f.pagoEm) {
        var l = LOCACOES.filter(function (x) { return x.reserva === f.reserva; })[0];
        /* Se a locação já terminou e a caução não foi devolvida,
           o dinheiro continua retido. Sem controle de devolução
           nesta fase, isso é o mais próximo da verdade — e o
           card escreve "a conferir" justamente por causa disso. */
        if (!l || l.status !== 'finalizada') caucoes += v;
      }
    });

    return {
      aReceber: aReceber,
      recebidoMes: recebidoMes,
      atrasado: atrasado,
      caucoes: caucoes,
      total: lista.length
    };
  };

  /* ----------------------------------------------------------
     PENDÊNCIAS
     É a lista que responde "o que eu preciso resolver agora".
     Cada item já vem com o rótulo, o alvo da rota e o texto de
     apoio, para a tela não ter que montar frase.
     ---------------------------------------------------------- */
  var pendencias = function () {
    var lista = [];

    CONTRATOS.forEach(function (k) {
      if (k.status === 'aguardando') {
        var r = k.reserva ? reservaPorId(k.reserva) : null;
        lista.push({
          tipo: 'contrato',
          titulo: 'Contrato aguardando assinatura',
          apoio: k.codigo + (r ? ' · ' + r.codigo + ' — ' + (clientePorId(r.clienteId) || { nome: 'Cliente não informado' }).nome : ''),
          rota: '#/contratos', alvo: k.id
        });
      }
      if (k.status === 'rascunho' && !k.modelo) {
        lista.push({
          tipo: 'contrato',
          titulo: 'Contrato em rascunho',
          apoio: k.codigo + ' ainda não foi gerado',
          rota: '#/contratos', alvo: k.id
        });
      }
    });

    DOCUMENTOS.forEach(function (d) {
      if (d.status === 'ok' || d.status === 'vencido') return;
      var oQue;
      if (d.status === 'ausente') oQue = 'Documento não enviado';
      else if (d.vence && diffDias(HOJE_ISO, d.vence) < 30) oQue = 'Documento a vencer';
      else oQue = 'Documento pendente';
      lista.push({
        tipo: 'documento',
        titulo: oQue,
        apoio: d.nome + (d.vence ? ' · vence em ' + fmtData(d.vence) : ''),
        rota: '#/documentos', alvo: d.id
      });
    });

    lancamentos().forEach(function (item) {
      /* Despesa não é pendência de operação: ela entra no
         financeiro, não na lista de "resolver agora". */
      if (item.dados.tipo === 'despesa') return;

      var valorTxt = item.valor === null ? 'valor a configurar' : fmtBRL(item.valor);

      if (item.status === 'atrasado') {
        lista.push({
          tipo: 'pagamento',
          titulo: 'Pagamento em atraso',
          apoio: item.dados.descricao + ' · ' + valorTxt,
          rota: '#/financeiro', alvo: item.dados.id
        });
      }
      if (item.status === 'pendente' && item.dados.vencimento && diffDias(HOJE_ISO, item.dados.vencimento) <= 1) {
        lista.push({
          tipo: 'pagamento',
          titulo: 'Pagamento vence ' + quando(item.dados.vencimento),
          apoio: item.dados.descricao + ' · ' + valorTxt,
          rota: '#/financeiro', alvo: item.dados.id
        });
      }
    });

    VISTORIAS.forEach(function (v) {
      if (v.status === 'pendente') {
        lista.push({
          tipo: 'vistoria',
          titulo: 'Vistoria pendente',
          apoio: v.codigo + ' · ' + (v.tipo === 'saida' ? 'saída' : 'devolução') + ' — ' +
                 (veiculoPorId(v.veiculoId) || { modelo: '—' }).modelo,
          rota: '#/vistorias', alvo: v.id
        });
      }
    });

    LOCACOES.forEach(function (l) {
      var atraso = atrasoDaLocacao(l);
      if (atraso > 0) {
        lista.push({
          tipo: 'devolucao',
          titulo: 'Devolução atrasada',
          apoio: l.codigo + ' · ' + (veiculoPorId(l.veiculoId) || { modelo: '—' }).modelo +
                 ' · ' + atraso + (atraso === 1 ? ' dia de atraso' : ' dias de atraso'),
          rota: '#/locacoes', alvo: l.id
        });
      }
    });

    RESERVAS.forEach(function (r) {
      if (r.status === 'nova' && r.origem === 'site') {
        lista.push({
          tipo: 'reserva',
          titulo: 'Reserva nova do site sem cadastro',
          apoio: r.codigo + ' · ' + (veiculoPorId(r.veiculoId) || { modelo: '—' }).modelo +
                 ' · cliente ainda não informado',
          rota: '#/reservas', alvo: r.id
        });
      }
    });

    conflitos().forEach(function (c) {
      var v = veiculoPorId(c.veiculoId);
      /* Um bloco de frota (manutenção, indisponível) não é
         "conflito de agenda" — é o veículo fora de circulação
         com compromisso marcado. O texto muda porque a ação do
         operador também muda. */
      var ehFrota = c.b.tipo === 'frota';
      lista.push({
        tipo: ehFrota ? 'frota' : 'conflito',
        titulo: ehFrota ? 'Veículo fora de circulação com reserva' : 'Conflito de agenda',
        apoio: (v ? v.modelo + ' · ' + v.placa : '—') + ' — ' +
               (ehFrota ? c.a.codigo + ' marcada para o período'
                        : c.a.codigo + ' e ' + c.b.codigo + ' se cruzam'),
        rota: '#/calendario', alvo: c.veiculoId
      });
    });

    MANUTENCOES.forEach(function (m) {
      if (m.status === 'concluida') return;
      var v = veiculoPorId(m.veiculoId);
      if (m.status === 'bloqueada') {
        lista.push({
          tipo: 'manutencao',
          titulo: 'Veículo bloqueado',
          apoio: (v ? v.modelo + ' · ' + v.placa : '—') + ' — ' + m.descricao,
          rota: '#/manutencoes', alvo: m.id
        });
      } else if (m.previsao && diffDias(HOJE_ISO, m.previsao) <= 7) {
        lista.push({
          tipo: 'manutencao',
          titulo: 'Manutenção ' + quando(m.previsao),
          apoio: (v ? v.modelo + ' · ' + v.placa : '—') + ' — ' + m.descricao,
          rota: '#/manutencoes', alvo: m.id
        });
      }
    });

    /* ----------------------------------------------------------
       PRORROGAÇÕES
       --------------------------------------
       Entram em DOIS lugares, e a divisão é de propósito:

       - `pendente` vira uma pendência comum, porque é trabalho a
         fazer: alguém precisa aprovar ou recusar. É ela que soma
         no sino.

       - `aprovada` e `auto` viram uma SEGUNDA linha, de tipo
         próprio, porque mudaram a data de devolução e a agenda da
         frota já obedece à data nova. O sistema tem de contar que
         houve uma alteração — não é só um pedido respondido, é um
         contrato com data diferente.

       - `recusada` não entra. Recusar é uma decisão, não uma
         pendência: ficaria na lista para sempre pedindo uma
         providência que já foi tomada. A recusa aparece na tela
         da solicitação e no histórico do cliente, que é onde ela
         tem serventia.

       O `alvo` é o PRÓPRIO id da extensão. Quem abre a notificação
       cai na tela de prorrogação com ela já aberta — nunca na
       locação, onde a decisão não mora. */
    EXTENSOES.forEach(function (e) {
      var v = veiculoPorId(e.veiculoId);
      var c = e.clienteId ? clientePorId(e.clienteId) : null;
      var quem = c ? c.nome : 'Cliente não informado';
      var carro = v ? v.modelo + ' · ' + v.placa : '—';

      if (e.status === 'pendente') {
        lista.push({
          tipo: 'prorrogacao',
          titulo: 'Solicitação de prorrogação',
          apoio: quem + ' · ' + carro + ' — de ' + fmtDataHora(e.currentReturnAt) +
                 ' para ' + fmtDataHora(e.requestedReturnAt) +
                 ' (+' + e.extraDays + (e.extraDays === 1 ? ' dia' : ' dias') + ')',
          rota: '#/prorrogacoes', alvo: e.id
        });
      } else if (e.status === 'aprovada' || e.status === 'auto') {
        lista.push({
          tipo: 'prorrogacao-ok',
          titulo: e.status === 'auto'
            ? 'Prorrogação aprovada automaticamente'
            : 'Prorrogação aprovada',
          apoio: carro + ' — devolução agora em ' + fmtDataHora(e.requestedReturnAt) +
                 ' (+' + e.extraDays + (e.extraDays === 1 ? ' dia' : ' dias') + ')',
          rota: '#/prorrogacoes', alvo: e.id
        });
      }
    });

    return lista;
  };

  /* Notificações = pendências com nome de recado. Ficou separado
     porque o sino do topo precisa de um número curto e a tela de
     pendências precisa do detalhe todo.

     O `tipo` VAI JUNTO, e não é detalhe de forma. A tela de
     notificações agrupa por área, e a área é decidida pelo tipo
     (`areaDe(p.tipo)`) — sem ele, `areaDe(undefined)` caía sempre
     no grupo reserva de "Outras pendências". Durante toda a Fase 1
     isso não apareceu porque o único grupo que o teste olhava era
     justamente esse: as sete áreas existiam no código e nenhuma
     recebia item. Quem perdia era o operador, que via uma lista de
     22 itens de áreas diferentes embolada sob o rótulo "sem área
     definida". */
  var notificacoes = function () {
    return pendencias().map(function (p, i) {
      return {
        id: 'n' + (i + 1),
        tipo: p.tipo,
        titulo: p.titulo,
        apoio: p.apoio,
        rota: p.rota,
        alvo: p.alvo,
        lida: false
      };
    });
  };

  /* ==========================================================
     19 · AGENDA (para o calendário da frota)
     ----------------------------------------------------------
     Devolve, por veículo, as faixas de ocupação dentro de uma
     janela de dias. Cada faixa já vem com o tipo (reserva ou
     locação), o status e o código, prontos para virar barra.
     ========================================================== */
  var agendaDaFrota = function (inicioISO, dias) {
    var inicio = inicioISO || D(-3);
    var total = dias || 21;
    var fim = (function () {
      var d = emData(inicio);
      d.setDate(d.getDate() + total);
      return iso(d);
    })();

    var linhas = VEICULOS.map(function (v) {
      var faixas = [];

      RESERVAS.forEach(function (r) {
        if (r.veiculoId !== v.id || r.status === 'cancelada') return;

        /* A RESERVA SAI DA AGENDA QUANDO A LOCAÇÃO COMEÇA.
           "Reserva: intenção ou agendamento. Locação: contrato
           efetivamente iniciado" — é a distinção do §9, e é ela que
           decide o que a linha do tempo mostra.

           Do instante em que a locação existe, quem ocupa o carro é
           ELA; a reserva virou o registro de origem. Desenhar as
           duas escreveria o mesmo compromisso duas vezes, uma em cima
           da outra — e, pior, com as mesmas datas, o que o sistema
           leria como choque de agenda. O operador passaria a caçar
           uma sobreposição que não existe, e no dia em que houvesse
           uma de verdade ela estaria misturada com onze falsas.

           A reserva não some do sistema: continua na lista, na ficha
           do cliente e no histórico. Só não é mais o que ocupa o
           carro. */
        var virouLocacao = LOCACOES.some(function (o) { return o.reserva === r.id; });
        if (virouLocacao) return;

        if (!cruzam(r.de, r.ate, inicio, fim)) return;
        faixas.push({
          tipo: 'reserva', id: r.id, codigo: r.codigo,
          de: r.de, ate: r.ate, status: r.status,
          clienteId: r.clienteId
        });
      });

      LOCACOES.forEach(function (l) {
        if (l.veiculoId !== v.id || l.status === 'finalizada') return;
        var ate = l.fimReal || l.fimPrevisto;
        if (!cruzam(l.inicio, ate, inicio, fim)) return;
        faixas.push({
          tipo: 'locacao', id: l.id, codigo: l.codigo,
          de: l.inicio, ate: ate, status: statusDaLocacao(l),
          clienteId: l.clienteId, atraso: atrasoDaLocacao(l)
        });
      });

      MANUTENCOES.forEach(function (m) {
        if (m.veiculoId !== v.id || m.status === 'concluida') return;
        var de = m.entrada || m.previsao;
        var ate = m.conclusao || m.previsao;
        if (!de || !ate) return;
        if (!cruzam(de, ate, inicio, fim)) return;
        faixas.push({
          tipo: 'manutencao', id: m.id, codigo: m.alerta,
          de: de, ate: ate, status: m.status, alerta: m.alerta
        });
      });

      return {
        veiculo: v,
        status: statusDoVeiculo(v),
        faixas: faixas.sort(function (a, b) { return diffDias(a.de, b.de); })
      };
    });

    return { inicio: inicio, fim: fim, dias: total, linhas: linhas };
  };

  /* ==========================================================
     20 · PARADAS DO DIA (a frota na oficina e no balcão)
     ----------------------------------------------------------
     Duas contas que a tela da frota precisa e que NÃO podem ser
     feitas por ela. A regra desta camada é a mesma desde o
     começo: quem cruza tabelas é aqui, não a tela. Se cada tela
     cruzar por conta própria, um dia duas telas discordam sobre
     quantos carros estão na oficina.

     Nenhuma das duas é uma segunda verdade sobre o veículo. A
     PRIMEIRA é o motivo do carro estar parado — o campo
     `status`, que é digitado à mão, diz "manutenção" e não diz
     por quê. A SEGUNDA é o que ainda dá para fazer hoje com o
     carro, que é a pergunta que o balcão faz de manhã.
     ========================================================== */

  /* Por que cada unidade fora de circulação está fora de
     circulação. Devolve um objeto por veículo, com o motivo já
     escrito. Veículo disponível não entra na lista. */
  var paradasNaOficina = function () {
    var saida = [];

    VEICULOS.forEach(function (v) {
      if (v.status !== 'manutencao' && v.status !== 'indisponivel') return;

      /* Ordem das tentativas: primeiro o que tem data marcada,
         porque "revisão em 3 dias" é mais útil para a oficina do
         que "revisão preventiva". A descrição do serviço vem
         depois, e a última saída é dizer que não há nada marcado
         — que também é informação, e é a que exige decisão. */
      var abertas = MANUTENCOES.filter(function (m) {
        return m.veiculoId === v.id && m.status !== 'concluida';
      });

      var motivo = null;
      var tipo = 'bloqueio';
      var rota = '#/manutencoes';
      var alvo = null;

      if (abertas.length) {
        /* A que tem previsão mais próxima manda: é a que vai
           devolver o carro à rua primeiro. Sem previsão nenhuma,
           fica a primeira da lista. */
        var comData = abertas.slice().sort(function (a, b) {
          if (!a.previsao) return 1;
          if (!b.previsao) return -1;
          return diffDias(a.previsao, b.previsao);
        })[0];
        var m = comData;
        tipo = 'manutencao';
        alvo = m.id;
        motivo = m.alerta + ' · ' + m.descricao;
        if (m.previsao) motivo += ' · previsão ' + fmtData(m.previsao);
      } else {
        /* Sem manutenção aberta o motivo não está em lugar
           nenhum. Escrever um seria inventar. */
        motivo = v.status === 'indisponivel'
          ? 'Sem manutenção registrada. O motivo da indisponibilidade não foi anotado.'
          : 'Marcado em manutenção sem serviço registrado.';
      }

      saida.push({
        veiculo: v,
        status: v.status,
        tipo: tipo,
        motivo: motivo,
        motivoCurto: abertas.length
          ? (abertas[0].alerta + (abertas[0].previsao ? ' · ' + quando(abertas[0].previsao) : ''))
          : 'sem serviço registrado',
        manutencoes: abertas,
        rota: rota,
        alvo: alvo
      });
    });

    /* O bloqueio por documentação primeiro: é o único que não
       depende de oficina nenhuma, então é o único que a locadora
       pode resolver hoje. */
    return saida.sort(function (a, b) {
      if (a.tipo !== b.tipo) return a.tipo === 'bloqueio' ? -1 : 1;
      return a.veiculo.placa < b.veiculo.placa ? -1 : 1;
    });
  };

  /* O que está marcado para hoje, com o carro: as retiradas que
     o balcão precisa entregar, as devoluções que ele precisa
     receber e as vistorias que ainda faltam registrar.

     Serve à tela da frota e ao calendário. O painel tem as suas
     próprias listas de retirada e devolução, com outro recorte
     (as próximas, não só as de hoje) — por isso esta função não
     substitui aquelas, ela responde outra pergunta. */
  var paradasHoje = function () {
    var saida = [];

    RESERVAS.forEach(function (r) {
      if (r.status !== 'pronta' && r.status !== 'confirmada') return;
      if (r.de !== HOJE_ISO) return;
      var k = null;
      for (var i = 0; i < CONTRATOS.length; i++) {
        if (CONTRATOS[i].reserva === r.id) { k = CONTRATOS[i]; break; }
      }
      saida.push({
        tipo: 'retirada',
        quando: 'hoje',
        hora: r.retiradaHora || '',
        veiculo: veiculoPorId(r.veiculoId),
        clienteId: r.clienteId,
        codigo: r.codigo,
        rota: '#/reservas/' + r.id,
        apoio: k && k.status === 'assinado' ? 'contrato assinado'
             : (k ? 'contrato ' + acharStatus(STATUS_CONTRATO, k.status).rotulo.toLowerCase()
                  : 'sem contrato gerado')
      });
    });

    LOCACOES.forEach(function (l) {
      if (l.status === 'finalizada') return;
      var st = statusDaLocacao(l);

      /* O carro que hoje sai. O que já saiu antes e ainda não
         voltou aparece na devolução, não na retirada. */
      if (l.inicio === HOJE_ISO && st !== 'aguardando') {
        saida.push({
          tipo: 'retirada',
          quando: 'hoje',
          hora: l.horaSaida || '',
          veiculo: veiculoPorId(l.veiculoId),
          clienteId: l.clienteId,
          codigo: l.codigo,
          rota: '#/locacoes/' + l.id,
          apoio: 'locação iniciada hoje'
        });
      }

      /* O carro que hoje volta — inclusive o que já devia ter
         voltado. */
      var venceHoje = l.fimPrevisto === HOJE_ISO;
      var atrasada = atrasoDaLocacao(l) > 0;
      if (venceHoje || atrasada) {
        var atraso = atrasoDaLocacao(l);
        saida.push({
          tipo: 'devolucao',
          quando: atrasada ? 'atrasada' : 'hoje',
          hora: l.horaEntrada || '',
          veiculo: veiculoPorId(l.veiculoId),
          clienteId: l.clienteId,
          codigo: l.codigo,
          rota: '#/locacoes/' + l.id,
          apoio: atrasada
            ? atraso + (atraso === 1 ? ' dia de atraso' : ' dias de atraso')
            : 'devolução prevista para hoje'
        });
      }
    });

    /* A vistoria que falta é uma PARADA, não um detalhe: sem ela
       o carro não sai e a locação não fecha. As duas regras estão
       em `sessao.js` e são citadas aqui, não reescritas. */
    VISTORIAS.forEach(function (vt) {
      if (vt.status !== 'pendente') return;
      saida.push({
        tipo: 'vistoria',
        quando: 'hoje',
        hora: vt.hora || '',
        veiculo: veiculoPorId(vt.veiculoId),
        clienteId: vt.clienteId,
        codigo: vt.codigo,
        rota: '#/vistorias/' + vt.id,
        apoio: vt.tipo === 'saida'
          ? 'sem ela a locação não inicia'
          : 'sem ela a locação não finaliza'
      });
    });

    /* O que trava o dia primeiro: o atraso, depois a vistoria,
       depois a devolução e por último a retirada — que é a única
       que ainda está no prazo. */
    var peso = { atrasada: 0, hoje: 1 };
    var peso2 = { vistoria: 0, devolucao: 1, retirada: 2 };
    return saida.sort(function (a, b) {
      if (peso[a.quando] !== peso[b.quando]) return peso[a.quando] - peso[b.quando];
      if (peso2[a.tipo] !== peso2[b.tipo]) return peso2[a.tipo] - peso2[b.tipo];
      return (a.hora || 'zz') < (b.hora || 'zz') ? -1 : 1;
    });
  };

  /* ==========================================================
     21 · EXPORTAÇÃO
     ========================================================== */
  return {
    /* tempo */
    HOJE: HOJE_ISO,
    D: D,
    iso: iso,
    emData: emData,
    diffDias: diffDias,
    fmtData: fmtData,
    fmtDataCurta: fmtDataCurta,
    fmtDataHora: fmtDataHora,
    soData: soData,
    ehDia: ehDia,
    horaDe: horaDe,
    fmtBRL: fmtBRL,
    quando: quando,
    MESES: MESES,
    MESES_CURTO: MESES_CURTO,
    DIAS_SEMANA: DIAS_SEMANA,

    /* vocabulário */
    TOM: TOM,
    STATUS_RESERVA: STATUS_RESERVA,
    STATUS_LOCACAO: STATUS_LOCACAO,
    STATUS_FROTA: STATUS_FROTA,
    STATUS_CONTRATO: STATUS_CONTRATO,
    STATUS_FINANCEIRO: STATUS_FINANCEIRO,
    STATUS_VISTORIA: STATUS_VISTORIA,
    STATUS_MANUTENCAO: STATUS_MANUTENCAO,
    STATUS_DOCUMENTO: STATUS_DOCUMENTO,
    STATUS_OCORRENCIA: STATUS_OCORRENCIA,
    STATUS_EXTENSAO: STATUS_EXTENSAO,
    acharStatus: acharStatus,

    /* tabelas */
    CATEGORIAS: CATEGORIAS,
    DOCUMENTOS_TIPO: DOCUMENTOS_TIPO,
    AREAS_VISTORIA: AREAS_VISTORIA,
    NIVEIS_COMBUSTIVEL: NIVEIS_COMBUSTIVEL,
    VEICULOS: VEICULOS,
    CLIENTES: CLIENTES,
    RESERVAS: RESERVAS,
    LOCACOES: LOCACOES,
    CONTRATOS: CONTRATOS,
    LANCAMENTOS: LANCAMENTOS,
    VISTORIAS: VISTORIAS,
    MANUTENCOES: MANUTENCOES,
    OCORRENCIAS: OCORRENCIAS,
    DOCUMENTOS: DOCUMENTOS,
    EXTENSOES: EXTENSOES,
    EMPRESA: EMPRESA,
    CAMPOS_EMPRESA: CAMPOS_EMPRESA,
    REGRAS: REGRAS,
    REGRAS_LIVRES: REGRAS_LIVRES,
    PRORROGACAO_MANUAL: PRORROGACAO_MANUAL,
    PRORROGACAO_AUTO: PRORROGACAO_AUTO,
    USUARIO: USUARIO,
    VAZIO: VAZIO,

    /* buscas */
    veiculoPorId: veiculoPorId,
    clientePorId: clientePorId,
    reservaPorId: reservaPorId,
    reservaPorCodigo: reservaPorCodigo,
    locacaoPorId: locacaoPorId,
    contratoPorId: contratoPorId,
    vistoriaPorId: vistoriaPorId,
    diariaDo: diariaDo,
    faixaDo: faixaDo,
    preco: preco,
    valorDaProrrogacao: valorDaProrrogacao,
    valorAdicional: valorAdicional,
    adicional: adicional,
    protecaoPorNome: protecaoPorNome,
    adicionalPorNome: adicionalPorNome,
    enderecoDeLinha: enderecoDeLinha,
    regraValor: regraValor,
    modoDeProrrogacao: modoDeProrrogacao,
    vistoriaVazia: vistoriaVazia,

    /* prorrogação */
    extensaoPorId: extensaoPorId,
    extensoesDaLocacao: extensoesDaLocacao,
    extensoesDoCliente: extensoesDoCliente,
    extensaoPendenteDaReserva: extensaoPendenteDaReserva,
    extensaoJaDecidida: extensaoJaDecidida,

    /* derivados */
    statusDaLocacao: statusDaLocacao,
    atrasoDaLocacao: atrasoDaLocacao,
    statusDoLancamento: statusDoLancamento,
    statusDaVistoria: statusDaVistoria,
    statusDoVeiculo: statusDoVeiculo,
    reservaOcupa: reservaOcupa,
    reservasDoVeiculo: reservasDoVeiculo,
    locacoesDoVeiculo: locacoesDoVeiculo,
    cruzam: cruzam,
    conflitos: conflitos,
    disponibilidadeNoPeriodo: disponibilidadeNoPeriodo,
    contagemFrota: contagemFrota,
    resumoReservas: resumoReservas,
    reservasHoje: reservasHoje,
    retiradasHoje: retiradasHoje,
    devolucoesHoje: devolucoesHoje,
    proximasRetiradas: proximasRetiradas,
    proximasDevolucoes: proximasDevolucoes,
    contratosPorStatus: contratosPorStatus,
    lancamentos: lancamentos,
    valorDoLancamento: valorDoLancamento,
    financeiroResumo: financeiroResumo,
    pendencias: pendencias,
    notificacoes: notificacoes,
    agendaDaFrota: agendaDaFrota,
    paradasNaOficina: paradasNaOficina,
    paradasHoje: paradasHoje
  };
})();
