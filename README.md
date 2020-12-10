<p align="center"><a href="https://vuejs.org" target="_blank" rel="noopener noreferrer"><img width="100" src="https://vuejs.org/images/logo.png" alt="Vue logo"></a></p>

# Vue源码解析
 
## 全局Api 
全局Api文件在`src/core/global-api`文件夹下，在`src/core/index.js`里通过`initGlobalAPI(Vue)`安装。<br>
`initGlobalAPI`在`core/global-api/index.js`里，主要包含以下部分
  - Object.defineProperty(Vue, 'config', configDef)`
  - Vue.util
  - Vue.set, Vue.delete, Vue.nextTick, Vue.observable
  - Vue.options, Vue.options._base = Vue
  - extend(Vue.options.components, builtInComponents)
  - initUse(Vue)
  - initMixin(Vue)
  - initExtend(Vue)
  - initAssetRegisters(Vue)


## 实例Api
实例Api文件分布在`src/core/instance`文件夹下，此目录下`index.js`文件引入了同级目录的其他文件的`xxxMixin`函数。<br>
`index.js`首先定义`Vue的构造函数`，然后通过调用`xxxMixin(Vue)`的方式在`Vue.prototype`上设置相应的实例方法以及属性。<br>
包含以下`mixin`
- initMixin `(挂载_init函数，也是实例化的入口函数)`
- stateMixin `(挂载操作数据相关的Api，eg: $set, $delete, $watch)`
- eventsMixin `(挂载事件相关的Api，eg: $on, $once, $off, $emit)`
- lifecycleMixin `(挂载生命周期相关的Api，eg: _update, $forceUpdate, $destroy)`
- renderMixin `(挂载渲染相关的Api，eg: $nextTick,_render)`

### initMixin
- _init
  - vm._uid = uid++
  - vm._isVue = true `(避免被响应式)`
  - 初始化$options 或者 初始化子组件
    ```javascript
      if (options && options._isComponent) {
        initInternalComponent(vm, options)
      } else {
        vm.$options = mergeOptions(...)
      }
    ```
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
    - vm._events = Object.create(null)
    - vm._hasHookEvent = false
    - updateComponentListeners
  - initRender
  - `callHook(vm, 'beforeCreate')`
  - initInjections
  - initState
    - initProps
    - initMethods
    - initData
    - initComputed
    - initWatch
  - initProvide
  - `callHook(vm, 'created')`
  - $mount

### stateMixin
- 代理$data -> this._data  
  `Object.defineProperty(Vue.prototype, '$data', function () { return this._data })`
- 代理$props -> this._props  
  `Object.defineProperty(Vue.prototype, '$data', function () { return this._props })`
- $set = set
- $delete = del
- $watch => unWatch

### eventsMixin 
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

### lifecycleMixin
- _update
- $forceUpdate
- $destroy
### renderMixin
- _render
- $nextTick
 
