const STORAGE_KEY = "wx_app_profile"
const DISPLAY_ID_KEY = "wx_app_display_id"
const TOKEN_KEY = "wx_app_token"
// Publish builds must use the HTTPS Netlify site domain and add it to the Mini Program request domain allowlist.
const SITE_BASE_URL = "https://haoiwx.netlify.app"
const API_BASE_URL = `${SITE_BASE_URL}/.netlify/functions`
const SSE_URL = `${SITE_BASE_URL}/.netlify/edge-functions/sse`

function pad(value) {
  return String(value).padStart(2, "0")
}

function formatTime(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(":")
}

function maskCode(code) {
  if (!code) {
    return ""
  }

  if (code.length <= 12) {
    return code
  }

  return `${code.slice(0, 6)}...${code.slice(-4)}`
}

function generateDisplayId() {
  const middle = Math.floor(Math.random() * 9000 + 1000)
  const tail = Math.floor(Math.random() * 9000 + 1000)
  return `138${middle}${tail}`
}

function genderValueToCode(gender) {
  if (gender === 1) {
    return "male"
  }

  if (gender === 2) {
    return "female"
  }

  return "unknown"
}

function genderCodeToLabel(code) {
  if (code === "male") {
    return "男"
  }

  if (code === "female") {
    return "女"
  }

  return "保密"
}

function getWindowInfo() {
  return wx.getWindowInfo
    ? wx.getWindowInfo()
    : wx.getSystemInfoSync()
}

function getNavigationLayout(options = {}) {
  const heightOffset = options.heightOffset || 0
  const extraGap = options.extraGap === undefined ? 16 : options.extraGap
  const windowInfo = getWindowInfo()
  const menuRect = wx.getMenuButtonBoundingClientRect
    ? wx.getMenuButtonBoundingClientRect()
    : null
  const statusBarHeight = windowInfo.statusBarHeight || 0
  const windowWidth = windowInfo.windowWidth || 375
  const avatarSize = (58 / 750) * windowWidth
  const navHeight = menuRect
    ? menuRect.height + (menuRect.top - statusBarHeight) * 2
    : 44
  const navTotalHeight = statusBarHeight + navHeight + heightOffset

  return {
    navTop: statusBarHeight,
    navHeight,
    navTotalHeight,
    avatarTop: statusBarHeight + (navHeight - avatarSize) / 2,
    contentTop: navTotalHeight + extraGap
  }
}

function normalizeProfile(user = {}) {
  return {
    id: user._id || user.id || "",
    openid: user.openid || "",
    unionid: user.unionid || "",
    nickname: user.nickname || "",
    avatarUrl: user.avatarUrl || "",
    gender: user.gender || 0,
    city: user.city || "",
    province: user.province || "",
    country: user.country || "",
    source: user.profileSource || user.source || "",
    authorized: Boolean(user.nickname || user.avatarUrl),
    updatedAt: user.updatedAt ? formatTime(new Date(user.updatedAt)) : ""
  }
}

function getErrorMessage(err) {
  if (!err) {
    return "请求失败"
  }

  const message = err.message || err.errMsg || "请求失败"

  if (message.indexOf("url not in domain list") > -1) {
    return "请配置 request 合法域名"
  }

  return message
}

function getFileNameFromPath(filePath) {
  const cleanPath = String(filePath || "").split("?")[0]
  const name = cleanPath.split("/").pop() || `file-${Date.now()}.jpg`

  if (name.indexOf(".") > -1) {
    return name
  }

  return `${name}.jpg`
}

function getContentType(fileName) {
  const ext = String(fileName || "").split(".").pop().toLowerCase()

  if (ext === "png") {
    return "image/png"
  }

  if (ext === "webp") {
    return "image/webp"
  }

  return "image/jpeg"
}

function decodeChunk(buffer) {
  if (!buffer) {
    return ""
  }

  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(new Uint8Array(buffer))
  }

  const bytes = new Uint8Array(buffer)
  let binary = ""

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  try {
    return decodeURIComponent(escape(binary))
  } catch (err) {
    return binary
  }
}

