import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const generatedDir = path.join(rootDir, "generated");
const app = express();
const port = Number(process.env.PORT || 8080);

const llmBaseUrl =
  process.env.LLM_PROXY_BASE_URL || "https://llm-proxy.densematrix.ai";
const llmModel = process.env.LLM_MODEL || "gemini-2.5-flash";
const llmKey = process.env.LLM_PROXY_KEY || "";

const cases = {
  gastroscopy: {
    project: "胃镜检查术前宣教",
    department: "消化内镜中心",
    audience: "首次胃镜检查患者",
    source: "检查须知、禁食禁水要求、麻醉注意事项",
    tone: "清晰、安抚、少术语",
    patientTitle: "胃镜检查前准备",
    patientBrief:
      "明日检查前请按预约时间到达内镜中心。检查前 8 小时禁食，2 小时禁水；如有长期服药、过敏史或近期感冒，请提前告知医生。",
    points: [
      "检查前核对预约单、身份证件和既往病史",
      "无痛胃镜需家属陪同，检查后当天不建议驾驶",
      "检查后如出现持续腹痛、呕血或黑便，应及时联系医院",
    ],
    storyboard: [
      "候诊区导览：患者按预约时段签到",
      "检查前准备：禁食禁水与用药提醒",
      "检查过程说明：配合体位与呼吸",
      "检查后观察：离院、饮食与异常处理",
    ],
    warnings: ["禁食禁水", "麻醉评估", "家属陪同"],
    accent: "#18a999",
  },
  ct: {
    project: "增强 CT 检查宣教",
    department: "医学影像科",
    audience: "需增强扫描患者",
    source: "造影剂说明、过敏史询问、检查流程",
    tone: "准确、稳重、风险可控",
    patientTitle: "增强 CT 检查说明",
    patientBrief:
      "增强 CT 需要使用造影剂以帮助医生观察病灶。检查前请主动告知过敏史、肾功能异常、甲状腺疾病及近期用药情况。",
    points: [
      "检查前完成过敏史与肾功能相关信息确认",
      "注射造影剂时可能出现短暂发热感，通常会很快缓解",
      "检查后建议适量饮水，帮助造影剂排出",
    ],
    storyboard: [
      "登记区确认：病史、过敏史、检查单",
      "注射前说明：造影剂反应与配合方式",
      "扫描过程：保持静止与听从语音提示",
      "检查后观察：饮水、留观与异常反馈",
    ],
    warnings: ["过敏史", "肾功能", "留观提醒"],
    accent: "#4477ce",
  },
  surgery: {
    project: "无牙颌修复术前宣教",
    department: "口腔修复科",
    audience: "拟行种植修复患者",
    source: "修复流程、术前检查、术后护理材料",
    tone: "专业、亲和、分步骤",
    patientTitle: "种植修复术前准备",
    patientBrief:
      "术前需完成口腔检查、影像评估和全身情况确认。请保持口腔清洁，按医嘱调整用药，并在手术当天携带既往检查资料。",
    points: [
      "术前完成影像资料和全身健康情况评估",
      "如正在服用抗凝药、降糖药或有慢性病，请提前说明",
      "术后需按医嘱复诊，保持口腔清洁并避免刺激性饮食",
    ],
    storyboard: [
      "术前评估：影像、咬合、全身情况",
      "方案沟通：修复步骤与治疗周期",
      "手术当天：携带资料与配合事项",
      "术后护理：清洁、饮食与复诊",
    ],
    warnings: ["慢病用药", "影像评估", "复诊计划"],
    accent: "#c97835",
  },
};

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/generated", express.static(generatedDir));
app.use(express.static(distDir));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    model: llmModel,
    tts: "edge-tts zh-CN-XiaoxiaoNeural",
    video: "ffmpeg mp4 storyboard renderer",
  });
});

