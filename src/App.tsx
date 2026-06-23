import { type CSSProperties, useMemo, useRef, useState } from "react";
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

type EducationContent = {
  patientTitle: string;
  patientBrief: string;
  points: string[];
  storyboard: string[];
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

const reservedModules = [
  {
    title: "院内登录",
    text: "预留账号、角色、科室权限与审计入口",
    icon: LockKeyhole,
  },
  {
    title: "HIS / EMR",
    text: "预留检查项目、预约信息和患者基本字段",
    icon: Link2,
  },
  {
    title: "科室知识库",
    text: "预留资料入库、版本管理和引用追溯",
    icon: DatabaseZap,
  },
  {
    title: "公众号 / 小程序",
    text: "预留二维码分发、阅读回执和消息提醒",
    icon: Smartphone,
  },
  {
    title: "本地化部署",
    text: "预留院内服务器、模型服务和内容安全网关",
    icon: MonitorCheck,
  },
];

const stepIcons = [BookOpenText, FileText, FileAudio, Video, ClipboardCheck];

function App() {
  const [selectedKey, setSelectedKey] = useState<CaseKey>("gastroscopy");
  const [progress, setProgress] = useState(4);
  const [approved, setApproved] = useState(true);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedCase = useMemo(
    () => educationCases.find((item) => item.key === selectedKey) ?? educationCases[0],
    [selectedKey],
  );

  const content = result?.content ?? selectedCase;
  const audioUrl = result?.audioUrl;
  const videoUrl = result?.videoUrl;
  const isGenerating = status === "generating";

  const steps = [
    {
      label: "资料读取",
      detail: selectedCase.source,
    },
    {
      label: "宣教文案",
      detail: "生成患者可读版本，降低医学术语密度",
    },
    {
      label: "语音文件",
      detail: "生成普通话宣教音频，可直接播放",
    },
    {
      label: "宣教视频",
      detail: "合成字幕画面、分镜和旁白",
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
  };

  const playPatientAudio = () => {
    const player = audioRef.current;
    if (!player || !audioUrl) {
      return;
    }
    player.currentTime = 0;
    void player.play();
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
            <p className="eyebrow">真实内容生成 · 医生审核发布</p>
            <h1>医院 AI 宣教内容生成工作台</h1>
          </div>
        </div>
        <div className="top-actions">
          <div className={`status-pill ${status}`}>
            <span />
            {status === "ready"
              ? "语音与视频已生成"
              : status === "generating"
                ? "正在生成真实内容"
                : status === "error"
                  ? "生成服务需检查"
                  : "生成服务在线"}
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

      <section className="metric-strip" aria-label="demo metrics">
        <Metric label="首期覆盖" value="1 个核心闭环" sub="文案 / 语音 / 视频" />
        <Metric label="生成方式" value="真实产物" sub="可播放音频与 MP4" />
        <Metric label="审核方式" value="医生确认" sub="发布前留痕" />
        <Metric label="患者入口" value="二维码 / 网页" sub="轻量展示" />
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
            <p className="section-label">院内材料</p>
            <div className="source-line">
              <ScanLine size={18} />
              <span>{selectedCase.source}</span>
            </div>
            <div className="source-line">
              <MessageSquareText size={18} />
              <span>{selectedCase.tone}</span>
            </div>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={generateEducation}
            disabled={isGenerating}
          >
            {isGenerating ? <LoaderCircle size={17} /> : <Play size={17} fill="currentColor" />}
            {isGenerating ? "正在生成语音和视频" : "生成宣教内容"}
          </button>
          {error && <div className="error-box">{error}</div>}
        </aside>

        <section className="generation-panel">
          <div className="panel-title-row">
            <div>
              <p className="section-label">AI 内容生产链路</p>
              <h2>{selectedCase.project}</h2>
            </div>
            <div className="trace-badge">
              <ShieldCheck size={17} />
              {result ? `已生成 · ${result.model}` : "可审核 · 可追溯"}
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
                <span>宣教视频</span>
              </div>
              {videoUrl ? (
                <div className="video-card">
                  <video controls src={videoUrl} />
                  <a href={videoUrl} download>
                    <Download size={15} />
                    下载 MP4
                  </a>
                </div>
              ) : (
                <div className="storyboard">
                  {content.storyboard.map((shot, index) => (
                    <div className="shot" key={shot}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{shot}</p>
                    </div>
                  ))}
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
                <strong>扫码查看</strong>
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
            <span>院内展示视图</span>
          </div>
          <h2>把一次宣教任务做成可审核、可播放、可复用的内容闭环</h2>
          <p>
            本阶段突出一个真实可演示闭环：资料输入、模型生成宣教稿、语音文件、
            MP4 宣教视频、医生审核、患者端展示。完整项目再扩展到院内接口、本地部署、
            多科室运营与内容质控。
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
          <p className="section-label">完整项目接口位</p>
          <h2>本阶段预留，不在当前演示中强行承诺生产联调</h2>
        </div>
        <div className="reserved-grid">
          {reservedModules.map((module) => {
            const Icon = module.icon;
            return (
              <article className="reserved-item" key={module.title}>
                <Icon size={21} />
                <strong>{module.title}</strong>
                <p>{module.text}</p>
                <span>接口位已预留</span>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
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
