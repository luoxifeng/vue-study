/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * 渲染插槽
 * Runtime helper for rendering <slot>
 * 运行时渲染工具函数 target._t = renderSlot
 */
export function renderSlot (
  name: string,
  fallback: ?Array<VNode>,
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  // 取作用域插槽
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes

  if (scopedSlotFn) { // scoped slot
    props = props || {}
    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)
    }
    /**
     * 作用域插槽被编译成一个函数
     * 返回虚拟节点
     */ 
    nodes = scopedSlotFn(props) || fallback
  } else {
    // 非作用域插槽被直接渲染成虚拟节点
    nodes = this.$slots[name] || fallback
  }

  /**
   * 如果当前的插槽作为别的组件的插槽
   */
  const target = props && props.slot
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
