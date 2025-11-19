import {NewSignal, SignalRef} from 'vega';
import {isArray} from 'vega-util';
import {Axis, AxisInternal, isConditionalAxisValue} from '../axis.js';
import {
  Channel,
  GEOPOSITION_CHANNELS,
  NonPositionScaleChannel,
  NONPOSITION_SCALE_CHANNELS,
  PositionChannel,
  POSITION_SCALE_CHANNELS,
  ScaleChannel,
  SCALE_CHANNELS,
  SingleDefChannel,
  supportLegend,
  X,
  Y,
} from '../channel.js';
import {
  getFieldDef,
  getFieldOrDatumDef,
  isFieldOrDatumDef,
  isTypedFieldDef,
  MarkPropFieldOrDatumDef,
  PositionFieldDef,
} from '../channeldef.js';
import {Config} from '../config.js';
import {isGraticuleGenerator} from '../data.js';
import * as vlEncoding from '../encoding.js';
import {Encoding, initEncoding} from '../encoding.js';
import {ExprRef, replaceExprRef} from '../expr.js';
import {LegendInternal} from '../legend.js';
import {GEOSHAPE, isMarkDef, Mark, MarkDef} from '../mark.js';
import {Projection} from '../projection.js';
import {Domain, Scale} from '../scale.js';
import {isSelectionParameter, SelectionParameter} from '../selection.js';
import {LayoutSizeMixins, NormalizedUnitSpec} from '../spec/index.js';
import {isFrameMixins} from '../spec/base.js';
import {stack, StackProperties} from '../stack.js';
import {keys} from '../util.js';
import {VgData, VgLayout, VgMarkGroup} from '../vega.schema.js';
import {assembleAxisSignals} from './axis/assemble.js';
import {AxisInternalIndex} from './axis/component.js';
import {parseUnitAxes} from './axis/parse.js';
import {signalOrValueRefWithCondition, signalRefOrValue} from './common.js';
import {parseData} from './data/parse.js';
import {assembleLayoutSignals} from './layoutsize/assemble.js';
import {initLayoutSize} from './layoutsize/init.js';
import {parseUnitLayoutSize} from './layoutsize/parse.js';
import {LegendInternalIndex} from './legend/component.js';
import {defaultFilled, initMarkdef} from './mark/init.js';
import {parseMarkGroups} from './mark/mark.js';
import {isLayerModel, Model, ModelWithField} from './model.js';
import {ScaleIndex} from './scale/component.js';
import {
  assembleTopLevelSignals,
  assembleUnitSelectionData,
  assembleUnitSelectionMarks,
  assembleUnitSelectionSignals,
} from './selection/assemble.js';
import {parseUnitSelection} from './selection/parse.js';
import {CURR} from './selection/point.js';

/**
 * Internal model of Vega-Lite specification for the compiler.
 */
export class UnitModel extends ModelWithField {
  /** 标记定义，指定图表中使用的图形类型及其属性 */
  public readonly markDef: MarkDef<Mark, SignalRef>;
  /** 编码定义，将数据字段映射到视觉属性通道 */
  public readonly encoding: Encoding<string>;

  /** 指定的比例尺索引，存储每个通道对应的比例尺配置 */
  public readonly specifiedScales: ScaleIndex = {};

  /** 堆叠属性，用于管理堆叠图表的数据结构 */
  public readonly stack: StackProperties;

  /** 指定的坐标轴索引，存储位置通道对应的坐标轴配置 */
  protected specifiedAxes: AxisInternalIndex = {};

  /** 指定的图例索引，存储非位置通道对应的图例配置 */
  protected specifiedLegends: LegendInternalIndex = {};

  /** 指定的投影配置，用于地理数据可视化 */
  public specifiedProjection: Projection<ExprRef | SignalRef> = {};

  /** 选择参数数组，定义用户交互选择功能 */
  public readonly selection: SelectionParameter[] = [];
  /** 子模型数组，在单位模型中通常为空 */
  public children: Model[] = [];

