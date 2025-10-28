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
    'ERR-0007': 'queueDB não fornecido'
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

  // ✅ Se passou por todas as validações
  let q = [];

  res.status(200).json({
    success: true,
    message: 'Requisição recebida com sucesso!',
    appID,
    queue: q
  });
};
