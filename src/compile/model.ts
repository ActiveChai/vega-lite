// 模型相关抽象类和接口定义
// 该文件定义了Vega-Lite编译过程中的核心模型类，包括基础Model类和支持字段操作的ModelWithField类

import {Channel, ExtendedChannel, ScaleChannel, SingleDefChannel} from '../../channel';
import {ChannelDef, FieldDef, getFieldDef} from '../../channeldef';
import {DataComponent, DataSourceType, OutputNodeRefCounts, OutputNodes} from './data/component';
import {LayoutComponent} from './layout/component';
import {MarkComponent} from './mark/component';
import {ScaleComponent} from './scale/component';
import {SelectionComponent} from './selection/component';
import {AxisComponent, LegendComponent} from './axis/legend';
import {ProjectionComponent} from './projection/component';
import {TitleParams} from '../../spec/title';
import {AggregateOp} from '../../aggregate';
import {TopLevelProperties} from '../../spec/toplevel';
import {LayoutSizeType, getPositionScaleChannel, getSizeTypeFromLayoutSizeType} from '../../spec/layout';
import {isArray, isEmpty} from '../../util';
import {VGEncodeEntry, VgMarkGroup, VgTitle, Signal, SignalRef} from '../../vega.schema';
import {extractTitleConfig} from '../config';
import {contains} from '../../util';
import {assembleScales} from '../scale/assemble';
import {hasDiscreteDomain} from '../scale/util';
import {getFieldFromDomain} from '../scale/domain';
import {isFacetModel, isLayerModel, isUnitModel, ModelType} from '../model';
import {assembleDomain} from '../scale/domain';
import {sizeExpr} from '../scale/range';
import {vgField} from '../encode/field';
import {varName} from '../var';
import {log} from '../../log';
import {VgRangeStep} from '../../vega.schema';
import {AnchorValue} from '../../spec';
import {rename, forEach, reduce} from '../../util/object';
import {axis} from '../axis';

/**
 * 名称映射类 - 用于存储和管理各种名称的映射关系
 */
export class NameMap {
  private readonly map: Record<string, string>;

  constructor() {
    this.map = {};
  }

  public has(key: string): boolean {
    return key in this.map;
  }

  public get(key: string): string {
    return this.map[key];
  }

  public set(key: string, value: string): void {
    this.map[key] = value;
  }

  public rename(oldName: string, newName: string): void {
    if (this.map[oldName]) {
      this.map[oldName] = newName;
    }
  }
}

/**
 * Model组件接口 - 定义模型的各个组件结构
 */
export interface Component {
  data: DataComponent;
  layout: LayoutComponent;
  mark: MarkComponent;
  projection?: ProjectionComponent;
  scales: Record<ScaleChannel, ScaleComponent>;
  selection: Record<string, SelectionComponent>;
  axes: {
    x?: AxisComponent[];
    y?: AxisComponent[];
  };
  legends: LegendComponent[];
}

/**
 * 所有Vega-Lite模型的抽象基类
 */
export abstract class Model {
  /** 模型类型（unit、facet、layer或concat） */
  public readonly type: ModelType;

  /** 模型的标题配置 */
  protected readonly title?: TitleParams<SignalRef>;

  /** 模型的名称 */
  public readonly name: string;

  /** 模型组件 */
  public readonly component: Component;

  /** 父子模型关系 */
  public readonly parent: Model | null;

  /** 名称映射表 */
  protected readonly signalNameMap: NameMap;
  protected readonly scaleNameMap: NameMap;
  protected readonly projectionNameMap: NameMap;

  /**
   * 构造函数
   * @param parent 父模型
   * @param component 模型组件
   * @param name 模型名称
   * @param type 模型类型
   * @param title 标题配置
   */
  constructor(
    parent: Model | null,
    component: Component,
    name: string,
    type: ModelType,
    title?: TitleParams<SignalRef>,
  ) {
    this.parent = parent;
    this.component = component;
    this.name = name || (parent ? `${parent.name}_child` : '');
    this.type = type;
    this.title = title;

    this.signalNameMap = new NameMap();
    this.scaleNameMap = new NameMap();
    this.projectionNameMap = new NameMap();

    // 初始化名称映射
    const scales = this.component.scales;
    if (scales) {
      Object.keys(scales).forEach((channel: ScaleChannel) => {
        const scaleComponent = scales[channel];
        if (scaleComponent && !scaleComponent.merged) {
          const scaleName = scaleComponent.get('name');
          if (scaleName) {
            this.scaleNameMap.set(scaleName, scaleName);
          }
        }
      });
    }

    if (this.component.projection && !this.component.projection.merged) {
      const projName = this.component.projection.get('name');
      if (projName) {
        this.projectionNameMap.set(projName, projName);
      }
    }
  }

