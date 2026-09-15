# Fly Brain Flappy Bird PRD

> **让一只真实果蝇 Connectome 自己挑战 Flappy Bird。**

---

## 1. 项目概述

### 1.1 项目名称

**Fly Brain Flappy Bird**

中文名可暂定：

**《果蝇大脑玩 Flappy Bird》**

### 1.2 项目定位

这是一个基于 `fly.ai` 果蝇 Connectome 的纯前端神经科学小游戏。

项目不是让玩家自己玩 Flappy Bird，而是：

> 将 Flappy Bird 当前环境编码成果蝇能够接收的神经刺激，让果蝇 Connectome 自己产生神经活动，再根据输出神经活动决定是否拍翅膀。

用户的主要行为是：

**观察一只果蝇的大脑如何尝试自己玩 Flappy Bird。**

核心体验同时包含：

- Flappy Bird 游戏
- 果蝇 Connectome 模拟
- 神经活动实时可视化
- 感觉神经输入
- Descending Neuron 输出
- FLAP / WAIT 决策
- Pure Brain 与 Trained Readout 对比实验

---

# 2. 项目目标

## 2.1 核心目标

实现一个可以直接在浏览器运行的实验型网站：

```text
Flappy Bird Environment
          ↓
     Fly Encoder
          ↓
Sensory / Visual Neurons
          ↓
   Fly.ai Connectome
          ↓
 Descending Neurons
          ↓
     Fly Decoder
          ↓
      FLAP / WAIT
          ↓
    Flappy Bird
```

游戏全过程不需要用户控制。

用户点击：

```text
WAKE UP FLY
```

之后果蝇完全自行游戏。

---

# 3. 核心原则

## 3.1 Connectome 不训练

果蝇 Connectome 的连接结构和权重保持冻结。

禁止：

- 修改 Connectome 权重
- 使用强化学习修改 Connectome
- PPO 训练 Connectome
- DQN 训练 Connectome
- NEAT 替代 Connectome
- 使用普通神经网络冒充果蝇脑

允许：

```text
Input Encoder
      ↓
Frozen Fly Connectome
      ↓
Optional Readout
```

其中 Readout 可以单独训练。

---

## 3.2 游戏必须由神经活动控制

禁止使用：

```javascript
if (bird.y > gapCenter) {
    bird.flap();
}
```

作为最终控制逻辑。

环境信息必须经过：

```text
Environment
↓
Encoder
↓
Fly Connectome
↓
Decoder / Readout
↓
Action
```

最终才允许产生：

```text
FLAP
```

或：

```text
WAIT
```

---

# 4. 技术基础

项目基于：

```text
fly.ai
https://github.com/alextitonis/fly.ai
```

使用其果蝇 Connectome 数据及浏览器导出能力。

核心数据包括：

```text
约 166,700 neurons
约 25.6 million connections
```

浏览器版使用导出的：

```text
brain.json
labels
compressed sparse weights
```

完整 Connectome 在浏览器 Worker 中运行。

---

# 5. 产品核心概念

整个网站围绕一个问题：

> **真实果蝇的大脑结构，能不能学会/完成 Flappy Bird？**

网站不是传统游戏，而是：

```text
小游戏
+
AI Experiment
+
Neuroscience Visualization
```

用户的乐趣来自观察：

```text
水管靠近
↓
视觉神经元激活
↓
神经活动传播
↓
Descending Neuron 激活
↓
果蝇决定拍翅膀
↓
成功 / 撞墙
```

---

# 6. 游戏角色

Flappy Bird 原版中的 Bird 改成果蝇。

建议使用：

```text
🪰
```

或自制像素果蝇 Sprite。

游戏世界仍然保持经典结构：

```text
        PIPE
       █████
       █████

🪰 →

       GAP

       █████
       █████
```

不增加：

- 武器
- 道具
- 技能
- 商店
- 角色系统
- 复杂关卡

保持 Flappy Bird 最基本玩法。

---

# 7. 游戏规则

## 7.1 基础物理

果蝇拥有：

```text
positionY
velocityY
gravity
flapForce
```

每帧：

```text
velocityY += gravity
positionY += velocityY
```

执行 FLAP：

```text
velocityY = -flapForce
```

---

## 7.2 水管

水管：

```text
从右向左移动
```

包含：

```text
topPipe
gap
bottomPipe
```

基础参数：

```text
pipeSpeed
pipeWidth
gapHeight
spawnInterval
```

---

## 7.3 得分

果蝇成功通过一组水管：

```text
Score +1
```

显示：

```text
SCORE 12
```

---

## 7.4 死亡

以下情况死亡：

```text
撞上上水管
撞上下水管
撞上地面
飞出顶部边界
```

