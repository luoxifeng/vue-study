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
   * 这里的vm.$options._parentListeners指的就是组件上的click, moo
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
 * updateListeners可以处理Dom事件和组件自定义事件，
 * 处理逻辑是一致的，区别在于传入的add, remove, createOnceHandler等工具函数不同
 * 这里传入的是处理组件事件的工具函数，内部处理的是组件实例上面的事件绑定，卸载
 * 原生Dom处理的就是调用addEventListener， removeEventListener原生方法
 * 
 * 这个函数有两个地方会调用
 * 1.initEvents，组件初始化调用this._init(), _init进行初始化流程会调用initEvents
 *  如果组件占位节点上有绑定事件，即vm.￥options._parentListeners有值会调用，
 * 
 * 2.父组件rerender的时候，调用组件的data.hook.prepatch钩子，里面调用updateChildComponent，
 * updateChildComponent里面调用updateComponentListeners把新的事件绑定更新到实例上
 */
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
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

  /**
   * 
   * @param {*} event 
   * 触发事件
   */
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    /**
     * Vue在这里做了智能提示，如果我们传入的是非小写的事件名但是却找到了小写的事件名称,
     * 比如:
     * 在Dom模板中<xxx v-on:fooHandler='foo' /> 我们绑定了fooHandler
     * 触发的时候传的也是fooHandler, vue猜测可能是使用fooHandler这种驼峰命名绑定的
     * 但是vue实际找到的却是foohandler绑定的，就会提示在 `Dom模板` 中html attributes是大小写不敏感的，
     * 建议（在Dom模板中）不要使用驼峰命名绑定，应该使用foo-handler来代替fooHandler
     * 
     * Dom模板：
     * 指的是我们传入了一个真实的Dom元素作为模板，不是vue单文件的<template>字符串模板也不是编译时的模板
     * 因为真实的dom属性大小写不明感，即使我们书写的是fooHandler，获取到的却是foohandler，可能会引发问题
     */
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
    
    /**
     * 找到绑定的事件句柄遍历的调用
     */
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        /**
         * 对调用的函数做一层包装，为了捕获可能的出错，然后提示
         * vue帮我们绑定的事件其实已经做了一层包装，
         * 但是我们可能会手动的调用this.$on('xxx', yyyy)
         * 这种情况下我们一般不会对yyy做包装，如果在emit阶段出错
         * 会影响同类事件其他的函数执行，所以vue在emit的时候做了包装
         * 以保证出错了提示错误信息，同事包装其他的事件句柄正常执行
         */
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
