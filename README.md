# Interactive Term Cloud Lab

一个无需构建步骤的静态网页工具，用于编辑认知 term cloud 的布局。

## 功能

- 粘贴或上传 JSON、TSV、CSV、TXT 格式的 term 数据
- 以权重/effect size 控制字号
- 椭圆、圆形、圆角矩形和六边形 mask
- 上传透明 PNG/SVG 作为自定义 mask
- 通过拖拽手动调整每个 term 的位置
- 调整底色、边缘色、透明度、基础字号和字号波动
- 保存布局 JSON，导出 PNG
- 保存的布局 JSON 可以再次导入，并恢复形状、颜色、字号和 term 位置

## 输入格式

TSV 示例：

```text
word	weight
anxiety	1.0
fear	0.9
emotion	0.88
```

JSON 示例：

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
