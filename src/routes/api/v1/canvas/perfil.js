import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";

const TEMPLATE_ROOT = path.join(process.cwd(), "assets", "canvas", "templates");

// Simple in-memory cache
const cache = {
  templates: new Map(), // templateName -> parsed JSON
  images: new Map()     // filePath -> loaded image
};

// Helper: load and cache JSON template
async function loadTemplateConfig(templateName) {
  if (cache.templates.has(templateName)) return cache.templates.get(templateName);

  const dir = path.join(TEMPLATE_ROOT, templateName);
  const jsonPath = path.join(dir, "template.json");
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const parsed = JSON.parse(raw);
    cache.templates.set(templateName, { dir, config: parsed });
    return { dir, config: parsed };
  } catch (err) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }
}

// Helper: load and cache image (local file or remote URL)
async function getImage(src, baseDir = null) {
  // If src is an emoji (single char), return null (draw emoji as text)
  if (!src) return null;
  if (/^\p{Emoji}+$/u.test(src) && src.length < 6) return null;

  // Local path (relative to template dir)
  if (!/^https?:\/\//i.test(src) && baseDir) {
    const p = path.join(baseDir, src);
    if (!fsSync.existsSync(p)) throw new Error("IMAGE_NOT_FOUND");
    if (cache.images.has(p)) return cache.images.get(p);
    const img = await loadImage(p);
    cache.images.set(p, img);
    return img;
  }

  // Remote URL
  if (/^https?:\/\//i.test(src)) {
    if (cache.images.has(src)) return cache.images.get(src);
    const img = await loadImage(src);
    cache.images.set(src, img);
    return img;
  }

  throw new Error("IMAGE_NOT_FOUND");
}

// Utility: wrap text into lines <= maxWidth
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
        // single word too long, force cut
        lines.push(test);
        line = "";
        if (lines.length >= maxLines) break;
      }
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

// Simple color validator for hex or rgb or named (we accept it's valid; canvas will throw if invalid)
function isColorString(s) {
  if (!s) return false;
  return /^#([0-9A-F]{3}){1,2}$/i.test(s) || /^rgba?\(/i.test(s) || /^[a-z]+$/i.test(s);
}

