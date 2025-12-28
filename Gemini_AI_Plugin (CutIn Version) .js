// ==UserScript==
// @name         Gemini AI Plugin（Proxy RP Enhanced V3）
// @description  OpenAI-compatible 反代专用 + 双轨记忆系统/多词触发概率/时间感知/特殊身份映射 + 动态状态机 + 好感度系统 + 主观压力判定
// @version      1.9.34-topic-fix
// @author       cz
// @license      MIT
// ==/UserScript==

(function () {
  const EXT_NAME = 'Gemini AI Plugin（活人感增强）';
  if (seal.ext.find(EXT_NAME)) {
    seal.ext.unregister(seal.ext.find(EXT_NAME));
  }

  const ext = seal.ext.new(EXT_NAME, 'cz', '1.9.34-topic-fix');
  ext.enabled = true;
  seal.ext.register(ext);

  /* ================= 配置项 ================= */
  seal.ext.registerStringConfig(ext, "API代理地址", "https://gcli.ggchan.dev");
  seal.ext.registerStringConfig(ext, "API Keys", "gg-gcli-xxxxxxxxxxxxxxxxxxxxxxxx");
  seal.ext.registerStringConfig(ext, "模型名称", "gemini-2.5-flash-search");

  seal.ext.registerIntConfig(ext, "最大回复Tokens", 1024);
  seal.ext.registerIntConfig(ext, "最大回复字符数(防抽风)", 800);
  
  // [Debounce]
  seal.ext.registerIntConfig(ext, "合并回复窗口(ms)", 1200);

  // [New] Ambient Awareness Config
  seal.ext.registerBoolConfig(ext, "启用读空气(Ambient)", false);
  seal.ext.registerIntConfig(ext, "读空气阈值(默认4)", 4);
  seal.ext.registerIntConfig(ext, "Ambient接话等待窗口(ms)", 5000);
  seal.ext.registerStringConfig(ext, "读空气权重(用户ID:加分)", ""); 
  

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
  function isReplyMessage(msg) {
    if (/\[CQ:reply,id=\d+\]/.test(String(msg?.message ?? ""))) return true;
    if (Array.isArray(msg?.elements)) {
      return msg.elements.some(e => e && (e.type === "reply" || e.type === "Reply") && (e.id || e.messageId));
    }
    return !!(msg?.replyId || msg?.quoteId || msg?.source?.id);
  }
  function getReplyTargetId(msg) {
    const m = String(msg?.message ?? "").match(/\[CQ:reply,id=(\d+)\]/);
    if (m && m[1]) return String(m[1]);
    if (Array.isArray(msg?.elements)) {
      const r = msg.elements.find(e => e && (e.type === "reply" || e.type === "Reply"));
      if (r) return String(r.id ?? r.messageId);
    }
    return msg?.replyId || msg?.rawId || "";
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
        // Fix: Normalize colons to handle Chinese input
        const normalized = p.replace(/：/g, ":"); 
        const lastIdx = normalized.lastIndexOf(":");
        if (lastIdx === -1) continue;
        
        const idPart = normalized.substring(0, lastIdx).trim();
        const scorePart = normalized.substring(lastIdx + 1).trim();
        const score = parseInt(scorePart, 10);
        
        if (isNaN(score)) continue;
        
        // Robust comparison: Match exact string OR match numeric part
        if (idPart === targetUserId || (targetDigits && onlyDigits(idPart) === targetDigits)) {
            return score;
        }
    }
    return 0;
  }
  function extractSimpleKeyword(text) {
    if (!text) return null;
    // 去掉表情、符号，只保留中文和字母
    const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
    if (cleaned.length < 2) return null;
    // 取前 4 个字作为“话题锚点”
    return cleaned.slice(0, 4);
  } 


  /* ================= 好感度管理 ================= */
  let favorabilityStore = {}; 
  try {
      if (ext && typeof ext === 'object') {
          if (!ext.storage) { try { ext.storage = {}; } catch(e) {} }
          if (ext.storage) { ext.storage._test = 1; favorabilityStore = ext.storage; }
      }
  } catch (e) {
      console.error("[Gemini] Storage init warning (using memory):", e);
      favorabilityStore = {};
  }
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
      return "挚爱";
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
请根据用户输入的价值，判断其对你的精神消耗程度，并在回复末尾附加不可见的分类标签 <!--stress_eval:X-->：
0：有意义/有趣的互动（令你感兴趣或放松，例如认真的提问、安慰、送礼）
1：中性/普通（无功无过，例如日常问候、短句）
2：负面行为（消耗你的耐心或令你反感）。此时请务必判定严重等级(1-3)，格式为 <!--stress_eval:2;sev:X-->：
   sev:1 (轻微)：调戏、无聊的刷屏、非恶意的冒犯。
   sev:2 (中等)：明确的语言羞辱、恶毒嘲讽、不尊重。
   sev:3 (严重)：敌对、暴力威胁、极度侮辱。
注意：
1. 请严格遵守上述格式，不要输出多余内容。
2. 标签必须严格附加在回复的最末尾。
3. 不要在回复正文中提及此标签或分类过程。`;
    if (useTime) {
      const now = new Date();
      prompt += `\n\n【现实时间】\n${now.toLocaleString('zh-CN', { hour12: false })}。对话中若涉及时间，请以此为准。`;
    }
    return prompt;
  }
  function truncateReply(s, customLimit) {
    const maxChars = customLimit || cfgInt("最大回复字符数(防抽风)", 800);
    const text = String(s ?? "");
    return text.length <= maxChars ? text : text.slice(0, maxChars) + `...`;
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

      // { userId: { lastTime, burstCount, badStreak } }
      this.userStats = new Map();
      this.lastActiveUserId = null;

      // [New] Ambient State
      this.lastBotReplyTime = 0;
      this.lastUserMsgTime = 0;
      this.consecutiveUserCount = 0;
      this.lastMsgUserId = null;
      this.ambientFocusUntil = 0; // Ambient 关注窗口截止时间
      this.lastAmbientTopic = null;      // 最近一次 Ambient 话题关键词
      this.lastAmbientTopicTime = 0;     // 话题记录时间
      this.lastAmbientUserId = null;
      
      // [FIX] Initialize missing properties
      this.lastAmbientKeywords = [];
      this.lastAmbientKeywordTime = 0;
      this.ambientTriggerStreak = 0; // 连续触发计数 (Focus Decay)
      this.ambientTopicHitStreak = 0; // 话题命中连击 (Long Reply Check)

      // [New] Activity Tracker
      this.recentMessageTimes = []; 

      this.internalState = {
        stress: 0,
        moodState: 'calm',
        recentEvals: [],
        lastStressRiseTime: Date.now(), 
        lastDecayCheckTime: Date.now()  
      };

      this.debounceTimer = null;
      this.pendingTrigger = null; 
      // 【新增】用于合并多条消息
      this.pendingTriggers = [];
      this.ambientWaitTimer = null;
      this.ambientPending = false;
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
      // [Unified] Removed maxTokens local logic logic. It is now handled centrally in executeGeneration.

      if (state === 'calm') {
        moodInstruction = "(当前状态：平静、耐心。你可以展开聊聊，或者开个玩笑)";
        temp = 1.0; 
      } else if (state === 'strained') {
        moodInstruction = "(当前状态：有些被环境噪音打扰。回复请简洁明了，不要长篇大论)";
        temp = 1.0;
      } else { 
        temp = 0.9; 
        const recentEvals = this.internalState.recentEvals || [];
        const isProvoked = recentEvals.some(e => e === 2);
        let trendHint = isProvoked ? "近期连续受到干扰/垃圾信息刺激，你的怒气值正在飙升。" : "长期处于高压状态，你感到精神透支、麻木且疲惫。";
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

    // [New] Ambient Awareness Engine (Local Evaluation)
    evaluateAmbient(msg, text, options = {}) {
        if (!cfgBool("启用读空气(Ambient)")) return false;
        
        const now = Date.now();
        const userId = msg?.sender?.userId || "";
        
        // 1. Inhibition Checks
        if (this.internalState.moodState === 'overloaded') return false;
        // [Opt 4] Soft Stress Throttling
        // Hard stop at 8.0 instead of 7.0
        if (this.internalState.stress >= 8.0) return false;

        const inFocus = now < this.ambientFocusUntil;
        // Focus expired check: reset streak
        if (!inFocus) {
            this.ambientTriggerStreak = 0;
        }

        // 非关注状态：严格冷却（20 秒）
        if (!inFocus && now - this.lastBotReplyTime < 20000) return false;

        // 关注状态：允许低频连续插话（5 秒）
        if (inFocus && now - this.lastBotReplyTime < 5000) return false;

        // [New] Activity Tracker (Req 2)
        if (!this.recentMessageTimes) this.recentMessageTimes = [];
        this.recentMessageTimes.push(now);
        // Keep last 60s
        this.recentMessageTimes = this.recentMessageTimes.filter(t => now - t < 60000);
        // Count recent messages in last 30s. Since current msg is included, count >= 1.
        const msgCount30s = this.recentMessageTimes.filter(t => now - t < 30000).length;

        
        // 2. Score Calculation
        let score = 0;
        let silenceScore = 0;
        
        // Rhythm: Consecutive user messages
        if (this.lastMsgUserId === userId) {
            this.consecutiveUserCount++;
        } else {
            this.consecutiveUserCount = 1;
        }
        this.lastMsgUserId = userId;
        this.lastUserMsgTime = now;
        
        const isConsecutive = this.consecutiveUserCount >= 3;
        if (isConsecutive) score += 1;
        
        // [Opt 3 + Req 1 + Req 2] Silence Scoring
        // Only apply if low activity (<= 1 message in last 30s, i.e., only this current one)
        if (msgCount30s <= 1) {
            const silenceMs = now - this.lastBotReplyTime;
            if (silenceMs >= 180000) silenceScore = 3;       // > 3m (Capped at 3)
            else if (silenceMs >= 90000) silenceScore = 2;   // > 1.5m
            else if (silenceMs >= 30000) silenceScore = 1;   // > 30s
        }
        score += silenceScore;
        
        // Content Signals
        if (/[?!？！]{2,}/.test(text)) score += 1; // Strong emotion
        if (/\*.*?\*/.test(text)) score += 1; // Action
        if (text.length > 15 && /[?？]/.test(text)) score += 1; // Possible question
        if (text.length > 20) score += 1; 
        
        // 话题黏着（AI 关键词）
        let topicMatched = false;
        if (
            this.lastAmbientKeywords && // Added check
            this.lastAmbientKeywords.length > 0 &&
            now - this.lastAmbientKeywordTime < 120000
        ) {
            for (const kw of this.lastAmbientKeywords) {
                if (kw && text.includes(kw)) {
                    score += 1;
                    topicMatched = true;
                    break;
                }
            }
        }

        if (topicMatched) {
            this.ambientTopicHitStreak++;
        } else {
            this.ambientTopicHitStreak = 0;
        }


        // 同一人 + 同一话题 → 再 +1
        if (topicMatched) {
            const currentUserId = onlyDigits(msg?.sender?.userId);
            if (currentUserId && currentUserId === this.lastAmbientUserId) {
                score += 1;
            }
        }

        // 特殊用户 + 同一话题 → 再 +1
        if (topicMatched && options?.mergedUserIds && options.mergedUserIds.length > 0) {
            for (const uid of options.mergedUserIds) {
                if (getUserAmbientBoost(uid) > 0) {
                    score += 1;
                    break;
                }
            }
        }

        // [Opt 5] Multi-user Heat
        let isMultiUser = false;
        if (options?.mergedUserIds) {
            const uniqueCount = new Set(options.mergedUserIds).size;
            if (uniqueCount >= 3) {
                score += 2;
                isMultiUser = true;
                if (cfgBool("是否打印日志")) console.log(`[Ambient] Multi-user Heat Triggered: ${uniqueCount} users`);
            }
        }

        // [Opt 4] Soft Stress Penalty
        if (this.internalState.stress >= 6.0) {
            // 6.0 -> -1, 7.0 -> -2
            const penalty = Math.floor(this.internalState.stress - 5);
            score -= penalty;
        }
        
        // [New] User Weight Boost
        let userBoost = 0;

        // 如果是合并消息，取所有参与者的最大加权
        if (options?.mergedUserIds && options.mergedUserIds.length > 0) {
            for (const uid of options.mergedUserIds) {
                userBoost = Math.max(userBoost, getUserAmbientBoost(uid));
            }
        } else {
            userBoost = getUserAmbientBoost(userId);
        }

        score += userBoost;


        const threshold = cfgInt("读空气阈值(默认4)", 4);
        
        if (cfgBool("是否打印日志") && score > 0) {
            console.log(`[Ambient] Score:${score} (Base:${score-userBoost-silenceScore} Silence:${silenceScore} Boost:${userBoost}) (Thres:${threshold}) | Users:${this.consecutiveUserCount} Msg30s:${msgCount30s} Focus:${inFocus}`);
        }
        
        if (score >= threshold) {
            // [Req 3] Guard against sole silence trigger
            const scoreWithoutSilence = score - silenceScore;
            const reliesOnSilence = scoreWithoutSilence < threshold;
            const hasValidReason = topicMatched || isConsecutive || isMultiUser || inFocus;

            if (reliesOnSilence && !hasValidReason) {
                if (cfgBool("是否打印日志")) console.log(`[Ambient] Suppressed: Relies on silence (${silenceScore}) without valid context.`);
                return false;
            }

            // [Opt 2] Focus Decay
            this.ambientTriggerStreak++;
            let focusDuration = 30000;
            if (this.ambientTriggerStreak >= 3) focusDuration = 8000;
            else if (this.ambientTriggerStreak === 2) focusDuration = 15000;
            
            this.ambientFocusUntil = now + focusDuration;
            this.lastAmbientUserId = onlyDigits(msg?.sender?.userId);

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
    
    async fetchWithRetry(url, options, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, options);
                if (res.status === 429 || res.status >= 500) {
                    const t = await res.text().catch(()=>"");
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

    // [Updated] receiveUserMessage with options
    receiveUserMessage(ctx, msg, text, options = {}) {
        // ★ 有新消息 → 重置 Ambient 等待窗口 (Sliding Window)
        // 任何新消息都重置等待窗口，严格遵循“最后一条消息+5秒”的触发规则
        if (this.ambientPending) {
            if (this.ambientWaitTimer) {
                clearTimeout(this.ambientWaitTimer);
                this.ambientWaitTimer = null;
            }

            const waitMs = cfgInt("Ambient接话等待窗口(ms)", 5000);
            debugLog(`[Ambient] Sliding Window: New message detected. Resetting timer (${waitMs}ms).`);
            
            this.ambientWaitTimer = setTimeout(() => {
                // 计时器结束时，如果仍处于 pending 状态，则执行生成
                if (this.ambientPending) {
                    this.executeGeneration();
                    this.ambientPending = false;
                }
            }, waitMs);
            // 注意：此处不再将 ambientPending 设为 false，保持等待状态
        }


        const userId = msg?.sender?.userId ?? "";
        
        // 1. Immediate Stats Update
        const burstCount = this.preCheckStress(userId);

        // 2. Record to Context
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

        // 3. Update Pending Triggers (merge instead of overwrite)
        this.pendingTriggers.push({
            ctx,
            msg,
            text,
            burstCount,
            options
        });


        // 4. Debounce（非 Ambient 才使用）
        if (options?.source !== 'ambient') {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            const windowMs = cfgInt("合并回复窗口(ms)", 1000);

            debugLog(`[Debounce] Buffered message from ${userName}. Waiting ${windowMs}ms...`);
            this.debounceTimer = setTimeout(() => {
                this.executeGeneration();
            }, windowMs);
        }
    }

    // Decision Layer
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

      // 取出并清空缓冲区
      const triggers = this.pendingTriggers;
      this.pendingTriggers = [];
      // 收集本次合并涉及到的所有用户ID
      const involvedUserIds = triggers.map(t => onlyDigits(t.msg?.sender?.userId));
      this.debounceTimer = null;

      // 以最后一条消息作为“回复对象”
      const last = triggers[triggers.length - 1];
      const { ctx, msg, burstCount, options } = last;
      // ★ 新增：把合并消息的用户ID传给 Ambient
      options.mergedUserIds = involvedUserIds;
      // 合并所有文本（核心）
      const mergedText = triggers.map(t => {
          const nickname = t.msg?.sender?.nickname ?? "user";
          return `${nickname}: ${t.text}`;
      }).join("\n");

      // 后续逻辑统一使用 mergedText
      const text = mergedText;


      const userId = msg?.sender?.userId ?? "";
      const nickname = msg?.sender?.nickname ?? "user";
      const [userInfo, userName] = getUserInfoAndName(userId, nickname);

      // [Decision]
      const decision = this.evaluateAction(userId, burstCount);
      if (decision.type === 'IGNORE') return;
      if (decision.type === 'SILENCE_MSG') {
          this.sendReply(ctx, msg, "*监管者一言不发*");
          return;
      }

      // [Ambient Check]
      const isAmbient = options?.source === 'ambient';

      // Proceed to REPLY (API Call)
      const prevFav = getFavorability(userId); 
      const prevStress = this.internalState.stress;
      const prevMood = this.internalState.moodState;
      const prevFavDesc = getFavorabilityDesc(prevFav);

      // ===== Rhythm-based Long RP Logic =====
      // [Rule] Ambient disables Long RP
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
      
      // [Unified Token Logic]
      // Long RP gets 5000.
      // EVERYTHING else (Ambient, Short, Strained, Overloaded) gets the Config value "最大回复Tokens".
      let finalMaxTokens = useLongRPParams ? 5000 : cfgInt("最大回复Tokens", 1024);
      
      let finalTruncateLimit = useLongRPParams ? 900 : 0; 

      let systemPrompt = this.staticSystemPrompt;
      const currentFav = getFavorability(userId);

      if (currentFav > -10 && currentFav <= 20) {
          systemPrompt += `\n\n【针对该用户的特殊行为指令】\n当前好感度处于[冷淡/保留]区间（考察期）。\n规则：1. 表现需冷淡、审视、保持距离。\n2. **绝对禁止**使用否定其存在价值的话术（如“你的话没意义”、“不值得回应”）。\n3. 允许用户通过解释或道歉修复关系。`;
      } else if (currentFav <= -10) {
          systemPrompt += `\n\n【针对该用户的特殊行为指令】\n当前好感度处于[敌对]区间。你可以拒绝回应，表达对他的厌恶，甚至表现出攻击性或直接进行攻击。`;
      }

      if (useLongRPParams) {
          systemPrompt += `\n\n【长RP模式指令】\n在长RP模式下，你的回复可以适当拓展，建议通过反问、插入回忆片段或描写更复杂的动作来进行回复，以维持互动的深度。`;
      }
      
      // [New] Ambient Instruction
      if (isAmbient) {
          systemPrompt += `\n\n【特殊指令：环境感知模式】\n你正在基于“读空气”机制主动插话。请扮演一个旁观者或观察者，回复必须简短、克制（1-2句话）。不要试图主导话题。如果觉得没必要说话，可以回复“PASS”。`;
          
          // [Opt 6] Occasional Long Reply
          if (this.ambientTopicHitStreak >= 2 && this.internalState.stress < 4.0 && currentFav >= 60) {
              systemPrompt += `\n(判定：当前话题热度高且氛围良好。允许你稍微展开回复（3-4句），可以加入更多细节或互动)`;
          }
      }

      // [Global] Topic tagging for ALL replies (Active & Ambient)
      // 这允许主动触发的回复也能更新话题缓存，从而在后续 Ambient 判定中增加话题连续性的权重
      systemPrompt += `
      【话题标注要求】
      请在回复末尾附加不可见标签：
      <!--topic:关键词1,关键词2-->
      关键词为当前对话的核心概念，最多 5 个。
      `;

      systemPrompt += `\n\n【当前AI心理状态与行动指南】\n${moodInstruction}`;

      if (this.envContext.length > 0) {
        systemPrompt += `\n\n【近期环境/群聊消息记录】\n(背景噪音/旁听)\n${this.envContext.join("\n")}`;
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
      const model = cfgStr("模型名称");

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
          if (!reply || reply.trim() === "PASS") {
             console.warn("[Gemini] Empty reply or PASS.");
             return;
          }
          // ===== 5.2 提取 AI 判定的话题关键词 =====
          const topicMatch = reply.match(/<!--topic:([^>]+)-->/);
          if (topicMatch) {
              const kws = topicMatch[1]
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean);

              if (kws.length > 0) {
                  this.lastAmbientKeywords = kws;
                  this.lastAmbientKeywordTime = Date.now();

                  if (cfgBool("是否打印日志")) {
                      console.log(`[Ambient] AI Topics:`, kws);
                  }
              }
          }

          let evalScore = 1; 
          let severity = 1; 
          const evalMatch = reply.match(/<!--stress_eval:(\d)(?:;sev:(\d))?-->/);
          if (evalMatch) {
              evalScore = parseInt(evalMatch[1], 10);
              if (evalMatch[2]) severity = parseInt(evalMatch[2], 10);
          }

          reply = reply
              .replace(/<!--topic:.*?-->/g, "")      // ★ 新增这一行
              .replace(/<!--stress_eval:.*?-->/g, "")
              .replace(/<!--stress_eval:?.*$/, "")
              .replace(/<!--stress.*$/, "")
              .trim();

          reply = String(reply).replace(/^.*?(:|：)\s*/, "");
          reply = truncateReply(reply, finalTruncateLimit);

          const stats = this.userStats.get(userId) || {};
          if (evalScore === 2) stats.badStreak = (stats.badStreak || 0) + 1;
          else if (evalScore === 0) stats.badStreak = 0; 
          else stats.badStreak = Math.max(0, (stats.badStreak || 0) - 1);
          this.userStats.set(userId, stats);

          if (this.internalState.stress >= 9.0 && evalScore === 2) {
             // Fallback ignore logic
          }

          this.dialogContext.push({ role: "assistant", content: reply });
          
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

          // Update Bot Reply Time
          this.lastBotReplyTime = Date.now();

          if (cfgBool("是否打印日志")) {
              console.log(`[DEBUG] Gen Complete. IsAmbient:${isAmbient}`);
          }

          // [Rule] Ambient replies do NOT @ user
          this.sendReply(ctx, msg, reply, isAmbient);
      } catch (e) {
          console.error("[Gemini Plugin Error]", e);
      }
    }

    sendReply(ctx, msg, text, noAt = false) {
        if (!text) return;
        const ENABLE = cfgBool("启用引用回复和@用户");
        const qq = msg?.sender?.userId?.split(":")[1] ?? "";
        const targetId = getReplyTargetId(msg);
        let out = text;
        
        // If ambient, disable @ and reply citation to be less intrusive
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
    if (!text) return;
    const clearWord = cfgStr("清除上下文触发词");
    if (clearWord && text === clearWord) {
      clearAI(ctx);
      seal.replyToSender(ctx, msg, cfgStr("清除上下文完成"));
      return;
    }
    const ai = getAI(ctx);
    const hitAt = isAtMe(ctx, msg);
    const hitReply = isReplyMessage(msg);
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
    if (!hitKeyword && !hitAt && !hitReply) {
      const cleanedText = text.replace(/\[CQ:.*?\]/g, "").trim();
      const ambientOptions = { source: 'ambient' };

      if (ai.evaluateAmbient(msg, cleanedText, ambientOptions)) {
          ai.pushEnvMessage(msg);

          ai.ambientPending = true;

          // 把消息送进合并池，但不立即生成
          ai.receiveUserMessage(ctx, msg, cleanedText, ambientOptions);

          // 重置 Ambient 等待计时
          if (ai.ambientWaitTimer) clearTimeout(ai.ambientWaitTimer);

          const waitMs = cfgInt("Ambient接话等待窗口(ms)", 5000);
          ai.ambientWaitTimer = setTimeout(() => {
              // 只有在这 5 秒内没人再说话，才真正生成
              if (ai.ambientPending) {
                  ai.executeGeneration();
                  ai.ambientPending = false;
              }
          }, waitMs);

      }else {
          ai.pushEnvMessage(msg);
      }
      return;
    }

    if (text.startsWith('.') || text.startsWith('。')) return; 
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
    handleAIReply(ctx, msg, finalText);
  };
})();