  /**
   * 获取模型宽度
   */
  public abstract get width(): number | 'container' | SignalRef;

  /**
   * 获取模型高度
   */
  public abstract get height(): number | 'container' | SignalRef;

  /**
   * 解析模型规范
   */
  public parse(): void {
    // 解析步骤
    this.parseData();
    this.parseSelections();
    this.parseLayoutSize();
    this.parseMarkGroup();
  }

  /**
   * 解析数据
   */
  protected abstract parseData(): void;

  /**
   * 解析选择器
   */
  protected abstract parseSelections(): void;

  /**
   * 解析布局大小
   */
  protected abstract parseLayoutSize(): void;

  /**
   * 解析标记组
   */
  protected abstract parseMarkGroup(): void;

  /**
   * 重命名顶级布局大小信号
   * @param sizeType 大小类型
   * @param oldSignalName 旧信号名称
   * @param newSignalName 新信号名称
   */
  private renameTopLevelLayoutSizeSignal(sizeType: LayoutSizeType, oldSignalName: string, newSignalName: string): void {
    this.renameSignal(oldSignalName, newSignalName);

    // 如果当前是顶级模型，通知所有子模型进行重命名
    if (!this.parent) {
      this.forEachChild((child) => {
        child.renameTopLevelLayoutSizeSignal(sizeType, oldSignalName, newSignalName);
      });
    }
  }

  /**
   * 组装组编码项
   */
  public abstract assembleGroupEncodeEntry(): VGEncodeEntry;

  /**
   * 组装标题
   */
  public assembleTitle(): VgTitle {
    const {encoding, ...titleNoEncoding} = this.title ?? ({} as TitleParams<SignalRef>);

    const title: VgTitle = {
      ...extractTitleConfig(this.config.title).nonMarkTitleProperties,
      ...titleNoEncoding,
      ...(encoding ? {encode: {update: encoding}} : {}),
    };

    if (title.text) {
      if (contains(['unit', 'layer'], this.type)) {
        // 单元/图层模型
        if (contains<AnchorValue>(['middle', undefined], title.anchor)) {
          title.frame ??= 'group';
        }
      } else {
        // 使用Vega布局的组合模型

        // 为组合模型默认设置标题锚点为"start"，因为"middle"看起来不太好
        // https://github.com/vega/vega/issues/960#issuecomment-471360328
        title.anchor ??= 'start';
      }

      return isEmpty(title) ? undefined : title;
    }
    return undefined;
  }

  /**
   * 组装此模型的标记组。我们接受可选的`signals`参数，以便可以将concat顶级信号与顶级模型的本地信号一起包含。
   * @param signals 要包含的信号列表
   * @returns 组装后的Vega标记组
   */
  public assembleGroup(signals: Signal[] = []) {
    const group: VgMarkGroup = {};

    signals = signals.concat(this.assembleSignals());

    if (signals.length > 0) {
      group.signals = signals;
    }

    const layout = this.assembleLayout();
    if (layout) {
      group.layout = layout;
    }

    group.marks = [].concat(this.assembleHeaderMarks(), this.assembleMarks());

    // 仅当此规范是顶级或父级是facet时才包含比例尺
    // （否则，它将与上级作用域合并。）
    const scales = !this.parent || isFacetModel(this.parent) ? assembleScales(this) : [];
    if (scales.length > 0) {
      group.scales = scales;
    }

    const axes = this.assembleAxes();
    if (axes.length > 0) {
      group.axes = axes;
    }

    const legends = this.assembleLegends();
    if (legends.length > 0) {
      group.legends = legends;
    }

    return group;
  }

  /**
   * 获取指定文本的变量名称
   * @param text 基础文本
   * @returns 格式化后的变量名
   */
  public getName(text: string) {
    return varName((this.name ? `${this.name}_` : '') + text);
  }

  /**
   * 获取指定数据源类型的数据名称
   * @param type 数据源类型
   * @returns 数据源名称
   */
  public getDataName(type: DataSourceType) {
    return this.getName(DataSourceType[type].toLowerCase());
  }

