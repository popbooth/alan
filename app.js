/**
 * app.js — TIPS 主应用逻辑
 * v0.5: IndexedDB 集成 + Tab 导航 + Token 记录
 */

const $ = id => document.getElementById(id)
let S = {}                    // 设置缓存
let currentSession = ''       // 当前会话ID
let chatHistory = []
// 版本
const APP_VER = 'v2.1.0', APP_DATE = '2026-05-29'
          // 当前会话消息 [{role,text,time}]

// ===================== 初始化 =====================

;(async () => {
  // 迁移旧 localStorage 数据
  await db.migrateFromLocalStorage()
  await migrateCSVtoGrades()

  // 加载设置
  S.apiKey = await db.getSetting('apiKey') || ''
  // 如果 API Key 为空，尝试从加密存储恢复
  if (!S.apiKey) {
    const encrypted = await db.getSetting('encryptedApiKey')
    if (encrypted) {
      const decrypted = await TIPSCrypto.decrypt(encrypted, S.pinCode)
      if (decrypted) S.apiKey = decrypted
    }
  }
  S.chatModel = await db.getSetting('chatModel') || 'deepseek-v4-flash'
  S.thinkModel = await db.getSetting('thinkModel') || 'deepseek-v4-pro[1m]'
  S.bingKey = await db.getSetting('bingApiKey') || ''
  S.webhookUrl = await db.getSetting('webhookUrl') || ''
  S.pinCode = await db.getSetting('pinCode') || '292010'
  S.budgetLimit = await db.getSetting('budgetLimit') || 0
  S.parentMode = await db.getSetting('parentMode') || false
  // 学生信息
  S.studentName = await db.getSetting('studentName') || 'Alan'
  S.studentSchool = await db.getSetting('studentSchool') || '扬州大学附属中学'
  S.studentGrade = await db.getSetting('studentGrade') || '高一'
  S.studentCombo = await db.getSetting('studentCombo') || '物化生'
  S.gradYear = await db.getSetting('gradYear') || 2028
  S.thinking = await db.getSetting('thinking') ?? true
  S.dark = await db.getSetting('darkMode')
  if (S.dark === null) S.dark = window.matchMedia('(prefers-color-scheme:dark)').matches
  applyTheme()

  // 恢复上次会话或新建
  currentSession = await db.getSetting('lastSession') || db.newSessionId()
  await db.setSetting('lastSession', currentSession)

  // 加载聊天
  await loadChat(currentSession)

  // 加载报告
  const report = await db.getLatestReport()
  if (report) renderReport(report.content)

  // 绑定事件
  bindEvents()

  // 知识同步（GitHub Pages）
  syncKnowledge()
  // 知识新鲜度检查
  checkKnowledgeFreshness()
})()

// ===================== CSV 迁移 =====================

async function migrateCSVtoGrades() {
  const raw = await db.getSetting('csvRaw')
  if (!raw) return
  const existing = await db.getAll('grades')
  if (existing.length > 0) return  // 已迁移过

  const lines = raw.split('\n').filter(l => l.trim())
  if (lines.length < 2) return
  const h = lines[0].split(',').map(s => s.trim())
  const CORE = ['语文', '数学', '英语', '物理', '化学', '生物']
  const MAXS = { 语文: 150, 数学: 150, 英语: 150, 物理: 100, 化学: 100, 生物: 100, 政治: 100, 历史: 100, 地理: 100 }
  const dash = String.fromCharCode(8212)

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',').map(s => s.trim())
    const date = c[h.indexOf('考试日期')]
    const type = c[h.indexOf('类型')]
    const notes = c[h.indexOf('备注')] || ''
    const ys = notes.includes('分科') ? '高一下' : '高一上'
    const rankIdx = h.indexOf('年排')
    const rank = rankIdx > -1 && c[rankIdx] ? parseInt(c[rankIdx]) || null : null
    const total6 = h.indexOf('总分(6科)') > -1 ? parseFloat(c[h.indexOf('总分(6科)')]) || null : null
    const total9 = h.indexOf('总分(9科)') > -1 ? parseFloat(c[h.indexOf('总分(9科)')]) || null : null

    for (const subj of CORE) {
      const idx = h.indexOf(subj)
      if (idx === -1) continue
      const v = c[idx]
      if (!v || v === '—' || v === '-' || v === dash) continue
      const score = parseFloat(v)
      if (isNaN(score)) continue
      await db.add('grades', {
        date, type, subject: subj, score,
        fullMark: MAXS[subj],
        yearSemester: ys,
        rank, total6, total9,
        notes,
      })
    }
  }
}

// ===================== 设置 =====================

async function saveCfg() {
  await db.setSetting('apiKey', S.apiKey)
  await db.setSetting('bingApiKey', S.bingKey)
  await db.setSetting('webhookUrl', S.webhookUrl)
  await db.setSetting('chatModel', S.chatModel)
  await db.setSetting('thinkModel', S.thinkModel)
  await db.setSetting('thinking', S.thinking)
  await db.setSetting('darkMode', S.dark)
  await db.setSetting('pinCode', S.pinCode)
  await db.setSetting('budgetLimit', S.budgetLimit)
  await db.setSetting('parentMode', S.parentMode)
  await db.setSetting('studentName', S.studentName)
  await db.setSetting('studentSchool', S.studentSchool)
  await db.setSetting('studentGrade', S.studentGrade)
  await db.setSetting('studentCombo', S.studentCombo)
  await db.setSetting('gradYear', S.gradYear)
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', S.dark ? 'dark' : 'light')
  if ($('darkToggle')) $('darkToggle').classList.toggle('on', S.dark)
  if ($('themeBtn')) $('themeBtn').textContent = S.dark ? '☀️' : '🌙'
}
function toggleDark() { S.dark = !S.dark; saveCfg(); applyTheme() }

