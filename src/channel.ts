/*
 * 编码通道（视觉变量）的常量和工具函数
 * 例如 'x', 'y', 'color' 等。
 */

import {hasOwnProperty} from 'vega-util';
import {RangeType} from './compile/scale/type.js';
import {Encoding} from './encoding.js';
import {Mark} from './mark.js';
import {EncodingFacetMapping} from './spec/facet.js';
import {Flag, keys} from './util.js';

// 通道类型，是Encoding的键类型
export type Channel = keyof Encoding<any>;
// 扩展通道类型，包括通道和分面通道
export type ExtendedChannel = Channel | FacetChannel;

// 分面通道
// 行分面
export const ROW = 'row' as const;
// 列分面
export const COLUMN = 'column' as const;
// 通用分面
export const FACET = 'facet' as const;

// 位置通道
// X轴位置
export const X = 'x' as const;
// Y轴位置
export const Y = 'y' as const;
// X轴结束位置
export const X2 = 'x2' as const;
// Y轴结束位置
export const Y2 = 'y2' as const;

// 位置偏移通道
// X轴偏移
export const XOFFSET = 'xOffset' as const;
// Y轴偏移
export const YOFFSET = 'yOffset' as const;

// 极坐标位置通道
// 极坐标半径
export const RADIUS = 'radius' as const;
// 极坐标内半径
export const RADIUS2 = 'radius2' as const;
// 极坐标角度
export const THETA = 'theta' as const;
// 极坐标结束角度
export const THETA2 = 'theta2' as const;

// 地理位置通道
// 纬度
export const LATITUDE = 'latitude' as const;
// 经度
export const LONGITUDE = 'longitude' as const;
// 结束纬度
export const LATITUDE2 = 'latitude2' as const;
// 结束经度
export const LONGITUDE2 = 'longitude2' as const;

// 时间通道
export const TIME = 'time' as const;

// 带有比例尺的标记属性通道
// 颜色（填充和描边的通用颜色）
export const COLOR = 'color' as const;
// 填充颜色
export const FILL = 'fill' as const;
// 描边颜色
export const STROKE = 'stroke' as const;
// 形状
export const SHAPE = 'shape' as const;
// 大小
export const SIZE = 'size' as const;
// 角度
export const ANGLE = 'angle' as const;
// 透明度
export const OPACITY = 'opacity' as const;
// 填充透明度
export const FILLOPACITY = 'fillOpacity' as const;
// 描边透明度
export const STROKEOPACITY = 'strokeOpacity' as const;
// 描边宽度
export const STROKEWIDTH = 'strokeWidth' as const;
// 描边虚线模式
export const STROKEDASH = 'strokeDash' as const;

// 非比例尺通道
// 文本内容
export const TEXT = 'text' as const;
// 排序
export const ORDER = 'order' as const;
// 详细信息
export const DETAIL = 'detail' as const;
// 键（用于标识数据项）
export const KEY = 'key' as const;
// 悬停提示
export const TOOLTIP = 'tooltip' as const;
// 超链接
export const HREF = 'href' as const;
// 图片URL
export const URL = 'url' as const;
// 描述
export const DESCRIPTION = 'description' as const;

// 位置通道索引，用于快速检查
type PositionChannelIndex = {
  [X]: 1;
  [Y]: 1;
  [X2]: 1;
  [Y2]: 1;
};

const POSITION_CHANNEL_INDEX: PositionChannelIndex = {
  [X]: 1,
  [Y]: 1,
  [X2]: 1,
  [Y2]: 1,
} as const;

// 位置通道类型
export type PositionChannel = keyof typeof POSITION_CHANNEL_INDEX;

// 极坐标位置通道索引
type PolarPositionChannelIndex = {
  [THETA]: 1;
  [THETA2]: 1;
  [RADIUS]: 1;
  [RADIUS2]: 1;
};

const POLAR_POSITION_CHANNEL_INDEX: PolarPositionChannelIndex = {
  [THETA]: 1,
  [THETA2]: 1,
  [RADIUS]: 1,
  [RADIUS2]: 1,
} as const;

