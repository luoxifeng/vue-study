/* @flow */

/**
 * 
 * @param {*} node 
 * 判断是不是一个异步组件占位节点
 */
export function isAsyncPlaceholder (node: VNode): boolean {
  return node.isComment && node.asyncFactory
}
