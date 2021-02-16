/* @flow */
/**
 * 处理作用域插槽
 * 运行时作为渲染函数的help工具
 * target._u = resolveScopedSlots
 * 作用是把作用域插槽变成对象映
 * {
 *    default() {},
 *    foo() {}
 * }
 * 如果我们在写jsx的时候，是直接可以写成这样子的
 * 作用域插槽是作用组件的属性存在侧
 * <Foo
 *    scopedSlots={{
 *      default() {},
 *      foo() {}
 *    }}
 * />
 * @param {*} fns 
 * @param {*} res 
 * @param {*} hasDynamicKeys 
 * @param {*} contentHashKey 
 */
export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object,
  // the following are added in 2.6
  hasDynamicKeys?: boolean,
  contentHashKey?: number
): { [key: string]: Function, $stable: boolean } {
  res = res || { $stable: !hasDynamicKeys }
  for (let i = 0; i < fns.length; i++) {
    const slot = fns[i]
    if (Array.isArray(slot)) {
      resolveScopedSlots(slot, res, hasDynamicKeys)
    } else if (slot) {
      // marker for reverse proxying v-slot without scope on this.$slots
      if (slot.proxy) {
        slot.fn.proxy = true
      }
      res[slot.key] = slot.fn
    }
  }
  if (contentHashKey) {
    (res: any).$key = contentHashKey
  }
  return res
}
