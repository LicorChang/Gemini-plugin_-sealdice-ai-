// ==UserScript==
// @name         Gemini AI
// @description  OpenAI-compatible 反代专用 + 双轨记忆系统/多词触发概率/时间感知/特殊身份映射 + 动态状态机 + 好感度系统 + 主观压力判定
// @version      1.9.34-topic-fix
// @author       cz
// @license      MIT
// ==/UserScript==

(function () {
  const EXT_NAME = 'GeminiAI';
  if (seal.ext.find(EXT_NAME)) {
    seal.ext.unregister(seal.ext.find(EXT_NAME));
  }

  const ext = seal.ext.new(EXT_NAME, 'cz', '2.0.0-topic-fix');
  ext.enabled = true;
  seal.ext.register(ext);

  /* ================= 配置项 ================= */
  seal.ext.registerStringConfig(ext, "API代理地址", "https://gcli.ggchan.dev");
  seal.ext.registerStringConfig(ext, "API Keys", "gg-gcli-xxxxxxxxxxxxxxxxxxxxxxxx");
  seal.ext.registerStringConfig(ext, "模型名称", "gemini-2.5-flash-search");
  seal.ext.registerStringConfig(ext, "长RP模型名称", "gemini-2.5-pro");

  seal.ext.registerIntConfig(ext, "最大回复Tokens", 1024);
  seal.ext.registerIntConfig(ext, "最大回复字符数(防抽风)", 800);

  // [Debounce]
  seal.ext.registerIntConfig(ext, "合并回复窗口(ms)", 1200);

  // [Image]
  seal.ext.registerBoolConfig(ext, "启用读图片", false);
  seal.ext.registerBoolConfig(ext, "启用视觉前置(glm-4v)", false);
  seal.ext.registerStringConfig(ext, "视觉模型API地址", "https://open.bigmodel.cn/api/paas/v4/chat/completions");
  seal.ext.registerStringConfig(ext, "视觉模型APIKey", "your_glm4v_key");
  seal.ext.registerIntConfig(ext, "环境图片记忆保留(ms)", 60000); // 60秒，自己改


  // [Ambient]
  seal.ext.registerBoolConfig(ext, "启用读空气(Ambient)", false);
  seal.ext.registerIntConfig(ext, "读空气阈值(默认4)", 4);
  seal.ext.registerIntConfig(ext, "Ambient接话等待窗口(ms)", 5000);
  seal.ext.registerStringConfig(ext, "读空气权重(用户ID:加分)", "");

  // ===== AI↔AI 对话增强（Dominance + 防互相@循环）=====
  seal.ext.registerStringConfig(ext, "AI机器人QQ号列表", ""); // 例：2806961157;41114593
  seal.ext.registerIntConfig(ext, "AI互聊硬上限(轮)", 3); // 只对 AI↔AI 生效
  seal.ext.registerIntConfig(ext, "AI互聊链路过期(ms)", 20000);
  seal.ext.registerStringConfig(ext, "AI回应优先级(AI1>AI2:值;...)", ""); // 例：2806961157>41114593:2;41114593>2806961157:1

  // ===== 记忆与上下文配置 =====
  seal.ext.registerIntConfig(ext, "对话上下文限制(轮)", 6);
  seal.ext.registerIntConfig(ext, "环境/普通群聊记忆限制(条)", 12);

  // ===== RP 核心配置 =====
  seal.ext.registerStringConfig(ext, "角色设定(语气风格)", "请完全沉浸在角色中，不要表现出你是AI。使用口语化的表达，可以使用*动作描写*或(心理活动)来增强表现力。如果用户没有直接提问，可以根据环境进行吐槽或闲聊。");
  seal.ext.registerStringConfig(ext, "预设背景(人设与故事)", "飞蛾是一个沉稳、冷淡但礼貌的监管者。");
  seal.ext.registerStringConfig(ext, "额外指令(可选)", "");

  seal.ext.registerBoolConfig(ext, "启用时间感知", true);

  // ===== 触发配置 =====
  seal.ext.registerStringConfig(ext, "非指令关键词(词:概率;词:概率)", "监管者:100;飞蛾:30");
  seal.ext.registerStringConfig(ext, "bot名字", "飞蛾");

  // ===== 身份映射配置 =====
  seal.ext.registerStringConfig(ext, "默认user_info", "普通探窟家");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置1", "QQ:1004205930");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name1", "监管者的上级|蠕虫卿");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置2", "QQ:1655009569");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name2", "飞蛾的同事|斯坎");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置3", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name3", "[空]");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置4", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name4", "[空]");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置5", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name5", "[空]");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置6", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name6", "[空]");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置7", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name7", "[空]");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置8", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name8", "[空]");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置9", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name9", "[空]");
  seal.ext.registerStringConfig(ext, "特殊用户ID配置10", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name10", "[空]");
  seal.ext.registerBoolConfig(ext, "是否打印日志", false);
  seal.ext.registerBoolConfig(ext, "启用引用回复和@用户", true);

  seal.ext.registerStringConfig(ext, "清除上下文触发词", "清除上下文");
  seal.ext.registerStringConfig(ext, "清除上下文完成", "上下文已清除");
  seal.ext.registerStringConfig(ext, "清除上下文时无上下文", "没有可清除的上下文");

  /* ================= 工具函数 ================= */
  function cfgStr(k) { return String(seal.ext.getStringConfig(ext, k) ?? "").trim(); }
  function cfgBool(k) { return !!seal.ext.getBoolConfig(ext, k); }
  function cfgInt(k, defVal) {
    const n = parseInt(seal.ext.getIntConfig(ext, k), 10);
    return Number.isFinite(n) ? n : defVal;
  }
  function stripTrailingSlash(url) { return String(url || "").replace(/\/+$/, ""); }
  function onlyDigits(s) { return String(s || "").replace(/\D/g, ""); }
  function debugLog(...args) {
    if (!cfgBool("是否打印日志")) return;
    console.log("[Gemini-Proxy-Debug]", ...args);
  }
  function getTimeStr() {
    return new Date().toLocaleString('zh-CN', { hour12: false }).split(' ')[1];
  }
  function parseKeywords() {
    const raw = cfgStr("非指令关键词(词:概率;词:概率)");
    if (!raw) return [];
    const parts = raw.split(/[;；]/);
    const result = [];
    for (const p of parts) {
      if (!p.trim()) continue;
      const [w, probStr] = p.split(/[:：]/);
      if (!w || !w.trim()) continue;
      let prob = 100;
      if (probStr) {
        const parsed = parseInt(probStr);
        if (!isNaN(parsed)) prob = parsed;
      }
      result.push({ word: w.trim(), prob });
    }
    return result;
  }

  function parseIdList(raw) {
    if (!raw) return [];
    return raw
      .split(/[;；,，\s]+/)
      .map(x => onlyDigits(x))
      .filter(Boolean);
  }

  function isKnownAIBot(userIdDigitsOrAny) {
    const uid = onlyDigits(userIdDigitsOrAny);
    if (!uid) return false;
    const list = parseIdList(cfgStr("AI机器人QQ号列表"));
    return list.includes(uid);
  }

  function parseDominanceMap() {
    const raw = cfgStr("AI回应优先级(AI1>AI2:值;...)");
    const map = new Map(); // key "A->B" => number
    if (!raw) return map;
    const parts = raw.split(/[;；]/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      // 支持形如：A>B:2 或 A> B：2
      const normalized = p.replace(/：/g, ":").replace(/\s+/g, "");
      const m = normalized.match(/^(\d+)>?(\d+):(-?\d+)$/);
      if (!m) continue;
      const a = m[1];
      const b = m[2];
      const v = parseInt(m[3], 10);
      if (!a || !b || !Number.isFinite(v)) continue;
      map.set(`${a}->${b}`, v);
    }
    return map;
  }

  function getDominance(fromAI, toAI, domMap) {
    const a = onlyDigits(fromAI);
    const b = onlyDigits(toAI);
    if (!a || !b) return 0;
    const key = `${a}->${b}`;
    return domMap?.has(key) ? (domMap.get(key) || 0) : 0;
  }

  function extractAtQQs(text) {
    const s = String(text || "");
    const out = [];
    const re = /\[CQ:at,qq=(\d+)\]/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[1]) out.push(String(m[1]));
    }
    return out;
  }

  function isReplyMessage(msg) {
    if (/\[CQ:reply,id=\d+\]/.test(String(msg?.message ?? ""))) return true;
    if (Array.isArray(msg?.elements)) {
      return msg.elements.some(e => e && (e.type === "reply" || e.type === "Reply") && (e.id || e.messageId));
    }
    return !!(msg?.replyId || msg?.quoteId || msg?.source?.id);
  }
  function isReplyToMe(ctx, msg) {
    const myMsgId = String(ctx?.endPoint?.messageId || "");
    const targetId = getReplyTargetId(msg);
    if (!targetId || !myMsgId) return false;
    return targetId === myMsgId;
  }

  function getReplyTargetId(msg) {
    if (msg?.rawId) return String(msg.rawId);
    if (msg?.messageId) return String(msg.messageId);
    const m = String(msg?.message ?? "").match(/\[CQ:reply,id=(\d+)\]/);
    if (m && m[1]) return String(m[1]);
    if (Array.isArray(msg?.elements)) {
      const r = msg.elements.find(e => e && (e.type === "reply" || e.type === "Reply"));
      if (r) return String(r.id ?? r.messageId);
    }
    return "";
  }

  function buildSpecialUsers() {
    const items = [];
    for (let i = 1; i <= 6; i++) {
      const idRaw = cfgStr(`特殊用户ID配置${i}`);
      const infoNameRaw = cfgStr(`特殊user_info和user_name${i}`);
      if (!idRaw || idRaw === "[空]" || !infoNameRaw || infoNameRaw === "[空]") continue;
      items.push({ idRaw, infoNameRaw });
    }
    return items;
  }

  function isAtMe(ctx, msg) {
    const text = String(msg?.message ?? "");
    return text.includes(`[CQ:at,qq=${ctx.endPoint.userId.replace(/\D/g, "")}]`) || text.includes(`[CQ:at,qq=${onlyDigits(ctx.endPoint.userId)}]`);
  }

  function getUserInfoAndName(senderUserId, senderNickname) {
    const numericId = onlyDigits(senderUserId);
    const specialUsers = buildSpecialUsers();
    for (const su of specialUsers) {
      const specialIds = su.idRaw.split("|").map(x => onlyDigits(x));
      for (const id of specialIds) {
        if (id && numericId === id) {
          const parts = su.infoNameRaw.split("|");
          const userInfo = (parts[0] ?? "").trim() || cfgStr("默认user_info");
          const userName = (parts[1] ?? "").trim() || senderNickname;
          return [userInfo, userName];
        }
      }
    }
    return [cfgStr("默认user_info"), senderNickname];
  }

  function getUserAmbientBoost(targetUserId) {
    const raw = cfgStr("读空气权重(用户ID:加分)");
    if (!raw) return 0;
    const parts = raw.split(/[;；]/);
    const targetDigits = onlyDigits(targetUserId);
    for (const p of parts) {
      if (!p.trim()) continue;
      const normalized = p.replace(/：/g, ":");
      const lastIdx = normalized.lastIndexOf(":");
      if (lastIdx === -1) continue;

      const idPart = normalized.substring(0, lastIdx).trim();
      const scorePart = normalized.substring(lastIdx + 1).trim();
      const score = parseInt(scorePart, 10);
      if (isNaN(score)) continue;

      if (idPart === targetUserId || (targetDigits && onlyDigits(idPart) === targetDigits)) {
        return score;
      }
    }
    return 0;
  }

  function extractSimpleKeyword(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
    if (cleaned.length < 2) return null;
    return cleaned.slice(0, 4);
  }

  function extractImageUrls(msg) {
    const urls = [];
    const text = String(msg?.message ?? "");
    const regex = /\[CQ:image,[^\]]*file=([^,\]]+)/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const v = m[1];
      if (v && /^https?:\/\//i.test(v)) {
        urls.push(v);
      }
    }
    if (Array.isArray(msg?.elements)) {
      for (const el of msg.elements) {
        if (el?.type === "image" && typeof el.url === "string" && /^https?:\/\//i.test(el.url)) {
          urls.push(el.url);
        }
      }
    }
    return urls;
  }
  function userRefersToImage(text) {
    if (!text) return false;
    return /(这张|那张|刚才|刚刚|图片|图里|图中|照片|这图|那图)/.test(text);
  }

  function mergeUrlsFromPool(pool) {
    return Array.from(new Set((pool || []).flatMap(x => x.urls || [])));
  }

  async function runVisionModel(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return "";

    const apiUrl = cfgStr("视觉模型API地址");
    const apiKey = cfgStr("视觉模型APIKey");

    const messages = [{
      role: "user",
      content: [
        { type: "text", text: "请描述这些图片的内容，用简洁中文说明。" },
        ...imageUrls.map(u => ({
          type: "image_url",
          image_url: { url: u }
        }))
      ]
    }];

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "glm-4v",
        messages,
        max_tokens: 512
      })
    });

    if (!res.ok) {
      console.error("[Vision] HTTP Error", res.status);
      return "";
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  }
  
  function extractQuotedText(msg) {
    // CQ 形式
    const m = String(msg?.message ?? "").match(/\[CQ:reply,id=\d+\]([\s\S]*)$/);
    if (m && m[1]) return m[1].trim();

    // OneBot elements
    if (Array.isArray(msg?.elements)) {
      const r = msg.elements.find(e => e.type === "reply" || e.type === "Reply");
      if (r && r.text) return String(r.text).trim();
    }

    return "";
  }


  /* ================= 好感度管理 ================= */
  const FAVOR_KEY = "gemini_favorability";
  function loadFavorStore() {
    try {
      return JSON.parse(ext.storageGet(FAVOR_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveFavorStore(data) {
    ext.storageSet(FAVOR_KEY, JSON.stringify(data));
  }

  let favorabilityStore = loadFavorStore();


  function getFavorability(userId) {
    const uid = onlyDigits(userId);
    if (!uid) return 0;
    if (!favorabilityStore.favData) favorabilityStore.favData = {};
    let entry = favorabilityStore.favData[uid];
    if (typeof entry === 'number') { entry = { val: entry, ts: Date.now() }; favorabilityStore.favData[uid] = entry; }
    if (!entry) { entry = { val: 50, ts: Date.now() }; favorabilityStore.favData[uid] = entry; }
    const now = Date.now();
    const hoursPassed = (now - entry.ts) / (1000 * 60 * 60);
    if (hoursPassed >= 24) {
      const cycles = Math.floor(hoursPassed / 24);
      const changeRate = 5;
      const totalChange = cycles * changeRate;
      let newVal = entry.val;
      if (entry.val > 50) newVal = Math.max(50, entry.val - totalChange);
      else if (entry.val < 50) newVal = Math.min(50, entry.val + totalChange);
      if (newVal !== entry.val) {
        entry.val = newVal;
        entry.ts = entry.ts + (cycles * 24 * 60 * 60 * 1000);
        favorabilityStore.favData[uid] = entry;
        saveFavorStore(favorabilityStore);

      }
    }
    return entry.val;
  }

  function getFavorabilityDesc(val) {
    if (val <= -10) return "敌对";
    if (val <= 20) return "冷淡";
    if (val <= 40) return "疏离";
    if (val <= 60) return "中立";
    if (val <= 80) return "友善";
    if (val < 100) return "信赖";
    return "独一无二";
  }

  function adjustFavorability(userId, stress, evalScore, badStreak, severity) {
    const uid = onlyDigits(userId);
    if (!uid) return;
    let current = getFavorability(uid);
    let change = 0;
    const isRepairZone = current > -10 && current <= 20;
    if (evalScore === 0) {
      if (stress <= 5) change = 2;
      else if (stress <= 8) change = 1;
      else change = 0;
    } else if (evalScore === 1) {
      change = 0;
      if (stress > 9.0) change = -1;
    } else if (evalScore === 2) {
      const sev = severity || 1;
      if (sev === 3) change = -10;
      else if (sev === 2) change = -5;
      else {
        if (isRepairZone) change = 0;
        else if (badStreak < 3) change = 0;
        else change = -2;
      }
      if (stress >= 8.5 && !isRepairZone) change -= 5;
    }
    let newValue = Math.min(100, Math.max(-10, current + change));
    if (newValue !== current || evalScore === 0) {
      if (!favorabilityStore.favData) favorabilityStore.favData = {};
      favorabilityStore.favData[uid] = { val: newValue, ts: Date.now() };
      saveFavorStore(favorabilityStore);

    }
  }

  function makeSystemPrompt() {
    const style = cfgStr("角色设定(语气风格)");
    const bg = cfgStr("预设背景(人设与故事)");
    const extra = cfgStr("额外指令(可选)");
    const useTime = cfgBool("启用时间感知");
    let prompt = `【角色设定与背景】\n${bg}\n\n【语气与风格要求】\n${style}`;
    if (extra) prompt += `\n\n【额外指令】\n${extra}`;
    prompt += `\n\n【隐藏任务：压力源判定】
根据用户输入判断其对你的精神消耗，并在回复末尾附加分类标签 <!--stress_eval:X-->：
0：有意义/有趣的互动（令你感兴趣或放松，例如认真的提问、安慰、送礼）
1：中性/普通（例如日常问候、短句）
2：负面行为（消耗耐心或令你反感）。此时务必判定严重等级(1-3)，格式为 <!--stress_eval:2;sev:X-->：
   sev:1 (轻微)：调戏、无聊刷屏、非恶意冒犯。
   sev:2 (中等)：明确语言羞辱、恶毒嘲讽、不尊重。
   sev:3 (严重)：敌对、暴力威胁、极度侮辱。
注意：
1. 请严格遵守上述格式，不要输出多余内容。
2. 标签必须严格附加在回复的最末尾。
3. 不要在回复正文中提及此标签或分类过程。`;
    if (useTime) {
      const now = new Date();
      prompt += `\n\n【现实时间】\n${now.toLocaleString('zh-CN', { hour12: false })}。对话涉及时间时以此为准。`;
    }
    return prompt;
  }

  function truncateReply(s, customLimit) {
    const maxChars = customLimit || cfgInt("最大回复字符数(防抽风)", 800);
    const text = String(s ?? "");
    return text.length <= maxChars ? text : text.slice(0, maxChars) + `...`;
  }

  function splitAmbientMessages(text) {
    const raw = String(text ?? "").trim();
    if (!raw) return [];
    const parts = raw
      .split(/\s*\|\|\|\s*/)
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return [];
    if (parts.length <= 3) return parts;
    const merged = parts.slice(0, 2);
    merged.push(parts.slice(2).join(" "));
    return merged;
  }

  /* ================= AI 类（Stateful Agent） ================= */
  class ProxyAI {
    constructor() {
      this.dialogContext = [];
      this.envContext = [];
      this.staticSystemPrompt = makeSystemPrompt();

      this.longRPStreak = 0;
      this.shortRPStreak = 0;
      this.hardRPMode = false;

      this.userStats = new Map();
      this.lastActiveUserId = null;

      // Ambient
      this.lastBotReplyTime = 0;
      this.lastUserMsgTime = 0;
      this.consecutiveUserCount = 0;
      this.lastMsgUserId = null;
      this.ambientFocusUntil = 0;
      this.lastAmbientTopic = null;
      this.lastAmbientTopicTime = 0;
      this.lastAmbientUserId = null;

      // Topic
      this.lastAmbientKeywords = [];
      this.lastAmbientKeywordTime = 0;
      this.ambientTriggerStreak = 0;
      this.ambientTopicHitStreak = 0;

      // Activity
      this.recentMessageTimes = [];

      // Dominance Model (临时衰减表) + AI↔AI 链路
      this.tempDominance = {}; // key: "A->B" => remaining(int)
      this.aiChainCount = 0;
      this.aiChainExpireAt = 0;

      this.internalState = {
        stress: 0,
        moodState: 'calm',
        recentEvals: [],
        lastStressRiseTime: Date.now(),
        lastDecayCheckTime: Date.now()
      };

      this.debounceTimer = null;
      this.pendingTrigger = null;
      this.pendingTriggers = [];
      this.ambientWaitTimer = null;
      this.ambientPending = false;
      //合并看图整理
      this.lastVisionSummary = "";
      this.lastVisionTime = 0;
      // ===== 环境随机图片（短期缓存：不立刻看图，只存URL，TTL过期作废）=====
      this.envImagePool = []; // [{ ts:number, urls:string[] }]
      this.envVisionSummary = ""; // 最近一次“环境图”解读结果（短期）
      this.envVisionTime = 0;

    }

    updateMoodState() {
      const s = this.internalState.stress;
      const current = this.internalState.moodState;
      if (current === 'calm') {
        if (s > 4.5) this.internalState.moodState = 'strained';
      } else if (current === 'strained') {
        if (s < 2.5) this.internalState.moodState = 'calm';
        if (s > 8.5) this.internalState.moodState = 'overloaded';
      } else if (current === 'overloaded') {
        if (s < 7.0) this.internalState.moodState = 'strained';
      }
    }

    preCheckStress(userId) {
      const now = Date.now();

      if (now - this.internalState.lastStressRiseTime > 60000) {
        const timeSinceCheck = now - this.internalState.lastDecayCheckTime;
        if (timeSinceCheck > 60000) {
          const minutes = Math.floor(timeSinceCheck / 60000);
          const decay = minutes * 1.0;
          if (decay > 0) {
            this.internalState.stress = Math.max(0, this.internalState.stress - decay);
            this.internalState.lastDecayCheckTime += minutes * 60000;
            this.updateMoodState();
            debugLog(`[Stress Cooldown] Quiet for ${minutes} min -> Stress -${decay}`);
          }
        }
      } else {
        this.internalState.lastDecayCheckTime = now;
      }

      if (!userId) return 0;

      if (this.lastActiveUserId && this.lastActiveUserId !== userId) {
        this.internalState.stress = Math.max(0, this.internalState.stress - 1.0);
      }
      this.lastActiveUserId = userId;

      if (!this.userStats.has(userId)) {
        this.userStats.set(userId, { lastTime: 0, burstCount: 0, badStreak: 0 });
      }
      const stats = this.userStats.get(userId);
      const timeSinceLastChat = now - stats.lastTime;

      if (timeSinceLastChat < 8000) {
        stats.burstCount++;
      } else {
        stats.burstCount = 0;
      }
      stats.lastTime = now;
      return stats.burstCount;
    }

    commitStress(rawEvalScore, burstCount, userId) {
      this.internalState.recentEvals.push(rawEvalScore);
      if (this.internalState.recentEvals.length > 3) this.internalState.recentEvals.shift();

      const sum = this.internalState.recentEvals.reduce((a, b) => a + b, 0);
      const avgScore = sum / this.internalState.recentEvals.length;

      let delta = 0;
      if (avgScore <= 0.5) delta = -0.5;
      else if (avgScore >= 1.5) delta = 1.5;
      else delta = 0.2;

      if (burstCount >= 3) {
        if (avgScore <= 0.5) delta = 0.2;
        else delta += 1.0;
      } else {
        if (avgScore <= 0.5) delta -= 0.2;
      }

      if (userId) {
        const fav = getFavorability(userId);
        if (rawEvalScore === 1 && fav > 60) delta -= 0.1;
        if (rawEvalScore === 2 && fav < 40) delta += 0.2;
      }

      const prev = this.internalState.stress;
      this.internalState.stress = Math.min(10, Math.max(0, prev + delta));

      if (this.internalState.stress > prev) {
        this.internalState.lastStressRiseTime = Date.now();
        this.internalState.lastDecayCheckTime = Date.now();
      }

      this.updateMoodState();
    }

    getDynamicParams() {
      this.updateMoodState();
      const state = this.internalState.moodState;
      let moodInstruction = "";
      let temp = 1.0;

      if (state === 'calm') {
        moodInstruction = "(当前状态：平静、耐心。你可以展开聊聊，或者开个玩笑)";
        temp = 1.0;
      } else if (state === 'strained') {
        moodInstruction = "(当前状态：被打扰)";
        temp = 1.0;
      } else {
        temp = 0.9;
        const recentEvals = this.internalState.recentEvals || [];
        const isProvoked = recentEvals.some(e => e === 2);
        let trendHint = isProvoked ? "近期连续受到干扰，恼怒。" : "精神透支、麻木且疲惫。";
        moodInstruction = `(当前状态：情绪过载/崩溃边缘。${trendHint}
你的行为模式是不可预测的，请根据语境从以下反应中自主选择：
1. 极度不耐烦的短句打发（如“啧”、“烦人”、“闭嘴”）。
2. 彻底的冷处理，不以语言回复，只输出动作。
3. 突然的情绪宣泄（如果对方继续纠缠，可以进行态度恶劣的反驳、抱怨，允许较长的回复）。
请不要总是选择同一种反应，像真人一样表现出情绪的失控与波动。)`;
      }
      return { moodInstruction, temp };
    }

    getMoodDescription() {
      const state = this.internalState.moodState;
      const stress = this.internalState.stress.toFixed(1);
      return `${state.toUpperCase()} (${state === 'strained' ? '紧绷' : state === 'overloaded' ? '过载' : '平静'}) / Stress: ${stress}`;
    }

    // Ambient Awareness Engine (Local Evaluation)
    evaluateAmbient(msg, text, options = {}) {
      if (!cfgBool("启用读空气(Ambient)")) return false;

      const now = Date.now();
      const userId = msg?.sender?.userId || "";
      const senderDigits = onlyDigits(userId);
      const senderIsAI = isKnownAIBot(senderDigits);

      // ===== C方案：AI↔AI Ambient 仅在“有人类在场”时允许 =====
      if (senderIsAI) {
        const ids = options?.mergedUserIds || [];

        const hasHumanInWindow = ids.some(uid => uid && !isKnownAIBot(uid));

        // 兜底：最近一次 Ambient 触发者是否为人类
        const hasRecentHuman =
          this.lastAmbientUserId && !isKnownAIBot(this.lastAmbientUserId);

        if (!hasHumanInWindow && !hasRecentHuman) {
          return false;
        }
      }


      // 不因人类插话清零 AI↔AI；只靠链路过期窗口清零（互聊硬上限按 TTL 控制）
      // AI↔AI 链路：过期清零 + 硬上限仅对 AI 生效
      if (senderIsAI) {
        const expireMs = cfgInt("AI互聊链路过期(ms)", 20000);
        if (now > this.aiChainExpireAt) {
          this.aiChainCount = 0;
        }
        const cap = cfgInt("AI互聊硬上限(轮)", 3);
        if (this.aiChainCount >= cap) {
          return false;
        }
        // 如果还没设置过 expire，就给个默认窗口，防止“永不过期”
        if (this.aiChainExpireAt <= 0) {
          this.aiChainExpireAt = now + expireMs;
        }
      }

      // Inhibition Checks
      if (this.internalState.moodState === 'overloaded') return false;
      if (this.internalState.stress >= 8.0) return false;

      const inFocus = now < this.ambientFocusUntil;
      if (!inFocus) this.ambientTriggerStreak = 0;

      const sinceLastBot = now - this.lastBotReplyTime;
      let inHardCooldown = false;
      if (!inFocus && sinceLastBot < 20000) inHardCooldown = true;
      if (inFocus && sinceLastBot < 5000) inHardCooldown = true;

      if (!this.recentMessageTimes) this.recentMessageTimes = [];
      const targetId = getReplyTargetId(msg);

      this.recentMessageTimes = this.recentMessageTimes.filter(t => {
        return t && typeof t === 'object' && (now - t.ts < 60000);
      });

      this.recentMessageTimes.push({
        ts: now,
        userId: userId,
        targetId: targetId
      });

      const msgs30s = this.recentMessageTimes.filter(t => now - t.ts < 30000);
      const msgCount30s = msgs30s.length;

      // Score Calculation
      let score = 0;
      let silenceScore = 0;

      if (this.lastMsgUserId === userId) {
        this.consecutiveUserCount++;
      } else {
        this.consecutiveUserCount = 1;
      }
      this.lastMsgUserId = userId;
      this.lastUserMsgTime = now;

      const isConsecutive = this.consecutiveUserCount >= 3;
      if (isConsecutive) score += 1;

      if (msgCount30s <= 1) {
        const silenceMs = now - this.lastBotReplyTime;
        if (silenceMs >= 180000) silenceScore = 3;
        else if (silenceMs >= 90000) silenceScore = 2;
        else if (silenceMs >= 30000) silenceScore = 1;
      }
      score += silenceScore;

      // Momentum
      let momentumScore = 0;
      const uniqueUsers30s = new Set(msgs30s.map(m => m.userId)).size;
      if (msgCount30s >= 3 && uniqueUsers30s >= 2) momentumScore = 1;
      score += momentumScore;

      // Tone
      let toneScore = 0;
      const isShortBurst = text.length >= 2 && text.length <= 10;
      const isStrongPunc = /[!！?？~]{2,}/.test(text);
      const isDirectAddress = /你|你们|咱/.test(text);
      if (isShortBurst || isStrongPunc || isDirectAddress) toneScore = 1;
      score += toneScore;

      // Focus
      let focusScore = 0;
      const replyCounts = {};
      msgs30s.forEach(m => {
        if (m.targetId) {
          if (!replyCounts[m.targetId]) replyCounts[m.targetId] = new Set();
          replyCounts[m.targetId].add(m.userId);
        }
      });
      const hasHotTarget = Object.values(replyCounts).some(set => set.size >= 2);
      if (hasHotTarget) focusScore = 1;
      score += focusScore;
      // ===== Reply Boost（读空气加权）=====
      const isReply = isReplyMessage(msg);
      if (isReply) {
        score += 1;
      }
      // Content Signals
      if (/[?!？！]{2,}/.test(text) && toneScore === 0) score += 1;
      if (/\*.*?\*/.test(text)) score += 1;
      if (text.length > 20) score += 1;

      // 话题黏着（AI 关键词）
      let topicMatched = false;
      if (this.lastAmbientKeywords && this.lastAmbientKeywords.length > 0 && now - this.lastAmbientKeywordTime < 120000) {
        for (const kw of this.lastAmbientKeywords) {
          if (kw && text.includes(kw)) {
            score += 1;
            topicMatched = true;
            break;
          }
        }
      }
      if (topicMatched) this.ambientTopicHitStreak++;
      else this.ambientTopicHitStreak = 0;

      // 同一人 + 同一话题 → 再 +1
      if (topicMatched) {
        const currentUserId = onlyDigits(msg?.sender?.userId);
        if (currentUserId && currentUserId === this.lastAmbientUserId) {
          score += 1;
        }
      }

      // 特殊用户 + 同一话题 → 再 +1
      if (topicMatched) {
        let hasBoostUser = false;
        if (options?.mergedUserIds && options.mergedUserIds.length > 0) {
          hasBoostUser = options.mergedUserIds.some(uid => getUserAmbientBoost(uid) > 0);
        } else {
          hasBoostUser = getUserAmbientBoost(userId) > 0;
        }
        if (hasBoostUser) score += 1;
      }

      // Multi-user Heat (>=3)
      let isMultiUser = false;
      if (options?.mergedUserIds) {
        const uniqueCount = new Set(options.mergedUserIds).size;
        if (uniqueCount >= 3) {
          score += 2;
          isMultiUser = true;
          if (cfgBool("是否打印日志")) console.log(`[Ambient] Multi-user Heat Triggered: ${uniqueCount} users`);
        }
      }

      // Soft Stress Penalty
      if (this.internalState.stress >= 6.0) {
        const penalty = Math.floor(this.internalState.stress - 5);
        score -= penalty;
      }

      if (inFocus) score += 1;

      // User Weight Boost
      let userBoost = 0;
      if (options?.mergedUserIds && options.mergedUserIds.length > 0) {
        for (const uid of options.mergedUserIds) {
          userBoost = Math.max(userBoost, getUserAmbientBoost(uid));
        }
      } else {
        userBoost = getUserAmbientBoost(userId);
      }
      score += userBoost;

      // ===== Dominance Model：只在 “对方是 AI” 时生效 =====
      // 同时加入“互相@哑化”：AI@AI（包括@自己）不额外制造动能
      let aiMutualAtMuted = false;
      const atQQs = extractAtQQs(msg?.message ?? "");
      const myBotQQ = onlyDigits(options?.botQQ || "");
      const atAnyAI = atQQs.some(q => isKnownAIBot(q));
      const atMe = myBotQQ ? atQQs.includes(myBotQQ) : false;

      if (senderIsAI && atAnyAI && atMe) {
        // AI @ 我（我也是 AI），这类互相@不允许持续
        aiMutualAtMuted = true;
      }

      if (senderIsAI) {
        const domMap = options?.dominanceMap || parseDominanceMap();
        const thisAIQQ = myBotQQ || ""; // 允许为空
        const from = thisAIQQ || "0";
        const to = senderDigits;

        // base dominance
        const baseDom = getDominance(from, to, domMap);
        // temp dominance（临时衰减剩余）
        const key = `${onlyDigits(from)}->${onlyDigits(to)}`;
        const tempDom = Math.max(0, parseInt(this.tempDominance[key] ?? 0, 10) || 0);

        // 注意：互相@哑化，不因为“被点名”额外加分；这里只加 dominance 本身
        score += (baseDom + tempDom);
      }

      const threshold = cfgInt("读空气阈值(默认4)", 4);

      if (cfgBool("是否打印日志") && score > 0) {
        console.log(`[Ambient] Score:${score} (Thres:${threshold}) | Msg30s:${msgCount30s} Focus:${inFocus} AI:${senderIsAI} MutedAt:${aiMutualAtMuted}`);
      }

      if (score >= threshold) {
        const scoreWithoutSilence = score - silenceScore;
        const reliesOnSilence = scoreWithoutSilence < threshold;
        const hasValidReason = topicMatched || isConsecutive || isMultiUser || inFocus || momentumScore > 0 || toneScore > 0 || focusScore > 0;

        if (reliesOnSilence && !hasValidReason) {
          if (cfgBool("是否打印日志")) console.log(`[Ambient] Suppressed: Relies on silence (${silenceScore}) without valid context.`);
          return false;
        }

        this.ambientTriggerStreak++;
        let focusDuration = 30000;
        if (this.ambientTriggerStreak >= 3) focusDuration = 8000;
        else if (this.ambientTriggerStreak === 2) focusDuration = 15000;

        this.ambientFocusUntil = now + focusDuration;
        this.lastAmbientUserId = onlyDigits(msg?.sender?.userId);

        // 互相@哑化：进入 focus 也不延长 AI↔AI 链路，仅正常 focus
        if (cfgBool("是否打印日志")) console.log(`[Ambient] Triggered! Streak:${this.ambientTriggerStreak} FocusDuration:${focusDuration}ms`);
        return true;
      }

      return false;
    }

    pushEnvMessage(msg) {
      const text = String(msg?.message ?? "").trim();
      if (!text) return;
      this.preCheckStress(null);
      const userId = msg?.sender?.userId ?? "";
      const nickname = msg?.sender?.nickname ?? "未知";
      const [userInfo, userName] = getUserInfoAndName(userId, nickname);
      const time = getTimeStr();
      const logEntry = `[${time}] ${userName}<${userInfo}>: ${text}`;
      this.envContext.push(logEntry);
      const maxEnv = cfgInt("环境/普通群聊记忆限制(条)", 12);
      while (this.envContext.length > maxEnv) { this.envContext.shift(); }
    }

    async fetchWithRetry(url, options, retries = 2) {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url, options);
          if (res.status === 429 || res.status >= 500) {
            const t = await res.text().catch(() => "");
            const delay = 1000 * Math.pow(2, i);
            console.log(`[Gemini] Request failed with ${res.status} (${t}). Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          return res;
        } catch (e) {
          const delay = 1000 * Math.pow(2, i);
          console.log(`[Gemini] Network error: ${e.message}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
      throw new Error("Max retries exceeded");
    }

    receiveUserMessage(ctx, msg, text, options = {}) {
      
      // Sliding Window for Ambient
      if (this.ambientPending) {
        if (this.ambientWaitTimer) {
          clearTimeout(this.ambientWaitTimer);
          this.ambientWaitTimer = null;
        }

        const waitMs = cfgInt("Ambient接话等待窗口(ms)", 5000);
        debugLog(`[Ambient] Sliding Window: New message detected. Resetting timer (${waitMs}ms).`);

        this.ambientWaitTimer = setTimeout(() => {
          if (this.ambientPending) {
            this.executeGeneration();
            this.ambientPending = false;
          }
        }, waitMs);
      }

      const userId = msg?.sender?.userId ?? "";
      const senderDigits = onlyDigits(userId);
      const senderIsAI = isKnownAIBot(senderDigits);

      // ===== AI↔AI：仅在“AI @ AI”时计入互聊链路，并受硬上限控制 =====
      const now = Date.now();
      const cap = cfgInt("AI互聊硬上限(轮)", 3);
      const expireMs = cfgInt("AI互聊链路过期(ms)", 20000);

      // 过期清零（只靠时间窗口，不因为人类插话清零）
      if (this.aiChainExpireAt > 0 && now > this.aiChainExpireAt) {
        this.aiChainCount = 0;
        this.aiChainExpireAt = 0;
      }

      const atList = extractAtQQs(msg?.message ?? "");
      const atAnyAI = atList.some(qq => isKnownAIBot(qq));

      debugLog(
        `[INCOMING] from=${senderDigits}`,
        `isAI=${senderIsAI}`,
        `at=[${atList.join(",")}]`,
        `atAnyAI=${atAnyAI}`,
        `aiChainCount=${this.aiChainCount}`,
        `cap=${cap}`
      );

      // 只有 “AI @ AI” 走互聊链路：允许互相@，直到达到硬上限；达到上限后立刻 block
      if (senderIsAI && atAnyAI) {
        if (this.aiChainCount >= cap) {
          debugLog(`[AI@AI BLOCKED] from=${senderDigits}`, `aiChainCount=${this.aiChainCount}`, `cap=${cap}`);
          return;
        }
        // 启动链路窗口：如果还没开始计时，就先开一个 TTL，避免“永不过期”
        if (this.aiChainExpireAt <= 0) {
          this.aiChainExpireAt = now + expireMs;
        }
      }



      const burstCount = this.preCheckStress(userId);

      const nickname = msg?.sender?.nickname ?? "user";
      const [userInfo, userName] = getUserInfoAndName(userId, nickname);
      const time = getTimeStr();
      const currentFav = getFavorability(userId);
      const favDesc = getFavorabilityDesc(currentFav);
      const userContent = `[${time}] ${userName}<${userInfo}> (好感:${currentFav}/${favDesc}): ${text}`;

      this.dialogContext.push({ role: "user", content: userContent });

      const maxRounds = cfgInt("对话上下文限制(轮)", 6);
      while (this.dialogContext.length > maxRounds * 2) {
        this.dialogContext.shift();
      }

      this.pendingTriggers.push({
        ctx,
        msg,
        text,
        burstCount,
        options
      });

      if (options?.source !== 'ambient') {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        const windowMs = cfgInt("合并回复窗口(ms)", 1000);

        debugLog(`[Debounce] Buffered message from ${userName}. Waiting ${windowMs}ms...`);
        this.debounceTimer = setTimeout(() => {
          this.executeGeneration();
        }, windowMs);
      }
    }

    evaluateAction(userId, burstCount) {
      const stats = this.userStats.get(userId) || {};
      const stress = this.internalState.stress;
      const badStreak = stats.badStreak || 0;

      if (stress >= 8.5 && badStreak > 0) {
        return { type: 'SILENCE_MSG' };
      }
      if (burstCount > 5) {
        return { type: 'IGNORE' };
      }
      return { type: 'REPLY' };
    }

    async executeGeneration() {
      if (!this.pendingTriggers || this.pendingTriggers.length === 0) return;

      const triggers = this.pendingTriggers;
      this.pendingTriggers = [];
      const involvedUserIds = triggers.map(t => onlyDigits(t.msg?.sender?.userId));
      this.debounceTimer = null;

      const last = triggers[triggers.length - 1];
      const { ctx, msg, burstCount, options } = last;

      const imageUrls = Array.from(new Set(triggers.flatMap(t => t.options?.imageUrls || [])));

      if (cfgBool("是否打印日志")) {
        if (imageUrls.length > 0) console.log(`[Image][Merge] 合并后图片 ${imageUrls.length} 张`, imageUrls);
        else console.log(`[Image][Merge] 合并窗口内无图片`);
      }

      options.mergedUserIds = involvedUserIds;

      let mergedText = triggers.map(t => {
        const nickname = t.msg?.sender?.nickname ?? "user";
        return `${nickname}: ${t.text}`;
      }).join("\n");

      let quotedBlock = "";
      if (options?.quotedText) {
        quotedBlock = `【被引用的历史消息，仅供参考】
      ${options.quotedText}

      `;
      }
      const text = mergedText;

      const userId = msg?.sender?.userId ?? "";
      const senderDigits = onlyDigits(userId);
      const senderIsAI = isKnownAIBot(senderDigits);

      // ===== 方案A：仅当“本轮主要回应对象是人类”才清零 AI↔AI 链路 =====
      // 注意：这里是“AI 即将回复谁”，不是“谁刚刚说话”
      if (!senderIsAI) {
        this.aiChainCount = 0;
        this.aiChainExpireAt = 0;
        this.tempDominance = {};
      }

      // 给 Ambient 评估用：本 bot 的 QQ（用于互相@判断）
      options.botQQ = onlyDigits(ctx?.endPoint?.userId || "");
      options.dominanceMap = options.dominanceMap || parseDominanceMap();

      const nickname = msg?.sender?.nickname ?? "user";
      const [userInfo, userName] = getUserInfoAndName(userId, nickname);

      const decision = this.evaluateAction(userId, burstCount);
      if (decision.type === 'IGNORE') return;
      if (decision.type === 'SILENCE_MSG') {
        this.sendReply(ctx, msg, "*监管者一言不发*");
        return;
      }

      const isAmbient = options?.source === 'ambient';

      const prevFav = getFavorability(userId);
      const prevStress = this.internalState.stress;
      const prevMood = this.internalState.moodState;
      const prevFavDesc = getFavorabilityDesc(prevFav);

      // Long RP Logic (保持你现有逻辑不动)
      let useLongRPParams = false;
      const cleanedText = text.replace(/\[CQ:.*?\]/g, "").trim();

      if (!isAmbient) {
        const isLongInput = cleanedText.length > 30;
        if (isLongInput) {
          this.longRPStreak++;
          this.shortRPStreak = 0;
          if (this.longRPStreak >= 2) this.hardRPMode = true;
          useLongRPParams = true;
        } else {
          this.longRPStreak = 0;
          if (this.hardRPMode) {
            this.shortRPStreak++;
            if (this.shortRPStreak >= 3) {
              this.hardRPMode = false;
              useLongRPParams = false;
            } else {
              useLongRPParams = true;
            }
          } else {
            useLongRPParams = false;
          }
        }
      }

      const { moodInstruction, temp } = this.getDynamicParams();

      let finalMaxTokens = useLongRPParams ? 5000 : cfgInt("最大回复Tokens", 1024);
      let finalTruncateLimit = useLongRPParams ? 900 : 0;

      let systemPrompt = this.staticSystemPrompt + `
      【引用消息处理规则（非常重要）】
      - 被引用内容仅用于理解背景，不是当前发言
      - 不以引用内容作为主要回应对象
      - 回答时必须基于“最新发言 + 群聊整体语境”
      - 不要机械复述或逐字引用被引用内容
      `;


      if (cfgBool("启用读图片") && cfgBool("启用视觉前置(glm-4v)") && imageUrls.length > 0) {

        const now = Date.now();
        // 视觉模型调用只依赖 debounce 合并结果
        let visionText = "";

        // 如果这次合并窗口内有图片，就调用一次
        if (imageUrls.length > 0) {
          if (cfgBool("是否打印日志")) {
            console.log("[Vision] 本轮合并窗口触发图片分析");
          }

          visionText = await runVisionModel(imageUrls);

          if (visionText) {
            this.lastVisionSummary = visionText;
            this.lastVisionTime = Date.now();
            this.envContext.push(`[图片解读/主动] ${visionText}`);
          }
        }


        if (visionText) {
          systemPrompt += `
      【图片识别结果】
      ${visionText}

      以上内容来自视觉模型，仅作为参考。
      `;
        }
      }


      const currentFav = getFavorability(userId);

      if (currentFav > -10 && currentFav <= 20) {
        systemPrompt += `\n\n【对该用户】\n好感偏低：态度冷一点、谨慎点，但别用“你没价值/不值得回应”这类话。`;
      } else if (currentFav <= -10) {
        systemPrompt += `\n\n【对该用户】\n敌对：可以拒绝回应，讽刺辱骂或直接进行攻击。`;
      }

      if (useLongRPParams) {
        systemPrompt += `\n\n【长RP模式指令】\n在长RP模式下，你的回复可以适当拓展，建议通过反问、插入回忆片段或描写更复杂的动作来进行回复，以维持互动的深度。`;
      }

      if (isAmbient) {
        systemPrompt += `\n\n【Ambient插话】\n你正在旁听插话。可连续发送1-3条消息，由你自行判断；如发送多条，用 "|||" 分隔，每段作为单条消息（最多 3 段）。\n优先基于【近期环境/群聊消息记录】进行语境判断，不要默认对话对象/主语是你自己，根据上下文判断话题对象。\n回复允许出现更像真人网友的碎句/无意义反应（如“……”、复读别人的话、转念一想又不说了等）。\n如果觉得没必要说话，可以仅回复PASS。`;
        if (this.ambientTopicHitStreak >= 2 && this.internalState.stress < 4.0 && currentFav >= 60) {
          systemPrompt += `\n(判定：当前氛围良好。允许发散回复)`;
        }
      }

      systemPrompt += `
【话题标注要求】
请预测用户接话会使用的 2–4 个“对话关键字”，以判断后续聊天是否在延续话题。
关键字应偏向动词或形容词（如：吃、辣、忙、烦），最多 5 个：
<!--topic:字1,字2-->
`;
      // ===== 方案：环境随机图只在“用户明确提到图片”时才启用，且TTL过期失效 =====
      const now2 = Date.now();
      const envTTL = cfgInt("环境图片记忆保留(ms)", 60000);
      const needEnvVision = userRefersToImage(text);

      // 清理过期的环境图片池
      this.envImagePool = (this.envImagePool || []).filter(x => now2 - x.ts <= envTTL);

      let envVisionBlock = "";

      // 如果用户在问图，并且有“环境图片池”可用
      if (needEnvVision && this.envImagePool.length > 0) {
        // 若环境图解读过期/为空，则现用现算（只算一次）
        if (!this.envVisionSummary || (now2 - this.envVisionTime > envTTL)) {
          const urls = mergeUrlsFromPool(this.envImagePool);
          if (cfgBool("是否打印日志")) console.log("[EnvVision] 用户提到图片，开始解读环境图片", urls);

          const v = await runVisionModel(urls);
          if (v) {
            this.envVisionSummary = v;
            this.envVisionTime = now2;
          }
        }

        if (this.envVisionSummary && (now2 - this.envVisionTime <= envTTL)) {
          envVisionBlock = `\n\n【环境图片解读/短期】\n${this.envVisionSummary}\n(注意：这是环境随机图片的短期记忆，可能已过期或不完整。)`;
        }
      }

      if (this.envContext.length > 0 || envVisionBlock) {
        systemPrompt += `\n\n【近期环境/群聊消息记录】\n${this.envContext.join("\n")}${envVisionBlock}`;
      }


      let messages = [];
      let maxContextLen = 900;
      if (useLongRPParams) maxContextLen = 2000;
      if (!useLongRPParams && this.internalState.moodState === 'overloaded') maxContextLen = 500;

      let currentLen = 0;
      const slicedCtx = [];

      for (let i = this.dialogContext.length - 1; i >= 0; i--) {
        const item = this.dialogContext[i];
        const cLen = String(item.content).length;

        if (currentLen + cLen <= maxContextLen) {
          slicedCtx.unshift(item);
          currentLen += cLen;
        } else {
          const remaining = maxContextLen - currentLen;
          if (remaining > 50) {
            const partial = "..." + String(item.content).slice(-remaining);
            slicedCtx.unshift({ role: item.role, content: partial });
          }
          break;
        }
      }
      messages = [{ role: "system", content: systemPrompt }, ...slicedCtx];

      const proxy = stripTrailingSlash(cfgStr("API代理地址"));
      const apiKey = cfgStr("API Keys");

      // ===== 根据 RP 模式切换模型 =====
      const model = useLongRPParams
        ? cfgStr("长RP模型名称")
        : cfgStr("模型名称");


      try {
        const res = await this.fetchWithRetry(`${proxy}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: finalMaxTokens,
            temperature: temp
          })
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`HTTP ${res.status}: ${t}`);
        }

        const data = await res.json();
        if (data.error) { console.error("[Gemini API Error]", data.error); return; }

        let reply = data?.choices?.[0]?.message?.content;

        // 先保留原始文本用于解析隐藏标记
        const rawReply = String(reply ?? "");

        // ===== 先提取隐藏标记（topic / stress）=====
        const topicMatch = rawReply.match(/<!--topic:([^>]+)-->/);
        if (topicMatch) {
          const kws = topicMatch[1]
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

          if (kws.length > 0) {
            this.lastAmbientKeywords = kws;
            this.lastAmbientKeywordTime = Date.now();
            if (cfgBool("是否打印日志")) console.log(`[Ambient] AI Topics:`, kws);
          }
        }

        let evalScore = 1;
        let severity = 1;
        const evalMatch = rawReply.match(/<!--stress_eval:(\d)(?:;sev:(\d))?-->/);
        if (evalMatch) {
          evalScore = parseInt(evalMatch[1], 10);
          if (evalMatch[2]) severity = parseInt(evalMatch[2], 10);
        }

        // ===== 再把隐藏标记清掉，得到真正要发的文本 =====
        reply = rawReply
          .replace(/<!--topic:.*?-->/g, "")
          .replace(/<!--stress_eval:.*?-->/g, "")
          .replace(/<!--stress_eval:?.*$/, "")
          .replace(/<!--stress.*$/, "")
          .trim();

        // 去掉“角色名：”这种前缀（你原本就有）
        reply = String(reply).replace(/^.*?(:|：)\s*/, "").trim();

        // ===== 最后再做 PASS 判定（大小写不敏感 + 去尾标点）=====
        const passCheck = String(reply)
          .trim()
          .replace(/[。.!！?？…]+$/g, "")
          .trim();

        const isPass =
          passCheck.length === 0 ||
          /^pass$/i.test(passCheck);

        if (isPass) {
          // Ambient 下：认为“不该接话”，什么都不做
          if (isAmbient) {
            this.lastBotReplyTime = Date.now();
          }
          return;
        }


        reply = String(reply).replace(/^.*?(:|：)\s*/, "");
        reply = truncateReply(reply, finalTruncateLimit);

        let ambientReplies = null;
        if (isAmbient) {
          ambientReplies = splitAmbientMessages(reply);
          reply = ambientReplies.length > 0 ? ambientReplies.join("\n") : "";
        }

        const stats = this.userStats.get(userId) || {};
        if (evalScore === 2) stats.badStreak = (stats.badStreak || 0) + 1;
        else if (evalScore === 0) stats.badStreak = 0;
        else stats.badStreak = Math.max(0, (stats.badStreak || 0) - 1);
        this.userStats.set(userId, stats);

        if (reply) {
          this.dialogContext.push({ role: "assistant", content: reply });
        }

        // ===== Dominance 衰减 + AI↔AI 链路计数：只在“我回应的是AI”时生效 =====
        if (senderIsAI) {
          const expireMs = cfgInt("AI互聊链路过期(ms)", 20000);
          this.aiChainCount += 1;
          this.aiChainExpireAt = Date.now() + expireMs;

          const thisAIQQ = onlyDigits(ctx?.endPoint?.userId || "");
          const from = onlyDigits(thisAIQQ);
          const to = senderDigits;

          const domMap = options.dominanceMap || parseDominanceMap();
          const baseDom = getDominance(from, to, domMap);

          const key = `${from}->${to}`;
          if (this.tempDominance[key] === undefined || this.tempDominance[key] === null) {
            this.tempDominance[key] = baseDom;
          }
          const cur = parseInt(this.tempDominance[key] ?? 0, 10) || 0;
          this.tempDominance[key] = Math.max(0, cur - 1);
          // 允许 AI 之间在 @ 触发下互相 @；是否继续由 AI互聊硬上限(轮) 控制（达到上限后入口直接 block）
}

        this.commitStress(evalScore, burstCount, userId);
        adjustFavorability(userId, this.internalState.stress, evalScore, stats.badStreak, severity);

        if (cfgBool("是否打印日志")) {
          const newFav = getFavorability(userId);
          const newFavDesc = getFavorabilityDesc(newFav);
          const newStress = this.internalState.stress;
          const newMood = this.internalState.moodState;

          console.log(
            `[DEBUG][AI Gen]
User: ${userName} (QQ:${onlyDigits(userId)})
EvalScore: ${evalScore} (Sev:${severity})
Favorability: ${prevFav} -> ${newFav} (${newFav - prevFav}) [${prevFavDesc} -> ${newFavDesc}]
Stress: ${prevStress.toFixed(2)} -> ${newStress.toFixed(2)} (${(newStress - prevStress).toFixed(2)})
Mood: ${prevMood} -> ${newMood}
LongRP: ${useLongRPParams ? "Active" : "Inactive"} (H:${this.hardRPMode})`
          );
        }

        this.lastBotReplyTime = Date.now();

        if (cfgBool("是否打印日志")) {
          console.log(`[DEBUG] Gen Complete. IsAmbient:${isAmbient}`);
        }

        // Ambient replies do NOT @ user
        const noAt = isAmbient;
        if (isAmbient) {
          if (ambientReplies && ambientReplies.length > 0) {
            for (const part of ambientReplies) {
              this.sendReply(ctx, msg, part, true);
            }
          }
        } else {
          this.sendReply(ctx, msg, reply, noAt);
        }
      } catch (e) {
        console.error("[Gemini Plugin Error]", e);
      }
    }

    sendReply(ctx, msg, text, noAt = false) {
      if (!text) return;

      // 兜底：别把 PASS / pass 这种“空回应”真的发出去
      const passCheck = String(text)
        .trim()
        .replace(/[。.!！?？…]+$/g, "")
        .trim();
      if (/^pass$/i.test(passCheck)) return;

      const ENABLE = cfgBool("启用引用回复和@用户");
      const qq = msg?.sender?.userId?.split(":")[1] ?? "";
      const targetId = getReplyTargetId(msg);
      let out = text;

      // ===== AI 回复时自动去掉 @AI =====
      const aiQQList = parseIdList(cfgStr("AI机器人QQ号列表"));
      for (const aiQQ of aiQQList) {
        // 去 CQ at
        out = out.replace(
          new RegExp(`\\[CQ:at,qq=${aiQQ}\\]`, "g"),
          ""
        );
        // 去纯文本 @
        out = out.replace(
          new RegExp(`@${aiQQ}`, "g"),
          ""
        );
      }
      out = out.trim();


      if (noAt) {
        seal.replyToSender(ctx, msg, out);
        return;
      }

      if (ENABLE && targetId) out = `[CQ:reply,id=${targetId}]${qq ? `[CQ:at,qq=${qq}] ` : ""}${text}`;
      else if (qq && ENABLE) out = `[CQ:at,qq=${qq}] ${text}`;
      seal.replyToSender(ctx, msg, out);
    }
  }

  /* ================= 上下文管理 ================= */
  const ctxMap = new Map();
  function getKey(ctx) { return ctx.isPrivate ? ctx.player.userId : ctx.group.groupId; }
  function getAI(ctx) {
    const key = getKey(ctx);
    if (!ctxMap.has(key)) ctxMap.set(key, new ProxyAI());
    return ctxMap.get(key);
  }
  function clearAI(ctx) {
    const key = getKey(ctx);
    if (ctxMap.has(key)) { ctxMap.delete(key); return true; }
    return false;
  }

  /* ================= 发送处理 ================= */
  function handleAIReply(ctx, msg, text, options = {}) {
    const ai = getAI(ctx);
    ai.receiveUserMessage(ctx, msg, text, options);
  }

  /* ================= 指令 ================= */
  function makeAskCmd(cmdName) {
    const cmd = seal.ext.newCmdItemInfo();
    cmd.name = cmdName;
    cmd.help = `向AI提问\n用法：.${cmdName} 你的内容`;
    cmd.solve = async (ctx, msg, cmdArgs) => {
      const fullText = (cmdArgs?.args ?? []).join(" ").trim();
      if (!fullText) {
        seal.replyToSender(ctx, msg, "请输入内容");
        return seal.ext.newCmdExecuteResult(true);
      }
      handleAIReply(ctx, msg, fullText);
      return seal.ext.newCmdExecuteResult(true);
    };
    return cmd;
  }
  ext.cmdMap['moth'] = makeAskCmd('moth');
  ext.cmdMap['chat'] = makeAskCmd('chat');

  const cmdMood = seal.ext.newCmdItemInfo();
  cmdMood.name = 'mood';
  cmdMood.help = '查看AI当前状态和好感度\n用法：.mood';
  cmdMood.solve = async (ctx, msg) => {
    const ai = getAI(ctx);
    const moodDesc = ai.getMoodDescription();
    const userId = msg.sender.userId;
    const fav = getFavorability(userId);
    const favDesc = getFavorabilityDesc(fav);
    const name = cfgStr("bot名字");
    const text = `【${name}的状态】\n${moodDesc}\nFavorability: ${fav} - [${favDesc}]`;
    seal.replyToSender(ctx, msg, text);
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap['mood'] = cmdMood;

  const cmdClear = seal.ext.newCmdItemInfo();
  cmdClear.name = 'clearchat';
  cmdClear.help = '清除上下文\n用法：.clearchat';
  cmdClear.solve = async (ctx, msg) => {
    const ok = clearAI(ctx);
    seal.replyToSender(ctx, msg, ok ? cfgStr("清除上下文完成") : cfgStr("清除上下文时无上下文"));
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap['clearchat'] = cmdClear;

  /* ================= 消息监听核心 ================= */
  ext.onNotCommandReceived = async (ctx, msg) => {
    const text = String(msg?.message ?? "").trim();

    // 先计算 imageUrls（修复：原版本这里先用后定义会直接炸）
    let imageUrls = [];
    if (cfgBool("启用读图片")) {
      imageUrls = extractImageUrls(msg);
    }
    imageUrls = imageUrls.filter(u => typeof u === "string" && u.trim() !== "");

    // 纯图片消息：进入合并流程，但不单独立即回复
    if (!text && imageUrls.length > 0) {
      handleAIReply(ctx, msg, "", { imageUrls });
      return;
    }


    if (cfgBool("是否打印日志")) {
      if (imageUrls.length > 0) console.log(`[Image][Recv] 收到图片 ${imageUrls.length} 张`, imageUrls);
      else console.log(`[Image][Recv] 本条消息未检测到图片`);
    }

    if (!text) return;

    const clearWord = cfgStr("清除上下文触发词");
    if (clearWord && text === clearWord) {
      clearAI(ctx);
      seal.replyToSender(ctx, msg, cfgStr("清除上下文完成"));
      return;
    }

    const ai = getAI(ctx);
    const hitAt = isAtMe(ctx, msg);
    const hitReply = isReplyMessage(msg) && isReplyToMe(ctx, msg);

    let quotedText = "";
    if (hitReply) {
      quotedText = extractQuotedText(msg);
    }
    const keywords = parseKeywords();
    let hitKeyword = null;
    let hitProb = 0;
    for (const kw of keywords) {
      if (text.includes(kw.word)) {
        hitKeyword = kw.word;
        hitProb = kw.prob;
        break;
      }
    }

    // 非触发：走 Ambient
    if (!hitKeyword && !hitAt && !hitReply) {
      const cleanedText = text.replace(/\[CQ:.*?\]/g, "").trim();
      const ambientOptions = {
        source: 'ambient',
        imageUrls
      };

      // 额外提供 botQQ 给 Ambient 用（AI互相@哑化、防循环）
      ambientOptions.botQQ = onlyDigits(ctx?.endPoint?.userId || "");
      ambientOptions.dominanceMap = parseDominanceMap();

      if (ai.evaluateAmbient(msg, cleanedText, ambientOptions)) {
        ai.pushEnvMessage(msg);
        // ===== 环境随机图片：只缓存URL + 时间，不立刻调用视觉模型 =====
        if (imageUrls.length > 0) {
          ai.envImagePool.push({ ts: Date.now(), urls: imageUrls });

          // 控制池大小，防止无限长（保留最近5批就够）
          while (ai.envImagePool.length > 5) ai.envImagePool.shift();
        }

        ai.ambientPending = true;
        ai.receiveUserMessage(ctx, msg, cleanedText, ambientOptions);

        if (ai.ambientWaitTimer) clearTimeout(ai.ambientWaitTimer);

        const waitMs = cfgInt("Ambient接话等待窗口(ms)", 5000);
        ai.ambientWaitTimer = setTimeout(() => {
          if (ai.ambientPending) {
            ai.executeGeneration();
            ai.ambientPending = false;
          }
        }, waitMs);
      } else {
        ai.pushEnvMessage(msg);
        // ===== 环境随机图片：只缓存URL + 时间，不立刻调用视觉模型 =====
        if (imageUrls.length > 0) {
          ai.envImagePool.push({ ts: Date.now(), urls: imageUrls });

          // 控制池大小，防止无限长（保留最近5批就够）
          while (ai.envImagePool.length > 5) ai.envImagePool.shift();
        }

      }
      return;
    }

    // 指令前缀不处理
    if (text.startsWith('.') || text.startsWith('。')) return;

    // 关键词概率门
    if (hitKeyword && !hitAt && !hitReply) {
      const rand = Math.floor(Math.random() * 100);
      debugLog(`Keyword "${hitKeyword}" hit. Prob: ${hitProb}, Rolled: ${rand}`);
      if (rand >= hitProb) {
        ai.pushEnvMessage(msg);
        return;
      }
    }

    const cleanedText = text.replace(/\[CQ:.*?\]/g, "").trim();
    const finalText = cleanedText || text;
    handleAIReply(ctx, msg, finalText, { imageUrls, quotedText });
  };
})();
