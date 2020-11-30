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
  - $on
  - $once
  - $off
  - $emit
- lifecycleMixin

- renderMixin

## initMixin
- _init
  - 初始化$options
  - 代理实例initProxy
  - initLifecycle
    - 子组件向上寻找最近的非抽象组件（就是找父组件）
    - 向父组件$children添加自己 `（注意：父组件的$children里的值是在子组件添加的）`
    - 设置$parent `（根组件没有$parent）`
    - 设置$root `（根组件$root为自己，注意：当前组件的$root是从父组件层层承接过来的）`
    - 初始化一些实例上的值
      - vm.$children = []
      - vm.$refs = {}
      - vm._watcher = null
      - vm._inactive = null
      - vm._directInactive = false
      - vm._isMounted = false
      - vm._isDestroyed = false
      - vm._isBeingDestroyed = false
  - initEvents
    - updateComponentListeners
  - initRender
  - callHook-beforeCreate
  - initInjections
  - initState
    - initProps
    - initMethods
    - initData
    - initComputed
    - initWatch
  - initProvide
  - callHook-created
  - $mount

## stateMixin
- 代理$data -> this._data
- 代理$props -> this._props
- $set = set
- $delete = del
- $watch => unWatch

## other
 - initComputed
 - reactive
 - computed
 - Watcher
 - provide & inject
 - slot & scopedSlot
 - $watch & $delete
 - v-model
 - keep-alive
 - component
 - filters

## eventsMixin 
- $on (vm._events在initEvents中初始化)
  1. event名称如果为数组，遍历执行vm.$on
  2. vm._events\[event\].push(fn)
  ```
  如果event是/^hook:/,设置vm._hasHookEvent = true,
  在callHooks的时候，如果_hasHookEvent === true，会从_events找到hook的生命周期执行
  ```
- $once
- $off
- $emit

## lifecycleMixin

## renderMixin
 
