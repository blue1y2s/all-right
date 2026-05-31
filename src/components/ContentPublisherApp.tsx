"use client";

import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  Download,
  FileText,
  History,
  Layers,
  Loader2,
  Network,
  PenLine,
  PlugZap,
  Rocket,
  RotateCcw,
  Sparkles,
  Tags,
  Trash2,
  Undo2,
  Wand2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { adapterRegistry, platformAdapters } from "@/lib/adapters";
import { demoContent, generateHotIdeas } from "@/lib/demoContent";
import {
  createDraftFilename,
  createPlainDraft,
  serializeDraftPackage,
} from "@/lib/draftPackage";
import {
  canRetry,
  canWithdraw,
  createPendingQueue,
  createRunningResult,
  createWithdrawnResult,
  prependHistory,
  replaceQueueItem,
  upsertQueueItem,
} from "@/lib/publishQueue";
import type {
  AdaptedPost,
  ContentTone,
  PlatformId,
  PublishResult,
  SourceContent,
} from "@/types/content";

const platformIds = platformAdapters.map((adapter) => adapter.id);
const historyKey = "all-right-publish-history";

const toneOptions: Array<{ value: ContentTone; label: string }> = [
  { value: "practical", label: "实用" },
  { value: "professional", label: "专业" },
  { value: "friendly", label: "亲和" },
  { value: "story", label: "叙事" },
];

function loadHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(historyKey);
    return raw ? (JSON.parse(raw) as PublishResult[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: PublishResult[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 16)));
}

