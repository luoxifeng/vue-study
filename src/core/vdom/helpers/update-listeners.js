/* @flow */

import {
  warn,
  invokeWithErrorHandling
} from 'core/util/index'
import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

/**
 * 规范化事件修饰符, 把修饰符转变成布尔值
 * 得到一个描述事件的对象
 * 
 */
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

export function createFnInvoker (fns: Function | Array<Function>, vm: ?Component): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
    }
  }
  invoker.fns = fns
  return invoker
}

/**
 * 
 * @param {*} on 
 * @param {*} oldOn 
 * @param {*} add 
 * @param {*} remove 
 * @param {*} createOnceHandler 
 * @param {*} vm 
 * 绑定和更新事件的绑定，此函数可以同时处理原生dom事件和组件的自定义事件
 * 通过传入不同的绑定（add）和解绑函数（remove）
 */
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, def, cur, old, event
  for (name in on) {
    def = cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    /**
     * 如果key存在，事件句柄不存在的话报警提示
     */
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      /**
       * old不存在，说明是此次是新绑定的事件，下面处理绑定的过程
       * cur.fns不存在说明没有经过处理，需要经过createFnInvoke处理
       * 从这里可以看出，进过这一步之前的句柄会被处理成invoker函数
       */
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur, vm)
      }
      /**
       * 如果是once事件，需要通过createOnceHandlerc重新创建句柄覆盖
       */
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }

      // 调用add绑定函数
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      /**
       * old存在说明说明之前也绑定了，
       * 只需要把当前的句柄cur更新到旧的invoker的fns上，然后使用old覆盖
       * 不要重新创建invoker函数，这样在diff的时候前后是一样的
       * 这样做用来避免当同一个事件句柄改变的时候而引起重新渲染
       */
      old.fns = cur
      on[name] = old
    }
  }

  /**
   * 如果事件在旧的事件中存在，新的上面不存在了说明需要解绑
   */
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
