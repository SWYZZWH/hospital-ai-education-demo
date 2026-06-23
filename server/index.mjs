import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

const directorDefaults = {
  gastroscopy: [
    {
      camera: "从候诊区推入到签到台，镜头跟随患者移动",
      motion: "导视箭头沿地面流动，预约信息逐项点亮",
      focus: "签到与身份核对",
      subtitle: "按预约时间到达内镜中心，先完成签到和信息核对。",
    },
    {
      camera: "俯拍术前准备清单，切到患者手中检查单",
      motion: "禁食禁水时间轴从前一晚推进到检查前",
      focus: "禁食禁水与用药提醒",
      subtitle: "检查前按要求禁食禁水，长期用药和过敏史提前说明。",
    },
    {
      camera: "侧面展示检查床、医生和内镜设备位置",
      motion: "呼吸提示波形缓慢起伏，镜头局部放大配合姿势",
      focus: "体位与呼吸配合",
      subtitle: "检查中听从医护提示，保持放松并配合体位。",
    },
    {
      camera: "从观察区拉远到离院指引牌",
      motion: "观察倒计时、饮食恢复和异常反馈依次亮起",
      focus: "观察与异常处理",
      subtitle: "检查后短暂观察，如有持续不适及时联系医院。",
    },
  ],
  ct: [
    {
      camera: "从影像科登记台平移到资料核对界面",
      motion: "过敏史、肾功能、检查单三个字段依次确认",
      focus: "病史与过敏史确认",
      subtitle: "检查前需要确认过敏史、肾功能和相关用药情况。",
    },
    {
      camera: "近景展示留置针和造影剂注射路径",
      motion: "造影剂流向用柔和光线从手臂移动到扫描区域",
      focus: "造影剂反应说明",
      subtitle: "注射时可能有短暂发热感，通常很快缓解。",
    },
    {
      camera: "CT 设备正面环形镜头，扫描床缓慢进入",
      motion: "扫描环发光，语音提示保持静止",
      focus: "扫描过程配合",
      subtitle: "扫描时保持静止，按语音提示完成吸气和屏气。",
    },
    {
      camera: "从检查室切到休息区水杯和留观提示",
      motion: "饮水、留观、异常反馈三张卡片顺序出现",
      focus: "检查后留观",
      subtitle: "检查后按医嘱适量饮水，留观期间如不适及时反馈。",
    },
  ],
  surgery: [
    {
      camera: "医生工作台俯视镜头，CBCT 影像和口内模型并排展开",
      motion: "影像切片横向扫过，种植区域被光圈局部放大",
      focus: "影像与全身情况评估",
      subtitle: "术前先完成口腔影像、咬合关系和全身情况评估。",
    },
    {
      camera: "半透明口腔结构侧视图，镜头缓慢推进到修复路径",
      motion: "治疗周期以流动时间轴呈现，关键节点逐个点亮",
      focus: "修复步骤与治疗周期",
      subtitle: "医生会说明修复步骤、治疗周期和需要配合的事项。",
    },
    {
      camera: "手术日场景切到牙椅旁，器械从画面边缘进入",
      motion: "器械路径沿种植位移动，配合点位出现呼吸节奏提示",
      focus: "手术当天配合",
      subtitle: "手术当天请携带资料，按现场医护指导完成配合。",
    },
    {
      camera: "从术后护理清单拉近到患者手机提醒",
      motion: "清洁、饮食、复诊三项护理卡片同步进入手机预览",
      focus: "术后护理与复诊",
      subtitle: "术后保持口腔清洁，按医嘱饮食并及时复诊。",
    },
  ],
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
    video: "ffmpeg mp4 storyboard animation renderer",
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
    "你还要像医疗宣教片导演一样输出镜头语言，不要只写标题和要点。",
    "JSON 字段：patientTitle 字符串；patientBrief 字符串，120 字以内；points 三条；storyboard 四条；directorShots 四个对象，每个对象包含 camera、motion、focus、subtitle、voiceover；warnings 三条；narration 字符串，220-320 字。",
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
  const directorShots = buildDirectorShots(selectedCase);
  return {
    patientTitle: selectedCase.patientTitle,
    patientBrief: notes
      ? `${selectedCase.patientBrief} ${notes}`.slice(0, 180)
      : selectedCase.patientBrief,
    points: selectedCase.points,
    storyboard: selectedCase.storyboard,
    directorShots,
    warnings: selectedCase.warnings,
    narration: [
      `您好，下面为您说明${selectedCase.project}的主要注意事项。`,
      selectedCase.patientBrief,
      directorShots.map((shot) => shot.voiceover).join("。"),
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
    directorShots: normalizeDirectorShots(content.directorShots, fallback),
    warnings: firstArray(content.warnings, fallback.warnings, 3),
    narration: firstString(content.narration, fallback.narration),
  };
}

function buildDirectorShots(selectedCase) {
  const key = Object.entries(cases).find(([, value]) => value === selectedCase)?.[0] || "surgery";
  const defaults = directorDefaults[key] || directorDefaults.surgery;
  return selectedCase.storyboard.slice(0, 4).map((item, index) => {
    const [title, body] = item.split("：");
    const preset = defaults[index] || defaults[0];
    return {
      title: sanitizeText(title || `镜头 ${index + 1}`),
      camera: preset.camera,
      motion: preset.motion,
      focus: preset.focus,
      subtitle: preset.subtitle,
      voiceover: sanitizeText(body || preset.subtitle),
    };
  });
}

function normalizeDirectorShots(value, fallback) {
  const input = Array.isArray(value) ? value : fallback.directorShots;
  const base = fallback.directorShots;
  return base.map((fallbackShot, index) => {
    const source = input[index] || {};
    return {
      title: firstString(source.title, fallbackShot.title).slice(0, 34),
      camera: firstString(source.camera, fallbackShot.camera).slice(0, 80),
      motion: firstString(source.motion, fallbackShot.motion).slice(0, 80),
      focus: firstString(source.focus, fallbackShot.focus).slice(0, 30),
      subtitle: firstString(source.subtitle, fallbackShot.subtitle).slice(0, 80),
      voiceover: firstString(source.voiceover, fallbackShot.voiceover).slice(0, 120),
    };
  });
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
  const segmentPaths = [];
  const audioDuration = await getMediaDuration(audioPath);
  const shots = normalizeDirectorShots(content.directorShots, {
    directorShots: buildDirectorShots(selectedCase),
  });
  const scenes = shots.map((shot, index) => ({
    ...shot,
    label: index === 0 ? selectedCase.department : `镜头 ${index + 1}`,
    title: shot.title || content.storyboard[index]?.split("：")[0] || `镜头 ${index + 1}`,
    body: shot.voiceover || shot.subtitle,
  }));
  const sceneDuration = audioDuration / scenes.length;

  for (const [index, scene] of scenes.entries()) {
    const segmentPath = path.join(generatedDir, `${id}-segment-${index}.mp4`);
    await renderStoryboardSegment(
      scene,
      selectedCase,
      segmentPath,
      sceneDuration,
      index,
      id,
    );
    segmentPaths.push(segmentPath);
  }

  const concatPath = path.join(generatedDir, `${id}-segments.txt`);
  const concatBody = segmentPaths
    .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(concatPath, `${concatBody}\n`);

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
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-t",
    audioDuration.toFixed(3),
    "-shortest",
    videoPath,
  ]);
}