死亡后：

```text
暂停
↓
显示实验结果
↓
重新启动下一次实验
```

---

# 8. 游戏状态输入

每个 Brain Tick 获取：

```javascript
{
    birdY,
    birdVelocityY,

    pipeX,
    pipeWidth,

    gapTop,
    gapBottom,
    gapCenterY,

    distanceToPipe
}
```

进一步计算：

```text
verticalError
approachIntensity
```

其中：

```text
verticalError =
gapCenterY - birdY
```

---

# 9. Fly Encoder

Fly Encoder 负责：

> 将游戏环境翻译成果蝇神经刺激。

结构：

```text
Flappy State
      ↓
FlappyEncoder
      ↓
Neural Stimulus
```

---

# 10. Looming Encoder

水管越接近果蝇，视觉威胁越大。

使用视觉神经元：

```text
LC4
LPLC2
```

主要表示：

```text
快速逼近物体
looming object
collision threat
```

---

## 10.1 Approach Intensity

定义：

```text
distance = pipeX - birdX
```

转换：

```text
approachIntensity =
clamp(
    1 - distance / MAX_SENSE_DISTANCE,
    0,
    1
)
```

例如：

| 水管距离 | 刺激 |
|---:|---:|
| >300px | 0.05 |
| 250px | 0.15 |
| 200px | 0.25 |
| 150px | 0.40 |
| 100px | 0.60 |
| 50px | 0.90 |
| <30px | 1.00 |

输出：

```text
LC4 stimulation
LPLC2 stimulation
```

---

# 11. Vertical Error Encoder

需要告诉果蝇：

> 洞口在自己上面还是下面。

第一版不进行完整视觉图像输入。

使用左右神经通道编码垂直误差。

使用：

```text
LC10a-L
LC10a-R
```

重新定义：

```text
LC10a-L → target above
LC10a-R → target below
```

---

## 11.1 果蝇低于洞口

```text
       GAP
        ↑
        ↑

       🪰
```

产生：

```text
LC10a-L ↑↑↑
LC10a-R ↓
```

---

## 11.2 果蝇高于洞口

```text
       🪰

        ↓
        ↓
       GAP
```

产生：

```text
LC10a-L ↓
LC10a-R ↑↑↑
```

---

## 11.3 强度

定义：

```text
error =
gapCenterY - birdY
```

归一化：

```text
normalizedError =
clamp(
    abs(error) / MAX_VERTICAL_ERROR,
    0,
    1
)
```

然后：

```text
error > 0

LC10a-L = normalizedError
LC10a-R = 0
```

否则：

```text
LC10a-L = 0
LC10a-R = normalizedError
```

---

# 12. Velocity Encoder

鸟当前的垂直速度也必须编码。

因为仅仅知道：

```text
鸟在洞口下面
```

是不够的。

例如：

```text
鸟在洞口下面 + 正在高速上升
```

和：

```text
鸟在洞口下面 + 正在高速下坠
```

需要不同决策。

增加两组辅助输入：

```text
UPWARD
DOWNWARD
```

可以映射到选定的 sensory / interneuron channels。

第一版允许使用预先选择的输入神经元组。

编码：

```text
velocityY < 0
→ UPWARD stimulation

velocityY > 0
→ DOWNWARD stimulation
```

刺激强度：

```text
abs(velocityY) / MAX_VELOCITY
```

---

# 13. 完整 Encoder

最终：

```text
                 Flappy State
                       │
         ┌─────────────┼──────────────┐
         │             │              │
         ▼             ▼              ▼
     Distance      Vertical        Velocity
         │            Error            │
         ▼             ▼              ▼
    LC4/LPLC2      LC10a L/R     Motion Channel
         │             │              │
         └─────────────┼──────────────┘
                       ▼
                  Fly Connectome
```

---

# 14. Brain Simulation

果蝇脑运行在：

```text
Web Worker
```

绝对不能运行在 UI 主线程。

---

# 15. Brain Tick

游戏：

```text
60 FPS
```

果蝇脑：

```text
50 Hz
```

即：

```text
20 ms / brain tick
```

流程：

```text
20ms

Game State
↓
Encoder
↓
Stimulus
↓
Connectome Step
↓
Neuron Activity
↓
Decoder
↓
FLAP / WAIT
```

---

# 16. Pure Brain 模式

这是默认模式。

按钮：

```text
PURE BRAIN
```

模式原则：

> 不训练任何 Flappy Bird 输出模型。

直接观察 Descending Neurons。

重点读取：

```text
DNp01
```

将其作为：

```text
take-off / escape / flap
```

候选运动输出。

---

# 17. FLAP Decoder

