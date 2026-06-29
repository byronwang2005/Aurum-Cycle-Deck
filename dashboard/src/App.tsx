import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChartBar,
  Gauge,
  Network,
  PresentationChart,
  Strategy,
  TrendDown,
  TrendUp
} from "@phosphor-icons/react";

type NamedValue = { name: string; value: number };
type SourceSnippet = { page: number; text: string };
type Source = {
  institution: string;
  date: string;
  title: string;
  snippets: SourceSnippet[];
};

type Conclusion = { question: string; answer: string; proof: string };
type Framework = {
  asset: string;
  role: string;
  variables: { name: string; weight: number; direction: string; horizon: string }[];
  conclusion: string;
};
type HikePhase = { phase: string; gold: string; silver: string; signals: string; exception: string };
type CutType = { type: string; gold: string; silver: string; platinumPalladium: string; caveat: string };
type CrashCase = {
  caseName: string;
  cycle: string;
  narrative: string;
  trigger: string;
  earlySignals: string[];
  severity: number;
};
type RiskWeight = { signal: string; weight: number; layer: string };
type StageSignal = { name: string; strength: number; evidence: string };
type StrategyCard = { asset: string; position: string; logic: string; useWhen: string; exitWhen: string };

type DashboardData = {
  summary: {
    reportCount: number;
    totalPages: number;
    totalChars: number;
    coreCount: number;
    coreShare: number;
    latestDate: string;
  };
  narrative: {
    thesis: string;
    boundary: string;
  };
  presentation: {
    onePageConclusions: Conclusion[];
    pricingFramework: Framework[];
    rateHikeCycle: HikePhase[];
    rateCutCycle: CutType[];
    historicalCrashes: CrashCase[];
    riskScoreWeights: RiskWeight[];
    currentStageSignals: StageSignal[];
    strategyCards: StrategyCard[];
    coverageStats: {
      layers: NamedValue[];
      years: NamedValue[];
      institutions: NamedValue[];
      objects: NamedValue[];
      factors: NamedValue[];
      topics: NamedValue[];
      summary: {
        reports: number;
        pages: number;
        chars: number;
        latestDate: string;
        coreShare: number;
      };
    };
    sourcesByPage: Record<string, Source[]>;
  };
};

const formatter = new Intl.NumberFormat("zh-CN");
const percent = new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 });

function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/data/dashboard-data.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "数据加载失败"));
  }, []);

  return { data, error };
}

function theme() {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#d8d5cb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    color: ["#d9b35f", "#aeb5bc", "#8fb4a1", "#b88a6c", "#80786a"]
  };
}

function tooltip() {
  return {
    backgroundColor: "#14120f",
    borderColor: "rgba(217,179,95,0.32)",
    textStyle: { color: "#f7f0df" }
  };
}

function variableNetworkOption() {
  const nodes = [
    { name: "黄金", symbolSize: 78, category: 0 },
    { name: "实际利率", symbolSize: 58, category: 1 },
    { name: "美元信用", symbolSize: 56, category: 2 },
    { name: "Fed 预期", symbolSize: 48, category: 1 },
    { name: "央行购金", symbolSize: 50, category: 2 },
    { name: "地缘风险", symbolSize: 42, category: 2 },
    { name: "ETF/CFTC", symbolSize: 42, category: 3 },
    { name: "流动性", symbolSize: 40, category: 3 },
    { name: "白银工业需求", symbolSize: 46, category: 4 },
    { name: "金银比", symbolSize: 38, category: 4 },
    { name: "铂钯产业供需", symbolSize: 44, category: 5 }
  ];
  const linkData = [
    ["实际利率", "黄金", 8],
    ["美元信用", "黄金", 8],
    ["Fed 预期", "实际利率", 7],
    ["央行购金", "美元信用", 6],
    ["央行购金", "黄金", 7],
    ["地缘风险", "黄金", 6],
    ["ETF/CFTC", "黄金", 5],
    ["流动性", "ETF/CFTC", 5],
    ["黄金", "金银比", 5],
    ["白银工业需求", "金银比", 4],
    ["流动性", "白银工业需求", 4],
    ["铂钯产业供需", "流动性", 2]
  ];
  return {
    ...theme(),
    tooltip: { ...tooltip(), trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#9e998e" } },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        categories: [
          { name: "资产" },
          { name: "利率变量" },
          { name: "信用慢变量" },
          { name: "交易变量" },
          { name: "白银变量" },
          { name: "产业变量" }
        ],
        force: { repulsion: 420, edgeLength: [80, 180], gravity: 0.08 },
        label: { show: true, color: "#f5eddd", fontSize: 12 },
        lineStyle: { color: "source", opacity: 0.38, width: 1.6, curveness: 0.12 },
        emphasis: { focus: "adjacency", lineStyle: { opacity: 0.86, width: 3 } },
        data: nodes,
        links: linkData.map(([source, target, value]) => ({ source, target, value }))
      }
    ]
  };
}

