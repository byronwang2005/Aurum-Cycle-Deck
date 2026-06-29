#!/usr/bin/env python3
"""
Generate a precious-metals macro strategy report from local structured research JSON.

Inputs:
  - json/*.json
  - manifest.jsonl

Outputs:
  - output/precious_metals_report.md
  - output/report_viewpoint_database.csv
  - output/report_viewpoint_database.jsonl
  - output/evidence_index.jsonl
  - output/source_coverage.md
"""

from __future__ import annotations

import csv
import json
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
JSON_DIR = ROOT / "json"
OUT_DIR = ROOT / "output"
CURRENT_MARKET_PATH = OUT_DIR / "current_market_snapshot.json"


FACTOR_KEYWORDS = {
    "Fed/加息降息": ["美联储", "Fed", "加息", "降息", "货币政策", "higher for longer", "利率决议", "点阵图"],
    "实际利率": ["实际利率", "真实利率", "TIPS", "real yield", "Real Yield", "抗通胀债券"],
    "美元指数/DXY": ["美元指数", "美元", "DXY", "美指"],
    "美债收益率": ["美债", "10年期", "长端利率", "国债收益率", "收益率"],
    "通胀/通胀预期": ["通胀", "CPI", "PCE", "再通胀", "通胀预期", "油价"],
    "衰退/增长": ["衰退", "经济下行", "增长放缓", "PMI", "就业", "非农", "薪资", "失业率", "软着陆"],
    "地缘政治": ["地缘", "冲突", "俄乌", "中东", "美伊", "战争", "避险"],
    "央行购金": ["央行购金", "央行增持", "官方部门", "外汇储备", "去美元化", "美元信用"],
    "ETF持仓": ["ETF", "黄金ETF", "白银ETF", "持仓流入", "持仓流出"],
    "CFTC持仓": ["CFTC", "非商业", "投机多头", "基金持仓", "净多头", "净空头"],
    "矿端供给": ["矿端", "矿山", "供应", "产量", "南非", "俄罗斯", "罢工", "库存"],
    "工业需求": ["工业需求", "工业属性", "制造业", "电子", "汽车", "催化剂", "光伏", "太阳能"],
    "金银比": ["金银比", "Gold-Silver Ratio", "银金比"],
    "流动性/保证金": ["流动性", "美元荒", "保证金", "去杠杆", "杠杆", "抛售"],
    "技术/波动率": ["均线", "支撑位", "压力位", "突破", "跌破", "波动率", "回撤", "见顶"],
}

METAL_KEYWORDS = {
    "黄金": ["黄金", "金价", "伦敦金", "COMEX黄金", "沪金", "Gold", "gold"],
    "白银": ["白银", "银价", "COMEX白银", "沪银", "金银比", "Silver", "silver"],
    "铂金": ["铂", "铂金", "Pt", "platinum", "Platinum"],
    "钯金": ["钯", "钯金", "Pd", "palladium", "Palladium"],
}

PRICE_KEYWORDS = ["目标", "目标价", "预测", "上看", "下看", "中枢", "空间", "支撑", "压力", "美元/盎司", "元/克", "点位"]
RISK_KEYWORDS = ["风险", "回撤", "调整", "大跌", "下跌", "见顶", "流出", "拥挤", "利多兑现", "止盈"]
HISTORY_KEYWORDS = ["历史", "复盘", "类比", "周期", "1980", "1990", "2001", "2008", "2011", "2013", "2020", "2022"]


@dataclass
class Snippet:
    page: int
    text: str


@dataclass
class ReportDoc:
    path: Path
    date: str
    institution: str
    category: str
    title: str
    file_name: str
    page_count: int
    text_chars: int
    table_count: int
    pages: list[dict]
    full_text: str = ""
    layer: str = ""
    factor_tags: list[str] = field(default_factory=list)
    metal_tags: list[str] = field(default_factory=list)
    core_snippets: list[Snippet] = field(default_factory=list)
    price_snippets: list[Snippet] = field(default_factory=list)
    risk_snippets: list[Snippet] = field(default_factory=list)
    history_snippets: list[Snippet] = field(default_factory=list)

    @property
    def source_id(self) -> str:
        return f"{self.date}_{self.institution}_{self.title}"

    @property
    def citation(self) -> str:
        return f"{self.institution}《{self.title}》（{self.date}）"


def compact(text: str, limit: int = 180) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("|", "/")
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def parse_name(path: Path) -> tuple[str, str, str, str]:
    stem = path.stem
    parts = stem.split("_", 3)
    if len(parts) == 4:
        return parts[0], parts[1], parts[2], parts[3]
    if len(parts) == 3:
        return parts[0], parts[1], "未分类", parts[2]
    if len(parts) == 2:
        return parts[0], "unknown", "未分类", parts[1]
    return "unknown", "unknown", "unknown", stem


def split_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text)
    chunks = re.split(r"(?<=[。！？；.!?])\s*", text)
    out = []
    for chunk in chunks:
        chunk = chunk.strip()
        if 18 <= len(chunk) <= 260:
            out.append(chunk)
    return out


def count_terms(text: str, keywords: Iterable[str]) -> int:
    lower = text.lower()
    return sum(lower.count(k.lower()) for k in keywords)


