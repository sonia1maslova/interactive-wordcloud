# Interactive Word Cloud Lab

一个无需构建步骤的静态网页工具，用于编辑 word cloud 的布局。

在线使用：[https://sonia1maslova.github.io/interactive-wordcloud/](https://sonia1maslova.github.io/interactive-wordcloud/)

## 功能

- 粘贴或上传 JSON、TSV、CSV、TXT 格式的 word 数据
- 以权重/effect size 控制字号
- 椭圆、圆形、圆角矩形和六边形 mask
- 上传透明 PNG/SVG 作为自定义 mask
- 通过拖拽手动调整每个 word 的位置
- 分别调整底色、边缘色、word 颜色的不透明度，以及基础字号和字号波动
- 不透明度越高越不透明。百分比表示 alpha 权重，0% 为完全透明，100% 不再额外降低不透明度
- 形状填充的不透明度由填充色不透明度和形状整体不透明度相乘；边缘单独控制，内置形状保留边缘渐变。白色形状设为 60% 时，可将填充色不透明度设为 100%、形状整体不透明度设为 60%
- 内置形状和上传图片统一作为形状（mask），上传形状替代内置形状
- 可以分别隐藏画布底板、形状填充（内置或上传）和边缘，导出的 PNG 会保留透明通道
- 在同一个“导出”区域保存布局 JSON 或导出 PNG。文件名可以手动输入；留空时自动使用当前日期和时间
- 选择保存文件夹后，PNG 和布局 JSON 共用该文件夹。同名文件自动加编号，不覆盖已有文件
- 文件夹选择需浏览器支持 File System Access API，并由用户在系统弹窗中授权。仅用于本次页面，刷新后需重新选择，不在布局文件中保存目录权限
- 不支持文件夹选择时仍可普通下载，可使用浏览器的“下载前询问保存位置”设置。参见 [浏览器文件夹选择说明](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)
- 可以将当前布局和视觉参数保存为浏览器默认设置，也可以恢复内置默认设置
- 保存的布局 JSON 可以再次导入，并恢复形状、颜色、不透明度、字号和 word 位置。旧布局的 alpha/opacity 数值含义不变，可继续导入

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
