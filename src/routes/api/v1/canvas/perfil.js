import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const cache = {
  templates: new Map(),
  images: new Map()
};

// ================= FONT REGISTRATION =================
async function registerFonts(req) {
  try {
    // Montserrat
    const montserratRes = await fetch(`${req.protocol}://${req.get("host")}/assets/fonts/Montserrat.ttf`);
    const montserratBuffer = Buffer.from(await montserratRes.arrayBuffer());
    GlobalFonts.registerFromBuffer(montserratBuffer, "FontM");

    // Emoji
    const emojiRes = await fetch(`${req.protocol}://${req.get("host")}/assets/fonts/NotoColorEmoji-Regular.ttf`);
    const emojiBuffer = Buffer.from(await emojiRes.arrayBuffer());
    GlobalFonts.registerFromBuffer(emojiBuffer, "Emoji1");
  } catch (err) {
    console.error("Erro ao registrar fonts:", err);
  }
}

// ================= AUX FUNCTIONS =================
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

// ================= API HANDLER =================
export default async (req, res) => {
  await registerFonts(req); // registra fonts antes de desenhar

  const BASE_URL = `${req.protocol}://${req.get("host")}/assets/canvas/templates`;

  const { username, avatarURL, bio, level, xp, maxXP, coins, template = "default", bg, coinIcon, json } = req.query;

  const errorMap = {
    "ERR-0001": "username não fornecido",
    "ERR-0002": "avatarURL não fornecido",
    "ERR-0003": "template não encontrado",
    "ERR-0004": "Erro ao gerar imagem",
    "ERR-0005": "background inválido",
    "ERR-0006": "icone não carregado"
  };

  if (!username) return res.status(400).json({ success: false, errorID: "ERR-0001", error: errorMap["ERR-0001"] });
  if (!avatarURL) return res.status(400).json({ success: false, errorID: "ERR-0002", error: errorMap["ERR-0002"] });

  let config;
  try {
    if (cache.templates.has(template)) config = cache.templates.get(template);
    else {
      config = await fetchJSON(`${BASE_URL}/${template}/template.json`);
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
    ctx.fillStyle = bg || config.background?.defaultColor || "#1e1e1e";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ================= TEMPLATE IMAGE (OPTIONAL) =================
    const tplImg = await getImage(`${BASE_URL}/${template}/template.png`, true);
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
    if (!avatarImg) return res.status(400).json({ success: false, errorID: "ERR-0004", error: "avatarURL inválido" });

    if (config.avatar?.enabled) {
      const av = config.avatar;
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

        ctx.font = `${txt.font} Emoji1`; // usa font Montserrat + Emoji
        ctx.fillStyle = txt.color || "#fff";

        let value = "";
        switch (key) {
          case "username": value = username; break;
          case "tag": value = txt.prefix ? `${txt.prefix}${username}` : username; break;
          case "bio": value = bio || ""; break;
          case "level": value = `Lv ${level || 0}`; break;
          case "xp": value = xp !== undefined && maxXP !== undefined ? `${xp}/${maxXP}` : ""; break;
          case "coins": value = coins !== undefined ? `${coins}` : ""; break;
        }

        if (value) ctx.fillText(value, txt.x, txt.y);
      }
    }

    const buffer = await canvas.encode("png");

    if (String(json).toLowerCase() === "true") {
      return res.status(200).json({ success: true, message: "Perfil gerado", template, render: req.originalUrl });
    }

    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({ success: false, errorID: "ERR-0004", error: errorMap["ERR-0004"], details: err.message });
  }
};
