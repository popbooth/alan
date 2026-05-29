/**
 * charts.js — TIPS 图表模块 (Chart.js v4)
 * 依赖: Chart.js CDN (在 index.html 加载)
 * 所有图表自带深色/浅色模式适配
 */

const TC = {
  _charts: {},

  // 色板 (light/dark)
  colors: {
    subjects: ['#007aff','#34c759','#ff9500','#ff3b30','#5ac8fa','#af52de'],
    tiers: { green: '#34c759', blue: '#007aff', orange: '#ff9500', red: '#ff3b30' },
    grid: { light: '#e5e5ea', dark: '#2c2c2e' },
    text: { light: '#3c3c4399', dark: '#ebebf599' },
  },

  _isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark'
  },
  _destroy(id) {
    if (TC._charts[id]) { TC._charts[id].destroy(); delete TC._charts[id] }
  },

  /** 各科成绩趋势折线图 */
  subjectTrend(canvasId, grades) {
    const canvas = document.getElementById(canvasId)
    if (!canvas || !grades.length) return
    TC._destroy(canvasId)
    const dark = TC._isDark()
    const subjects = ['语文','数学','英语','物理','化学','生物']
    // 按时间排序
    const sorted = [...grades].sort((a,b) => a.date.localeCompare(b.date))
    const labels = sorted.map(g => g.date.slice(-5))

    const datasets = subjects.map((s, i) => ({
      label: s, data: sorted.map(g => g.scores[s] ?? null),
      borderColor: TC.colors.subjects[i],
      backgroundColor: TC.colors.subjects[i] + '20',
      tension: .3, pointRadius: 4, spanGaps: false,
      borderWidth: 2,
    }))

    TC._charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: dark ? '#ebebf5' : '#3c3c43', boxWidth: 12, padding: 12, font: { size: 11 } } },
          tooltip: { backgroundColor: dark ? '#1c1c1e' : '#fff', titleColor: dark ? '#fff' : '#000', bodyColor: dark ? '#ebebf5' : '#3c3c43', borderColor: dark ? '#38383a' : '#c6c6c8', borderWidth: .5 }
        },
        scales: {
          y: { beginAtZero: false, grid: { color: dark ? '#2c2c2e' : '#e5e5ea' }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 11 } } }
        },
        interaction: { mode: 'index', intersect: false }
      }
    })
    return TC._charts[canvasId]
  },

  /** 能力雷达图 (最近一次得分率) */
  abilityRadar(canvasId, grades) {
    const canvas = document.getElementById(canvasId)
    if (!canvas || !grades.length) return
    TC._destroy(canvasId)
    const dark = TC._isDark()
    const subjects = ['语文','数学','英语','物理','化学','生物']
    const MAX = {语文:150,数学:150,英语:150,物理:100,化学:100,生物:100}
    const last = grades[grades.length - 1]

    TC._charts[canvasId] = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: subjects,
        datasets: [{
          label: '得分率 %',
          data: subjects.map(s => last.scores[s] ? Math.round(last.scores[s] / MAX[s] * 100) : 0),
          borderColor: '#007aff',
          backgroundColor: '#007aff20',
          pointBackgroundColor: '#007aff',
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.r + '%' } }
        },
        scales: {
          r: {
            min: 0, max: 100, ticks: { stepSize: 20, color: dark ? '#8e8e93' : '#8e8e93', backdropColor: 'transparent', font: { size: 10 } },
            grid: { color: dark ? '#2c2c2e' : '#e5e5ea' },
            angleLines: { color: dark ? '#2c2c2e' : '#e5e5ea' },
            pointLabels: { color: dark ? '#ebebf5' : '#3c3c43', font: { size: 12 } }
          }
        }
      }
    })
  },

  /** 总分趋势折线图 (6科/9科) */
  totalTrend(canvasId, grades) {
    const canvas = document.getElementById(canvasId)
    if (!canvas || !grades.length) return
    TC._destroy(canvasId)
    const dark = TC._isDark()
    const sorted = [...grades].sort((a,b) => a.date.localeCompare(b.date))
    const labels = sorted.map(g => g.date.slice(-5))

    // 从 grades 计算总分
    const total6 = sorted.map(g => {
      const c = g.scores; const sum = ['语文','数学','英语','物理','化学','生物']
        .reduce((s, sub) => s + (c[sub] || 0), 0)
      return sum || null
    })
    const total9 = sorted.map(g => {
      const c = g.scores; const sum = ['语文','数学','英语','物理','化学','生物','政治','历史','地理']
        .reduce((s, sub) => s + (c[sub] || 0), 0)
      return sum || null
    })
    // 检测哪些是6科数据
    const is6kOnly = sorted.map(g => !g.scores['政治'] && !g.scores['历史'] && !g.scores['地理'])

    const datasets = []
    // 9科数据 (有政治/历史/地理的)
    const t9labels = [], t9data = []
    sorted.forEach((g, i) => {
      if (!is6kOnly[i]) { t9labels.push(labels[i]); t9data.push(total9[i]) }
    })
    if (t9data.length) datasets.push({ label: '9科总分', data: t9data, borderColor: '#ff9500', backgroundColor: '#ff950020', tension: .3, pointRadius: 4, borderWidth: 2, spanGaps: false })

    // 6科数据
    const t6data = total6.map((v, i) => {
      // 如果该次考试是9科的，也显示6科值
      const sum = ['语文','数学','英语','物理','化学','生物'].reduce((s, sub) => s + (sorted[i].scores[sub] || 0), 0)
      return sum || null
    })
    datasets.push({ label: '6科总分', data: t6data, borderColor: '#007aff', backgroundColor: '#007aff20', tension: .3, pointRadius: 4, borderWidth: 2, borderDash: [4, 3] })

    TC._charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: dark ? '#ebebf5' : '#3c3c43', boxWidth: 12, padding: 12, font: { size: 11 } } },
          tooltip: { backgroundColor: dark ? '#1c1c1e' : '#fff', titleColor: dark ? '#fff' : '#000', bodyColor: dark ? '#ebebf5' : '#3c3c43', borderColor: dark ? '#38383a' : '#c6c6c8', borderWidth: .5 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: dark ? '#2c2c2e' : '#e5e5ea' }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 11 } } }
        },
        interaction: { mode: 'index', intersect: false }
      }
    })
  },

  /** 各科波动柱状图 (CV值) */
  volatilityBar(canvasId, grades) {
    const canvas = document.getElementById(canvasId)
    if (!canvas || grades.length < 2) return
    TC._destroy(canvasId)
    const dark = TC._isDark()
    const subjects = ['语文','数学','英语','物理','化学','生物']
    const sorted = [...grades].sort((a,b) => a.date.localeCompare(b.date))

    const cvData = subjects.map(sub => {
      const vals = sorted.map(g => g.scores[sub]).filter(v => v != null)
      if (vals.length < 2) return 0
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length)
      return Math.round(sd / avg * 100 * 10) / 10
    })

    const bgColors = cvData.map(v => v > 15 ? '#ff3b30' : v > 10 ? '#ff9500' : '#34c759')

    TC._charts[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: subjects,
        datasets: [{ label: '波动系数 CV(%)', data: cvData, backgroundColor: bgColors, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => 'CV: ' + ctx.parsed.y + '%' } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: dark ? '#2c2c2e' : '#e5e5ea' }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 11 } } }
        }
      }
    })
  },

  /** 用量趋势折线图 */
  usageTrend(canvasId, logs) {
    const canvas = document.getElementById(canvasId)
    if (!canvas || !logs.length) return
    TC._destroy(canvasId)
    const dark = TC._isDark()
    // 按日聚合
    const dayMap = {}
    logs.forEach(l => { dayMap[l.date] = (dayMap[l.date] || 0) + (l.totalTokens || 0) })
    const days = Object.keys(dayMap).sort()
    if (!days.length) return

    TC._charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{ label: 'Token 用量', data: days.map(d => dayMap[d]), borderColor: '#007aff', backgroundColor: '#007aff20', fill: true, tension: .3, pointRadius: 3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: dark ? '#2c2c2e' : '#e5e5ea' }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 10 } } },
          x: { grid: { display: false }, ticks: { color: dark ? '#8e8e93' : '#8e8e93', font: { size: 10 } } }
        }
      }
    })
  },

  /** 模型用量分布环形图 */
  modelDist(canvasId, logs) {
    const canvas = document.getElementById(canvasId)
    if (!canvas || !logs.length) return
    TC._destroy(canvasId)
    const dark = TC._isDark()
    const modelMap = {}
    logs.forEach(l => { modelMap[l.model] = (modelMap[l.model] || 0) + (l.totalTokens || 0) })
    const models = Object.keys(modelMap)
    if (!models.length) return

    TC._charts[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: models,
        datasets: [{ data: models.map(m => modelMap[m]), backgroundColor: ['#007aff','#34c759','#ff9500','#5ac8fa','#af52de'], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: dark ? '#ebebf5' : '#3c3c43', boxWidth: 12, padding: 8, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ctx.label + ': ' + (ctx.parsed / 1000).toFixed(1) + 'K' } }
        }
      }
    })
  },

  /** 主题切换时重绘所有图表 */
  redrawAll() {
    Object.keys(TC._charts).forEach(id => {
      const chart = TC._charts[id]
      if (chart) { chart.destroy(); delete TC._charts[id] }
    })
    // 重绘由各 Tab 切换时触发，不需要自动恢复
  }
}

window.TC = TC
