const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const { test } = require("node:test")

const root = path.resolve(__dirname, "..")
const settle = () => new Promise(resolve => setImmediate(resolve))

function loadDefinition(file, globals) {
  let definition
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), {
    console,
    Promise,
    setTimeout,
    clearTimeout,
    App: value => { definition = value },
    Page: value => { definition = value },
    Component: value => { definition = value },
    getCurrentPages: () => [],
    ...globals
  }, { filename: file })
  return definition
}

function createApp() {
  const calls = []
  const wx = {
    setStorageSync() {},
    removeStorageSync() {},
    showToast(options) { calls.push(options) },
    getWindowInfo: () => ({ windowWidth: 390, statusBarHeight: 44 }),
    getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32 })
  }
  const app = loadDefinition("app.js", { wx })
  app.globalData.token = "test-session"
  app.connectRealtime = () => {}
  app.closeRealtime = () => {}
  app.request = () => Promise.resolve({ events: [] })
  return { app, wx, calls }
}

function createView(file, app, wx) {
  const definition = loadDefinition(file, { getApp: () => app, wx })
  const instance = {
    ...definition,
    ...definition.methods,
    data: structuredClone(definition.data || {}),
    setData(values) { Object.assign(this.data, values) }
  }
  return instance
}

function message(id, actionState = "pending") {
  return { id, type: "binding_request", eventKind: "message", actionState, from: { nickname: "伙伴" } }
}

test("incoming messages deduplicate and action success updates the inbox", async () => {
  const { app } = createApp()
  app.handleRealtimeMessage(message("one"))
  app.handleRealtimeMessage(message("one"))
  assert.equal(app.globalData.inboxMessages.length, 1)
  await app.handleMessageAction("one", "accept")
  assert.equal(app.globalData.inboxMessages.length, 0)
})

test("failed actions keep messages available for retry", async () => {
  const { app } = createApp()
  app.handleRealtimeMessage(message("one"))
  app.request = () => Promise.reject(new Error("offline"))
  await assert.rejects(app.handleMessageAction("one", "accept"), /offline/)
  assert.equal(app.globalData.inboxMessages.length, 1)
})

test("notice stays visible after the automatic read receipt", async () => {
  const { app, wx } = createApp()
  const host = createView("components/message-host/message-host.js", app, wx)
  host.lifetimes.attached.call(host)
  app.handleRealtimeMessage(message("notice", "none"))
  await settle()
  assert.equal(host.data.currentMessage.id, "notice")
  assert.equal(app.globalData.inboxMessages.length, 0)
  host.handleDecision({ currentTarget: { dataset: { action: "read" } } })
  assert.equal(host.data.currentMessage, null)
  host.lifetimes.detached.call(host)
})

test("switching pages transfers a pending prompt and never duplicates it", async () => {
  const { app, wx } = createApp()
  const first = createView("components/message-host/message-host.js", app, wx)
  first.lifetimes.attached.call(first)
  app.handleRealtimeMessage(message("one"))
  first.pageLifetimes.hide.call(first)
  assert.equal(first.data.currentMessage, null)
  const second = createView("components/message-host/message-host.js", app, wx)
  second.lifetimes.attached.call(second)
  assert.equal(second.data.currentMessage.id, "one")
  app.handleRealtimeMessage(message("one"))
  assert.equal(app.globalData.messageQueue.length, 0)
  second.handleDecision({ currentTarget: { dataset: { action: "accept" } } })
  second.handleDecision({ currentTarget: { dataset: { action: "accept" } } })
  await settle()
  assert.equal(second.data.currentMessage, null)
  assert.equal(app.globalData.messageModalShowing, false)
  first.lifetimes.detached.call(first)
  second.lifetimes.detached.call(second)
})

test("logout clears both inbox and visible notification", () => {
  const { app, wx } = createApp()
  const host = createView("components/message-host/message-host.js", app, wx)
  host.lifetimes.attached.call(host)
  app.handleRealtimeMessage(message("one"))
  app.clearUserProfile()
  assert.equal(host.data.currentMessage, null)
  assert.equal(app.globalData.inboxMessages.length, 0)
  assert.equal(app.globalData.messageQueue.length, 0)
  host.lifetimes.detached.call(host)
})