维护最近：

```text
100 ms
```

DNp01 活动。

例如：

```text
DNp01SpikeCount
```

判断：

```text
DNp01SpikeCount >= threshold
```

执行：

```text
FLAP
```

否则：

```text
WAIT
```

初始 threshold：

```text
2 spikes / 100ms
```

允许后续实验调整。

---

# 18. 防止连续拍翅

加入：

```text
FLAP_COOLDOWN
```

建议：

```text
100~150 ms
```

否则高频 DNp01 活动可能导致：

```text
FLAP
FLAP
FLAP
FLAP
```

使果蝇直接飞出顶部。

---

# 19. Trained Readout 模式

第二种模式：

```text
TRAINED READOUT
```

Connectome：

```text
完全冻结
```

只训练：

```text
Connectome Activity
        ↓
Logistic Readout
        ↓
FLAP / WAIT
```

---

# 20. Readout 输入

不读取全部 166,700 个神经元作为第一版特征。

优先读取：

```text
Descending Neurons
```

或者经过筛选的：

```text
motor-related neurons
```

构成：

```text
activityVector
```

例如：

```text
[
 DN_001,
 DN_002,
 DN_003,
 ...
 DN_N
]
```

---

# 21. Teacher 数据生成

使用简单 Teacher Policy 产生训练数据。

Teacher 不参与正式游戏。

例如：

```text
if birdY > gapCenterY + margin:
    FLAP
else:
    WAIT
```

同时考虑下降速度：

```text
if birdY > targetY
   && velocityY > velocityThreshold:
       FLAP
```

Teacher 运行大量模拟：

```text
5000~20000 frames
```

收集：

```text
Fly Activity → Teacher Action
```

---

# 22. Readout Training

使用：

```text
Logistic Regression
```

输入：

```text
Descending Neuron Activity
```

输出：

```text
0 = WAIT
1 = FLAP
```

最终模型非常小。

浏览器直接加载：

```text
readout.json
```

例如：

```json
{
  "weights": [],
  "bias": 0,
  "threshold": 0.5
}
```

---

# 23. Readout 推理

计算：

```text
z =
W · activity + bias
```

然后：

```text
probability =
sigmoid(z)
```

如果：

```text
probability > 0.5
```

执行：

```text
FLAP
```

否则：

```text
WAIT
```

---

# 24. 两种模式比较

顶部提供：

```text
[ PURE BRAIN ] [ TRAINED READOUT ]
```

PURE：

```text
Sensory Input
↓
Fly Brain
↓
DNp01
↓
FLAP
```

TRAINED：

```text
Sensory Input
↓
Fly Brain
↓
Descending Neurons
↓
Logistic Readout
↓
FLAP
```

必须清晰标注两种模式区别，避免让用户误以为 Trained Readout 修改了 Connectome。

---

# 25. 页面结构

桌面端采用：

```text
┌──────────────────────────────────────────────────────────────┐
│ FLY BRAIN PLAYS FLAPPY BIRD                                 │
│ 166,700 neurons · ~25.6M connections                        │
├────────────────┬───────────────────────┬─────────────────────┤
│                │                       │                     │
│   FLY BRAIN    │      FLAPPY BIRD      │    NEURAL DATA      │
│                │                       │                     │
│     ·●·        │         ████          │ LC4     ███████     │
│   ●····●       │                       │ LPLC2   █████       │
│  ···●···       │   🪰       GAP        │ LC10-L  ██          │
│    ●··●        │                       │ LC10-R  ███████     │
│                │         ████          │                     │
│ 166,700        │                       │ DNp01   █████████   │
│ neurons        │                       │                     │
│                │                       │ DECISION            │
│                │                       │ ↑ FLAP              │
├────────────────┴───────────────────────┴─────────────────────┤
│ SCORE 12   BEST 27   BRAIN 50Hz   GAME 60FPS                │
│                                                              │
│ [PURE BRAIN] [TRAINED READOUT] [SLOW BRAIN] [RESTART]       │
└──────────────────────────────────────────────────────────────┘
```

---

# 26. Header

显示：

```text
🪰 FLY BRAIN PLAYS FLAPPY BIRD
```

副标题：

```text
A real fruit fly connectome attempts Flappy Bird.
```

再显示：

```text
166,700 NEURONS
~25.6M CONNECTIONS
CONNECTOME FROZEN
```

---

# 27. Brain Panel

左侧：

```text
FLY BRAIN
```

使用：

```text
Canvas / WebGL
```

显示整个 Connectome 活动。

第一版不绘制完整连接线。

只绘制：

```text
Neuron Activity Map
```

---

# 28. Neuron Activity Map