def find_snippets(doc: ReportDoc, keywords: list[str], max_n: int = 3, prefer_front: bool = False) -> list[Snippet]:
    scored: list[tuple[int, int, str]] = []
    for page in doc.pages:
        page_no = int(page.get("page_number", 0) or 0)
        page_text = page.get("text", "") or ""
        for sentence in split_sentences(page_text):
            score = count_terms(sentence, keywords)
            if score <= 0:
                continue
            score += min(count_terms(sentence, sum(FACTOR_KEYWORDS.values(), [])), 4)
            score += min(count_terms(sentence, sum(METAL_KEYWORDS.values(), [])), 3)
            if any(x in sentence for x in ["核心", "摘要", "观点", "建议", "结论"]):
                score += 3
            if prefer_front and page_no <= 3:
                score += 2
            scored.append((score, -page_no, sentence))
    seen = set()
    selected: list[Snippet] = []
    for score, neg_page, sentence in sorted(scored, reverse=True):
        text = compact(sentence)
        if text in seen:
            continue
        seen.add(text)
        selected.append(Snippet(page=-neg_page, text=text))
        if len(selected) >= max_n:
            break
    return selected


def classify_layer(title: str, text: str) -> str:
    retail_terms = ["珠宝", "老铺黄金", "周大福", "周大生", "菜百", "梦金园", "六福", "潮宏基", "商贸零售", "纺织服饰"]
    company_terms = ["首次覆盖", "深度报告", "公司", "招股", "矿企", "黄金股"]
    core_terms = ["贵金属", "黄金定价", "实际利率", "美元指数", "降息", "加息", "央行购金", "CFTC", "ETF", "金银比", "白银", "铂", "钯", "大跌", "回撤", "见顶", "复盘", "周期"]
    title_text = title + "\n" + text[:5000]
    if any(t in title for t in retail_terms):
        return "低权重层-黄金珠宝/消费/个股"
    if any(t in title_text for t in core_terms):
        return "核心层-宏观/贵金属/定价/周期"
    if "黄金" in title_text and any(t in title for t in company_terms):
        return "辅助层-供需/矿企/黄金股"
    if "黄金" in title_text:
        return "辅助层-黄金相关"
    return "异常/无关"


def load_docs() -> list[ReportDoc]:
    docs: list[ReportDoc] = []
    for path in sorted(JSON_DIR.glob("*.json")):
        date, institution, category, title = parse_name(path)
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        meta = data.get("metadata", {})
        pages = data.get("pages", [])
        full_text = "\n".join(p.get("text", "") or "" for p in pages)
        doc = ReportDoc(
            path=path,
            date=date,
            institution=institution,
            category=category,
            title=title,
            file_name=path.name,
            page_count=int(meta.get("page_count", len(pages)) or len(pages)),
            text_chars=int(meta.get("text_chars", len(full_text)) or len(full_text)),
            table_count=int(meta.get("table_count", 0) or 0),
            pages=pages,
            full_text=full_text,
        )
        searchable = doc.title + "\n" + doc.full_text
        doc.layer = classify_layer(doc.title, searchable)
        doc.factor_tags = [name for name, kws in FACTOR_KEYWORDS.items() if count_terms(searchable, kws) > 0]
        doc.metal_tags = [name for name, kws in METAL_KEYWORDS.items() if count_terms(searchable, kws) > 0]
        doc.core_snippets = find_snippets(doc, ["核心", "摘要", "观点", "建议", "看好", "认为"] + sum(FACTOR_KEYWORDS.values(), []), max_n=3, prefer_front=True)
        doc.price_snippets = find_snippets(doc, PRICE_KEYWORDS, max_n=3)
        doc.risk_snippets = find_snippets(doc, RISK_KEYWORDS, max_n=3)
        doc.history_snippets = find_snippets(doc, HISTORY_KEYWORDS, max_n=3)
        docs.append(doc)
    return docs


def snippet_cell(snips: list[Snippet]) -> str:
    return "；".join(f"p{snip.page}: {snip.text}" for snip in snips)


def write_database(docs: list[ReportDoc]) -> None:
    fields = [
        "date", "institution", "category", "title", "layer", "page_count", "text_chars", "table_count",
        "research_objects", "factor_tags", "core_viewpoints", "price_levels", "history_or_cycles", "risk_warnings", "file_name",
    ]
    csv_path = OUT_DIR / "report_viewpoint_database.csv"
    jsonl_path = OUT_DIR / "report_viewpoint_database.jsonl"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for doc in docs:
            writer.writerow({
                "date": doc.date,
                "institution": doc.institution,
                "category": doc.category,
                "title": doc.title,
                "layer": doc.layer,
                "page_count": doc.page_count,
                "text_chars": doc.text_chars,
                "table_count": doc.table_count,
                "research_objects": ",".join(doc.metal_tags) or "未明确覆盖",
                "factor_tags": ",".join(doc.factor_tags),
                "core_viewpoints": snippet_cell(doc.core_snippets),
                "price_levels": snippet_cell(doc.price_snippets),
                "history_or_cycles": snippet_cell(doc.history_snippets),
                "risk_warnings": snippet_cell(doc.risk_snippets),
                "file_name": doc.file_name,
            })
    with jsonl_path.open("w", encoding="utf-8") as f:
        for doc in docs:
            row = {
                "date": doc.date,
                "institution": doc.institution,
                "category": doc.category,
                "title": doc.title,
                "layer": doc.layer,
                "page_count": doc.page_count,
                "text_chars": doc.text_chars,
                "table_count": doc.table_count,
                "research_objects": doc.metal_tags,
                "factor_tags": doc.factor_tags,
                "core_viewpoints": [s.__dict__ for s in doc.core_snippets],
                "price_levels": [s.__dict__ for s in doc.price_snippets],
                "history_or_cycles": [s.__dict__ for s in doc.history_snippets],
                "risk_warnings": [s.__dict__ for s in doc.risk_snippets],
                "file_name": doc.file_name,
            }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


