import type {SignalRef} from 'vega';
import {hasOwnProperty} from 'vega-util';
import {LATITUDE, LATITUDE2, LONGITUDE, LONGITUDE2, SHAPE} from '../../channel.js';
import {getFieldOrDatumDef} from '../../channeldef.js';
import {DataSourceType} from '../../data.js';
import {replaceExprRef} from '../../expr.js';
import {PROJECTION_PROPERTIES} from '../../projection.js';
import {GEOJSON} from '../../type.js';
import {deepEqual, duplicate, every} from '../../util.js';
import {isUnitModel, Model} from '../model.js';
import {UnitModel} from '../unit.js';
import {ProjectionComponent} from './component.js';

/**
 * 解析模型中的投影配置，根据模型类型选择相应的解析方法
 * @param model 要解析的可视化模型
 */
export function parseProjection(model: Model) {
  // 根据模型类型选择合适的投影解析方法
  model.component.projection = isUnitModel(model) ? parseUnitProjection(model) : parseNonUnitProjections(model);
}

/**
 * 解析单元模型中的投影配置
 * @param model 单元可视化模型
 * @returns 解析后的投影组件，如果没有投影配置则返回undefined
 */
function parseUnitProjection(model: UnitModel): ProjectionComponent {
  // 检查模型是否定义了投影
  if (model.hasProjection) {
    // 替换投影定义中的表达式引用
    const proj = replaceExprRef(model.specifiedProjection);
    // 判断是否需要自适应调整投影（当没有指定scale或translate属性时）
    const fit = !(proj && (proj.scale != null || proj.translate != null));
    // 如果需要自适应，则获取尺寸信号引用
    const size = fit ? [model.getSizeSignalRef('width'), model.getSizeSignalRef('height')] : undefined;
    // 如果需要自适应，则收集用于适配的数据
    const data = fit ? gatherFitData(model) : undefined;

    // 创建投影组件实例
    const projComp = new ProjectionComponent(
      model.projectionName(true),
      {
        // 合并配置中的投影和用户指定的投影
        ...replaceExprRef(model.config.projection),
        ...proj,
      },
      size,
      data,
    );

    // 如果未指定投影类型，则默认使用equalEarth投影
    if (!projComp.get('type')) {
      projComp.set('type', 'equalEarth', false);
    }

    return projComp;
  }

  return undefined;
}

/**
 * 收集用于投影适配的数据引用
 * @param model 单元可视化模型
 * @returns 数据引用数组（信号引用或数据源名称）
 */
function gatherFitData(model: UnitModel) {
  const data: (SignalRef | string)[] = [];

  const {encoding} = model;

  // 检查经纬度字段对，收集相关的GeoJSON数据引用
  for (const posssiblePair of [
    [LONGITUDE, LATITUDE],
    [LONGITUDE2, LATITUDE2],
  ]) {
    if (getFieldOrDatumDef(encoding[posssiblePair[0]]) || getFieldOrDatumDef(encoding[posssiblePair[1]])) {
      data.push({
        signal: model.getName(`geojson_${data.length}`),
      });
    }
  }

  // 检查SHAPE通道是否使用了GeoJSON类型的数据
  if (model.channelHasField(SHAPE) && model.typedFieldDef(SHAPE).type === GEOJSON) {
    data.push({
      signal: model.getName(`geojson_${data.length}`),
    });
  }

  // 如果没有找到特定的地理数据引用，则使用主数据源
  if (data.length === 0) {
    // 主数据源是GeoJSON，我们可以直接使用它
    data.push(model.requestDataName(DataSourceType.Main));
  }

  return data;
}

/**
 * 在没有冲突的情况下合并两个投影组件
 * @param first 第一个投影组件
 * @param second 第二个投影组件
 * @returns 合并后的投影组件，如果有冲突则返回null
 */
function mergeIfNoConflict(first: ProjectionComponent, second: ProjectionComponent): ProjectionComponent {
  // 检查所有投影属性是否兼容
  const allPropertiesShared = every(PROJECTION_PROPERTIES, (prop) => {
    // 两个投影都没有该属性
    if (!hasOwnProperty(first.explicit, prop) && !hasOwnProperty(second.explicit, prop)) {
      return true;
    }
    // 两个投影都有该属性且值相等
    if (
      hasOwnProperty(first.explicit, prop) &&
      hasOwnProperty(second.explicit, prop) &&
      // 某些属性可能是信号或对象，需要深度比较
      deepEqual(first.get(prop), second.get(prop))
    ) {
      return true;
    }
    return false;
  });

  // 检查尺寸是否相同
  const size = deepEqual(first.size, second.size);
  if (size) {
    if (allPropertiesShared) {
      return first;
    } else if (deepEqual(first.explicit, {})) {
      // 如果第一个投影没有显式属性，使用第二个
      return second;
    } else if (deepEqual(second.explicit, {})) {
      // 如果第二个投影没有显式属性，使用第一个
      return first;
    }
  }

  // 如果所有属性不匹配，则让每个单元规范使用自己的投影
  return null;
}

/**
 * 解析非单元模型（如层级模型）中的投影配置
 * 尝试合并所有子模型的投影配置
 * @param model 非单元可视化模型
 * @returns 合并后的投影组件，如果无法合并则返回undefined
 */
function parseNonUnitProjections(model: Model): ProjectionComponent {
  // 如果没有子模型，返回undefined
  if (model.children.length === 0) {
    return undefined;
  }

  let nonUnitProjection: ProjectionComponent;

  // 首先解析所有子模型
  for (const child of model.children) {
    parseProjection(child);
  }

  // 分析解析后的投影，尝试合并
  const mergable = every(model.children, (child) => {
    const projection = child.component.projection;
    if (!projection) {
      // 子图层不使用投影
      return true;
    } else if (!nonUnitProjection) {
      // 缓存的投影为空，缓存当前投影
      nonUnitProjection = projection;
      return true;
    } else {
      // 尝试合并当前子模型的投影与缓存的投影
      const merge = mergeIfNoConflict(nonUnitProjection, projection);
      if (merge) {
        nonUnitProjection = merge;
      }
      return !!merge;
    }
  });

  // 如果有缓存的投影且所有子模型的投影都兼容可合并
  if (nonUnitProjection && mergable) {
    // 将投影提升到层级模型级别
    const name = model.projectionName(true);
    const modelProjection = new ProjectionComponent(
      name,
      nonUnitProjection.specifiedProjection,
      nonUnitProjection.size,
      duplicate(nonUnitProjection.data),
    );

    // 重命名并标记所有子模型的投影为已合并
    for (const child of model.children) {
      const projection = child.component.projection;
      if (projection) {
        if (projection.isFit) {
          // 合并所有需要适配的数据
          modelProjection.data.push(...child.component.projection.data);
        }
        // 重命名子模型中的投影引用
        child.renameProjection(projection.get('name'), name);
        // 标记投影已被合并
        projection.merged = true;
      }
    }

    return modelProjection;
  }

  return undefined;
}
