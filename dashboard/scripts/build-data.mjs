import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, "output");
const targetDir = path.join(__dirname, "../public/data");
const csvPath = path.join(outDir, "report_viewpoint_database.csv");
const evidencePath = path.join(outDir, "evidence_index.jsonl");
const coveragePath = path.join(outDir, "source_coverage.md");
const reportPath = path.join(outDir, "precious_metals_report.md");

const splitList = (value) =>
  String(value || "")
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const shorten = (value, max = 190) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const splitSnippets = (value) =>
  String(value || "")
    .split("；")
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 3);

const countBy = (rows, getter) => {
  const map = new Map();
  for (const row of rows) {
    const keys = getter(row);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-CN"));
};

const parseMarkdownSections = (markdown) => {
  const sections = [];
  const lines = markdown.split(/\r?\n/);
  let current = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      if (current) sections.push(current);
      current = { title: match[1].trim(), body: "" };
      continue;
    }
    if (current) current.body += `${line}\n`;
  }
  if (current) sections.push(current);
  return sections.map((section) => ({
    title: section.title,
    body: section.body.trim()
  }));
};

const csv = fs.readFileSync(csvPath, "utf8");
const reports = parse(csv, {
  columns: true,
  bom: true,
  skip_empty_lines: true
}).map((row, index) => ({
  id: `r-${index}`,
  date: row.date,
  year: String(row.date || "").slice(0, 4),
  institution: row.institution,
  category: row.category,
  title: row.title,
  layer: row.layer,
  pageCount: Number(row.page_count || 0),
  textChars: Number(row.text_chars || 0),
  tableCount: Number(row.table_count || 0),
  researchObjects: splitList(row.research_objects),
  factorTags: splitList(row.factor_tags),
  coreViewpoints: splitSnippets(row.core_viewpoints),
  priceLevels: splitSnippets(row.price_levels),
  historyOrCycles: splitSnippets(row.history_or_cycles),
  riskWarnings: splitSnippets(row.risk_warnings),
  fileName: row.file_name
}));

const evidence = fs
  .readFileSync(evidencePath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    const item = JSON.parse(line);
    return {
      id: `e-${index}`,
      topic: item.topic,
      date: item.date,
      institution: item.institution,
      title: item.title,
      layer: item.layer,
      snippets: (item.snippets || []).map((snippet) => ({
        page: snippet.page,
        text: shorten(snippet.text, 220)
      })),
      fileName: item.file_name
    };
  });

const years = countBy(reports, (row) => row.year).sort((a, b) => a.name.localeCompare(b.name));
const layers = countBy(reports, (row) => row.layer);
const institutions = countBy(reports, (row) => row.institution).slice(0, 12);
const objects = countBy(reports, (row) => row.researchObjects);
const factors = countBy(reports, (row) => row.factorTags).slice(0, 15);
const topics = countBy(evidence, (row) => row.topic);

const coverage = fs.readFileSync(coveragePath, "utf8");
const reportMarkdown = fs.readFileSync(reportPath, "utf8");
const reportSections = parseMarkdownSections(reportMarkdown);
const latestDate = reports.reduce((latest, row) => (row.date > latest ? row.date : latest), "");
const totalPages = reports.reduce((sum, row) => sum + row.pageCount, 0);
const totalChars = reports.reduce((sum, row) => sum + row.textChars, 0);
const coreCount = reports.filter((row) => row.layer.startsWith("核心层")).length;

const narrative = {
  thesis:
    "黄金不是单一利率交易。短期仍由实际利率、美元和 Fed 预期牵引，中长期中枢被央行购金、美元信用、财政约束和地缘风险重估。",
  boundary:
    "仅使用本地研报库和已生成观点索引，不包含实时行情、外部网页或 2026-03-03 之后的新资料。",
  conclusions: [
    {
      metal: "黄金",
      stance: "配置主线",
      text:
        "经典实际利率框架仍有效，但 2024 年后需要把央行购金、美元信用和地缘风险作为抬高中枢的慢变量。"
    },
    {
      metal: "白银",
      stance: "弹性放大",
      text:
        "白银是黄金 beta 和工业 beta 的叠加，金银比、光伏需求、制造业景气和流动性决定补涨与回撤幅度。"
    },
    {
      metal: "铂钯",
      stance: "产业验证",
      text:
        "铂钯宏观利率敏感度弱于黄金，汽车催化剂、南非和俄罗斯供给、库存周期权重更高。"
    }
  ],
  debates: [
    {
      title: "旧框架是否失效",
      consensus: "实际利率和美元仍解释短期交易。",
      tension: "高实际利率下黄金创新高，说明慢变量抬升了价格中枢。"
    },
    {
      title: "降息是否必然利多",
      consensus: "降息交易通常提前发生。",
      tension: "预防式、衰退式和危机式降息对应的后续路径不同。"
    },
    {
      title: "白银是否只跟随黄金",
      consensus: "黄金上涨通常带动白银。",
      tension: "工业需求和流动性冲击会让白银相对黄金出现更大波动。"
    }
  ],
  risks: [
    "实际利率和美元快速上行",
    "降息预期被修正",
    "ETF、期权或投机持仓过度拥挤",
    "保证金上调和流动性冲击",
    "工业需求回落或库存周期反转"
  ]
};