function openSettings() {
  $('settingsModal').classList.add('open')
  $('apiKey').value = S.apiKey
  $('bingKey').value = S.bingKey
  if ($('webhookUrl')) $('webhookUrl').value = S.webhookUrl
  $('chatModel').value = S.chatModel
  $('thinkModel').value = S.thinkModel
  $('thinkingToggle').classList.toggle('on', S.thinking)
  $('darkToggle').classList.toggle('on', S.dark)
  if ($('pinCode')) $('pinCode').value = S.pinCode
  if ($('budgetLimit')) $('budgetLimit').value = S.budgetLimit
  if ($('parentToggle')) $('parentToggle').classList.toggle('on', S.parentMode)
}
function closeSettings() { $('settingsModal').classList.remove('open') }
function saveSettings() {
  S.apiKey = $('apiKey').value.trim()
  S.bingKey = $('bingKey').value.trim()
  if ($('webhookUrl')) S.webhookUrl = $('webhookUrl').value.trim()
  S.chatModel = $('chatModel').value
  S.thinkModel = $('thinkModel').value
  S.thinking = $('thinkingToggle').classList.contains('on')
  if ($('pinCode')) S.pinCode = $('pinCode').value.padStart(6,'0').slice(0,6)
  if ($('budgetLimit')) S.budgetLimit = parseInt($('budgetLimit').value) || 0
  S.parentMode = $('parentToggle')?.classList.contains('on') || false
  // 加密 API Key (仅当 PIN 非默认时)
  if (S.pinCode !== '0000' && S.apiKey && window.TIPSCrypto) {
    TIPSCrypto.encrypt(S.apiKey, S.pinCode).then(enc => {
      db.setSetting('encryptedApiKey', enc)  // 加密备份，不清除明文
    })
  } else {
    db.setSetting('encryptedApiKey', null)
  }
  saveCfg()
  closeSettings()
  toast('设置已保存')
}

// ===================== Toast =====================

function toast(msg) {
  const el = $('toast')
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.add('hidden'), 2500)
}

// ===================== Tab 切换 =====================

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'))
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'))
  $(tabId).classList.add('active')
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active')
}

// ===================== 成绩导入 =====================

function updateCsvBadge() {
  const b = $('csvBadge')
  db.getAllGrades().then(exams => {
    if (exams.length) {
      const last = exams[exams.length - 1]
      b.textContent = `📊 ${last.date} ${last.type} (${Object.keys(last.scores).length}科)`
      b.classList.remove('none')
    } else {
      b.textContent = '📂 未导入成绩'
      b.classList.add('none')
    }
  })
}

async function handleUpload(e) {
  const f = e.target.files[0]
  if (!f) return
  if (f.type.startsWith('image/')) { await handleImageUpload(f); return }
  const text = await f.text()
  const raw = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  await parseAndSaveCSV(raw)
  await db.setSetting('csvRaw', raw)
  updateCsvBadge()
  toast('✅ 已导入: ' + f.name)
  const warns = await checkVolatility()
  if (warns) await showVolatilityAlert(warns)
}

async function handleImageUpload(file) {
  toast('📸 识别图片中...')
  const b64 = await compressImage(file, 1200)
  const preview = $('imgPreview')
  const modal = $('imgModal')
  if (preview) preview.src = b64
  if (modal) modal.classList.add('open')
  if ($('imgStatus')) $('imgStatus').textContent = '⏳ 识别中...'
  if ($('imgTable')) $('imgTable').innerHTML = ''

  const prompt = `你是成绩单识别助手。识别图片中所有科目和对应分数。
只返回JSON，格式：
{"date":"考试日期","type":"考试类型","yearSemester":"高一上或高一下","scores":{"语文":113}}`

  try {
    const res = await callDSVision(prompt, b64)
    if (!res) throw new Error('识别失败')
    const data = JSON.parse(res)
    if ($('imgDate')) $('imgDate').value = data.date || ''
    if ($('imgType')) $('imgType').value = data.type || '考试'
    if ($('imgYS')) $('imgYS').value = data.yearSemester || '高一下'
    renderImagePreviewTable(data.scores || {})
    if ($('imgStatus')) $('imgStatus').textContent = '✅ 确认识别结果'
  } catch (e) {
    if ($('imgStatus')) $('imgStatus').textContent = '❌ ' + e.message
  }
}

function renderImagePreviewTable(scores) {
  const el = $('imgTable')
  if (!el) return
  const MAXS = {语文:150,数学:150,英语:150,物理:100,化学:100,生物:100}
  el.innerHTML = Object.entries(scores).map(([s, v]) =>
    `<div class="img-row"><span>${s}</span>
     <input class="img-input" data-subj="${s}" value="${v}" type="number">
     <span style="color:var(--txt3);font-size:12px">/${MAXS[s]||100}</span></div>`
  ).join('')
}

async function confirmImageScores() {
  const scores = {}
  document.querySelectorAll('.img-input').forEach(inp => { scores[inp.dataset.subj] = parseFloat(inp.value) || null })
  const date = ($('imgDate')?.value) || new Date().toISOString().slice(0, 7)
  const type = ($('imgType')?.value) || '考试'
  const ys = ($('imgYS')?.value) || (date >= '2026-03' ? '高一下' : '高一上')
  for (const [subj, score] of Object.entries(scores)) {
    if (score != null) await db.add('grades', { date, type, subject: subj, score, fullMark: 100, yearSemester: ys, notes: '图片识别' })
  }
  $('imgModal').classList.remove('open')
  updateCsvBadge()
  toast('✅ 成绩已保存')
  const warns = await checkVolatility()
  if (warns) await showVolatilityAlert(warns)
}

function compressImage(file, maxDim) {
  return new Promise(ok => {
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) { const s = Math.min(maxDim/w, maxDim/h); w*=s; h*=s }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        ok(c.toDataURL('image/jpeg', 0.85))
      }; img.src = r.result
    }; r.readAsDataURL(file)
  })
}

async function callDSVision(sys, imageB64) {
  if (!S.apiKey) { toast('请先配置API Key'); return null }
  const body = {
    model: S.thinkModel,
    messages: [{ role: 'user', content: [
      { type: 'text', text: sys },
      { type: 'image_url', image_url: { url: imageB64 } }
    ]}]
  }
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer '+S.apiKey },
      body: JSON.stringify(body)
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    if (d.usage) db.logUsage(S.thinkModel, d.usage.prompt_tokens||0, d.usage.completion_tokens||0)
    return d.choices[0].message.content
  } catch (e) { toast('视觉识别出错: '+e.message); return null }
}