将约 166,700 个神经元映射成二维点阵。

例如：

```text
420 × 400
```

每个像素/点：

```text
1 neuron
```

静止：

```text
低亮度
```

Spike：

```text
高亮
```

活动越强：

```text
亮度越高
```

形成类似：

```text
神经星空
```

的实时视觉效果。

---

# 29. Brain Visualization 性能策略

不要每帧更新。

Brain Map：

```text
20~30 FPS
```

游戏：

```text
60 FPS
```

神经模拟：

```text
50 Hz
```

三者完全分离。

---

# 30. Flappy Bird Panel

中间区域为游戏。

Canvas：

```text
480 × 640
```

或响应式比例：

```text
3:4
```

显示：

```text
果蝇
水管
天空
地面
当前 Score
```

---

# 31. Sensor Overlay

游戏画面提供轻量神经输入可视化。

例如水管接近：

```text
PIPE
████

<----- 138px ----->

🪰
```

旁边显示：

```text
LOOMING 62%
```

洞口方向：

```text
TARGET ↑ 41px
```

让用户能够理解：

> 果蝇现在到底接收到了什么信息。

---

# 32. Neural Data Panel

右侧显示：

## VISUAL INPUT

```text
LC4

████████░░
78%
```

```text
LPLC2

██████░░░░
61%
```

```text
LC10a-L

██░░░░░░░░
21%
```

```text
LC10a-R

███████░░░
72%
```

---

# 33. Motor Panel

显示：

```text
MOTOR OUTPUT
```

例如：

```text
DNp01

█████████░
91%
```

当前动作：

```text
DECISION

↑ FLAP
```

或者：

```text
DECISION

· WAIT
```

---

# 34. Readout 模式额外信息

Trained Readout 模式显示：

```text
FLAP PROBABILITY

████████░░
82%
```

以及：

```text
Decision Threshold
50%
```

---

# 35. Status Bar

底部显示：

```text
SCORE
12

BEST
27

GAME
60 FPS

BRAIN
50 Hz

MODE
PURE
```

---

# 36. Loading 页面

由于 Connectome 数据较大，必须设计专门 Loading 页面。

显示：

```text
LOADING A FRUIT FLY BRAIN...
```

下面：

```text
CONNECTOME

████████████░░░░
72%
```

逐步显示：

```text
Loading neuron metadata...
Loading sparse weights...
Decompressing connectome...
Building neural state...
Initializing visual neurons...
Initializing descending neurons...
```

完成：

```text
166,700 NEURONS ONLINE

~25.6M CONNECTIONS READY

BRAIN ONLINE
```

按钮：

```text
WAKE UP FLY
```

---

# 37. Connectome 缓存

首次加载完成以后：

使用：

```text
Cache Storage
```

或：

```text
IndexedDB
```

缓存：

```text
brain.json
labels
weight chunks
readout.json
```

第二次进入网站：

优先读取本地缓存。

显示：

```text
WAKING UP CACHED BRAIN...
```

避免重复下载完整模型。

---

# 38. Brain Worker

创建：

```text
flyBrain.worker.js
```

职责：

```text
加载 Connectome
初始化 neuron state
接收 stimulus
执行 LIF simulation
计算 spikes
读取关键神经元
发送结果
```

---

# 39. Worker 通信

主线程发送：

```javascript
{
    type: "STEP",
    state: {
        birdY,
        velocityY,
        distanceToPipe,
        gapCenterY
    }
}
```

Worker 返回：

```javascript
{
    type: "BRAIN_RESULT",

    decision: "FLAP",

    neurons: {
        LC4: 0.78,
        LPLC2: 0.61,
        LC10Left: 0.21,
        LC10Right: 0.72,
        DNp01: 0.91
    },

    activityMap: ...
}
```

---

# 40. SharedArrayBuffer

如果部署环境允许：

优先：

```text
SharedArrayBuffer
```

共享：

```text
Neuron membrane potential
Spike state
Activity map
```

减少 Worker 与主线程之间复制大量数据。

---

# 41. Transferable Buffer 降级

无法使用 SharedArrayBuffer 时：

使用：

```text
ArrayBuffer
+
postMessage transferable
```

禁止每 Brain Tick：

```text
复制 166,700 个 JS Object
```

所有神经数据必须使用：

```text
TypedArray
```

例如：

```text
Float32Array
Uint8Array
Uint32Array
```

---

# 42. Sparse Connectome

连接矩阵禁止使用：

```text
Dense Matrix
```

必须保持：

```text
Sparse Matrix
```

建议浏览器表示：

```text
CSC / CSR
```

例如：

```text
weights
indices
indptr
```

---

# 43. Brain 数据目录

建议：

