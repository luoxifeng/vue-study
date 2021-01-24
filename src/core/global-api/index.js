/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

// 安装全局api
export function initGlobalAPI (Vue: GlobalAPI) {

  /**
   * 在构造函数上定义全局的配置Vue.config
   * Vue在这里做了一层代理，是通过config访问的内部的配置
   * 只可以访问，但是不可以直接覆盖，在非生产环境下会报错提醒
   * 其实可以看到Vue整个源代码里面会出现多次这种方式
   * 在暴露访问内部变量的时候，会做一层代理，提供统一的访问方式
   * 同时设置set函数来阻止使用者在外部直接修改变量，以保证内部变量不被污染
   */
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  /**
   * 下面的api，虽然挂载到全局变量下，
   * 但是Vue提醒这些api并不是暴露的公用api,
   * 所以避免在项目中依赖这些api,
   * 当然你依然是可以使用他们的，只是需要明白使用他们的风险
   * 建议能不用就不要用
   */
  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  /**
   * 设置全局set,delete,nextTick方法
   */
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // Vue.observable = <T>(obj: T): T => {
  //   observe(obj)
  //   return obj
  // }

  /**
   * 2.6开始暴露observable函数
   * 把一个对象变成响应式对象
   */
  Vue.observable = obj => {
    observe(obj)
    return obj
  }

  /**
   * 初始化全局的
   * components, directives, filters
   */
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // 配置内建的组件
  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
