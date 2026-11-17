<<<<<<< HEAD
# 基于 Cesium 的黄海海底地形三维可视化系统

## 项目简介
本项目为本科毕业设计。基于 GEBCO 海底地形数据，通过 Python 预处理与 CesiumLab 切片，在 Web 端使用 CesiumJS 构建了黄海全域海底三维地形可视化系统。

## 技术栈
- **数据预处理**：Python (xarray, rasterio)
- **地形切片**：CesiumLab (VCG 算法, Quantized-Mesh 格式)
- **前端渲染**：CesiumJS, HTML/CSS/JavaScript, GLSL 着色器
- **后端服务**：Python Flask / http.server

## 目录结构
- `frontend/`：前端代码（HTML, CSS, JS）
- `backend/`：Python 轻量级服务器代码
- `data/processed/`：处理好的干净 TIF 数据（如果不传大文件，可以写一句提示）

## ⚠️ 运行说明
由于地形瓦片（约 160MB）体积过大，未包含在本仓库中。
如需本地运行：
1. 请先使用 CesiumLab 将 `data/processed/yellow_sea_fixed.tif` 切为 `.terrain` 瓦片，放置在 `data/terrain_tiles/` 下。
2. 下载 Cesium 官方库，放置在 `frontend/libs/Cesium/` 下。
3. 运行 `python backend/server.py`，浏览器访问 `http://127.0.0.1:8001/`。
=======
# Cesium-3D-GIS
A 3D Earth demo built with Vue3 and Cesium.
>>>>>>> b746ba8f96dbcef728a8d75febee16bf67fc6741