function barOption(items: NamedValue[], horizontal = true) {
  const data = [...items].slice(0, 12);
  if (horizontal) data.reverse();
  return {
    ...theme(),
    tooltip: { ...tooltip(), trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 14, right: 18, top: 28, bottom: 22, containLabel: true },
    xAxis: horizontal
      ? { type: "value", splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }, axisLabel: { color: "#8f8a80" } }
      : { type: "category", data: data.map((i) => i.name), axisLabel: { color: "#9e998e" }, axisTick: { show: false } },
    yAxis: horizontal
      ? { type: "category", data: data.map((i) => i.name), axisLabel: { color: "#d8d1c2", fontSize: 11 }, axisTick: { show: false } }
      : { type: "value", splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }, axisLabel: { color: "#8f8a80" } },
    series: [
      {
        type: "bar",
        data: data.map((i) => i.value),
        barWidth: horizontal ? 12 : 18,
        itemStyle: {
          borderRadius: horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: "rgba(217,179,95,0.35)" },
              { offset: 1, color: "#d9b35f" }
            ]
          }
        }
      }
    ]
  };
}

function lineOption(items: NamedValue[]) {
  return {
    ...theme(),
    tooltip: { ...tooltip(), trigger: "axis" },
    grid: { left: 14, right: 20, top: 24, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: items.map((i) => i.name), axisTick: { show: false }, axisLabel: { color: "#9e998e" } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }, axisLabel: { color: "#8f8a80" } },
    series: [
      {
        type: "line",
        data: items.map((i) => i.value),
        smooth: true,
        symbolSize: 8,
        lineStyle: { color: "#d9b35f", width: 3 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(217,179,95,0.3)" },
              { offset: 1, color: "rgba(217,179,95,0.02)" }
            ]
          }
        }
      }
    ]
  };
}

