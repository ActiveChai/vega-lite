/**
 * 投影相关类型定义和属性配置
 * 此模块定义了Vega-Lite中用于地图投影的接口和常量
 */

// 从vega导入基础投影相关类型
import type {BaseProjection, SignalRef, Vector2} from 'vega';
// 导入表达式引用类型
import {ExprRef} from './expr.js';
// 导入映射工具类型和投影类型
import {MapExcludeValueRefAndReplaceSignalWith, ProjectionType} from './vega.schema.js';

/**
 * 投影配置接口，继承自Vega的基础投影并支持表达式引用或信号引用
 * @template ES - 表达式引用或信号引用类型
 */
export interface Projection<ES extends ExprRef | SignalRef>
  extends MapExcludeValueRefAndReplaceSignalWith<BaseProjection, ES> {
  /**
   * 要使用的地图投影类型。此值不区分大小写，例如`"albers"`和`"Albers"`表示相同的投影类型。您可以在[文档](https://vega.github.io/vega-lite/docs/projection.html#projection-types)中找到所有有效的投影类型。
   *
   * __默认值:__ `equalEarth`
   */
  type?: ProjectionType | ES; // 重新声明以覆盖文档

  /**
   * 投影的缩放（缩放）因子，覆盖自动适配。默认缩放因子因投影而异。缩放因子与投影点之间的距离呈线性对应关系；但是，不同投影之间的缩放因子值并不等效。
   */
  scale?: number | ES; // 重新声明以覆盖文档

  /**
   * 投影的平移偏移量，为两元素数组`[tx, ty]`。
   */
  translate?: Vector2<number> | ES; // TODO: 确定VL的默认值
}

/**
 * 投影配置类型，用于图表配置中的投影设置
 * 所有Projection接口的属性都可以在配置中使用
 */
export type ProjectionConfig = Projection<ExprRef>;

/**
 * 所有有效的投影属性列表
 * 这个常量定义了Vega-Lite中支持的所有投影相关属性
 */
export const PROJECTION_PROPERTIES: (keyof Projection<ExprRef>)[] = [
  'type', // 投影类型
  'clipAngle', // 裁剪角度
  'clipExtent', // 裁剪范围
  'center', // 中心点坐标
  'rotate', // 旋转角度
  'precision', // 精度设置
  'reflectX', // X轴反射
  'reflectY', // Y轴反射
  'coefficient', // 系数参数
  'distance', // 距离参数
  'fraction', // 分数参数
  'lobes', // 波瓣参数
  'parallel', // 平行线参数
  'radius', // 半径参数
  'ratio', // 比例参数
  'spacing', // 间距参数
  'tilt', // 倾斜参数
];