async function parseAndSaveCSV(raw) {
  // 去重: 删除已存在的同日期同类型数据
  const existingGrades = await db.getAll('grades')
  const lines0 = raw.split('\n').filter(l => l.trim())
  if (lines0.length >= 2) {
    const h0 = lines0[0].split(',').map(s => s.trim())
    const dIdx = h0.indexOf('考试日期')
    const tIdx = h0.indexOf('类型')
    if (dIdx > -1 && tIdx > -1) {
      for (let i = 1; i < lines0.length; i++) {
        const c0 = lines0[i].split(',').map(s => s.trim())
        const inDate = c0[dIdx], inType = c0[tIdx]
        if (inDate && inType) {
          for (const eg of existingGrades) {
            if (eg.date === inDate && eg.type === inType) {
              await db.del('grades', eg.id)
            }
          }
        }
      }
    }
  }
  const lines = raw.split('\n').filter(l => l.trim())
  if (lines.length < 2) { toast('CSV格式错误'); return }
  const h = lines[0].split(',').map(s => s.trim())
  const CORE = ['语文', '数学', '英语', '物理', '化学', '生物']
  const MAXS = { 语文: 150, 数学: 150, 英语: 150, 物理: 100, 化学: 100, 生物: 100, 政治: 100, 历史: 100, 地理: 100 }
  const dash = String.fromCharCode(8212)

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',').map(s => s.trim())
    const date = c[h.indexOf('考试日期')]
    const type = c[h.indexOf('类型')]
    const notes = c[h.indexOf('备注')] || ''
    const ys = notes.includes('分科') ? '高一下' : '高一上'
    const rankIdx = h.indexOf('年排')
    const rank = rankIdx > -1 && c[rankIdx] ? parseInt(c[rankIdx]) || null : null
    const total6 = h.indexOf('总分(6科)') > -1 ? parseFloat(c[h.indexOf('总分(6科)')]) || null : null
    const total9 = h.indexOf('总分(9科)') > -1 ? parseFloat(c[h.indexOf('总分(9科)')]) || null : null

    for (const subj of CORE) {
      const idx = h.indexOf(subj)
      if (idx === -1) continue
      const v = c[idx]
      if (!v || v === '—' || v === '-' || v === dash) continue
      const score = parseFloat(v)
      if (isNaN(score)) continue
      await db.add('grades', { date, type, subject: subj, score, fullMark: MAXS[subj], yearSemester: ys, rank, total6, total9, notes })
    }
  }
  toast('✅ 成绩解析完成')
}

// ===================== DeepSeek API =====================

async function callDS(sys, usr, model) {
  if (!S.apiKey) { toast('请先配置 API Key'); return null }
  await checkBudget()
  const m = model || S.chatModel
  const body = {
    model: m,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: usr }
    ],
    stream: false
  }
  if (S.thinking) body.thinking = { type: 'enabled' }
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.apiKey },
      body: JSON.stringify(body)
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    // 记录 Token 用量
    if (d.usage) {
      db.logUsage(m, d.usage.prompt_tokens || 0, d.usage.completion_tokens || 0)
    }
    return d.choices[0].message.content
  } catch (e) {
    toast('出错了: ' + e.message)
    return null
  }
}

// ===================== 聊天 =====================

