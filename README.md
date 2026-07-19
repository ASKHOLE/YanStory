# YanStory

AI 小说创作工作室。为职业网文作者打造的可解释、可控制、可协作的长篇叙事生产工具。

> 状态：早期原型 / 积极验证中  
> 架构：Node.js + TypeScript + pnpm monorepo  
> 核心形态：CLI REPL + 核心引擎 + Studio Web 工作台

---

## 1. 我们服务谁

**职业网文作者**——有日更压力、追求写作效率、愿意为了更强的控制力而学习新工具的人。

他们不想要一个“替我写一章”的黑箱，而想要一个**能记住全书状态、能解释每一行文本从哪来、能在失控前拦住自己的 AI 协作者**。

暂时不面向：
- 只想点一下按钮就出文的轻度爱好者；
- 需要多人实时协作的大型工作室（后期可能扩展，但不是 MVP 目标）。

---

## 2. 核心理念：实时制品模型（live-artifact model）

YanStory 与“生成下一章”式工具最大的区别，在于它把**书籍视为一个实时、可寻址、可编辑的领域实体**。

- **状态图（state graph）是真相来源**；
- **小说 Markdown 只是状态图的投影**；
- **作者和 Agent 通过类型化操作直接作用于书籍结构**。

换句话说：你不是在“让 AI 写文”，你是在“和 AI 一起编辑一本书”。

### 2.1 为什么用图？

长篇小说在长期创作中会迅速积累隐性复杂度：

- 人物动机是否前后一致？
- 伏笔是否按时回收？
- 战力/设定是否崩坏？
- 某个修改会波及哪些章节？

传统工具把这些问题交给作者的大脑和 Ctrl+F。YanStory 把它们显式建模为图：人物、事件、承诺、谎言、线索、情绪、时间线都是节点，因果、包含、知晓、欺骗都是边。

### 2.2 操作而非提示

作者通过**类型化操作**与引擎交互：

| 操作 | 作用 |
|---|---|
| `compose` | 根据意图与目标字数生成新章节/场景/段落 |
| `edit` | 对指定地址的文本做风格、语气、结构等修改 |
| `query` | 查询人物、线索、约束等结构化信息 |
| `patch` | 将 Markdown 修改反向同步回状态图 |
| `snapshot` | 保存状态图版本，支持回滚与分支 |

每个操作都留下日志，每个节点都可寻址，每一次生成都有上下文可审计。

---

## 3. 价值主张（按优先级）

### 3.1 可解释性 / 可控性（北极星）

作者必须能回答：

- 这段话是基于哪些设定生成的？
- 为什么 AI 这样写？
- 如果我把某个设定改掉，会影响哪些章节？
- 某个角色的行为是否符合他之前立的 flag？

对职业网文作者而言，最痛的失控场景集中在三点：

1. **人设/设定崩坏（OOC）**：AI 让角色做出不符合其性格、动机或世界观的行为。
2. **偏离大纲**：AI 自由发挥，偏离作者预设的情节方向。
3. **幻觉细节**：生成的大段文本中夹杂与前后文矛盾的细微设定。

可解释性是一切价值的基础。如果作者无法信任和控制 AI 的输出，多 Agent、约束、分支都失去意义。

### 3.2 可撤销 / 可分支 / 可合并

长篇创作是探索性过程。作者需要：

- 尝试不同剧情分支而不破坏主线；
- 回滚到之前的叙事版本；
- 把某个分支里成功的段落合并回主线。

YanStory 把 Git 式的版本思维引入小说创作。

### 3.3 多 Agent 协作

不同 Agent 在统一的图结构上工作，避免“各说各话”：

- 一个 Agent 负责铺陈世界观；
- 一个 Agent 负责推动主角情绪；
- 一个 Agent 负责检查伏笔回收；

它们共享同一本书的状态，而不是各自维护一份不兼容的上下文。

### 3.4 约束驱动创作

作者可以用声明式规则表达“这本书不能发生什么”：

- 主角在第三章前不能知道真相；
- 某个承诺必须在第十章前兑现；
- 反派不能在此阶段直接出场。

AI 生成前先检查约束，生成后再验证约束，把“事后修 bug”变成“事前防崩”。

约束输入采用**混合体验**：作者可用自然语言描述规则，系统解析为结构化规则；解析失败时给出反馈，作者可调整措辞或切换到轻量 DSL。

