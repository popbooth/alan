/**
 * db.js — TIPS IndexedDB 持久层
 * v0.5: 所有数据存储统一封装
 */

const DB_NAME = 'TIPS_DB'
const DB_VER = 1

/** 存储定义: { storeName: { keyPath, indexes } } */
const SCHEMA = {
  settings:        { keyPath: 'key' },
  conversations:   { keyPath: 'id', auto: true, idx: [['timestamp'], ['sessionId']] },
  grades:          { keyPath: 'id', auto: true, idx: [['date'], ['subject']] },
  reports:         { keyPath: 'id', auto: true, idx: [['date']] },
  memory:          { keyPath: 'id', auto: true, idx: [['type'], ['date']] },
  search_cache:    { keyPath: 'id', auto: true, idx: [['query'], ['expiresAt']] },
  usage_log:       { keyPath: 'id', auto: true, idx: [['date'], ['model']] },
  knowledge_index: { keyPath: 'id', auto: true, idx: [['category']] },
}

/** 打开/获取 DB 实例 (单例) */
let _db = null
async function openDB() {
  if (_db) return _db
  return new Promise((ok, no) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = e => {
      const db = e.target.result
      for (const [name, def] of Object.entries(SCHEMA)) {
        if (db.objectStoreNames.contains(name)) continue
        const st = def.keyPath
          ? db.createObjectStore(name, { keyPath: def.keyPath, autoIncrement: !!def.auto })
          : db.createObjectStore(name, { autoIncrement: true })
        if (def.idx) def.idx.forEach(i => st.createIndex(i[0], i[0], { unique: !!i[1] }))
      }
    }
    req.onsuccess = e => { _db = e.target.result; ok(_db) }
    req.onerror = () => no(req.error)
  })
}

/** 通用: 取单条 */
async function get(store, key) {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readonly')
    const r = t.objectStore(store).get(key)
    r.onsuccess = () => ok(r.result || null)
    r.onerror = () => no(r.error)
  })
}

/** 通用: 取全部 */
async function getAll(store) {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readonly')
    const r = t.objectStore(store).getAll()
    r.onsuccess = () => ok(r.result || [])
    r.onerror = () => no(r.error)
  })
}

/** 通用: 按索引查询 (range 可选, count 可选) */
async function query(store, idxName, range, dir = 'next') {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readonly')
    const idx = t.objectStore(store).index(idxName)
    const r = idx.openCursor(range, dir)
    const res = []
    r.onsuccess = () => {
      const c = r.result
      if (c) { res.push(c.value); c.continue() }
      else ok(res)
    }
    r.onerror = () => no(r.error)
  })
}

/** 通用: 写入 (新增或覆盖) */
async function set(store, data) {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readwrite')
    const r = t.objectStore(store).put(data)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => no(r.error)
  })
}

/** 通用: 新增 (auto id) */
async function add(store, data) {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readwrite')
    const r = t.objectStore(store).add(data)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => no(r.error)
  })
}

/** 通用: 删除 */
async function del(store, key) {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readwrite')
    const r = t.objectStore(store).delete(key)
    r.onsuccess = () => ok()
    r.onerror = () => no(r.error)
  })
}

/** 通用: 清空 */
async function clear(store) {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readwrite')
    const r = t.objectStore(store).clear()
    r.onsuccess = () => ok()
    r.onerror = () => no(r.error)
  })
}

/** 通用: 计数 */
async function count(store, idxName, range) {
  const db = await openDB()
  return new Promise((ok, no) => {
    const t = db.transaction(store, 'readonly')
    const src = idxName ? t.objectStore(store).index(idxName) : t.objectStore(store)
    const r = src.count(range)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => no(r.error)
  })
}

// ==================== 便捷方法 ====================

/** 设置单项 */
async function setSetting(key, value) {
  return set('settings', { key, value })
}

/** 读取单项 */
async function getSetting(key) {
  const r = await get('settings', key)
  return r ? r.value : null
}

/** 从 localStorage 迁移旧数据到 IndexedDB */
async function migrateFromLocalStorage() {
  const items = [
    ['apiKey',          localStorage.getItem('afp_settings') ? JSON.parse(localStorage.getItem('afp_settings')).apiKey : null],
    ['chatModel',       localStorage.getItem('afp_settings') ? JSON.parse(localStorage.getItem('afp_settings')).chatModel : 'deepseek-v4-pro'],
    ['thinkModel',      localStorage.getItem('afp_settings') ? JSON.parse(localStorage.getItem('afp_settings')).thinkModel : 'deepseek-v4-pro[1m]'],
    ['thinking',        localStorage.getItem('afp_settings') ? JSON.parse(localStorage.getItem('afp_settings')).thinking ?? true : true],
    ['darkMode',        localStorage.getItem('afp_settings') ? JSON.parse(localStorage.getItem('afp_settings')).dark ?? null : null],
    ['csvRaw',          localStorage.getItem('afp_csv') || null],
    ['lastReport',      localStorage.getItem('afp_report') || null],
  ]
  for (const [k, v] of items) {
    if (v !== null) await setSetting(k, v)
  }

  // 迁移聊天记录
  const oldChat = JSON.parse(localStorage.getItem('afp_chat') || '[]')
  for (const msg of oldChat) {
    await add('conversations', {
      role: msg.role,
      content: msg.text || msg.content,
      timestamp: msg.timestamp || Date.now(),
      sessionId: 'legacy',
    })
  }
}