async function loadChat(sessionId) {
  const msgs = await db.getMessages(sessionId)
  chatHistory = msgs.map(m => ({
    role: m.role,
    text: m.content,
    time: new Date(m.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    _id: m.id
  }))
  renderChat()
  autoCompress()
}

function renderChat() {
  const el = $('chatMessages')
  if (!chatHistory.length) {
    el.innerHTML = `<div class=empty-state>
      <div class=icon>🎯</div>
      <h2>Hi Alan，我是 TIPS</h2>
      <p>你的专属升学顾问。上传成绩后，我们可以聊选科、聊专业、聊未来。</p>
      <p style=font-size:12px;color:var(--txt3)>📂 点击底部「上传成绩」开始</p>
    </div>`
    return
  }
  el.innerHTML = chatHistory.map(m => {
    const content = m.role === 'assistant' ? md2html(m.text) : escHtml(m.text).replace(/\n/g, '<br>')
    return `<div class="msg ${m.role}"><div class=bubble>${content}</div><div class=time>${m.time}</div></div>`
  }).join('')
  el.scrollTop = el.scrollHeight
  renderSidebarList()
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

async function sendMessage() {
  const inp = $('chatInput')
  const txt = inp.value.trim()
  if (!txt) return
  inp.value = ''

  const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  chatHistory.push({ role: 'user', text: txt, time: now })
  await db.addMessage('user', txt, currentSession)
  renderChat()

  // 🔍 搜索模式
  if (txt.startsWith('🔍')) {
    chatHistory.push({ role: 'assistant', text: '<div class=loading-dots><span></span><span></span><span></span></div>', time: now })
    renderChat()
    const query = txt.replace(/^🔍\s*/, '')
    const reply = await searchAndInterpret(query)
    chatHistory.pop()
    if (reply) {
      const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      chatHistory.push({ role: 'assistant', text: reply, time: t })
      await db.addMessage('assistant', reply, currentSession)
    }
    renderChat()
    return
  }

  // 检查成绩是否已导入
  const grades = await db.getAllGrades()
  if (!grades.length) {
    chatHistory.push({ role: 'assistant', text: '📂 请先上传成绩CSV，我才能帮你做分析', time: now })
    await db.addMessage('assistant', '📂 请先上传成绩CSV，我才能帮你做分析', currentSession)
    renderChat()
    return
  }

  // Loading 动画
  chatHistory.push({ role: 'assistant', text: '<div class=loading-dots><span></span><span></span><span></span></div>', time: now })
  renderChat()

  const ctx = await buildContext()
  const reply = await callDS(P0, ctx + '\n\nAlan: ' + txt)
  chatHistory.pop()

  if (reply) {
    const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    // 成绩修正 [UPDATE_GRADE: date, subject, score]
    const gm = reply.match(/\[UPDATE_GRADE:\s*([^,]+),\s*([^,]+),\s*([^\]]+)\]/i)
    let dr = reply
    if (gm) {
      const score = parseFloat(gm[3].trim())
      if (!isNaN(score)) {
        const all = await db.getAll('grades')
        const hit = all.filter(g => g.date === gm[1].trim() && g.subject === gm[2].trim())
        if (hit.length) {
          const orig = hit[0].score
          hit[0].score = score
          hit[0].notes = (hit[0].notes || '') + ` 原始${orig}→修正${score}`
          await db.set('grades', hit[0])
          await db.addMemory('subject_trace', `${gm[2].trim()}(${gm[1].trim()}): 原始${orig}→修正${score}`, 'system')
        } else {
          await db.add('grades', { date: gm[1].trim(), type: '考试', subject: gm[2].trim(), score, fullMark: 100, notes: '对话修正' })
        }
        dr = reply.replace(gm[0], '').trim() + `\n\n✅ ${gm[2].trim()}(${gm[1].trim()}) 已更新`
        updateCsvBadge()
      }
    }
    chatHistory.push({ role: 'assistant', text: dr.trim(), time: t })
    await db.addMessage('assistant', dr.trim(), currentSession)
  }
  renderChat()
}

async function newConversation() {
  currentSession = db.newSessionId()
  await db.setSetting('lastSession', currentSession)
  chatHistory = []
  renderChat()
  toast('💬 新对话已开始')
}

async function buildContext() {
  const exams = await db.getAllGrades()
  const latest = exams[exams.length - 1]
  let ctx = `【学生信息】\n- ${S.studentSchool} ${S.studentGrade}\n- 选科: ${S.studentCombo}\n- 高考: ${S.gradYear}\n`
  if (latest) {
    ctx += `\n【最近考试】${latest.date} ${latest.type}\n`
    for (const [subj, score] of Object.entries(latest.scores)) {
      ctx += `- ${subj}: ${score}\n`
    }
  }
  const report = await db.getLatestReport()
  if (report) {
    ctx += '\n【最新报告摘要】\n' + report.summary + '\n'
  }
  return ctx
}

// ===================== 学情上下文 =====================

function buildGradeContext(grades) {
  return grades.map(ex =>
    `${ex.date} ${ex.type}: ` + Object.entries(ex.scores).map(([s, v]) => `${s}${v}`).join(' ')
  ).join('\n')
}

// ===================== 全链路分析 v1.0 =====================

let _analysisAbort = false

async function runFullAnalysis() {
  const grades = await db.getAllGrades()
  if (!grades.length) { toast('请先导入成绩'); return }
  if (!S.apiKey) { toast('请先配置 API Key'); return }

  const btn = $('btnAnalyze')
  const progress = $('progressBar')
  btn.textContent = '⏳ 分析中...'
  btn.disabled = true
  if (progress) progress.classList.remove('hidden')
  _analysisAbort = false

  const gradeText = buildGradeContext(grades)
  let a2, a4i, a3, a4m, a1

  // Agent2 学情分析
  setProgress('📊 学情分析...', 15)
  a2 = await callDS(P2, '成绩数据:\n' + gradeText, S.thinkModel)
  if (!a2 || _analysisAbort) { resetBtn(); return }

  // Agent4 产业趋势
  setProgress('🏭 产业趋势分析...', 35)
  a4i = await callDS(P4I, '学情数据:\n' + a2, S.thinkModel)
  if (!a4i || _analysisAbort) { resetBtn(); return }
  // 缓存产业知识
  await db.addMemory('interest', '产业趋势分析:\n' + a4i.slice(0, 500), 'analysis')

  // Agent3 组合策略
  setProgress('🎯 组合策略分析...', 55)
  a3 = await callDS(P3, `学情:\n${a2}\n\n产业趋势:\n${a4i}`, S.thinkModel)
  if (!a3 || _analysisAbort) { resetBtn(); return }

  // Agent4 专业院校
  setProgress('🏫 专业院校匹配...', 75)
  a4m = await callDS(P4M, `策略:\n${a3}\n\n产业趋势:\n${a4i}`, S.thinkModel)
  if (!a4m || _analysisAbort) { resetBtn(); return }

  // Agent1 总控报告
  setProgress('📋 生成总控报告...', 90)
  a1 = await callDS(P1,
    `【Agent2 学情报告】\n${a2}\n\n【Agent4 产业趋势】\n${a4i}\n\n【Agent3 组合策略】\n${a3}\n\n【Agent4 专业院校】\n${a4m}\n\n请整合以上所有分析结果，输出完整结构化报告。`,
    S.thinkModel
  )

  if (a1 && !_analysisAbort) {
    await db.saveReport(a1, a1.slice(0, 200), [], 'manual', 'v1.0')
    renderReport(a1)
    setProgress('✅ 报告生成完成', 100)
    sendAlert('📋 新报告已生成', '全链路分析完成')
    toast('✅ 全链路分析完成')
    // 切换到报告 Tab
    setTimeout(() => switchTab('tabReports'), 500)
  }
  resetBtn()
  function resetBtn() { btn.textContent = '🔄 全链路分析'; btn.disabled = false; if (progress) progress.classList.add('hidden') }
}

function setProgress(text, pct) {
  const el = $('progressText')
  const bar = $('progressFill')
  if (el) el.textContent = text
  if (bar) bar.style.width = pct + '%'
}

// ===================== 学情 Tab 渲染 =====================

const TIER_MAP = { 优势: { color: 'green', label: '优势' }, 稳定: { color: 'blue', label: '稳定' }, 临界提分: { color: 'orange', label: '临界' }, 薄弱: { color: 'red', label: '薄弱' } }

let _gradesTabPending = false

async function renderGradesTab() {
  if (_gradesTabPending) return
  _gradesTabPending = true

  const grades = await db.getAllGrades()
  const container = $('subjectGrid')
  if (!container) { _gradesTabPending = false; return }

  if (!grades.length) {
    container.innerHTML = '<div class=tab-placeholder><span class=icon>📊</span><h3>暂无成绩数据</h3><p>上传成绩CSV后将在此显示学情分析</p></div>'
    _gradesTabPending = false
    return
  }

  renderSubjectCards(grades, container)

  // 延迟到下一帧渲染图表，避免布局抖动
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      TC.subjectTrend('chartTrend', grades)
      TC.abilityRadar('chartRadar', grades)
      TC.totalTrend('chartTotal', grades)
      TC.volatilityBar('chartVol', grades)
      _gradesTabPending = false
    })
  })
}