```text
public/
└── brain/
    ├── brain.json
    ├── labels.json
    ├── neurons.bin
    ├── weights-00.bin.gz
    ├── weights-01.bin.gz
    ├── weights-02.bin.gz
    ├── weights-03.bin.gz
    ├── ...
    └── readout.json
```

---

# 44. 前端技术栈

推荐：

```text
Vite
JavaScript / TypeScript
HTML
CSS
Canvas 2D
Web Worker
WebGL
IndexedDB
TypedArray
```

不需要：

```text
Node 后端
Python 后端
数据库服务器
用户系统
GPU Server
API Server
```

部署后：

```text
纯静态网站
```

---

# 45. 游戏渲染

第一版直接：

```text
Canvas 2D
```

不引入复杂游戏引擎。

文件：

```text
FlappyGame.ts
Bird.ts
Pipe.ts
Collision.ts
Physics.ts
```

---

# 46. Brain 渲染

Brain Map 使用：

```text
WebGL
```

避免 Canvas 逐点绘制大量 neuron。

实现：

```text
166,700 points
```

每个 point 对应一个 neuron。

Shader 根据：

```text
activity
```

改变：

```text
brightness
size
```

---

# 47. Slow Brain 模式

按钮：

```text
SLOW BRAIN
```

点击后：

```text
Game Speed = 0.1×
```

神经活动传播可视化同步减速。

显示：

```text
NEURAL TIME ×0.1
```

---

# 48. Slow Brain 动画

当水管接近：

首先：

```text
VISUAL INPUT DETECTED
```

高亮：

```text
LC4
LPLC2
```

然后：

```text
SIGNAL PROPAGATING...
```

Brain Map 出现活动。

随后：

```text
DESCENDING NEURON ACTIVE
```

高亮：

```text
DNp01
```

最后：

```text
MOTOR COMMAND

FLAP ↑
```

果蝇执行拍翅。

---

# 49. Slow Brain 的目的

不是改变 Connectome。

只是：

```text
降低游戏时间尺度
```

方便观察：

```text
Input
↓
Brain Activity
↓
Output
```

---

# 50. Death Screen

死亡后覆盖游戏区域。

显示：

```text
FLY #42 DIED
```

统计：

```text
SCORE
7 PIPES

LIFETIME
18.4 SEC

TOTAL SPIKES
1,824,291
```

---

# 51. Last Brain State

死亡页面继续显示：

```text
LAST BRAIN STATE

LC4
84%

LPLC2
92%

LC10a-L
16%

LC10a-R
71%

DNp01
12%
```

---

# 52. Cause of Death

根据最后状态生成简单结果。

例如：

```text
CAUSE OF DEATH

THE FLY DID NOT FLAP.
```

或者：

```text
THE FLY FLAPPED TOO EARLY.
```

或者：

```text
THE FLY PANICKED.
```

这些只属于娱乐性描述。

不得声称这是生物学意义上的真实死亡原因。

---

# 53. Restart

按钮：

```text
REVIVE FLY
```

执行：

```text
Reset Game
Reset Brain State
Increment Fly ID
Start New Experiment
```

例如：

```text
Fly #42
↓
Fly #43
```

---

# 54. 自动实验模式

可以提供：

```text
AUTO REVIVE
```

开启后：

死亡：

```text
2 秒
↓
自动开始下一局
```

让用户可以把网站放着看。

---

# 55. Experiment History

仅保存本地最近实验。

使用：

```text
localStorage / IndexedDB
```

记录：

```javascript
{
    flyId,
    mode,
    score,
    lifetime,
    totalSpikes
}
```

---

# 56. Local Leaderboard

显示：

```text
BEST FLIES

#1 Fly #183   43
#2 Fly #041   31
#3 Fly #092   28
#4 Fly #221   17
#5 Fly #043   12
```

不需要服务器。

排行榜仅为：

```text
This Browser
```

---

# 57. 随机性

保留 Brain Simulation 的随机噪声。

因此：

```text
相同 Connectome
+
相同 Encoder
+
相同 Decoder
```

不同实验可能产生不同神经活动。

这会导致：

```text
Fly #1 → Score 2
Fly #2 → Score 7
Fly #3 → Score 1
Fly #4 → Score 12
```

增加实验观赏性。

---

# 58. Seed

为了科学演示和调试，允许：

```text
Seeded Random
```

开发模式可指定：

```text
seed=12345
```

这样：

```text
水管位置
神经噪声
```

都可以复现。

普通用户界面不需要突出 Seed。

---

# 59. Brain Reset

每次新实验：

必须：

```text
reset membrane potential
reset spikes
reset refractory state
reset input
```

避免上一只 Fly 的神经状态影响下一局。

