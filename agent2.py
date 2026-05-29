import csv, os, math, sys
from datetime import datetime
sys.stdout.reconfigure(encoding="utf-8")

CORE = ["语文","数学","英语","物理","化学","生物"]
ALL = CORE + ["政治","历史","地理"]
MAXS = {"语文":150,"数学":150,"英语":150,"物理":100,"化学":100,"生物":100}

def read_csv(path):
    exams = []
    with open(path, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if not row.get("考试日期"): continue
            ex = {"date":row["考试日期"],"type":row["类型"],"notes":row.get("备注","")}
            sc = {}
            for s in ALL:
                v = row.get(s,"").strip()
                sc[s] = float(v) if v and v != chr(8212) else None
            ex["scores"] = sc
            t9 = row.get("总分(9科)","").strip()
            ex["total_9"] = float(t9) if t9 else None
            t6 = row.get("总分(6科)","").strip()
            ex["total_6"] = float(t6) if t6 else None
            rk = row.get("年排","").strip()
            ex["rank"] = int(rk) if rk else None
            exams.append(ex)
    return exams

def analyze(exams):
    r = {"subjects":{},"total_6":[],"total_9":[],"rank":[]}
    for subj in CORE:
        vals = [(e["date"],e["scores"].get(subj)) for e in exams if e["scores"].get(subj) is not None]
        scores = [v[1] for v in vals]
        if not scores: continue
        n = len(scores)
        avg = sum(scores) / n
        sd = math.sqrt(sum((s-avg)*(s-avg) for s in scores)/n) if n > 1 else 0.0
        cv = sd/avg*100 if avg > 0 else 0.0
        rt = avg / MAXS[subj]
        if rt >= 0.85 and cv < 10: tier = "优势"
        elif rt >= 0.75 and cv < 15: tier = "稳定"
        elif rt >= 0.60: tier = "临界提分"
        else: tier = "薄弱"
        tr = "first"
        dlt = 0
        if n >= 2:
            dlt = scores[-1] - scores[0]
            tr = "up" if dlt > 0 else ("down" if dlt < 0 else "flat")
        r["subjects"][subj] = {"scores":scores,"avg":round(avg,1),"cv":round(cv,1),"tier":tier,"trend":tr,"delta":round(dlt,1),"recent":scores[-1],"max":MAXS[subj],"rate":round(rt*100,1)}
    for e in exams:
        if e["total_6"] is not None: r["total_6"].append((e["date"],e["total_6"]))
        if e["total_9"] is not None: r["total_9"].append((e["date"],e["total_9"]))
        if e["rank"] is not None: r["rank"].append((e["date"],e["rank"]))
    return r

def gen_report(data):
    L = []
    now = datetime.now().strftime("%Y-%m-%d")
    L.append("# Agent2 学情画像报告  " + now)
    L.append("")
    L.append("> **本报告为纯客观数据底座**，不包含任何选科或专业建议。Agent3/4的唯一数据依据。")
    L.append("")
    L.append("## 1. 各科综合画像")
    L.append("")
    p = chr(124)  # pipe char
    L.append(p + " 科目 " + p + " 最近 " + p + " 均分 " + p + " 得分率 " + p + " 波动(CV) " + p + " 趋势(首→末) " + p + " 档位 " + p)
    L.append(p + "------" + p + "------" + p + "------" + p + "--------" + p + "---------" + p + "-------------" + p + "------" + p)
    icons = {"up":"↑上升","down":"↓下降","flat":"→平稳","first":"首次"}
    for subj, info in data["subjects"].items():
        ic = icons.get(info["trend"], info["trend"])
        L.append(f"{p} {subj} {p} {info["recent"]} {p} {info["avg"]} {p} {info["rate"]}% {p} {info["cv"]}% {p} {ic} {p} **{info["tier"]}** {p}")
    L.append("")
    L.append("## 2. 总分趋势")
    L.append("")
    for label, trend in [("6科总分(语数英+物化生)", data["total_6"]), ("9科总分", data["total_9"])]:
        if trend:
            pts = " → ".join([f"{d}:{s}" for d,s in trend])
            if len(trend) >= 2:
                chg = trend[-1][1] - trend[0][1]
                sign = "+" if chg >= 0 else ""
                pts += f"  (波动: {sign}{chg:.1f})"
            L.append(f"- **{label}**: {pts}")
    L.append("")
    if data["rank"]:
        L.append("## 3. 年级排名")
        L.append("")
        for d, rk in data["rank"]:
            L.append(f"- {d}: 年排 **{rk}**")
        L.append("")
    L.append("## 4. 关注事项")
    L.append("")
    warns = []
    for subj, info in data["subjects"].items():
        if info["cv"] > 20: warns.append(f"- ⚠️ **{subj}** 波动较大(CV={info["cv"]}%)，需关注稳定性")
        if info["tier"] == "薄弱": warns.append(f"- ❌ **{subj}** 薄弱科目(得分率{info["rate"]}%)，建议重点提分")
    if not warns: warns.append("✅ 暂无明显风险信号")
    L.extend(warns)
    L.append("")
    L.append("---")
    L.append(f"*Agent2 生成于 {now} | 下游请参考本报告*")
    return "\r\n".join(L)

if __name__ == "__main__":
    csv_f = [f for f in os.listdir(".") if f.endswith(".csv") and not "_old" in f and not "_wide_backup" in f][0]
    print(f"读取: {csv_f}")
    exams = read_csv(csv_f)
    print(f"解析 {len(exams)} 次考试")
    data = analyze(exams)
    report = gen_report(data)
    os.makedirs("reports", exist_ok=True)
    dt = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = f"reports/{dt}_agent2_profile.md"
    with open(out, "w", encoding="utf-8", newline="") as f:
        f.write(report)
    print(f"报告: {out}")
    print(report)