function renderSubjectCards(grades, container) {
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date))
  const MAXS = { 语文: 150, 数学: 150, 英语: 150, 物理: 100, 化学: 100, 生物: 100 }
  const subjects = ['语文', '数学', '英语', '物理', '化学', '生物']

  let html = '<div class="subject-grid">'
  for (const subj of subjects) {
    const vals = sorted.map(g => g.scores[subj]).filter(v => v != null)
    if (!vals.length) continue
    const recent = vals[vals.length - 1]
    const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10
    const rate = Math.round(recent / MAXS[subj] * 100)
    const trend = vals.length >= 2 ? (vals[vals.length - 1] > vals[0] ? '↑' : vals[vals.length - 1] < vals[0] ? '↓' : '→') : '—'
    const cv = vals.length >= 2
      ? Math.round(Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length) / avg * 100)
      : 0
    const tier = rate >= 85 && cv < 10 ? '优势' : rate >= 75 && cv < 15 ? '稳定' : rate >= 60 ? '临界提分' : '薄弱'
    const t = TIER_MAP[tier] || { color: 'orange', label: tier }

    html += `<div class="subject-card">
      <div class="s-row"><span class="s-name">${subj}</span><span class="tag tag-${t.color}">${t.label}</span></div>
      <div class="s-score">${recent}<span class="s-max">/${MAXS[subj]}</span></div>
      <div class="s-bar"><div class="s-bar-fill ${t.color}" style="width:${rate}%"></div></div>
      <div class="s-meta"><span>均分 ${avg}</span><span>趋势 ${trend}</span><span>CV ${cv}%</span></div>
    </div>`
  }
  html += '</div>'
  container.innerHTML = html
}

// ===================== 波动检测 =====================

async function checkVolatility() {
  const grades = await db.getAllGrades()
  if (grades.length < 2) return null
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const warnings = []

  for (const subj of Object.keys(last.scores)) {
    if (prev.scores[subj]) {
      const change = (last.scores[subj] - prev.scores[subj]) / prev.scores[subj]
      if (Math.abs(change) >= 0.15) {
        warnings.push({ subject: subj, from: prev.scores[subj], to: last.scores[subj], direction: change > 0 ? 'up' : 'down', pct: Math.round(Math.abs(change) * 100) })
      }
    }
  }
  return warnings.length ? warnings : null
}

async function showVolatilityAlert(warnings) {
  const msg = warnings.map(w =>
    `⚠️ ${w.subject}: ${w.from}→${w.to} (${w.direction === 'down' ? '↓' : '↑'}${w.pct}%)`
  ).join('<br>')
  const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  chatHistory.push({ role: 'assistant', text: `📊 检测到成绩波动\n${msg}\n\n需要我启动全链路分析看看影响吗？`, time: now })
  sendAlert('📊 成绩波动', warnings.map(w => w.subject + ' ' + (w.direction==='down'?'↓':'↑') + w.pct + '%').join('\n'))
  await db.addMessage('assistant', `📊 检测到成绩波动:\n${warnings.map(w => `${w.subject} ${w.direction === 'down' ? '↓' : '↑'}${w.pct}%`).join(', ')}`, currentSession)
  renderChat()
}

// ===================== 知识同步 (GitHub → PAD) =====================

const GITHUB_PAGES_URL = 'https://popbooth.github.io/alan/'

async function syncKnowledge() {
  if (!GITHUB_PAGES_URL) return
  try {
    const r = await fetch(GITHUB_PAGES_URL + 'memory-bundle.json?t=' + Date.now())
    if (!r.ok) return
    const remote = await r.json()
    const local = await db.get('knowledge_index', 'version')
    if (local === remote.version) return // 已是最新
    // 导入新知识
    let count = 0
    for (const [filepath, content] of Object.entries(remote.files || {})) {
      const cat = filepath.split('/')[0]
      await db.add('knowledge_index', { id: filepath, category: cat, content, version: remote.version, syncedAt: Date.now() })
      count++
    }
    await db.set('knowledge_index', { id: 'version', version: remote.version, syncedAt: Date.now() })
    toast('📚 已同步 ' + count + ' 条知识')
  } catch (e) { /* 静默 */ }
}

/** 检查本地知识新鲜度，过期时自动搜索刷新 */
async function checkKnowledgeFreshness() {
  try {
    const r = await fetch('./memory/index.json?t=' + Date.now())
    if (!r.ok) return
    const idx = await r.json()
    const now = Date.now()
    const expired = (idx.entries || []).filter(e => e.expires && new Date(e.expires).getTime() < now)
    if (!expired.length) return
    const names = expired.map(e => e.title).join('、')
    await db.addMemory('milestone', '知识过期: ' + names, 'system')
    if (S.bingKey) {
      for (const entry of expired.slice(0, 2)) {
        toast('🔍 刷新: ' + entry.title)
        const results = await bingSearch(entry.title + ' 2026 最新')
        if (results) {
          const summary = results.map(r => r.name + ': ' + r.snippet).slice(0, 3).join('\n')
          await db.addMemory('interest', '自动刷新: ' + entry.title + '\n' + summary, 'search')
        }
      }
    }
  } catch (e) { /* 静默 */ }
}

// ===================== Bing 搜索 =====================

async function bingSearch(query) {
  if (!S.bingKey) return null
  const cacheKey = 'bing_' + query
  const cached = await db.get('search_cache', cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.results
  try {
    const url = 'https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(query) + '&mkt=zh-CN&count=5'
    const r = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': S.bingKey } })
    const d = await r.json()
    const results = d.webPages?.value || []
    await db.set('search_cache', { id: cacheKey, query, results, expiresAt: Date.now() + 86400000 })
    return results
  } catch (e) { toast('搜索出错: ' + e.message); return null }
}

async function searchAndInterpret(query) {
  const results = await bingSearch(query)
  if (!results || !results.length) return '🔍 未搜索到相关信息。请检查Bing API Key是否配置正确。'
  const context = results.map((r, i) => `${i+1}. ${r.name}\n${r.snippet}`).join('\n\n')
  const reply = await callDS('你是TIPS的信息搜索助手。基于以下搜索结果回答用户问题。引用信息来源。', `搜索结果:\n${context}\n\n用户问题: ${query}`)
  if (reply) await db.addMemory('interest', '搜索: ' + query + '\n' + reply.slice(0, 300), 'search')
  return reply || '🔍 无法解读搜索结果'
}

// ===================== 家长面板 & 预算控制 =====================

function openParentPanel() {
  $('parentModal').classList.add('open')
  $('parentPinGroup').style.display = 'block'
  $('parentContent').style.display = 'none'
  $('parentPinInput').value = ''
  $('parentPinInput').focus()
}

function unlockParentPanel() {
  const input = $('parentPinInput').value
  if (input !== S.pinCode) { toast('密码错误'); return }
  $('parentPinGroup').style.display = 'none'
  $('parentContent').style.display = 'block'
  if ($('parentBudget')) $('parentBudget').value = S.budgetLimit
  renderParentDashboard()
}

async function renderParentDashboard() {
  const usage = await db.getMonthlyUsage()
  if ($('parentUsage')) $('parentUsage').textContent = usage.toLocaleString()
  const logs = await db.getAll('usage_log')
  TC.usageTrend('parentUsageChart', logs)
  // 显示观察报告
  const reports = await db.getMemoryByType('parent_report')
  const el = $('parentReports')
  if (!el) return
  if (!reports.length) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--txt3);font-size:13px">暂无观察报告<br><span style="font-size:11px">孩子多聊几次后会自动生成</span></div>'
    return
  }
  el.innerHTML = reports.slice(-10).reverse().map(r => {
    let d = typeof r.content === 'string' ? (() => { try { return JSON.parse(r.content) } catch(e) { return {summary: r.content} } })() : r.content
    const icon = d.mood === 'positive' ? '😊' : d.mood === 'negative' ? '😟' : '😐'
    const concerns = d.concerns && d.concerns.length ? '<div style="font-size:12px;color:var(--orange);margin-top:4px">⚠️ ' + d.concerns.join('、') + '</div>' : ''
    return '<div style="background:var(--bg-input);border-radius:var(--r);padding:10px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
        '<span>' + icon + ' 情绪: ' + (d.mood || '未知') + '</span>' +
        '<span style="color:var(--txt3)">' + (r.date || '') + '</span>' +
      '</div>' +
      '<div style="font-size:13px;line-height:1.5">' + (d.summary || d.content || '') + '</div>' +
      concerns +
    '</div>'
  }).join('')
}

