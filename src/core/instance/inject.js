/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

/**
 * @param {*} vm
 * 初始化provide
 * 当存在provide选项的时候，
 * 如果是函数就调用函数,把得到的结果赋值到当前实例的_provided属性上
 * 从这里我们可以猜测当子组件使用inject的时候应该就是从这个属性上去取值
 * 其实vue内部确实也只这么做的
 */
export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

/**
 * 
 * @param {*} vm 
 * 初始化inject
 * 
 */
export function initInjections (vm: Component) {
  /**
   * 处理inject选项,获取最终的数据
   */
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    /**
     * 关闭响应式处理，后面又恢复了
     * vue官方文档特意说明了这是有意为之，
     * 不过如果父组件提供的是响应式数据，子组件取到的值也还是响应式的
     */
    toggleObserving(false) // 
    /**
     * 遍历inject所有属性，绑定到当前实例上
     */
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        /**
         * 非生产环境下设置了自定义setter
         * 这样做的目的是为了防止在当前组件直接修改inject的值
         * 因为在提供provided的组件re-render的时候会覆盖设置的值
         * 可能会带来问题
         * 从这些的代码可以看出inject映射下来的值是直接定义在当前实例上的
         * 并且并没有对数据进行响应式处理，也就是保留了上层组件提供的值
         * 如果provided组件提供的是响应式数据那么在inject以后也是响应式的
         */
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    /**
     * 这里的inject是经过mergeOptions规范化以后的数据
     * 形式是
     * {
     *   foo: {
     *    from: 'abc',
     *    default: () => ({})
     *   }
     * }
     */
    const result = Object.create(null)
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      /**
       * 跳过__ob__属性
       * 因为Reflect.ownKeys和Object.keys获取到的值不一样
       * Reflect.ownKeys会获取到__ob__，这会导致下面的代码
       * 在非生产环境下提示Injection "XXX" not found
       */
      if (key === '__ob__') continue

      /**
       * 这里很重要，是inject映射值最核心的原理
       * 定义一个中间变量，作为当前向上寻找的组件
       * 每一次遍历都判断当前组件上是不是提供了inject要映射的值
       * 如果存在就赋值然后停止查找，否则把上一层组件赋值给中间变量继续查找
       * 一直找到顶层，无论找不找到都退出循环
       */
      const provideKey = inject[key].from

      /**
       * vm为当前实例，不过不用担心，会取到当前实例的_provided
       * 因为在this._init里面initInject是在initPrivide之前调用的
       * 当initInject调用的时候，当前实例上是没有_provided的
       * 这样保证了provide提供的数据只有子组件可以使用
       */
      let source = vm
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      /**
       * 这里是没有找到，判断inject[key]上是不是提供了default属性（会查找原型链）
       * 如果提供了默认选项(可以是函数，去函数的返回结果)，就把默认值设置给inject[key]
       * 如果没有提供默认选项，非生产环境下报警提示
       * 这里说明下上面的__ob__,如果inject是响应式的数据，
       * 在非生产环境下，Reflect.ownKeys得到__ob__，走到这里会报警提示
       * 所以vue在上面跳过了__ob__这个内部属性
       */
      if (!source) {
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
