/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  /**
   * 安装Vue插件
   * @param {*} plugin 
   */
  Vue.use = function (plugin: Function | Object) {
    /**
     * 先判断缓存里面，当前要安装的插件是不是已经被安装过了
     * 插件只能被安装一次，如果已经安装，就会直接返回
     */
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    // 如果是对象，必须包含install, install的参数Vue, 以及传入的对象
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
      // 如果插件是函数，直接被调用，参数同上
    } else if (typeof plugin === 'function') { 
      plugin.apply(null, args)
    }

    // 缓存已经安装的插件
    installedPlugins.push(plugin)
    return this
  }
}
