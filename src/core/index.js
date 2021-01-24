import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

/**
 * 传入Vue构造函数
 * 在构造函数上面挂载一些全局api以及全局配置
 * 方便实例里面在用到的便于访问
 */
initGlobalAPI(Vue)

/**
 * 是不是服务端渲染
 */
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

/**
 * 服务端渲染上下文
 */
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

/**
 * Vue 版本
 * 在编译输出的时候__VERSION__会被替换成Vue当前的版本
 */
Vue.version = '__VERSION__'

export default Vue