const sourceForTopic = (topic, limit = 5) =>
  evidence
    .filter((item) => item.topic === topic)
    .slice(0, limit)
    .map((item) => ({
      institution: item.institution,
      date: item.date,
      title: item.title,
      snippets: item.snippets.slice(0, 2)
    }));

const onePageConclusions = [
  {
    question: "黄金怎么定价？",
    answer: "短期看实际利率、DXY、美债和 Fed 预期；中长期看央行购金、美元信用、财政债务和地缘风险。",
    proof: "2024 年后黄金与实际利率阶段性背离，说明非利率变量抬升中枢。"
  },
  {
    question: "白银怎么定价？",
    answer: "黄金 beta 加工业 beta；金银比、光伏/制造业和风险偏好决定弹性。",
    proof: "白银补涨常发生在黄金趋势确认、金银比高位、工业需求改善时。"
  },
  {
    question: "加息一定利空吗？",
    answer: "不一定。真正利空是实际利率和美元快速上行且流动性收缩；加息尾声反而可能提前见底。",
    proof: "2022-2023 年样本显示，peak rate 交易和银行风险能让黄金提前反弹。"
  },
  {
    question: "降息一定利多吗？",
    answer: "不一定。预防式降息偏利多，衰退/危机式降息可能先跌后涨，通胀回落过快会削弱实际利率下行。",
    proof: "降息交易通常提前发生，落地后要看实际利率、美元和拥挤度。"
  },
  {
    question: "如何避开大回撤？",
    answer: "盯实际利率、DXY、美债、Fed 预期、通胀就业、ETF/CFTC、金银比、技术破位和叙事拥挤的组合信号。",
    proof: "历史大调整往往是宏观变量反向、资金拥挤、技术破位同时出现。"
  },
  {
    question: "样本内阶段推断？",
    answer: "仅按截至 2026-03-03 的本地研报样本，更像降息预期交易期 + 高利率维持后段 + 牛市中段，同时存在拥挤回撤风险。",
    proof: "这不是 2026-06-29 实时判断；缺少今天的 Fed 定价、DXY、实际利率、ETF/CFTC 和行情数据。"
  }
];

const pricingFramework = [
  {
    asset: "黄金",
    role: "宏观与信用锚",
    variables: [
      { name: "实际利率", weight: 92, direction: "上行压制，下行支撑", horizon: "短中期" },
      { name: "美元信用", weight: 88, direction: "信用受损抬高中枢", horizon: "中长期" },
      { name: "Fed 预期", weight: 80, direction: "影响美债曲线和美元", horizon: "短期" },
      { name: "央行购金", weight: 76, direction: "慢变量支撑实物需求", horizon: "长期" },
      { name: "ETF/CFTC/期权拥挤", weight: 66, direction: "放大趋势和回撤", horizon: "交易层" }
    ],
    conclusion: "短期仍盯利率和美元，中长期必须把官方购金、财政债务和美元信用纳入中枢。"
  },
  {
    asset: "白银",
    role: "金融 beta + 工业 beta",
    variables: [
      { name: "黄金趋势", weight: 86, direction: "决定方向", horizon: "短中期" },
      { name: "金银比", weight: 76, direction: "高位补涨，低位警惕透支", horizon: "波段" },
      { name: "工业/光伏需求", weight: 72, direction: "改善时增强弹性", horizon: "中期" },
      { name: "风险偏好", weight: 64, direction: "改善时跑赢黄金", horizon: "短期" },
      { name: "流动性", weight: 68, direction: "收缩时回撤更深", horizon: "交易层" }
    ],
    conclusion: "白银不是黄金的便宜替代品，而是更高波动、更依赖工业和流动性的 beta 资产。"
  },
  {
    asset: "铂钯",
    role: "产业供需验证",
    variables: [
      { name: "汽车催化剂需求", weight: 84, direction: "燃油车/混动车需求支撑", horizon: "中期" },
      { name: "南非/俄罗斯供给", weight: 76, direction: "扰动利多", horizon: "事件" },
      { name: "库存周期", weight: 68, direction: "补库利多，去库利空", horizon: "波段" },
      { name: "新能源替代", weight: 62, direction: "压制长期需求", horizon: "长期" },
      { name: "制造业景气", weight: 58, direction: "改善时支撑工业属性", horizon: "周期" }
    ],
    conclusion: "铂钯不宜套用黄金利率框架，关键是汽车需求、矿端供给和库存验证。"
  }
];