---

# 60. 游戏难度

第一版固定难度。

不要动态难度。

建议：

```text
较大的 gap
较慢的 pipe speed
```

因为目标不是测试人类反应，而是观察果蝇 Connectome。

后续再根据实验结果调整参数。

---

# 61. Debug Panel

开发模式：

```text
?debug=1
```

显示：

```text
birdY
velocityY
gapCenter
verticalError
distance
approachIntensity

LC4
LPLC2
LC10a-L
LC10a-R

DNp01 spikes

brainStepTime
workerLatency
renderFPS
```

---

# 62. Neural Inspector

Debug 模式允许搜索：

```text
Neuron Type
```

例如：

```text
LC4
```

显示：

```text
Neuron Count
Side
Current Activity
Spike Count
```

方便调整 Encoder。

不作为普通用户主功能。

---

# 63. 性能监控

必须统计：

```text
Game FPS
Brain Hz
Brain Step Time
Worker Latency
Memory Usage
```

目标：

```text
Game FPS ≥ 50

Brain simulation
尽量接近 50 Hz

UI 主线程
保持流畅
```

---

# 64. Brain 计算过慢降级

如果：

```text
Brain Step > 20ms
```

持续出现：

降低：

```text
Brain Visualization FPS
```

例如：

```text
30 → 20 → 10 FPS
```

但优先保持：

```text
Brain Simulation
```

---

# 65. 更慢设备降级

如果依然无法实时：

允许：

```text
GAME TIME SCALE
```

自动下降：

```text
1.0×
↓
0.75×
↓
0.5×
```

页面提示：

```text
BRAIN COMPUTATION IS SLOW.

GAME TIME ×0.5
```

而不是直接跳 Brain Tick。

---

# 66. 不允许的性能降级

禁止偷偷：

```text
用假神经活动替代真实 Connectome
```

禁止：

```text
检测设备慢
↓
切换普通规则 AI
```

如果 Connectome 无法运行：

应该明确提示：

```text
THIS DEVICE CANNOT RUN THE FULL FLY BRAIN IN REAL TIME.
```

---

# 67. 移动端

移动端仍然允许打开。

布局变成：

```text
FLAPPY BIRD

↓

DECISION

↓

NEURAL DATA

↓

BRAIN MAP
```

但是第一版优化重点：

```text
Desktop
```

因为 Connectome 内存和计算需求较高。

---

# 68. UI 风格

整体：

```text
Dark Neuroscience Lab
+
Retro Game
```

背景：

```text
接近黑色
```

Brain：

```text
荧光点阵
```

游戏：

```text
像素风
```

数据：

```text
实验仪器风格
```

---

# 69. UI 动效

只使用必要动画：

```text
Neuron spike flash
FLAP arrow
Pipe movement
Brain pulse
Loading progress
```

不要加入：

```text
复杂粒子背景
3D 场景
大量无意义动画
```

避免影响 Connectome 性能。

---

# 70. 状态机

网站整体：

```text
BOOT
 ↓
LOADING_CONNECTOME
 ↓
READY
 ↓
RUNNING
 ↓
DEAD
 ↓
RESTARTING
 ↓
RUNNING
```

额外：

```text
RUNNING
↕
SLOW_MODE
```

---

# 71. Brain 状态机

```text
UNLOADED
↓
LOADING
↓
INITIALIZING
↓
READY
↓
SIMULATING
↓
RESETTING
```

异常：

```text
ERROR
```

---

# 72. 文件目录

推荐：

```text
fly-flappy/
│
├── index.html
├── package.json
├── vite.config.ts
│
├── public/
│   │
│   ├── sprites/
│   │   ├── fly.png
│   │   ├── pipe.png
│   │   └── background.png
│   │
│   └── brain/
│       ├── brain.json
│       ├── labels.json
│       ├── neurons.bin
│       ├── weights-00.bin.gz
│       ├── weights-01.bin.gz
│       ├── ...
│       └── readout.json
│
└── src/
    │
    ├── main.ts
    ├── App.ts
    │
    ├── game/
    │   ├── FlappyGame.ts
    │   ├── Bird.ts
    │   ├── Pipe.ts
    │   ├── Physics.ts
    │   ├── Collision.ts
    │   └── GameState.ts
    │
    ├── brain/
    │   ├── FlyBrain.ts
    │   ├── FlyEncoder.ts
    │   ├── FlyDecoder.ts
    │   ├── Readout.ts
    │   ├── BrainLoader.ts
    │   ├── BrainCache.ts
    │   └── flyBrain.worker.ts
    │
    ├── renderer/
    │   ├── GameRenderer.ts
    │   ├── BrainRenderer.ts
    │   └── NeuralGraph.ts
    │
    ├── ui/
    │   ├── Header.ts
    │   ├── LoadingScreen.ts
    │   ├── NeuralPanel.ts
    │   ├── MotorPanel.ts
    │   ├── StatusBar.ts
    │   ├── DeathScreen.ts
    │   └── Leaderboard.ts
    │
    ├── experiment/
    │   ├── Experiment.ts
    │   ├── ExperimentHistory.ts
    │   └── SeededRandom.ts
    │
    └── styles/
        ├── global.css
        ├── game.css
        └── brain.css
```