  /**
   * 构造函数，初始化UnitModel实例
   * @param spec 标准化的单元规范对象
   * @param parent 父模型
   * @param parentGivenName 父模型给定的名称
   * @param parentGivenSize 父模型给定的尺寸信息
   * @param config 配置对象
   */
  constructor(
    spec: NormalizedUnitSpec,
    parent: Model,
    parentGivenName: string,
    parentGivenSize: LayoutSizeMixins = {},
    config: Config<SignalRef>,
  ) {
    super(spec, 'unit', parent, parentGivenName, config, undefined, isFrameMixins(spec) ? spec.view : undefined);

    // 处理标记定义，如果spec.mark是对象则复制，否则创建包含type的对象
    const markDef = isMarkDef(spec.mark) ? {...spec.mark} : {type: spec.mark};
    const mark = markDef.type;

    // 需要在初始化其他标记属性之前初始化filled属性，因为编码依赖于filled属性，而其他标记属性又依赖于编码中的类型
    if (markDef.filled === undefined) {
      markDef.filled = defaultFilled(markDef, config, {
        graticule: spec.data && isGraticuleGenerator(spec.data),
      });
    }

    // 初始化编码
    const encoding = (this.encoding = initEncoding(spec.encoding || {}, mark, markDef.filled, config));
    // 初始化标记定义
    this.markDef = initMarkdef(markDef, encoding, config);

    // 初始化布局尺寸
    this.size = initLayoutSize({
      encoding,
      size: isFrameMixins(spec)
        ? {
          ...parentGivenSize,
          ...(spec.width ? {width: spec.width} : {}),
          ...(spec.height ? {height: spec.height} : {}),
        }
        : parentGivenSize,
    });

    // 计算堆叠属性
    this.stack = stack(this.markDef, encoding);
    // 初始化比例尺
    this.specifiedScales = this.initScales(mark, encoding);

    // 初始化坐标轴
    this.specifiedAxes = this.initAxes(encoding);
    // 初始化图例
    this.specifiedLegends = this.initLegends(encoding);
    // 设置投影配置
    this.specifiedProjection = spec.projection;

    // 选择参数将在解析时初始化
    this.selection = (spec.params ?? []).filter((p) => isSelectionParameter(p)) as SelectionParameter[];
  }

  /**
   * 判断模型是否需要地理投影
   * @returns 如果是地理形状标记或包含地理位置编码，则返回true
   */
  public get hasProjection(): boolean {
    const {encoding} = this;
    const isGeoShapeMark = this.mark === GEOSHAPE;
    const hasGeoPosition = encoding && GEOPOSITION_CHANNELS.some((channel) => isFieldOrDatumDef(encoding[channel]));
    return isGeoShapeMark || hasGeoPosition;
  }

  /**
   * 获取指定通道的Vega-Lite比例尺域
   * @param channel 比例尺通道
   * @returns 比例尺域配置，如果不存在则返回undefined
   */
  public scaleDomain(channel: ScaleChannel): Domain {
    const scale = this.specifiedScales[channel];
    return scale ? scale.domain : undefined;
  }

  /**
   * 获取指定位置通道的坐标轴配置
   * @param channel 位置通道
   * @returns 坐标轴内部配置对象
   */
  public axis(channel: PositionChannel): AxisInternal {
    return (this.specifiedAxes as any)[channel];
  }

  /**
   * 获取指定非位置通道的图例配置
   * @param channel 非位置比例尺通道
   * @returns 图例内部配置对象
   */
  public legend(channel: NonPositionScaleChannel): LegendInternal {
    return this.specifiedLegends[channel];
  }

  /**
   * 初始化所有比例尺配置
   * @param mark 标记类型
   * @param encoding 编码对象
   * @returns 初始化后的比例尺索引对象
   */
  private initScales(mark: Mark, encoding: Encoding<string>): ScaleIndex {
    return SCALE_CHANNELS.reduce((scales, channel) => {
      const fieldOrDatumDef = getFieldOrDatumDef(encoding[channel]) as
        | PositionFieldDef<string>
        | MarkPropFieldOrDatumDef<string>;
      if (fieldOrDatumDef) {
        scales[channel] = this.initScale(fieldOrDatumDef.scale ?? {});
      }
      return scales;
    }, {} as ScaleIndex);
  }