  /**
   * 请求给定数据源类型的数据源名称，并将该数据源标记为必需
   * 此方法应在parse中调用，以便所有使用的数据源都能在assembleData()中正确实例化
   * 您可以在assemble中使用`lookupDataSource`查找正确的数据集名称
   * @param name 数据源类型
   * @returns 完整的数据源名称
   */
  public requestDataName(name: DataSourceType) {
    const fullName = this.getDataName(name);

    // 增加引用计数。这一点至关重要，因为否则我们不会创建数据源。
    // 我们还会在OutputNode.getSource()调用时增加引用计数。
    const refCounts = this.component.data.outputNodeRefCounts;
    refCounts[fullName] = (refCounts[fullName] || 0) + 1;

    return fullName;
  }

  /**
   * 获取布局大小类型的信号引用
   * @param layoutSizeType 布局大小类型
   * @returns 信号引用
   */
  public getSizeSignalRef(layoutSizeType: LayoutSizeType): SignalRef {
    if (isFacetModel(this.parent)) {
      const sizeType = getSizeTypeFromLayoutSizeType(layoutSizeType);
      const channel = getPositionScaleChannel(sizeType);
      const scaleComponent = this.component.scales[channel];

      if (scaleComponent && !scaleComponent.merged) {
        // 独立比例尺
        const type = scaleComponent.get('type');
        const range = scaleComponent.get('range');

        if (hasDiscreteDomain(type) && isVgRangeStep(range)) {
          const scaleName = scaleComponent.get('name');
          const domain = assembleDomain(this, channel);
          const field = getFieldFromDomain(domain);
          if (field) {
            const fieldRef = vgField({aggregate: 'distinct', field}, {expr: 'datum'});
            return {
              signal: sizeExpr(scaleName, scaleComponent, fieldRef),
            };
          } else {
            log.warn(log.message.unknownField(channel));
            return null;
          }
        }
      }
    }

    return {
      signal: this.signalNameMap.get(this.getName(layoutSizeType)),
    };
  }

  /**
   * 查找输出节点的数据源名称。您可能希望在assemble中调用此方法。
   * @param name 节点名称
   * @returns 数据源名称
   */
  public lookupDataSource(name: string) {
    const node = this.component.data.outputNodes[name];

    if (!node) {
      // 在映射中找不到名称，所以让我们返回我们得到的内容
      // 如果我们已经有了正确的名称，就会发生这种情况
      return name;
    }

    return node.getSource();
  }

  /**
   * 获取信号名称
   * @param oldSignalName 原始信号名称
   * @returns 映射后的信号名称
   */
  public getSignalName(oldSignalName: string): string {
    return this.signalNameMap.get(oldSignalName);
  }

  /**
   * 重命名信号
   * @param oldName 旧名称
   * @param newName 新名称
   */
  public renameSignal(oldName: string, newName: string) {
    this.signalNameMap.rename(oldName, newName);
  }

  /**
   * 重命名比例尺
   * @param oldName 旧名称
   * @param newName 新名称
   */
  public renameScale(oldName: string, newName: string) {
    this.scaleNameMap.rename(oldName, newName);
  }

  /**
   * 重命名投影
   * @param oldName 旧名称
   * @param newName 新名称
   */
  public renameProjection(oldName: string, newName: string) {
    this.projectionNameMap.rename(oldName, newName);
  }

  /**
   * @returns 比例尺解析和命名后的给定通道的比例尺名称
   * @param originalScaleName 原始比例尺通道或名称
   * @param parse 是否在解析阶段
   */
  public scaleName(originalScaleName: ScaleChannel | string, parse?: boolean): string {
    if (parse) {
      // 在解析阶段始终返回一个值
      // 不需要引用重命名映射，因为在比例尺具有原始名称之前无法重命名
      return this.getName(originalScaleName);
    }

    // 如果通道有比例尺，它应该在比例尺组件中或存在于名称映射中
    if (
      // 如果通道有比例尺，应该有一个本地比例尺组件
      (isChannel(originalScaleName) && isScaleChannel(originalScaleName) && this.component.scales[originalScaleName]) ||
      // 在比例尺名称映射中（比例尺由其父级合并）
      this.scaleNameMap.has(this.getName(originalScaleName))
    ) {
      return this.scaleNameMap.get(this.getName(originalScaleName));
    }
    return undefined;
  }

  /**
   * @returns 投影解析和命名后的投影名称
   * @param parse 是否在解析阶段
   */
  public projectionName(parse?: boolean): string {
    if (parse) {
      // 在解析阶段始终返回一个值
      // 不需要引用重命名映射，因为在投影具有原始名称之前无法重命名
      return this.getName('projection');
    }

    if (
      (this.component.projection && !this.component.projection.merged) ||
      this.projectionNameMap.has(this.getName('projection'))
    ) {
      return this.projectionNameMap.get(this.getName('projection'));
    }
    return undefined;
  }