async function renderStoryboardSegment(scene, selectedCase, segmentPath, duration, index, id) {
  const fps = 8;
  const frameCount = Math.max(18, Math.round(duration * fps));
  const frameDir = path.join(generatedDir, `${id}-scene-${index}`);
  await mkdir(frameDir, { recursive: true });

  try {
    let nextFrame = 0;
    const renderFrame = async () => {
      const frameIndex = nextFrame;
      nextFrame += 1;
      if (frameIndex >= frameCount) {
        return;
      }
      const progress = frameCount <= 1 ? 1 : frameIndex / (frameCount - 1);
      const framePath = path.join(
        frameDir,
        `frame-${String(frameIndex).padStart(4, "0")}.png`,
      );
      await sharp(Buffer.from(renderStoryboardFrame(scene, selectedCase, index, progress)))
        .png()
        .toFile(framePath);
      await renderFrame();
    };
    await Promise.all(Array.from({ length: 4 }, () => renderFrame()));

    await run("ffmpeg", [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(frameDir, "frame-%04d.png"),
      "-t",
      duration.toFixed(3),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-r",
      "24",
      "-pix_fmt",
      "yuv420p",
      segmentPath,
    ]);
  } finally {
    await rm(frameDir, { recursive: true, force: true });
  }
}

async function getMediaDuration(filePath) {
  const output = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number.parseFloat(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("无法读取生成音频时长");
  }
  return duration;
}