const rateHikeCycle = [
  {
    phase: "加息预期形成期",
    gold: "往往提前承压",
    silver: "风险偏好回落时更弱",
    signals: "Fed 转鹰、通胀/就业超预期、2Y/10Y 美债上行",
    exception: "通胀预期或避险事件压过名义利率"
  },
  {
    phase: "正式加息初期",
    gold: "名义和实际利率上行压制黄金",
    silver: "跟随黄金但波动更大",
    signals: "TIPS 实际利率、DXY、ETF 流向",
    exception: "加息路径被充分定价"
  },
  {
    phase: "快速加息期",
    gold: "最危险阶段",
    silver: "常出现更大跌幅",
    signals: "降息预期后移、美元突破、ETF 连续流出",
    exception: "Fed 接近 peak rate，美元和实际利率见顶"
  },
  {
    phase: "加息尾声",
    gold: "可能提前见底",
    silver: "经济不崩时补涨，衰退时弱于黄金",
    signals: "利率期货不再上修终端利率",
    exception: "实际利率回落、DXY 转弱、ETF 回流"
  },
  {
    phase: "高利率维持期",
    gold: "无衰退则震荡，信用风险可支撑",
    silver: "取决于制造业和风险偏好",
    signals: "信用利差、银行风险、财政债务叙事",
    exception: "风险事件缓和且实际利率再上行"
  }
];

const rateCutCycle = [
  {
    type: "预防式降息",
    gold: "偏强",
    silver: "通常更强",
    platinumPalladium: "受工业周期改善支撑",
    caveat: "若已提前 price in，落地可能利多兑现"
  },
  {
    type: "衰退式降息",
    gold: "初期可能被卖出，后期走强",
    silver: "初期更弱",
    platinumPalladium: "需求受损",
    caveat: "危机初期现金为王，后期宽松和避险共振"
  },
  {
    type: "通胀回落后降息",
    gold: "涨幅有限",
    silver: "看制造业和光伏需求",
    platinumPalladium: "看产业需求",
    caveat: "名义降息不等于实际利率下行"
  },
  {
    type: "金融危机降息",
    gold: "先跌后涨概率较高",
    silver: "波动最大",
    platinumPalladium: "产业需求冲击大",
    caveat: "美元荒和保证金压力先压制，随后宽松推升黄金"
  }
];

const historicalCrashes = [
  {
    caseName: "1980-1981 金价冲高回落",
    cycle: "高通胀后期 + Volcker 紧缩",
    narrative: "地缘风险、高通胀、美元信用受损推动黄金上行。",
    trigger: "美联储强力收紧，实际利率上行，通胀预期降温。",
    earlySignals: ["政策强硬抗通胀", "实际利率由负转正", "美元企稳"],
    severity: 90
  },
  {
    caseName: "2020 危机初期流动性冲击",
    cycle: "金融危机式宽松前夜",
    narrative: "疫情避险本应利多黄金。",
    trigger: "美元荒、保证金压力、风险资产抛售导致黄金短期被动卖出。",
    earlySignals: ["VIX 飙升", "美元走强", "信用利差扩大", "黄金与风险资产同跌"],
    severity: 78
  },
  {
    caseName: "2022 快速加息和美元走强",
    cycle: "快速加息期",
    narrative: "通胀高企支撑黄金。",
    trigger: "实际利率和 DXY 快速上行，压过通胀保护叙事。",
    earlySignals: ["TIPS 实际利率上行", "终端利率预期上修", "ETF 流出"],
    severity: 82
  },
  {
    caseName: "2023 年 5 月美元反弹黄金大跌",
    cycle: "加息尾声预期反复",
    narrative: "市场交易加息接近尾声和黄金配置价值。",
    trigger: "美元反弹、降息预期修正。",
    earlySignals: ["美元指数反弹", "美债收益率回升", "黄金无法继续突破"],
    severity: 62
  },
  {
    caseName: "2025 年 10 月金银大跌",
    cycle: "牛市中段过热 + 交易拥挤",
    narrative: "黄金成为强势资产，金银价格前期快速上涨。",
    trigger: "高位波动率、ETF/期权杠杆和拥挤交易破裂。",
    earlySignals: ["做多黄金拥挤", "期权成交异常", "波动率高位", "跌破短期支撑"],
    severity: 86
  }
];