function radarOption(frameworks: Framework[]) {
  const indicators = ["利率/美元", "信用慢变量", "交易拥挤", "工业需求", "供给/库存"].map((name) => ({ name, max: 100 }));
  const values: Record<string, number[]> = {
    黄金: [92, 88, 66, 26, 32],
    白银: [72, 38, 68, 76, 42],
    铂钯: [34, 28, 36, 84, 76]
  };
  return {
    ...theme(),
    tooltip: tooltip(),
    legend: { bottom: 0, textStyle: { color: "#9e998e" } },
    radar: {
      indicator: indicators,
      radius: "64%",
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
      splitArea: { areaStyle: { color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.045)"] } },
      axisName: { color: "#d8d1c2" }
    },
    series: [
      {
        type: "radar",
        data: frameworks.map((item) => ({ name: item.asset, value: values[item.asset] || [50, 50, 50, 50, 50] })),
        areaStyle: { opacity: 0.12 },
        lineStyle: { width: 2 }
      }
    ]
  };
}

function riskGaugeOption(score: number) {
  return {
    ...theme(),
    series: [
      {
        type: "gauge",
        min: 0,
        max: 100,
        radius: "92%",
        progress: { show: true, width: 16, itemStyle: { color: "#d9b35f" } },
        axisLine: { lineStyle: { width: 16, color: [[0.3, "#314236"], [0.6, "#766b3a"], [0.8, "#8d5435"], [1, "#8c352f"]] } },
        axisTick: { show: false },
        splitLine: { distance: 2, length: 10, lineStyle: { color: "rgba(255,255,255,0.42)" } },
        axisLabel: { color: "#9e998e", distance: 24 },
        pointer: { width: 5, itemStyle: { color: "#f4d98f" } },
        detail: { valueAnimation: true, formatter: "{value}", color: "#f4d98f", fontSize: 44, offsetCenter: [0, "66%"] },
        data: [{ value: score, name: "样本内提示" }],
        title: { color: "#d8d1c2", offsetCenter: [0, "38%"] }
      }
    ]
  };
}

function sankeyOption(cuts: CutType[]) {
  const nodes = [
    { name: "降息" },
    ...cuts.map((c) => ({ name: c.type })),
    { name: "黄金偏强" },
    { name: "黄金先跌后涨" },
    { name: "白银弹性更大" },
    { name: "产业需求受损" }
  ];
  const links = [
    { source: "降息", target: "预防式降息", value: 5 },
    { source: "降息", target: "衰退式降息", value: 5 },
    { source: "降息", target: "通胀回落后降息", value: 4 },
    { source: "降息", target: "金融危机降息", value: 4 },
    { source: "预防式降息", target: "黄金偏强", value: 4 },
    { source: "预防式降息", target: "白银弹性更大", value: 4 },
    { source: "衰退式降息", target: "黄金先跌后涨", value: 4 },
    { source: "衰退式降息", target: "产业需求受损", value: 3 },
    { source: "金融危机降息", target: "黄金先跌后涨", value: 4 },
    { source: "金融危机降息", target: "白银弹性更大", value: 2 },
    { source: "通胀回落后降息", target: "黄金偏强", value: 2 }
  ];
  return {
    ...theme(),
    tooltip: tooltip(),
    series: [
      {
        type: "sankey",
        nodeWidth: 14,
        nodeGap: 18,
        draggable: true,
        label: { color: "#f4ecdc", fontSize: 12 },
        lineStyle: { color: "gradient", curveness: 0.52, opacity: 0.34 },
        itemStyle: { borderColor: "rgba(255,255,255,0.16)", borderWidth: 1 },
        data: nodes,
        links
      }
    ]
  };
}

function crashBubbleOption(cases: CrashCase[]) {
  const ordered = [...cases].reverse();
  return {
    ...theme(),
    tooltip: {
      ...tooltip(),
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
        const point = params[0];
        const item = ordered[point.dataIndex];
        return `${item.caseName}<br/>周期位置：${item.cycle}<br/>严重度：${point.value}<br/>触发：${item.trigger}`;
      }
    },
    grid: { left: 14, right: 42, top: 24, bottom: 16, containLabel: true },
    xAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      axisLabel: { color: "#8f8a80" }
    },
    yAxis: {
      type: "category",
      data: ordered.map((c) => c.caseName),
      axisLabel: { color: "#d8d1c2", fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false }
    },
    series: [
      {
        type: "bar",
        barWidth: 18,
        data: ordered.map((c) => c.severity),
        label: {
          show: true,
          position: "right",
          color: "#f4d98f",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
        },
        itemStyle: {
          borderRadius: [0, 12, 12, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: "rgba(174,181,188,0.35)" },
              { offset: 0.62, color: "rgba(217,179,95,0.72)" },
              { offset: 1, color: "#c16b51" }
            ]
          }
        }
      }
    ]
  };
}

