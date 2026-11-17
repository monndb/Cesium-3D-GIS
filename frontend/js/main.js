/**
 * 黄海海底地形三维可视化系统 —— 前端入口
 *
 *  1. 加载本地 Quantized-Mesh 地形瓦片（CesiumLab 输出）
 *  2. 水深设色：连续色带 + 法线晕渲 + 水体衰减（替代原来的 4 段硬色阶）
 *  3. 半透明海面：Primitive + 菲涅尔，depthMask 关闭，避免与地形共面闪烁
 *  4. 相机：按包围球取景，目标始终居中
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 参数

  var REGION = { west: 119.0, south: 32.0, east: 127.0, north: 40.0 };

  var CONFIG = {
    maxDepth: 90.0,           // 色带映射的水深上限（黄海最深约 80 m，压到 90 更有层次）
    exaggeration: 12.0,       // 垂直夸张
    maxScreenSpaceError: 3.0, // 调大一些，减少 LOD 频繁切换造成的接缝
    seaLevel: 0.0,
    waterSurfaceHeight: 2.0,  // 海面抬高 2 m，避开与 0 m 地形共面
    colors: ['#6cc4da', '#4aa8c8', '#2f8bb2', '#1f6c97', '#154b74', '#0b2d52'],
    waterColor: '#0e4a75',
    waterDensity: 0.002
  };

  // ---------------------------------------------------------------- 1. 查看器

  var viewer = new Cesium.Viewer('cesiumContainer', {
    baseLayer: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false
  });

  window.viewer = viewer;

  var scene = viewer.scene;
  var globe = scene.globe;

  globe.baseColor = Cesium.Color.fromCssColorString('#0b2239');
  globe.depthTestAgainstTerrain = true;
  globe.maximumScreenSpaceError = CONFIG.maxScreenSpaceError;
  // 自己算光照，交给材质控制，避免和 Cesium 原生光照叠加变暗
  globe.enableLighting = false;

  // ---------------------------------------------------------------- 2. 水深材质

  globe.material = new Cesium.Material({
    fabric: {
      type: 'YellowSeaBathymetry',
      uniforms: {
        c0: Cesium.Color.fromCssColorString(CONFIG.colors[0]),
        c1: Cesium.Color.fromCssColorString(CONFIG.colors[1]),
        c2: Cesium.Color.fromCssColorString(CONFIG.colors[2]),
        c3: Cesium.Color.fromCssColorString(CONFIG.colors[3]),
        c4: Cesium.Color.fromCssColorString(CONFIG.colors[4]),
        c5: Cesium.Color.fromCssColorString(CONFIG.colors[5]),
        maxDepth: CONFIG.maxDepth,
        exaggeration: CONFIG.exaggeration,
        waterColor: Cesium.Color.fromCssColorString(CONFIG.waterColor),
        waterDensity: CONFIG.waterDensity
      },
      source: [
        'uniform vec4 c0;',
        'uniform vec4 c1;',
        'uniform vec4 c2;',
        'uniform vec4 c3;',
        'uniform vec4 c4;',
        'uniform vec4 c5;',
        'uniform float maxDepth;',
        'uniform float exaggeration;',
        'uniform vec4 waterColor;',
        'uniform float waterDensity;',
        '',
        'czm_material czm_getMaterial(czm_materialInput materialInput) {',
        '    czm_material m = czm_getDefaultMaterial(materialInput);',
        '',
        '    // 数据区之外没有地形瓦片，高程恒为 0：alpha 置 0 让它透出地球底色',
        '    if (materialInput.height > -0.5) {',
        '        m.diffuse = vec3(0.0);',
        '        m.alpha = 0.0;',
        '        return m;',
        '    }',
        '',
        '    float depth = max(0.0, -materialInput.height);',
        '',
        '    // 连续色带：5 段线性插值；pow 稍微拉开浅水段的层次',
        '    float t = pow(clamp(depth / maxDepth, 0.0, 1.0), 0.8) * 5.0;',
        '    vec3 color = mix(c0.rgb, c1.rgb, clamp(t, 0.0, 1.0));',
        '    color = mix(color, c2.rgb, clamp(t - 1.0, 0.0, 1.0));',
        '    color = mix(color, c3.rgb, clamp(t - 2.0, 0.0, 1.0));',
        '    color = mix(color, c4.rgb, clamp(t - 3.0, 0.0, 1.0));',
        '    color = mix(color, c5.rgb, clamp(t - 4.0, 0.0, 1.0));',
        '',
        '    // 法线晕渲：ENU 西北 45 度光源，绕开 czm_lightDirectionEC',
        '    vec3 n = materialInput.normalEC;',
        '    float nl = length(n);',
        '    n = nl > 1e-4 ? n / nl : vec3(0.0, 0.0, 1.0);',
        '',
        '    // 夸张后几何坡度变陡、但瓦片法线没变，这里按夸张系数补偿',
        '    vec3 nENU = normalize(transpose(materialInput.tangentToEyeMatrix) * n);',
        '    nENU = normalize(vec3(nENU.x * exaggeration, nENU.y * exaggeration, nENU.z));',
        '    n = normalize(materialInput.tangentToEyeMatrix * nENU);',
        '',
        '    vec3 lightEC = normalize(materialInput.tangentToEyeMatrix * normalize(vec3(-0.6, 0.5, 0.38)));',
        '    float ndl = clamp(dot(n, lightEC), 0.0, 1.0);',
        '    color *= 0.32 + 0.68 * ndl;',
        '',
        '    // 水体衰减：越深越偏水色',
        '    color = mix(color, waterColor.rgb, 1.0 - exp(-waterDensity * depth));',
        '',
        '    m.diffuse = color;',
        '    m.alpha = 1.0;',
        '    return m;',
        '}'
      ].join('\n')
    }
  });

  // ---------------------------------------------------------------- 3. 海面

  // Entity 只是 Primitive 的包装，控制不了 renderState；
  // 用 Primitive + MaterialAppearance 才能关掉 depthMask，避免深度冲突。
  scene.primitives.add(new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.RectangleGeometry({
        rectangle: Cesium.Rectangle.fromDegrees(REGION.west, REGION.south, REGION.east, REGION.north),
        height: CONFIG.waterSurfaceHeight,
        vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat
      })
    }),
    appearance: new Cesium.MaterialAppearance({
      translucent: true,
      closed: false,
      material: new Cesium.Material({
        fabric: {
          type: 'YellowSeaSurface',
          uniforms: {
            waterColor: Cesium.Color.fromCssColorString(CONFIG.waterColor),
            alphaNear: 0.045,
            alphaFar: 0.22
          },
          source: [
            'uniform vec4 waterColor;',
            'uniform float alphaNear;',
            'uniform float alphaFar;',
            'czm_material czm_getMaterial(czm_materialInput materialInput) {',
            '    czm_material m = czm_getDefaultMaterial(materialInput);',
            '    vec3 n = normalize(materialInput.normalEC);',
            '    vec3 v = normalize(materialInput.positionToEyeEC);',
            '    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);',
            '    m.diffuse = waterColor.rgb;',
            '    m.alpha = mix(alphaNear, alphaFar, fres);',
            '    m.specular = 0.2;',
            '    m.shininess = 64.0;',
            '    return m;',
            '}'
          ].join('\n')
        }
      }),
      renderState: {
        depthMask: false,
        cull: { enabled: false }
      }
    }),
    asynchronous: false
  }));

  // ---------------------------------------------------------------- 4. 地形瓦片

  // 先确认 layer.json 存在再挂载提供者：瓦片缺失时 Cesium 仍会创建提供者，
  // 结果是没有可渲染的瓦片、整屏只剩星空。
  fetch('data/terrain_tiles/layer.json')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('layer.json HTTP ' + response.status);
      }
      return Cesium.CesiumTerrainProvider.fromUrl('data/terrain_tiles/', {
        requestVertexNormals: true,
        requestWaterMask: false
      });
    })
    .then(function (provider) {
      scene.terrainProvider = provider;
      globe.terrainExaggeration = CONFIG.exaggeration;
      globe.terrainExaggerationRelativeHeight = CONFIG.seaLevel;
    })
    .catch(function (error) {
      console.warn('未加载地形瓦片，按椭球面显示：', error.message);
    });

  // ---------------------------------------------------------------- 5. 相机

  // 用包围球取景：目标始终在屏幕中心。
  // 直接用 flyTo 的 destination + pitch 会把屏幕中心推到目标以北几百公里。
  // -60 度 / 900 km：能看全海域，视口上沿(30 度)又高于地平线俯角(约 28 度)，不会露出地球弧线。
  var rect = Cesium.Rectangle.fromDegrees(REGION.west, REGION.south, REGION.east, REGION.north);
  var sphere = Cesium.BoundingSphere.fromRectangle3D(rect, Cesium.Ellipsoid.WGS84, -1500);

  viewer.camera.flyToBoundingSphere(sphere, {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(0),
      Cesium.Math.toRadians(-60),
      700000
    ),
    duration: 3
  });
})();