const riskScoreWeights = [
  { signal: "实际利率快速上行", weight: 15, layer: "领先信号" },
  { signal: "DXY 突破", weight: 12, layer: "领先信号" },
  { signal: "美债收益率快速上行", weight: 10, layer: "领先信号" },
  { signal: "Fed 预期修正", weight: 10, layer: "领先信号" },
  { signal: "CPI/PCE/NFP/PMI 超预期", weight: 8, layer: "领先信号" },
  { signal: "ETF 持仓连续流出", weight: 10, layer: "同步信号" },
  { signal: "CFTC 多头下降", weight: 8, layer: "同步信号" },
  { signal: "黄金波动率上升", weight: 8, layer: "同步信号" },
  { signal: "风险资产下跌", weight: 7, layer: "同步信号" },
  { signal: "叙事拥挤", weight: 7, layer: "滞后/情绪信号" },
  { signal: "技术破位", weight: 5, layer: "确认信号" }
];

const currentStageSignals = [
  { name: "降息预期交易", strength: 82, evidence: "多篇 2025-2026 年研报仍讨论降息、实际利率下行和黄金配置。" },
  { name: "高利率维持后段", strength: 68, evidence: "市场仍在处理 higher for longer 与终端利率预期修正。" },
  { name: "牛市中段", strength: 76, evidence: "央行购金、美元信用、财政债务和地缘风险仍支撑中长期逻辑。" },
  { name: "样本内拥挤风险", strength: 70, evidence: "2025 年 10 月后报告开始讨论金银大跌、波动率和配置性价比下降；不代表今天实时风险。" }
];

const strategyCards = [
  {
    asset: "黄金",
    position: "核心配置 + 战术择时",
    logic: "中长期受央行购金、美元信用和财政债务支撑；短期看实际利率、DXY 和 Fed 预期。",
    useWhen: "实际利率见顶、DXY 转弱、金融或地缘风险升温。",
    exitWhen: "风险评分超过 60，ETF/CFTC 流出、波动率高位、技术破位。"
  },
  {
    asset: "白银",
    position: "高 beta 增强",
    logic: "黄金趋势确认后，金银比高位和工业需求改善会放大白银弹性。",
    useWhen: "黄金上行、金银比高位回落、制造业或光伏需求改善。",
    exitWhen: "白银涨幅显著超过黄金、金银比快速压缩、流动性收缩。"
  },
  {
    asset: "铂钯",
    position: "产业周期交易",
    logic: "利率框架权重低，汽车催化剂、供给扰动和库存周期更重要。",
    useWhen: "制造业改善、汽车需求稳、南非/俄罗斯供给扰动。",
    exitWhen: "新能源替代加速、汽车需求转弱、库存压力上升。"
  }
];

const coverageStats = {
  layers,
  years,
  institutions,
  objects,
  factors,
  topics,
  summary: {
    reports: reports.length,
    pages: totalPages,
    chars: totalChars,
    latestDate,
    coreShare: coreCount / reports.length
  }
};

const presentation = {
  onePageConclusions,
  pricingFramework,
  rateHikeCycle,
  rateCutCycle,
  historicalCrashes,
  riskScoreWeights,
  currentStageSignals,
  strategyCards,
  coverageStats,
  sourcesByPage: {
    conclusion: sourceForTopic("黄金定价框架", 4),
    pricing: sourceForTopic("黄金定价框架", 5),
    hike: sourceForTopic("加息周期", 5),
    cut: sourceForTopic("降息周期", 5),
    crash: sourceForTopic("历史大调整", 5),
    risk: sourceForTopic("风险预警", 5),
    stage: sourceForTopic("当前阶段", 5)
  }
};

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(
  path.join(targetDir, "dashboard-data.json"),
  JSON.stringify(
    {
      summary: {
        reportCount: reports.length,
        totalPages,
        totalChars,
        coreCount,
        coreShare: coreCount / reports.length,
        latestDate
      },
      narrative,
      presentation,
      coverage,
      reportSections,
      reports,
      evidence,
      aggregates: {
        years,
        layers,
        institutions,
        objects,
        factors,
        topics
      }
    },
    null,
    2
  )
);

console.log(`Built dashboard data: ${reports.length} reports, ${evidence.length} evidence rows.`);