function renderStoryboardFrame(scene, selectedCase, index, progress) {
  const accent = selectedCase.accent;
  const sceneProgress = easeInOut(progress);
  const titleLines = wrapText(scene.title, 15, 2);
  const subtitleLines = wrapText(scene.subtitle || scene.body, 26, 3);
  const titleSvg = titleLines
    .map((line, lineIndex) => text(line, 78, 124 + lineIndex * 50, 38, 900))
    .join("");
  const subtitleSvg = subtitleLines
    .map((line, lineIndex) => text(line, 102, 607 + lineIndex * 35, 24, 600, "#eaf6f2"))
    .join("");
  const sceneArt = renderClinicalScene(selectedCase, index, sceneProgress);
  const stepCards = renderStepCards(index, sceneProgress, accent);
  const progressWidth = 1010 * progress;
  const pulse = 0.54 + Math.sin(progress * Math.PI * 8) * 0.08;

  return `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#f7fbfa"/>
        <stop offset="0.54" stop-color="#eef7f4"/>
        <stop offset="1" stop-color="#fff3e6"/>
      </linearGradient>
      <linearGradient id="deep" x1="0" x2="1">
        <stop offset="0" stop-color="${accent}"/>
        <stop offset="1" stop-color="#142328"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#09252a" flood-opacity="0.16"/>
      </filter>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <circle cx="${1040 - sceneProgress * 42}" cy="${94 + Math.sin(progress * Math.PI * 2) * 12}" r="230" fill="${accent}" opacity="0.10"/>
    <circle cx="${152 + sceneProgress * 52}" cy="624" r="190" fill="#142328" opacity="0.07"/>
    <rect x="44" y="40" width="1192" height="638" rx="44" fill="white" opacity="0.82" filter="url(#shadow)"/>
    <rect x="72" y="64" width="530" height="116" rx="32" fill="#ffffff" opacity="0.85"/>
    <rect x="78" y="78" width="172" height="38" rx="19" fill="${accent}" opacity="0.14"/>
    ${text(scene.label, 104, 105, 21, 800, accent)}
    ${titleSvg}
    <rect x="642" y="80" width="182" height="38" rx="19" fill="${accent}" opacity="0.12"/>
    ${text("镜头语言", 670, 106, 18, 800, "#2d5058")}
    <rect x="642" y="128" width="182" height="38" rx="19" fill="#142328" opacity="0.08"/>
    ${text(scene.focus || "局部放大", 670, 154, 18, 800, "#2d5058")}
    <rect x="80" y="206" width="740" height="356" rx="36" fill="#f7fbfa" stroke="#dbe9e4" stroke-width="2"/>
    ${sceneArt}
    <rect x="852" y="84" width="312" height="400" rx="34" fill="#f9fcfb" stroke="#dce9e5" stroke-width="2"/>
    ${text("分镜动画", 890, 128, 24, 900, "#21323a")}
    ${text(`0${index + 1} / 04`, 1056, 128, 22, 900, accent)}
    ${stepCards}
    <rect x="854" y="514" width="312" height="52" rx="26" fill="${accent}" opacity="${pulse.toFixed(2)}"/>
    ${text(scene.focus || "旁白同步中", 898, 548, 24, 900, "#ffffff")}
    <circle cx="${1115 + Math.sin(progress * Math.PI * 5) * 10}" cy="539" r="14" fill="#eaf8a7"/>
    <rect x="78" y="582" width="714" height="96" rx="30" fill="#13282d"/>
    ${subtitleSvg}
    <rect x="104" y="652" width="1010" height="12" rx="6" fill="#dbe8e3"/>
    <rect x="104" y="652" width="${progressWidth.toFixed(1)}" height="12" rx="6" fill="${accent}"/>
    ${text("医生审核后发布 · 患者扫码即可查看", 858, 642, 21, 800, "#45616a")}
  </svg>`;
}

function renderClinicalScene(selectedCase, index, progress) {
  const project = selectedCase.project;
  if (project.includes("CT")) {
    return renderCtScene(index, progress, selectedCase.accent);
  }
  if (project.includes("修复") || project.includes("种植")) {
    return renderDentalScene(index, progress, selectedCase.accent);
  }
  return renderEndoscopyScene(index, progress, selectedCase.accent);
}

