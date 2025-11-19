import {Transforms as VgTransform, Vector2} from 'vega';
import {isString} from 'vega-util';
import {GeoPositionChannel, LATITUDE, LATITUDE2, LONGITUDE, LONGITUDE2, SHAPE} from '../../channel.js';
import {getFieldOrDatumDef, isDatumDef, isFieldDef, isValueDef} from '../../channeldef.js';
import {GEOJSON} from '../../type.js';
import {duplicate, hash} from '../../util.js';
import {VgExprRef} from '../../vega.schema.js';
import {UnitModel} from '../unit.js';
import {DataFlowNode} from './dataflow.js';

/**
 * GeoJSON数据处理节点类
 * 负责将地理坐标数据或GeoJSON格式数据转换为可视化可用的地理数据
 * 是数据处理流程中的一个重要节点
 */
export class GeoJSONNode extends DataFlowNode {
  /**
   * 克隆当前GeoJSON节点
   * @returns 新的GeoJSONNode实例，复制了当前节点的所有属性
   */
  public clone() {
    return new GeoJSONNode(null, duplicate(this.fields), this.geojson, this.signal);
  }

  /**
   * 解析模型中所有与地理相关的数据，并创建相应的GeoJSON节点
   * @param parent 父数据流节点
   * @param model 单元模型实例
   * @returns 处理后的数据流节点
   */
  public static parseAll(parent: DataFlowNode, model: UnitModel): DataFlowNode {
    // 如果投影不需要适配数据，则直接返回父节点
    if (model.component.projection && !model.component.projection.isFit) {
      return parent;
    }

    // 用于生成唯一的GeoJSON信号名称计数器
    let geoJsonCounter = 0;

    // 处理经纬度坐标对，包括主要坐标和次要坐标
    for (const coordinates of [
      [LONGITUDE, LATITUDE],
      [LONGITUDE2, LATITUDE2],
    ] as Vector2<GeoPositionChannel>[]) {
      // 处理每个坐标通道，获取字段定义或表达式
      const pair = coordinates.map((channel) => {
        const def = getFieldOrDatumDef(model.encoding[channel]);
        return isFieldDef(def)
          ? def.field // 如果是字段定义，使用字段名
          : isDatumDef(def)
            ? {expr: `${def.datum}`} // 如果是数据值定义，创建表达式引用
            : isValueDef(def)
              ? {expr: `${def['value']}`} // 如果是常量值定义，创建表达式引用
              : undefined;
      }) as [GeoPositionChannel, GeoPositionChannel];

      // 如果坐标对中有至少一个有效字段，则创建GeoJSON节点
      if (pair[0] || pair[1]) {
        parent = new GeoJSONNode(parent, pair, null, model.getName(`geojson_${geoJsonCounter++}`));
      }
    }

    // 检查SHAPE通道是否使用了GeoJSON类型的数据
    if (model.channelHasField(SHAPE)) {
      const fieldDef = model.typedFieldDef(SHAPE);
      if (fieldDef.type === GEOJSON) {
        parent = new GeoJSONNode(parent, null, fieldDef.field, model.getName(`geojson_${geoJsonCounter++}`));
      }
    }

    return parent;
  }

  /**
   * 构造函数
   * @param parent 父数据流节点
   * @param fields 坐标字段对（经纬度），可为字符串或表达式引用
   * @param geojson GeoJSON字段名称
   * @param signal 输出信号名称
   */
  constructor(
    parent: DataFlowNode,
    private fields?: Vector2<string | VgExprRef>, // 坐标字段对
    private geojson?: string, // GeoJSON字段名
    private signal?: string, // 输出信号名
  ) {
    super(parent);
  }

  /**
   * 获取当前节点依赖的字段集合
   * @returns 依赖字段的集合
   */
  public dependentFields() {
    // 提取所有字符串类型的字段
    const fields = (this.fields ?? []).filter(isString) as string[];
    // 合并GeoJSON字段和坐标字段
    return new Set([...(this.geojson ? [this.geojson] : []), ...fields]);
  }

  /**
   * 获取当前节点产生的字段集合
   * @returns 产生字段的集合（此节点不直接产生新字段）
   */
  public producedFields() {
    return new Set<string>();
  }

  /**
   * 生成当前节点的哈希值，用于唯一标识节点
   * @returns 节点的哈希字符串
   */
  public hash() {
    return `GeoJSON ${this.geojson} ${this.signal} ${hash(this.fields)}`;
  }

  /**
   * 组装Vega转换操作数组
   * @returns Vega转换操作数组
   */
  public assemble(): VgTransform[] {
    return [
      // 如果存在GeoJSON字段，添加过滤器确保GeoJSON数据有效
      ...(this.geojson
        ? [
          {
            type: 'filter',
            expr: `isValid(datum["${this.geojson}"])`, // 过滤出有效的GeoJSON数据
          } as const,
        ]
        : []),
      // 添加GeoJSON转换操作
      {
        type: 'geojson',
        ...(this.fields ? {fields: this.fields} : {}), // 添加坐标字段（如果有）
        ...(this.geojson ? {geojson: this.geojson} : {}), // 添加GeoJSON字段（如果有）
        signal: this.signal, // 指定输出信号名
      },
    ];
  }
}
