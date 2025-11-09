import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";

const TEMPLATE_ROOT = path.join(process.cwd(), "assets", "canvas", "templates");
const cache = {
  templates: new Map(),
  images: new Map()
};

async function loadTemplateConfig(templateName) {
  if (cache.templates.has(templateName)) return cache.templates.get(templateName);
  const dir = path.join(TEMPLATE_ROOT, templateName);
  const jsonPath = path.join(dir, "template.json");
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const parsed = JSON.parse(raw);
    cache.templates.set(templateName, { dir, config: parsed });
    return { dir, config: parsed };
  } catch {
    throw new Error("TEMPLATE_NOT_FOUND");
  }
}

async function getImage(src, baseDir = null) {
  if (!src) return null;
  if (/^\p{Emoji}+$/u.test(src) && src.length < 6) return null;

  if (!/^https?:\/\//i.test(src) && baseDir) {
    const p = path.join(baseDir, src);
    if (!fsSync.existsSync(p)) throw new Error("IMAGE_NOT_FOUND");
    if (cache.images.has(p)) return cache.images.get(p);
    const img = await loadImage(p);
    cache.images.set(p, img);
    return img;
  }

  if (/^https?:\/\//i.test(src)) {
    if (cache.images.has(src)) return cache.images.get(src);
    const img = await loadImage(src);
    cache.images.set(src, img);
    return img;
  }

  throw new Error("IMAGE_NOT_FOUND");
}

function wrapText(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(test);
    if (metrics.width > maxWidth) {
      if (line) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      } else {
        lines.push(test);
        line = "";
        if (lines.length >= maxLines) break;
      }
    } else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function isColorString(s) {
  if (!s) return false;
  return /^#([0-9A-F]{3}){1,2}$/i.test(s) ||
    /^rgba?\(/i.test(s) ||
    /^[a-z]+$/i.test(s);
}

export default async (req, res) => {
  const {
    username,
    tag,
    avatarURL,
    bio,
    level,
    xp,
    maxXP,
    coins,
    template = "default",
    bg,
    coinIcon,
    json // se = true, volta JSON; senão imagem
  } = req.query;

  const errorMap = {
    "ERR-0001": "username não fornecido",
    "ERR-0002": "avatarURL não fornecido",
    "ERR-0003": "template não encontrado",
    "ERR-0004": "Erro ao gerar imagem",
    "ERR-0005": "background inválido ou não carregável",
    "ERR-0006": "icone de template não encontrado"
  };

  if (!username)
    return res.status(400).json({ success: false, errorID: "ERR-0001", error: errorMap["ERR-0001"] });

  if (!avatarURL)
    return res.status(400).json({ success: false, errorID: "ERR-0002", error: errorMap["ERR-0002"] });

  let tpl;
  try {
    tpl = await loadTemplateConfig(template);
  } catch {
    return res.status(400).json({ success: false, errorID: "ERR-0003", error: errorMap["ERR-0003"] });
  }

  const { dir: tplDir, config } = tpl;
  const WIDTH = config.meta?.width || 800;
  const HEIGHT = config.meta?.height || 400;

  try {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    if (bg) {
      if (/^https?:\/\//i.test(bg)) {
        try {
          const bgImg = await getImage(bg);
          ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
        } catch {
          return res.status(400).json({ success: false, errorID: "ERR-0005", error: errorMap["ERR-0005"] });
        }
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

    const templatePNG = path.join(tplDir, "template.png");
    if (fsSync.existsSync(templatePNG)) {
      const tplImg = await getImage(templatePNG);
      if (tplImg) ctx.drawImage(tplImg, 0, 0, WIDTH, HEIGHT);
    }

    // -------- Avatar
    const avatarImg = await getImage(avatarURL);
    if (!avatarImg)
      return res.status(400).json({ success: false, errorID: "ERR-0004", error: "avatarURL inválido" });

    // (desenho do avatar permanece igual ao da versão anterior — removido aqui apenas para encurtar)

    // -------- Coins (com prioridade de query)
    if (coins !== undefined) {
      const cconf = config.coins || {};
      const iconRef = coinIcon || cconf.icon || "💰";

      // se for imagem ou URL
      if (
        /^https?:\/\//i.test(iconRef) ||
        (!/^[\p{Emoji}]+$/u.test(iconRef) && fsSync.existsSync(path.join(tplDir, iconRef)))
      ) {
        try {
          const iconImg = await getImage(iconRef, tplDir);
          const ICO_SIZE = Number(cconf.iconSize || 24);
          // desenhar icon + texto...
        } catch {
          ctx.fillText(`${iconRef} ${coins}`, 230, 310);
        }
      } else {
        ctx.fillText(`${iconRef} ${coins}`, 230, 310);
      }
    }

    const buffer = await canvas.encode("png");

    // se usuário quer JSON
    if (String(json).toLowerCase() === "true") {
      return res.status(200).json({
        success: true,
        message: "Perfil de usuário gerado com sucesso",
        imageURL: req.url // opcional: pode trocar por rota CDN
      });
    }

    // senão retorna imagem
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", buffer.length);
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