---

## 4. 产品形态

### 4.1 CLI REPL（脚本化与快速操作入口）

CLI 服务于脚本化、批量操作和快速验证。MVP 阶段先从**显式命令**开始：作者明确调用 `compose` / `edit` / `query` 等操作，AI 每次执行一个动作，保证可控。更高级的半自动循环与会话式 Agent 后续再扩展。

典型快速操作：

```js
yanstory> .create "仙逆之后" xuanhuan
yanstory> await book.compose({ intent: "introduce protagonist", targetWords: 1500 })
yanstory> await book.edit({ target: "chapter-0001/scene-1/paragraph-3", operation: "soften" })
yanstory> await book.query({ type: "characters" })
yanstory> await book.projection()
```

REPL 支持 `--stub` 模式，可在无网络环境下快速验证流程。

### 4.2 Studio Web 工作台（核心入口）

Studio 是作者日常创作的主要入口，默认采用 **IDE 式三栏布局**：左侧图/大纲导航、中间 Markdown 编辑器、右侧 AI/约束/检索面板。同时支持在不同任务视图间切换（写作模式、审阅模式、规划模式）。

左侧大纲视图不仅显示章节结构，还叠加情节进展、人物关系、状态图影响和后续发展可能路线。大纲编辑是交互式的：作者可以自己写完导入，也可以与 AI 对话后由 AI 整理生成；粒度支持书、卷、多章、单章多个层级。

#### Studio 最小可用闭环

1. 新建或打开一本书；
2. 在左侧大纲视图中查看/编辑结构（书 → 卷 → 多章 → 单章）；
3. 为单章生成结构化 scene plan，确认关键人物、事件、约束满足；
4. 点击 compose 将 scene plan 扩写成正文；
5. 在中间编辑器审阅，通过 patch 将文本修改回写状态图；
6. 在右侧调用 critique / reader 获取反馈；
7. 满意则保存；不满意则回滚到大纲和状态图的编辑节点重新调整。

各功能面板：Compose、Explore、Clues、Branches、Reader、Critique、Patch、Snapshots、Constraints。所有面板通过 Hono 后端 API 与 core 交互。

当前 Studio 仍在快速演进中，是 CLI 能力的可视化补充。

### 4.3 `compose` 生成管道

为避免 AI 偏离大纲、OOC 或产生幻觉细节，`compose` 内部采用分层生成与验证：

```
precheck（约束/大纲预检）
  → 结构化 scene plan（人物、地点、事件、约束声明）
  → 作者确认
  → 扩写成 Markdown 正文
  → postcheck（生成后验证）
  → 返回结果 + violations（如有）
```

- **一般 violation**：附带 AI 建议的修复方案，作者可一键应用或忽略；
- **严重 violation**：阻断提交，必须先解决或明确覆盖；
- 整个管道支持回滚到大纲和状态图的上一节点。

MVP 阶段先保证 postcheck 可用，precheck 与结构化 scene plan 逐步增强。

---

## 5. 工程结构

```
packages/
  core/      # 创作引擎：图状态、可寻址路径、操作 API、LLM、投影/diff
    src/
      project/     # 项目/书籍目录布局与配置
      graph/       # SQLite 图数据库
      address/     # 可寻址路径解析
      models/      # Book 聚合根与节点类型
      operations/  # compose、edit、query、patch、snapshot、branch 等
      llm/         # OpenAI-compatible client + stub
      projection/  # 状态图 → Markdown
      diff/        # Markdown 修改 → 状态图补丁提案
      constraints/ # 约束 DSL、解析、检查
      embeddings/  # FastEmbed / hash provider、向量存储、检索
      memory/      # 语义检索上下文
  cli/       # Commander.js 命令行入口，yanstory repl
  studio/    # Vite + React + Hono Web 工作台
```

---

## 6. 数据模型

### 6.1 书籍目录

```
books/<book-id>/
  graph.db        # SQLite：节点、边、属性、操作日志、快照
  text/           # Markdown 文本（章节/场景/段落）
    chapters/0001.md
  projections/    # 状态图生成的小说视图
  snapshots/      # 状态图版本快照
```

### 6.2 节点与边

- **节点**：book、arc、chapter、scene、paragraph、sentence、character、location、item、event、promise、lie、debt、knowledge、emotion、timeline、constraint、clue 等。
- **边**：contains、causes、enables、prevents、relates_to、knows、lies_to 等。

