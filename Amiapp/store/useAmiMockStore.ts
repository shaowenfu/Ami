import { create } from 'zustand';

export type ChatMode = 'agent' | 'group';
export type MessageRole = 'me' | 'partner' | 'agent';
export type ToolId = 'anniversary' | 'wishlist' | 'mood' | 'date' | 'repair' | 'timeline';
export type MomentType = 'all' | 'date' | 'memory' | 'repair' | 'wish';
export type AssetKey = 'ami' | 'couple' | 'memory' | 'calendar';

export type ChatMessage = {
  id: string;
  role: MessageRole;
  sender: string;
  content: string;
  createdAt: string;
  reactionCount: number;
  reacted: boolean;
};

export type ToolFeature = {
  id: ToolId;
  title: string;
  subtitle: string;
  detail: string;
  stat: string;
  tone: 'lavender' | 'rose' | 'apricot' | 'celadon' | 'sky' | 'butter';
  asset: AssetKey;
};

export type WishItem = {
  id: string;
  title: string;
  done: boolean;
  owner: '我' | '泽明' | 'Ami';
};

export type MoodEntry = {
  id: string;
  label: string;
  value: string;
  color: string;
};

export type Anniversary = {
  id: string;
  title: string;
  date: string;
  daysLeft: number;
};

export type RelationshipMoment = {
  id: string;
  type: Exclude<MomentType, 'all'>;
  day: string;
  title: string;
  detail: string;
  saved: boolean;
};

export type ProfileSetting = {
  id: 'notifications' | 'privacy' | 'gentleNudge';
  title: string;
  subtitle: string;
  enabled: boolean;
};

type DatePlan = {
  title: string;
  subtitle: string;
  items: string[];
  accepted: boolean;
};

type AmiMockStore = {
  chatMode: ChatMode;
  messages: ChatMessage[];
  isTyping: boolean;
  quickReplies: string[];
  tools: ToolFeature[];
  selectedToolId: ToolId | null;
  wishes: WishItem[];
  moods: MoodEntry[];
  todayMoodId: string;
  anniversaries: Anniversary[];
  datePlan: DatePlan;
  moments: RelationshipMoment[];
  momentFilter: MomentType;
  profileSettings: ProfileSetting[];
  repairCount: number;
  setChatMode: (mode: ChatMode) => void;
  sendMessage: (content: string) => void;
  toggleReaction: (id: string) => void;
  openTool: (id: ToolId) => void;
  closeTool: () => void;
  addWish: (title: string) => void;
  toggleWish: (id: string) => void;
  setTodayMood: (id: string) => void;
  acceptDatePlan: () => void;
  saveConflictReflection: () => void;
  setMomentFilter: (type: MomentType) => void;
  toggleMomentSaved: (id: string) => void;
  toggleProfileSetting: (id: ProfileSetting['id']) => void;
};

const nowLabel = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const nextId = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;

const agentReplies = [
  '我先把你们刚刚提到的偏好收起来：安静、能聊天、有一点仪式感。要不要让我生成一个更轻松的周末方案？',
  '收到。我会把这条放进你们的关系时间线里，也给泽明一个温柔提醒。',
  '这句话很重要，我建议先不急着解决，先确认彼此都被听见了。',
];

const initialMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'me',
    sender: '小鹿',
    content: '最近我们都太忙了，想找一个不用赶时间、可以慢慢说话的周末。',
    createdAt: '09:18',
    reactionCount: 1,
    reacted: true,
  },
  {
    id: 'm2',
    role: 'partner',
    sender: '泽明',
    content: '我也想。可以看展，然后找一家安静的小店，把这周没说完的话补上。',
    createdAt: '09:22',
    reactionCount: 1,
    reacted: false,
  },
  {
    id: 'm3',
    role: 'agent',
    sender: 'Ami',
    content: '我为你们整理了一份“重新靠近”的约会计划。节奏会慢一点，重点放在共同体验和深聊。',
    createdAt: '09:24',
    reactionCount: 2,
    reacted: false,
  },
];