function renderEndoscopyScene(index, progress, accent) {
  const patientX = 228 + Math.min(progress * 160, 112);
  const doctorX = 614 - Math.min(progress * 94, 72);
  const scopeLength = index === 2 ? 120 + progress * 210 : 0;
  const checklistY = 300 - progress * 34;
  const monitorWave = Array.from({ length: 9 })
    .map((_, item) => {
      const x = 612 + item * 22;
      const y = 286 + Math.sin(progress * Math.PI * 5 + item) * 13;
      return `${x},${y}`;
    })
    .join(" ");

  return `
    <rect x="128" y="454" width="622" height="28" rx="14" fill="#d4e3de"/>
    <rect x="228" y="394" width="324" height="74" rx="35" fill="#eaf4f0" stroke="#c8dcd5" stroke-width="3"/>
    ${person(patientX, 362, "#f2c9aa", "#dff1eb", 1)}
    ${person(doctorX, 342, "#f3c7a5", "#ffffff", 1.06, accent)}
    <rect x="596" y="218" width="170" height="112" rx="22" fill="#142328"/>
    <polyline points="${monitorWave}" fill="none" stroke="#eaf8a7" stroke-width="6" stroke-linecap="round"/>
    <rect x="616" y="238" width="58" height="18" rx="9" fill="${accent}" opacity="0.72"/>
    <path d="M590 386 C${590 - scopeLength * 0.2} ${382 - scopeLength * 0.05}, ${476 - scopeLength * 0.34} ${390 + scopeLength * 0.04}, ${456 - scopeLength * 0.55} ${408 + scopeLength * 0.02}" stroke="${accent}" stroke-width="${index === 2 ? 9 : 0}" fill="none" stroke-linecap="round"/>
    <circle cx="${456 - scopeLength * 0.55}" cy="${408 + scopeLength * 0.02}" r="${index === 2 ? 12 : 0}" fill="#eaf8a7"/>
    <rect x="148" y="${checklistY}" width="194" height="136" rx="24" fill="#ffffff" stroke="#dceae5" stroke-width="2" opacity="${index < 2 ? 1 : 0.55}"/>
    ${check(170, checklistY + 44, "禁食禁水", accent)}
    ${check(170, checklistY + 84, "家属陪同", accent)}
    ${check(170, checklistY + 124, "身份核对", accent)}
  `;
}

function renderCtScene(index, progress, accent) {
  const tableX = 252 + (index === 2 ? progress * 172 : progress * 54);
  const ringGlow = 0.22 + Math.sin(progress * Math.PI * 6) * 0.08;
  const contrastY = 362 - progress * 108;

  return `
    <ellipse cx="592" cy="350" rx="142" ry="162" fill="#e8f2f6" stroke="#9eb6c5" stroke-width="18"/>
    <ellipse cx="592" cy="350" rx="76" ry="92" fill="#f7fbfa" stroke="${accent}" stroke-width="10" opacity="${ringGlow.toFixed(2)}"/>
    <rect x="${tableX.toFixed(1)}" y="414" width="386" height="42" rx="21" fill="#dce7e7"/>
    <rect x="${(tableX + 80).toFixed(1)}" y="360" width="228" height="62" rx="31" fill="#eef6f3" stroke="#c6dcd4" stroke-width="3"/>
    ${person(tableX + 122, 338, "#f2c9aa", "#dff1eb", 0.86)}
    ${person(214, 320, "#efc09e", "#ffffff", 1.02, accent)}
    <rect x="142" y="214" width="180" height="106" rx="22" fill="#ffffff" stroke="#dceae5" stroke-width="2"/>
    ${check(164, 254, "过敏史确认", accent)}
    ${check(164, 292, "肾功能确认", accent)}
    <path d="M274 352 C344 304, 410 308, 492 346" fill="none" stroke="${accent}" stroke-width="7" stroke-dasharray="18 13" stroke-dashoffset="${(70 - progress * 110).toFixed(1)}" opacity="${index === 1 ? 1 : 0.35}"/>
    <circle cx="286" cy="${contrastY.toFixed(1)}" r="${index === 1 ? 15 : 0}" fill="#eaf8a7" stroke="${accent}" stroke-width="4"/>
    <rect x="662" y="206" width="88" height="130" rx="20" fill="#142328"/>
    <rect x="682" y="230" width="48" height="14" rx="7" fill="#eaf8a7"/>
    <rect x="682" y="260" width="48" height="14" rx="7" fill="${accent}"/>
  `;
}

