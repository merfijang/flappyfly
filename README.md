# 果蝇大脑玩 Flappy Bird

一个完全运行在浏览器中的神经科学可视化实验：将 Flappy Bird 的画面状态编码为果蝇视觉神经元输入，让完整的 MaleCNS v1.0 果蝇连接组在 Web Worker 中运行，并从下行神经元活动中解码拍翅动作。

> 这是计算实验与互动演示。感官编码和运动解码是人工设计的接口，并不表示真实果蝇能够理解 Flappy Bird。

## 功能特点

- 加载 166,700 个神经元、25,088,107 条有效连接的 MaleCNS v1.0 Connectome。
- 使用稀疏 CSC 权重结构在 Web Worker 中以 50 Hz 更新神经网络。
- LC4、LPLC2、LC10a 和垂直速度通道负责游戏状态编码。
- 提供 `PURE BRAIN` 原始神经解码和 `ONLINE TRAIN` 边飞边学习两种模式。
- `FAST TRAIN` 可在 Worker 中快速生成样本并训练 Logistic Readout。
- 支持导出、导入训练模型，并自动保存到浏览器本地存储。
- 训练控制带飞行安全约束，防止多轮训练后连续向上拍翅。
- WebGL 实时显示神经活动，记录本机最佳成绩与实验历史。
- 支持固定随机种子，便于复现实验结果。

## 环境要求

- Node.js 20 或更高版本
- 支持 Web Worker、WebGL 2 和 `DecompressionStream` 的现代浏览器

## 安装与启动

使用国内 npm 镜像安装依赖：

```powershell
npm install --registry=https://registry.npmmirror.com
npm run dev
```

浏览器访问终端输出的本地地址，通常为 `http://127.0.0.1:5173/`。

## 使用方法

1. 等待完整 Connectome 加载完成，点击 `WAKE UP FLY`。
2. 默认的 `ONLINE TRAIN` 会从低能力起步，在每次普通飞行中持续更新读出模型，约 1,000 个样本后收敛到快速训练的控制阈值，重开后保留学习进度。
3. 使用 `PURE BRAIN` 可单独查看不学习的 DNp01 原始神经解码效果。
4. 点击 `FAST TRAIN` 可额外生成加速训练样本，但不再是获得进步的必要步骤。
   Fast Train 完成后会切换到独立的 `FAST MODEL` 推理模式，模型权重保持冻结并直接启用成熟飞行控制；再点击 `ONLINE TRAIN` 会恢复 Fast Train 之前的在线权重、样本数和 loss，两套模型不会相互覆盖。
5. 可开启 `AUTO REVIVE`，让果蝇死亡后自动开始下一轮。
6. 使用 `EXPORT MODEL` 下载模型 JSON；使用 `IMPORT MODEL` 恢复模型。

多次快速训练会重新拟合读出权重并增加累计样本数。训练模型只允许微调管道中心附近的拍翅时机，不能覆盖“位于目标上方禁止拍翅”和“快速上升时禁止二次拍翅”的安全边界。

## URL 参数

- `?seed=12345`：设置可复现的随机种子。
- `?debug=1`：显示额外性能信息。

## 构建与测试

```powershell
npm run build
npm test
npm run preview
```

生产环境若返回 COOP/COEP 响应头，项目会使用 `SharedArrayBuffer` 共享神经活动；不满足条件时会自动退化为 Transferable Buffer，不影响主要功能。

## Connectome 数据

浏览器数据位于 `public/brain/`：

- `brain.json`：数据清单与规模信息。
- `meta.bin`：FLYM 格式神经元元数据。
- `weights.0.bin`、`weights.1.bin`：FLYW 格式压缩稀疏连接权重。
- `readout.json`：默认训练读出模型。

仓库包含可直接运行的官方浏览器导出数据。该导出使用 `sensory_input=False`：仅移除指向感觉神经元的传入边，感觉神经元的传出连接以及其余 Connectome 连接保持完整。

如需重新生成数据，可安装 fly.ai 并执行：

```powershell
python -m flybrain download
python -m flybrain export --web public/brain
```

## 项目结构

```text
src/
├─ brain/       Connectome 加载、神经仿真、训练与动作解码
├─ game/        Flappy Bird 物理、管道和碰撞逻辑
├─ renderer/    游戏画面与神经活动可视化
├─ experiment/  随机种子和实验成绩记录
└─ styles/      页面和训练界面样式
public/brain/   浏览器版 Connectome 数据与默认模型
```

## 数据与许可证说明

- MaleCNS v1.0 Connectome 数据采用 CC BY 4.0。
- fly.ai 源代码采用 MIT License。
- 本项目代码的许可状态以仓库中的 LICENSE 文件为准；当前未附加独立 LICENSE 文件。