// 极坐标位置通道类型
export type PolarPositionChannel = keyof typeof POLAR_POSITION_CHANNEL_INDEX;

/**
 * 检查给定通道是否为极坐标位置通道
 * @param c 要检查的通道
 * @returns 如果是极坐标位置通道则返回true
 */
export function isPolarPositionChannel(c: Channel): c is PolarPositionChannel {
  return hasOwnProperty(POLAR_POSITION_CHANNEL_INDEX, c);
}

// 地理位置通道索引
type GeoPositionChannelIndex = {
  [LONGITUDE]: 1;
  [LONGITUDE2]: 1;
  [LATITUDE]: 1;
  [LATITUDE2]: 1;
};

const GEO_POSIITON_CHANNEL_INDEX: GeoPositionChannelIndex = {
  [LONGITUDE]: 1,
  [LONGITUDE2]: 1,
  [LATITUDE]: 1,
  [LATITUDE2]: 1,
} as const;

// 地理位置通道类型
export type GeoPositionChannel = keyof typeof GEO_POSIITON_CHANNEL_INDEX;

/**
 * 将地理位置通道转换为对应的笛卡尔位置通道
 * @param channel 地理位置通道
 * @returns 对应的笛卡尔位置通道
 */
export function getPositionChannelFromLatLong(channel: GeoPositionChannel): PositionChannel {
  switch (channel) {
    case LATITUDE:
      return Y;
    case LATITUDE2:
      return Y2;
    case LONGITUDE:
      return X;
    case LONGITUDE2:
      return X2;
  }
}

/**
 * 检查给定通道是否为地理位置通道
 * @param c 要检查的通道
 * @returns 如果是地理位置通道则返回true
 */
export function isGeoPositionChannel(c: Channel): c is GeoPositionChannel {
  return hasOwnProperty(GEO_POSIITON_CHANNEL_INDEX, c);
}

// 所有地理位置通道
export const GEOPOSITION_CHANNELS = keys(GEO_POSIITON_CHANNEL_INDEX);

// 单元通道索引，包含所有非分面通道
const UNIT_CHANNEL_INDEX: Flag<Channel> = {
  ...POSITION_CHANNEL_INDEX,
  ...POLAR_POSITION_CHANNEL_INDEX,
  ...GEO_POSIITON_CHANNEL_INDEX,
  [XOFFSET]: 1,
  [YOFFSET]: 1,
  // 颜色相关
  [COLOR]: 1,
  [FILL]: 1,
  [STROKE]: 1,
  // 时间
  [TIME]: 1,
  // 其他带比例尺的非位置通道
  [OPACITY]: 1,
  [FILLOPACITY]: 1,
  [STROKEOPACITY]: 1,
  [STROKEWIDTH]: 1,
  [STROKEDASH]: 1,
  [SIZE]: 1,
  [ANGLE]: 1,
  [SHAPE]: 1,
  // 不带比例尺的通道
  [ORDER]: 1,
  [TEXT]: 1,
  [DETAIL]: 1,
  [KEY]: 1,
  [TOOLTIP]: 1,
  [HREF]: 1,
  [URL]: 1,
  [DESCRIPTION]: 1,
};

// 颜色通道类型
export type ColorChannel = typeof COLOR | typeof FILL | typeof STROKE;

/**
 * 检查给定通道是否为颜色通道
 * @param channel 要检查的通道
 * @returns 如果是颜色通道则返回true
 */
export function isColorChannel(channel: Channel): channel is ColorChannel {
  return channel === COLOR || channel === FILL || channel === STROKE;
}

// 分面通道类型
export type FacetChannel = keyof EncodingFacetMapping<any, any>;

// 分面通道索引
const FACET_CHANNEL_INDEX: Flag<FacetChannel> = {
  [ROW]: 1,
  [COLUMN]: 1,
  [FACET]: 1,
};

// 所有分面通道
export const FACET_CHANNELS = keys(FACET_CHANNEL_INDEX);

