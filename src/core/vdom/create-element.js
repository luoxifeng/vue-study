/* @flow */

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

/**
 * 创建vNode的入口
 * render阶段调用，只是创建原生标签或者自定义组件的vNode,
 * 最终构建成一个虚拟dom树
 * patch阶段也有一个createEle的方法，是根据这一步创建的dom树，
 * 递归地创建真实Dom,同时根据组件的占位节点实例化组件以及创建组件的虚拟Dom结构和真实Dom
 * 在创建组件虚拟dom的时候同样也会走到这一步，然后在根据这一步创建的vNode创建patch成真实Dom
 * 在组件构建真实Dom的时候，遇到子组件依然后重复上述步骤创建子组件的虚拟Dom以及真实Dom
 * 也就是说整个Dom的构建其实就是从根组件开始，先render构建成vNode, 根据vNode树patch成真实Dom,
 * 在patch阶段又会走到render -> vNode -> patch -> Dom
 * 整体过程如下
 *   ---------------------------------
 *  | render -> vNode -> patch -> Dom |
 *   ---------------------------------
 *                      /     
 *                     /
 *                    /
 *                    ---------------------------------
 *                   | render -> vNode -> patch -> Dom |
 *                    ---------------------------------
 *                                         /   
 *                                        /
 *                                       /
 *                                       ---------------------------------
 *                                      | render -> vNode -> patch -> Dom |
 *                                       ---------------------------------
 */
// wrapper function for providing a more flexible interface
// without getting yelled at by flow
export function createElement (
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}

// 创建元素
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    return createEmptyVNode()
  }

  // 动态组件 data.is 可能是字符串，也可能是组件的配置
  // object syntax in v-bind
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }
  // 如果子节点是数组，且第一个是函数，则把第一个当成是slot处理
  // support single function children as default scoped slot
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }
  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    // 原生标签
    if (config.isReservedTag(tag)) {
      /**
       * 非生产环境下，原生标签上面绑定事件的时候，不能出现.native，否则会提示
       */
      // platform built-in elements
      if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.nativeOn)) {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        )
      }
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}

/**
 * 处理带有命名空间的标签
 * @param {*} vnode 
 * @param {*} ns 
 * @param {*} force 
 */
function applyNS (vnode, ns, force) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (
        isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
        applyNS(child, ns, force)
      }
    }
  }
}

/**
 * 如果style以及class 是对象形式的，用在插槽上需要进行深层依赖收集，为什么这样做呢？
 * 
 * 1.普通节点
 * 在render阶段，取style,class的值的时候，会收集到当前组件的renderWatch
 * 在pacth阶段，会对style,class做stringify的时候，会取到属性style,class上面的属性，这样就属性也可以收集到当前组件的renderWatch
 * 所以在普通节点上使用动态的对象形式的style,class, 里面属性的改变会引起render,所以不需要做这一步操作也是可以的，
 * 
 * 2.插槽节点
 * 在render阶段，取style,class的值的时候，会收集到当前组件的renderWatch
 * 但是插槽节点作为子组件的children, patch是在子组件完成的，stringify的时候收集到的是子组件的renderWatch，
 * 当在父组件更改style,class上面属性的时候，并不会引起父组件的重新渲染，
 * 为了让当前组件（父组件）能重新渲染，所以需要在当前组件创建插槽节点vnode的时候，
 * 手动强制深度访问style,class上面的属性，去完成属性dep对当前组件renderWtach收集
 * 于是有了下面的步骤
 */
// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings (data) {
  if (isObject(data.style)) {
    traverse(data.style)
  }
  if (isObject(data.class)) {
    traverse(data.class)
  }
}
