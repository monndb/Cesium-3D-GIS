import rasterio

tif_path = r"D:\1ziliao\dingban_yellow_sea\yellow_sea_bathymetry.tif"

print("正在读取 TIF 文件...")
with rasterio.open(tif_path) as ds:
    print("地理范围 (bounds):", ds.bounds)
    print("仿射变换 (transform):\n", ds.transform)
    print("像素大小 (res):", ds.res)