  /**
   * 初始化单个比例尺配置
   * @param scale 输入的比例尺配置
   * @returns 初始化后的比例尺配置，将表达式引用替换为信号引用
   */
  private initScale(scale: Scale<ExprRef | SignalRef>): Scale<SignalRef> {
    const {domain, range} = scale;
    // TODO: 如果有递归替换函数，可以简化此函数
    const scaleInternal = replaceExprRef(scale);
    // 处理数组类型的域
    if (isArray(domain)) {
      scaleInternal.domain = domain.map(signalRefOrValue);
    }
    // 处理数组类型的范围
    if (isArray(range)) {
      scaleInternal.range = range.map(signalRefOrValue);
    }
    return scaleInternal as Scale<SignalRef>;
  }

  /**
   * 初始化所有坐标轴配置
   * @param encoding 编码对象
   * @returns 初始化后的坐标轴索引对象
   */
  private initAxes(encoding: Encoding<string>): AxisInternalIndex {
    return POSITION_SCALE_CHANNELS.reduce((_axis, channel) => {
      // 位置坐标轴

      // TODO: 处理条件字段定义
      const channelDef = encoding[channel];
      // 检查是否有字段定义，或者对于X/Y通道，是否有对应的x2/y2字段
      if (
        isFieldOrDatumDef(channelDef) ||
        (channel === X && isFieldOrDatumDef(encoding.x2)) ||
        (channel === Y && isFieldOrDatumDef(encoding.y2))
      ) {
        const axisSpec = isFieldOrDatumDef(channelDef) ? channelDef.axis : undefined;

        _axis[channel] = axisSpec
          ? this.initAxis({...axisSpec}) // 将真值转换为对象
          : axisSpec;
      }
      return _axis;
    }, {} as any);
  }

  /**
   * 初始化单个坐标轴配置
   * @param axis 输入的坐标轴配置
   * @returns 初始化后的坐标轴配置，将表达式引用替换为信号引用
   */
  private initAxis(axis: Axis<ExprRef | SignalRef>): Axis<SignalRef> {
    const props = keys(axis);
    const axisInternal: any = {};
    // 遍历坐标轴的所有属性
    for (const prop of props) {
      const val = axis[prop];
      // 根据值的类型进行不同的处理
      axisInternal[prop] = isConditionalAxisValue<any, ExprRef | SignalRef>(val)
        ? signalOrValueRefWithCondition<any>(val)
        : signalRefOrValue(val);
    }
    return axisInternal;
  }

  /**
   * 初始化所有图例配置
   * @param encoding 编码对象
   * @returns 初始化后的图例索引对象
   */
  private initLegends(encoding: Encoding<string>): LegendInternalIndex {
    return NONPOSITION_SCALE_CHANNELS.reduce((_legend, channel) => {
      const fieldOrDatumDef = getFieldOrDatumDef(encoding[channel]) as MarkPropFieldOrDatumDef<string>;

      // 只有当字段定义存在且该通道支持图例时才初始化图例
      if (fieldOrDatumDef && supportLegend(channel)) {
        const legend = fieldOrDatumDef.legend;
        _legend[channel] = legend
          ? replaceExprRef(legend) // 将真值转换为对象
          : legend;
      }

      return _legend;
    }, {} as any);
  }

  /**
   * 解析数据组件
   */
  public parseData() {
    this.component.data = parseData(this);
  }

  /**
   * 解析布局尺寸
   */
  public parseLayoutSize() {
    parseUnitLayoutSize(this);
  }

  /**
   * 解析选择参数
   */
  public parseSelections() {
    this.component.selection = parseUnitSelection(this, this.selection);
  }

  /**
   * 解析标记组
   */
  public parseMarkGroup() {
    this.component.mark = parseMarkGroups(this);
  }

  /**
   * 解析坐标轴和标题
   */
  public parseAxesAndHeaders() {
    this.component.axes = parseUnitAxes(this);
  }