async function saveParentBudget() {
  S.budgetLimit = parseInt($('parentBudget').value) || 0
  await db.setSetting('budgetLimit', S.budgetLimit)
  toast('预算已保存')
}

async function exportData() {
  const data = {
    version: '1.5', exportDate: new Date().toISOString(),
    grades: await db.getAll('grades'), conversations: await db.getAll('conversations'),
    reports: await db.getAll('reports'), memory: await db.getAll('memory'),
    knowledge: await db.getAll('knowledge_index'),
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  a.download = 'TIPS-backup-' + new Date().toISOString().slice(0, 10) + '.json'
  a.click()
  toast('📤 数据已导出')
}

async function importData(e) {
  const f = e.target.files[0]
  if (!f) return
  try {
    const data = JSON.parse(await f.text())
    if (!data.version) throw new Error('格式错误')
    if (data.grades) for (const g of data.grades) await db.add('grades', g)
    if (data.memory) for (const m of data.memory) await db.add('memory', m)
    toast('📥 导入完成，刷新中...')
    setTimeout(() => location.reload(), 1000)
  } catch (e) { toast('导入失败: ' + e.message) }
}

async function clearData() {
  if (!confirm('确定清除所有本地数据？')) return
  for (const s of ['grades','conversations','reports','memory','search_cache','usage_log']) await db.clear(s)
  toast('🗑️ 已清除')
  location.reload()
}

async function checkBudget() {
  if (!S.budgetLimit) return
  const usage = await db.getMonthlyUsage()
  const limit = S.budgetLimit * 1000
  const pct = usage / limit
  if (pct >= 1.0) {
    S.chatModel = 'deepseek-v4-flash'
    await db.setSetting('chatModel', S.chatModel)
    toast('💰 月预算用完，已切换至Flash')
  } else if (pct >= 0.9) {
    toast('⚠️ 月预算已用90%')
  }
}

// ===================== 报告 =====================

function renderReport(md) {
  const el = $('reportPanel')
  el.innerHTML = md2html(md)
}

function md2html(t) {
  let r = t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/^### (.+)/gm,'<h4>$1</h4>').replace(/^## (.+)/gm,'<h3>$1</h3>').replace(/^# (.+)/gm,'<h2>$1</h2>')
  // Tables: 整块匹配, 跳过分隔行(|---|), 合并为一个 <table>
  r = r.replace(/(?:^\|.+\|\n?)+/gm, block => {
    const rows = block.trim().split('\n').filter(l => !l.match(/^\|[-: ]+\|/))
    if (!rows.length) return ''
    return '<table>' + rows.map(row =>
      '<tr>' + row.split('|').filter(c => c.trim()).map(c => '<td>' + c.trim() + '</td>').join('') + '</tr>'
    ).join('') + '</table>'
  })
  r = r
    .replace(/^- \[x\] (.+)/gm,'<li class="checked">&#x2705; $1</li>')
    .replace(/^- \[ \] (.+)/gm,'<li class="unchecked">&#x2B1C; $1</li>')
    .replace(/^- (.+)/gm,'<li>$1</li>')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/([^>])\n/g,'$1<br>\n')
  return r
}

// ===================== 保存个人信息 =====================

function saveProfile() {
  S.studentName = ($('editName')?.value || 'Alan').trim()
  S.studentSchool = ($('editSchool')?.value || '扬州大学附属中学').trim()
  S.studentGrade = ($('editGrade')?.value || '高一').trim()
  S.studentCombo = ($('editCombo')?.value || '物化生').trim()
  S.gradYear = parseInt($('editGradYear')?.value) || 2028
  saveCfg()
  toast('✅ 信息已保存')
}

// ===================== 界面列表 =====================

async function renderSidebarList() {
  const el = $('sidebarList')
  if (!el) return
  const sessions = await db.getSessions()
  if (!sessions.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt3);font-size:13px">暂无历史对话</div>'; return }
  el.innerHTML = sessions.map(s =>
    `<div class="sidebar-item ${s.sessionId === currentSession ? 'active' : ''}" onclick="switchSidebarSession('${s.sessionId}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.previewTitle || '对话'}</span>
        <span class="si-time" style="font-size:10px;opacity:.6;flex-shrink:0">${s.count}条</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">
        <span class="si-time" style="font-size:11px;opacity:.5">${formatSessionDate(s.lastTime)}</span>
        <span onclick="event.stopPropagation();deleteSession('${s.sessionId}')" style="font-size:14px;opacity:.4;cursor:pointer;padding:2px 4px;border-radius:4px">✕</span>
      </div>
    </div>`
  ).join('')
}

function switchSidebarSession(sid) {
  if (sid === currentSession) return
  currentSession = sid
  db.setSetting('lastSession', currentSession)
  loadChat(currentSession)
  renderSidebarList()
  // 窄屏自动关闭侧边栏
  if (window.innerWidth <= 700) $('chatSidebar').classList.remove('open')
}

function formatSessionDate(ts) {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (sameDay) return '今天 ' + d.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })
  if (isYesterday) return '昨天 ' + d.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })
  return d.toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })
}