---

# 73. FlyEncoder 接口

```typescript
interface FlappyState {
    birdY: number;
    birdVelocityY: number;

    pipeX: number;

    gapTop: number;
    gapBottom: number;
    gapCenterY: number;

    distanceToPipe: number;
}
```

输出：

```typescript
interface NeuralStimulus {
    lc4: number;
    lplc2: number;

    lc10Left: number;
    lc10Right: number;

    upward: number;
    downward: number;
}
```

---

# 74. BrainResult

```typescript
interface BrainResult {

    timestamp: number;

    decision:
        | "FLAP"
        | "WAIT";

    flapProbability?: number;

    activity: {
        lc4: number;
        lplc2: number;

        lc10Left: number;
        lc10Right: number;

        dnp01: number;
    };

    totalSpikes: number;

    stepTime: number;
}
```

---

# 75. Main Loop

游戏循环：

```text
requestAnimationFrame
        │
        ├─ Physics
        ├─ Collision
        ├─ Pipe
        ├─ Render
        │
        └─ Read latest Brain Decision
```

独立 Brain Clock：

```text
50Hz
 │
 ├─ capture game state
 ├─ send to worker
 │
 ▼
Brain Worker
 │
 ├─ encode
 ├─ stimulate
 ├─ simulate
 ├─ decode
 │
 ▼
decision
```

---

# 76. 决策同步

Brain Worker 不应该阻塞游戏。

主线程保存：

```text
latestBrainDecision
```

Worker 返回：

```text
FLAP
```

主线程检查：

```text
cooldown
```

符合条件：

```text
bird.flap()
```

---

# 77. Pure Brain 数据流

```text
Bird + Pipe
     ↓
FlappyState
     ↓
FlyEncoder
     ↓
LC4 / LPLC2 / LC10a
     ↓
166,700-neuron Connectome
     ↓
DNp01
     ↓
Threshold Decoder
     ↓
FLAP / WAIT
```

---

# 78. Trained Readout 数据流

```text
Bird + Pipe
     ↓
FlappyState
     ↓
FlyEncoder
     ↓
Frozen Fly Connectome
     ↓
Descending Neuron Vector
     ↓
Logistic Readout
     ↓
FLAP Probability
     ↓
FLAP / WAIT
```

---

# 79. 首版开发顺序

### Phase 1

实现：

```text
Flappy Bird
```

验证：

```text
碰撞
物理
水管
分数
重开
```

### Phase 2

接入：

```text
Fly.ai exported web connectome
```

完成：

```text
Worker loading
Sparse matrix
LIF step
```

### Phase 3

实现：

```text
FlyEncoder
```

映射：

```text
LC4
LPLC2
LC10a
```

### Phase 4

实现：

```text
Pure Brain
```

读取：

```text
DNp01
```

完成：

```text
FLAP / WAIT
```

### Phase 5

实现：

```text
Brain Activity Map
Neural Panel
Motor Panel
```

### Phase 6

加入：

```text
Trained Readout
```

### Phase 7

加入：

```text
Slow Brain
Death Analysis
Local Leaderboard
Caching
```

### Phase 8

性能优化和静态部署。

---

# 80. MVP 必须实现

第一版必须包含：

- 纯前端 Flappy Bird
- 像素果蝇角色
- fly.ai Connectome
- 完整 Connectome 浏览器加载
- Web Worker 模拟
- LC4 输入
- LPLC2 输入
- LC10a-L/R 输入
- 垂直速度输入
- DNp01 输出
- FLAP / WAIT
- Pure Brain 模式
- Trained Readout 模式
- Brain Activity Map
- Neural Data Panel
- Score
- Best Score
- Death Screen
- Restart
- Slow Brain
- Connectome 本地缓存

---

# 81. MVP 不实现

第一版明确不实现：

- 登录
- 注册
- 云数据库
- 在线排行榜
- 多人游戏
- 聊天
- 后端
- GPU Server
- 3D
- 完整果蝇视觉成像
- 6006 photoreceptor 图像输入
- 强化学习
- 修改 Connectome
- 自定义角色
- 商店
- 道具
- 复杂游戏关卡