function downloadTextFile(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function splitTagText(value: string) {
  return value
    .split(/[,\s，、]+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

function statusLabel(status: PublishResult["status"]) {
  const labels = {
    pending: "等待中",
    running: "发布中",
    success: "成功",
    failed: "失败",
    withdrawn: "已撤回",
  };
  return labels[status];
}

function statusIcon(status: PublishResult["status"]) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "failed") return <XCircle className="h-4 w-4" />;
  if (status === "withdrawn") return <Undo2 className="h-4 w-4" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin" />;
  return <Clock3 className="h-4 w-4" />;
}

export function ContentPublisherApp() {
  const [view, setView] = useState<"workspace" | "architecture">("workspace");
  const [source, setSource] = useState<SourceContent>(demoContent);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(platformIds);
  const [activePlatform, setActivePlatform] = useState<PlatformId>("wechat");
  const [tagDraft, setTagDraft] = useState("");
  const [topic, setTopic] = useState("AI 内容创作");
  const [queue, setQueue] = useState<PublishResult[]>([]);
  const [history, setHistory] = useState<PublishResult[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState("本地规则模板已就绪");

  useEffect(() => {
    setHistory(loadHistory());
    fetch("/api/ai/status")
      .then((response) => response.json())
      .then((data: { enabled: boolean }) => {
        setAiEnabled(Boolean(data.enabled));
        setNotice(data.enabled ? "AI 增强已启用" : "本地规则模板已就绪");
      })
      .catch(() => setNotice("本地规则模板已就绪"));
  }, []);

  useEffect(() => {
    if (!selectedPlatforms.includes(activePlatform) && selectedPlatforms.length > 0) {
      setActivePlatform(selectedPlatforms[0]);
    }
  }, [activePlatform, selectedPlatforms]);

  const adaptedPosts = useMemo(
    () => selectedPlatforms.map((platformId) => adapterRegistry[platformId].adapt(source)),
    [selectedPlatforms, source],
  );

  const activePost = useMemo(
    () => adaptedPosts.find((post) => post.platformId === activePlatform) ?? adaptedPosts[0],
    [activePlatform, adaptedPosts],
  );

  const warningCount = adaptedPosts.reduce(
    (sum, post) => sum + adapterRegistry[post.platformId].validate(post).length,
    0,
  );

  const ideas = useMemo(() => generateHotIdeas(topic), [topic]);

  function updateSource(patch: Partial<SourceContent>) {
    setSource((current) => ({ ...current, ...patch }));
  }

  function togglePlatform(platformId: PlatformId) {
    setSelectedPlatforms((current) => {
      if (current.includes(platformId)) {
        return current.filter((id) => id !== platformId);
      }
      return [...current, platformId];
    });
  }

  function addTag(value: string) {
    const tags = splitTagText(value);
    if (tags.length === 0) return;

    setSource((current) => ({
      ...current,
      tags: Array.from(new Set([...current.tags, ...tags])).slice(0, 10),
    }));
    setTagDraft("");
  }

  function removeTag(tag: string) {
    setSource((current) => ({
      ...current,
      tags: current.tags.filter((item) => item !== tag),
    }));
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addTag(tagDraft);
  }

  async function publishPost(post: AdaptedPost, id?: string) {
    const started = createRunningResult(post, id ?? `${post.platformId}-${Date.now()}`);

    setQueue((current) => upsertQueueItem(current, started));
    const result = await adapterRegistry[post.platformId].publish(post);
    const finalResult = {
      ...result,
      id: started.id,
      createdAt: started.createdAt,
    };

    setQueue((current) => replaceQueueItem(current, finalResult));
    setHistory((current) => {
      const next = prependHistory(current, finalResult);
      saveHistory(next);
      return next;
    });
  }

  async function publishAll() {
    const initialQueue = createPendingQueue(adaptedPosts);

    setQueue(initialQueue);

    for (const item of initialQueue) {
      const post = adaptedPosts.find((adapted) => adapted.platformId === item.platformId);
      if (post) await publishPost(post, item.id);
    }
  }

  async function retry(result: PublishResult) {
    const post =
      adaptedPosts.find((item) => item.platformId === result.platformId) ??
      adapterRegistry[result.platformId].adapt(source);

    await publishPost(post, result.id);
  }

  function withdraw(result: PublishResult) {
    const nextResult = createWithdrawnResult(result);
    setQueue((current) => replaceQueueItem(current, nextResult));
    setHistory((current) => {
      const next = prependHistory(current, nextResult);
      saveHistory(next);
      return next;
    });
    setNotice(`${result.platformLabel} 已完成模拟撤回`);
  }

  async function enhanceWithAi() {
    setAiBusy(true);
    setNotice("AI 正在重写内容");

    try {
      const response = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await response.json();

      if (!response.ok || !data.source) {
        setNotice(data.message ?? "AI 增强不可用，已保留本地内容");
        return;
      }

      setSource(data.source);
      setNotice("AI 增强已写入工作台");
    } catch {
      setNotice("AI 增强请求失败，已保留本地内容");
    } finally {
      setAiBusy(false);
    }
  }

  async function copyDraft(post: AdaptedPost) {
    try {
      await navigator.clipboard.writeText(createPlainDraft(post));
      setNotice(`${post.platformLabel} 草稿已复制`);
    } catch {
      setNotice("浏览器拒绝剪贴板访问，可改用下载草稿");
    }
  }

  function downloadDraft(post: AdaptedPost) {
    downloadTextFile(createDraftFilename(post), serializeDraftPackage(post));
    setNotice(`${post.platformLabel} 草稿包已下载`);
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
    setNotice("发布历史已清空");
  }

  return (
    <main className="app-shell">
      <section className="work-surface mx-auto max-w-[1580px] overflow-hidden">
        <header className="border-b-2 border-[#171717] bg-[#f1d46b] px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em]">
                <Layers className="h-4 w-4" />
                All Right
              </div>
              <h1 className="mt-1 text-2xl font-black md:text-4xl">
                多平台内容发布工作台
              </h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              <button
                className={clsx(
                  "pressed-shadow border-2 border-[#171717] px-4 py-2 text-sm font-black",
                  view === "workspace" ? "bg-[#0f7b73] text-white" : "bg-[#fffaf0]",
                )}
                onClick={() => setView("workspace")}
              >
                工作台
              </button>
              <button
                className={clsx(
                  "pressed-shadow border-2 border-[#171717] px-4 py-2 text-sm font-black",
                  view === "architecture" ? "bg-[#0f7b73] text-white" : "bg-[#fffaf0]",
                )}
                onClick={() => setView("architecture")}
              >
                扩展架构
              </button>
            </nav>
          </div>
        </header>

        {view === "workspace" ? (
          <WorkspaceView
            source={source}
            updateSource={updateSource}
            selectedPlatforms={selectedPlatforms}
            activePlatform={activePlatform}
            setActivePlatform={setActivePlatform}
            togglePlatform={togglePlatform}
            adaptedPosts={adaptedPosts}
            activePost={activePost}
            tagDraft={tagDraft}
            setTagDraft={setTagDraft}
            addTag={addTag}
            removeTag={removeTag}
            handleTagKeyDown={handleTagKeyDown}
            topic={topic}
            setTopic={setTopic}
            ideas={ideas}
            publishAll={publishAll}
            queue={queue}
            history={history}
            retry={retry}
            withdraw={withdraw}
            aiEnabled={aiEnabled}
            aiBusy={aiBusy}
            enhanceWithAi={enhanceWithAi}
            notice={notice}
            warningCount={warningCount}
            copyDraft={copyDraft}
            downloadDraft={downloadDraft}
            clearHistory={clearHistory}
          />
        ) : (
          <ArchitectureView />
        )}
      </section>
    </main>
  );
}

interface WorkspaceViewProps {
  source: SourceContent;
  updateSource: (patch: Partial<SourceContent>) => void;
  selectedPlatforms: PlatformId[];
  activePlatform: PlatformId;
  setActivePlatform: (platformId: PlatformId) => void;
  togglePlatform: (platformId: PlatformId) => void;
  adaptedPosts: AdaptedPost[];
  activePost?: AdaptedPost;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  addTag: (value: string) => void;
  removeTag: (tag: string) => void;
  handleTagKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  topic: string;
  setTopic: (value: string) => void;
  ideas: Array<{ title: string; outline: string }>;
  publishAll: () => Promise<void>;
  queue: PublishResult[];
  history: PublishResult[];
  retry: (result: PublishResult) => Promise<void>;
  withdraw: (result: PublishResult) => void;
  aiEnabled: boolean;
  aiBusy: boolean;
  enhanceWithAi: () => Promise<void>;
  notice: string;
  warningCount: number;
  copyDraft: (post: AdaptedPost) => Promise<void>;
  downloadDraft: (post: AdaptedPost) => void;
  clearHistory: () => void;
}

function WorkspaceView(props: WorkspaceViewProps) {
  const publishDisabled =
    props.selectedPlatforms.length === 0 ||
    props.queue.some((item) => item.status === "running");

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[380px_minmax(420px,1fr)_380px]">
      <aside className="space-y-4">
        <Panel title="源内容" icon={<PenLine className="h-4 w-4" />}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase text-[#66645d]">
                标题
              </span>
              <input
                className="field"
                value={props.source.title}
                onChange={(event) => props.updateSource({ title: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase text-[#66645d]">
                正文 Markdown
              </span>
              <textarea
                className="field min-h-[320px]"
                value={props.source.body}
                onChange={(event) => props.updateSource({ body: event.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-[#66645d]">
                  语气
                </span>
                <select
                  className="field"
                  value={props.source.tone}
                  onChange={(event) =>
                    props.updateSource({ tone: event.target.value as ContentTone })
                  }
                >
                  {toneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-[#66645d]">
                  封面链接
                </span>
                <input
                  className="field"
                  value={props.source.coverUrl ?? ""}
                  onChange={(event) => props.updateSource({ coverUrl: event.target.value })}
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase text-[#66645d]">
                目标读者
              </span>
              <input
                className="field"
                value={props.source.audience}
                onChange={(event) => props.updateSource({ audience: event.target.value })}
              />
            </label>
          </div>
        </Panel>

        <Panel title="标签与选题" icon={<Tags className="h-4 w-4" />}>
          <div className="flex flex-wrap gap-2">
            {props.source.tags.map((tag) => (
              <button
                key={tag}
                className="border-2 border-[#171717] bg-[#d7e8df] px-2 py-1 text-xs font-bold"
                onClick={() => props.removeTag(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="field min-w-0"
              value={props.tagDraft}
              onChange={(event) => props.setTagDraft(event.target.value)}
              onKeyDown={props.handleTagKeyDown}
              placeholder="输入标签"
            />
            <button
              className="pressed-shadow border-2 border-[#171717] bg-[#f1d46b] px-3 text-sm font-black"
              onClick={() => props.addTag(props.tagDraft)}
            >
              添加
            </button>
          </div>
          <div className="mt-4 border-t-2 border-[#171717] pt-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[#66645d]">
              <Sparkles className="h-4 w-4" />
              热点输入
            </div>
            <input
              className="field"
              value={props.topic}
              onChange={(event) => props.setTopic(event.target.value)}
            />
            <div className="mt-3 space-y-2">
              {props.ideas.map((idea) => (
                <button
                  key={idea.title}
                  className="w-full border-2 border-[#171717] bg-[#fffdf7] p-3 text-left text-sm font-bold pressed-shadow"
                  onClick={() =>
                    props.updateSource({
                      title: idea.title,
                      body: `${idea.outline}\n\n${props.source.body}`,
                    })
                  }
                >
                  {idea.title}
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </aside>

      <section className="space-y-4">
        <Panel title="平台预览" icon={<FileText className="h-4 w-4" />}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {platformAdapters.map((adapter) => {
              const selected = props.selectedPlatforms.includes(adapter.id);
              const active = props.activePlatform === adapter.id;

              return (
                <div
                  key={adapter.id}
                  role="button"
                  tabIndex={0}
                  className={clsx(
                    "border-2 border-[#171717] p-3 text-left pressed-shadow",
                    selected ? "bg-[#e2f0ec]" : "bg-[#fffdf7] opacity-65",
                    active && "outline outline-4 outline-[#d85030]",
                  )}
                  onClick={() => {
                    if (!selected) props.togglePlatform(adapter.id);
                    props.setActivePlatform(adapter.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (!selected) props.togglePlatform(adapter.id);
                    props.setActivePlatform(adapter.id);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black">{adapter.shortLabel}</span>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => props.togglePlatform(adapter.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`${adapter.label} 目标平台`}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#66645d]">
                    {adapter.description}
                  </p>
                </div>
              );
            })}
          </div>

          {props.activePost ? (
            <PreviewPane
              post={props.activePost}
              onCopy={() => props.copyDraft(props.activePost as AdaptedPost)}
              onDownload={() => props.downloadDraft(props.activePost as AdaptedPost)}
            />
          ) : (
            <div className="mt-4 border-2 border-dashed border-[#171717] p-8 text-center font-bold text-[#66645d]">
              未选择目标平台
            </div>
          )}
        </Panel>
      </section>

      <aside className="space-y-4">
        <Panel title="发布控制" icon={<Rocket className="h-4 w-4" />}>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="平台" value={String(props.selectedPlatforms.length)} />
            <Metric label="风险" value={String(props.warningCount)} />
            <Metric label="队列" value={String(props.queue.length)} />
          </div>
          <div className="mt-3 rounded-none border-2 border-[#171717] bg-[#fffdf7] p-3 text-sm font-bold">
            {props.notice}
          </div>
          {props.aiEnabled ? (
            <button
              className="pressed-shadow mt-3 flex w-full items-center justify-center gap-2 border-2 border-[#171717] bg-[#0f7b73] px-4 py-3 font-black text-white"
              onClick={props.enhanceWithAi}
              disabled={props.aiBusy}
            >
              {props.aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              AI 改写增强
            </button>
          ) : (
            <div className="mt-3 flex items-center gap-2 border-2 border-[#171717] bg-[#eee8da] p-3 text-sm font-bold">
              <Bot className="h-4 w-4 shrink-0" />
              规则模板模式
            </div>
          )}
          <button
            className="pressed-shadow mt-3 flex w-full items-center justify-center gap-2 border-2 border-[#171717] bg-[#d85030] px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={props.publishAll}
            disabled={publishDisabled}
          >
            <Rocket className="h-4 w-4" />
            一键模拟发布
          </button>
        </Panel>

        <Panel title="发布队列" icon={<ClipboardList className="h-4 w-4" />}>
          {props.queue.length === 0 ? (
            <EmptyState text="暂无发布任务" />
          ) : (
            <div className="space-y-2">
              {props.queue.map((item) => (
                <LogRow
                  key={item.id}
                  item={item}
                  onRetry={() => props.retry(item)}
                  onWithdraw={() => props.withdraw(item)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="历史记录" icon={<History className="h-4 w-4" />}>
          {props.history.length === 0 ? (
            <EmptyState text="暂无历史记录" />
          ) : (
            <div className="space-y-3">
              <button
                className="pressed-shadow flex w-full items-center justify-center gap-2 border-2 border-[#171717] bg-[#eee8da] px-3 py-2 text-sm font-black"
                onClick={props.clearHistory}
              >
                <Trash2 className="h-4 w-4" />
                清空历史
              </button>
              <div className="space-y-2">
                {props.history.slice(0, 5).map((item) => (
                  <div
                    key={`${item.id}-${item.createdAt}`}
                    className="border-2 border-[#171717] bg-[#fffdf7] p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-black">
                      <span>{item.platformLabel}</span>
                      <StatusPill status={item.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-bold text-[#66645d]">
                      {item.title}
                    </p>
                    {canWithdraw(item) ? (
                      <button
                        className="pressed-shadow mt-3 flex items-center gap-2 border-2 border-[#171717] bg-[#eee8da] px-3 py-2 text-xs font-black"
                        onClick={() => props.withdraw(item)}
                      >
                        <Undo2 className="h-4 w-4" />
                        模拟撤回
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </aside>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="tool-panel">
      <div className="flex items-center gap-2 border-b-2 border-[#171717] bg-[#171717] px-3 py-2 text-sm font-black text-[#fffaf0]">
        {icon}
        {title}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-[#171717] bg-[#fffdf7] p-3">
      <div className="text-xs font-black text-[#66645d]">{label}</div>
      <div className="text-2xl font-black">{value}</div>
    </div>
  );
}

function PreviewPane({
  post,
  onCopy,
  onDownload,
}: {
  post: AdaptedPost;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const adapter = adapterRegistry[post.platformId];

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article className="border-2 border-[#171717] bg-[#fffdf7]">
        <div className="border-b-2 border-[#171717] bg-[#e2f0ec] p-4">
          <div className="mb-2 text-xs font-black uppercase text-[#66645d]">
            {post.platformLabel} 草稿预览
          </div>
          <h2 className="text-2xl font-black leading-tight">{post.title}</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#66645d]">{post.summary}</p>
        </div>
        <div className="preview-copy max-h-[640px] overflow-auto p-4">
          <Markdownish text={post.body} />
        </div>
      </article>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            className="pressed-shadow flex items-center justify-center gap-2 border-2 border-[#171717] bg-[#f1d46b] px-3 py-2 text-sm font-black"
            onClick={onCopy}
          >
            <Copy className="h-4 w-4" />
            复制
          </button>
          <button
            className="pressed-shadow flex items-center justify-center gap-2 border-2 border-[#171717] bg-[#0f7b73] px-3 py-2 text-sm font-black text-white"
            onClick={onDownload}
          >
            <Download className="h-4 w-4" />
            导出
          </button>
        </div>
        <div className="border-2 border-[#171717] bg-[#fffdf7] p-3">
          <div className="text-xs font-black uppercase text-[#66645d]">统计</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric label="字数" value={String(post.wordCount)} />
            <Metric label="阅读" value={`${post.readingTimeMinutes}m`} />
          </div>
        </div>
        <div className="border-2 border-[#171717] bg-[#fffdf7] p-3">
          <div className="mb-2 text-xs font-black uppercase text-[#66645d]">平台约束</div>
          <div className="space-y-1 text-sm font-bold leading-6">
            <div>标题上限：{adapter.constraints.titleMax} 字</div>
            <div>正文建议：{adapter.constraints.bodyMax} 字内</div>
            <div>
              标签数量：{adapter.constraints.minTags}-{adapter.constraints.maxTags} 个
            </div>
            <div>格式：{adapter.constraints.preferredFormat}</div>
          </div>
        </div>
        <div className="border-2 border-[#171717] bg-[#fffdf7] p-3">
          <div className="mb-2 text-xs font-black uppercase text-[#66645d]">标签</div>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="border-2 border-[#171717] bg-[#f1d46b] px-2 py-1 text-xs font-black"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="border-2 border-[#171717] bg-[#fffdf7] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[#66645d]">
            <AlertCircle className="h-4 w-4" />
            风险提示
          </div>
          {post.warnings.length === 0 ? (
            <p className="text-sm font-bold text-[#1d7f4f]">当前草稿通过基础校验</p>
          ) : (
            <ul className="space-y-2 text-sm font-bold text-[#b43a31]">
              {post.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div>
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        if (!line.trim()) return <div key={key} className="h-3" />;
        if (line.startsWith("## ")) {
          return (
            <h2 key={key} className="text-xl">
              {line.replace(/^##\s+/, "")}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={key} className="text-2xl">
              {line.replace(/^#\s+/, "")}
            </h1>
          );
        }
        if (line.startsWith("> ")) {
          return (
            <p key={key} className="border-l-4 border-[#0f7b73] bg-[#e2f0ec] p-3 font-bold">
              {line.replace(/^>\s+/, "")}
            </p>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <p key={key} className="pl-4">
              <span className="font-black">• </span>
              {line.replace(/^-\s+/, "")}
            </p>
          );
        }
        if (/^\d+\.\s+/.test(line)) {
          return (
            <p key={key} className="pl-4 font-bold">
              {line}
            </p>
          );
        }
        if (line === "---") {
          return <hr key={key} className="my-4 border-t-2 border-[#171717]" />;
        }

        return <p key={key}>{line}</p>;
      })}
    </div>
  );
}

function StatusPill({ status }: { status: PublishResult["status"] }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 border-2 border-[#171717] px-2 py-1 text-xs font-black",
        status === "success" && "bg-[#d7e8df] text-[#1d7f4f]",
        status === "failed" && "bg-[#f7d5cd] text-[#b43a31]",
        status === "withdrawn" && "bg-[#eee8da] text-[#66645d]",
        status === "running" && "bg-[#f1d46b]",
        status === "pending" && "bg-[#eee8da]",
      )}
    >
      {statusIcon(status)}
      {statusLabel(status)}
    </span>
  );
}

function LogRow({
  item,
  onRetry,
  onWithdraw,
}: {
  item: PublishResult;
  onRetry: () => void;
  onWithdraw: () => void;
}) {
  return (
    <div className="border-2 border-[#171717] bg-[#fffdf7] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-black">{item.platformLabel}</div>
          <div className="mt-1 text-xs font-bold text-[#66645d]">{item.title}</div>
        </div>
        <StatusPill status={item.status} />
      </div>
      <div className="mt-3 space-y-1 border-t-2 border-[#171717] pt-2">
        {item.logs.map((log) => (
          <div key={log} className="flex items-center gap-2 text-xs font-bold text-[#66645d]">
            <ArrowRight className="h-3 w-3" />
            {log}
          </div>
        ))}
      </div>
      {canRetry(item) ? (
        <button
          className="pressed-shadow mt-3 flex items-center gap-2 border-2 border-[#171717] bg-[#f1d46b] px-3 py-2 text-sm font-black"
          onClick={onRetry}
        >
          <RotateCcw className="h-4 w-4" />
          重试
        </button>
      ) : null}
      {canWithdraw(item) ? (
        <button
          className="pressed-shadow mt-3 flex items-center gap-2 border-2 border-[#171717] bg-[#eee8da] px-3 py-2 text-sm font-black"
          onClick={onWithdraw}
        >
          <Undo2 className="h-4 w-4" />
          模拟撤回
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border-2 border-dashed border-[#171717] bg-[#fffdf7] p-6 text-center text-sm font-bold text-[#66645d]">
      {text}
    </div>
  );
}

function ArchitectureView() {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <Panel title="适配器流水线" icon={<Network className="h-4 w-4" />}>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["SourceContent", "统一输入"],
              ["PlatformAdapter", "平台规则"],
              ["AdaptedPost", "草稿预览"],
              ["PublishResult", "队列与回撤"],
            ].map(([title, text], index) => (
              <div key={title} className="border-2 border-[#171717] bg-[#fffdf7] p-4">
                <div className="text-3xl font-black text-[#d85030]">0{index + 1}</div>
                <div className="mt-3 font-black">{title}</div>
                <div className="mt-1 text-sm font-bold text-[#66645d]">{text}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="新增平台模板" icon={<PlugZap className="h-4 w-4" />}>
          <pre className="overflow-auto border-2 border-[#171717] bg-[#171717] p-4 text-sm leading-6 text-[#fffaf0]">
            {`export const newPlatform: PlatformAdapter = {
  id: "new-platform",
  label: "新平台",
  capabilities,
  constraints,
  adapt(source) {
    return createPost(...);
  },
  validate(post) {
    return buildWarnings(post, constraints);
  },
  publish(post) {
    return simulatePublish(post);
  }
};`}
          </pre>
        </Panel>

        <Panel title="真实发布接入" icon={<Rocket className="h-4 w-4" />}>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["浏览器自动化", "Playwright 使用用户本地登录态，把草稿写入平台编辑器。"],
              ["Wechatsync CLI/MCP", "复用成熟浏览器扩展通道，草稿优先，避免账号密码流转。"],
              ["平台开放 API", "优先接官方 API，失败时回落到模拟发布或草稿下载。"],
            ].map(([title, text]) => (
              <div key={title} className="border-2 border-[#171717] bg-[#fffdf7] p-4">
                <div className="font-black">{title}</div>
                <p className="mt-2 text-sm font-bold leading-6 text-[#66645d]">{text}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="发布后操作" icon={<Undo2 className="h-4 w-4" />}>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["edit", "允许平台草稿覆盖或发布后编辑时才开放。"],
              ["withdraw", "允许撤回、下架或删除远端帖子时才开放。"],
              ["delete", "用于清理远端草稿或发布记录，默认不强行承诺。"],
            ].map(([title, text]) => (
              <div key={title} className="border-2 border-[#171717] bg-[#fffdf7] p-4">
                <div className="font-black">{title}</div>
                <p className="mt-2 text-sm font-bold leading-6 text-[#66645d]">{text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <aside className="space-y-4">
        <Panel title="三天交付边界" icon={<ClipboardList className="h-4 w-4" />}>
          <ol className="space-y-3 text-sm font-bold leading-6">
            <li>Day 1：项目骨架、工作台、适配器框架。</li>
            <li>Day 2：四个平台规则、预览、发布队列。</li>
            <li>Day 3：README、测试、演示脚本和架构说明。</li>
          </ol>
        </Panel>
        <Panel title="二期能力" icon={<Sparkles className="h-4 w-4" />}>
          <div className="space-y-2 text-sm font-bold leading-6">
            <p>多账号配置、定时发布、素材库、发布后数据回收。</p>
            <p>热点监控输入源、批量选题生成、平台表现对比。</p>
            <p>真实草稿发布、审核前人工确认、风控失败恢复。</p>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