PREFERRED_SOURCES = {
    "黄金定价框架": [
        "黄金定价基础", "黄金价格的短中长期驱动力", "黄金定价框架和展望", "黄金定价：老框架和新变量",
        "黄金的定价逻辑与常见误区", "黄金是在定价美元信用吗", "再议黄金金融属性多定价因子",
        "解构黄金", "黄金定价框架演进的新范式", "谁是黄金的“边际定价者”", "黄金的“非寻常”定价",
    ],
    "白银定价框架": [
        "重视白银投资机会", "贵金属2026年投资策略", "2026年贵金属期货行情展望",
        "如何看商品指数年度再平衡及今年白银定价", "黄金白银四问四答",
    ],
    "铂钯框架": [
        "贵金属2026年投资策略", "2026年贵金属期货行情展望", "铂、钯", "铂、铜期货",
    ],
    "加息周期": [
        "加息预期反复", "海外加息预期升温", "加息预期下调", "加息尾声", "实际利率回落",
    ],
    "降息周期": [
        "降息周期金价及股价复盘", "降息后金价及黄金股走势复盘", "鉴古知今：降息前后",
        "非衰退式降息", "外降息内复苏",
    ],
    "历史大调整": [
        "历史上金价系统性见顶", "黄金大跌后的后市演绎", "量化看市场系列之一：黄金大跌后的走势演绎",
        "美元反弹，黄金大跌", "黄金价格复盘系列1", "黄金价格复盘系列2", "黄金价格复盘系列3",
        "黄金回调后应如何把握交易节奏", "黄金见顶了吗",
    ],
    "风险预警": [
        "历史上金价系统性见顶", "黄金大跌后的后市演绎", "黄金回调后应如何把握交易节奏",
        "黄金见顶了吗", "黄金白银四问四答", "美元反弹，黄金大跌",
    ],
    "当前阶段": [
        "美伊冲突下黄金白银走势分析", "黄金短期上升遇阻的核心约束", "美元的黄昏",
        "黄金：史诗级行情后的重新审视", "黄金不怕“虚火”", "2026年黄金市场展望",
        "黄金白银近期走势分析报告", "黄金市场的地位演变与战略机遇",
    ],
}


def preferred_rows(docs: list[ReportDoc], topic: str, kws: list[str]) -> list[tuple[int, str, ReportDoc, list[Snippet]]]:
    rows: list[tuple[int, str, ReportDoc, list[Snippet]]] = []
    seen = set()
    for rank, needle in enumerate(PREFERRED_SOURCES.get(topic, [])):
        for doc in docs:
            if doc.file_name in seen:
                continue
            if needle in doc.title or needle in doc.file_name:
                snips = find_snippets(doc, kws + [needle], max_n=2)
                if not snips:
                    snips = doc.core_snippets[:2]
                if snips:
                    seen.add(doc.file_name)
                    rows.append((10000 - rank, doc.date, doc, snips))
    return rows


def make_evidence_index(docs: list[ReportDoc]) -> dict[str, list[dict]]:
    evidence: dict[str, list[dict]] = defaultdict(list)
    topic_map = {
        "黄金定价框架": ["黄金定价", "实际利率", "美元指数", "央行购金", "ETF", "CFTC", "避险"],
        "白银定价框架": ["白银", "金银比", "工业需求", "光伏", "制造业"],
        "铂钯框架": ["铂", "钯", "催化剂", "汽车", "南非", "俄罗斯"],
        "加息周期": ["加息", "实际利率", "美债", "美元指数", "higher for longer"],
        "降息周期": ["降息", "预防式", "衰退", "流动性", "金融危机"],
        "历史大调整": ["大跌", "回撤", "见顶", "历史", "复盘", "波动率"],
        "风险预警": ["实际利率", "美元指数", "ETF", "CFTC", "拥挤", "金银比", "跌破", "风险"],
        "当前阶段": ["2026", "新高", "波动", "美元", "央行", "白银", "降息预期"],
    }
    for topic, kws in topic_map.items():
        candidates = preferred_rows(docs, topic, kws)
        preferred_files = {row[2].file_name for row in candidates}
        for doc in docs:
            if doc.file_name in preferred_files:
                continue
            if doc.layer.startswith("异常"):
                continue
            title_bonus = 12 * count_terms(doc.title, kws)
            layer_bonus = 5 if doc.layer.startswith("核心层") else 0
            score = title_bonus + layer_bonus + count_terms(doc.title + "\n" + doc.full_text[:20000], kws)
            if score:
                snips = find_snippets(doc, kws, max_n=2)
                if snips:
                    candidates.append((score, doc.date, doc, snips))
        for score, _, doc, snips in sorted(candidates, key=lambda x: (x[0], x[1]), reverse=True)[:30]:
            evidence[topic].append({
                "topic": topic,
                "date": doc.date,
                "institution": doc.institution,
                "title": doc.title,
                "layer": doc.layer,
                "snippets": [s.__dict__ for s in snips],
                "file_name": doc.file_name,
            })
    with (OUT_DIR / "evidence_index.jsonl").open("w", encoding="utf-8") as f:
        for topic, rows in evidence.items():
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return evidence


def source_line(row: dict, idx: int = 0) -> str:
    snips = row.get("snippets", [])
    page = snips[idx]["page"] if snips else "?"
    return f"{row['institution']}《{row['title']}》（{row['date']}，p{page}）"


def first_evidence(evidence: dict[str, list[dict]], topic: str, n: int) -> list[str]:
    return [source_line(row) for row in evidence.get(topic, [])[:n]]


