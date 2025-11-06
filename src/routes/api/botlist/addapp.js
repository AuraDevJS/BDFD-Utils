// Função: converte nome da linguagem em número padronizado
function parseLang(langInput) {
  if (!langInput) return 11; // padrão = BDFD

  const lang = langInput.trim().toLowerCase();
  const langMap = {
    0: ["bdfd", "bdscript", "bot designer", "bds", "botdesigner", "bdfdscript", "bdscript 2", "bot designer for discord"],
    1: ["javascript", "js", "nodejs"],
    2: ["python", "py"],
    3: ["typescript", "ts"],
    4: ["java"],
    5: ["c#", "csharp", "dotnet"],
    6: ["c++", "cpp"],
    7: ["php"],
    8: ["ruby"],
    9: ["go", "golang"],
    10: ["lua"],
    11: ["outros", "other", "misc"]
  };

  for (const [code, aliases] of Object.entries(langMap)) {
    if (aliases.includes(lang)) return Number(code);
  }

  return 11;
}

// Verifica idade do app
function checkAppAge(appID, minDays) {
  if (!appID) return false;

  const discordEpoch = 1420070400000;
  const timestamp = Number(BigInt(appID) >> 22n) + discordEpoch;
  const diffMs = Date.now() - timestamp;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= minDays;
}

// Converte valores textuais ou booleanos comuns para true/false
function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;

  const normalized = String(value).trim().toLowerCase();
  const trueValues = ['true', 't', '1', 'yes', 'y', 'sim', 's'];
  const falseValues = ['false', 'f', '0', 'no', 'n', 'não', 'nao'];

  if (trueValues.includes(normalized)) return true;
  if (falseValues.includes(normalized)) return false;

  return defaultValue;
}

//////////////////////////////////////////////////////////////////////////////////////////

export default (req, res) => {
  const {
    appID, devID, guildID,
    desc, prefix, slash, lang,
    appDB, devDB, guildDB, queueDB
  } = req.query;

  // MAPA DE ERROS
  const errorMap = {
    'ERR-0001': 'appID não fornecido',
    'ERR-0002': 'devID não fornecido',
    'ERR-0003': 'guildID não fornecido',
    'ERR-0004': 'appDB não fornecido',
    'ERR-0005': 'devDB não fornecido',
    'ERR-0006': 'guildDB não fornecido',
    'ERR-0007': 'queueDB não fornecido',
    'ERR-0008': 'Aplicação já está na queue desta guilda',
    'ERR-0009': 'Aplicação já aprovada nesta guilda',
    'ERR-0010': 'Limite de aplicações do desenvolvedor atingido',
    'ERR-0011': 'Limite global de aplicações da guilda atingido',
    'ERR-0012': 'O app precisa ter mais dias de criação'
  };

  // CAMPOS OBRIGATÓRIOS
  const requiredFields = {
    appID: 'ERR-0001',
    devID: 'ERR-0002',
    guildID: 'ERR-0003',
    appDB: 'ERR-0004',
    devDB: 'ERR-0005',
    guildDB: 'ERR-0006',
    queueDB: 'ERR-0007'
  };

  // Validação automática com log
  for (const [field, errorID] of Object.entries(requiredFields)) {
    if (!req.query[field]) {
      console.error(`ERRO: Campo obrigatório não fornecido - ${field}`);
      return res.status(400).json({
        success: false,
        errorID,
        error: errorMap[errorID],
        message: 'Precisando de ajuda? Entre em contato em https://dsc.gg/bdfd-utils'
      });
    }
  }

  // Parse da queueDB
  let guildQueue;
  try {
    guildQueue = JSON.parse(queueDB);
    if (!Array.isArray(guildQueue)) guildQueue = [];
  } catch (err) {
    console.error('ERRO ao parsear queueDB:', err);
    guildQueue = [];
  }

  // Verifica se appID já existe na queue
  if (guildQueue.includes(appID)) {
    console.error('ERRO: appID já na queue:', appID);
    return res.status(400).json({
      success: false,
      errorID: 'ERR-0008',
      error: errorMap['ERR-0008'],
      message: 'Não é possível adicionar o mesmo appID duas vezes nesta guilda.'
    });
  }

  // Garante que appDB, devDB e guildDB são objetos
  const app = appDB && typeof appDB === 'object' ? appDB : {};
  const dev = devDB && typeof devDB === 'object' ? devDB : {};
  const guild = guildDB && typeof guildDB === 'object' ? guildDB : {};

  // Verifica se já foi aprovado
  if (app.aproved) {
    console.error('ERRO: appID já aprovado:', appID);
    return res.status(400).json({
      success: false,
      errorID: 'ERR-0009',
      error: errorMap['ERR-0009'],
      message: 'Esse appID já foi aprovado neste servidor.'
    });
  }

  // Verifica idade do app
  const minDaysRequired = guild?.o?.creation || 0;
  if (!checkAppAge(appID, minDaysRequired)) {
    console.error('ERRO: appID ainda muito novo:', appID);
    return res.status(400).json({
      success: false,
      errorID: 'ERR-0012',
      error: errorMap['ERR-0012'],
      message: `Este app ainda é muito novo. É necessário que tenha pelo menos ${minDaysRequired} dias de criação.`
    });
  }

  // Verifica limite de aplicações
  let effectiveLimit = dev?.maxApps || 0;
  if (effectiveLimit === 0) effectiveLimit = guild?.o?.maxApps || 0;

  if (effectiveLimit > 0) {
    const devAppsCount = guildQueue.filter(a => a.devID === devID).length;

    if (devAppsCount >= effectiveLimit) {
      console.error('ERRO: Limite de apps atingido para devID:', devID);
      return res.status(400).json({
        success: false,
        errorID: dev?.maxApps > 0 ? 'ERR-0010' : 'ERR-0011',
        error: dev?.maxApps > 0 ? errorMap['ERR-0010'] : errorMap['ERR-0011'],
        message: dev?.maxApps > 0
          ? 'Você atingiu o limite de aplicações que pode adicionar nesta guilda.'
          : 'O limite global de aplicações desta guilda foi atingido.'
      });
    }
  }

  // Adiciona appID à queue
  guildQueue.push(appID);

  // Monta informações organizadas do app
  const appInfo = {
    aproved: false,
    prefix: prefix || '!',
    slash: parseBoolean(slash, false),
    lang: parseLang(lang),
    desc: desc || 'Sem descrição...',
    img: app?.img || '',
    owner: devID,
    tags: app?.tags || [],
    addedAt: Math.floor(Date.now() / 1000),
    website: app?.website || '',
    suport: app?.suport || ''
  };

  // Garante que dev.apps seja um array
  const devApps = dev?.apps || [];

  // Adiciona o appID
  devApps.push(appID);

  // Atualiza o devInfo
  const devInfo = {
    apps: devApps,
    bio: dev?.bio || 'Sem descrição...',
    maxApps: dev?.maxApps || 0
  };

  res.status(200).json({
    success: true,
    message: 'Requisição recebida com sucesso!',
    appID,
    queue: guildQueue,
    app: appInfo,
    dev: devInfo
  });
};