// Main API handler (export default for Vercel/Serverless)
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
    bg // color or URL
  } = req.query;

  // ERR MAP (ERR-0001...)
  const errorMap = {
    "ERR-0001": "username não fornecido",
    "ERR-0002": "avatarURL não fornecido",
    "ERR-0003": "template não encontrado",
    "ERR-0004": "Erro ao gerar imagem",
    "ERR-0005": "background inválido ou não carregável",
    "ERR-0006": "icone de template não encontrado"
  };

  // Basic required fields
  if (!username) {
    return res.status(400).json({ success: false, errorID: "ERR-0001", error: errorMap["ERR-0001"] });
  }
  if (!avatarURL) {
    return res.status(400).json({ success: false, errorID: "ERR-0002", error: errorMap["ERR-0002"] });
  }

  // Load template config
  let tpl;
  try {
    tpl = await loadTemplateConfig(template);
  } catch (err) {
    return res.status(400).json({ success: false, errorID: "ERR-0003", error: errorMap["ERR-0003"] });
  }

  const { dir: tplDir, config } = tpl;
  const WIDTH = config.meta?.width || 800;
  const HEIGHT = config.meta?.height || 400;

  // Create canvas
  try {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // ---------- Background (color or URL)
    if (bg) {
      if (/^https?:\/\//i.test(bg)) {
        try {
          const bgImg = await getImage(bg);
          ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
        } catch (err) {
          return res.status(400).json({ success: false, errorID: "ERR-0005", error: errorMap["ERR-0005"] });
        }
      } else if (isColorString(bg)) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      } else {
        return res.status(400).json({ success: false, errorID: "ERR-0005", error: errorMap["ERR-0005"] });
      }
    } else {
      // default background color
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // ---------- Template PNG (layer above background)
    if (config.templateImage) {
      // if config explicitly references a file, load that; else assume template dir has template.png
    }
    const defaultTemplateImagePath = path.join(tplDir, "template.png");
    if (!fsSync.existsSync(defaultTemplateImagePath)) {
      // It's allowed for template to not have template.png, but recommended.
      // We don't fail here; we simply continue (template optional).
    } else {
      const tplImg = await getImage(defaultTemplateImagePath);
      if (tplImg) ctx.drawImage(tplImg, 0, 0, WIDTH, HEIGHT);
    }

    // ---------- Avatar
    // load avatar (remote URL accepted)
    const avatarImg = await getImage(avatarURL);
    if (!avatarImg) {
      // If avatar cannot load, return error
      return res.status(400).json({ success: false, errorID: "ERR-0004", error: "avatarURL inválido ou não carregável" });
    }

    const av = config.avatar || {};
    const AV_SIZE = Number(av.size || 150);
    const AV_X = Number(av.x ?? 50);
    const AV_Y = Number(av.y ?? (HEIGHT / 2 - AV_SIZE / 2));
    const shape = (av.shape || "circle").toLowerCase();

    // optional avatar border
    const borderW = av.border?.width || 0;
    const borderColor = av.border?.color || "#000000";

    // draw avatar shape + image
    ctx.save();
    if (shape === "rounded") {
      const r = Number(av.radius || 16);
      // rounded rect clip
      roundRectClip(ctx, AV_X, AV_Y, AV_SIZE, AV_SIZE, r);
    } else {
      // circle
      ctx.beginPath();
      ctx.arc(AV_X + AV_SIZE / 2, AV_Y + AV_SIZE / 2, AV_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(avatarImg, AV_X, AV_Y, AV_SIZE, AV_SIZE);
    ctx.restore();

    // draw border if requested
    if (borderW > 0) {
      ctx.beginPath();
      if (shape === "rounded") {
        const r = Number(av.radius || 16);
        roundedRectPath(ctx, AV_X - borderW/2, AV_Y - borderW/2, AV_SIZE + borderW, AV_SIZE + borderW, r + borderW/2);
        ctx.lineWidth = borderW;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      } else {
        ctx.lineWidth = borderW;
        ctx.strokeStyle = borderColor;
        ctx.beginPath();
        ctx.arc(AV_X + AV_SIZE / 2, AV_Y + AV_SIZE / 2, AV_SIZE / 2 + borderW/2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ---------- Texts: username, tag, bio
    // username
    const uname = config.username || {};
    ctx.fillStyle = uname.color || "#ffffff";
    ctx.font = uname.font || "bold 36px Sans";
    const UN_X = Number(uname.x || (AV_X + AV_SIZE + 30));
    const UN_Y = Number(uname.y || (HEIGHT / 2 - 30));
    const unameMax = Number(uname.maxWidth || (WIDTH - UN_X - 20));
    drawTextSafe(ctx, username, UN_X, UN_Y, unameMax);

    // tag
    if (tag) {
      const tconf = config.tag || {};
      ctx.fillStyle = tconf.color || "#cccccc";
      ctx.font = tconf.font || "24px Sans";
      const T_X = Number(tconf.x || UN_X);
      const T_Y = Number(tconf.y || (UN_Y + 30));
      drawTextSafe(ctx, `#${tag}`, T_X, T_Y, tconf.maxWidth || 200);
    }

    // bio
    if (bio) {
      const bconf = config.bio || {};
      ctx.fillStyle = bconf.color || "#dddddd";
      ctx.font = bconf.font || "20px Sans";
      const B_X = Number(bconf.x || UN_X);
      const B_Y = Number(bconf.y || (UN_Y + 70));
      const B_WIDTH = Number(bconf.maxWidth || (WIDTH - B_X - 20));
      const B_LINES = Number(bconf.maxLines || 2);
      const lines = wrapText(ctx, bio, B_WIDTH, B_LINES);
      lines.forEach((ln, i) => ctx.fillText(ln, B_X, B_Y + i * 26));
    }

    // ---------- Stats: Level / XP bar (only if level/xp/maxXP given)
    const statsCfg = config.stats || {};
    if (level !== undefined && xp !== undefined && maxXP !== undefined) {
      const S_X = Number(statsCfg.x || UN_X);
      let S_Y = Number(statsCfg.y || (UN_Y + 120));
      ctx.fillStyle = statsCfg.textColor || "#ffffff";
      ctx.font = statsCfg.levelFont || "20px Sans";
      ctx.fillText(`Level: ${level}`, S_X, S_Y);

      // xp bar
      S_Y += 22;
      const BAR_W = Number(statsCfg.barWidth || 300);
      const BAR_H = Number(statsCfg.barHeight || 18);
      const xpNum = Number(xp);
      const maxXpNum = Number(maxXP);
      const percent = Math.max(0, Math.min(1, xpNum / (maxXpNum || 1)));

      ctx.fillStyle = statsCfg.barBackground || "#333333";
      roundRect(ctx, S_X, S_Y, BAR_W, BAR_H, Number(statsCfg.barRadius || 6), true);

      ctx.fillStyle = statsCfg.barFill || "#00cc88";
      roundRect(ctx, S_X, S_Y, BAR_W * percent, BAR_H, Number(statsCfg.barRadius || 6), true);

      // border
      ctx.strokeStyle = statsCfg.barBorder || "#ffffff";
      ctx.lineWidth = statsCfg.barBorderWidth || 1;
      roundRect(ctx, S_X, S_Y, BAR_W, BAR_H, Number(statsCfg.barRadius || 6), false);

      // XP text
      if (statsCfg.showXPText !== false) {
        ctx.fillStyle = statsCfg.textColor || "#ffffff";
        ctx.font = statsCfg.font || "16px Sans";
        ctx.fillText(`XP: ${xp}/${maxXP}`, S_X, S_Y + BAR_H + 20);
      }
    }

    // ---------- Coins (icon or emoji) - only if coins param provided
    if (coins !== undefined) {
      const cconf = config.coins || {};
      const C_X = Number(cconf.x || UN_X);
      const C_Y = Number(cconf.y || ( (statsCfg.y || UN_Y + 120) + 80 ));
      ctx.font = cconf.font || "22px Sans";
      ctx.fillStyle = cconf.color || "#ffdd00";

      const iconRef = cconf.icon || "💰";
      if (/^https?:\/\//i.test(iconRef) || (iconRef && !/^[\p{Emoji}]+$/u.test(iconRef) && fsSync.existsSync(path.join(tplDir, iconRef)))) {
        // Try as image (local or remote)
        try {
          const iconImg = await getImage(iconRef, tplDir);
          if (iconImg) {
            const ICO_SIZE = Number(cconf.iconSize || 24);
            ctx.drawImage(iconImg, C_X, C_Y - ICO_SIZE + 6, ICO_SIZE, ICO_SIZE);
            // write coin number after icon
            ctx.fillText(`${coins}`, C_X + (Number(cconf.iconSize || 28) + 8), C_Y);
          } else {
            // fallback to emoji/text
            ctx.fillText(`${iconRef} ${coins}`, C_X, C_Y);
          }
        } catch (err) {
          // fallback to emoji/text
          ctx.fillText(`${iconRef} ${coins}`, C_X, C_Y);
        }
      } else {
        // emoji or text icon
        ctx.fillText(`${iconRef} ${coins}`, C_X, C_Y);
      }
    }

    // ---------- Sidebar (optional)
    if (config.sidebar?.enabled) {
      const s = config.sidebar;
      const S_X = Number(s.x || (WIDTH - (s.width || 160) - 20));
      const S_Y = Number(s.y || 20);
      const S_W = Number(s.width || 160);
      const S_H = Number(s.height || 360);
      const R = Number(s.radius || 12);

      // background rect
      ctx.fillStyle = s.color || "rgba(0,0,0,0.35)";
      roundRect(ctx, S_X, S_Y, S_W, S_H, R, true);

      // items
      if (Array.isArray(s.items)) {
        let baseY = S_Y + (s.padding || 12);
        for (const item of s.items) {
          if (item.type === "text") {
            ctx.fillStyle = item.color || "#ffffff";
            ctx.font = item.font || "14px Sans";
            ctx.fillText(item.text || "", S_X + (s.padding || 12), baseY + (item.yOffset || 0));
            baseY += (item.lineHeight || 28);
          }
          // future item types: icons, progress, badges...
        }
      }
    }

    // ---------- encode and return base64 PNG
    const buffer = await canvas.encode("png");
    const base64 = buffer.toString("base64");
    return res.status(200).json({
      success: true,
      message: "Perfil de usuário gerado com sucesso",
      data: {
        username,
        tag: tag || null,
        avatarURL,
        background: bg || null,
        bio: bio || null,
        level: level !== undefined ? Number(level) : null,
        xp: xp !== undefined ? Number(xp) : null,
        maxXP: maxXP !== undefined ? Number(maxXP) : null,
        coins: coins !== undefined ? coins : null,
        template,
        image: `data:image/png;base64,${base64}`
      }
    });

  } catch (err) {
    console.error("ERR generate profile:", err);
    return res.status(500).json({
      success: false,
      errorID: "ERR-0004",
      error: errorMap["ERR-0004"],
      details: err.message
    });
  }
};

//
// ---------- Helper drawing utilities (kept below for clarity) ----------
//

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r, fill = true) {
  roundedRectPath(ctx, x, y, w, h, r);
  if (fill) ctx.fill();
  else ctx.stroke();
}

// Clip rounded rect
function roundRectClip(ctx, x, y, w, h, r) {
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();
}

// Draw text with maxWidth safe (no ellipsis, just clip via wrap)
function drawTextSafe(ctx, text, x, y, maxWidth) {
  const lines = wrapText(ctx, text, maxWidth || 300, 1);
  ctx.fillText(lines[0] || "", x, y);
}
