import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

GlobalFonts.registerFromPath("./assets/fonts/Montserrat.ttf", "Montserrat");
GlobalFonts.registerFromPath("./assets/fonts/NotoColorEmoji-Regular.ttf", "Emoji1");

const cache = {
  templates: new Map(),
  images: new Map()
};

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("JSON_FETCH_FAILED");
    return await res.json();
  } catch {
    throw new Error("JSON_FETCH_FAILED");
  }
}

async function getImage(src, transparentIfFail = true) {
  if (!src) return null;
  if (cache.images.has(src)) return cache.images.get(src);

  try {
    const img = await loadImage(src);
    cache.images.set(src, img);
    return img;
  } catch {
    if (!transparentIfFail) throw new Error("IMAGE_NOT_LOADED");
    return null;
  }
}

export default async (req, res) => {
  const BASE_URL = `${req.protocol}://${req.get("host")}/assets/canvas/templates`;

  const {
    username,
    avatarURL,
    bio,
    level,
    xp,
    maxXP,
    coins,
    template = "default",
    bg,
    coinIcon,
    json
  } = req.query;

  const errorMap = {
    "ERR-0001": "username não fornecido",
    "ERR-0002": "avatarURL não fornecido",
    "ERR-0003": "template não encontrado",
    "ERR-0004": "Erro ao gerar imagem",
    "ERR-0005": "background inválido",
    "ERR-0006": "icone não carregado"
  };

  if (!username)
    return res.status(400).json({ success: false, errorID: "ERR-0001", error: errorMap["ERR-0001"] });

  if (!avatarURL)
    return res.status(400).json({ success: false, errorID: "ERR-0002", error: errorMap["ERR-0002"] });

  const templateURL = `${BASE_URL}/${template}/template.json`;
  let config;

  try {
    if (cache.templates.has(template)) config = cache.templates.get(template);
    else {
      config = await fetchJSON(templateURL);
      cache.templates.set(template, config);
    }
  } catch {
    return res.status(400).json({ success: false, errorID: "ERR-0003", error: errorMap["ERR-0003"] });
  }

  const WIDTH = config.meta?.width || 800;
  const HEIGHT = config.meta?.height || 400;

  try {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // ================= BACKGROUND =================
    if (bg) {
      if (/^https?:\/\//i.test(bg)) {
        const bgImg = await getImage(bg);
        if (!bgImg)
          return res.status(400).json({ success: false, errorID: "ERR-0005", error: errorMap["ERR-0005"] });
        ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
      } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
    } else {
      ctx.fillStyle = config.background?.defaultColor || "#1e1e1e";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // ================= TEMPLATE IMAGE (OPTIONAL) =================
    const templatePNG = `${BASE_URL}/${template}/template.png`;
    const tplImg = await getImage(templatePNG, true);
    if (tplImg) ctx.drawImage(tplImg, 0, 0, WIDTH, HEIGHT);

    // ================= SIDEBAR =================
    if (config.sidebar) {
      const sb = config.sidebar;
      ctx.fillStyle = sb.color || "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.roundRect(sb.x, sb.y, sb.width, sb.height, sb.radius || 0);
      ctx.fill();
    }

    // ================= AVATAR =================
    const avatarImg = await getImage(avatarURL, false);
    if (!avatarImg)
      return res.status(400).json({ success: false, errorID: "ERR-0004", error: "avatarURL inválido" });

    const av = config.avatar;
    if (av) {
      const r = av.radius || av.size / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(av.x + r, av.y + r, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, av.x, av.y, av.size, av.size);
      ctx.restore();
    }

    // ================= TEXTS =================
if (config.text) {
  for (const [key, txt] of Object.entries(config.text)) {
    if (!txt.enabled) continue;

    ctx.font = `${txt.font}, Emoji1`; // Usa exatamente o font vindo do JSON
    ctx.fillStyle = txt.color || "#fff";

    let value = "";

    switch (key) {
      case "username":
        value = username;
        break;

      case "tag":
        value = txt.prefix ? `${txt.prefix}${username}` : username;
        break;

      case "bio":
        value = bio || "";
        break;

      case "level":
        value = `Lv ${level || 0}`;
        break;

      case "xp":
        if (xp !== undefined && maxXP !== undefined) {
          value = txt.showXPText ? `${xp}/${maxXP}` : "";
        }
        break;

      case "coins":
        if (coins !== undefined) {
          value = `${coins}`;
        }
        break;
    }

    if (value) ctx.fillText(value, txt.x, txt.y);
  }
}


    // ================= COINS =================
    if (coins !== undefined) {
      const c = config.coins;
      if (c?.enabled) {
        const iconRef = coinIcon || c.icon;
        let iconImg = null;

        if (iconRef) {
          const iconURL = /^https?:\/\//.test(iconRef) ? iconRef : `${BASE_URL}/${template}/${iconRef}`;
          iconImg = await getImage(iconURL, true);
        }

        if (iconImg) ctx.drawImage(iconImg, c.x, c.y, c.size, c.size);

        ctx.font = `${c.weight || 400} ${c.size || 20}px ${c.font || "sans-serif"}`;
        ctx.fillStyle = c.color || "#fff";
        ctx.fillText(`${coins}`, c.x + (c.size + 5), c.y + (c.size - 5));
      }
    }

    const buffer = await canvas.encode("png");

    if (String(json).toLowerCase() === "true") {
      return res.status(200).json({
        success: true,
        message: "Perfil gerado",
        template,
        render: req.originalUrl
      });
    }

    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({
      success: false,
      errorID: "ERR-0004",
      error: errorMap["ERR-0004"],
      details: err.message
    });
  }
};
