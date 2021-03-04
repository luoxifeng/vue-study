/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 * 合并配置vue采用了策略模式，每种配置都有自己的合并策略
 * 这里是默认的策略，刚开始是空的也就是没有任何策略
 * 接下里会配置各种策略来合并相应的配置项
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 * 开发环境下，el， propsData的合并策略
 * 会做一个容错，自定义组件不允许使用el，propsData,
 * 如果使用了开发环境下会提示报警，然后调用defaultStrat
 * 如果是生产环境我们没有配置策略合并函数
 * 下面的mergeField函数里面第一行defaultStrat就会起作用
 * const strat = strats[key] || defaultStrat
 * 当一个配置选项不需要特殊处理的时候就是默认的合并策略defaultStrat
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    /**
     * vm不存在说明处理的是子组件，子组件里面使用el， propsData会报警提示
     * 为什么vm不存在就是子组件的，因为当前的策略是在c调用的
     * vm就是mergeOptions的第三个参数，那么什么时候mergeOptions会不穿第三个参数呢
     * 我们知道当调用this._init的时候里面有这样的代码
     * if (options && options._isComponent) { // 自定义组件实例
     *    initInternalComponent(vm, options)
     * } else { // vue实例
     *    vm.$options = mergeOptions(
     *      resolveConstructorOptions(vm.constructor),
     *      options || {},
     *      vm
     *    )
     * }
     * vm就是当前实例，虽然子组件实例化也会走this._init
     * 但是从上面代码里面看出，当时组件的时候走的 initInternalComponent(vm, options)
     * 这说明还有其他的地方调用mergeOptions，且没有传第三个参数，
     * 其实就是Vue.extend里面，有这样的代码
     * Sub.options = mergeOptions(
     *    Super.options,
     *    extendOptions
     * )
     * 这里是没有传第三个参数，Vue.extend函数就是处理子组件的构造器的
     * 所以我们知道当没有vm的时候是调用了Vue.extend在处理子组件
     * 因此我们根据vm的不存在来认为是子组件
     */
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 * 合并data配置，这里才是合并data数据的流程之前的流程是为了得到两个对象在这里进行合并
 * 1. 目标对象不存在的属性，使用来源对象来设置
 * 2. 目标对象存在的属性
 *  2.1 如果属性值是简单类型，不用设置
 *  2.2 属性值是对象对象且来源值也是对象类型且不相等，递归上述过程
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal

  // 取来源对象上所有的key值
  const keys = hasSymbol ? Reflect.ownKeys(from) : Object.keys(from)

  /**
   * 遍历来源的key值，需要把来源上所有的属性都合并到目标对象上
   */
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    /**
     * 如果对象已经是响应式的会跳过
     */
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      /**
       * 如果目标对象上本身不存在此属性
       * 就会使用来源对象上的值来对目标对象进行设置
       */
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      /**
       * 如果来源和目标值不相等且都是对象对象
       * 需要递归调用进行深层此合并
       */
      mergeData(toVal, fromVal)
    }
  }
  // 最终返回目标值
  return to
}

