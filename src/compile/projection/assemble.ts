/*
 * 地理投影组装相关函数
 * 负责将Vega-Lite的投影配置转换为Vega的投影规格
 */

import {Projection as VgProjection, SignalRef} from 'vega';
import {contains} from '../../util.js';
import {isSignalRef} from '../../vega.schema.js';
import {isConcatModel, isLayerModel, Model} from '../model.js';

/**
 * 根据模型类型组装投影配置
 * @param model Vega-Lite模型实例
 * @returns 组装好的Vega投影配置数组
 */
export function assembleProjections(model: Model): VgProjection[] {
  // 根据模型类型选择不同的组装策略
  if (isLayerModel(model) || isConcatModel(model)) {
    // 对于图层模型或连接模型，需要处理模型及其子模型
    return assembleProjectionsForModelAndChildren(model);
  } else {
    // 对于其他类型的模型，只处理单个模型
    return assembleProjectionForModel(model);
  }
}

/**
 * 组装模型及其所有子模型的投影配置
 * @param model 父模型实例
 * @returns 组装好的所有投影配置数组
 */
export function assembleProjectionsForModelAndChildren(model: Model): VgProjection[] {
  // 先组装当前模型的投影，然后递归组装所有子模型的投影
  return model.children.reduce((projections, child) => {
    return projections.concat(child.assembleProjections());
  }, assembleProjectionForModel(model));
}

/**
 * 为单个模型组装投影配置
 * @param model 模型实例
 * @returns 组装好的投影配置数组
 */
export function assembleProjectionForModel(model: Model): VgProjection[] {
  // 获取模型的投影组件
  const component = model.component.projection;
  // 如果没有投影组件或投影已合并，则返回空数组
  if (!component || component.merged) {
    return [];
  }

  // 合并所有投影配置
  const projection = component.combine();
  // 提取投影名称以确保它始终存在于输出中并通过TS类型验证
  const {name} = projection;

  if (!component.data) {
    // 生成自定义投影，不自动适配
    return [
      {
        name,
        // 默认平移到中心
        translate: {signal: '[width / 2, height / 2]'},
        // 参数，如果指定了translate则覆盖默认值
        ...projection,
      },
    ];
  } else {
    // 生成使用范围适配的投影
    const size: SignalRef = {
      signal: `[${component.size.map((ref) => ref.signal).join(', ')}]`,
    };

    // 构建数据源适配列表，确保每个数据源只出现一次
    const fits: string[] = component.data.reduce((sources, data) => {
      // 确定数据源引用方式
      const source: string = isSignalRef(data) ? data.signal : `data('${model.lookupDataSource(data)}')`;
      if (!contains(sources, source)) {
        // 构建唯一的数据源列表
        sources.push(source);
      }
      return sources;
    }, []);

    // 验证是否有有效的数据源
    if (fits.length <= 0) {
      throw new Error('投影的适配没有找到任何数据源');
    }

    return [
      {
        name,
        size,
        fit: {
          // 如果有多个数据源，将它们组合成数组形式
          signal: fits.length > 1 ? `[${fits.join(', ')}]` : fits[0],
        },
        // 合并其他投影配置
        ...projection,
      },
    ];
  }
}