/** 生成新会话 ID */
function newSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

/** 添加聊天消息 */
async function addMessage(role, content, sessionId) {
  return add('conversations', {
    role,
    content,
    timestamp: Date.now(),
    sessionId: sessionId || 'default',
  })
}

/** 获取某会话的消息 (按时间) */
async function getMessages(sessionId, limit = 50) {
  const all = await query('conversations', 'sessionId', IDBKeyRange.only(sessionId))
  all.sort((a, b) => a.timestamp - b.timestamp)
  return all.slice(-limit)
}

/** 获取最新 N 条消息 (跨会话) */
async function getRecentMessages(n = 10) {
  const all = await getAll('conversations')
  all.sort((a, b) => b.timestamp - a.timestamp)
  return all.slice(0, n)
}

/** 获取所有会话列表 */
async function getSessions() {
  const all = await getAll('conversations')
  const map = {}
  for (const m of all) {
    if (!map[m.sessionId]) map[m.sessionId] = { sessionId: m.sessionId, count: 0, lastTime: 0 }
    map[m.sessionId].count++
    if (m.timestamp > map[m.sessionId].lastTime) map[m.sessionId].lastTime = m.timestamp
  }
  return Object.values(map).sort((a, b) => b.lastTime - a.lastTime)
}

/** 保存成绩 (单科) */
async function saveGrade(date, type, subject, score, fullMark, yearSemester, notes) {
  return add('grades', { date, type, subject, score, fullMark, yearSemester, notes: notes || '' })
}

/** 保存整次考试 */
async function saveExam(date, type, scores, fullMarks, yearSemester, notes) {
  for (const subj of Object.keys(scores)) {
    if (scores[subj] != null) {
      await add('grades', {
        date, type, subject: subj, score: scores[subj],
        fullMark: fullMarks[subj] || 100,
        yearSemester: yearSemester || '',
        notes: notes || '',
      })
    }
  }
}

/** 读取全部成绩 (按时间排序) */
async function getAllGrades() {
  const all = await getAll('grades')
  // 按 date + type 分组
  const examMap = {}
  for (const g of all) {
    const key = g.date + '|' + g.type
    if (!examMap[key]) examMap[key] = { date: g.date, type: g.type, scores: {}, yearSemester: g.yearSemester, notes: g.notes }
    examMap[key].scores[g.subject] = g.score
  }
  return Object.values(examMap).sort((a, b) => a.date.localeCompare(b.date))
}

/** 录入 Token 用量 */
async function logUsage(model, promptTokens, completionTokens) {
  return add('usage_log', {
    date: new Date().toISOString().slice(0, 10),
    model,
    promptTokens: promptTokens || 0,
    completionTokens: completionTokens || 0,
    totalTokens: (promptTokens || 0) + (completionTokens || 0),
    timestamp: Date.now(),
  })
}

/** 获取本月用量 */
async function getMonthlyUsage() {
  const month = new Date().toISOString().slice(0, 7)
  const all = await query('usage_log', 'date', IDBKeyRange.bound(month + '-01', month + '-31'))
  return all.reduce((s, e) => s + (e.totalTokens || 0), 0)
}

/** 获取各模型用量分布 */
async function getUsageByModel() {
  const all = await getAll('usage_log')
  const dist = {}
  for (const e of all) {
    dist[e.model] = (dist[e.model] || 0) + (e.totalTokens || 0)
  }
  return dist
}

/** 添加记忆条目 */
async function addMemory(type, content, source) {
  return add('memory', {
    type,
    content,
    date: new Date().toISOString().slice(0, 10),
    source: source || 'conversation',
    timestamp: Date.now(),
  })
}

/** 按类型读取记忆 */
async function getMemoryByType(type) {
  const all = await query('memory', 'type', IDBKeyRange.only(type))
  all.sort((a, b) => b.timestamp - a.timestamp)
  return all
}

/** 保存报告 */
async function saveReport(content, summary, riskFlags, triggerEvent, version) {
  return add('reports', {
    date: new Date().toISOString().slice(0, 10),
    version: version || 'v0.5',
    content,
    summary: summary || content.slice(0, 200),
    riskFlags: riskFlags || [],
    triggerEvent: triggerEvent || 'manual',
    tokenCost: 0,
    timestamp: Date.now(),
  })
}

/** 获取最新报告 */
async function getLatestReport() {
  const all = await getAll('reports')
  if (!all.length) return null
  all.sort((a, b) => b.timestamp - a.timestamp)
  return all[0]
}

/** 获取所有报告 */
async function getAllReports() {
  const all = await getAll('reports')
  all.sort((a, b) => b.timestamp - a.timestamp)
  return all
}

// ==================== 导出 ====================

const db = {
  openDB, get, getAll, query, set, add, del, clear, count,
  setSetting, getSetting, migrateFromLocalStorage,
  newSessionId, addMessage, getMessages, getRecentMessages, getSessions,
  saveGrade, saveExam, getAllGrades,
  logUsage, getMonthlyUsage, getUsageByModel,
  addMemory, getMemoryByType,
  saveReport, getLatestReport, getAllReports,
}

// CJS + 浏览器 dual
if (typeof module !== 'undefined' && module.exports) module.exports = db
if (typeof window !== 'undefined') window.db = db