// ===================== 删除对话 =====================

async function deleteSession(sid) {
  if (!confirm('删除这个对话？')) return
  const all = await db.getAll('conversations')
  for (const m of all) { if (m.sessionId === sid) await db.del('conversations', m.id) }
  if (sid === currentSession) newConversation()
  else renderSidebarList()
  toast('🗑️ 已删除')
}

async function deleteMessage(msgId) {
  await db.del('conversations', msgId)
  await loadChat(currentSession)
}

// ===================== 记忆自动压缩 =====================

let _lastCompress = 0

async function analyzeChildState() {
  try {
    const recent = await db.getRecentMessages(30)
    if (recent.length < 5) return
    const text = recent.map(m => (m.role === 'user' ? '学生' : 'AI') + ': ' + (m.content || '').slice(0,200)).join('\n')
    const res = await callDS(P_OBSERVER, text, 'deepseek-v4-flash')
    if (!res) return
    await db.addMemory('parent_report', JSON.parse(res), 'system')
  } catch(e) {}
}


async function sendAlert(title, msg) {
  if (!S.webhookUrl) return
  try {
    const payload = JSON.stringify({ content: '**' + title + '**\n' + msg })
    await fetch(S.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
  } catch(e) {}
}



async function exportAllData() {
  const data = {
    version: '2.1', exportDate: new Date().toISOString(),
    grades: await db.getAll('grades'),
    conversations: await db.getAll('conversations'),
    reports: await db.getAll('reports'),
    memory: await db.getAll('memory'),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'TIPS-data-' + new Date().toISOString().slice(0, 10) + '.json'
  a.click()
  toast('📤 数据已导出')
}

async function exportConfig() {
  // 如果 API Key 被加密了，尝试解密后导出
  let expKey = S.apiKey
  if (!expKey) {
    const encrypted = await db.getSetting('encryptedApiKey')
    if (encrypted && window.TIPSCrypto) {
      const decrypted = await TIPSCrypto.decrypt(encrypted, S.pinCode)
      if (decrypted) expKey = decrypted
    }
  }
  const data = {
    version: 2,
    exportDate: new Date().toISOString(),
    settings: {
      apiKey: expKey, bingKey: S.bingKey, webhookUrl: S.webhookUrl,
      chatModel: S.chatModel, thinkModel: S.thinkModel,
      pinCode: S.pinCode, budgetLimit: S.budgetLimit,
      darkMode: S.dark, thinking: S.thinking, parentMode: S.parentMode,
      studentName: S.studentName, studentSchool: S.studentSchool,
      studentGrade: S.studentGrade, studentCombo: S.studentCombo, gradYear: S.gradYear
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}))
  a.download = 'TIPS-config.json'
  a.click()
  toast('✅ 配置已导出')
}

async function importConfig(e) {
  const f = e.target.files[0]
  if (!f) return
  try {
    const data = JSON.parse(await f.text())
    if (!data.settings) throw new Error('格式错误')
    const s = data.settings
    if (s.apiKey) { S.apiKey = s.apiKey; await db.setSetting('apiKey', s.apiKey) }
    if (s.bingKey) { S.bingKey = s.bingKey; await db.setSetting('bingApiKey', s.bingKey) }
    if (s.webhookUrl) { S.webhookUrl = s.webhookUrl; await db.setSetting('webhookUrl', s.webhookUrl) }
    if (s.chatModel) { S.chatModel = s.chatModel; await db.setSetting('chatModel', s.chatModel) }
    if (s.thinkModel) { S.thinkModel = s.thinkModel; await db.setSetting('thinkModel', s.thinkModel) }
    if (s.pinCode) { S.pinCode = s.pinCode; await db.setSetting('pinCode', s.pinCode) }
    if (s.budgetLimit) { S.budgetLimit = s.budgetLimit; await db.setSetting('budgetLimit', s.budgetLimit) }
    if (s.studentName) { S.studentName = s.studentName; await db.setSetting('studentName', s.studentName) }
    if (s.studentSchool) { S.studentSchool = s.studentSchool; await db.setSetting('studentSchool', s.studentSchool) }
    if (s.studentGrade) { S.studentGrade = s.studentGrade; await db.setSetting('studentGrade', s.studentGrade) }
    if (s.studentCombo) { S.studentCombo = s.studentCombo; await db.setSetting('studentCombo', s.studentCombo) }
    if (s.gradYear) { S.gradYear = s.gradYear; await db.setSetting('gradYear', s.gradYear) }
    if (s.darkMode !== undefined) { S.dark = s.darkMode; await db.setSetting('darkMode', s.darkMode); applyTheme() }
    if (s.thinking !== undefined) { S.thinking = s.thinking; await db.setSetting('thinking', s.thinking) }
    if (s.parentMode !== undefined) { S.parentMode = s.parentMode; await db.setSetting('parentMode', s.parentMode) }
    toast('✅ 配置已导入，刷新中...')
    setTimeout(() => location.reload(), 1000)
  } catch(e) { toast('导入失败: ' + e.message) }
}

async function checkAppUpdate() {
  try {
    const r = await fetch(GITHUB_PAGES_URL + '?t=' + Date.now())
    const cache = await caches.match('./index.html')
    if (cache) {
      const cached = await cache.text()
      const fresh = await r.clone().text()
      if (cached !== fresh) { toast('🔄 更新中...'); setTimeout(() => location.reload(true), 1000); return }
    }
    toast('✅ 已是最新')
  } catch(e) { toast('检查失败') }
}

async function autoCompress() {
  if (Date.now() - _lastCompress < 3600000) return
  const all = await db.getAll('memory')
  if (all.length < 5) return
  _lastCompress = Date.now()
  if (Math.random() < 0.2) analyzeChildState()
  await db.addMemory('milestone', '记忆自动归档: 当前共' + all.length + '条', 'system')
}

// ===================== 我的Tab =====================

async function renderProfileTab() {
  const el = $('profileContent')
  if (!el) return

  const grades = await db.getAllGrades()
  const memories = await db.getAll('memory')
  const usage = await db.getMonthlyUsage()
  const report = await db.getLatestReport()

  el.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">🎯</div>
      <div class="profile-info">
        <input class="profile-edit-name" id="editName" value="${S.studentName}" style="font-size:18px;font-weight:700;background:transparent;border:none;color:var(--txt);width:100%;font-family:var(--font);outline:none">
        <div style="display:flex;gap:4px;margin-top:2px">
          <input id="editSchool" value="${S.studentSchool}" style="flex:1;font-size:13px;background:var(--bg-input);border:none;border-radius:6px;padding:3px 6px;color:var(--txt2);font-family:var(--font);outline:none">
          <select id="editGrade" style="width:70px;font-size:13px;background:var(--bg-input);border:none;border-radius:6px;padding:3px 6px;text-align:center;color:var(--txt2);font-family:var(--font);outline:none"><option value="高一" ${S.studentGrade === '高一' ? 'selected' : ''}>高一</option><option value="高二" ${S.studentGrade === '高二' ? 'selected' : ''}>高二</option><option value="高三" ${S.studentGrade === '高三' ? 'selected' : ''}>高三</option></select>
        </div>
        <div style="display:flex;gap:4px;margin-top:2px">
          <input id="editCombo" list="comboList" value="${S.studentCombo}" style="flex:1;font-size:12px;background:var(--bg-input);border:none;border-radius:6px;padding:3px 6px;color:var(--txt3);font-family:var(--font);outline:none"><datalist id="comboList"><option value="物化生"><option value="物化地"><option value="物化政"><option value="物生地"><option value="物生政"><option value="物地政"><option value="历政地"><option value="历生政"><option value="历生地"><option value="历化政"><option value="历化地"><option value="历化生"></datalist>
          <input id="editGradYear" value="${S.gradYear}" style="width:70px;font-size:12px;background:var(--bg-input);border:none;border-radius:6px;padding:3px 6px;text-align:center;color:var(--txt3);font-family:var(--font);outline:none">
          <button class="btn btn-primary" onclick="saveProfile()" style="padding:3px 10px;font-size:11px">保存</button>
        </div>
      </div>
    </div>

    <div class="profile-stats">
      <div class="stat-item"><span class="stat-num">${grades.length || 0}</span><span class="stat-label">考试</span></div>
      <div class="stat-item"><span class="stat-num">${memories.length || 0}</span><span class="stat-label">记忆</span></div>
      <div class="stat-item"><span class="stat-num">${usage ? (usage/1000).toFixed(0) : 0}K</span><span class="stat-label">本月Token</span></div>
      <div class="stat-item"><span class="stat-num">${report ? 'v' + report.version : '—'}</span><span class="stat-label">最新报告</span></div>
    </div>

    <div class="profile-section">
      <h3>🧠 记忆系统</h3>
      <div class="memory-list" id="memoryList">
        <div class="memory-item"><span>学科轨迹</span><span class="tag tag-blue">${memories.filter(m => m.type === 'subject_trace').length}条</span></div>
        <div class="memory-item"><span>兴趣方向</span><span class="tag tag-orange">${memories.filter(m => m.type === 'interest').length}条</span></div>
        <div class="memory-item"><span>情绪记录</span><span class="tag tag-blue">${memories.filter(m => m.type === 'emotion').length}条</span></div>
        <div class="memory-item"><span>关键节点</span><span class="tag tag-green">${memories.filter(m => m.type === 'milestone').length}条</span></div>
      </div>
    </div>

    <div style="padding:0 16px;margin-top:12px">
      <button class="btn btn-secondary" onclick="document.getElementById('settingsBtn').click()" style="width:100%;justify-content:center">⚙️ 打开设置</button>
    </div>
    
    ${S.parentMode ? `
    <div style="padding:0 16px;margin-top:8px">
      <button class="btn btn-primary" onclick="openParentPanel()" style="width:100%;justify-content:center">🔐 家长面板</button>
    </div>` : ''}

    <div style="display:flex;gap:8px;padding:0 16px;margin-top:8px">
      <button class="btn btn-secondary" onclick="document.getElementById('impCfgFile').click()" style="flex:1;justify-content:center">📥 导入配置</button>
      <button class="btn btn-secondary" onclick="checkAppUpdate()" style="flex:1;justify-content:center">🔄 检查更新</button>
    </div>
    <input type="file" id="impCfgFile" accept=".json" hidden onchange="importConfig(event)">

    <div class="profile-about">
      <p>TIPS v2.1.0 · 2026-05-29</p>
      <p style="font-size:11px;color:var(--txt3)">数据仅存储在本设备 IndexedDB</p>
    </div>`
}

// ===================== 事件绑定 =====================

function bindEvents() {
  // Tab 切换
  document.querySelectorAll('.tab-item').forEach(el => {
    el.onclick = () => {
      const tabId = el.dataset.tab
      switchTab(tabId)
      // 切换时渲染对应内容
      if (tabId === 'tabChat') renderSidebarList()
      if (tabId === 'tabGrades') renderGradesTab()
      if (tabId === 'tabProfile') renderProfileTab()
    }
  })

  // 聊天
  $('btnSend').onclick = sendMessage
  $('chatInput').onkeydown = e => { if (e.key === 'Enter') sendMessage() }
  $('btnNewChat').onclick = newConversation

  // 成绩上传
  $('btnUpload').onclick = () => $('fileInput').click()
  $('fileInput').onchange = handleUpload

  // 侧边栏新对话
  $('sidebarNewChat').onclick = newConversation
  // 侧边栏开关
  $('btnToggleSidebar').onclick = () => {
    if (window.innerWidth <= 700) $('chatSidebar').classList.toggle('open')
    else $('chatSidebar').classList.toggle('hidden')
    renderSidebarList()
  }

  // 搜索
  $('btnSearch').onclick = () => {
    const q = $('chatInput').value.trim()
    if (q) { $('chatInput').value = '🔍 ' + q; sendMessage() }
    else toast('输入搜索内容')
  }

  // 家长面板
  $('btnParentUnlock').onclick = unlockParentPanel
  $('parentBudget').onchange = saveParentBudget
  $('importFile').onchange = importData

  // 分析 (v1.0 全链路)
  $('btnAnalyze').onclick = runFullAnalysis

  // 主题 & 设置
  $('themeBtn').onclick = toggleDark
  $('settingsBtn').onclick = openSettings
  $('btnSaveSettings').onclick = saveSettings
  $('btnCloseSettings').onclick = closeSettings
  $('settingsModal').onclick = e => { if (e.target === $('settingsModal')) closeSettings() }
  $('thinkingToggle').onclick = function () { this.classList.toggle('on') }
  $('darkToggle').onclick = toggleDark
  $('parentToggle').onclick = function () { this.classList.toggle('on') }

  // 初始化状态
  updateCsvBadge()
}
