import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AudioLines,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  Download,
  FileAudio,
  FileText,
  Gauge,
  Hospital,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  MonitorCheck,
  Play,
  QrCode,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
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
  duration: string;
  source: string;
  tone: string;
  accent: string;
};

type GenerationResult = {
  id: string;
  model: string;
  content: EducationContent;
  audioUrl: string;
  videoUrl: string;
};

const educationCases: EducationCase[] = [
  {
    key: "gastroscopy",
    department: "消化内镜中心",
    project: "胃镜检查术前宣教",
    audience: "首次胃镜检查患者",
    duration: "约 3 分钟",
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
    duration: "约 2 分 40 秒",
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
    project: "无牙颌修复术前宣教",
    audience: "拟行种植修复患者",
    duration: "约 3 分 20 秒",
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
];

const systemModules = [
  {
    title: "院内账号",
    text: "按医生、护士、科室管理员区分审核权限",
    icon: LockKeyhole,
    status: "已启用",
  },
  {
    title: "预约信息",
    text: "读取检查项目、预约时间和患者宣教对象",
    icon: Link2,
    status: "待连接",
  },
  {
    title: "科室资料库",
    text: "管理宣教材料版本，保留内容引用来源",
    icon: DatabaseZap,
    status: "可维护",
  },
  {
    title: "患者通知",
    text: "通过二维码、短信或院内公众号发送宣教页",
    icon: Smartphone,
    status: "可发送",
  },
  {
    title: "发布记录",
    text: "记录生成、修改、审核和患者阅读状态",
    icon: MonitorCheck,
    status: "有留痕",
  },
];

const stepIcons = [BookOpenText, FileText, FileAudio, Video, ClipboardCheck];

function App() {
  const [selectedKey, setSelectedKey] = useState<CaseKey>("surgery");
  const [progress, setProgress] = useState(4);
  const [approved, setApproved] = useState(true);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [activeDirectorIndex, setActiveDirectorIndex] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
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
  const directorShots = useMemo(
    () => buildDirectorShots(content, selectedCase),
    [content, selectedCase],
  );
  const activeDirectorShot = directorShots[activeDirectorIndex] ?? directorShots[0];
  const previewProgress =
    status === "generating"
      ? Math.min(0.92, (progress + 0.35) / 5)
      : status === "ready"
        ? playbackProgress
        : playbackProgress;
  const focusPosition = `${22 + activeDirectorIndex * 19}%`;

  useEffect(() => {
    if (!isPreviewPlaying || videoUrl) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setPlaybackProgress((current) => {
        const next = current >= 0.995 ? 0 : Math.min(1, current + 0.018);
        const nextIndex = Math.min(
          directorShots.length - 1,
          Math.floor(next * directorShots.length),
        );
        setActiveDirectorIndex(nextIndex);
        return next;
      });
    }, 120);

    return () => window.clearInterval(timer);
  }, [directorShots.length, isPreviewPlaying, videoUrl]);

  const steps = [
    {
      label: "读取材料",
      detail: selectedCase.source,
    },
    {
      label: "宣教文案",
      detail: "生成患者可读版本，降低医学术语密度",
    },
    {
      label: "语音宣教",
      detail: "生成普通话音频，患者可直接收听",
    },
    {
      label: "视频片段",
      detail: "生成图示、字幕和旁白节奏",
    },
    {
      label: "医生审核",
      detail: approved ? "已通过，生成患者端入口" : "等待医生确认后发布",
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
    setIsPreviewPlaying(false);

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
      setIsPreviewPlaying(false);
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
    setIsPreviewPlaying(false);
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

  const toggleStoryboardPreview = () => {
    if (videoUrl) {
      return;
    }
    setIsPreviewPlaying((current) => !current);
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

      <section className="metric-strip" aria-label="科室今日宣教状态">
        <Metric label="待医生确认" value="3 份" sub="术前 / 检查 / 护理" />
        <Metric label="今日已发送" value="24 人" sub="扫码页与语音同步" />
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
              const Icon = stepIcons[index];
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

          <div className="director-console">
            <div className="director-board">
              <div className="director-topline">
                <div>
                  <span>片段 {String(activeDirectorIndex + 1).padStart(2, "0")}</span>
                  <strong>{activeDirectorShot.title || activeDirectorShot.focus}</strong>
                </div>
                <small>{status === "ready" ? "可播放预览" : "按材料生成中"}</small>
              </div>
              <div className="director-timeline">
                {directorShots.map((shot, index) => (
                  <button
                    className={`director-shot ${index === activeDirectorIndex ? "active" : ""}`}
                    key={`${shot.focus}-${index}`}
                    type="button"
                    onClick={() => setActiveDirectorIndex(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{shot.focus}</strong>
                    <small>{shot.motion}</small>
                  </button>
                ))}
              </div>
            </div>
            <div
              className="medical-focus-stage"
              style={{ "--focus-x": focusPosition } as CSSProperties}
            >
              <div className="focus-caption">
                <span>患者重点图示</span>
                <strong>{activeDirectorShot.focus}</strong>
              </div>
              <div className="anatomy-card">
                <div className="scan-strip" />
                <div className="jaw-curve">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <i key={`tooth-${index}`} />
                  ))}
                </div>
                <div className="implant-line" />
                <div className="focus-lens" />
              </div>
              <p>{activeDirectorShot.subtitle}</p>
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

            <article className="artifact audio-artifact">
              <div className="artifact-head">
                <AudioLines size={18} />
                <span>语音宣教</span>
              </div>
              {audioUrl ? (
                <audio ref={audioRef} className="audio-player" controls src={audioUrl} />
              ) : (
                <div className="audio-display">
                  {Array.from({ length: 34 }).map((_, index) => (
                    <i
                      key={`bar-${index}`}
                      style={{ animationDelay: `${index * 0.045}s` }}
                    />
                  ))}
                </div>
              )}
              <div className="audio-meta">
                <span>普通话 · 亲和语速</span>
                <strong>{audioUrl ? "可播放" : selectedCase.duration}</strong>
              </div>
            </article>

            <article className="artifact storyboard-artifact">
              <div className="artifact-head">
                <Video size={18} />
                <span>可播放宣教片</span>
              </div>
              {videoUrl ? (
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
              ) : (
                <div className={`storyboard-preview ${isPreviewPlaying ? "playing" : ""}`}>
                  <button
                    className="storyboard-stage"
                    type="button"
                    onClick={toggleStoryboardPreview}
                    aria-label={isPreviewPlaying ? "暂停宣教片预览" : "播放宣教片预览"}
                  >
                    <div className="storyboard-screen">
                      <div className="screen-scan" />
                      <div className="screen-patient" />
                      <div className="screen-doctor" />
                      <div className="screen-monitor">
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="screen-lens" />
                      <span>{activeDirectorShot.focus}</span>
                    </div>
                    <div className="preview-play">
                      {isPreviewPlaying ? <AudioLines size={19} /> : <Play size={19} fill="currentColor" />}
                    </div>
                  </button>
                  <div className="preview-progress">
                    <i style={{ width: `${previewProgress * 100}%` }} />
                  </div>
                  <div className="storyboard">
                    {directorShots.map((shot, index) => (
                      <button
                        className={`shot ${index === activeDirectorIndex ? "active" : ""}`}
                        key={`${shot.focus}-${index}`}
                        type="button"
                        onClick={() => {
                          setActiveDirectorIndex(index);
                          setPlaybackProgress(index / directorShots.length);
                        }}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <p>{shot.camera}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
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
              <button
                className={`mini-player ${audioUrl ? "ready" : ""}`}
                type="button"
                onClick={playPatientAudio}
                disabled={!audioUrl}
                aria-label={audioUrl ? "播放语音宣教" : "语音生成后可播放"}
              >
                <FileAudio size={19} />
                <div className="player-text">
                  <strong>语音宣教</strong>
                  <span>{audioUrl ? "已生成，可播放" : selectedCase.duration}</span>
                </div>
                <span className="mini-play-icon">
                  <Play size={15} fill="currentColor" />
                </span>
              </button>
              <div className="phone-sync">
                <div className="phone-sync-head">
                  <span>宣教片同步播放</span>
                  <strong>{Math.round(previewProgress * 100)}%</strong>
                </div>
                <div className="phone-sync-bar">
                  <i style={{ width: `${previewProgress * 100}%` }} />
                </div>
                <p>{activeDirectorShot.subtitle}</p>
              </div>
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

      <section className="display-band">
        <div className="display-left">
          <div className="panel-heading">
            <LayoutDashboard size={19} />
            <span>科室宣教看板</span>
          </div>
          <h2>医生确认后，患者即可在手机端查看文字、语音和宣教片</h2>
          <p>
            当前页面面向科室日常使用：医生选择宣教项目，核对生成内容，
            确认后发送给患者。患者端保留阅读进度、播放进度和异常反馈记录。
          </p>
        </div>
        <div className="display-stats">
          <DataOrb label="今日生成" value="24" icon={Activity} />
          <DataOrb label="医生确认率" value="96%" icon={ClipboardCheck} />
          <DataOrb label="患者完成阅读" value="82%" icon={Gauge} />
          <DataOrb label="内容追溯" value="100%" icon={RadioTower} />
        </div>
      </section>

      <section className="reserved-section">
        <div className="reserved-title">
          <p className="section-label">院内工作状态</p>
          <h2>医生只需要看到任务、内容、发送状态和患者反馈</h2>
        </div>
        <div className="reserved-grid">
          {systemModules.map((module) => {
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

function DataOrb({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <article className="data-orb">
      <Icon size={19} />
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

export default App;
