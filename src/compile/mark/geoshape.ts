import {GeoShapeTransform as VgGeoShapeTransform} from 'vega';
import {isFieldDef, vgField} from '../../channeldef.js';
import {GEOJSON} from '../../type.js';
import {VgPostEncodingTransform} from '../../vega.schema.js';
import {UnitModel} from '../unit.js';
import {MarkCompiler} from './base.js';
import * as encode from './encode/index.js';

/**
 * 地理形状(geoshape)标记的编译器
 * 负责将Vega-Lite中的地理形状标记转换为Vega的形状标记和地理形状转换
 */
export const geoshape: MarkCompiler = {
  // 指定对应的Vega标记类型为'shape'
  vgMark: 'shape',

  /**
   * 生成地理形状标记的编码条目
   * @param model 单元模型实例
   * @returns 编码条目对象
   */
  encodeEntry: (model: UnitModel) => {
    return {
      ...encode.baseEncodeEntry(model, {
        // 配置基础编码项，指定哪些属性需要包含或忽略
        align: 'ignore', // 忽略对齐属性
        baseline: 'ignore', // 忽略基线属性
        color: 'include', // 包含颜色属性
        size: 'ignore', // 忽略大小属性
        orient: 'ignore', // 忽略方向属性
        theta: 'ignore', // 忽略极角属性
      }),
    };
  },

  /**
   * 生成编码后的转换操作，主要用于地理数据处理
   * @param model 单元模型实例
   * @returns 编码后转换操作数组
   */
  postEncodingTransform: (model: UnitModel): VgPostEncodingTransform[] => {
    const {encoding} = model;
    const shapeDef = encoding.shape;

    // 创建地理形状转换配置
    const transform: VgGeoShapeTransform = {
      type: 'geoshape', // 转换类型为地理形状
      projection: model.projectionName(), // 设置使用的投影名称
      // as: 'shape',  // 注释掉的行，默认输出字段为'shape'

      // 如果shape通道使用了字段定义且类型为GEOJSON，则添加field属性
      ...(shapeDef && isFieldDef(shapeDef) && shapeDef.type === GEOJSON
        ? {field: vgField(shapeDef, {expr: 'datum'})} // 使用数据字段中的GeoJSON数据
        : {}),
    };

    // 返回包含地理形状转换的数组
    return [transform];
  },
};