const initialTools: ToolFeature[] = [
  {
    id: 'anniversary',
    title: '纪念日',
    subtitle: '不漏掉重要时刻',
    detail: '记录相识、告白、第一次旅行，以及你们想认真庆祝的每个节点。',
    stat: '下一个还有 18 天',
    tone: 'lavender',
    asset: 'calendar',
  },
  {
    id: 'wishlist',
    title: '愿望清单',
    subtitle: '把“以后”变成计划',
    detail: '一起收集想去的地方、想做的事，Ami 会帮你们找到合适的时间窗口。',
    stat: '4 个进行中',
    tone: 'celadon',
    asset: 'memory',
  },
  {
    id: 'mood',
    title: '情绪记录',
    subtitle: '温柔地看见彼此',
    detail: '用低负担方式记录今天的心情，让关心发生得更及时。',
    stat: '今日已同步',
    tone: 'apricot',
    asset: 'ami',
  },
  {
    id: 'date',
    title: '约会计划',
    subtitle: '生成有质感的安排',
    detail: '结合预算、时间、关系状态和共同偏好，生成可执行的约会路线。',
    stat: '1 个待确认',
    tone: 'sky',
    asset: 'calendar',
  },
  {
    id: 'repair',
    title: '冲突复盘',
    subtitle: '从争执回到理解',
    detail: '把情绪、事实、需要分开，沉淀下一次更好的沟通方式。',
    stat: '本周 1 次',
    tone: 'rose',
    asset: 'couple',
  },
  {
    id: 'timeline',
    title: '关系时间线',
    subtitle: '保存共同成长轨迹',
    detail: '把照片、对话、愿望和复盘串成一条有温度的关系记录。',
    stat: '128 个瞬间',
    tone: 'butter',
    asset: 'memory',
  },
];