// 所有通道索引（包括单元通道和分面通道）
const CHANNEL_INDEX = {
  ...UNIT_CHANNEL_INDEX,
  ...FACET_CHANNEL_INDEX,
};

// 所有通道
export const CHANNELS = keys(CHANNEL_INDEX);

// 单一定义通道索引（排除了可以有多个定义的通道）
const {order: _o, detail: _d, tooltip: _tt1, ...SINGLE_DEF_CHANNEL_INDEX} = CHANNEL_INDEX;
// 单元单一定义通道索引（进一步排除分面通道）
const {row: _r, column: _c, facet: _f, ...SINGLE_DEF_UNIT_CHANNEL_INDEX} = SINGLE_DEF_CHANNEL_INDEX;

/**
 * 不能有多个通道定义的通道类型
 * model.fieldDef, getFieldDef 只适用于这些通道
 *
 * （只有"detail"和"order"可以有多个通道定义。
 * 由于detail和order可以有多个fieldDef，getFieldDef/model.fieldDef
 * 不适用于它们。同样，选择投影也不适用于"detail"和"order"。）
 */
export const SINGLE_DEF_CHANNELS = keys(SINGLE_DEF_CHANNEL_INDEX);

// 单一定义通道类型
export type SingleDefChannel = (typeof SINGLE_DEF_CHANNELS)[number];

// 单元单一定义通道
export const SINGLE_DEF_UNIT_CHANNELS = keys(SINGLE_DEF_UNIT_CHANNEL_INDEX);

// 单元单一定义通道类型
export type SingleDefUnitChannel = (typeof SINGLE_DEF_UNIT_CHANNELS)[number];

/**
 * 检查给定字符串是否为单元单一定义通道
 * @param str 要检查的字符串
 * @returns 如果是单元单一定义通道则返回true
 */
export function isSingleDefUnitChannel(str: string): str is SingleDefUnitChannel {
  return hasOwnProperty(SINGLE_DEF_UNIT_CHANNEL_INDEX, str);
}

/**
 * 检查给定字符串是否为有效通道
 * @param str 要检查的字符串
 * @returns 如果是有效通道则返回true
 */
export function isChannel(str: string): str is Channel {
  return hasOwnProperty(CHANNEL_INDEX, str);
}

// 次要范围通道类型
export type SecondaryRangeChannel =
  | typeof X2
  | typeof Y2
  | typeof LATITUDE2
  | typeof LONGITUDE2
  | typeof THETA2
  | typeof RADIUS2;

// 所有次要范围通道
export const SECONDARY_RANGE_CHANNEL: SecondaryRangeChannel[] = [X2, Y2, LATITUDE2, LONGITUDE2, THETA2, RADIUS2];

/**
 * 检查给定通道是否为次要范围通道
 * @param c 要检查的扩展通道
 * @returns 如果是次要范围通道则返回true
 */
export function isSecondaryRangeChannel(c: ExtendedChannel): c is SecondaryRangeChannel {
  const main = getMainRangeChannel(c);
  return main !== c;
}

// 主通道类型映射
export type MainChannelOf<C extends ExtendedChannel> = C extends typeof X2
  ? typeof X
  : C extends typeof Y2
  ? typeof Y
  : C extends typeof LATITUDE2
  ? typeof LATITUDE
  : C extends typeof LONGITUDE2
  ? typeof LONGITUDE
  : C extends typeof THETA2
  ? typeof THETA
  : C extends typeof RADIUS2
  ? typeof RADIUS
  : C;

/**
 * 获取范围通道对应的主通道。例如，对于`x2`返回`x`。
 * @param channel 扩展通道
 * @returns 对应的主通道
 */
export function getMainRangeChannel<C extends ExtendedChannel>(channel: C): MainChannelOf<C> {
  switch (channel) {
    case X2:
      return X as MainChannelOf<C>;
    case Y2:
      return Y as MainChannelOf<C>;
    case LATITUDE2:
      return LATITUDE as MainChannelOf<C>;
    case LONGITUDE2:
      return LONGITUDE as MainChannelOf<C>;
    case THETA2:
      return THETA as MainChannelOf<C>;
    case RADIUS2:
      return RADIUS as MainChannelOf<C>;
  }
  return channel as MainChannelOf<C>;
}

