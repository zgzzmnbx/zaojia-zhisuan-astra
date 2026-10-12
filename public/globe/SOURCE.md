# 项目鸟瞰地图资产

- 渲染：本项目 MapLibre GL JS 6.4.1，BSD-3-Clause。仅按需加载，不使用远程瓦片或用户定位。
- 海陆、湖泊、河流：Natural Earth（公共领域）；原始文件来自 https://github.com/nvkelso/natural-earth-vector/tree/master/geojson ，文件为 ne_50m_land.geojson、ne_110m_lakes.geojson、ne_110m_rivers_lake_centerlines.geojson。
- 省界：直接引用 `/map/provinces-test.json`，34 个省级多边形与 8 个参考线要素；原始来源、许可和哈希见 `/map/SOURCE.md`。仅为测试几何，不是正式制图成果。
- 卫星：EOX Sentinel-2 cloudless **2016**，CC BY 4.0（含经修改的 Copernicus Sentinel 2016、2017 数据）；本地存储 z0–3 共 85 张瓦片。源为 `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg`。显示时调节饱和度、亮度，原始瓦片未编辑。不能代表当前影像，最大显示级别 4，不提供街道级细节。
- 瓦片总大小及逐文件 SHA256 见 `manifest.json`；可见来源入口为 `attribution.html`。
- 数据与全国项目共享，演示项目/真实项目分开。只绘制可用的已确认 WGS84 地点；未定位项目保留人工复核入口。区域是代表点，廊道是地点关系，均不推断实际工程边界。
