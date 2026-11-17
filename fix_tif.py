import os
import rasterio
os.environ['PROJ_LIB'] = os.path.join(os.path.dirname(rasterio.__file__), 'proj_data')

from rasterio.transform import from_origin
import numpy as np

input_tif = r"D:\1ziliao\dingban_yellow_sea\yellow_sea_bathymetry.tif"
output_tif = r"E:\daima\bishe\YellowSea3D\data\processed\yellow_sea_fixed.tif"

print("正在修复数据...")
with rasterio.open(input_tif) as src:
    data = src.read(1)
    
    # 1. 上下翻转数组，把颠倒的数据正过来
    data = np.flipud(data)
    
    # 2. 强制重置地理变换参数（锁定在黄海真实范围 119~127, 32~40）
    # 这里的 0.0041667 就是标准的 15 弧秒分辨率
    res = 0.004166666666666667
    transform = from_origin(119.0, 40.0, res, res)
    
    # 3. 把陆地（>0）和异常值全部设为 NaN
    data = np.where(data > 0, np.nan, data)
    
    # 4. 强制把数组大小裁剪/重采样到与 transform 匹配的尺寸
    # 黄海跨度 8度 / 0.0041667 ≈ 1920 像素
    target_shape = (int(8 / res), int(8 / res))
    
    # 简单粗暴地重置数组大小（如果原数组大小不对，用最近的填充）
    if data.shape != target_shape:
        print(f"调整数组大小: {data.shape} -> {target_shape}")
        from PIL import Image
        img = Image.fromarray(data)
        img = img.resize((target_shape[1], target_shape[0]), Image.BILINEAR)
        data = np.array(img)

    # 5. 保存修正后的文件
    os.makedirs(os.path.dirname(output_tif), exist_ok=True)
    with rasterio.open(
        output_tif, 'w',
        driver='GTiff', height=data.shape[0], width=data.shape[1],
        count=1, dtype='float32', crs='EPSG:4326', transform=transform,
        nodata=np.nan
    ) as dst:
        dst.write(data, 1)

print(f"✅ 修复完成！新文件在: {output_tif}")