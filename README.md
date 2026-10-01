# Interactive Word Cloud Lab

一个无需构建步骤的静态网页工具，用于编辑 word cloud 的布局。

在线使用：[https://sonia1maslova.github.io/interactive-wordcloud/](https://sonia1maslova.github.io/interactive-wordcloud/)

## 功能

- 粘贴或上传 JSON、TSV、CSV、TXT 格式的 word 数据
- 以权重/effect size 控制字号
- 椭圆、圆形、圆角矩形和六边形 mask
- 上传透明 PNG/SVG 作为自定义 mask
- 通过拖拽手动调整每个 word 的位置
- 分别调整底色、边缘色、word 颜色的透明度，以及基础字号和字号波动
- 内置形状和上传图片统一作为形状（mask），上传形状替代内置形状
- 可以分别隐藏画布底板、形状填充（内置或上传）和边缘，导出的 PNG 会保留透明通道
- 在同一个“导出”区域保存布局 JSON 或导出 PNG。文件名可以手动输入；留空时自动使用当前日期和时间
- 可以将当前布局和视觉参数保存为浏览器默认设置，也可以恢复内置默认设置
- 保存的布局 JSON 可以再次导入，并恢复形状、颜色、透明度、字号和 word 位置

## 输入格式

TSV 格式：

```text
word	weight
anxiety	1.0
fear	0.9
emotion	0.88
```

JSON 格式：

```json
[
  {"word": "anxiety", "weight": 1.0, "color": "#2a6f97"},
  {"word": "fear", "weight": 0.9, "color": "#4c9a62"}
]
```

## 本地运行

直接双击 `index.html` 即可使用。若浏览器限制本地文件下载或自定义 mask，可以在该目录启动任意静态文件服务器。

## GitHub Pages

这是纯静态文件，可以直接放入 GitHub 仓库根目录或 `docs/` 目录，并在仓库设置中启用 GitHub Pages。
