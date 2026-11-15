# Astra 字体接入

上游 CSS 引用以下三份字体，但它们没有提交到 GitHub，当前工作区也没有可复制的原文件：

- `pingfang-sc-regular.woff2`，400。
- `pingfang-sc-medium.woff2`，500。
- `pingfang-sc-semibold.woff2`，600–800。

默认入口保留上游字体栈，并优先调用本机已安装的 PingFang。Mac 上有对应字体时可使用；其他机器按原栈回退到 Microsoft YaHei UI / sans-serif。回退不等于原字体逐字度量一致。

如果从用户已有 Astra 运行目录取得上述原字体，把文件放在本目录，再在 `astra-ui.css` 之后加载 `fonts.original.optional.css`，即可启用同一字体文件。字体文件来源、SHA256及使用范围应随该次更新记录；本包没有重新下载或用另一款字体冒充它们。
