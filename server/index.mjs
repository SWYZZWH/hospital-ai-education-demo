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
const exposeLocalVideo = process.env.EXPOSE_LOCAL_VIDEO === "true";
const googleVideoApiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  "";
const googleVideoBaseUrl =
  process.env.GEMINI_VIDEO_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const googleVideoDownloadBaseUrl =
  process.env.GEMINI_VIDEO_DOWNLOAD_BASE_URL || googleVideoBaseUrl;
const googleVideoModel = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-generate-preview";
const googleTextModel = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const googleVideoDuration = Number(process.env.GEMINI_VIDEO_DURATION || 8);
const googleVideoResolution = process.env.GEMINI_VIDEO_RESOLUTION || "720p";
const apiyiApiKey = process.env.APIYI_KEY || "";
const apiyiBaseUrl = process.env.APIYI_BASE_URL || "https://api.apiyi.com/v1";
const apiyiVideoModel = process.env.APIYI_VIDEO_MODEL || "veo-3.1-fast";
const seedanceApiKey = process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || "";
const seedanceBaseUrl =
  process.env.SEEDANCE_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const seedanceVideoModel =
  process.env.SEEDANCE_VIDEO_MODEL || "doubao-seedance-2-0-fast-260128";
const seedanceFallbackVideoModel =
  process.env.SEEDANCE_FALLBACK_VIDEO_MODEL || "";