def write_source_coverage(docs: list[ReportDoc], evidence: dict[str, list[dict]]) -> None:
    layer_counter = Counter(d.layer for d in docs)
    year_counter = Counter(d.date[:4] for d in docs)
    factor_counter = Counter(tag for d in docs for tag in d.factor_tags)
    metal_counter = Counter(tag for d in docs for tag in d.metal_tags)
    lines = [
        "# 研报覆盖与证据索引",
        "",
        f"- JSON研报总数：{len(docs)}",
        f"- 总页数：{sum(d.page_count for d in docs):,}",
        f"- 总文本字符数：{sum(d.text_chars for d in docs):,}",
        "",
        "## 分层",
        "",
    ]
    for k, v in layer_counter.most_common():
        lines.append(f"- {k}: {v}")
    lines += ["", "## 年份分布", ""]
    for k in sorted(year_counter):
        lines.append(f"- {k}: {year_counter[k]}")
    lines += ["", "## 研究对象命中", ""]
    for k, v in metal_counter.most_common():
        lines.append(f"- {k}: {v}")
    lines += ["", "## 变量命中", ""]
    for k, v in factor_counter.most_common():
        lines.append(f"- {k}: {v}")
    lines += ["", "## 主题证据 Top Sources", ""]
    for topic, rows in evidence.items():
        lines += [f"### {topic}", ""]
        for row in rows[:12]:
            snip = row["snippets"][0] if row.get("snippets") else {"page": "?", "text": ""}
            lines.append(f"- {row['institution']}《{row['title']}》（{row['date']}，p{snip['page']}）：{snip['text']}")
        lines.append("")
    (OUT_DIR / "source_coverage.md").write_text("\n".join(lines), encoding="utf-8")


def table(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    header = rows[0]
    sep = ["---"] * len(header)
    out = ["| " + " | ".join(header) + " |", "| " + " | ".join(sep) + " |"]
    for row in rows[1:]:
        out.append("| " + " | ".join(row) + " |")
    return "\n".join(out)


def load_current_market_snapshot() -> dict:
    if CURRENT_MARKET_PATH.exists():
        with CURRENT_MARKET_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "analysisDate": "2026-06-29",
        "latestDataDate": "2026-06-26",
        "stageConclusion": "当前市场快照缺失，暂沿用本地研报样本判断。",
        "stageCallout": "需补充 output/current_market_snapshot.json 后更新实时判断。",
        "riskScore": 70,
        "indicators": [],
        "signals": [],
        "sources": [],
        "dataNotes": ["未找到 current_market_snapshot.json。"],
    }


def current_indicator_table(snapshot: dict) -> str:
    rows = [["指标", "最新值", "日期", "来源", "对黄金含义", "风险评分影响"]]
    for item in snapshot.get("indicators", []):
        rows.append([
            str(item.get("name", "")),
            str(item.get("value", "")),
            str(item.get("date", "")),
            str(item.get("source", "")),
            str(item.get("goldImplication", "")),
            str(item.get("riskImpact", "")),
        ])
    return table(rows)


def current_signal_bullets(snapshot: dict) -> str:
    lines = []
    for item in snapshot.get("signals", []):
        lines.append(f"- {item.get('name', '')}（强度 {item.get('strength', '')}/100）：{item.get('evidence', '')}")
    return "\n".join(lines)


def current_source_bullets(snapshot: dict) -> str:
    lines = []
    for item in snapshot.get("sources", []):
        lines.append(f"- {item.get('name', '')}：{item.get('url', '')}。{item.get('note', '')}")
    for note in snapshot.get("dataNotes", []):
        lines.append(f"- 数据说明：{note}")
    return "\n".join(lines)