### 6.3 可寻址路径

每个叙事单元都有稳定地址：

```
book/arc-3/scene-7/paragraph-12/sentence-3
character/elara/promise/made-to-mentor-chapter-4
```

这让“精确编辑”和“精确问责”成为可能。

### 6.4 大纲与状态图：互补的双源 truth

大纲与状态图不是谁取代谁，而是互补：

- **大纲**承载作者的高层次意图：卷、章、节拍、转折点、人物弧光。
- **状态图**承载执行后的具体事实：实际出场的角色、发生的事件、兑现的承诺、回收的线索。

两者在使用中有主次之分：

| 阶段 | 主权威 | 次权威 |
|---|---|---|
| 规划期 | 大纲 | 图根据大纲初始化 |
| 创作期 | 状态图 | 大纲作为参考与约束 |
| 修订期 | 状态图 | 大纲按需更新以反映实际叙事 |
| 续写/续集 | 状态图 | 从图反推的大纲成为下一部输入 |

同步策略：文本修改通过 patch 回写图；图的重大变更可触发大纲更新建议；大纲调整可生成图变更提案。

---

## 7. 与 InkOS 的关系

YanStory 参考了 [InkOS](https://github.com/Narcooo/inkos) 的思路，但理念上有根本差异：

| | InkOS | YanStory |
|---|---|---|
| 核心隐喻 | 生成下一章的流水线 | 实时可编辑的领域实体 |
| 真相来源 | 文本 / 提示历史 | 状态图 |
| 修改方式 | 重新生成 | 直接寻址编辑 + patch 回写 |
| 长期一致性 | 依赖提示工程 | 显式图约束 + 因果检查 |

若后续重度参考 InkOS 代码，需遵守其 AGPL-3.0-only 许可证。YanStory 自身许可证尚未最终确定。

---

## 8. 当前状态与近期验证重点

### 8.1 已实现能力

- 核心图存储与 Book 聚合根
- compose / edit / query / patch / snapshot / branch 操作
- 约束 DSL 与因果检查
- 线索（clue）种植与回收
- 读者模拟器（reader simulator）
- 体裁化批评家（genre critic）
- 本地 FastEmbed 语义检索 + hash 回退
- Studio API 与各功能面板

### 8.2 最紧迫验证

1. **图驱动创作是否真能提升长篇一致性？**
   - 需要真实章节级别的端到端测试。
   - 需要对比“图+约束”与“纯提示生成”在伏笔回收、人设一致性上的表现。

2. **CLI REPL 的端到端可用性**
   - CLI 作为脚本化和快速操作入口是否足够顺手？
   - 显式命令设计是否足够快、足够可预测？
   - `--stub` 之外的 LLM 集成路径是否顺畅？

---

## 9. 设计原则

1. **可解释优先于智能**：一个能解释自己为什么这样写的系统，比一个偶尔更聪明但黑箱的系统更有价值。
2. **结构优先于文本**：先维护好书的状态图，文本只是投影；文本修改必须能回到结构。
3. **操作留下痕迹**：每个生成、编辑、分支、合并都要可审计、可回滚。
4. **离线可用**：支持本地 LLM stub 与本地嵌入模型，作者不必时刻联网。
5. **对职业作者友好**：快捷键、可脚本化、可批量操作，不为了“小白友好”牺牲效率上限。

---

## 10. 本地开发

```bash
pnpm install        # 安装依赖
pnpm build          # 全量构建
pnpm dev            # 监听模式并行开发
pnpm test           # 运行所有测试
pnpm typecheck      # 全量类型检查
```

CLI 本地调试：

```bash
pnpm --filter @yanstory/cli build
node packages/cli/dist/index.js repl --project /tmp/yanstory-demo --stub
```

Studio 本地开发：

```bash
pnpm --filter @yanstory/studio dev
```

---

## 11. 下一步讨论方向

- 大纲与状态图的“双源 truth”如何同步：何时以大纲为主、何时以图为主
- `compose` 操作的内部流程：precheck → 结构化生成 → 扩写 → postcheck
- 约束 DSL 的表达方式与作者体验（自然语言 vs 结构化规则）
- Agent 角色定义与协作协议
- 投影（Markdown）与 patch 回写的精确性
- 职业作者工作流中的“最小可用闭环"