function SourceFold({ sources }: { sources?: Source[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <details className="sourceFold">
      <summary>证据来源</summary>
      <div className="sourceGrid">
        {sources.map((source) => (
          <article key={`${source.institution}-${source.date}-${source.title}`}>
            <span>
              {source.institution} / {source.date}
            </span>
            <h4>{source.title}</h4>
            {source.snippets.map((snippet) => (
              <p key={`${source.title}-${snippet.page}`}>p{snippet.page}: {snippet.text}</p>
            ))}
          </article>
        ))}
      </div>
    </details>
  );
}

function ChartBox({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="chartBox">
      <div className="chartTitle">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function App() {
  const { data, error } = useDashboardData();
  const [page, setPage] = useState(0);
  const reduced = useReducedMotion();

  const pages = useMemo(
    () => [
      "封面",
      "一页纸结论",
      "定价框架",
      "加息周期",
      "降息周期",
      "历史大调整",
      "大回撤预警",
      "样本阶段",
      "策略",
      "数据附录"
    ],
    []
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") setPage((value) => Math.min(value + 1, pages.length - 1));
      if (event.key === "ArrowLeft" || event.key === "PageUp") setPage((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  const go = (next: number) => setPage(Math.max(0, Math.min(next, pages.length - 1)));

  if (error) {
    return (
      <main className="deckShell">
        <div className="loadingState">
          <h1>数据加载失败</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="deckShell">
        <div className="loadingState">
          <div className="loaderLine" />
          <p>正在装载汇报材料。</p>
        </div>
      </main>
    );
  }

  const p = data.presentation;
  const sampleDrawdownRisk =
    p.currentStageSignals.find((item) => item.name === "样本内拥挤风险")?.strength ?? 70;

  const slideProps = {
    initial: reduced ? false : { opacity: 0, y: 28, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduced ? undefined : { opacity: 0, y: -20, filter: "blur(8px)" },
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const }
  };

  return (
    <main className="deckShell">
      <div className="grain" />
      <aside className="pageRail" aria-label="分页导航">
        <div className="railBrand">
          <img src="/assets/jhss-logo-cropped.png" alt="JHSS" />
        </div>
        {pages.map((label, index) => (
          <button key={label} className={page === index ? "active" : ""} onClick={() => go(index)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </aside>

      <AnimatePresence mode="wait">
        <motion.section className="slide" key={page} {...slideProps}>
          {page === 0 && (
            <div className="coverGrid">
              <div className="coverCopy">
                <span className="eyebrow">本地研报归纳汇报</span>
                <h1>贵金属周期与风险框架</h1>
                <p>{data.narrative.thesis}</p>
                <div className="coverActions">
                  <button onClick={() => go(1)} className="primaryButton">
                    开始汇报
                    <span><ArrowRight size={16} weight="bold" /></span>
                  </button>
                </div>
              </div>
              <div className="coverVisual">
                <div className="orbit one" />
                <div className="orbit two" />
                <div className="coverMetric main">
                  <span>报告样本</span>
                  <strong>{formatter.format(data.summary.reportCount)}</strong>
                  <small>份结构化研报</small>
                </div>
                <div className="coverMetric">
                  <span>覆盖页数</span>
                  <strong>{formatter.format(data.summary.totalPages)}</strong>
                  <small>页研报文本</small>
                </div>
                <div className="coverMetric third">
                  <span>样本边界</span>
                  <strong>{data.summary.latestDate}</strong>
                  <small>不含实时行情</small>
                </div>
              </div>
              <SourceFold sources={p.sourcesByPage.conclusion} />
            </div>
          )}

          {page === 1 && (
            <div className="slideStack">
              <SlideHeader title="一页纸结论" subtitle="汇总本次研报归纳形成的核心判断，后续章节展开变量框架、周期规律与风险证据。" />
              <div className="conclusionGrid">
                {p.onePageConclusions.map((item) => (
                  <article className="conclusionTile" key={item.question}>
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                    <small>{item.proof}</small>
                  </article>
                ))}
              </div>
              <SourceFold sources={p.sourcesByPage.conclusion} />
            </div>
          )}

          {page === 2 && (
            <div className="slideStack">
              <SlideHeader title="定价框架" subtitle="黄金是宏观和信用锚，白银是双 beta，铂钯回到产业供需。" />
              <div className="twoColumn">
                <ChartBox title="变量关系网络" icon={<Network size={20} weight="duotone" />}>
                  <ReactECharts option={variableNetworkOption()} style={{ height: 470 }} />
                </ChartBox>
                <ChartBox title="三类资产敏感度" icon={<PresentationChart size={20} weight="duotone" />}>
                  <ReactECharts option={radarOption(p.pricingFramework)} style={{ height: 470 }} />
                </ChartBox>
              </div>
              <div className="frameworkCards">
                {p.pricingFramework.map((framework) => (
                  <article key={framework.asset}>
                    <span>{framework.asset}</span>
                    <h3>{framework.role}</h3>
                    <p>{framework.conclusion}</p>
                    <div>
                      {framework.variables.slice(0, 4).map((variable) => (
                        <small key={variable.name}>{variable.name} {variable.weight}</small>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <SourceFold sources={p.sourcesByPage.pricing} />
            </div>
          )}

          {page === 3 && (
            <div className="slideStack">
              <SlideHeader title="加息周期" subtitle="加息动作本身不是核心，真正危险的是实际利率、美元和流动性同向收紧。" />
              <div className="timelineGrid">
                {p.rateHikeCycle.map((phase, index) => (
                  <article key={phase.phase} className="timelineCard">
                    <span>{index + 1}</span>
                    <h3>{phase.phase}</h3>
                    <p><strong>黄金：</strong>{phase.gold}</p>
                    <p><strong>白银：</strong>{phase.silver}</p>
                    <p><strong>观察：</strong>{phase.signals}</p>
                    <small>{phase.exception}</small>
                  </article>
                ))}
              </div>
              <ChartBox title="加息期风险顺序" icon={<TrendUp size={20} weight="duotone" />}>
                <ReactECharts
                  option={barOption(p.rateHikeCycle.map((item, index) => ({ name: item.phase, value: [52, 66, 92, 48, 58][index] })), false)}
                  style={{ height: 310 }}
                />
              </ChartBox>
              <SourceFold sources={p.sourcesByPage.hike} />
            </div>
          )}

          {page === 4 && (
            <div className="slideStack">
              <SlideHeader title="降息周期" subtitle="降息不是同一种交易。预防式、衰退式和危机式的路径完全不同。" />
              <div className="twoColumn wideLeft">
                <ChartBox title="降息类型传导" icon={<TrendDown size={20} weight="duotone" />}>
                  <ReactECharts option={sankeyOption(p.rateCutCycle)} style={{ height: 500 }} />
                </ChartBox>
                <div className="cutCards">
                  {p.rateCutCycle.map((item) => (
                    <article key={item.type}>
                      <h3>{item.type}</h3>
                      <p><strong>黄金：</strong>{item.gold}</p>
                      <p><strong>白银：</strong>{item.silver}</p>
                      <p><strong>铂钯：</strong>{item.platinumPalladium}</p>
                      <small>{item.caveat}</small>
                    </article>
                  ))}
                </div>
              </div>
              <SourceFold sources={p.sourcesByPage.cut} />
            </div>
          )}

          {page === 5 && (
            <div className="slideStack">
              <SlideHeader title="历史大调整" subtitle="大崩盘不是突然发生，通常能提前看到宏观反向、资金拥挤和技术破位的组合。" />
              <ChartBox title="历史案例严重度" icon={<ChartBar size={20} weight="duotone" />}>
                <ReactECharts option={crashBubbleOption(p.historicalCrashes)} style={{ height: 330 }} />
              </ChartBox>
              <div className="crashGrid">
                {p.historicalCrashes.map((item) => (
                  <article key={item.caseName}>
                    <div>
                      <span>{item.cycle}</span>
                      <strong>{item.severity}</strong>
                    </div>
                    <h3>{item.caseName}</h3>
                    <p>{item.trigger}</p>
                    <ul>
                      {item.earlySignals.map((signal) => <li key={signal}>{signal}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
              <SourceFold sources={p.sourcesByPage.crash} />
            </div>
          )}

          {page === 6 && (
            <div className="slideStack">
              <SlideHeader title="大回撤预警" subtitle="把宏观、资金、波动和技术信号合成 0-100 分风险评分，而不是等回撤后找理由。" />
              <ChartBox title="风险权重拆解" icon={<ChartBar size={20} weight="duotone" />}>
                <ReactECharts option={barOption(p.riskScoreWeights.map((i) => ({ name: i.signal, value: i.weight })))} style={{ height: 440 }} />
              </ChartBox>
              <div className="signalBands">
                {["领先信号", "同步信号", "滞后/情绪信号", "确认信号"].map((layer) => (
                  <article key={layer}>
                    <h3>{layer}</h3>
                    {p.riskScoreWeights.filter((item) => item.layer === layer).map((item) => (
                      <p key={item.signal}><span>{item.weight}</span>{item.signal}</p>
                    ))}
                  </article>
                ))}
              </div>
              <SourceFold sources={p.sourcesByPage.risk} />
            </div>
          )}

          {page === 7 && (
            <div className="slideStack">
              <SlideHeader title="样本阶段推断" subtitle="仅基于截至 2026-03-03 的本地研报样本，不代表 2026-06-29 实时市场状态。" />
              <ChartBox title="样本内拥挤风险提示" icon={<Gauge size={20} weight="duotone" />}>
                <ReactECharts option={riskGaugeOption(sampleDrawdownRisk)} style={{ height: 360 }} />
              </ChartBox>
              <div className="stageGrid">
                {p.currentStageSignals.map((signal) => (
                  <article key={signal.name}>
                    <div className="stageMeter"><span style={{ width: `${signal.strength}%` }} /></div>
                    <strong>{signal.strength}</strong>
                    <h3>{signal.name}</h3>
                    <p>{signal.evidence}</p>
                  </article>
                ))}
              </div>
              <div className="stageCallout">
                <h3>归纳判断</h3>
                <p>样本内更接近降息预期交易期 + 高利率维持后段 + 贵金属牛市中段，局部带有大调整前期风险。实时判断需要补充今天的数据。</p>
              </div>
              <SourceFold sources={p.sourcesByPage.stage} />
            </div>
          )}

          {page === 8 && (
            <div className="slideStack">
              <SlideHeader title="策略页" subtitle="黄金做核心配置，白银做 beta 增强，铂钯做产业周期交易。" />
              <div className="strategyGrid">
                {p.strategyCards.map((item) => (
                  <article key={item.asset}>
                    <span>{item.asset}</span>
                    <h3>{item.position}</h3>
                    <p>{item.logic}</p>
                    <div>
                      <strong>适用环境</strong>
                      <p>{item.useWhen}</p>
                    </div>
                    <div>
                      <strong>退出条件</strong>
                      <p>{item.exitWhen}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {page === 9 && (
            <div className="slideStack">
              <SlideHeader title="数据附录" subtitle="展示本次归纳所依托的样本覆盖、变量命中和来源分布。" />
              <div className="appendixGrid">
                <ChartBox title="年份分布" icon={<ChartBar size={20} weight="duotone" />}>
                  <ReactECharts option={lineOption(p.coverageStats.years)} style={{ height: 300 }} />
                </ChartBox>
                <ChartBox title="变量命中" icon={<Network size={20} weight="duotone" />}>
                  <ReactECharts option={barOption(p.coverageStats.factors)} style={{ height: 300 }} />
                </ChartBox>
                <ChartBox title="研究对象覆盖" icon={<PresentationChart size={20} weight="duotone" />}>
                  <ReactECharts option={barOption(p.coverageStats.objects, false)} style={{ height: 300 }} />
                </ChartBox>
                <ChartBox title="机构来源 Top" icon={<Strategy size={20} weight="duotone" />}>
                  <ReactECharts option={barOption(p.coverageStats.institutions)} style={{ height: 300 }} />
                </ChartBox>
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      <footer className="deckControls">
        <button onClick={() => go(page - 1)} disabled={page === 0}>
          <ArrowLeft size={16} weight="bold" />
          上一页
        </button>
        <div>
          <span>{page + 1}</span>
          <small>/ {pages.length}</small>
        </div>
        <button onClick={() => go(page + 1)} disabled={page === pages.length - 1}>
          下一页
          <ArrowRight size={16} weight="bold" />
        </button>
      </footer>
    </main>
  );
}

function SlideHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="slideHeader">
      <span className="eyebrow">归纳汇报</span>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  );
}

export default App;
