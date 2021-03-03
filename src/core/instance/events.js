/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

/**
 * 
 * @param {*} vm
 * 初始化事件
 */
export function initEvents (vm: Component) {
  /**
   * 向实例上添加_events属性，用来存储绑定的事件
   */
  vm._events = Object.create(null)

  // 标记是不是绑定了钩子事件
  vm._hasHookEvent = false

  // init parent attached events
  /**
   * 初始化自定义组件在标签上绑定的事件，如
   * <xxx @click='foo' @moo='moo' />
   * 这里的vm.$options._parentListeners指的就是组件上的click, moo,形式如下
   * {
   *    click: function invoker() {},
   *    moo: function invoker() {},
   * }
   * 这里的事件配置是经过createFnInvoker处理过的,返回的都是invoker函数
   * invoker上面fns属性才是我们绑定的函数，这么做的目的是
   * 为了对我们绑定的函数做一层invokeWithErrorHandling包装，
   * 当我们触发事件的时候调用的是invoker，内部会取到invoker.fns交由invokeWithErrorHandling调用
   * 当我们绑定的函数在执行期间出错的时候会被捕获，并提示出报错信息
   * 注意：只有自定义组件才有_parentListeners
   */
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

// 绑定事件
function add (event, fn) {
  target.$on(event, fn)
}

// 移除事件
function remove (event, fn) {
  target.$off(event, fn)
}

// 创建一次性事件句柄
function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

/**
 * 
 * @param {*} vm 
 * @param {*} listeners 
 * @param {*} oldListeners 
 * 更新绑定的事件，因为我们在render的时候，绑定的事件可能会改变
 */
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  /**
   * 初始化挂载和更新原生dom事件也会调用这个方法
   * 只是传入的 add, remove 方法不一样
   * 初始化的时候oldListeners是没有值的
   */
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

/**
 * 
 * @param {*} Vue 
 * 混入事件相关的实例方法
 */
export function eventsMixin (Vue: Class<Component>) {

  /**
   * 绑定事件
   */
  const hookRE = /^hook:/
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    /**
     * 如果绑定的事件名称是数组，会遍历单独绑定
     */
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      /**
       * 如果绑定的是单个事件名称，就是在_events上面对这种类型事件队列里插入
       */
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      // 绑定的是生命周期钩子事件 如'hook:created'
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  /**
   * 
   * @param {*} event 
   * @param {*} fn 
   * 绑定一次性事件
   */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this

    /**
     * 这里可以看出对于一次性事件
     * vue是做了包装的，内部调用，同事会在包装函数上使用fn来缓存我们传入的函数
     */
    function on () {
      // 调用的时候解绑
      vm.$off(event, on)
      // 调用我们传入的函数
      fn.apply(vm, arguments)
    }
    // 这里很重要
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  /**
   * 
   * @param {*} event 
   * @param {*} fn 
   * 解绑事件
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 什么都没有传，解绑所有事件
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    // 解绑多种事件，递归调用解绑函数
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }

    // specific event
    /**
     * 解绑没有绑定的事件，不做任何处理
     */
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }

    /**
     * 不传函数，说明要解绑当前类型所有的事件
     */
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    /**
     * 解绑单个类型的单个事件，这里注意cb === fn || cb.fn === fn这个判断
     * cb === fn 这个判断解绑的是我们正常绑定的事件
     * cb.fn === fn 这个判断解绑的是我们一次性事件
     * 因为我们我们绑定的一次性事件其实是被包装后的，从上面的$once我们知道
     * vue会把我们传入的函数缓存到绑定函数的fn属性上，所以这里只有通过cb.fn才能找到我们绑定的函数
     * 这里可能有个疑点就是既然绑定的是一次性事件，为什么还要去解绑呢
     * 其实原因就是我们可能在一次性函数还没有你被调用的时候就解绑了事件
     */
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1) // 从事件队里里面删除事件句柄
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
