<p align="center"><a href="https://vuejs.org" target="_blank" rel="noopener noreferrer"><img width="100" src="https://vuejs.org/images/logo.png" alt="Vue logo"></a></p>

# Vue源码解析 
 
 
## mixin
- initMixin
  - _init
- stateMixin
  - 代理$data
  - 代理$props
  - $set
  - $delete
  - $watch 
- eventsMixin
- lifecycleMixin
- renderMixin

## initMixin
- _init
  - 初始化$options
  - 代理实例initProxy
  - initLifecycle
  - initEvents
  - initRender
  - callHook-beforeCreate
  - initInjections
  - initState
  - initProvide
  - callHook-created
  - $mount

## stateMixin
- 代理$data -> this._data
- 代理$props -> this._props
- $set = set
- $delete = del
- $watch => unWatch

 - initState
 - initComputed
 - reactive
 - computed
 - Watcher
 - provide & inject
 - slot & scopedSlot
 - $watch & $delete
 - $on & $off & $once & $emit
 - v-model
 - keep-alive
 - component
 - filters
## eventsMixin 
- $on
- $once
- $off
- $emit
 