export const useAmiMockStore = create<AmiMockStore>((set, get) => ({
  chatMode: 'group',
  messages: initialMessages,
  isTyping: false,
  quickReplies: ['生成周末约会', '记录成共同愿望', '帮我温柔表达'],
  tools: initialTools,
  selectedToolId: null,
  wishes: [
    { id: 'w1', title: '春天去海边住两晚', done: false, owner: '我' },
    { id: 'w2', title: '一起做一本年度相册', done: true, owner: '泽明' },
    { id: 'w3', title: '每月一次无手机晚餐', done: false, owner: 'Ami' },
  ],
  moods: [
    { id: 'soft', label: '被接住', value: '今天适合慢慢说', color: '#EEC9D3' },
    { id: 'bright', label: '轻快', value: '想一起做点新鲜事', color: '#F7D7B7' },
    { id: 'quiet', label: '安静', value: '需要一点空间', color: '#D8ECF8' },
    { id: 'close', label: '靠近', value: '想要更多拥抱', color: '#D7EFE8' },
  ],
  todayMoodId: 'soft',
  anniversaries: [
    { id: 'a1', title: '在一起 600 天', date: '2026.06.06', daysLeft: 18 },
    { id: 'a2', title: '第一次旅行纪念', date: '2026.07.21', daysLeft: 63 },
  ],
  datePlan: {
    title: '重新靠近的周末下午',
    subtitle: '看展、散步、晚餐前留一段只属于你们的深聊。',
    items: ['14:00 艺术展', '16:10 河边散步', '17:20 咖啡与关系问题卡', '19:00 安静晚餐'],
    accepted: false,
  },
  moments: [
    {
      id: 'mo1',
      type: 'date',
      day: '今天',
      title: 'Ami 生成了约会计划',
      detail: '路线降低了奔波感，保留一段可以认真聊天的空白时间。',
      saved: true,
    },
    {
      id: 'mo2',
      type: 'wish',
      day: '昨天',
      title: '新增共同愿望',
      detail: '“每月一次无手机晚餐”被加入愿望清单，泽明认领了第一顿。',
      saved: false,
    },
    {
      id: 'mo3',
      type: 'repair',
      day: '3 天前',
      title: '完成一次冲突复盘',
      detail: '你们约定争执升温时先暂停十分钟，再回到事实和需要。',
      saved: true,
    },
    {
      id: 'mo4',
      type: 'memory',
      day: '本周',
      title: '收藏了一张散步照片',
      detail: 'Ami 标记为“平凡但安心”的关系瞬间。',
      saved: false,
    },
  ],
  momentFilter: 'all',
  profileSettings: [
    { id: 'notifications', title: '通知中心', subtitle: '重要提醒不打扰地送达', enabled: true },
    { id: 'privacy', title: '隐私守护', subtitle: '只在你允许时同步敏感内容', enabled: true },
    { id: 'gentleNudge', title: '温柔提醒', subtitle: '关系低电量时轻轻提醒', enabled: false },
  ],
  repairCount: 1,
  setChatMode: (mode) => set({ chatMode: mode }),
  sendMessage: (content) => {
    const text = content.trim();
    if (!text) return;
    const reply = agentReplies[get().messages.length % agentReplies.length];
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: nextId('m'),
          role: 'me',
          sender: '小鹿',
          content: text,
          createdAt: nowLabel(),
          reactionCount: 0,
          reacted: false,
        },
      ],
      isTyping: true,
    }));
    setTimeout(() => {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: nextId('m'),
            role: 'agent',
            sender: 'Ami',
            content: reply,
            createdAt: nowLabel(),
            reactionCount: 0,
            reacted: false,
          },
        ],
        isTyping: false,
      }));
    }, 720);
  },
  toggleReaction: (id) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id
          ? {
              ...message,
              reacted: !message.reacted,
              reactionCount: Math.max(0, message.reactionCount + (message.reacted ? -1 : 1)),
            }
          : message,
      ),
    })),
  openTool: (id) => set({ selectedToolId: id }),
  closeTool: () => set({ selectedToolId: null }),
  addWish: (title) => {
    const text = title.trim();
    if (!text) return;
    set((state) => ({
      wishes: [{ id: nextId('w'), title: text, done: false, owner: '我' }, ...state.wishes],
      moments: [
        {
          id: nextId('mo'),
          type: 'wish',
          day: '刚刚',
          title: '新增共同愿望',
          detail: text,
          saved: false,
        },
        ...state.moments,
      ],
    }));
  },
  toggleWish: (id) =>
    set((state) => ({
      wishes: state.wishes.map((wish) => (wish.id === id ? { ...wish, done: !wish.done } : wish)),
    })),
  setTodayMood: (id) => set({ todayMoodId: id }),
  acceptDatePlan: () =>
    set((state) => ({
      datePlan: { ...state.datePlan, accepted: true },
      moments: [
        {
          id: nextId('mo'),
          type: 'date',
          day: '刚刚',
          title: '确认了一份约会计划',
          detail: state.datePlan.title,
          saved: true,
        },
        ...state.moments,
      ],
    })),
  saveConflictReflection: () =>
    set((state) => ({
      repairCount: state.repairCount + 1,
      moments: [
        {
          id: nextId('mo'),
          type: 'repair',
          day: '刚刚',
          title: '保存了一次冲突复盘',
          detail: '你们记录了触发点、真实需要和下次沟通约定。',
          saved: true,
        },
        ...state.moments,
      ],
    })),
  setMomentFilter: (type) => set({ momentFilter: type }),
  toggleMomentSaved: (id) =>
    set((state) => ({
      moments: state.moments.map((moment) => (moment.id === id ? { ...moment, saved: !moment.saved } : moment)),
    })),
  toggleProfileSetting: (id) =>
    set((state) => ({
      profileSettings: state.profileSettings.map((setting) =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting,
      ),
    })),
}));
