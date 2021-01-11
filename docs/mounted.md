# mounted

## vue 如何实现 `mounted` 由子组件到父组件调用？
- mount
- _update
- __patch__
  `vnode.data.pendingInsert是当前组件vnode收集到的子组件的组件vnode集合`
  `insertedVnodeQueue-xxx`代表编号,源码里面只有`insertedVnodeQueue`

  - 在组件 __patch__ 阶段，会创建一个队列 `insertedVnodeQueue-1 = []`，
  - 在遇到需要实例化子组件的时候，传入 `insertedVnodeQueue-1`，子组件在patch阶段也会创建自己的`insertedVnodeQueue-2`, 传入它的子组件，去收收集组件节点
  - 子组件在创建并且mount完成以后, 会把自己创建的`insertedVnodeQueue-2` 赋值给 `vnode.data.pendingInsert`
  - 子组件再把 `vnode.data.pendingInsert` 合并到父组件传入的 `insertedVnodeQueue-1` 里面
  - 子组件节点同时把本身添加进父组件传入的 `insertedVnodeQueue-1` 里面
  - 流程回到上一级组件mount，当前组件会把自己创建的 `insertedVnodeQueue-1` 赋值给 `vnode.data.pendingInsert`, 
  - 当前组件会按照上述流程, 把从子组件收集的到的集合也就是`vnode.data.pendingInsert`，合并到父组件传入的`insertedVnodeQueue`,同时也添加本身进去
  - 流程再回到上一层组件，按照相同的流程，一直到根组件，也就是vue根实例
  
  从上述流程可以看出，这是一个递归的过程，父组件创建一个队列，用来保存组件节点，传入子组件的构建过程，一直到最深层，没有子组件为止，最深层次的组件会完成整个mount过程，同时会把自己的vnode，以及下一层（非最深层）的组件vnode，添加到父组件传入的队列里面， 然后流程回到父组件mount阶段，父组件会按照相同的流程，把收集到的子孙vnode以及自身vnode添加到上一层组件的队列，流程继续退回，一直到根组件，此时根组件收集到所有的组件vnode, 然后根组件把真实dom插入文档，再遍历所有的节点，找到节点的组件实例`vnode.componentInstance`，调用 `callHook(componentInstance, 'mounted')`，最后在调用根实例的`mounted`钩子

  递归保证了属于一个树上面的最深的组件 `mounted` 在最前面，流程退回的时候又保证了 `mounted` 满足从子到父的依次执行，但 vue 在 `mounted` 的时候，是一次把整个dom树添加到文档的。