// 次要通道类型映射
export type SecondaryChannelOf<C extends Channel> = C extends typeof X
  ? typeof X2
  : C extends typeof Y
  ? typeof Y2
  : C extends typeof LATITUDE
  ? typeof LATITUDE2
  : C extends typeof LONGITUDE
  ? typeof LONGITUDE2
  : C extends typeof THETA
  ? typeof THETA2
  : C extends typeof RADIUS
  ? typeof RADIUS2
  : undefined;

/**
 * 获取Vega中对应的位置通道名称
 * @param channel 极坐标或笛卡尔位置通道
 * @returns Vega中的位置通道名称
 */
export function getVgPositionChannel(channel: PolarPositionChannel | PositionChannel) {
  if (isPolarPositionChannel(channel)) {
    switch (channel) {
      case THETA:
        return 'startAngle';
      case THETA2:
        return 'endAngle';
      case RADIUS:
        return 'outerRadius';
      case RADIUS2:
        return 'innerRadius';
    }
  }
  return channel;
}

/**
 * 获取主通道对应的次要范围通道。例如，对于`x`返回`x2`。
 * @param channel 通道
 * @returns 对应的次要范围通道，如果没有则返回undefined
 */
export function getSecondaryRangeChannel<C extends Channel>(channel: C): SecondaryChannelOf<C> | undefined {
  switch (channel) {
    case X:
      return X2 as SecondaryChannelOf<C>;
    case Y:
      return Y2 as SecondaryChannelOf<C>;
    case LATITUDE:
      return LATITUDE2 as SecondaryChannelOf<C>;
    case LONGITUDE:
      return LONGITUDE2 as SecondaryChannelOf<C>;
    case THETA:
      return THETA2 as SecondaryChannelOf<C>;
    case RADIUS:
      return RADIUS2 as SecondaryChannelOf<C>;
  }
  return undefined;
}

/**
 * 获取位置通道对应的尺寸通道
 * @param channel 位置通道
 * @returns 对应的尺寸通道名称
 */
export function getSizeChannel(channel: PositionChannel): 'width' | 'height';
export function getSizeChannel(channel: Channel): 'width' | 'height' | undefined;
export function getSizeChannel(channel: Channel): 'width' | 'height' | undefined {
  switch (channel) {
    case X:
    case X2:
      return 'width';
    case Y:
    case Y2:
      return 'height';
  }
  return undefined;
}

/**
 * 获取通道对应的偏移通道名称
 * @param channel 通道
 * @returns 对应的偏移通道名称
 */
export function getOffsetChannel(channel: Channel) {
  switch (channel) {
    case X:
      return 'xOffset';
    case Y:
      return 'yOffset';
    case X2:
      return 'x2Offset';
    case Y2:
      return 'y2Offset';
    case THETA:
      return 'thetaOffset';
    case RADIUS:
      return 'radiusOffset';
    case THETA2:
      return 'theta2Offset';
    case RADIUS2:
      return 'radius2Offset';
  }
  return undefined;
}

/**
 * 获取通道对应的带比例尺的偏移通道
 * @param channel 通道
 * @returns 对应的带比例尺的偏移通道
 */
export function getOffsetScaleChannel(channel: Channel): OffsetScaleChannel {
  switch (channel) {
    case X:
      return 'xOffset';
    case Y:
      return 'yOffset';
  }
  return undefined;
}

/**
 * 从偏移通道获取对应的主位置通道
 * @param channel 偏移通道
 * @returns 对应的主位置通道
 */
export function getMainChannelFromOffsetChannel(channel: OffsetScaleChannel): PositionScaleChannel {
  switch (channel) {
    case 'xOffset':
      return X;
    case 'yOffset':
      return Y;
  }
}

