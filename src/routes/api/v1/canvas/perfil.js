
import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";

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

async function getImage(src, fallbackTransparent = true) {
  if (!src) return fallbackTransparent ? null : null;

  if (cache.images.has(src)) return cache.images.get(src);

  try {
    const img = await loadImage(src);
    cache.images.set(src, img);
    return img;
  } catch {
    if (!fallbackTransparent) throw new Error("IMAGE_NOT_LOADED");
    return null;
  }
}

function isColorString(s) {
  if (!s) return false;
  return /^#([0-9A-F]{3}){1,2}$/i.test(s) ||
    /^rgba?\(/i.test(s) ||
    /^[a-z]+$/i.test(s);
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
    "ERR-0005": "background inválido ou não carregável",
    "ERR-0006": "icone não carregado"
  };

  if (!username)
    return res.status(400).json({ success: false, errorID: "ERR-0001", error: errorMap["ERR-0001"] });

  if (!avatarURL)
    return res.status(400).json({ success: false, errorID: "ERR-0002", error: errorMap["ERR-0002"] });

  // ---- Template Loader via HTTP GET
  let config;
  const templateURL = `${BASE_URL}/${template}/template.json`;

  try {
    if (cache.templates.has(template)) {
      config = cache.templates.get(template);
    } else {
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

    // ---- Background Layer
    if (bg) {
      if (/^https?:\/\//i.test(bg)) {
        const bgImg = await getImage(bg);
        if (!bgImg)
          return res.status(400).json({ success: false, errorID: "ERR-0005", error: errorMap["ERR-0005"] });
        ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
      } else if (isColorString(bg)) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      } else {
        return res.status(400).json({ success: false, errorID: "ERR-0005", error: errorMap["ERR-0005"] });
      }
    } else {
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // ---- Template PNG Layer
    const templatePNG = `${BASE_URL}/${template}/template.png`;
    const tplImg = await getImage(templatePNG);
    if (tplImg) ctx.drawImage(tplImg, 0, 0, WIDTH, HEIGHT);

    // ---- Avatar
    const avatarImg = await getImage(avatarURL);
    if (!avatarImg)
      return res.status(400).json({ success: false, errorID: "ERR-0004", error: "avatarURL inválido" });

    // draw avatar (código omitido para encurtar)

    // ---- Coins
    if (coins !== undefined) {
      const iconRef = coinIcon || config?.coins?.icon;
      if (iconRef) {
        const iconImg = await getImage(iconRef);
        if (iconImg) {
          // draw icon + coin text
        } else {
          // fallback: sem ícone
        }
      } else {
        // sem ícone
      }
    }

    const buffer = await canvas.encode("png");

    if (String(json).toLowerCase() === "true") {
      return res.status(200).json({
        success: true,
        message: "Perfil gerado",
        template,
        image: `${req.protocol}://${req.get("host")}${req.originalUrl}`
      });
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({
      success: false,
      errorID: "ERR-0004",
      error: errorMap["ERR-0004"],
      details: err?.message
    });
  }
};
