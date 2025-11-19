import {GeoPointTransform as VgGeoPointTransform, Vector2} from 'vega';
import {isString} from 'vega-util';
import {GeoPositionChannel, LATITUDE, LATITUDE2, LONGITUDE, LONGITUDE2} from '../../channel.js';
import {getFieldOrDatumDef, isDatumDef, isFieldDef, isValueDef} from '../../channeldef.js';
import {duplicate, hash} from '../../util.js';
import {VgExprRef} from '../../vega.schema.js';
import {UnitModel} from '../unit.js';
import {DataFlowNode} from './dataflow.js';

/**
 * 地理点转换节点类
 * 负责将地理坐标（经纬度）通过投影转换为可视化坐标系中的点
 * 是数据处理流程中的关键组件
 */
export class GeoPointNode extends DataFlowNode {
  /**
   * 克隆当前地理点节点
   * @returns 新的GeoPointNode实例，复制了当前节点的所有属性
   */
  public clone() {
    return new GeoPointNode(null, this.projection, duplicate(this.fields), duplicate(this.as));
  }

  /**
   * 构造函数
   * @param parent 父数据流节点
   * @param projection 使用的投影名称
   * @param fields 坐标字段对（经度、纬度），可为字符串或表达式引用
   * @param as 输出字段名数组，分别对应转换后的x和y坐标
   */
  constructor(
    parent: DataFlowNode,
    private projection: string, // 投影名称
    private fields: [string | VgExprRef, string | VgExprRef], // 经纬度字段对
    private as: [string, string], // 输出字段名
  ) {
    super(parent);
  }

  /**
   * 解析模型中所有与地理点相关的数据，并创建相应的GeoPoint节点
   * @param parent 父数据流节点
   * @param model 单元模型实例
   * @returns 处理后的数据流节点
   */
  public static parseAll(parent: DataFlowNode, model: UnitModel): DataFlowNode {
    // 如果模型没有投影配置，则直接返回父节点
    if (!model.projectionName()) {
      return parent;
    }

    // 处理经纬度坐标对，包括主要坐标和次要坐标
    for (const coordinates of [
      [LONGITUDE, LATITUDE], // 主要坐标对
      [LONGITUDE2, LATITUDE2], // 次要坐标对（如用于端点）
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

      // 根据坐标类型确定后缀（主要坐标为空，次要坐标为"2"）
      const suffix = coordinates[0] === LONGITUDE2 ? '2' : '';

      // 如果坐标对中有至少一个有效字段，则创建GeoPoint节点
      if (pair[0] || pair[1]) {
        parent = new GeoPointNode(parent, model.projectionName(), pair, [
          model.getName(`x${suffix}`), // 生成x坐标输出字段名
          model.getName(`y${suffix}`), // 生成y坐标输出字段名
        ]);
      }
    }

    return parent;
  }

  /**
   * 获取当前节点依赖的字段集合
   * @returns 依赖字段的集合（仅包含字符串类型的字段）
   */
  public dependentFields() {
    return new Set(this.fields.filter(isString));
  }

  /**
   * 获取当前节点产生的字段集合
   * @returns 产生字段的集合（即输出的x和y坐标字段）
   */
  public producedFields() {
    return new Set(this.as);
  }

  /**
   * 生成当前节点的哈希值，用于唯一标识节点
   * @returns 节点的哈希字符串
   */
  public hash() {
    return `Geopoint ${this.projection} ${hash(this.fields)} ${hash(this.as)}`;
  }

  /**
   * 组装Vega地理点转换操作
   * @returns Vega地理点转换配置对象
   */
  public assemble(): VgGeoPointTransform {
    return {
      type: 'geopoint', // 转换类型为地理点
      projection: this.projection, // 指定使用的投影
      fields: this.fields, // 输入的经纬度字段
      as: this.as, // 输出的x和y坐标字段
    };
  }
}