const seedanceVideoResolution = process.env.SEEDANCE_VIDEO_RESOLUTION || "480p";
const seedanceMiniSampleTaskId = process.env.SEEDANCE_MINI_SAMPLE_TASK_ID || "";
const seedanceRequireMini = process.env.SEEDANCE_REQUIRE_MINI === "true";
const seedanceTotalDuration = Number(process.env.SEEDANCE_TOTAL_DURATION || 45);
const seedanceSegmentDuration = Number(
  process.env.SEEDANCE_SEGMENT_DURATION ||
    process.env.SEEDANCE_VIDEO_DURATION ||
    15,
);
const jxincmApiKey = process.env.JXINCM_API_KEY || "";
const jxincmBaseUrl = process.env.JXINCM_BASE_URL || "https://api.jxincm.cn";
const jxincmModel = process.env.JXINCM_VIDEO_MODEL || process.env.DEFAULT_MODEL || "sora-2-pro";
const jxincmDuration = Number(process.env.JXINCM_VIDEO_DURATION || process.env.DEFAULT_DURATION || 15);
const videoJobs = new Map();
const videoJobLocks = new Map();
const videoJobRunners = new Set();

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
    project: "无牙颌修复术说明",
    department: "口腔修复科",
    audience: "全口牙齿缺失修复患者",
    source: "修复流程、术前检查、术后护理材料",
    tone: "专业、亲和、分步骤",
    patientTitle: "无牙颌修复术说明",
    patientBrief:
      "您好，我是口腔科小助手。今天为您介绍无牙颌修复术。简单说，它是在全口牙齿缺失后，帮助您恢复咀嚼、发音和面部支撑。术前，医生会检查口腔和牙槽骨情况，结合影像资料判断适合哪种修复方式。您只需要如实告知基础疾病、用药史和过敏史，并按要求完成检查。手术和修复通常分阶段进行。医生会先确定种植体的位置和数量；如果需要种植，会在麻醉后把种植体放入牙槽骨中，让它像人工牙根一样提供支撑。等种植体逐渐稳定后，再安装连接结构，最后制作并戴入口内义齿。不同方案的区别，主要在于义齿是否能自行摘戴、稳定性如何，以及接近天然牙的程度。术后请按医嘱用药和复查，前期选择软一点的食物，注意清洁维护。如果出现明显疼痛、出血、义齿松动或咬合不舒服，请及时联系医生。",
    points: [],
    storyboard: [
      "术前准备：检查口腔和牙槽骨条件，确认基础疾病与用药情况",
      "方案确认：根据骨量和修复目标，选择活动义齿、种植覆盖义齿或固定修复",
      "手术过程：麻醉后放入种植体，等待稳定结合，再安装连接结构",
      "修复完成：制作并戴入口内义齿，调整咬合，安排复查",
    ],
    warnings: ["基础疾病", "分阶段治疗", "复查维护"],
    narration:
      "您好，我是口腔科小助手。今天为您介绍无牙颌修复术。简单说，它是在全口牙齿缺失后，帮助您恢复咀嚼、发音和面部支撑。术前，医生会检查口腔和牙槽骨情况，结合影像资料判断适合哪种修复方式。您只需要如实告知基础疾病、用药史和过敏史，并按要求完成检查。手术和修复通常分阶段进行。医生会先确定种植体的位置和数量；如果需要种植，会在麻醉后把种植体放入牙槽骨中，让它像人工牙根一样提供支撑。等种植体逐渐稳定后，再安装连接结构，最后制作并戴入口内义齿。不同方案的区别，主要在于义齿是否能自行摘戴、稳定性如何，以及接近天然牙的程度。术后请按医嘱用药和复查，前期选择软一点的食物，注意清洁维护。如果出现明显疼痛、出血、义齿松动或咬合不舒服，请及时联系医生。",
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
      camera: "口腔医学 3D 动画开场，无牙颌上下颌模型与 CBCT 影像并排展示",
      motion: "镜头从面部支撑示意推进到牙槽骨轮廓，检查项目以轻量图标依次点亮",
      focus: "术前评估与检查准备",
      subtitle: "术前先评估口腔、牙槽骨和全身用药情况。",
    },
    {
      camera: "半透明牙槽骨模型上标出骨量和种植点位，活动义齿、覆盖义齿、固定修复以三个简洁模型对比",
      motion: "三种方案从左到右逐项出现，稳定性和能否摘戴用图标轻提示",
      focus: "修复方案选择",
      subtitle: "医生会根据骨量和修复目标，选择适合的修复方式。",
    },
    {
      camera: "非血腥 3D 剖面动画展示种植体进入牙槽骨模型，避开真人口腔手术画面",
      motion: "种植体沿预设点位缓慢就位，随后骨结合稳定过程用柔和光圈表示",
      focus: "种植体植入与稳定",
      subtitle: "麻醉后放入种植体，等待逐渐稳定结合。",
    },
    {
      camera: "连接结构和义齿在 3D 牙颌模型上依次就位，最后切到复查日历和清洁提醒",
      motion: "义齿戴入后咬合线微调，饮食、清洁、复查三张小卡片顺序出现",
      focus: "义齿戴入与术后复查",
      subtitle: "最后戴入口内义齿，调整咬合，并按医嘱复查维护。",
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
    video: seedanceApiKey
      ? [
          `seedance ${seedanceVideoModel}`,
          seedanceMiniSampleTaskId ? `mini-sample ${seedanceMiniSampleTaskId}` : "",
          !seedanceRequireMini &&
          !seedanceMiniSampleTaskId &&
          seedanceFallbackVideoModel &&
          seedanceFallbackVideoModel !== seedanceVideoModel
            ? `fallback ${seedanceFallbackVideoModel}`
            : "",
        ].filter(Boolean).join(" ")
      : googleVideoApiKey
      ? `gemini ${googleVideoModel}`
      : apiyiApiKey
      ? `apiyi ${apiyiVideoModel}`
      : jxincmApiKey
        ? `jxincm ${jxincmModel}`
        : exposeLocalVideo
        ? "local ffmpeg renderer"
        : "not configured",
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
    let videoUrl;
    if (exposeLocalVideo) {
      await generateVideo(content, selectedCase, audioPath, videoPath, id);
      videoUrl = `/generated/${id}.mp4`;
    }

    response.json({
      id,
      model: generation.model,
      content,
      audioUrl: `/generated/${id}.mp3`,
      videoGenerationAvailable: Boolean(
        seedanceApiKey || googleVideoApiKey || apiyiApiKey || jxincmApiKey || exposeLocalVideo,
      ),
      ...(videoUrl ? { videoUrl } : {}),
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({
      error: "内容生成服务暂时不可用，请稍后重试",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/video-jobs", async (request, response) => {
  if (!seedanceApiKey && !googleVideoApiKey && !apiyiApiKey && !jxincmApiKey && !exposeLocalVideo) {
    response.status(503).json({
      error: "视频生成服务尚未配置",
    });
    return;
  }

  const caseKey = String(request.body?.caseKey || "surgery");
  const generationId = sanitizeText(request.body?.generationId || nanoid(12));
  const selectedCase = cases[caseKey] || cases.surgery;
  const fallback = fallbackContent(selectedCase, "");
  const content = normalizeContent(request.body?.content || {}, fallback);
  const jobId = nanoid(12);
  const videoPath = path.join(generatedDir, `${jobId}.mp4`);

  try {
    await mkdir(generatedDir, { recursive: true });

    const prompt = buildVideoPrompt(content, selectedCase);

    if (seedanceApiKey) {
      const remoteTask = await createSeedanceVideo(content, selectedCase, prompt);
      videoJobs.set(jobId, {
        id: jobId,
        provider: "seedance",
        remoteId: remoteTask.ids[0],
        remoteIds: remoteTask.ids,
        seedanceSegments: remoteTask.segments,
        seedanceVideoUrls: [],
        currentSegmentIndex: 0,
        status: "processing",
        progress: 0.05,
        videoUrl: null,
        error: "",
        createdAt: Date.now(),
        videoPath,
        prompt,
      });
      runVideoJobInBackground(jobId);

      response.json({
        jobId,
        status: "processing",
        progress: 0.05,
      });
      return;
    }

    if (googleVideoApiKey) {
      const remoteTask = await createGoogleVeoVideo(prompt);
      videoJobs.set(jobId, {
        id: jobId,
        provider: "google-veo",
        remoteId: remoteTask.name,
        status: "processing",
        progress: 0.05,
        videoUrl: null,
        error: "",
        createdAt: Date.now(),
        videoPath,
        prompt,
      });
      runVideoJobInBackground(jobId);

      response.json({
        jobId,
        status: "processing",
        progress: 0.05,
      });
      return;
    }

    if (apiyiApiKey) {
      const videoUrl = await createApiyiVideo(prompt, videoPath);
      videoJobs.set(jobId, {
        id: jobId,
        provider: "apiyi",
        remoteId: "",
        status: "succeeded",
        progress: 1,
        videoUrl,
        error: "",
        createdAt: Date.now(),
        videoPath,
        prompt,
      });
      response.json({
        jobId,
        status: "succeeded",
        progress: 1,
        videoUrl,
      });
      return;
    }

    if (exposeLocalVideo && !jxincmApiKey) {
      const audioPath = path.join(generatedDir, `${generationId}.mp3`);
      await generateVideo(content, selectedCase, audioPath, videoPath, jobId);
      response.json({
        jobId,
        status: "succeeded",
        videoUrl: `/generated/${jobId}.mp4`,
      });
      return;
    }

    const remoteTask = await createJxincmVideo(prompt);
    videoJobs.set(jobId, {
      id: jobId,
      provider: "jxincm",
      remoteId: remoteTask.id,
      status: "processing",
      progress: 0.05,
      videoUrl: null,
      error: "",
      createdAt: Date.now(),
      videoPath,
      prompt,
    });
    runVideoJobInBackground(jobId);

    response.json({
      jobId,
      status: "processing",
      progress: 0.05,
    });
  } catch (error) {
    console.error("video job creation failed", error);
    response.status(500).json({
      error: "视频生成任务创建失败，请稍后重试",
    });
  }
});

app.get("/api/video-jobs/:jobId", async (request, response) => {
  const jobId = sanitizeText(request.params.jobId);
  const job = videoJobs.get(jobId);

  if (!job) {
    response.status(404).json({ error: "视频生成任务不存在或已过期" });
    return;
  }

  try {
    const updatedJob = await refreshVideoJobLocked(job);
    response.json(publicVideoJob(updatedJob));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (job.status === "processing" && isTransientNetworkError(message)) {
      job.refreshAttempts = (job.refreshAttempts || 0) + 1;
      job.progress = Math.min(0.94, Math.max(job.progress || 0.05, 0.08));
      console.warn("video job refresh transient error", {
        jobId: job.id,
        attempt: job.refreshAttempts,
        message,
      });
      response.json(publicVideoJob(job));
      return;
    }
    job.status = "failed";
    job.error = "视频生成暂时失败，请稍后重试";
    console.error("video job refresh failed", { jobId: job.id, message });
    response.status(500).json({
      jobId: job.id,
      status: "failed",
      error: "视频生成失败，请稍后重试",
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
  const prompt = [
    "你是医院患者注意事项生成助手。",
    "任务：根据科室、项目、患者对象和医生补充要求，生成患者能听懂、医生能审核的中文注意事项。",
    "要求：只输出 JSON，不输出 Markdown；不要诊断、不要替代医生医嘱；避免技术实现、模型名称和内部术语；语气专业、清楚、安抚。",
    "同时生成患者查看素材，每一段都要像患者真正会看到的步骤说明，避免项目介绍、模型名称和技术实现描述。",
    "语音内容必须由你重新撰写，不要套用输入材料原句，不要像模板拼接；narration 要像真实护士/医生直接对患者说话，口语自然但医学谨慎，不要出现“宣教”等后台工作用词。",
    "JSON 字段：patientTitle 字符串；patientBrief 字符串，120 字以内；points 三条；storyboard 四条；directorShots 四个对象，每个对象包含 camera、motion、focus、subtitle、voiceover；warnings 三条；narration 字符串，260-380 字，面向患者。",
    `科室：${selectedCase.department}`,
    `项目：${selectedCase.project}`,
    `患者对象：${selectedCase.audience}`,
    `院内材料摘要：${selectedCase.source}`,
    `表达风格：${selectedCase.tone}`,
    `医生补充：${doctorNotes || "无"}`,
  ].join("\n");

  if (!llmKey) {
    return generateGeminiContent(prompt, fallback);
  }

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
    "你只生成医院患者注意事项 JSON，必须患者友好、事实谨慎、可由医生审核。narration 必须是面向患者的完整中文语音内容，不要出现“宣教”等后台工作用词。",
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
    return generateGeminiContent(prompt, fallback);
  }
}

async function generateGeminiContent(prompt, fallback) {
  if (!googleVideoApiKey) {
    return { content: fallback, model: "院内规则模板" };
  }

  try {
    const result = await fetch(
      `${googleVideoBaseUrl}/models/${googleTextModel}:generateContent?key=${encodeURIComponent(googleVideoApiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: [
                    "你只生成医院患者注意事项 JSON，必须患者友好、事实谨慎、可由医生审核。",
                    "narration 必须是面向患者的完整中文语音内容，不要出现“宣教”等后台工作用词。",
                    prompt,
                  ].join("\n"),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.45,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!result.ok) {
      throw new Error(`Gemini HTTP ${result.status}`);
    }

    const payload = await result.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    return { content: normalizeContent(parseJson(raw), fallback), model: googleTextModel };
  } catch (error) {
    console.warn("Gemini content fallback:", error);
    return { content: fallback, model: "院内规则模板" };
  }
}

function fallbackContent(selectedCase, doctorNotes) {
  const notes = doctorNotes ? `医生补充提醒：${doctorNotes}` : "";
  const directorShots = buildDirectorShots(selectedCase);
  const content = {
    patientTitle: selectedCase.patientTitle,
    patientBrief: notes
      ? `${selectedCase.patientBrief} ${notes}`.slice(0, 180)
      : selectedCase.patientBrief,
    points: selectedCase.points,
    storyboard: selectedCase.storyboard,
    directorShots,
    warnings: selectedCase.warnings,
    narration: selectedCase.narration,
  };
  return {
    ...content,
    narration: buildPatientNarration(content),
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
  const normalized = {
    patientTitle: firstString(content.patientTitle, fallback.patientTitle),
    patientBrief: firstString(content.patientBrief, fallback.patientBrief),
    points: firstArray(content.points, fallback.points, 3),
    storyboard: firstArray(content.storyboard, fallback.storyboard, 4),
    directorShots: normalizeDirectorShots(content.directorShots, fallback),
    warnings: firstArray(content.warnings, fallback.warnings, 3),
  };
  const narration = fallback.narration || buildPatientNarration(normalized);
  return {
    ...normalized,
    narration: firstNarration(narration, buildPatientNarration(normalized)),
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

function firstNarration(value, fallback) {
  return sanitizeText(value || fallback).slice(0, 900);
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
  return buildPatientNarration(content);
}

function buildPatientNarration(content) {
  const fixedNarration = cleanNarrationText(content.narration);
  if (fixedNarration) {
    return `${fixedNarration}。`;
  }

  const points = Array.isArray(content.points) ? content.points.map(cleanNarrationText).filter(Boolean) : [];
  const warnings = Array.isArray(content.warnings) ? content.warnings.map(cleanNarrationText).filter(Boolean) : [];
  const brief = cleanNarrationText(content.patientBrief);
  return [
    "您好，您需要注意以下事项。",
    brief ? `${brief}。` : "",
    ...points.map((point, index) => `${chineseOrdinal(index)}，${point}。`),
    warnings.length ? `请特别留意${warnings.join("、")}等情况，如有不适或疑问，请及时联系医护人员。` : "",
    "具体检查和治疗安排，请以医生审核后的通知为准。",
  ].filter(Boolean).join("");
}

function cleanNarrationText(value) {
  return sanitizeText(value)
    .replace(/宣教/g, "说明")
    .replace(/[。；;,.，、\s]+$/g, "");
}

function chineseOrdinal(index) {
  return ["第一", "第二", "第三", "第四", "第五"][index] || `第 ${index + 1}`;
}

function buildVideoPrompt(content, selectedCase) {
  const shots = normalizeDirectorShots(content.directorShots, {
    directorShots: buildDirectorShots(selectedCase),
  });
  const shotText = shots
    .map((shot, index) => {
      return `${index + 1}. ${shot.focus}: ${shot.subtitle}`;
    })
    .join(" ");
  const narration = cleanNarrationText(content.narration || content.patientBrief);

  return [
    "Create a polished Chinese dental patient education video for an oral prosthodontics scenario.",
    "Primary visual language: clean 3D oral medical animation, CBCT review, jawbone and denture models, simple clinical icons, warm professional dental clinic context.",
    "Do not make a generic hospital B-roll video. Do not show unrelated wards, nurses walking corridors, dashboards, marketing posters, or random patient drama.",
    "No blood, no gore, no exposed tissue, no graphic surgery close-ups, no distorted teeth, no unrealistic anatomy.",
    `Department: ${selectedCase.department}. Topic: ${selectedCase.project}. Patient audience: ${selectedCase.audience}.`,
    `Patient narration to follow: ${narration}`,
    `Storyboard: ${shotText}`,
    "The video must explain edentulous jaw restoration, not general dental hygiene. Keep pre-op and post-op brief; spend more visual time on treatment plan, implant support, connection structure, and denture placement.",
    "Camera language: smooth macro movement, clear model-based medical explanation, readable subtitle-safe composition, realistic but non-invasive.",
  ].join(" ");
}

function buildSeedanceSegmentPrompt(content, selectedCase, shot, index, total) {
  const prefix = index === 0
    ? "这是完整宣教片的开头段。"
    : "请基于视频1继续向后延长，不要重头开始，不要改换主视觉风格；从上一段尾帧自然衔接。";
  const fullNarration = cleanNarrationText(content.narration || content.patientBrief);
  return [
    `生成一段口腔科患者说明视频，${prefix}当前是第 ${index + 1}/${total} 段。`,
    `科室：${selectedCase.department}。主题：${selectedCase.project}。患者对象：${selectedCase.audience}。`,
    `本段重点：${shot.focus}。`,
    `画面安排：${shot.camera}；${shot.motion}。`,
    `本段旁白：${shot.voiceover || shot.subtitle}`,
    `本段字幕：${shot.subtitle}`,
    `完整文案参考：${fullNarration}`,
    "视觉必须以口腔医学 3D 动画、牙槽骨模型、种植体模型、连接结构和义齿模型为主，可以少量出现牙椅或医生查看影像，但不要变成泛医院宣传片。",
    "术前和术后画面简短，手术与修复过程画面更具体：种植点位、种植体就位、稳定结合、连接结构、义齿戴入要表达清楚。",
    `全片 16:9 横屏，${seedanceVideoResolution} 测试清晰度即可，段落之间必须风格一致，医学术语要准确。`,
    "可以出现简洁中文字幕，但不要生成密集大段文字，不要出现英文，不要新增与文案无关的角色对白。",
    "画面真实、干净、专业，适合给客户演示和患者端预览；严禁血腥、暴露组织、恐怖医疗画面和真实手术开刀特写。",
  ].join(" ");
}

async function createSeedanceVideo(content, selectedCase, prompt) {
  const segments = buildSeedanceSegments(content, selectedCase, prompt);
  try {
    const firstTask = await createSeedanceTask(segments[0]);
    return { ids: [firstTask.id], segments };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!seedanceMiniSampleTaskId || !isSeedanceMiniAccessError(message)) {
      throw error;
    }

    console.warn("seedance mini api unavailable; using cached mini task", {
      model: seedanceVideoModel,
      sampleTaskId: seedanceMiniSampleTaskId,
      message,
    });
    return {
      ids: [seedanceMiniSampleTaskId],
      segments: [segments[0] || { prompt, duration: 10 }],
    };
  }
}

function buildSeedanceSegments(content, selectedCase, prompt) {
  const shots = normalizeDirectorShots(content.directorShots, {
    directorShots: buildDirectorShots(selectedCase),
  });
  const requestedTotalDuration =
    Number.isFinite(seedanceTotalDuration) && seedanceTotalDuration >= 20
      ? Math.min(75, seedanceTotalDuration)
      : 45;
  const segmentDuration =
    Number.isFinite(seedanceSegmentDuration) && seedanceSegmentDuration >= 5
      ? Math.min(15, seedanceSegmentDuration)
      : 15;
  const totalDuration = Math.min(
    75,
    Math.max(requestedTotalDuration, shots.length * segmentDuration),
  );
  const segmentCount = Math.max(
    2,
    Math.min(shots.length, Math.ceil(totalDuration / segmentDuration)),
  );
  const segments = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const shot = shots[index] || shots[shots.length - 1];
    const isFinalSegment = index === segmentCount - 1;
    const remainingDuration = totalDuration - segmentDuration * index;
    const duration = Math.max(5, Math.min(segmentDuration, remainingDuration));
    segments.push({
      prompt: buildSeedanceSegmentPrompt(content, selectedCase, shot, index, segmentCount),
      duration: isFinalSegment ? Math.round(duration) : segmentDuration,
    });
  }

  if (segments.length === 0) {
    segments.push({ prompt, duration: segmentDuration });
  }

  return segments;
}

async function createSeedanceTask(segment, previousVideoUrl = "") {
  const content = [
    {
      type: "text",
      text: segment.prompt,
    },
  ];

  if (previousVideoUrl) {
    content.push({
      type: "video_url",
      video_url: {
        url: previousVideoUrl,
      },
      role: "reference_video",
    });
  }

  const payload = {
    content,
    generate_audio: true,
    ratio: "16:9",
    duration: segment.duration,
    resolution: seedanceVideoResolution,
    watermark: false,
  };
  let data;
  try {
    data = await requestSeedance("/contents/generations/tasks", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        model: seedanceVideoModel,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canFallback =
      !seedanceRequireMini &&
      !seedanceMiniSampleTaskId &&
      seedanceFallbackVideoModel &&
      seedanceFallbackVideoModel !== seedanceVideoModel &&
      isSeedanceMiniAccessError(message);
    if (!canFallback) {
      throw error;
    }
    console.warn("seedance model fallback", {
      from: seedanceVideoModel,
      to: seedanceFallbackVideoModel,
      message,
    });
    data = await requestSeedance("/contents/generations/tasks", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        model: seedanceFallbackVideoModel,
      }),
    });
  }

  if (!data?.id) {
    throw new Error("Seedance 未返回任务 ID");
  }
  return data;
}

function isSeedanceMiniAccessError(message) {
  return /ModelAPIAccessNotAllowed|ModelNotOpen|not activated|only available in the Playground/i.test(
    message,
  );
}

async function createJxincmVideo(prompt) {
  const payload = {
    images: [],
    model: jxincmModel,
    orientation: "landscape",
    prompt,
    size: "large",
    duration: Number.isFinite(jxincmDuration) && jxincmDuration >= 15 ? jxincmDuration : 15,
    watermark: false,
    private: true,
  };
  const data = await requestJxincm("/v1/video/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!data?.id) {
    throw new Error("视频服务未返回任务 ID");
  }
  return data;
}

async function createApiyiVideo(prompt, videoPath) {
  const data = await requestApiyi("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: apiyiVideoModel,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const content = data?.choices?.[0]?.message?.content || "";
  const remoteVideoUrl = extractVideoUrl(content);
  await downloadVideo(remoteVideoUrl, videoPath);
  return `/generated/${path.basename(videoPath)}`;
}

async function refreshVideoJob(job) {
  if (["succeeded", "failed"].includes(job.status)) {
    return job;
  }

  if (job.provider === "seedance") {
    return refreshSeedanceJob(job);
  }

  if (job.provider === "google-veo") {
    return refreshGoogleVeoJob(job);
  }

  const data = await requestJxincm(`/v1/video/query?id=${encodeURIComponent(job.remoteId)}`, {
    method: "GET",
  });
  const rawStatus = String(data?.status || "processing").toLowerCase();
  const videoUrl = data?.video_url || data?.task_result?.videos?.[0]?.url || "";
  const progress = Number(data?.progress || data?.percentage || 0);

  if (rawStatus === "completed" && videoUrl) {
    await downloadVideo(videoUrl, job.videoPath);
    job.status = "succeeded";
    job.progress = 1;
    job.videoUrl = `/generated/${job.id}.mp4`;
    return job;
  }

  if (rawStatus === "failed" || rawStatus === "error") {
    job.status = "failed";
    job.error = data?.error || data?.message || "视频生成失败";
    return job;
  }

  job.status = "processing";
  job.progress = Number.isFinite(progress) && progress > 0
    ? Math.min(0.95, progress > 1 ? progress / 100 : progress)
    : Math.min(0.92, (job.progress || 0.05) + 0.04);
  return job;
}

async function refreshVideoJobLocked(job) {
  const existing = videoJobLocks.get(job.id);
  if (existing) {
    return existing;
  }

  const refreshPromise = refreshVideoJob(job).finally(() => {
    videoJobLocks.delete(job.id);
  });
  videoJobLocks.set(job.id, refreshPromise);
  return refreshPromise;
}

function runVideoJobInBackground(jobId) {
  if (videoJobRunners.has(jobId)) {
    return;
  }
  videoJobRunners.add(jobId);

  void (async () => {
    try {
      for (let attempt = 0; attempt < 220; attempt += 1) {
        const job = videoJobs.get(jobId);
        if (!job || ["succeeded", "failed"].includes(job.status)) {
          return;
        }

        await sleep(attempt < 6 ? 5000 : 10000);
        const currentJob = videoJobs.get(jobId);
        if (!currentJob || ["succeeded", "failed"].includes(currentJob.status)) {
          return;
        }

        try {
          await refreshVideoJobLocked(currentJob);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (isTransientNetworkError(message)) {
            currentJob.refreshAttempts = (currentJob.refreshAttempts || 0) + 1;
            currentJob.progress = Math.min(0.94, Math.max(currentJob.progress || 0.05, 0.08));
            console.warn("video job background transient error", {
              jobId,
              attempt: currentJob.refreshAttempts,
              message,
            });
            continue;
          }

          currentJob.status = "failed";
          currentJob.error = "视频生成暂时失败，请稍后重试";
          console.error("video job background failed", { jobId, message });
          return;
        }
      }

      const job = videoJobs.get(jobId);
      if (job && !["succeeded", "failed"].includes(job.status)) {
        job.status = "failed";
        job.error = "视频生成耗时过长，请稍后重新生成";
        console.error("video job background timeout", { jobId });
      }
    } finally {
      videoJobRunners.delete(jobId);
    }
  })();
}

async function refreshSeedanceJob(job) {
  const remoteId = job.remoteId;
  const task = remoteId ? await querySeedanceTask(remoteId) : null;
  const segments = Array.isArray(job.seedanceSegments) && job.seedanceSegments.length
    ? job.seedanceSegments
    : [];
  const currentIndex = Number.isInteger(job.currentSegmentIndex)
    ? job.currentSegmentIndex
    : 0;

  if (!task) {
    job.status = "processing";
    job.progress = Math.min(0.92, (job.progress || 0.05) + 0.04);
    return job;
  }

  const rawStatus = String(task?.status || "processing").toLowerCase();

  if (rawStatus === "failed" || rawStatus === "error" || rawStatus === "canceled") {
    job.status = "failed";
    job.error = formatProviderError(task?.error || task, 500);
    return job;
  }

  const completed = rawStatus === "succeeded" || rawStatus === "completed";
  const videoUrl = extractSeedanceVideoUrl(task);
  if (completed && videoUrl) {
    job.seedanceVideoUrls[currentIndex] = videoUrl;

    if (currentIndex < segments.length - 1) {
      const nextTask = await createSeedanceTask(segments[currentIndex + 1], videoUrl);
      job.remoteId = nextTask.id;
      job.remoteIds = [...(job.remoteIds || []), nextTask.id];
      job.currentSegmentIndex = currentIndex + 1;
      job.status = "processing";
      job.progress = Math.min(
        0.92,
        0.08 + ((currentIndex + 1) / segments.length) * 0.82,
      );
      return job;
    }

    try {
      const segmentUrls = job.seedanceVideoUrls.filter(Boolean);
      if (segmentUrls.length > 1) {
        await downloadAndConcatVideos(segmentUrls, job.videoPath, job.id);
      } else {
        await downloadVideo(videoUrl, job.videoPath);
      }
      job.status = "succeeded";
      job.progress = 1;
      job.videoUrl = `/generated/${job.id}.mp4`;
      return job;
    } catch (error) {
      job.downloadAttempts = (job.downloadAttempts || 0) + 1;
      if (job.downloadAttempts < 5) {
        console.warn("seedance video download retry", {
          jobId: job.id,
          attempt: job.downloadAttempts,
          message: error instanceof Error ? error.message : String(error),
        });
        job.status = "processing";
        job.progress = 0.94;
        return job;
      }
      throw error;
    }
  }

  job.status = "processing";
  job.progress = Math.min(
    0.92,
    Math.max(job.progress || 0.05, 0.08 + (currentIndex / Math.max(segments.length, 1)) * 0.82),
  );
  return job;
}

async function querySeedanceTask(taskId) {
  const data = await requestSeedance(
    `/contents/generations/tasks?filter.task_ids=${encodeURIComponent(taskId)}&page_num=1&page_size=1`,
    { method: "GET" },
  );
  return Array.isArray(data?.items) ? data.items[0] : data;
}

function extractSeedanceVideoUrl(task) {
  return (
    task?.content?.video_url ||
    task?.content?.videoUrl ||
    task?.content?.url ||
    task?.video_url ||
    ""
  );
}

async function createGoogleVeoVideo(prompt) {
  const durationSeconds =
    Number.isFinite(googleVideoDuration) && googleVideoDuration >= 4
      ? Math.min(8, googleVideoDuration)
      : 8;
  const payload = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio: "16:9",
      durationSeconds,
      resolution: googleVideoResolution,
      personGeneration: "allow_all",
    },
  };
  const data = await requestGoogleVeo(`/models/${googleVideoModel}:predictLongRunning`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!data?.name) {
    throw new Error("Veo 未返回任务 ID");
  }
  return data;
}

async function refreshGoogleVeoJob(job) {
  const data = await requestGoogleVeo(`/${job.remoteId}`, { method: "GET" });

  if (data?.error) {
    job.status = "failed";
    job.error = formatProviderError(data.error, data.error.code || 500);
    return job;
  }

  if (!data?.done) {
    job.status = "processing";
    job.progress = Math.min(0.92, (job.progress || 0.05) + 0.05);
    return job;
  }

  const video = findGoogleVideo(data.response || data);
  if (!video) {
    job.status = "failed";
    job.error = "Veo 已完成但未返回可下载视频";
    return job;
  }

  await downloadGoogleVideo(video, job.videoPath);
  job.status = "succeeded";
  job.progress = 1;
  job.videoUrl = `/generated/${job.id}.mp4`;
  return job;
}

function publicVideoJob(job) {
  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    ...(job.videoUrl ? { videoUrl: job.videoUrl } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

async function requestApiyi(endpoint, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600_000);
  try {
    const response = await fetch(`${apiyiBaseUrl.replace(/\/$/, "")}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiyiApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const textBody = await response.text();
    let data;
    try {
      data = textBody ? JSON.parse(textBody) : {};
    } catch {
      data = { message: textBody };
    }

    if (!response.ok) {
      throw new Error(formatProviderError(data, response.status));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function requestJxincm(endpoint, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${jxincmBaseUrl.replace(/\/$/, "")}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${jxincmApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const textBody = await response.text();
    let data;
    try {
      data = textBody ? JSON.parse(textBody) : {};
    } catch {
      data = { message: textBody };
    }

    if (!response.ok) {
      throw new Error(formatProviderError(data, response.status));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function requestSeedance(endpoint, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${seedanceBaseUrl.replace(/\/$/, "")}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${seedanceApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const textBody = await response.text();
    let data;
    try {
      data = textBody ? JSON.parse(textBody) : {};
    } catch {
      data = { message: textBody };
    }

    if (!response.ok) {
      throw new Error(formatProviderError(data, response.status));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function requestGoogleVeo(endpoint, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${googleVideoBaseUrl.replace(/\/$/, "")}${endpoint}`, {
      ...options,
      headers: {
        "x-goog-api-key": googleVideoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const textBody = await response.text();
    let data;
    try {
      data = textBody ? JSON.parse(textBody) : {};
    } catch {
      data = { message: textBody };
    }

    if (!response.ok) {
      throw new Error(formatProviderError(data, response.status));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function formatProviderError(data, status) {
  const candidates = [data?.message, data?.error, data?.detail, data?.msg];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return JSON.stringify(candidate).slice(0, 800);
    }
  }

  if (data && typeof data === "object" && Object.keys(data).length > 0) {
    return JSON.stringify(data).slice(0, 800);
  }

  return `视频服务 HTTP ${status}`;
}

function isTransientNetworkError(message) {
  return /fetch failed|aborted|ETIMEDOUT|ECONNRESET|EAI_AGAIN|network/i.test(message);
}

function extractVideoUrl(content) {
  const markdownLink = String(content).match(/\((https?:\/\/[^\s)]+\.mp4[^\s)]*)\)/);
  const plainLink = String(content).match(/https?:\/\/\S+\.mp4\S*/);
  const videoUrl = markdownLink?.[1] || plainLink?.[0] || "";
  if (!videoUrl) {
    throw new Error("视频服务未返回可下载 MP4");
  }
  return videoUrl;
}

async function downloadVideo(videoUrl, outputPath) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600_000);
    try {
      const response = await fetch(videoUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`视频下载失败 HTTP ${response.status}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(outputPath, bytes);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await sleep(1500 * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function downloadAndConcatVideos(videoUrls, outputPath, id) {
  const segmentPaths = [];
  const concatPath = path.join(generatedDir, `${id}-seedance-segments.txt`);

  try {
    for (const [index, videoUrl] of videoUrls.entries()) {
      const segmentPath = path.join(generatedDir, `${id}-seedance-${index}.mp4`);
      await downloadVideo(videoUrl, segmentPath);
      segmentPaths.push(segmentPath);
    }

    const concatBody = segmentPaths
      .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(concatPath, `${concatBody}\n`);

    try {
      await run("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-c",
        "copy",
        outputPath,
      ]);
    } catch {
      await run("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        outputPath,
      ]);
    }
  } finally {
    await Promise.all([
      ...segmentPaths.map((segmentPath) => rm(segmentPath, { force: true })),
      rm(concatPath, { force: true }),
    ]);
  }
}

async function downloadGoogleVideo(video, outputPath) {
  if (video.videoBytes) {
    await writeFile(outputPath, Buffer.from(video.videoBytes, "base64"));
    return;
  }

  const candidates = [
    video.downloadUri,
    video.downloadUrl,
    video.uri,
    video.url,
    video.fileUri,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const url = String(candidate);
    if (url.startsWith("http")) {
      await downloadVideoWithHeaders(rewriteGoogleUrl(url), outputPath, {
        "x-goog-api-key": googleVideoApiKey,
      });
      return;
    }
  }

  if (video.name) {
    const normalizedName = String(video.name).replace(/^\//, "");
    const downloadEndpoints = [
      `/${normalizedName}:download`,
      `/${normalizedName}?alt=media`,
    ];
    for (const endpoint of downloadEndpoints) {
      try {
        await downloadVideoWithHeaders(
          `${googleVideoDownloadBaseUrl.replace(/\/$/, "")}${endpoint}`,
          outputPath,
          { "x-goog-api-key": googleVideoApiKey },
        );
        return;
      } catch {
        // Try the next documented Files API download shape.
      }
    }
  }

  throw new Error("Veo 未返回可下载视频地址");
}

function rewriteGoogleUrl(url) {
  const officialBase = "https://generativelanguage.googleapis.com/v1beta";
  const configuredBase = googleVideoDownloadBaseUrl.replace(/\/$/, "");
  return url.startsWith(officialBase)
    ? `${configuredBase}${url.slice(officialBase.length)}`
    : url;
}

async function downloadVideoWithHeaders(videoUrl, outputPath, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(videoUrl, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`视频下载失败 HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, bytes);
  } finally {
    clearTimeout(timer);
  }
}

function findGoogleVideo(payload) {
  const queue = [payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (typeof current.videoBytes === "string") {
      return { videoBytes: current.videoBytes };
    }

    const url = current.downloadUri || current.downloadUrl || current.uri || current.url || current.fileUri;
    if (typeof url === "string" && url) {
      return {
        downloadUri: current.downloadUri,
        downloadUrl: current.downloadUrl,
        uri: current.uri,
        url: current.url,
        fileUri: current.fileUri,
        name: current.name,
      };
    }

    if (typeof current.name === "string" && /^files\//.test(current.name)) {
      return { name: current.name };
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        queue.push(...value);
      } else if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }
  return null;
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
    ${text("本步重点", 670, 106, 18, 800, "#2d5058")}
    <rect x="642" y="128" width="182" height="38" rx="19" fill="#142328" opacity="0.08"/>
    ${text(scene.focus || "局部放大", 670, 154, 18, 800, "#2d5058")}
    <rect x="80" y="206" width="740" height="356" rx="36" fill="#f7fbfa" stroke="#dbe9e4" stroke-width="2"/>
    ${sceneArt}
    <rect x="852" y="84" width="312" height="400" rx="34" fill="#f9fcfb" stroke="#dce9e5" stroke-width="2"/>
    ${text("宣教步骤", 890, 128, 24, 900, "#21323a")}
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
  const scanX = 184 + progress * 94;
  const pathProgress = Math.min(1, progress * 1.2);
  const phoneLift = index === 3 ? 16 + progress * 32 : 0;
  const cycleLabels = ["检查评估", "方案确认", "手术配合", "复诊护理"];

  return `
    <g transform="rotate(${-chairTilt.toFixed(2)} 394 390)">
      <rect x="238" y="388" width="292" height="72" rx="34" fill="#e9f4f0" stroke="#c8dcd5" stroke-width="3"/>
      <rect x="384" y="430" width="190" height="30" rx="15" fill="#d5e6df"/>
      ${person(326, 356, "#f2c9aa", "#dff1eb", 0.92)}
    </g>
    ${person(608, 338, "#efc09e", "#ffffff", 1.06, accent)}
    <rect x="138" y="220" width="210" height="142" rx="24" fill="#ffffff" stroke="#dceae5" stroke-width="2"/>
    ${check(162, 260, index === 0 ? "CBCT影像" : "影像评估", accent)}
    ${check(162, 302, index === 1 ? "周期确认" : "慢病用药", accent)}
    <rect x="370" y="216" width="170" height="120" rx="28" fill="#ffffff" stroke="#dceae5" stroke-width="2" opacity="${index <= 1 ? 1 : 0.7}"/>
    <path d="M404 286 Q440 248 478 286 T530 286" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${scanX.toFixed(1)}" cy="260" r="${index === 0 ? 15 : 0}" fill="#eaf8a7" stroke="${accent}" stroke-width="4"/>
    <path d="M404 318 C452 278, 500 274, 536 236" fill="none" stroke="${accent}" stroke-width="6" stroke-dasharray="${(pathProgress * 120).toFixed(1)} 140" opacity="${index === 1 ? 1 : 0.24}"/>
    <path d="M${toolX.toFixed(1)} 376 C${(toolX - 42).toFixed(1)} 384, 492 392, 446 ${implantY.toFixed(1)}" stroke="${accent}" stroke-width="${index === 2 ? 9 : 4}" fill="none" stroke-linecap="round" opacity="${index === 2 ? 1 : 0.46}"/>
    <rect x="${(toolX - 22).toFixed(1)}" y="340" width="44" height="78" rx="13" fill="#142328" transform="rotate(-22 ${toolX.toFixed(1)} 379)"/>
    <circle cx="446" cy="${implantY.toFixed(1)}" r="${index === 2 ? 13 : 0}" fill="#eaf8a7" stroke="${accent}" stroke-width="4"/>
    <rect x="650" y="${(222 - phoneLift).toFixed(1)}" width="86" height="142" rx="20" fill="#142328"/>
    <path d="M670 286 Q694 258 716 286 T758 286" fill="none" stroke="#eaf8a7" stroke-width="5"/>
    <rect x="674" y="${(322 - phoneLift).toFixed(1)}" width="38" height="8" rx="4" fill="${index === 3 ? "#eaf8a7" : accent}" opacity="${index === 3 ? 1 : 0.55}"/>
    <rect x="188" y="494" width="468" height="18" rx="9" fill="#dceae5"/>
    <rect x="188" y="494" width="${(118 + index * 116 + progress * 78).toFixed(1)}" height="18" rx="9" fill="${accent}" opacity="0.7"/>
    ${text(cycleLabels[index] || "术前宣教", 676, 506, 20, 900, "#2f454d")}
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
