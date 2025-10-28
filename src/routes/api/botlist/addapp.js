// Função: converte nome da linguagem em número padronizado
function parseLang(langInput) {
  if (!langInput) return 0; // padrão = BDFD

  const lang = langInput.trim().toLowerCase();

  // Mapa de linguagens → número + aliases
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
    11: ["html", "css", "web"],
    12: ["json"],
    13: ["outros", "other", "misc"]
  };

  // Procura a linguagem dentro do mapa
  for (const [code, aliases] of Object.entries(langMap)) {
    if (aliases.includes(lang)) return Number(code);
  }

  // Se não encontrou, retorna código de "outros"
  return 13;
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
    'ERR-0008': 'Aplicação já está na queue desta guilda'
  };

  // CAMPOS OBRIGATÓRIOS E SEUS ERROS
  const requiredFields = {
    appID: 'ERR-0001',
    devID: 'ERR-0002',
    guildID: 'ERR-0003',
    appDB: 'ERR-0004',
    devDB: 'ERR-0005',
    guildDB: 'ERR-0006',
    queueDB: 'ERR-0007'
  };

  // 🔁 Validação automática
  for (const [field, errorID] of Object.entries(requiredFields)) {
    if (!req.query[field]) {
      return res.status(400).json({
        success: false,
        errorID,
        error: errorMap[errorID],
        message: 'Precisando de ajuda? Entre em contato em https://dsc.gg/bdfd-utils'
      });
    }
  }

  // Parse da queueDB (se não for um array válido, cria vazio)
  let guildQueue;
  try {
    guildQueue = JSON.parse(queueDB);
    if (!Array.isArray(guildQueue)) guildQueue = [];
  } catch {
    guildQueue = [];
  }

  // ✅ Verifica se appID já existe na queue da guild
  if (guildQueue.includes(appID)) {
    return res.status(400).json({
      success: false,
      errorID: 'ERR-0008',
      error: errorMap['ERR-0008'],
      message: 'Não é possível adicionar o mesmo appID duas vezes nesta guilda.'
    });
  }

  // 

  // ✅ Adiciona appID à queue
  guildQueue.push(appID);

  res.status(200).json({
    success: true,
    message: 'Requisição recebida com sucesso!',
    appID,
    queue: guildQueue
  });
};
