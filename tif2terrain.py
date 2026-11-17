import os
# 强制使用 rasterio 自带的 PROJ 库，避免调用系统里 PostgreSQL 的老版本
import rasterio
os.environ['PROJ_LIB'] = os.path.join(os.path.dirname(rasterio.__file__), 'proj_data')

import json
import numpy as np
from PIL import Image

def generate_terrain(tif_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    print("正在读取 TIF 文件...")
    with rasterio.open(tif_path) as src:
        bounds = src.bounds
        data = src.read(1)
        nodata = src.nodata
        
        # 因为我们的 TIF 已经是 WGS84 了，直接用原始坐标，不去转换
        # 强行修正经纬度（GEBCO 原始数据读取时负号丢失导致）
        west, south, east, north = 119.0, 32.0, 127.0, 40.0
        
        print(f"地理范围: {west}, {south}, {east}, {north}")
        
        if nodata is not None:
            data = np.where(data == nodata, 0, data)
        data = np.nan_to_num(data, nan=0.0)
        
        # 创建 Cesium 需要的 layer.json
        layer_json = {
            "tilejson": "2.1.0",
            "format": "heightmap-1.0",
            "version": "1.0.0",
            "scheme": "tms",
            "tiles": ["{z}/{x}/{y}.terrain"],
            "bounds": [west, south, east, north],
            "minzoom": 0,
            "maxzoom": 0
        }
        
        with open(os.path.join(output_dir, "layer.json"), "w") as f:
            json.dump(layer_json, f, indent=2)
            
        os.makedirs(os.path.join(output_dir, "0", "0"), exist_ok=True)
        
        # 归一化高程
        min_h, max_h = -255.0, 0.0
        heightmap = np.clip((data - min_h) / (max_h - min_h) * 255, 0, 255).astype(np.uint8)
        
        # 生成 65x65 瓦片
        img = Image.fromarray(heightmap)
        img = img.resize((65, 65), Image.BILINEAR)
        
        terrain_path = os.path.join(output_dir, "0", "0", "0.terrain")
        img.save(terrain_path, format="PNG")
        
        print(f"成功！瓦片已保存到: {output_dir}")

if __name__ == "__main__":
    tif_file = r"D:\1ziliao\dingban_yellow_sea\yellow_sea_bathymetry.tif"
    out_dir = r"E:\daima\bishe\YellowSea3D\data\terrain_tiles"
    
    generate_terrain(tif_file, out_dir)