test("a hidden tab cannot prevent the current tab from showing a new message", () => {
  const { app, wx } = createApp()
  const hidden = createView("components/message-host/message-host.js", app, wx)
  hidden.lifetimes.attached.call(hidden)
  hidden.pageLifetimes.hide.call(hidden)
  const visible = createView("components/message-host/message-host.js", app, wx)
  visible.lifetimes.attached.call(visible)
  app.handleRealtimeMessage(message("new-message"))
  assert.equal(hidden.data.currentMessage, null)
  assert.equal(visible.data.currentMessage.id, "new-message")
  hidden.lifetimes.detached.call(hidden)
  visible.lifetimes.detached.call(visible)
})

test("profile write failure preserves the previously saved profile", async () => {
  const { app } = createApp()
  app.globalData.userProfile.nickname = "原昵称"
  app.request = () => Promise.reject(new Error("offline"))
  await assert.rejects(app.saveManualProfile({ nickname: "新昵称" }), /offline/)
  assert.equal(app.globalData.userProfile.nickname, "原昵称")
})

test("failed explicit profile save leaves the editor open", async () => {
  const { app, wx, calls } = createApp()
  const page = createView("pages/profile/profile.js", app, wx)
  page.setData({ editorVisible: true, draftNickname: "新昵称" })
  app.saveManualProfile = () => Promise.reject(new Error("offline"))
  page.handleManualSubmit({ detail: { nickname: "新昵称" } })
  await settle()
  assert.equal(page.data.editorVisible, true)
  assert.equal(page.data.saving, false)
  assert.equal(calls.some(call => call.title === "已保存"), false)
})

test("binding invitation and pat keep their original API paths and payloads", async () => {
  const { app, wx } = createApp()
  const requests = []
  app.request = options => {
    requests.push(options)
    return Promise.resolve({ message: "已发送" })
  }
  const page = createView("pages/index/index.js", app, wx)
  page.setData({ accounts: [{ id: "partner", nickname: "伙伴" }] })
  page.bindAccount({ currentTarget: { dataset: { userId: "partner" } } })
  page.bindAccount({ currentTarget: { dataset: { userId: "partner" } } })
  await settle()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "/relations/bind-request")
  assert.equal(requests[0].data.userId, "partner")
  assert.equal(page.data.invitationSent, true)
  page.sendRelationMessage()
  page.sendRelationMessage()
  await settle()
  assert.equal(requests.length, 2)
  assert.equal(requests[1].url, "/relations/message")
  assert.equal(requests[1].data.messageType, "pat")
  assert.equal(page.data.sendingMessage, false)
})

test("annual report uses returned year and lines without example data", async () => {
  const { app, wx } = createApp()
  app.request = options => {
    assert.equal(options.url, "/report/report")
    return Promise.resolve({ year: 2027, lines: ["真实报告", "", null] })
  }
  const page = createView("pages/report/report.js", app, wx)
  page.loadReport()
  await settle()
  assert.equal(page.data.year, 2027)
  assert.equal(page.data.lines.length, 1)
  assert.equal(page.data.lines[0], "真实报告")
})

test("configured interactions use their own message type and keep pat as the default", async () => {
  const { app, wx } = createApp()
  const requests = []
  wx.showModal = options => options.success({ confirm: true })
  app.request = options => {
    requests.push(options)
    return Promise.resolve({ types: [{ code: "bump", name: "碰一碰", category: "interaction" }] })
  }
  const page = createView("pages/index/index.js", app, wx)
  page.setData({ hasPartner: true, partner: { nickname: "伙伴" } })
  page.loadMessageTypes()
  await settle()
  page.handlePartnerAvatarTap({ currentTarget: { dataset: { messageType: "bump" } } })
  await settle()
  assert.equal(requests[1].url, "/relations/message")
  assert.equal(requests[1].data.messageType, "bump")
})

test("region-only profile edits are saved", async () => {
  const { app, wx } = createApp()
  let savedProfile
  app.saveManualProfile = profile => {
    savedProfile = profile
    return Promise.resolve()
  }
  const page = createView("pages/profile/profile.js", app, wx)
  page.setData({ draftCountry: "中国", draftProvince: "浙江", draftCity: "杭州" })
  assert.equal(await page.persistDraftProfile(), true)
  assert.equal(savedProfile.city, "杭州")
})
