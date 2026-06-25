import { type CSSProperties, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileAudio,
  FileText,
  Hospital,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  MonitorCheck,
  Play,
  QrCode,
  ScanLine,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  Video,
} from "lucide-react";

type CaseKey = "gastroscopy" | "ct" | "surgery";
type GenerationStatus = "idle" | "generating" | "ready" | "error";

type DirectorShot = {
  title?: string;
  camera: string;
  motion: string;
  focus: string;
  subtitle: string;
  voiceover: string;
};

type EducationContent = {
  patientTitle: string;
  patientBrief: string;
  points: string[];
  storyboard: string[];
  directorShots?: DirectorShot[];
  warnings: string[];
  narration?: string;
};

type EducationCase = EducationContent & {
  key: CaseKey;
  department: string;
  project: string;
  audience: string;
  source: string;
  tone: string;
  accent: string;
};

type GenerationResult = {
  id: string;
  model: string;
  content: EducationContent;
  audioUrl: string;
  videoUrl?: string;
  videoGenerationAvailable?: boolean;
};

type VideoJobStatus = "idle" | "processing" | "succeeded" | "failed";

type VideoJobResult = {
  jobId: string;
  status: VideoJobStatus;
  progress?: number;
  videoUrl?: string;
  error?: string;
};

const educationCases: EducationCase[] = [
  {
    key: "gastroscopy",
    department: "消化内镜中心",
    project: "胃镜检查术前宣教",
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
  {
    key: "ct",
    department: "医学影像科",
    project: "增强 CT 检查宣教",
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
  {
    key: "surgery",
    department: "口腔修复科",
    project: "无牙颌修复术说明",
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
];

const reviewChecks = [
  {
    title: "禁忌与风险提醒",
    text: "保留禁食、麻醉、慢病用药等必须人工确认的提示",
    icon: ShieldCheck,
    status: "需确认",
  },
  {
    title: "预约信息核对",
    text: "检查项目、预约时间、科室位置在发送前再次核对",
    icon: Link2,
    status: "可核对",
  },
  {
    title: "医生确认留痕",
    text: "记录生成、修改、确认与发送人，便于后续追溯",
    icon: LockKeyhole,
    status: "有记录",
  },
  {
    title: "患者端发送",
    text: "确认后通过二维码、短信或院内公众号发送给患者",
    icon: Smartphone,
    status: "待确认",
  },
  {
    title: "阅读反馈",
    text: "患者阅读、语音播放和异常反馈回到科室列表",
    icon: MonitorCheck,
    status: "可查看",
  },
];

function App() {
  const [selectedKey, setSelectedKey] = useState<CaseKey>("surgery");
  const [progress, setProgress] = useState(4);
  const [approved, setApproved] = useState(true);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [activeDirectorIndex, setActiveDirectorIndex] = useState(0);
  const [videoStatus, setVideoStatus] = useState<VideoJobStatus>("idle");
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const selectedCase = useMemo(
    () => educationCases.find((item) => item.key === selectedKey) ?? educationCases[0],
    [selectedKey],
  );

  const content = result?.content ?? selectedCase;
  const audioUrl = result?.audioUrl;
  const videoUrl = result?.videoUrl;
  const isGenerating = status === "generating";
  const isVideoGenerating = videoStatus === "processing";
  const directorShots = useMemo(
    () => buildDirectorShots(content, selectedCase),
    [content, selectedCase],
  );
  const activeDirectorShot = directorShots[activeDirectorIndex] ?? directorShots[0];

  const steps = [
    {
      label: "读取材料",
      detail: selectedCase.source,
      icon: BookOpenText,
    },
    {
      label: "宣教文案",
      detail: "生成患者可读版本，降低医学术语密度",
      icon: FileText,
    },
    {
      label: "语音提醒",
      detail: "生成普通话音频，患者可直接收听",
      icon: FileAudio,
    },
    ...(videoUrl || isVideoGenerating
      ? [
          {
            label: "宣教视频",
            detail: videoUrl ? "视频已生成，可发送给患者" : "正在生成可播放宣教视频",
            icon: Video,
          },
        ]
      : []),
    {
      label: "医生审核",
      detail: approved ? "已通过，生成患者端入口" : "等待医生确认后发布",
      icon: ClipboardCheck,
    },
  ];

  const generateEducation = async () => {
    setStatus("generating");
    setApproved(false);
    setError("");
    setResult(null);
    setProgress(0);
    setPlaybackProgress(0);
    setActiveDirectorIndex(0);
    setVideoStatus("idle");
    setVideoProgress(0);
    setVideoError("");

    const timers = [1, 2, 3].map((value, index) =>
      window.setTimeout(() => setProgress(value), (index + 1) * 900),
    );

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseKey: selectedKey }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || "生成失败");
      }

      const payload = (await response.json()) as GenerationResult;
      setResult(payload);
      setProgress(4);
      setApproved(true);
      setStatus("ready");
      setPlaybackProgress(0);
      setActiveDirectorIndex(0);
      if (payload.videoGenerationAvailable && !payload.videoUrl) {
        void startVideoGeneration(payload);
      }
    } catch (generationError) {
      setStatus("error");
      setProgress(0);
      setApproved(false);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "生成服务连接失败",
      );
    } finally {
      timers.forEach(window.clearTimeout);
    }
  };

  const chooseCase = (key: CaseKey) => {
    setSelectedKey(key);
    setProgress(4);
    setApproved(true);
    setStatus("idle");
    setResult(null);
    setError("");
    setPlaybackProgress(0);
    setActiveDirectorIndex(0);
    setVideoStatus("idle");
    setVideoProgress(0);
    setVideoError("");
  };

  const playPatientAudio = () => {
    const player = audioRef.current;
    if (!player || !audioUrl) {
      return;
    }
    player.currentTime = 0;
    void player.play();
  };

  const syncVideoPlayback = () => {
    const player = videoRef.current;
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0) {
      return;
    }
    const nextProgress = Math.min(1, Math.max(0, player.currentTime / player.duration));
    const nextIndex = Math.min(
      directorShots.length - 1,
      Math.floor(nextProgress * directorShots.length),
    );
    setPlaybackProgress(nextProgress);
    setActiveDirectorIndex(nextIndex);
  };

  const startVideoGeneration = async (payload: GenerationResult) => {
    setVideoStatus("processing");
    setVideoProgress(0.06);
    setVideoError("");

    try {
      const response = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: payload.id,
          caseKey: selectedKey,
          content: payload.content,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || "视频生成任务创建失败");
      }

      const videoJob = (await response.json()) as VideoJobResult;
      if (videoJob.status === "succeeded" && videoJob.videoUrl) {
        setResult((current) =>
          current ? { ...current, videoUrl: videoJob.videoUrl } : current,
        );
        setVideoStatus("succeeded");
        setVideoProgress(1);
        return;
      }

      await pollVideoJob(videoJob.jobId);
    } catch (videoGenerationError) {
      setVideoStatus("failed");
      setVideoProgress(0);
      setVideoError(
        videoGenerationError instanceof Error
          ? videoGenerationError.message
          : "视频生成失败，请稍后重试",
      );
    }
  };

  const pollVideoJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt < 6 ? 5000 : 10000));
      const response = await fetch(`/api/video-jobs/${jobId}`);
      const payload = (await response.json().catch(() => null)) as VideoJobResult | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error || "视频生成状态查询失败");
      }

      setVideoProgress(payload.progress ?? Math.min(0.92, 0.08 + attempt * 0.03));

      if (payload.status === "succeeded" && payload.videoUrl) {
        setResult((current) =>
          current ? { ...current, videoUrl: payload.videoUrl } : current,
        );
        setVideoStatus("succeeded");
        setVideoProgress(1);
        return;
      }

      if (payload.status === "failed") {
        throw new Error(payload.error || "视频生成失败，请稍后重试");
      }
    }

    throw new Error("视频生成时间较长，请稍后刷新查看");
  };

  return (
    <main className="app-shell">
      <div className="ambient-grid" />
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <Hospital size={23} strokeWidth={1.8} />
          </div>
          <div>
            <p className="eyebrow">医生端 · 审核后发送给患者</p>
            <h1>患者宣教内容工作台</h1>
          </div>
        </div>
        <div className="top-actions">
          <div className={`status-pill ${status}`}>
            <span />
            {status === "ready"
              ? "内容已生成，待确认"
              : status === "generating"
                ? "正在生成宣教内容"
                : status === "error"
                  ? "生成失败，请重试"
                  : "可生成宣教内容"}
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={generateEducation}
            disabled={isGenerating}
          >
            {isGenerating ? <LoaderCircle size={17} /> : <Sparkles size={17} />}
            {isGenerating ? "生成中" : "重新生成"}
          </button>
        </div>
      </header>

      <section className="metric-strip" aria-label="科室今日宣教任务">
        <Metric label="待医生确认" value="3 份" sub="术前 / 检查 / 护理" />
        <Metric label="今日已发送" value="24 人" sub="短信与公众号同步" />
        <Metric label="患者已读" value="82%" sub="含播放进度回传" />
        <Metric label="异常反馈" value="0 条" sub="暂无高风险提醒" />
      </section>

      <section className="workspace-grid">
        <aside className="input-panel">
          <div className="panel-heading">
            <Stethoscope size={19} />
            <span>医生工作台</span>
          </div>
          <div className="case-list">
            {educationCases.map((item) => (
              <button
                className={`case-card ${
                  item.key === selectedKey ? "selected" : ""
                }`}
                key={item.key}
                style={{ "--case-color": item.accent } as CSSProperties}
                type="button"
                onClick={() => chooseCase(item.key)}
              >
                <span>{item.department}</span>
                <strong>{item.project}</strong>
                <small>{item.audience}</small>
              </button>
            ))}
          </div>

          <div className="source-box">
            <p className="section-label">本次宣教材料</p>
            <div className="source-line">
              <ScanLine size={18} />
              <span>{selectedCase.source}</span>
            </div>
            <div className="source-line">
              <MessageSquareText size={18} />
              <span>表达方式：{selectedCase.tone}</span>
            </div>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={generateEducation}
            disabled={isGenerating}
          >
            {isGenerating ? <LoaderCircle size={17} /> : <Play size={17} fill="currentColor" />}
            {isGenerating ? "正在生成患者内容" : "生成患者宣教"}
          </button>
          {error && <div className="error-box">{error}</div>}
        </aside>

        <section className="generation-panel">
          <div className="panel-title-row">
            <div>
              <p className="section-label">宣教内容编辑</p>
              <h2>{selectedCase.project}</h2>
            </div>
            <div className="trace-badge">
              <ShieldCheck size={17} />
              {result ? "已生成，等待医生确认" : "医生确认后发送"}
            </div>
          </div>

          <div className="flow-rail">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const active = progress >= index;
              return (
                <div className={`flow-step ${active ? "active" : ""}`} key={step.label}>
                  <div className="step-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="review-workbench">
            <div className="review-copy">
              <div className="review-copy-head">
                <span>发送前核对</span>
                <strong>{content.warnings.join(" · ")}</strong>
              </div>
              <div className="review-note">
                <UserRoundCheck size={18} />
                <p>
                  当前内容适合{selectedCase.audience}。请确认禁忌提醒、检查时间和离院注意事项后再发送。
                </p>
              </div>
            </div>
            <div className="send-panel">
              <div>
                <span>患者端</span>
                <strong>{approved ? "可发送" : "确认后发送"}</strong>
              </div>
              <button type="button">
                <Send size={16} />
                发送给患者
              </button>
            </div>
          </div>

          <div className="artifact-grid">
            <article className="artifact copy-artifact">
              <div className="artifact-head">
                <FileText size={18} />
                <span>患者版宣教文案</span>
              </div>
              <h3>{content.patientTitle}</h3>
              <p>{content.patientBrief}</p>
              <ul>
                {content.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>

            {audioUrl && (
              <article className="artifact audio-artifact">
                <div className="artifact-head">
                  <AudioLines size={18} />
                  <span>患者语音提醒</span>
                </div>
                <audio ref={audioRef} className="audio-player" controls src={audioUrl} />
                <div className="audio-meta">
                  <span>普通话 · 亲和语速</span>
                  <strong>可播放</strong>
                </div>
              </article>
            )}

            {videoUrl && (
              <article className="artifact storyboard-artifact">
                <div className="artifact-head">
                  <Video size={18} />
                  <span>手术动画宣教片</span>
                </div>
                <div className="video-card">
                  <video
                    ref={videoRef}
                    controls
                    src={videoUrl}
                    onLoadedMetadata={syncVideoPlayback}
                    onTimeUpdate={syncVideoPlayback}
                  />
                  <a href={videoUrl} download>
                    <Download size={15} />
                    保存宣教片
                  </a>
                </div>
              </article>
            )}
            {isVideoGenerating && (
              <article className="artifact video-status-artifact">
                <div className="artifact-head">
                  <LoaderCircle size={18} />
                  <span>宣教视频生成中</span>
                </div>
                <div className="video-job-card">
                  <strong>正在生成可播放宣教视频</strong>
                  <p>系统正在制作医生可审核的视频，完成后可直接播放并发送给患者。</p>
                  <div className="video-job-bar">
                    <i style={{ width: `${Math.round(videoProgress * 100)}%` }} />
                  </div>
                  <span>{Math.max(5, Math.round(videoProgress * 100))}%</span>
                </div>
              </article>
            )}
            {videoStatus === "failed" && videoError && (
              <article className="artifact video-status-artifact error-state">
                <div className="artifact-head">
                  <Video size={18} />
                  <span>宣教视频暂未生成</span>
                </div>
                <div className="video-job-card">
                  <strong>视频生成暂时失败</strong>
                  <p>{videoError}</p>
                  {result?.videoGenerationAvailable && (
                    <button type="button" onClick={() => startVideoGeneration(result)}>
                      重新生成视频
                    </button>
                  )}
                </div>
              </article>
            )}
          </div>
        </section>

        <aside className="patient-panel">
          <div className="phone-frame">
            <div className="phone-top">
              <span />
              <small>患者端预览</small>
            </div>
            <div className="phone-body">
              <div className="hospital-chip">院内宣教中心</div>
              <h3>{content.patientTitle}</h3>
              <p>{content.patientBrief}</p>
              <div className="warning-row">
                {content.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
              {audioUrl && (
                <button
                  className="mini-player ready"
                  type="button"
                  onClick={playPatientAudio}
                  aria-label="播放语音提醒"
                >
                  <FileAudio size={19} />
                  <div className="player-text">
                    <strong>语音提醒</strong>
                    <span>已生成，可播放</span>
                  </div>
                  <span className="mini-play-icon">
                    <Play size={15} fill="currentColor" />
                  </span>
                </button>
              )}
              {videoUrl && (
                <div className="phone-sync">
                  <div className="phone-sync-head">
                    <span>视频播放进度</span>
                    <strong>{Math.round(playbackProgress * 100)}%</strong>
                  </div>
                  <div className="phone-sync-bar">
                    <i style={{ width: `${playbackProgress * 100}%` }} />
                  </div>
                  <p>{activeDirectorShot.subtitle}</p>
                </div>
              )}
              <div className="patient-steps">
                {content.points.map((point) => (
                  <div key={point}>
                    <CheckCircle2 size={16} />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="phone-footer">
              <QrCode size={38} />
              <div>
                <strong>发送给患者</strong>
                <span>{approved ? "医生已审核" : "审核完成后开放"}</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="reserved-section">
        <div className="reserved-title">
          <p className="section-label">发送前检查</p>
          <h2>所有内容先由医生确认，再进入患者端</h2>
        </div>
        <div className="reserved-grid">
          {reviewChecks.map((module) => {
            const Icon = module.icon;
            return (
              <article className="reserved-item" key={module.title}>
                <Icon size={21} />
                <strong>{module.title}</strong>
                <p>{module.text}</p>
                <span>{module.status}</span>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function buildDirectorShots(
  content: EducationContent,
  selectedCase: EducationCase,
): DirectorShot[] {
  if (content.directorShots?.length) {
    return content.directorShots.slice(0, 4);
  }

  const focusLabels =
    selectedCase.key === "surgery"
      ? ["影像与全身情况评估", "修复路径演示", "手术日配合", "术后护理同步"]
      : selectedCase.key === "ct"
        ? ["病史确认", "造影剂说明", "扫描配合", "留观饮水"]
        : ["签到导览", "术前准备", "检查配合", "检查后观察"];

  return selectedCase.storyboard.slice(0, 4).map((item, index) => {
    const [title, body] = item.split("：");
    return {
      title: title || `镜头 ${index + 1}`,
      camera: `${selectedCase.department}场景镜头，围绕“${title || item}”推进`,
      motion: index === 0 ? "时间轴流动进入，资料节点逐项点亮" : "局部医学图示放大，字幕与旁白同步推进",
      focus: focusLabels[index] || title || `镜头 ${index + 1}`,
      subtitle: body || item,
      voiceover: body || item,
    };
  });
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}

export default App;