  /**
   * 遍历模型层次结构以获取特定通道的比例尺组件
   * @param channel 比例尺通道
   * @returns 比例尺组件
   */
  public getScaleComponent(channel: ScaleChannel): ScaleComponent {
    /* istanbul ignore next: This is warning for debugging test */
    if (!this.component.scales) {
      throw new Error(
        'getScaleComponent不能在parseScale()之前调用。请确保您已调用parseScale或使用parseUnitModelWithScale()。',
      );
    }

    const localScaleComponent = this.component.scales[channel];
    if (localScaleComponent && !localScaleComponent.merged) {
      return localScaleComponent;
    }
    return this.parent ? this.parent.getScaleComponent(channel) : undefined;
  }

  /**
   * 获取通道的比例尺类型
   * @param channel 比例尺通道
   * @returns 比例尺类型
   */
  public getScaleType(channel: ScaleChannel): ScaleType {
    const scaleComponent = this.getScaleComponent(channel);
    return scaleComponent ? scaleComponent.get('type') : undefined;
  }

  /**
   * 遍历模型层次结构以获取特定的选择组件
   * @param variableName 变量名
   * @param origName 原始名称
   * @returns 选择组件
   */
  public getSelectionComponent(variableName: string, origName: string): SelectionComponent {
    let sel = this.component.selection[variableName];
    if (!sel && this.parent) {
      sel = this.parent.getSelectionComponent(variableName, origName);
    }
    if (!sel) {
      throw new Error(log.message.selectionNotFound(origName));
    }
    return sel;
  }

  /**
   * 返回模型是否有坐标轴方向的signalRef
   * @returns 是否有坐标轴方向信号引用
   */
  public hasAxisOrientSignalRef() {
    return (
      this.component.axes.x?.some((a) => a.hasOrientSignalRef()) ||
      this.component.axes.y?.some((a) => a.hasOrientSignalRef())
    );
  }

  // 抽象方法，需要在子类中实现
  public abstract get config(): any;
  public abstract assembleData(): any[];
  public abstract assembleLayout(): any;
  public abstract assembleMarks(): any[];
  public abstract assembleAxes(): any[];
  public abstract assembleLegends(): any[];
  public abstract assembleHeaderMarks(): any[];
  public abstract assembleSignals(): Signal[];
  public abstract forEachChild(callback: (child: Model) => void): void;
}

/** UnitModel和FacetModel的抽象类。两者都可以包含fieldDefs作为其自己规范的一部分。 */
export abstract class ModelWithField extends Model {
  /**
   * 获取指定通道的字段定义
   * @param channel 通道
   * @returns 字段定义
   */
  public abstract fieldDef(channel: SingleDefChannel): FieldDef<any>;

  /**
   * 获取Vega的"field"引用
   * @param channel 通道
   * @param opt 字段引用选项
   * @returns Vega字段引用
   */
  public vgField(channel: SingleDefChannel, opt: FieldRefOption = {}) {
    const fieldDef = this.fieldDef(channel);

    if (!fieldDef) {
      return undefined;
    }

    return vgField(fieldDef, opt);
  }

  /**
   * 获取映射信息
   * @returns 通道到通道定义的映射
   */
  protected abstract getMapping(): Partial<Record<ExtendedChannel, any>>;

  /**
   * 对所有字段定义应用归约函数
   * @param f 归约函数
   * @param init 初始值
   * @returns 归约结果
   */
  public reduceFieldDef<T, U>(f: (acc: U, fd: FieldDef<string>, c: Channel) => U, init: T): T {
    return reduce(
      this.getMapping(),
      (acc: U, cd: ChannelDef, c: Channel) => {
        const fieldDef = getFieldDef(cd);
        if (fieldDef) {
          return f(acc, fieldDef, c);
        }
        return acc;
      },
      init,
    );
  }

  /**
   * 对所有字段定义执行遍历操作
   * @param f 遍历函数
   * @param t this上下文
   */
  public forEachFieldDef(f: (fd: FieldDef<string>, c: ExtendedChannel) => void, t?: any) {
    forEach(
      this.getMapping(),
      (cd, c) => {
        const fieldDef = getFieldDef(cd);
        if (fieldDef) {
          f(fieldDef, c);
        }
      },
      t,
    );
  }

  /**
   * 检查通道是否有字段
   * @param channel 通道
   * @returns 是否有字段
   */
  public abstract channelHasField(channel: Channel): boolean;
}