// 所有单元通道（不包含ROW和COLUMN）
export const UNIT_CHANNELS = keys(UNIT_CHANNEL_INDEX);

// 非位置通道 = 单元通道减去X, Y, X2, Y2等位置相关通道
const {
  [X]: _x,
  [Y]: _y,
  // x2和y2共享与x和y相同的比例尺
  [X2]: _x2,
  [Y2]: _y2,
  // 其他位置相关通道
  [XOFFSET]: _xo,
  [YOFFSET]: _yo,
  [LATITUDE]: _latitude,
  [LONGITUDE]: _longitude,
  [LATITUDE2]: _latitude2,
  [LONGITUDE2]: _longitude2,
  [THETA]: _theta,
  [THETA2]: _theta2,
  [RADIUS]: _radius,
  [RADIUS2]: _radius2,
  // 剩余的单元通道都有比例尺
  ...NONPOSITION_CHANNEL_INDEX
} = UNIT_CHANNEL_INDEX;

// 所有非位置通道
export const NONPOSITION_CHANNELS = keys(NONPOSITION_CHANNEL_INDEX);
// 非位置通道类型
export type NonPositionChannel = (typeof NONPOSITION_CHANNELS)[number];

// 位置比例尺通道索引
const POSITION_SCALE_CHANNEL_INDEX = {
  [X]: 1,
  [Y]: 1,
} as const;
// 所有位置比例尺通道
export const POSITION_SCALE_CHANNELS = keys(POSITION_SCALE_CHANNEL_INDEX);
// 位置比例尺通道类型
export type PositionScaleChannel = keyof typeof POSITION_SCALE_CHANNEL_INDEX;

/**
 * 检查给定通道是否为X或Y位置通道
 * @param channel 要检查的扩展通道
 * @returns 如果是X或Y位置通道则返回true
 */
export function isXorY(channel: ExtendedChannel): channel is PositionScaleChannel {
  return hasOwnProperty(POSITION_SCALE_CHANNEL_INDEX, channel);
}

// 极坐标位置比例尺通道索引
const POLAR_POSITION_SCALE_CHANNEL_INDEX = {
  [THETA]: 1,
  [RADIUS]: 1,
} as const;

// 所有极坐标位置比例尺通道
export const POLAR_POSITION_SCALE_CHANNELS = keys(POLAR_POSITION_SCALE_CHANNEL_INDEX);
// 极坐标位置比例尺通道类型
export type PolarPositionScaleChannel = keyof typeof POLAR_POSITION_SCALE_CHANNEL_INDEX;

/**
 * 根据尺寸类型获取对应的位置比例尺通道
 * @param sizeType 尺寸类型（宽度或高度）
 * @returns 对应的位置比例尺通道
 */
export function getPositionScaleChannel(sizeType: 'width' | 'height'): PositionScaleChannel {
  return sizeType === 'width' ? X : Y;
}

// 偏移比例尺通道索引
const OFFSET_SCALE_CHANNEL_INDEX: {xOffset: 1; yOffset: 1} = {xOffset: 1, yOffset: 1};

// 所有偏移比例尺通道
export const OFFSET_SCALE_CHANNELS = keys(OFFSET_SCALE_CHANNEL_INDEX);

// 偏移比例尺通道类型
export type OffsetScaleChannel = (typeof OFFSET_SCALE_CHANNELS)[0];

/**
 * 检查给定通道是否为X或Y偏移通道
 * @param channel 要检查的通道
 * @returns 如果是X或Y偏移通道则返回true
 */
export function isXorYOffset(channel: Channel): channel is OffsetScaleChannel {
  return hasOwnProperty(OFFSET_SCALE_CHANNEL_INDEX, channel);
}

// 时间比例尺通道索引
const TIME_SCALE_CHANNEL_INDEX = {
  [TIME]: 1,
} as const;
// 所有时间比例尺通道
export const TIME_SCALE_CHANNELS = keys(TIME_SCALE_CHANNEL_INDEX);
// 时间比例尺通道类型
export type TimeScaleChannel = keyof typeof TIME_SCALE_CHANNEL_INDEX;

