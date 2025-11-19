import {Projection as VgProjection, SignalRef} from 'vega';
import {Projection} from '../../projection.js';
import {Split} from '../split.js';

/**
 * 投影组件类，继承自 Split 类，用于管理可视化中的地理投影信息
 * 负责处理投影的显式和隐式属性，并提供投影相关的工具方法
 */
export class ProjectionComponent extends Split<VgProjection> {
  /**
   * 标记投影是否已合并
   */
  public merged = false;

  /**
   * 构造函数，初始化投影组件
   * @param name 投影的名称
   * @param specifiedProjection 用户指定的投影配置
   * @param size 投影的尺寸信号引用数组
   * @param data 投影使用的数据源引用数组（字符串或信号引用）
   */
  constructor(
    name: string,
    public specifiedProjection: Projection<SignalRef>,
    public size: SignalRef[],
    public data: (string | SignalRef)[],
  ) {
    super(
      {...specifiedProjection}, // 投影的所有显式属性
      {name}, // 名称作为初始隐式属性
    );
  }

  /**
   * 判断投影参数是否应该适配提供的数据
   * @returns 如果存在数据则返回 true，否则返回 false
   */
  public get isFit() {
    return !!this.data;
  }
}
