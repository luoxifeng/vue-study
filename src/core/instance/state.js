/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

/**
 * 共享的配置，为了性能，避免创建多次
 */
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/**
 * 
 * @param {*} target 
 * @param {*} sourceKey 
 * @param {*} key 
 * 代理数据的访问
 */
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  /**
   * 把对数据sourceKey上的数据访问，代理到当前实例上
   * vue会把_data，_props上的数据代理到当前对象上
   * 已达到属性都可以使用当前实例访问到，提供统一的访问方式
   */
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * @param {*} vm 
 * 初始化状态
 */
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options

  // 初始化props
  if (opts.props) initProps(vm, opts.props)

  // 初始化methods
  if (opts.methods) initMethods(vm, opts.methods)

  // 初始化data
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }

  // 初始化computed
  if (opts.computed) initComputed(vm, opts.computed)

  // 初始化watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent

  /**
   * 避免深度响应式，因为props是从父组件传进来
   * 已经在父组件进行响应式处理过了
   */
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }

  /**
   * 之所以在父组件改变了传入子组件的简单类型的prop
   * 引起子组件重新渲染的原因是
   * 1.在父组件赋值引起父组件重新渲染，导致子组件的props对应的值需要重新赋值
   * 2.同时子组件内部对props做了响应式处理，下面就是
   * 所以子组件在对本身的props赋值的时候引起了自身的重新渲染
   * 具体代码在updateChildComponent里面会update props
   * 主要做的是从父组件传入的props,赋值给本身的props,
   * 本身的props又是响应式的，所以重新渲染
   */
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production' ) {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }0
  toggleObserving(true)
}

/**
 * 
 * @param {*} vm 
 * 初始化data
 */
function initData (vm: Component) {
  /**
   * 如果data属性是函数，就调用getData返回结果
   * 如果不是函数，可能是对象或者其他类型，同时做了空值容错
   * 把得到的结果赋值给_data, 从这里可以看出，我们取data的值都是从_data上面取的
   * 但是_data是一个内部属性，不建议直接使用，所以vue对_data上面的值做了一层代理
   * 就是下面的proxy(vm, `_data`, key)，这也是我们直接在实例上能取到值的原因
   */
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  
  /**
   * 经过处理后的data如果不是纯对象，会把data赋值为对象
   * 同时在非生产环境下会警告提示
   */
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  /**
   * 遍历data的key值，代理data的属性到实例上
   */
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    /**
     * methods上有同名的属性，报警提示
     */
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }

    /**
     * props有同名的属性，这个属性就不会代理到实例上
     * 同时在非生产环境下报警提示
     */
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      /**
       * 经过上面判断以后，key还需要满足不是 $ _ 开头
       */
      proxy(vm, `_data`, key)
    }
  }

  // 进行响应式处理
  // observe data
  observe(data, true /* asRootData */)
}

/**
 * 
 * @param {*} data 
 * @param {*} vm 
 * 初始化data, 在$options.data是函数的情况下
 * 这里有个奇怪的点就是，pushTarget， popTarget
 * 注释里面写了是为了解决 #7573 这个问题，关于这个问题的解释
 * 在callHook函数那里做了分析
 */
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

/**
 * 
 * @param {*} vm 
 * @param {*} methods 
 * 初始化methods
 */
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props

  /**
   * 遍历methods，把方法都赋值到实例上
   * 同时对方法都绑定了this, 保证了方法以任何方式调用的时候this指向当前的实例
   * 避免方法在传递过程中，搞不清this的情况
   */
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      /**
       * methods上的值必须是函数，否则非生产环境报警提示
       */
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }

      /**
       * props上有同名的属性，报警提示
       */
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }

      /**
       * 方法名和实例上 $ 或者 _ 开头的方法重复了，报警提示
       */
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    
    /**
     * 最后把方法绑定了上下文赋值到实例上，
     * 如果不是函数就赋值一个空函数，来保证methods上的值是函数
     * 避免运行时，当做函数调用的事出错
     */
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  /**
   * 代理内部属性的访问
   * 使用$data代理_data
   * 使用$props代理_props
   * 他们都是只读属性，在开发环境下，更改他们会提示报错
   * 调用这个函数的时候,只是去代理了数据的访问，其实_data，_props
   * 在这个时候还没有定义，当实例化以后才会存在，
   * 那个时候再去访问，就是有值的了，
   * 这里只是定义访问的代理，至于为什么要这么做，而不是直接访问
   * 1.如果后期内部名称变动的时候，外部的访问方式依然不会变，保持api的兼容性
   * 2.直接访问，我们在书写的时候，可能会不小心直接更改了，做层代理相当于增加一层保障
   *  在我们直接去修的时候，非生产环境下，进入set函数会提示我们不能修改
   */
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }

  /**
   * 代理_data，_props的访问
   */
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