/**
 * Data
 * ! 重点：进过这里的处理以后options.data能始终保证是一个函数
 * ! 这个函数对原始的data进行了一层包装，里面做了合并操作
 * ! 函数在初始化的时候才真正调用
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  /**
   * 处理子组件
   */
  if (!vm) { 
    // in a Vue.extend merge, both should be functions
    /**
     * 使用 Vue.extend 处理选项，childVal 和 parentVal 都应该是函数
     * 下面的两个判断只有一个不存在就返回
     */
    if (!childVal) {
      /**
       * parentVal可能不为空
       * Vue.extend可以多层调用，parentVal不一定就是Vue.options
       * 比如
       *  const Parent = Vue.extend({ 
       *    data() {
       *      return { foo: 123 } 
       *    }
       *  })
       *  const Child = Parent.extend({})
       * 上述例子中Child是由Parent.extend产生的，
       * 这种情况下childVal不存在，而parentVal有值
       */
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    /**
     * 从上面的判断知道，来到这里childVal，parentVal都有值
     * 这里的返回结果是mergedDataFn函数，这个函数其实就是option.data
     * 这就保证了data始终是一个函数
     * !重点：初始化的时候才调用进行合并
     */
    return function mergedDataFn () {
      // 
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    /**
     * 实例上的合并
     * 也就是说我们通过下面这种方式创建
     * new Vue({
     *  el: '#app',
     *  data: { foo: 123 }
     * })
     * 进过这里处理以后data就是mergedInstanceDataFn
     * 始终保证是一个函数
     * !重点：初始化的时候才调用进行合并
     */
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      /**
       * 当前组件含有data,并且返回值存在进行合并
       * 否则返回来源数据
       */
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

/**
 * data的合并策略
 * @param {*} parentVal 
 * @param {*} childVal 
 * @param {*} vm 
 */
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    /**
     * 我们从strats.el那里知道，vm不存在是子组件
     * vue规定子组件data必须是一个函数
     */
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  // 传了vm，说明是正常new Vue产生的实例
  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 * 生命周期的合并的合并策略
 * 合并过程中回会生命周期进行断言，如果是数组就进行concat,否则转换成数组
 * 里面还有容错回退机制，如果当前实例没有生命周期，就沿用来源的
 * 最终是合并成一个函数数组，然后在进行一步去重操作
 * 这里可能有个疑问能保证最后返回的一定是个数组吗
 * 答案是如果返回的为不为空，就一定是数组，为什么呢
 * 我们根据下面的逻辑可以看到，当前组件配置生命周期的情况下一定会返回数组
 * 否则使用parentVal, parentVal来源于上一层组件，如果上一层没有配置继续往上
 * 如果中间有一层配置了生命周期，也就是当前这一层组件childVal有值，一定会返回数组
 * 如果一直向上都没有配置一直到Vue.options,因为Vue.options没有配置所以返回undefined
 * 在真正执行的时候callHook会做判断，不会执行
 * 如果Vue.options上配置的生命周期不是数组dedupeHooks会返回空数组
 * 所以按照Vue的要求如果要在Vue.options配置生命周期，应该配置为函数数组
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

/**
 * 对生命周期进行去重
 * @param {*} hooks 
 */
function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

/**
 * 各个生命周期的合并策略，都是一样的
 */
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 * 合并conponent,filter等
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  /**
   * 以parentVal为原型创建对象,
   * 为什么要创建原型了，因为asset上面的配置都是公用的
   * 这样做可以节省内存，不用每个实例上都存有一份
   * 同时也能保证当前组件上找不到的asset的时候，可以继续向上从原型上找
   * 这也就是我们没有在当前组件上注册keep-alive组件
   * 却可以在任何组件里面使用，当然全局配置的directives， filters也是一样的
   */
  const res = Object.create(parentVal || null)
  if (childVal) {
    /**
     * 非生产环境下，如果遇到asset类型部位对象的会报错提示
     * 因为asset类型应该是对象
     */
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    // extend 就是把来源数据上的复制到当前目标对象上一份
    return extend(res, childVal)
  } else {
    return res
  }
}

/**
 * componets, filter等的合并策略是一样的
 */
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 * watcher合并策略
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  /**
   * 跳过原生的watch, Firefox's 上的问题
   */
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined

  /* istanbul ignore if */
  /**
   * 如果当前组件没有watch就使用以parentVal为原型创建的对象
   */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 * props，methods， computed, 合并策略是一样的
 * 如果来源没有，就直接使用当前的，
 * 如果来源有直接extend
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 * 默认的合并策略，逻辑很简单
 * 如果子选项存在（不是undefined）就使用子选项的配置，
 * 否则使用父选项
 * 
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 * 遍历组件名称一个个验证
 */
function checkComponents (options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}

/**
 * 验证组件的名称是否合法
 * @param {*} name 
 */
export function validateComponentName (name: string) {
  // 合法的html5标签
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  /**
   * 不能是内建标签slot,component
   * 以及html的保留标签div,span......
   */
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 * 规范化props的配置，props只能配置为字符串数组或者对象，
 * 其中对象形式，value可以是类型或者{ type: XXX }这种对象形式，
 * 无论是数组或者额对象形式最终都会处理成对象的形式， 如下
 * {
 *    foo: {
 *      type: XXX,
 *      defalut: xxx,
 *      validator：() => boolean
 *    }
 * }
 * 其中type是必须的，默认为null
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  /**
   * 如果是数组，遍历数组
   * 是字符串就camelize转换以后设置默认设置{ type: null }
   * 如果不是字符串需要报错提示，数组形式只能配置字符串
   * 例如：
   * ['foo', 'moo', 'xx-yy']
   * 会被处理成
   * {
   *    foo: { type: null },
   *    moo: { type: null },
   *    xxYy: { type: null },
   * }
   */
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    /**
     * 如果是对象，遍历对象key值
     * 先取出value值，然后对key值进行驼峰化，
     * 判断value值如果是普通对象就使用这个，
     * 如果不是普通对象说明是构造函数就包裹一下变成 { type: XXX }
     * 例如：
     * {
     *   foo: Array,
     *   moo: { type: Object },
     *   'xx-yy': { type: Boolean }
     * }
     * 会被处理成
     * {
     *    foo: { type: Array },
     *    moo: { type: Object },
     *    xxYy: { type: Boolean }
     * }
     */
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 * 规范化inject到对象形式
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  /**
   * 如果是数组形式，比如 ['foo', 'moo']
   * 最终会被处理成
   * [
   *  { from: 'foo' }，
   *  { from: 'moo' }
   * ]
   */
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    /**
     * 如果是对象形式
     * {
     *   foo: 'foo',
     *   moo: {
     *    noo: abc
     *   }
     * }
     * 最终会被处理成
     * {
     *    foo: { from: 'foo' },
     *    moo: { from: 'moo', noo: abc }
     * }
     * 
     * 这里对象配置的形式可能会存在 default 配置比如：
     * {
     *    moo: { from: 'moo', default: abc }
     * }
     * 当在初始化的时候如果没有从祖先组件找到相应的值
     * 就会使用默认值，
     */
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    /**
     * vue规定inject只能是字符串数组，或者对象形式
     * 其他类型会走到这里，在开发环境会报错提示
     */
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 * 指令规范化，如果直接配置的为函数，则转换成 { bind: def, update: def } 这种对象形式
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

/**
 * 断言对象类型，如果不是对象类型，就报错提示
 */
function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 * 会使用在实例额合并以及继承
 * ! 先进行规范化在进行合并配置项
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  // 组件名称是否合法
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  /**
   * ! 规范化
   * 使用 Vue.extend,child为子类的构造器，
   * 构造器上面有静态属性options,
   * 所以 child = child.options
   */
  if (typeof child === 'function') {
    child = child.options
  }

  /**
   * 规范化props,inject，directives
   * 规范化的目的是在外部提供灵活的多种使用方式，
   * 在这里进行处理以后，会得到统一格式的配置
   * 方便后面的使用，以避免多种使用方式带来的判断
   */
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  /**
   * 处理子组件的extends，mixins，但是不能是已经调用过mergeOptions返回的配置
   * 如果是被mergeOptions处理过的配置上面含有_base
   * 如果子组件存在这些属性把这些属性和parent个配置尽心merge
   * 得到新的配置对象作为parent
   */
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) { // 因为mixins是数组,所以进行遍历
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  /**
   * ! 合并
   * 合并策略的执行
   * 也是策略模式的执行器
   */
  const options = {}
  let key
  // 遍历parent的相应配置merge到options
  for (key in parent) {
    mergeField(key)
  }

  // 遍历child的相应配置merge到options
  for (key in child) {
    /**
     * 如果可已经在parent存在就不进行合并操作了
     * 因为上一步已经做过了，避免重复合并
     * 其实这一步是在合并那些在parent不存在的配置
     * 也就是child上比parent多的那部分配置
     */
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  // 策略的执行过程
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }

  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 * 取某种类型的属性值
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  /**
   * 会根据属性名的 原始名称，camelize化名称，capitalize化的名称
   * 在本身上寻找值，如果找不到就回退到原型链上寻找，如果还是找不到就报错提示
   * 从这里可以看出vue对于配置的处理还是很灵活的兼容了多种写法
   */
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
