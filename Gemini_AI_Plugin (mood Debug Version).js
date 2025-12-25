// ==UserScript==
// @name         Gemini AI Plugin（Proxy RP Enhanced V3）
// @description  OpenAI-compatible 反代专用 + 双轨记忆系统/多词触发概率/时间感知/特殊身份映射 + 动态状态机 + 好感度系统 + 主观压力判定
// @version      1.9.18-behavior-update
// @author       cz
// @license      MIT
// ==/UserScript==

(function () {
  const EXT_NAME = 'GeminiAI';
  if (seal.ext.find(EXT_NAME)) {
    seal.ext.unregister(seal.ext.find(EXT_NAME));
  }

  const ext = seal.ext.new(EXT_NAME, 'cz', '1.9.18-behavior-update');
  const NO_REPLY = "__NO_REPLY__";
  ext.enabled = true;
  seal.ext.register(ext);

  /* ================= 配置项 ================= */
  seal.ext.registerStringConfig(ext, "API代理地址", "https://xxxx.dev");
  seal.ext.registerStringConfig(ext, "API Keys", "sk-xxxxxxxxxxxxxxxxxxxxxxxx");
  seal.ext.registerStringConfig(ext, "模型名称", "gemini-2.5-flash");

  // [Fix] 改为 IntConfig，并重命名键以避免旧版本String类型残留导致的Panic
  seal.ext.registerIntConfig(ext, "最大回复Tokens", 1024);
  seal.ext.registerIntConfig(ext, "最大回复字符数(防抽风)", 800);

  // ===== 记忆与上下文配置 =====
  seal.ext.registerIntConfig(ext, "对话上下文限制(轮)", 6); // 12条记录
  seal.ext.registerIntConfig(ext, "环境/普通群聊记忆限制(条)", 12); // 记住最近12条群里发生的事

  // ===== RP 核心配置 (已按需求改名) =====
  seal.ext.registerStringConfig(ext, "角色设定(语气风格)", "请完全沉浸在角色中，不要表现出你是AI。使用口语化的表达，可以使用*动作描写*或(心理活动)来增强表现力。如果用户没有直接提问，可以根据环境进行吐槽或闲聊。");
  seal.ext.registerStringConfig(ext, "预设背景(人设与故事)", "飞蛾是一个沉稳、冷淡但礼貌的监管者。");
  seal.ext.registerStringConfig(ext, "额外指令(可选)", ""); // 原来的“回复风格指导”如果被架空，可作为备用补充

  seal.ext.registerBoolConfig(ext, "启用时间感知", true);

  // ===== 触发配置 =====
  seal.ext.registerStringConfig(ext, "非指令关键词(词:概率;词:概率)", "监管者:100;飞蛾:30"); 
  // 格式说明：用分号分隔不同词，用冒号分隔词和概率(0-100)。例如：飞蛾:100;蛾:20

  seal.ext.registerStringConfig(ext, "bot名字", "飞蛾");

  // ===== 身份映射配置 (扩充至6个) =====
  seal.ext.registerStringConfig(ext, "默认user_info", "探窟家");
  
  seal.ext.registerStringConfig(ext, "特殊用户ID配置1", "QQ:1004205930");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name1", "飞蛾的骰主|0");
  
  seal.ext.registerStringConfig(ext, "特殊用户ID配置2", "QQ:1655009569");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name2", "飞蛾的同事|1");
  
  seal.ext.registerStringConfig(ext, "特殊用户ID配置3", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name3", "[空]");

  seal.ext.registerStringConfig(ext, "特殊用户ID配置4", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name4", "[空]");

  seal.ext.registerStringConfig(ext, "特殊用户ID配置5", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name5", "[空]");

  seal.ext.registerStringConfig(ext, "特殊用户ID配置6", "[空]");
  seal.ext.registerStringConfig(ext, "特殊user_info和user_name6", "[空]");

  seal.ext.registerBoolConfig(ext, "是否打印日志", false);
  seal.ext.registerBoolConfig(ext, "启用引用回复和@用户", true);

  seal.ext.registerStringConfig(ext, "清除上下文触发词", "清除上下文");
  seal.ext.registerStringConfig(ext, "清除上下文完成", "上下文已清除");
  seal.ext.registerStringConfig(ext, "清除上下文时无上下文", "没有可清除的上下文");

  /* ================= 工具函数 ================= */
  function cfgStr(k) { return String(seal.ext.getStringConfig(ext, k) ?? "").trim(); }
  function cfgBool(k) { return !!seal.ext.getBoolConfig(ext, k); }
  
  // [Fix] 严格只使用 getIntConfig，避免读取 StringConfig 导致 Panic
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

  // 获取当前短时间 HH:mm:ss
  function getTimeStr() {
    return new Date().toLocaleString('zh-CN', { hour12: false }).split(' ')[1];
  }

  // 解析关键词配置 "A:100; B:50" -> [{word:'A', prob:100}, {word:'B', prob:50}]
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
      return msg.elements.some(e =>
        e && (e.type === "reply" || e.type === "Reply") && (e.id || e.messageId)
      );
    }
    return !!(msg?.replyId || msg?.quoteId || msg?.source?.id);
  }

  function isReplyToMe(ctx, msg) {
    if (!isReplyMessage(msg)) return false;

    const targetId = getReplyTargetId(msg);
    if (!targetId) return false;

    // seal.self?.id 在多数版本可用，兜底 endPoint
    const selfId = String(seal.self?.id ?? ctx.endPoint?.userId ?? "").replace(/\D/g, "");
    if (!selfId) return false;

    // msg.source / elements 里通常会带原消息发送者
    if (Array.isArray(msg?.elements)) {
      const replyElem = msg.elements.find(e => e.type === "reply" || e.type === "Reply");
      if (replyElem?.senderId) {
        return String(replyElem.senderId).replace(/\D/g, "") === selfId;
      }
    }

    // 保守兜底：无法确认来源时，不当成硬触发
    return false;
  }

  function getReplyTargetId(msg) {
    const m = String(msg?.message ?? "").match(/\[CQ:reply,id=(\d+)\]/);
    if (m && m[1]) return String(m[1]);
    if (Array.isArray(msg?.elements)) {
      const r = msg.elements.find(e => e && (e.type === "reply" || e.type === "Reply"));
      if (r) return String(r.id ?? r.messageId);
    }
    return msg?.replyId || "";

  }

  function buildSpecialUsers() {
    const items = [];
    // 扩充至6个
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
    // 自动检测机器人的QQ号比较困难，这里保留原有的硬编码或需用户配置
    // 如果需要动态获取，seal.self.id 通常可用，但这里暂时用CQ码判断
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

  /* ================= 好感度管理 (Safe Storage) ================= */
  // 尝试使用持久化存储，若失败则回退到内存
  let favorabilityStore = {};

  // 安全检测 storage 是否可用
  if (ext.storage && typeof ext.storage === "object") {
      try {
          // 尝试只读访问，不写测试字段
          favorabilityStore = ext.storage;
      } catch (e) {
          console.warn("[Gemini] Storage unavailable, using memory store.");
          favorabilityStore = {};
      }
  } else {
      console.warn("[Gemini] No persistent storage provided by host, using memory store.");
      favorabilityStore = {};
  }


  // 获取带时间衰减的好感度
  function getFavorability(userId) {
    const uid = onlyDigits(userId);
    if (!uid) return 0;
    
    // 数据结构迁移：旧版(number) -> 新版({val, ts})
    if (!favorabilityStore.favData) favorabilityStore.favData = {};
    
    let entry = favorabilityStore.favData[uid];
    if (typeof entry === 'number') {
        entry = { val: entry, ts: Date.now() };
        favorabilityStore.favData[uid] = entry;
    }
    if (!entry) {
        entry = { val: 50, ts: Date.now() };
        favorabilityStore.favData[uid] = entry;
    }

    // [Update] 24小时自然回归逻辑 (Regression to 50)
    const now = Date.now();
    const hoursPassed = (now - entry.ts) / (1000 * 60 * 60);
    
    if (hoursPassed >= 24) {
        const cycles = Math.floor(hoursPassed / 24);
        const changeRate = 5; // [Rule] +/- 5 per 24h
        const totalChange = cycles * changeRate;
        
        let newVal = entry.val;
        if (entry.val > 50) {
             // 回落
            newVal = Math.max(50, entry.val - totalChange);
        } else if (entry.val < 50) {
             // 回升
            newVal = Math.min(50, entry.val + totalChange);
        }
        
        if (newVal !== entry.val) {
            entry.val = newVal;
            entry.ts = entry.ts + (cycles * 24 * 60 * 60 * 1000); 
            debugLog(`[Favorability] Time Regression for ${uid}: ${entry.val} -> ${newVal}`);
            favorabilityStore.favData[uid] = entry;
        }
    }
    
    return entry.val;
  }

  // [Fix] 优化好感度语义：增加敌对区间 <= -10
  function getFavorabilityDesc(val) {
      if (val <= -10) return "敌对"; // Hostile (允许攻击/拒绝)
      if (val <= 20) return "冷淡";  // Cold/Reserved (修复缓冲区，禁止否定价值)
      if (val <= 40) return "疏离";  // Alienated
      if (val <= 60) return "中立";  // Neutral
      if (val <= 80) return "友善";  // Friendly
      if (val < 100) return "信赖";
      return "挚爱";
  }

  // [Fix] 优化好感度调整逻辑：梯度惩罚 + 修复缓冲区保护
  function adjustFavorability(userId, stress, evalScore, badStreak, severity) {
    const uid = onlyDigits(userId);
    if (!uid) return;

    let current = getFavorability(uid);
    let change = 0;
    
    // 判定是否处于【关系修复缓冲区】 (Cold Zone: > -10 and <= 20)
    // 在此区间，鼓励修复，减少打击
    const isRepairZone = current > -10 && current <= 20;

    // 逻辑：讨好很难，翻脸很快，但给调戏留窗口
    if (evalScore === 0) {
        // 有意义/友善 (0)
        // [Rule] 增加好感度的涨幅，低压友善变成+4 (3~5)
        if (stress <= 5) change = 2;
        else if (stress <= 8) change = 1; // +2
        else change = 0;
    } else if (evalScore === 1) {
        change = 0;
        // 极度烦躁时，普通话语也降好感
        if (stress > 9.0) change = -1;
    } else if (evalScore === 2) {
        // 垃圾/恶意 (2) -> 梯度惩罚机制
        const sev = severity || 1; // 默认为轻微

        if (sev === 3) {
            change = -10; // 敌对/暴力/威胁 -> 单次重罚 (无视Repair Zone)
        } else if (sev === 2) {
            change = -5; // 羞辱/恶毒嘲讽 -> 单次中罚 (无视Repair Zone)
        } else {
            // sev === 1 (调戏/刷屏/轻微冒犯)
            if (isRepairZone) {
                // [Rule] 在修复区间，轻微冒犯不扣分，只增加 badStreak
                change = 0; 
            } else {
                // 正常区间：累计多次才触发
                if (badStreak < 3) {
                    change = 0; // 容忍期
                } else {
                    change = -2; // 触发惩罚
                }
            }
        }

        // [Rule] Overloaded 额外惩罚逻辑
        // 如果处于修复缓冲区(0~20)，豁免 Stress 带来的额外打击，防止死循环
        if (stress >= 8.5) {
            if (!isRepairZone) {
                 change -= 5; 
            }
        }
    }

    // 限制范围 -100 ~ 10 (扩展负分支持)
    let newValue = Math.min(100, Math.max(-10, current + change));
    
    // 更新
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
    
    // ===== 隐藏任务指令 =====
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
      const timeStr = now.toLocaleString('zh-CN', { hour12: false });
      prompt += `\n\n【现实时间】\n${timeStr}。对话中若涉及时间，请以此为准。`;
    }

    return prompt;
  }

  function truncateReply(s) {
    const maxChars = cfgInt("最大回复字符数(防抽风)", 800);
    const text = String(s ?? "");
    return text.length <= maxChars ? text : text.slice(0, maxChars) + `...`;
  }

  /* ================= AI 类（Stateful Agent） ================= */
  class ProxyAI {
    constructor() {
      this.dialogContext = []; 
      this.envContext = [];
      this.lastRequestTime = 0;
      this.staticSystemPrompt = makeSystemPrompt();

      // 追踪用户行为 { userId: { lastTime: number, burstCount: number, badStreak: number } }
      this.userStats = new Map();
      this.lastActiveUserId = null;

      // ===== 内部状态机 =====
      // Stress (压力值): 0-10
      this.internalState = {
        stress: 0,
        moodState: 'calm',
        recentEvals: [],
        lastStressRiseTime: Date.now(), 
        lastDecayCheckTime: Date.now()  
      };
    }

    /**
     * 更新情绪状态机（滞后阈值逻辑）
     * 避免状态频繁跳变
     */
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

    /**
     * 第一阶段：冷却检查与频率检测
     * 改为“离散式冷却”：只有连续安静1分钟以上才开始恢复
     */
    preCheckStress(userId) {
      const now = Date.now();
      
      // 1. 冷却恢复逻辑 (Discrete Cooldown)
      // 如果距离上次压力上升超过 60秒
      if (now - this.internalState.lastStressRiseTime > 60000) {
          // 检查距离上次结算过去了多久
          const timeSinceCheck = now - this.internalState.lastDecayCheckTime;
          if (timeSinceCheck > 60000) {
              const minutes = Math.floor(timeSinceCheck / 60000);
              const decay = minutes * 1.0; // 每分钟恢复1点
              
              if (decay > 0) {
                  this.internalState.stress = Math.max(0, this.internalState.stress - decay);
                  this.internalState.lastDecayCheckTime += minutes * 60000; // 推进结算时间
                  this.updateMoodState();
                  debugLog(`[Stress Cooldown] Quiet for ${minutes} min -> Stress -${decay}`);
              }
          }
      } else {
          // 还在冷却期内，同步结算时间，防止跳变
          this.internalState.lastDecayCheckTime = now;
      }

      if (!userId) return 0; // 环境消息

      // 2. 换人安抚判定 (User Switching)
      if (this.lastActiveUserId && this.lastActiveUserId !== userId) {
          // 换人能稍微缓解之前的压力
          this.internalState.stress = Math.max(0, this.internalState.stress - 1.0);
      }
      this.lastActiveUserId = userId;

      // 3. 频率追踪
      if (!this.userStats.has(userId)) {
        this.userStats.set(userId, { lastTime: 0, burstCount: 0, badStreak: 0 });
      }
      const stats = this.userStats.get(userId);
      const timeSinceLastChat = now - stats.lastTime;
      
      // 8秒内连续发言视为 Burst
      if (timeSinceLastChat < 8000) {
          stats.burstCount++;
      } else {
          stats.burstCount = 0;
      }
      stats.lastTime = now;

      return stats.burstCount;
    }

    /**
     * 第二阶段：综合压力结算
     */
    commitStress(rawEvalScore, burstCount, userId) {
        // 1. 历史平滑
        this.internalState.recentEvals.push(rawEvalScore);
        if (this.internalState.recentEvals.length > 3) this.internalState.recentEvals.shift();

        const sum = this.internalState.recentEvals.reduce((a, b) => a + b, 0);
        const avgScore = sum / this.internalState.recentEvals.length;

        let delta = 0;

        // 2. 基础压力变化
        if (avgScore <= 0.5) {
            delta = -0.5; // 表现良好 -> 降压
        } else if (avgScore >= 1.5) {
            delta = 1.5; // 垃圾信息 -> 升压
        } else {
            delta = 0.2; // 中性 -> 轻微升压
        }

        // 3. 频率修正
        if (burstCount >= 3) {
            if (avgScore <= 0.5) {
                delta = 0.2; 
            } else {
                delta += 1.0;
            }
        } else {
            if (avgScore <= 0.5) delta -= 0.2; 
        }

        // 4. 好感度修正
        if (userId) {
            const fav = getFavorability(userId);
            if (rawEvalScore === 1 && fav > 60) delta -= 0.1;
            if (rawEvalScore === 2 && fav < 40) delta += 0.2;
        }

        // 应用变化
        const prev = this.internalState.stress;
        this.internalState.stress = Math.min(10, Math.max(0, prev + delta));
        
        // [New] 如果压力上升了，重置冷却计时器
        if (this.internalState.stress > prev) {
            this.internalState.lastStressRiseTime = Date.now();
            this.internalState.lastDecayCheckTime = Date.now();
        }

        this.updateMoodState();
        // debugLog 交给 generate 统一打印
    }

    getDynamicParams() {
      this.updateMoodState();
      
      const state = this.internalState.moodState;
      let moodInstruction = "";
      let temp = 1.0;
      let maxTokens = cfgInt("最大回复Tokens", 1024);

      if (state === 'calm') {
        moodInstruction = "(当前状态：平静、耐心。你可以展开聊聊，或者开个玩笑)";
        temp = 1.0; 
      } else if (state === 'strained') {
        moodInstruction = "(当前状态：有些被环境噪音打扰。回复请简洁明了，不要长篇大论)";
        temp = 1.0;
        // [Fix] Increase from 256 to 512 to avoid frequent cutoffs
        maxTokens = 1024; 
      } else { // overloaded
        temp = 0.9; 
        maxTokens = 1024; 

        const recentEvals = this.internalState.recentEvals || [];
        const isProvoked = recentEvals.some(e => e === 2);
        
        let trendHint = "";
        if (isProvoked) {
            trendHint = "近期连续受到干扰/垃圾信息刺激，你的怒气值正在飙升。";
        } else {
            trendHint = "长期处于高压状态，你感到精神透支、麻木且疲惫。";
        }

        moodInstruction = `(当前状态：情绪过载/崩溃边缘。${trendHint}
你的行为模式是不可预测的，请根据语境从以下反应中自主选择：
1. 极度不耐烦的短句打发（如“啧”、“烦人”、“闭嘴”）。
2. 彻底的冷处理，不以语言回复，只输出动作。
3. 突然的情绪宣泄（如果对方继续纠缠，可以进行态度恶劣的反驳、抱怨，允许较长的回复）。
请不要总是选择同一种反应，像真人一样表现出情绪的失控与波动。)`;
      }

      return { moodInstruction, temp, maxTokens };
    }
    
    getMoodDescription() {
        const state = this.internalState.moodState;
        const stress = this.internalState.stress.toFixed(1);
        
        let desc = "平静";
        if (state === 'strained') desc = "紧绷";
        if (state === 'overloaded') desc = "过载";
        
        return `${state.toUpperCase()} (${desc}) / Stress: ${stress}`;
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
      while (this.envContext.length > maxEnv) {
        this.envContext.shift();
      }
    }

    async generate(text, ctx, msg) {
      const userId = msg?.sender?.userId ?? "";
      
      const prevFav = getFavorability(userId); // Read before modification
      const prevStress = this.internalState.stress;

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

      const { moodInstruction, temp, maxTokens } = this.getDynamicParams();

      let systemPrompt = this.staticSystemPrompt;

      // [New] 动态注入好感度行为指导 (Repair Zone Logic)
      if (currentFav > -10 && currentFav <= 20) {
          systemPrompt += `\n\n【针对该用户的特殊行为指令】\n当前好感度处于[冷淡/保留]区间（考察期）。\n规则：1. 表现需冷淡、审视、保持距离。\n2. **绝对禁止**使用否定其存在价值的话术（如“你的话没意义”、“不值得回应”）。\n3. 允许用户通过解释或道歉修复关系。`;
      } else if (currentFav <= -10) {
          systemPrompt += `\n\n【针对该用户的特殊行为指令】\n当前好感度处于[敌对]区间。你可以拒绝回应，表达对他的厌恶，甚至表现出攻击性。`;
      }

      systemPrompt += `\n\n【当前AI心理状态与行动指南】\n${moodInstruction}`;

      if (this.envContext.length > 0) {
        systemPrompt += `\n\n【近期环境/群聊消息记录】\n(背景噪音/旁听)\n${this.envContext.join("\n")}`;
      }

      const messages = [
        { role: "system", content: systemPrompt },
        ...this.dialogContext
      ];

      const nowRequest = Date.now();
      if (nowRequest - this.lastRequestTime < 1500) return NO_REPLY;
      this.lastRequestTime = nowRequest;

      const proxy = stripTrailingSlash(cfgStr("API代理地址"));
      const apiKey = cfgStr("API Keys");
      const model = cfgStr("模型名称");

      try {
          const res = await fetch(`${proxy}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              messages,
              max_tokens: maxTokens, 
              temperature: temp      
            })
          });

          if (!res.ok) {
            const t = await res.text();
            throw new Error(`HTTP ${res.status}: ${t}`);
          }

          const data = await res.json();
          let reply = data?.choices?.[0]?.message?.content;
          if (!reply) return NO_REPLY;

          let evalScore = 1; 
          let severity = 1; // Default
          
          // [Fix] 支持解析 severity: <!--stress_eval:2;sev:3-->
          const evalMatch = reply.match(/<!--stress_eval:(\d)(?:;sev:(\d))?-->/);
          if (evalMatch) {
              evalScore = parseInt(evalMatch[1], 10);
              if (evalMatch[2]) {
                  severity = parseInt(evalMatch[2], 10);
              }
          }

          // [Fix] Robust cleanup for all tags
          reply = reply.replace(/<!--stress_eval:.*?-->/g, "")
                       .replace(/<!--stress_eval:?.*$/, "") 
                       .replace(/<!--stress.*$/, "")       
                       .trim();

          reply = String(reply).replace(/^.*?(:|：)\s*/, "");
          reply = truncateReply(reply);

          // [New] Update Bad Streak Logic with Offset
          let stats = this.userStats.get(userId) || { lastTime: 0, burstCount: 0, badStreak: 0 };
          if (evalScore === 2) {
              stats.badStreak = (stats.badStreak || 0) + 1;
          } else if (evalScore === 0) {
              stats.badStreak = 0; // Friendly fully resets streak
          } else {
              // Eval 1: Neutral reduces streak partially (offset)
              stats.badStreak = Math.max(0, (stats.badStreak || 0) - 1);
          }
          this.userStats.set(userId, stats);

          // High Stress Selective Ignore
          if (this.internalState.stress >= 8.0 && evalScore === 2) {
              debugLog("Selective Ignore Triggered: High Stress + Spam");
              this.dialogContext.pop();
              
              const logEntry = `[${time}] ${userName}<${userInfo}>: ${text}`;
              this.envContext.push(logEntry);
              const maxEnv = cfgInt("环境/普通群聊记忆限制(条)", 12);
              while (this.envContext.length > maxEnv) {
                this.envContext.shift();
              }

              this.commitStress(evalScore, burstCount, userId);
              adjustFavorability(userId, this.internalState.stress, evalScore, stats.badStreak, severity);

              return NO_REPLY;
          }

          this.dialogContext.push({ role: "assistant", content: reply });
          
          // [Fix] Context Confusion: 
          // 仅将用户消息推入环境日志，**禁止**将 AI 自身的回复推入 envContext
          // 这样 envContext 永远只包含“外部声音”，消除身份错乱。
          this.envContext.push(userContent); 

          this.commitStress(evalScore, burstCount, userId);
          adjustFavorability(userId, this.internalState.stress, evalScore, stats.badStreak, severity);

          const maxEnv = cfgInt("环境/普通群聊记忆限制(条)", 12);
          while (this.envContext.length > maxEnv) {
            this.envContext.shift();
          }

          // [New] Structured Debug Log
          if (cfgBool("是否打印日志")) {
              const newFav = getFavorability(userId);
              const newStress = this.internalState.stress;
              const log = `
[DEBUG][AI Gen]
User: ${userName} (${userId})
EvalScore: ${evalScore} (Sev:${evalScore===2?severity:'-'})
Favorability: ${prevFav} -> ${newFav} (Change: ${newFav - prevFav})
Stress: ${prevStress.toFixed(2)} -> ${newStress.toFixed(2)} (Change: ${(newStress - prevStress).toFixed(2)})
Mood: ${this.internalState.moodState}
Burst: ${burstCount} | BadStreak: ${stats.badStreak}
`.trim();
              console.log(log);
          }

          return reply;
      } catch (e) {
          console.error("[Gemini Plugin Error]", e);
          return NO_REPLY;
      }
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
    if (ctxMap.has(key)) {
      ctxMap.delete(key);
      return true;
    }
    return false;
  }

  /* ================= 发送处理 ================= */
  async function handleAIReply(ctx, msg, text) {
    const ai = getAI(ctx);
    const reply = await ai.generate(text, ctx, msg);

    // 明确处理“沉默标记”
    if (!reply || reply === NO_REPLY) {
        return;
    }


    const ENABLE = cfgBool("启用引用回复和@用户");
    const qq = msg?.sender?.userId?.split(":")[1] ?? "";
    const targetId = getReplyTargetId(msg);

    let out = reply;
    if (ENABLE && targetId) {
      out = `[CQ:reply,id=${targetId}]${qq ? `[CQ:at,qq=${qq}] ` : ""}${reply}`;
    } else if (qq && ENABLE) {
      out = `[CQ:at,qq=${qq}] ${reply}`;
    }

    if (!out || typeof out !== "string" || out.trim() === "") {
        return;
    }

    seal.replyToSender(ctx, msg, out);

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
      await handleAIReply(ctx, msg, fullText);
      return seal.ext.newCmdExecuteResult(true);
    };
    return cmd;
  }

  ext.cmdMap['moth'] = makeAskCmd('moth');
  ext.cmdMap['chat'] = makeAskCmd('chat');

  // [New] Rename .state to .mood
  const cmdMood = seal.ext.newCmdItemInfo();
  cmdMood.name = 'mood';
  cmdMood.help = '查看AI当前状态和好感度\n用法：.mood';
  cmdMood.solve = async (ctx, msg) => {
    const ai = getAI(ctx);
    const moodDesc = ai.getMoodDescription();
    
    const userId = msg.sender.userId;
    const fav = getFavorability(userId); // 会触发时间衰减
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
    const hitReply = isReplyToMe(ctx, msg);
    
    // 解析多关键词配置
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

    // ===== 逻辑分支 =====

    // 1. 纯环境消息 (无触发) -> 仅记录
    if (!hitKeyword && !hitAt && !hitReply) {
      ai.pushEnvMessage(msg);
      return;
    }

    // 2. 指令拦截 (防止误触发骰子指令)
    if (text.startsWith('.') || text.startsWith('。')) {
      return; 
    }

    // 3. 关键词触发的概率判定
    // 只有在【非强交互】(非@/非回复) 时才判定概率
    if (hitKeyword && !hitAt && !hitReply) {
        const rand = Math.floor(Math.random() * 100);
        debugLog(`Keyword "${hitKeyword}" hit. Prob: ${hitProb}, Rolled: ${rand}`);
        
        if (rand >= hitProb) {
            // 概率未命中 -> 视为环境消息处理
            ai.pushEnvMessage(msg);
            return;
        }
    }

    // 4. 执行生成
    const cleanedText = text.replace(/\[CQ:.*?\]/g, "").trim();
    const finalText = cleanedText || text;

    await handleAIReply(ctx, msg, finalText);
  };
})();