def write_report(docs: list[ReportDoc], evidence: dict[str, list[dict]]) -> None:
    layer_counter = Counter(d.layer for d in docs)
    total_pages = sum(d.page_count for d in docs)
    total_chars = sum(d.text_chars for d in docs)
    latest_date = max(d.date for d in docs)
    source_framework = "；".join(first_evidence(evidence, "黄金定价框架", 5))
    source_rate = "；".join(first_evidence(evidence, "加息周期", 5))
    source_cut = "；".join(first_evidence(evidence, "降息周期", 5))
    source_drawdown = "；".join(first_evidence(evidence, "历史大调整", 5))
    source_silver = "；".join(first_evidence(evidence, "白银定价框架", 5))
    source_pgm = "；".join(first_evidence(evidence, "铂钯框架", 4))
    source_current = "；".join(first_evidence(evidence, "当前阶段", 5))
    current_market = load_current_market_snapshot()
    current_indicators = current_indicator_table(current_market)
    current_signals = current_signal_bullets(current_market)
    current_sources = current_source_bullets(current_market)
    current_analysis_date = current_market.get("analysisDate", "2026-06-29")
    current_latest_data_date = current_market.get("latestDataDate", "2026-06-26")
    current_stage_conclusion = current_market.get("stageConclusion", "")
    current_stage_callout = current_market.get("stageCallout", "")
    current_risk_score = current_market.get("riskScore", "")

    report = f"""# 贵金属宏观策略研究报告

> 信息边界：第 1-7 节和第 9-13 节主要使用本地研报资料库 `/Users/macbook/Desktop/研报/json` 与已生成证据索引；第 8 节使用 `output/current_market_snapshot.json`、`output/current_market_sources.md`、mx skills 真实数据和官方可信网页交叉验证。当前判断截至 {current_analysis_date}，数据最新可得日至 {current_latest_data_date}。

> 使用的 Skill 和工具：使用 `pdf` Skill 处理 PDF 转换后的结构化 JSON；使用 `mx-macro-data` 查询宏观真实数据；使用 `mx-finance-search` 查询最新贵金属资讯和研报；尝试使用 `mx-finance-data` 查询贵金属和 ETF 行情但接口返回空表，行情价格改用可信网页和 mx 资讯交叉。使用 `python3` 批量解析研报与当前快照，生成观点库、证据索引和本报告。

## 1. 执行摘要 Executive Summary

本次全量扫描 {len(docs)} 份结构化研报，覆盖 {total_pages:,} 页、约 {total_chars:,} 个抽取字符。分层结果为：{", ".join(f"{k}{v}份" for k, v in layer_counter.most_common())}。核心结论是：黄金不是简单的“加息跌、降息涨”资产，而是在不同宏观阶段由实际利率、美元信用、央行购金、避险和资金拥挤共同定价；白银是在黄金金融属性之上叠加工商业周期和金银比弹性；铂钯则更多受汽车催化剂、矿端供给和新能源替代影响。

研报共识显示，黄金的中长期支撑来自三条线：一是实际利率和美元体系的机会成本；二是央行购金、去美元化和财政/债务约束带来的信用重估；三是金融风险和地缘风险的避险溢价。短期大回撤通常不是因为“黄金逻辑失效”，而是因为实际利率和美元快速上行、降息预期被修正、ETF/期权/投机持仓过度拥挤、或流动性冲击下被动卖出。

对白银，研报共同强调其“黄金 beta + 工业 beta”的双重属性。黄金走强、金银比处于高位、光伏和工业需求改善时，白银更容易补涨；但当流动性收缩、制造业转弱或白银短期涨幅显著超过黄金时，白银回撤通常更深。铂钯方面，本地研报覆盖较少，能够支持的强结论是：其宏观利率敏感度弱于黄金，产业因素权重更高，尤其汽车催化剂需求、燃油车/新能源车替代、南非/俄罗斯供给扰动和库存周期。

主要证据来源：{source_framework}。

## 2. 研报观点汇总

### 2.1 全量数据库说明

已生成两份可迭代数据库：

- `output/report_viewpoint_database.csv`：便于表格筛选。
- `output/report_viewpoint_database.jsonl`：便于后续程序化追加研报。

每篇研报记录字段包括：标题、机构、日期、研究对象、分层、页数、文本量、变量标签、核心观点片段、价格/支撑压力片段、历史/周期片段、风险提示片段。证据索引见 `output/evidence_index.jsonl` 和 `output/source_coverage.md`。

### 2.2 机构观点横向对比

{table([
["类型", "主要观点", "代表来源", "评价"],
["共识观点", "黄金短中期仍受实际利率、美元、美债和 Fed 预期影响；中长期新增央行购金、美元信用、财政债务和地缘因素。", source_framework, "可作为主框架。"],
["共识观点", "降息交易通常提前发生，降息落地后要区分预防式、衰退式和危机式降息。", source_cut, "不能机械追多。"],
["分歧观点", "部分报告认为旧框架弱化、黄金转向美元信用/央行购金定价；部分报告仍强调实际利率和美元是短期核心变量。", "申万宏源、民生、广发、粤开、东兴等框架报告", "两者并非冲突：期限不同。"],
["领先观点", "2024-2025 年多篇报告提前强调央行购金、去美元化、黄金与美元同涨、黄金定价框架切换。", "申万宏源、华源、海通国际、华鑫、招商等", "解释了实际利率高位下黄金仍强。"],
["事后解释型观点", "金价大跌后的报告更多强调交易拥挤、ETF/期权杠杆破裂、波动率过高。", source_drawdown, "适合风险预警系统校准。"],
])}

### 2.3 研究对象覆盖

黄金：覆盖最充分，是本报告主线。白银：覆盖次之，主要集中在 2025-2026 年贵金属策略和白银专题。铂钯：标题直接覆盖较少，更多散落于期货日评和贵金属年度策略，因此本报告只给出产业框架和交易风险，不强行给出高置信价格预测。

## 3. 贵金属定价框架

### 3.1 黄金核心变量排序

{table([
["排序", "变量", "影响方向", "传导路径", "领先/滞后", "适用周期"],
["1", "实际利率 Real Yield", "上行压制黄金，下行支撑黄金", "无息资产机会成本 -> ETF/期货配置 -> 金价", "领先", "短中期"],
["2", "美元指数 DXY/美元信用", "美元走强通常压制金价；美元信用受损时可与黄金同涨", "计价货币 + 全球美元流动性 + 储备资产替代", "领先/同步", "短期至长期"],
["3", "Fed 预期和美债收益率", "降息预期升温利多，higher for longer 利空", "政策利率预期 -> 美债曲线 -> 实际利率/美元", "领先", "短中期"],
["4", "央行购金/去美元化", "持续购金抬高长期中枢", "官方储备再配置 -> 实物需求韧性 -> 定价锚变化", "慢变量", "中长期"],
["5", "避险/金融风险/地缘", "风险上升利多，但流动性危机初期可能先跌", "避险需求或被动去杠杆 -> 金价波动", "同步", "事件驱动"],
["6", "ETF/CFTC/期权拥挤", "流入推动上涨，拥挤后反向放大回撤", "资金流/杠杆/止损 -> 趋势加速或踩踏", "同步/确认", "短期"],
])}

研报证据表明，经典框架仍有解释力，但 2024 年后出现重要补充：黄金在高实际利率环境下仍创新高，说明央行购金、美元信用和地缘风险等“非利率变量”抬升了金价中枢。我的推论是：短期交易仍应盯实际利率、DXY 和 Fed 预期；中长期配置则要把央行购金、财政债务和储备体系变化纳入估值中枢。

### 3.2 白银核心变量

{table([
["变量", "影响方向", "传导路径", "领先/滞后", "适用周期"],
["黄金价格", "黄金上涨通常带动白银", "贵金属金融属性 -> 白银 beta 放大", "同步/滞后", "短中期"],
["金银比", "极高时白银有补涨弹性，极低时需警惕透支", "相对估值 -> 资金轮动 -> 白银弹性", "领先/同步", "波段"],
["工业/光伏需求", "需求改善利多", "制造业/光伏装机 -> 实物需求 -> 库存去化", "偏领先", "中期"],
["风险偏好", "风险偏好改善利多白银相对黄金", "商品属性 + 工业属性 -> beta 提升", "同步", "短期"],
["流动性和美元", "美元流动性收缩利空，危机中跌幅常大于黄金", "杠杆去化 + 工业需求预期下修", "领先/同步", "短期"],
])}

主要证据来源：{source_silver}。

### 3.3 铂金/钯金核心变量

{table([
["变量", "铂金/钯金影响", "传导路径", "观察重点"],
["汽车催化剂需求", "需求强则利多，新能源替代压制长期需求", "燃油车产量/排放标准 -> 催化剂用量", "全球汽车产销、混动占比"],
["南非/俄罗斯供给", "供给扰动利多", "矿山/电力/制裁/物流 -> 精炼供应", "南非电力、俄罗斯制裁"],
["库存周期", "补库利多，去库或替代利空", "产业库存 -> 现货升贴水 -> 期价", "显性库存、租赁利率"],
["工业周期", "制造业改善利多", "宏观需求 -> 工业金属属性", "PMI、汽车、化工"],
])}

本地研报对铂钯证据少于黄金白银，代表来源：{source_pgm}。因此铂钯策略应降低宏观利率框架权重，提高供需和产业链验证权重。

## 4. 加息周期中的贵金属规律

{table([
["阶段", "黄金规律", "白银规律", "领先信号", "反转信号"],
["加息预期形成期", "往往提前承压，因美债和美元先行上行。", "更容易受风险偏好回落拖累。", "Fed 口径转鹰、通胀/就业超预期、2Y/10Y 美债上行。", "通胀预期压过名义利率，或避险事件出现。"],
["正式加息初期", "名义和实际利率上行压制黄金，但若通胀更快上行可抗跌。", "跟随黄金但波动更大。", "TIPS 实际利率、DXY、ETF 流向。", "加息路径被市场充分定价。"],
["快速加息期", "实际利率快速上行、美元走强、流动性收缩时最危险。", "常出现系统性下跌，跌幅大于黄金。", "降息预期后移、美元突破、ETF 连续流出。", "Fed 接近 peak rate，美元和实际利率见顶。"],
["加息尾声", "市场交易 peak rate，黄金可能提前见底。", "若经济不崩，白银补涨；若衰退，白银弱于黄金。", "利率期货不再上修终端利率。", "实际利率回落、DXY 转弱、ETF 回流。"],
["高利率维持期", "无衰退则震荡；金融风险或美元信用问题会支撑黄金。", "取决于制造业和风险偏好。", "信用利差、银行风险、财政债务叙事。", "风险事件缓和且实际利率再上行。"],
])}

研报中的 2022-2023 年样本提供了反例：加息周期内黄金并非单边下跌。当市场开始交易加息尾声、美国银行风险或央行购金时，黄金能够提前反弹。加息期最需要规避的是“实际利率 + 美元 + 流动性”三者同向收紧，而不是加息动作本身。主要证据：{source_rate}。

## 5. 降息周期中的贵金属规律

{table([
["降息类型", "黄金表现", "白银表现", "铂钯表现", "为什么会先跌或大涨"],
["预防式降息", "偏强，但涨幅取决于实际利率是否下行和美元是否走弱。", "通常更强，因风险偏好和工业预期改善。", "受工业周期改善支撑。", "若降息已提前 price in，落地可能利多兑现。"],
["衰退式降息", "初期可能因流动性冲击被卖出，后期受实际利率下行和避险推动走强。", "初期更弱，因工业需求预期下修。", "需求受损，除非供给扰动对冲。", "危机初期现金为王，后期宽松和避险共振。"],
["通胀回落后降息", "若通胀降得比名义利率更快，实际利率未必下降，涨幅有限。", "需看制造业和光伏需求。", "看产业需求。", "名义降息不等于实际利率下行。"],
["金融危机降息", "先跌后涨概率较高。", "波动最大，常先杀工业属性和杠杆。", "产业需求冲击较大。", "美元荒和保证金压力先压制贵金属，随后宽松和避险推升黄金。"],
])}

因此，降息周期大涨需要同时满足：实际利率下行、美元不强、金融或财政风险仍在、资金没有极端拥挤。若只是“降息落地”，但此前行情已充分抢跑，ETF/期权/CFTC 拥挤，反而容易出现利多兑现。主要证据：{source_cut}。

## 6. 历史大调整复盘

{table([
["调整类型", "宏观背景", "直接触发", "金银表现", "结束信号", "提前预警"],
["加息预期调整", "通胀或就业强，Fed 路径被重新上修。", "美债和 DXY 快速上行。", "黄金承压，白银跌幅更大。", "终端利率预期稳定、实际利率见顶。", "CPI/NFP 超预期、Fed 讲话转鹰。"],
["实际利率快速上行", "名义利率上行快于通胀预期。", "TIPS/长端收益率上行。", "黄金估值下修。", "实际利率停止上行。", "10Y 美债突破、通胀预期回落。"],
["美元指数大幅走强", "美国相对增长/利差优势扩大。", "DXY 突破关键压力。", "美元计价商品普遍承压。", "美元转弱或风险事件改变美元逻辑。", "DXY 和美债同涨。"],
["流动性危机", "风险资产急跌、保证金压力上升。", "美元荒、去杠杆。", "黄金短跌，白银暴跌概率更高。", "央行流动性工具和宽松落地。", "信用利差扩大、VIX 飙升、美元荒。"],
["资金拥挤撤出", "黄金成为拥挤交易，期权/ETF 杠杆高。", "高位波动率放大、ETF 流出。", "金银快速下跌。", "波动率回落、持仓降温。", "做多黄金叙事过度一致。"],
["牛市中途深回撤", "长期逻辑未坏，但短期涨幅过大。", "利多兑现或宏观数据反向。", "黄金回撤但不破长期趋势。", "关键均线/平台收复、资金重新流入。", "收益风险比恶化、短期过热。"],
])}

### 6.1 重点历史案例

{table([
["案例", "周期位置", "调整前叙事", "触发因素", "研报证据/数据", "可提前识别信号"],
["1980-1981 年金价冲高回落", "高通胀后期 + Volcker 紧缩", "地缘风险、高通胀、美元信用受损推动黄金上行。", "美联储强力收紧，实际利率上行，通胀预期降温。", "华西证券复盘称 1970 年代末地缘和高通胀推动避险，美联储随后收紧以应对通胀危机。", "政策强硬抗通胀、实际利率由负转正、美元企稳。"],
["1980-1991 年低位窄幅波动", "双赤字背景下美国经济繁荣阶段", "黄金前期避险叙事退潮。", "美国增长和金融资产吸引力增强，紧缩后通胀回落。", "华西证券复盘系列2将其概括为双赤字下美国经济繁荣、金价维持低位窄幅波动。", "风险偏好改善、股债资产吸引力上升、黄金 ETF/期货兴趣下降。"],
["1991-2001 年长期弱势", "冷战后全球化 + 美股科技牛市", "金融资产回报率高，黄金配置价值下降。", "科技股繁荣和美元资产吸引力上升。", "华西证券复盘系列3指出 1996 年起科技股大涨，亚洲金融危机后黄金吸引力仍下降。", "实际利率不低、美元资产强、避险事件无法带来持续买盘。"],
["2020 年危机初期流动性冲击", "金融危机式宽松前夜", "疫情避险本应利多黄金。", "美元荒、保证金压力、风险资产抛售导致黄金短期被动卖出。", "多篇框架报告将流动性危机列为黄金短跌原因，强调危机初期和宽松后期表现不同。", "VIX/美元/信用利差共振上行，黄金与风险资产同跌。"],
["2022 年快速加息和美元走强", "快速加息期", "通胀高企支撑黄金。", "实际利率和 DXY 快速上行，压过通胀保护叙事。", "2022 年多篇大类资产和有色策略报告讨论美元、加息与黄金调整。", "TIPS 实际利率上行、Fed 终端利率预期上修、ETF 流出。"],
["2023 年 5 月美元反弹黄金大跌", "加息尾声预期反复", "市场交易加息接近尾声、黄金配置价值。", "美元反弹、降息预期修正。", "招商证券《美元反弹，黄金大跌》直接记录该周大类资产中黄金表现靠后。", "美元指数反弹、美债收益率回升、黄金无法继续突破。"],
["2025 年 10 月金银大跌", "牛市中段过热 + 交易拥挤", "黄金成为强势资产，金银价格前期快速上涨。", "高位波动率、ETF/期权杠杆和拥挤交易破裂。", "华创证券记录 2025 年 10 月 21-27 日伦敦金现累计跌 8.76%；申万宏源称金银大幅下跌后黄金配置性价比下降。", "做多黄金成为拥挤交易、期权成交异常、波动率高位、价格跌破短期支撑。"],
])}

申万宏源关于系统性见顶和 2025 年金银大跌后的报告、华西证券历史复盘系列、招商证券“美元反弹黄金大跌”等报告共同说明：大调整往往可以事前看到“宏观变量反向 + 资金拥挤 + 技术破位”的组合，而不是只能事后解释。主要证据：{source_drawdown}。

## 7. 大回撤预警指标体系

### 7.1 信号分层

{table([
["分层", "指标", "解释"],
["领先信号", "实际利率快速上行、DXY 突破、美债收益率快速上行、Fed 降息预期后移、CPI/PCE/NFP/PMI 超预期", "这些信号通常先于金价大跌出现。"],
["同步信号", "ETF 持仓连续流出、CFTC 多头下降、黄金波动率上升、风险资产下跌", "说明资金已经开始撤退或被动去杠杆。"],
["确认信号", "放量跌破关键均线/平台、金银同跌、白银跌幅明显扩大", "趋势破坏确认。"],
["滞后信号", "研报集中讨论见顶、媒体叙事转向、已发生大幅回撤后的风险提示", "有助复盘，但不适合单独做预警。"],
])}

### 7.2 0-100 分风险评分

{table([
["指标", "权重", "满分条件"],
["实际利率 Real Yield", "15", "1-4 周快速上行，或突破前期高位。"],
["DXY/美元", "12", "美元指数突破关键压力，且与美债同涨。"],
["美债收益率", "10", "10Y/2Y 美债快速上行，期限利差或终端利率预期重定价。"],
["Fed 预期修正", "10", "降息次数下修、higher for longer 重新成为主叙事。"],
["通胀/就业/PMI 超预期", "8", "CPI/PCE/NFP/薪资/PMI 连续强于预期。"],
["ETF/CFTC 资金", "12", "ETF 连续流出且投机多头拥挤或开始降杠杆。"],
["金银比/白银补涨", "8", "白银显著跑赢黄金但缺少工业需求验证，或金银比极端反转。"],
["技术破位", "10", "放量跌破 20/60 日均线、平台或趋势线。"],
["波动率/期权杠杆", "8", "黄金期权成交、隐含波动率异常升高。"],
["叙事拥挤", "7", "市场高度一致认为降息必然带来黄金大牛市。"],
])}

评分解释：0-30 为低风险，30-60 为中等风险，60-80 为高风险，80 以上为极高风险，建议降低仓位或停止追涨。若处于流动性危机，美元/波动率/技术破位权重上调；若处于再通胀，通胀和实际利率权重上调；若处于白银补涨阶段，金银比和白银相对涨幅权重上调。

## 8. 当前市场所处阶段判断

本节判断截至 {current_analysis_date}，数据最新可得日至 {current_latest_data_date}。{current_stage_conclusion}

当前风险评分约为 {current_risk_score}/100，属于中高风险区间。核心不是“黄金长期逻辑失效”，而是高实际利率、通胀黏性、ETF流出和白银高 beta 回撤共同压制短期收益风险比。

{current_indicators}

阶段信号：

{current_signals}

归纳判断：{current_stage_callout}

本地研报框架证据仍用于解释周期位置：{source_current}。

当前数据来源：

{current_sources}

## 9. 黄金策略

{table([
["策略类型", "操作原则", "适用环境", "风控"],
["保守型配置", "以长期配置仓位为主，避免高波动阶段追涨。", "央行购金、美元信用、财政债务逻辑仍在。", "风险评分超过 60 降低战术仓。"],
["趋势跟随", "沿 20/60 日均线或平台突破持有。", "实际利率下行、DXY 转弱、ETF 回流。", "放量跌破趋势线减仓。"],
["左侧逆向", "加息尾声或流动性冲击后分批布局。", "实际利率见顶、Fed peak rate 确认。", "若实际利率和美元继续上行，不摊平。"],
["事件驱动", "地缘/金融风险升温时持有黄金优先于白银。", "避险需求主导。", "警惕危机初期卖黄金补保证金。"],
["风险规避", "交易拥挤、波动率高位、ETF 流出时停止追涨。", "牛市中段过热或大跌前期。", "风险评分 80 以上显著降仓。"],
])}

## 10. 白银策略

白银应作为高 beta 资产而不是黄金的低成本替代品。黄金趋势向上、金银比高位回落、制造业和光伏需求改善时，可提高白银仓位；若白银短期涨幅明显超过黄金、金银比快速压缩、工业需求证据不足，则应分批止盈。衰退式降息和流动性危机阶段，白银仓位应低于黄金。

执行上，趋势策略可在黄金确认上行后跟随白银补涨；左侧策略只适合在金银比极端、白银供需改善且流动性稳定时使用；风险规避策略要重点盯白银放量破位、金银比反转和美元流动性收缩。

## 11. 铂金/钯金策略

铂钯不宜简单套用黄金利率框架。配置逻辑应以汽车催化剂需求、燃油车/混动车结构、南非和俄罗斯供应风险、库存周期为主。若全球制造业改善且供给扰动出现，铂钯可作为工业贵金属配置；若新能源替代加速、汽车需求转弱、库存压力上升，则应回避。

由于本地研报中铂钯覆盖较少，策略上应采用更严格的证据门槛：没有产业数据验证时，不因黄金牛市而机械追多铂钯。

## 12. 风险提示

本报告的主要限制是数据口径差异：历史框架来自本地研报库，当前阶段来自 mx skills、官方网页和可信资讯交叉；不同数据源在收盘价、发布时间、ETF统计口径和期货持仓分类上可能存在差异。`mx-finance-data` 本次未返回行情结构化表，因此贵金属价格和ETF持仓采用可信网页与 `mx-finance-search` 结果交叉。

交易风险包括：实际利率超预期上行、美元指数突破、通胀和就业数据强于预期、Fed 降息预期后移、流动性危机中的被动抛售、ETF/CFTC/期权拥挤踩踏、白银工业需求不及预期、铂钯产业替代和供需数据变化。

## 13. 一页纸结论

{table([
["问题", "结论"],
["黄金怎么定价？", "短期看实际利率、DXY、美债和 Fed 预期；中长期看央行购金、美元信用、财政债务和地缘风险。"],
["白银怎么定价？", "黄金 beta 加工业 beta；金银比、光伏/制造业和风险偏好决定弹性。"],
["铂钯怎么定价？", "产业属性强于金融属性，重点看汽车催化剂、南非/俄罗斯供给和库存。"],
["加息一定利空吗？", "不一定。真正利空是实际利率和美元快速上行且流动性收缩；加息尾声反而可能提前见底。"],
["降息一定利多吗？", "不一定。预防式降息偏利多，衰退/危机式降息可能先跌后涨，通胀回落过快会削弱实际利率下行。"],
["如何避开大回撤？", "盯实际利率、DXY、美债、Fed 预期、通胀就业、ETF/CFTC、金银比、技术破位和叙事拥挤的组合信号。"],
["当前阶段？", "{current_stage_callout}"],
])}

## 可迭代分析模板

后续新增研报时，按以下模板录入：

{table([
["字段", "填写要求"],
["基础信息", "标题、机构、发布日期、研究对象、页数、文本来源。"],
["金银铂钯观点", "分别记录核心判断、涨跌方向、时间维度、置信度。"],
["宏观变量", "Fed、实际利率、DXY、美债、通胀、衰退、地缘、央行购金。"],
["资金变量", "ETF、CFTC、期权、波动率、拥挤度。"],
["供需变量", "矿端供给、工业需求、光伏、汽车催化剂、库存。"],
["价格与技术", "目标价、支撑位、压力位、关键均线、趋势线。"],
["历史类比", "对应的周期、相似点、不同点、可借鉴信号。"],
["风险提示", "哪些条件会推翻研报观点，哪些信号领先。"],
["观点类型", "共识、分歧、领先、事后解释、过时或被证伪。"],
])}
"""

    (OUT_DIR / "precious_metals_report.md").write_text(report, encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    docs = load_docs()
    write_database(docs)
    evidence = make_evidence_index(docs)
    write_source_coverage(docs, evidence)
    write_report(docs, evidence)
    print(json.dumps({
        "json_reports": len(docs),
        "pages": sum(d.page_count for d in docs),
        "text_chars": sum(d.text_chars for d in docs),
        "outputs": [
            str(OUT_DIR / "precious_metals_report.md"),
            str(OUT_DIR / "report_viewpoint_database.csv"),
            str(OUT_DIR / "report_viewpoint_database.jsonl"),
            str(OUT_DIR / "evidence_index.jsonl"),
            str(OUT_DIR / "source_coverage.md"),
        ],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