function parseSseBlock(block) {
  const lines = String(block || "").split(/\r?\n/)
  let eventName = "message"
  const dataLines = []

  lines.forEach((line) => {
    if (!line || line.indexOf(":") === -1) {
      return
    }

    const index = line.indexOf(":")
    const field = line.slice(0, index).trim()
    const value = line.slice(index + 1).replace(/^ /, "")

    if (field === "event") {
      eventName = value || "message"
    }

    if (field === "data") {
      dataLines.push(value)
    }
  })

  if (!dataLines.length) {
    return null
  }

  try {
    return {
      eventName,
      data: JSON.parse(dataLines.join("\n"))
    }
  } catch (err) {
    return null
  }
}

App({
  globalData: {
    createdAt: "2026-06-17",
    displayId: "",
    token: "",
    userProfile: {
      id: "",
      openid: "",
      unionid: "",
      nickname: "",
      avatarUrl: "",
      gender: 0,
      city: "",
      province: "",
      country: "",
      source: "",
      authorized: false,
      updatedAt: ""
    },
    loginCode: "",
    loginCodePreview: "",
    loginAt: "",
    loginAtTimestamp: 0,
    loadingCount: 0,
    navigationLayoutCache: {},
    sseTask: null,
    sseBuffer: "",
    sseConnected: false,
    sseForeground: true,
    sseReconnectTimer: null,
    realtimeListeners: [],
    realtimeHandledIds: {},
    realtimePromptingIds: {}
  },

  onLaunch() {
    this.restoreSession()
    this.restoreDisplayId()
  },

  onShow() {
    this.globalData.sseForeground = true
    this.connectRealtime()
  },

  onHide() {
    this.globalData.sseForeground = false
    this.closeRealtime()
  },

  restoreSession() {
    const storedProfile = wx.getStorageSync(STORAGE_KEY)
    const storedToken = wx.getStorageSync(TOKEN_KEY)

    if (storedToken) {
      this.globalData.token = storedToken
    }

    if (storedProfile) {
      this.globalData.userProfile = {
        ...this.globalData.userProfile,
        ...storedProfile
      }
    }
  },

  restoreDisplayId() {
    const stored = wx.getStorageSync(DISPLAY_ID_KEY)
    if (stored) {
      this.globalData.displayId = stored
      return
    }

    const nextId = generateDisplayId()
    this.globalData.displayId = nextId
    wx.setStorageSync(DISPLAY_ID_KEY, nextId)
  },

  request(options = {}) {
    const url = options.url && options.url.indexOf("http") === 0
      ? options.url
      : `${API_BASE_URL}${options.url || ""}`
    const headers = {
      "Content-Type": "application/json",
      ...(options.header || {})
    }

    if (this.globalData.token) {
      headers.Authorization = `Bearer ${this.globalData.token}`
    }

    const loadingTitle = options.loadingTitle === undefined ? "加载中" : options.loadingTitle
    if (loadingTitle) {
      this.showLoading(loadingTitle)
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method: options.method || "POST",
        data: options.data || {},
        header: headers,
        timeout: options.timeout || 15000,
        success: (res) => {
          const data = res.data || {}

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data)
            return
          }

          reject(new Error(data.message || `请求失败 ${res.statusCode}`))
        },
        fail: reject,
        complete: () => {
          if (loadingTitle) {
            this.hideLoading()
          }
        }
      })
    })
  },

  showLoading(title = "加载中") {
    this.globalData.loadingCount += 1
    wx.showLoading({
      title,
      mask: true
    })
  },

  hideLoading() {
    this.globalData.loadingCount = Math.max(this.globalData.loadingCount - 1, 0)
    if (this.globalData.loadingCount === 0) {
      wx.hideLoading()
    }
  },

  saveSession(token, user) {
    const profile = normalizeProfile(user)

    this.globalData.token = token || this.globalData.token
    this.globalData.userProfile = {
      ...this.globalData.userProfile,
      ...profile
    }

    if (this.globalData.token) {
      wx.setStorageSync(TOKEN_KEY, this.globalData.token)
    }

    wx.setStorageSync(STORAGE_KEY, this.globalData.userProfile)
    this.connectRealtime()
    this.fetchPendingMessages()
    return this.globalData.userProfile
  },

  saveUserProfile(profile) {
    const nextProfile = {
      ...this.globalData.userProfile,
      ...profile,
      updatedAt: formatTime(new Date())
    }

    this.globalData.userProfile = nextProfile
    wx.setStorageSync(STORAGE_KEY, nextProfile)
    return nextProfile
  },

  clearUserProfile() {
    this.closeRealtime()
    this.globalData.token = ""
    this.globalData.loginCode = ""
    this.globalData.loginCodePreview = ""
    this.globalData.loginAt = ""
    this.globalData.loginAtTimestamp = 0
    wx.removeStorageSync(TOKEN_KEY)
    this.clearStoredProfile()
  },

  ensureLogin(done, fail) {
    if (this.globalData.token) {
      if (typeof done === "function") {
        done(this.globalData.userProfile)
      }
      return
    }

    this.showLoading("登录中")

    wx.login({
      timeout: 10000,
      success: (result) => {
        if (!result.code) {
          this.hideLoading()
          this.clearLoginState()
          if (typeof fail === "function") {
            fail(new Error("未获取到微信登录 code"))
          }
          return
        }

        this.globalData.loginCode = result.code
        this.globalData.loginCodePreview = maskCode(result.code)
        this.globalData.loginAtTimestamp = Date.now()
        this.globalData.loginAt = formatTime(new Date())

        this.request({
          url: "/wxusers/login",
          loadingTitle: "",
          data: {
            code: result.code
          }
        }).then((data) => {
          this.saveSession(data.token, data.user)

          if (typeof done === "function") {
            done(this.globalData.userProfile)
          }
          this.hideLoading()
        }).catch((err) => {
          this.clearLoginState()
          if (typeof fail === "function") {
            fail(err)
          }
          this.hideLoading()
        })
      },
      fail: (err) => {
        this.hideLoading()
        this.clearLoginState()
        if (typeof fail === "function") {
          fail(err)
        }
      }
    })
  },

  clearLoginState() {
    this.closeRealtime()
    this.globalData.token = ""
    this.globalData.loginCode = ""
    this.globalData.loginCodePreview = ""
    this.globalData.loginAt = ""
    this.globalData.loginAtTimestamp = 0
    wx.removeStorageSync(TOKEN_KEY)
    this.clearStoredProfile()
  },

  clearStoredProfile() {
    this.globalData.userProfile = {
      id: "",
      openid: "",
      unionid: "",
      nickname: "",
      avatarUrl: "",
      gender: 0,
      city: "",
      province: "",
      country: "",
      source: "",
      authorized: false,
      updatedAt: ""
    }
    wx.removeStorageSync(STORAGE_KEY)
  },

  getDisplayName() {
    if (!this.globalData.token) {
      return "访客"
    }

    const nickname = (this.globalData.userProfile && this.globalData.userProfile.nickname) || ""
    if (nickname) {
      return nickname
    }

    return "微信用户"
  },

  saveManualProfile(profile) {
    const localProfile = this.saveUserProfile({
      ...profile,
      source: "manual",
      profileSource: "manual",
      authorized: Boolean(profile.nickname || profile.avatarUrl)
    })

    if (!this.globalData.token) {
      return Promise.resolve(localProfile)
    }

    return this.request({
      url: "/wxusers/profile",
      data: {
        nickname: localProfile.nickname,
        avatarUrl: localProfile.avatarUrl,
        gender: localProfile.gender,
        city: localProfile.city,
        province: localProfile.province,
        country: localProfile.country,
        profileSource: "manual"
      }
    }).then((data) => {
      return this.saveSession(null, data.user)
    })
  },

  uploadFile(filePath, options = {}) {
    if (!filePath) {
      return Promise.reject(new Error("请选择文件"))
    }

    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: "base64",
        success: (res) => {
          const fileName = getFileNameFromPath(filePath)

          this.request({
            url: "/files/upload",
            data: {
              fileName,
              contentType: getContentType(fileName),
              base64: res.data,
              directory: options.directory || "files",
              name: options.name || "",
              nameMode: options.nameMode || "timestamp"
            },
            loadingTitle: options.loadingTitle || "上传中",
            timeout: 30000
          }).then((data) => {
            resolve(data)
          }).catch(reject)
        },
        fail: reject
      })
    })
  },

  getDisplayId() {
    const openid = this.globalData.userProfile && this.globalData.userProfile.openid
    if (openid) {
      return openid
    }

    if (!this.globalData.displayId) {
      this.restoreDisplayId()
    }

    return this.globalData.displayId
  },

  getNavigationLayout(options = {}) {
    const heightOffset = options.heightOffset || 0
    const extraGap = options.extraGap === undefined ? 16 : options.extraGap
    const cacheKey = `${heightOffset}:${extraGap}`

    if (!this.globalData.navigationLayoutCache[cacheKey]) {
      this.globalData.navigationLayoutCache[cacheKey] = getNavigationLayout({
        heightOffset,
        extraGap
      })
    }

    return this.globalData.navigationLayoutCache[cacheKey]
  },

  getProfileViewModel() {
    const profile = this.globalData.userProfile || {}
    const isLoggedIn = Boolean(this.globalData.token)
    const visibleProfile = isLoggedIn ? profile : {}
    const hasProfile = Boolean(visibleProfile.nickname || visibleProfile.avatarUrl)
    const regionParts = [
      visibleProfile.country,
      visibleProfile.province,
      visibleProfile.city
    ].filter(Boolean)
    const profileSourceMap = {
      manual: "来自个人中心手动填写",
      "wechat-authorized": "来自微信授权信息"
    }
    const selectedGenderCode = isLoggedIn
      ? genderValueToCode(visibleProfile.gender)
      : "unknown"

    return {
      isLoggedIn,
      hasProfile,
      displayName: this.getDisplayName(),
      avatarUrl: visibleProfile.avatarUrl || "",
      loginStatus: isLoggedIn ? "已登录" : "未登录",
      loginAtDisplay: isLoggedIn ? this.globalData.loginAt || "已登录" : "等待用户确认登录",
      loginCodePreview: isLoggedIn ? this.globalData.loginCodePreview || "已换取登录态" : "未获取",
      profileStatus: hasProfile ? "已完成" : "未授权",
      profileSource: profileSourceMap[visibleProfile.source] || "可在个人中心手动补充",
      profileDetail: hasProfile ? "可继续在个人中心修改资料" : "登录后可在个人中心编辑资料",
      regionText: regionParts.length ? regionParts.join(" / ") : "未获取",
      updatedAtDisplay: visibleProfile.updatedAt || "未更新",
      selectedGenderCode,
      selectedGenderLabel: genderCodeToLabel(selectedGenderCode)
    }
  },

  onRealtimeMessage(listener) {
    if (typeof listener !== "function") {
      return function () {}
    }

    this.globalData.realtimeListeners.push(listener)

    return () => {
      this.globalData.realtimeListeners = this.globalData.realtimeListeners.filter(item => item !== listener)
    }
  },

  emitRealtimeMessage(event) {
    this.globalData.realtimeListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (err) {
        console.warn("realtime listener failed", err)
      }
    })
  },

  connectRealtime() {
    if (!this.globalData.sseForeground || !this.globalData.token || this.globalData.sseTask) {
      return
    }

    if (this.globalData.sseReconnectTimer) {
      clearTimeout(this.globalData.sseReconnectTimer)
      this.globalData.sseReconnectTimer = null
    }

    const task = wx.request({
      url: SSE_URL,
      method: "GET",
      enableChunked: true,
      timeout: 600000,
      header: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${this.globalData.token}`
      },
      success: () => {},
      fail: () => {},
      complete: () => {
        if (this.globalData.sseTask === task) {
          this.globalData.sseTask = null
          this.globalData.sseConnected = false
          this.scheduleRealtimeReconnect()
        }
      }
    })

    this.globalData.sseTask = task
    this.globalData.sseBuffer = ""

    if (task && typeof task.onChunkReceived === "function") {
      task.onChunkReceived((res) => {
        this.handleRealtimeChunk(res.data)
      })
    } else {
      console.warn("当前微信基础库不支持 request chunked 接收，实时消息无法即时到达")
    }
  },

  closeRealtime() {
    if (this.globalData.sseReconnectTimer) {
      clearTimeout(this.globalData.sseReconnectTimer)
      this.globalData.sseReconnectTimer = null
    }

    const task = this.globalData.sseTask
    this.globalData.sseTask = null
    this.globalData.sseConnected = false
    this.globalData.sseBuffer = ""

    if (task && typeof task.abort === "function") {
      task.abort()
    }
  },

  scheduleRealtimeReconnect() {
    if (!this.globalData.sseForeground || !this.globalData.token || this.globalData.sseReconnectTimer) {
      return
    }

    this.globalData.sseReconnectTimer = setTimeout(() => {
      this.globalData.sseReconnectTimer = null
      this.connectRealtime()
    }, 3000)
  },

  handleRealtimeChunk(buffer) {
    this.globalData.sseBuffer += decodeChunk(buffer)
    this.globalData.sseBuffer = this.globalData.sseBuffer.replace(/\r\n/g, "\n")

    let splitIndex = this.globalData.sseBuffer.indexOf("\n\n")
    while (splitIndex > -1) {
      const block = this.globalData.sseBuffer.slice(0, splitIndex)
      this.globalData.sseBuffer = this.globalData.sseBuffer.slice(splitIndex + 2)
      this.handleRealtimeBlock(block)
      splitIndex = this.globalData.sseBuffer.indexOf("\n\n")
    }
  },

  handleRealtimeBlock(block) {
    const event = parseSseBlock(block)
    if (!event) {
      return
    }

    console.info("SSE event received", event.eventName, Date.now())

    if (event.eventName === "ready") {
      this.globalData.sseConnected = true
      this.fetchPendingMessages()
      return
    }

    if (event.eventName === "heartbeat") {
      return
    }

    if (event.eventName === "message") {
      this.handleRealtimeMessage(event.data)
    }
  },

  handleRealtimeMessage(event) {
    if (!event || !event.type) {
      return
    }

    if (event.id && this.globalData.realtimeHandledIds[event.id]) {
      return
    }

    if (event.id) {
      this.globalData.realtimeHandledIds[event.id] = true
    }

    this.emitRealtimeMessage(event)
  },

  fetchPendingMessages() {
    if (!this.globalData.token) {
      return Promise.resolve([])
    }

    return this.request({
      url: "/messages/events",
      loadingTitle: ""
    }).then((data) => {
      const events = Array.isArray(data.events) ? data.events : []
      events.forEach((event) => {
        this.handleRealtimeMessage(event)
      })
      return events
    }).catch(() => [])
  },

  markMessageRead(messageId) {
    if (!messageId) {
      return
    }

    this.request({
      url: "/messages/action",
      data: {
        messageId,
        action: "read"
      },
      loadingTitle: ""
    }).catch(() => {})
  },

  handleMessageAction(messageId, action) {
    if (!messageId || !action) {
      return Promise.reject(new Error("消息参数无效"))
    }

    return this.request({
      url: "/messages/action",
      data: {
        messageId,
        action
      },
      loadingTitle: action === "read" ? "" : "处理中"
    })
  },

  showRequestError(err) {
    wx.showToast({
      title: getErrorMessage(err),
      icon: "none"
    })
  }
})