/**
 * 检查给定通道是否为时间通道
 * @param channel 要检查的扩展通道
 * @returns 如果是时间通道则返回true
 */
export function isTime(channel: ExtendedChannel): channel is TimeScaleChannel {
  return channel in TIME_SCALE_CHANNEL_INDEX;
}

// 非位置比例尺通道 = 非位置通道减去没有比例尺的通道
const {
  // text和tooltip有格式而不是比例尺，
  // href既没有格式也没有比例尺
  [TEXT]: _t,
  [TOOLTIP]: _tt,
  [HREF]: _hr,
  [URL]: _u,
  [DESCRIPTION]: _al,
  // detail和order没有比例尺
  [DETAIL]: _dd,
  [KEY]: _k,
  [ORDER]: _oo,
  ...NONPOSITION_SCALE_CHANNEL_INDEX
} = NONPOSITION_CHANNEL_INDEX;

// 所有非位置比例尺通道
export const NONPOSITION_SCALE_CHANNELS = keys(NONPOSITION_SCALE_CHANNEL_INDEX);
// 非位置比例尺通道类型
export type NonPositionScaleChannel = (typeof NONPOSITION_SCALE_CHANNELS)[number];

/**
 * 检查给定通道是否为非位置比例尺通道
 * @param channel 要检查的通道
 * @returns 如果是非位置比例尺通道则返回true
 */
export function isNonPositionScaleChannel(channel: Channel): channel is NonPositionScaleChannel {
  return hasOwnProperty(NONPOSITION_CHANNEL_INDEX, channel);
}

/**
 * 判断Vega是否支持特定通道的图例
 * @param channel 非位置比例尺通道
 * @returns 是否支持图例
 */
export function supportLegend(channel: NonPositionScaleChannel) {
  switch (channel) {
    case COLOR:
    case FILL:
    case STROKE:
    case SIZE:
    case SHAPE:
    case OPACITY:
    case STROKEWIDTH:
    case STROKEDASH:
      return true;
    case FILLOPACITY:
    case STROKEOPACITY:
    case ANGLE:
    case TIME:
      return false;
  }
}

// 比例尺通道索引
const SCALE_CHANNEL_INDEX = {
  ...POSITION_SCALE_CHANNEL_INDEX,
  ...POLAR_POSITION_SCALE_CHANNEL_INDEX,
  ...OFFSET_SCALE_CHANNEL_INDEX,
  ...NONPOSITION_SCALE_CHANNEL_INDEX,
};

/** 所有带比例尺的通道列表 */
export const SCALE_CHANNELS = keys(SCALE_CHANNEL_INDEX);
// 比例尺通道类型
export type ScaleChannel = (typeof SCALE_CHANNELS)[number];

/**
 * 检查给定通道是否为带比例尺的通道
 * @param channel 要检查的扩展通道
 * @returns 如果是带比例尺的通道则返回true
 */
export function isScaleChannel(channel: ExtendedChannel): channel is ScaleChannel {
  return hasOwnProperty(SCALE_CHANNEL_INDEX, channel);
}

// 支持的标记类型映射
export type SupportedMark = Partial<Record<Mark, 'always' | 'binned'>>;

/**
 * 返回通道是否支持特定的标记类型
 * @param channel 通道名称
 * @param mark 标记类型
 * @return 标记是否支持该通道
 */
export function supportMark(channel: ExtendedChannel, mark: Mark) {
  return getSupportedMark(channel)[mark];
}

// 所有标记类型映射
const ALL_MARKS: Record<Mark, 'always'> = {
  // 所有标记类型
  arc: 'always',
  area: 'always',
  bar: 'always',
  circle: 'always',
  geoshape: 'always',
  image: 'always',
  line: 'always',
  rule: 'always',
  point: 'always',
  rect: 'always',
  square: 'always',
  trail: 'always',
  text: 'always',
  tick: 'always',
};

