/*
 * 单元规范（Unit Specification）相关的类型定义和工具函数
 * 单元规范表示单个视图的可视化配置
 */

import {FieldName} from '../channeldef.js';
import {CompositeEncoding, FacetedCompositeEncoding} from '../compositemark/index.js';
import {Encoding} from '../encoding.js';
import {ExprRef} from '../expr.js';
import {AnyMark, Mark, MarkDef} from '../mark.js';
import {Projection} from '../projection.js';
import {SelectionParameter} from '../selection.js';
import {hasProperty} from '../util.js';
import {Field} from './../channeldef.js';
import {BaseSpec, DataMixins, FrameMixins, GenericCompositionLayout, ResolveMixins} from './base.js';
import {TopLevel, TopLevelParameter} from './toplevel.js';

/**
 * 单元（单视图）规范的基础接口
 * @template E 编码类型，必须扩展自Encoding
 * @template M 标记类型
 * @template P 参数类型，默认为SelectionParameter
 */
export interface GenericUnitSpec<E extends Encoding<any>, M, P = SelectionParameter> extends BaseSpec {
  /**
   * 描述标记类型的字符串（"bar"、"circle"、"square"、"tick"、"line"、
   * "area"、"point"、"rule"、"geoshape"和"text"之一）或[标记定义对象]。
   */
  mark: M;

  /**
   * 编码通道与字段定义之间的键值映射。
   */
  encoding?: E;

  /**
   * 定义地理投影属性的对象，将应用于"geoshape"标记的`shape`路径
   * 以及其他标记的`latitude`和`longitude`通道。
   */
  projection?: Projection<ExprRef>;

  /**
   * 参数数组，可以是简单变量，也可以是更复杂的选择器，用于将用户输入映射到数据查询。
   */
  params?: P[];
}

/**
 * 没有任何快捷方式/扩展语法的单元规范。
 * 使用完全规范化的编码和标记定义。
 */
export type NormalizedUnitSpec = GenericUnitSpec<Encoding<FieldName>, Mark | MarkDef>;

/**
 * 单元规范，可以包含[基本标记或复合标记]。
 * @template F 字段类型
 */
export type UnitSpec<F extends Field> = GenericUnitSpec<CompositeEncoding<F>, AnyMark>;

/**
 * 带有框架属性的单元规范
 * @template F 字段类型
 */
export type UnitSpecWithFrame<F extends Field> = GenericUnitSpec<CompositeEncoding<F>, AnyMark> & FrameMixins;

/**
 * 可以有复合标记和行或列通道的单元规范（分面规范的简写形式）。
 * @template F 字段类型
 * @template P 参数类型，默认为SelectionParameter
 */
export type FacetedUnitSpec<F extends Field, P = SelectionParameter> = GenericUnitSpec<
  FacetedCompositeEncoding<F>,
  AnyMark,
  P
> &
  ResolveMixins &
  GenericCompositionLayout &
  FrameMixins;

/**
 * 顶级单元规范，包含数据混合属性
 * @template F 字段类型
 */
export type TopLevelUnitSpec<F extends Field> = TopLevel<FacetedUnitSpec<F, TopLevelParameter>> & DataMixins;

/**
 * 检查给定规范是否为单元规范
 * @param spec 要检查的基础规范
 * @returns 如果是分面单元规范或规范化单元规范，则返回true
 */
export function isUnitSpec(spec: BaseSpec): spec is FacetedUnitSpec<any> | NormalizedUnitSpec {
  return hasProperty(spec, 'mark');
}
