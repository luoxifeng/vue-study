/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

/**
 * 组件实例是在 patch 阶段创建的
 */
// inline hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      /**
       * 根据虚拟dom节点，创建组件实例
       */
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      )
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  /**
   * 组件更新阶段执行，第一次初始化组件不会执行
   * @param {*} oldVnode 
   * @param {*} vnode 
   */
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  /**
   * 第一次初始化组件，dom插入到文档流以后执行
   * 注意在patch阶段生成真实dom会插入到父dom节点，这个时候父节点可能还不在文档流
   * 但是这时候并不会调用，只有所有组件都完成patch,
   * 并且插入到文档流以后才会调用
   * @param {*} vnode 
   */
  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

/**
 * render阶段调用，创建组件的占位节点
 * @param {*} Ctor 
 * @param {*} data 
 * @param {*} context 
 * @param {*} children 
 * @param {*} tag 
 */
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  /**
   * 处理异步组件
   */
  // async component
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor);
    /**
     * 当异步工厂函数，没有返回任何组件的时候
     * （当设置了高阶组件的时候可能返回loading也可能返回error）
     * 创建一个注释节点占位
     */
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  resolveConstructorOptions(Ctor)

  /**
   * ! 处理v-model, 组件v-model语法糖的原理
   */
  // transform component v-model data into props & events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  /**
   * data.on 在组件上表示绑定在组件的事件
   */
  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on

  /**
   * data.nativeOn 表示需要绑定在原生dom上的事件
   * data.on = data.nativeOn 赋值给了 data.on
   * 因为在由虚拟Node创建真实domd的时候 
   * data.on 会绑定在真实dom上
   */
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  /**
   * ! 这一步非常关键，在render阶段创建组件占位节点
   * ! 把组件的钩子函数，挂载到占位节点的data.hook上
   * ! 在patch阶段调用patch工厂函数内的createComponent(core/vdom/patch)方法
   * ! 通过调用占位节点的data.hook.init钩子实例化组件实例
   */
  // install component management hooks onto the placeholder node
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}

// 创建组件实例，根据vnode上面的componentOption配置
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnode.componentOptions.Ctor(options)
}

/**
 * 自定义组件在特定阶段都有自己的钩子，在render,patch阶段都会调用这些函数
 * 这个方法就是把框架内部默认的组件钩子，以及用户配置的钩子做一个合并
 */
function installComponentHooks (data: VNodeData) {
  /**
   * 默认情况下data.hook是没有值的但有以下情况可以注入
   * 
   * 1.jsx情况下使用扩展运算符展开对象属性， hook会和attrs并列都属于data, data: { attrs, hook }
   * <SomeComponent {...{ hook: {insert() {} }}} foo='123' ref='xxx'/>
   * 以上会被编译成
   * h(
   *    SomeComponent, 
   *    mergeJsxProps([
   *      { attrs: { foo: 123 }},
   *      { hook: {insert() {} }},
   *      { ref: 'xxx' }
   *    ])
   * )
   * mergeJsxProps这个方法会把数组规约成一个对象也就是vnode.data,结果如下
   * h(
   *    SomeComponent, 
   *    { 
   *      attrs: { foo: 123 }
   *      hook: { insert() {} }
   *      ref: 'xxx'
   *    }
   * )
   * 从结果看这种方式实现了注入hook
   *
   * 2.手写render函数
   * export default {
   *  render(h) {
   *    return  h(SomeComponent, {
   *      attrs: { foo: 123 },
   *      hook: {
   *        insert() {}
   *      }
   *    })
   *  }
   * }
   * 如上所示，就可以实现注入hook,其实这种方式和jsx编译的结果比较类似
   * jsx最终也是要处理成这样，结果是一样的，并且vue-router内部也是这样做的，
   * 如果你想控制组件的生命周期过程也常常会采用这种方式，
   * 不用借助jsx编译，一般组件库内部也会使用这种方式
   */
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

function mergeHook (f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

/**
 * ! 你在自定义组件的时候使用了v-model，
 * ! 在编译阶段以后v-model会被生成 model: { value, callback },存在于vnode.data
 * ! render阶段，在创建vnode的时候，如果vnode.data上存在model
 * ! 需要对vnode.data做转换，
 * @param {*} options 
 * @param {*} data 
 */
// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel (options, data: any) {
  /**
   * 根据配置为model上的value以及默认要绑定的事件名重命名
   * 从这里的源码可以看出默认情况下属性的值是 ‘value’ 回调函数的名字是 'input'
   */
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  /**
   * 赋值到data.attrs，为了下一步extractPropsFromVNodeData
   * 从attrs抽取出propsData
   */
  ;(data.attrs || (data.attrs = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  const existing = on[event]
  const callback = data.model.callback

  /**
   * 已经绑定过同类事件，验证当前要绑定的和之前的是不是重复，避免重复绑定
   * 一般情况下，生成的vnode是不会有同类事件已经绑定过得
   * 当 <SomeComponent v-model="xyz" @xxx='foo' @yyy='moo' />
   * 组件显式的绑定了和上一步event变量值相等的函数名，就会走到这个条件
   * 上面例子中foo，moo可能是函数数组，所以才有了对于数组的判断
   */
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing)
    }
  } else { // 如果没有绑定过就绑定
    on[event] = callback
  }
}