  /**
   * 组装选择相关的顶级信号
   * @param signals 现有信号数组
   * @returns 组装后的新信号数组
   */
  public assembleSelectionTopLevelSignals(signals: any[]): NewSignal[] {
    return assembleTopLevelSignals(this, signals);
  }

  /**
   * 组装所有信号
   * @returns 组装后的信号数组
   */
  public assembleSignals(): NewSignal[] {
    return [...assembleAxisSignals(this), ...assembleUnitSelectionSignals(this, [])];
  }

  /**
   * 组装选择相关的数据组件
   * @param data 现有数据组件数组
   * @returns 组装后的数据组件数组
   */
  public assembleSelectionData(data: readonly VgData[]): VgData[] {
    return assembleUnitSelectionData(this, data);
  }

  /**
   * 组装布局配置（单元模型不使用布局）
   * @returns 返回null，因为单元模型没有布局
   */
  public assembleLayout(): VgLayout {
    return null;
  }

  /**
   * 组装布局相关的信号
   * @returns 布局信号数组
   */
  public assembleLayoutSignals(): NewSignal[] {
    return assembleLayoutSignals(this);
  }

  /**
   * 组装后修正标记中的数据引用
   */
  public correctDataNames = (mark: VgMarkGroup) => {
    // 处理普通数据引用
    if (mark.from?.data) {
      mark.from.data = this.lookupDataSource(mark.from.data);
      // 处理时间编码的特殊情况
      if ('time' in this.encoding) {
        mark.from.data = mark.from.data + CURR;
      }
    }

    // 处理分面数据访问
    if (mark.from?.facet?.data) {
      mark.from.facet.data = this.lookupDataSource(mark.from.facet.data);
      // TOOD(jzong) 实现分面动画时取消注释
      // if ('time' in this.encoding) {
      //   mark.from.facet.data = mark.from.facet.data + CURR;
      // }
    }

    return mark;
  };

  /**
   * 组装标记组件
   * @returns 组装后的标记组数组
   */
  public assembleMarks() {
    let marks = this.component.mark ?? [];

    // 如果此单元是图层的一部分，选择操作应该协同增强所有图层，而不是每个单元单独处理
    // 这样可以确保裁剪和高亮标记的正确交错
    if (!this.parent || !isLayerModel(this.parent)) {
      marks = assembleUnitSelectionMarks(this, marks);
    }

    // 修正所有标记中的数据引用名称
    return marks.map(this.correctDataNames);
  }

  /**
   * 组装组样式
   * @returns 组样式字符串或字符串数组
   */
  public assembleGroupStyle(): string | string[] {
    const {style} = this.view || {};
    // 如果视图中指定了样式，则使用指定的样式
    if (style !== undefined) {
      return style;
    }
    // 否则根据是否有x或y编码来决定使用'cell'还是'view'样式
    if (this.encoding.x || this.encoding.y) {
      return 'cell';
    } else {
      return 'view';
    }
  }

  /**
   * 获取映射（编码）对象
   * @returns 编码对象
   */
  protected getMapping() {
    return this.encoding;
  }

  /**
   * 获取标记类型
   * @returns 标记类型
   */
  public get mark(): Mark {
    return this.markDef.type;
  }

  /**
   * 检查指定通道是否有字段定义
   * @param channel 通道名称
   * @returns 如果通道有字段定义则返回true
   */
  public channelHasField(channel: Channel) {
    return vlEncoding.channelHasField(this.encoding, channel);
  }

  /**
   * 获取指定通道的字段定义
   * @param channel 单一定义通道
   * @returns 字段定义对象
   */
  public fieldDef(channel: SingleDefChannel) {
    const channelDef = (this.encoding as any)[channel];
    return getFieldDef<string>(channelDef);
  }

  /**
   * 获取指定通道的类型化字段定义
   * @param channel 单一定义通道
   * @returns 如果字段定义是类型化的则返回该定义，否则返回null
   */
  public typedFieldDef(channel: SingleDefChannel) {
    const fieldDef = this.fieldDef(channel);
    if (isTypedFieldDef(fieldDef)) {
      return fieldDef;
    }
    return null;
  }
}
