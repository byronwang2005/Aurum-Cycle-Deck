# 当前市场数据来源说明

分析日期：2026-06-29；最新可得行情/宏观数据多截至 2026-06-26。

## mx skills 输出

- `mx-macro-data` 成功：`output/mx_macro_data/mx_macro_data_9cda357d_daily.csv`、`output/mx_macro_data/mx_macro_data_9cda357d_monthly.csv`、`output/mx_macro_data/mx_macro_data_9cda357d_yearly.csv`、`output/mx_macro_data/mx_macro_data_9cda357d_description.txt`。
- `mx-finance-search` 成功：`miaoxiang/mx_finance_search/mx_finance_search_d9d7a80d.txt`，包含 2026-06-29 及附近日期的贵金属研报、ETF持仓、央行购金、FOMC解读。
- `mx-finance-data` 尝试查询“COMEX黄金、COMEX白银、伦敦金、伦敦银、伦敦铂金、伦敦钯金、GLD、SLV最新价格及近1月/3月涨跌幅”，接口返回 `dataTableDTOList` 为空。本次行情数值使用官方/可信网页与 `mx-finance-search` 研报数据交叉。

## 官方与可信网页交叉验证

- Federal Reserve FOMC statement, 2026-06-17: https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm
- FRED DGS10: https://fred.stlouisfed.org/series/DGS10
- FRED DFII10: https://fred.stlouisfed.org/series/DFII10
- FRED DTWEXBGS: https://fred.stlouisfed.org/series/DTWEXBGS
- CFTC CMX Futures Only COT: https://www.cftc.gov/dea/futures/deacmxsf.htm
- World Gold Council gold ETF holdings and flows: https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows
- World Gold Council central bank gold reserves survey 2026: https://www.gold.org/goldhub/research/central-bank-gold-reserves-survey-2026

## 关键数值

| 指标 | 最新值 | 日期 | 来源 | 解读 |
| --- | --- | --- | --- | --- |
| Fed政策利率 | 3.50%-3.75% | 2026-06-17 | Federal Reserve | 高利率维持，降息交易不再是唯一主线 |
| 美国10Y国债收益率 | 4.38% | 2026-06-26 | mx-macro-data / FRED | 黄金机会成本仍高 |
| 美国10Y TIPS实际利率 | 2.18% | 2026-06-26 | mx-macro-data / FRED | 直接压制黄金估值 |
| 美国CPI同比 | 4.167% | 2026-05 | mx-macro-data | 通胀压力保留加息扰动 |
| 美国核心PCE同比 | 3.4% | 2026-05 | mx-macro-data | 核心通胀高于目标 |
| 伦敦现货黄金 | 4072.05美元/盎司，近两周-2.72% | 2026-06-26 | mx-finance-search | 高位回撤，拥挤释放 |
| 伦敦现货白银 | 58.38美元/盎司，近两周-12.90% | 2026-06-26 | mx-finance-search | 白银高beta回撤 |
| SPDR黄金ETF持仓 | 约1005吨，周降15.4吨 | 2026-06-26 | mx-finance-search | 配置盘尚未确认回流 |
| COMEX黄金非商业净多 | 181339张 | 2026-06-23 | CFTC | 净多仍高，资金分歧放大 |
