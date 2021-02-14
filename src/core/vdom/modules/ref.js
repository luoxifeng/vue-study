/* @flow */

import { remove, isDef } from 'shared/util'

export default {
  /**
   * 创建的时候注册
   * @param {*} _ 
   * @param {*} vnode 
   */
  create (_: any, vnode: VNodeWithData) {
    registerRef(vnode)
  },
  /**
   * 更新的时候，对比新老节点的ref,如果不相等，删除旧节点的注册，注册新节点
   * @param {*} oldVnode 
   * @param {*} vnode 
   */
  update (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true)
      registerRef(vnode)
    }
  },
  /**
   * 销毁的时候删除
   * @param {*} vnode 
   */
  destroy (vnode: VNodeWithData) {
    registerRef(vnode, true)
  }
}

/**
 * 注册ref引用
 * @param {*} vnode 
 * @param {*} isRemoval 
 */
export function registerRef (vnode: VNodeWithData, isRemoval: ?boolean) {
  // 如果没有ref
  const key = vnode.data.ref
  if (!isDef(key)) return

  // 取上下文
  const vm = vnode.context
  /**
   * 注册在组件上就是组件实例，如果是原生标签就取原生标签生成的Dom
   */
  const ref = vnode.componentInstance || vnode.elm
  const refs = vm.$refs

  // 如果需要删除
  if (isRemoval) {
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref)
    } else if (refs[key] === ref) {
      refs[key] = undefined
    }
  } else {
    // 新注册
    if (vnode.data.refInFor) {
      if (!Array.isArray(refs[key])) {
        refs[key] = [ref]
      } else if (refs[key].indexOf(ref) < 0) {
        // $flow-disable-line
        refs[key].push(ref)
      }
    } else {
      refs[key] = ref
    }
  }
}
