# 🎵 AnySound

> 一个简洁优雅的在线音乐播放器，支持多平台聚合搜索与播放。

## ✨ 特性

- **多平台聚合搜索** — 支持网易云音乐、酷我/酷狗双平台，一键聚合搜索结果
- **热歌榜 & 排行榜** — 实时获取网易云热歌榜及各类排行榜
- **高品质播放** — 支持多音质切换（标准/较高/极高/无损）
- **歌单管理** — 创建、编辑、导入导出本地歌单
- **收藏 & 历史** — 收藏喜爱的歌曲，记录播放历史
- **PWA 支持** — 可安装为桌面应用，支持离线使用
- **响应式设计** — 完美适配 PC、平板和手机
- **液态玻璃主题** — 精美的磨砂玻璃 UI 效果

## 🚀 在线体验

👉 [点击体验 AnySound](https://anysound.netlify.app)

## 📱 App 下载

Android 用户可下载独立 APK 安装包，体验原生应用般的流畅体验。

## 🛠 技术栈

- **前端**: 原生 HTML/CSS/JavaScript（无框架依赖）
- **部署**: Netlify（静态站点 + Serverless Functions）
- **PWA**: Service Worker 离线缓存
- **API**: 网易云音乐 API / 酷我音乐 API

## 📂 项目结构

```
anysound/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── script.js       # 核心逻辑
│   └── liquid-glass.js # 液态玻璃主题
├── sw.js               # Service Worker
├── manifest.json       # PWA 清单
├── netlify/
│   └── functions/      # Netlify Serverless 函数
├── Fonts/              # 字体文件
└── version.json        # 版本信息
```

## 🔧 本地运行

1. 克隆仓库
```bash
git clone https://github.com/xiaohu856/Anysound.git
```

2. 使用任意静态服务器运行（如 VS Code Live Server、Python http.server 等）
```bash
cd Anysound
python -m http.server 8000
```

3. 浏览器打开 `http://localhost:8000`

## 📄 许可证

本项目仅供学习交流使用，请勿用于商业用途。音乐资源版权归各平台所有。

---

**Made with ❤️ | AnySound**