// 除了geoshape之外的所有标记类型
const {geoshape: _g, ...ALL_MARKS_EXCEPT_GEOSHAPE} = ALL_MARKS;

/**
 * 返回一个字典，显示通道是否支持标记类型
 * @param channel 通道
 * @return 一个将标记类型映射到'always'、'binned'或undefined的字典
 */
function getSupportedMark(channel: ExtendedChannel): SupportedMark {
  switch (channel) {
    case COLOR:
    case FILL:
    case STROKE:
    // 贯穿到下面的情况
    case DESCRIPTION:
    case DETAIL:
    case KEY:
    case TOOLTIP:
    case HREF:
    case ORDER: // TODO: 修订（order可能不支持rect，因为它不可堆叠？）
    case OPACITY:
    case FILLOPACITY:
    case STROKEOPACITY:
    case STROKEWIDTH:
    // 贯穿到下面的情况
    case FACET:
    case ROW: // 贯穿
    case COLUMN:
      return ALL_MARKS;
    case X:
    case Y:
    case XOFFSET:
    case YOFFSET:
    case LATITUDE:
    case LONGITUDE:
    case TIME:
      // 除了geoshape之外的所有标记。geoshape不使用X、Y，而是使用投影
      return ALL_MARKS_EXCEPT_GEOSHAPE;
    case X2:
    case Y2:
    case LATITUDE2:
    case LONGITUDE2:
      return {
        area: 'always',
        bar: 'always',
        image: 'always',
        rect: 'always',
        rule: 'always',
        circle: 'binned',
        point: 'binned',
        square: 'binned',
        tick: 'binned',
        line: 'binned',
        trail: 'binned',
      };
    case SIZE:
      return {
        point: 'always',
        tick: 'always',
        rule: 'always',
        circle: 'always',
        square: 'always',
        bar: 'always',
        text: 'always',
        line: 'always',
        trail: 'always',
      };
    case STROKEDASH:
      return {
        line: 'always',
        point: 'always',
        tick: 'always',
        rule: 'always',
        circle: 'always',
        square: 'always',
        bar: 'always',
        geoshape: 'always',
      };
    case SHAPE:
      return {point: 'always', geoshape: 'always'};
    case TEXT:
      return {text: 'always'};
    case ANGLE:
      return {point: 'always', square: 'always', text: 'always'};
    case URL:
      return {image: 'always'};
    case THETA:
      return {text: 'always', arc: 'always'};
    case RADIUS:
      return {text: 'always', arc: 'always'};
    case THETA2:
    case RADIUS2:
      return {arc: 'always'};
  }
}

/**
 * 获取通道的范围类型
 * @param channel 扩展通道
 * @returns 范围类型
 */
export function rangeType(channel: ExtendedChannel): RangeType {
  switch (channel) {
    case X:
    case Y:
    case THETA:
    case RADIUS:
    case XOFFSET:
    case YOFFSET:
    case SIZE:
    case ANGLE:
    case STROKEWIDTH:
    case OPACITY:
    case FILLOPACITY:
    case STROKEOPACITY:
    case TIME:

    // X2和Y2使用X和Y比例尺，因此它们同样具有连续范围。[贯穿]
    case X2:
    case Y2:
    case THETA2:
    case RADIUS2:
      return undefined;

    case FACET:
    case ROW:
    case COLUMN:
    case SHAPE:
    case STROKEDASH:
    // TEXT、TOOLTIP、URL和HREF没有比例尺但有离散输出 [贯穿]
    case TEXT:
    case TOOLTIP:
    case HREF:
    case URL:
    case DESCRIPTION:
      return 'discrete';

    // 颜色可以是连续的或离散的，取决于比例尺类型。
    case COLOR:
    case FILL:
    case STROKE:
      return 'flexible';

    // 没有比例尺，没有范围类型。
    case LATITUDE:
    case LONGITUDE:
    case LATITUDE2:
    case LONGITUDE2:
    case DETAIL:
    case KEY:
    case ORDER:
      return undefined;
  }
}