---

# 82. 后续实验方向

MVP 完成后，可以继续实验：

```text
真实 Photoreceptor Vision
```

即：

```text
Flappy Bird pixels
↓
Fly visual field
↓
Photoreceptors
↓
Visual system
↓
Connectome
↓
Descending neurons
```

但不作为第一版要求。

---

# 83. 科学准确性提示

网站必须明确区分：

```text
真实 Connectome
```

与：

```text
人为设计的 Game Encoder / Decoder
```

页面可以显示：

```text
The connectome is derived from fruit-fly neural connectivity.

Flappy Bird sensory encoding and motor decoding are artificial experimental interfaces.
```

避免宣传成：

> 一只真实果蝇天然知道怎么玩 Flappy Bird。

准确表达应该是：

> **我们把 Flappy Bird 环境编码成果蝇神经刺激，让真实果蝇 Connectome 的神经活动参与游戏决策。**

---

# 84. 核心宣传文案

主标题：

```text
A FLY BRAIN
PLAYS FLAPPY BIRD
```

副标题：

```text
166,700 neurons.
~25.6 million connections.
One tiny mission:

DON'T HIT THE PIPE.
```

开始按钮：

```text
WAKE UP FLY
```

死亡：

```text
FLY #42 DIED
```

重新开始：

```text
REVIVE FLY
```

---

# 85. 最终产品体验

用户第一次打开：

```text
LOADING A FRUIT FLY BRAIN...
```

看到：

```text
166,700 neurons
~25.6M connections
```

加载完成：

```text
BRAIN ONLINE
```

点击：

```text
WAKE UP FLY
```

果蝇出现。

水管逐渐靠近。

右侧：

```text
LC4       21%
LPLC2     18%
```

继续靠近：

```text
LC4       67%
LPLC2     73%
```

果蝇低于洞口：

```text
LC10a-L   81%
LC10a-R   12%
```

全脑点阵开始大量闪烁。

随后：

```text
DNp01

██████████

94%
```

界面出现：

```text
DECISION

↑ FLAP
```

果蝇突然向上飞。

成功穿过水管：

```text
SCORE 1
```

继续下一组。

最终：

```text
💥

FLY #1 DIED

SCORE
3

LIFETIME
11.8 SEC

TOTAL SPIKES
1,284,391

CAUSE OF DEATH

THE FLY DID NOT FLAP.

[ REVIVE FLY ]
```

用户重新启动：

```text
FLY #2
```

由于神经噪声：

第二只果蝇可能获得：

```text
SCORE 8
```

最终形成一个可以一直观看的：

> **真实果蝇 Connectome × Flappy Bird 神经科学实验玩具。**

---

# 86. 最终技术架构

```text
                    Browser
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
   MAIN THREAD                    WEB WORKER
        │                             │
        │                        Fly Connectome
        │                             │
  FlappyGame                         LIF
        │                             │
  Game State ────────► FlyEncoder     │
        │                             │
        │                         Neural Step
        │                             │
        │                        Descending
        │                         Neurons
        │                             │
        │                         Decoder
        │                             │
        ◄──────────── FLAP / WAIT ────┘
        │
        ▼
     Physics
        │
        ▼
     Canvas
```

另外：

```text
Connectome Files
       │
       ▼
 Cache / IndexedDB
       │
       ▼
 Brain Worker
```

最终部署只需要：

```text
HTML
CSS
JS
Connectome static assets
```

即可作为静态网站运行。

---

# 87. 产品验收标准

项目完成需要满足以下核心条件：

**游戏层：**

```text
果蝇能够自动进行 Flappy Bird 游戏
```

**Connectome 层：**

```text
游戏运行时实际执行 fly.ai Connectome 神经模拟
```

**输入层：**

```text
游戏状态必须通过神经刺激进入 Connectome
```

**输出层：**

```text
FLAP / WAIT 必须来源于 Connectome 输出活动
```

**可视化层：**

```text
用户可以实时观察关键感觉神经元、Brain Activity 和运动输出
```

**性能层：**

```text
Connectome 计算不能明显阻塞 Flappy Bird UI
```

**架构层：**

```text
整个网站可以纯静态部署
```

**真实性层：**

不得使用普通规则 AI 在后台控制果蝇，同时展示假的 Connectome 动画。

---

# 88. 一句话产品定义

> **Fly Brain Flappy Bird 是一个将 Flappy Bird 环境编码成果蝇感觉神经刺激、通过 fly.ai 的冻结果蝇 Connectome 传播神经活动，并从 Descending Neurons 解码 FLAP / WAIT 动作的纯前端神经科学小游戏。**