app.post("/api/generate", async (request, response) => {
  const caseKey = String(request.body?.caseKey || "gastroscopy");
  const selectedCase = cases[caseKey] || cases.gastroscopy;
  const doctorNotes = sanitizeText(request.body?.doctorNotes || "");
  const id = nanoid(12);

  try {
    await mkdir(generatedDir, { recursive: true });
    const generation = await generateContent(selectedCase, doctorNotes);
    const content = generation.content;
    const narration = buildNarration(content);
    const audioPath = path.join(generatedDir, `${id}.mp3`);
    const videoPath = path.join(generatedDir, `${id}.mp4`);
    await generateAudio(narration, audioPath);
    await generateVideo(content, selectedCase, audioPath, videoPath, id);

    response.json({
      id,
      model: generation.model,
      content,
      audioUrl: `/generated/${id}.mp3`,
      videoUrl: `/generated/${id}.mp4`,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: "内容生成服务暂时不可用，请稍后重试",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.use((_request, response) => {
  response.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`hospital education demo listening on ${port}`);
});

async function generateContent(selectedCase, doctorNotes) {
  const fallback = fallbackContent(selectedCase, doctorNotes);
  if (!llmKey) {
    return { content: fallback, model: "院内规则模板" };
  }

  const prompt = [
    "你是医院患者宣教内容生成助手。",
    "任务：根据科室、项目、患者对象和医生补充要求，生成患者能听懂、医生能审核的中文宣教内容。",
    "要求：只输出 JSON，不输出 Markdown；不要诊断、不要替代医生医嘱；避免技术实现、模型名称和内部术语；语气专业、清楚、安抚。",
    "JSON 字段：patientTitle 字符串；patientBrief 字符串，120 字以内；points 三条；storyboard 四条；warnings 三条；narration 字符串，220-320 字。",
    `科室：${selectedCase.department}`,
    `项目：${selectedCase.project}`,
    `患者对象：${selectedCase.audience}`,
    `院内材料摘要：${selectedCase.source}`,
    `表达风格：${selectedCase.tone}`,
    `医生补充：${doctorNotes || "无"}`,
  ].join("\n");

  try {
    const result = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llmKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          {
            role: "system",
            content:
              "你只生成医院宣教内容 JSON，必须患者友好、事实谨慎、可由医生审核。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.45,
      }),
    });

    if (!result.ok) {
      throw new Error(`LLM HTTP ${result.status}`);
    }

    const payload = await result.json();
    const raw = payload?.choices?.[0]?.message?.content || "";
    return { content: normalizeContent(parseJson(raw), fallback), model: llmModel };
  } catch (error) {
    console.warn("LLM fallback:", error);
    return { content: fallback, model: "院内规则模板" };
  }
}

function fallbackContent(selectedCase, doctorNotes) {
  const notes = doctorNotes ? `医生补充提醒：${doctorNotes}` : "";
  return {
    patientTitle: selectedCase.patientTitle,
    patientBrief: notes
      ? `${selectedCase.patientBrief} ${notes}`.slice(0, 180)
      : selectedCase.patientBrief,
    points: selectedCase.points,
    storyboard: selectedCase.storyboard,
    warnings: selectedCase.warnings,
    narration: [
      `您好，下面为您说明${selectedCase.project}的主要注意事项。`,
      selectedCase.patientBrief,
      selectedCase.points.join("。"),
      "以上内容仅用于就诊前宣教，具体安排请以医生和现场工作人员指导为准。",
    ].join(""),
  };
}

function parseJson(raw) {
  const cleaned = raw
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

function normalizeContent(content, fallback) {
  return {
    patientTitle: firstString(content.patientTitle, fallback.patientTitle),
    patientBrief: firstString(content.patientBrief, fallback.patientBrief),
    points: firstArray(content.points, fallback.points, 3),
    storyboard: firstArray(content.storyboard, fallback.storyboard, 4),
    warnings: firstArray(content.warnings, fallback.warnings, 3),
    narration: firstString(content.narration, fallback.narration),
  };
}

function firstString(value, fallback) {
  return sanitizeText(value || fallback).slice(0, 420);
}

function firstArray(value, fallback, count) {
  const array = Array.isArray(value) ? value : fallback;
  return array
    .map((item) => sanitizeText(item))
    .filter(Boolean)
    .slice(0, count);
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNarration(content) {
  const narration = sanitizeText(content.narration);
  if (narration.length > 80) {
    return narration;
  }
  return [
    content.patientTitle,
    content.patientBrief,
    content.points.join("。"),
    "具体检查和治疗安排请以医生审核后的通知为准。",
  ].join("。");
}

async function generateAudio(text, audioPath) {
  await run("edge-tts", [
    "--voice",
    "zh-CN-XiaoxiaoNeural",
    "--rate=-4%",
    "--text",
    text,
    "--write-media",
    audioPath,
  ]);
}

async function generateVideo(content, selectedCase, audioPath, videoPath, id) {
  const slidePaths = [];
  const scenes = [
    {
      label: selectedCase.department,
      title: content.patientTitle,
      body: content.patientBrief,
    },
    ...content.storyboard.slice(0, 3).map((item, index) => ({
      label: `步骤 ${index + 1}`,
      title: item.split("：")[0] || `重点 ${index + 1}`,
      body: item,
    })),
  ];

  for (const [index, scene] of scenes.entries()) {
    const slidePath = path.join(generatedDir, `${id}-slide-${index}.png`);
    await sharp(Buffer.from(renderSlide(scene, selectedCase, index)))
      .png()
      .toFile(slidePath);
    slidePaths.push(slidePath);
  }

  const concatPath = path.join(generatedDir, `${id}-slides.txt`);
  const concatBody = slidePaths
    .map((slidePath) => `file '${slidePath.replace(/'/g, "'\\''")}'\nduration 6`)
    .join("\n");
  await writeFile(concatPath, `${concatBody}\nfile '${slidePaths.at(-1)}'\n`);

  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-i",
    audioPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-shortest",
    videoPath,
  ]);
}

function renderSlide(scene, selectedCase, index) {
  const titleLines = wrapText(scene.title, 16, 2);
  const bodyLines = wrapText(scene.body, 24, 4);
  const accent = selectedCase.accent;
  const titleSvg = titleLines
    .map((line, lineIndex) => text(line, 96, 250 + lineIndex * 74, 56, 900))
    .join("");
  const bodySvg = bodyLines
    .map((line, lineIndex) => text(line, 100, 455 + lineIndex * 48, 30, 500))
    .join("");

  return `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#f9fbf8"/>
        <stop offset="0.62" stop-color="#edf7f4"/>
        <stop offset="1" stop-color="#f8f0e7"/>
      </linearGradient>
      <linearGradient id="panel" x1="0" x2="1">
        <stop offset="0" stop-color="${accent}"/>
        <stop offset="1" stop-color="#142328"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <circle cx="1090" cy="90" r="220" fill="${accent}" opacity="0.12"/>
    <circle cx="104" cy="638" r="180" fill="#142328" opacity="0.08"/>
    <rect x="58" y="54" width="1164" height="612" rx="42" fill="white" opacity="0.76"/>
    <rect x="96" y="92" width="282" height="50" rx="25" fill="${accent}" opacity="0.16"/>
    ${text(scene.label, 126, 126, 24, 800, accent)}
    ${text("医院宣教内容生成中心", 920, 126, 24, 800, "#31444d")}
    <rect x="96" y="188" width="84" height="84" rx="28" fill="url(#panel)"/>
    ${text(String(index + 1).padStart(2, "0"), 120, 244, 36, 900, "#ffffff")}
    ${titleSvg}
    ${bodySvg}
    <rect x="876" y="246" width="246" height="246" rx="52" fill="${accent}" opacity="0.15"/>
    <path d="M948 397c36-58 66-86 122-116" stroke="${accent}" stroke-width="18" stroke-linecap="round" fill="none"/>
    <path d="M929 430c46 45 108 63 171 35" stroke="#142328" stroke-width="16" stroke-linecap="round" fill="none" opacity="0.82"/>
    <rect x="100" y="604" width="360" height="18" rx="9" fill="${accent}" opacity="0.72"/>
    <rect x="480" y="604" width="190" height="18" rx="9" fill="#142328" opacity="0.16"/>
    ${text("医生审核后发布 · 患者扫码即可查看", 830, 620, 24, 700, "#556871")}
  </svg>`;
}

function text(value, x, y, size, weight, fill = "#152026") {
  return `<text x="${x}" y="${y}" font-family="Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(value)}</text>`;
}

function wrapText(value, size, maxLines) {
  const chars = Array.from(sanitizeText(value));
  const lines = [];
  for (let index = 0; index < chars.length && lines.length < maxLines; index += size) {
    lines.push(chars.slice(index, index + size).join(""));
  }
  return lines.length ? lines : [""];
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr.slice(-1200)}`));
      }
    });
  });
}