function renderDentalScene(index, progress, accent) {
  const chairTilt = index === 2 ? progress * 18 : 8;
  const toolX = 610 - progress * 136;
  const implantY = 408 + Math.sin(progress * Math.PI * 4) * 5;

  return `
    <g transform="rotate(${-chairTilt.toFixed(2)} 394 390)">
      <rect x="238" y="388" width="292" height="72" rx="34" fill="#e9f4f0" stroke="#c8dcd5" stroke-width="3"/>
      <rect x="384" y="430" width="190" height="30" rx="15" fill="#d5e6df"/>
      ${person(326, 356, "#f2c9aa", "#dff1eb", 0.92)}
    </g>
    ${person(608, 338, "#efc09e", "#ffffff", 1.06, accent)}
    <rect x="150" y="226" width="184" height="128" rx="24" fill="#ffffff" stroke="#dceae5" stroke-width="2"/>
    ${check(172, 266, "影像评估", accent)}
    ${check(172, 306, "慢病用药", accent)}
    <path d="M${toolX.toFixed(1)} 376 C${(toolX - 42).toFixed(1)} 384, 492 392, 446 ${implantY.toFixed(1)}" stroke="${accent}" stroke-width="${index === 2 ? 9 : 4}" fill="none" stroke-linecap="round" opacity="${index === 2 ? 1 : 0.46}"/>
    <rect x="${(toolX - 22).toFixed(1)}" y="340" width="44" height="78" rx="13" fill="#142328" transform="rotate(-22 ${toolX.toFixed(1)} 379)"/>
    <circle cx="446" cy="${implantY.toFixed(1)}" r="${index === 2 ? 13 : 0}" fill="#eaf8a7" stroke="${accent}" stroke-width="4"/>
    <rect x="650" y="222" width="86" height="142" rx="20" fill="#142328"/>
    <path d="M670 286 Q694 258 716 286 T758 286" fill="none" stroke="#eaf8a7" stroke-width="5"/>
  `;
}

function renderStepCards(activeIndex, progress, accent) {
  return Array.from({ length: 4 })
    .map((_, index) => {
      const y = 168 + index * 70;
      const active = index === activeIndex;
      const fill = active ? accent : "#ffffff";
      const opacity = active ? 0.16 + progress * 0.2 : 0.7;
      const label = ["资料确认", "风险提示", "过程演示", "复诊护理"][index];
      return `
        <rect x="886" y="${y}" width="238" height="48" rx="18" fill="${fill}" opacity="${opacity.toFixed(2)}"/>
        <circle cx="914" cy="${y + 24}" r="12" fill="${active ? accent : "#d5e5df"}"/>
        ${active ? `<circle cx="914" cy="${y + 24}" r="${(18 + progress * 16).toFixed(1)}" fill="${accent}" opacity="0.10"/>` : ""}
        ${text(label, 940, y + 32, 20, active ? 900 : 700, active ? "#173137" : "#586b72")}
      `;
    })
    .join("");
}

function person(x, y, skin, coat, scale = 1, accent = "#18a999") {
  const bodyY = y + 44 * scale;
  return `
    <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})">
      <circle cx="0" cy="0" r="28" fill="${skin}"/>
      <path d="M-21 24 Q0 42 22 24 L34 118 L-34 118 Z" fill="${coat}" stroke="#c8dcd5" stroke-width="3"/>
      <path d="M-8 36 L0 80 L11 36" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
      <path d="M-29 66 Q-68 88 -80 124" fill="none" stroke="${coat}" stroke-width="18" stroke-linecap="round"/>
      <path d="M30 66 Q68 88 82 120" fill="none" stroke="${coat}" stroke-width="18" stroke-linecap="round"/>
      <rect x="-20" y="${bodyY - y + 78}" width="16" height="70" rx="8" fill="#6c7e86"/>
      <rect x="8" y="${bodyY - y + 78}" width="16" height="70" rx="8" fill="#6c7e86"/>
    </g>
  `;
}

function check(x, y, label, accent) {
  return `
    <circle cx="${x}" cy="${y}" r="12" fill="${accent}" opacity="0.18"/>
    <path d="M${x - 5} ${y} L${x - 1} ${y + 5} L${x + 7} ${y - 6}" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(label, x + 24, y + 7, 18, 800, "#2f454d")}
  `;
}

function easeInOut(value) {
  return value < 0.5
    ? 2 * value * value
    : 1 - Math.pow(-2 * value + 2, 2) / 2;
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
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr.slice(-1200)}`));
      }
    });
  });
}
