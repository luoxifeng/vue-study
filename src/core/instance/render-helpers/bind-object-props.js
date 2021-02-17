/* @flow */

import config from 'core/config'

import {
  warn,
  isObject,
  toObject,
  isReservedAttribute,
  camelize,
  hyphenate
} from 'core/util/index'

/**
 * Runtime helper for merging v-bind="object" into a VNode's data.
 * 使用v-bind绑定的值，在内部会被处理到
 * data或者data.attrs或者data.domProps上面
 */
export function bindObjectProps (
  data: any,
  tag: string,
  value: any,
  asProp: boolean,
  isSync?: boolean
): VNodeData {
  if (value) {
    if (!isObject(value)) {
      process.env.NODE_ENV !== 'production' && warn(
        'v-bind without argument expects an Object or Array value',
        this
      )
    } else {
      if (Array.isArray(value)) {
        value = toObject(value)
      }
      let hash
      for (const key in value) {
        /**
         * 如果key是class，style,以及保留属性
         * 直接扩展到data上面
         */
        if (
          key === 'class' ||
          key === 'style' ||
          isReservedAttribute(key)
        ) {
          hash = data
        } else {
          /**
           * 如果key值不是上述的值，则根据asProp，config.mustUseProp来决定
           * v-bind的值扩展到哪里，
           */
          const type = data.attrs && data.attrs.type
          hash = asProp || config.mustUseProp(tag, type, key)
            ? data.domProps || (data.domProps = {})
            : data.attrs || (data.attrs = {})
        }

        /**
         * v-bind绑定的key值，经过camelize，hyphenate后
         * 不能与扩展目标对象上已有的属性重名
         * 否则不会扩招到目标对象上
         */
        const camelizedKey = camelize(key)
        const hyphenatedKey = hyphenate(key)
        if (!(camelizedKey in hash) && !(hyphenatedKey in hash)) {
          hash[key] = value[key]

          /**
           * 如果设置了同步，注册事件回调
           */
          if (isSync) {
            const on = data.on || (data.on = {})
            on[`update:${key}`] = function ($event) {
              value[key] = $event
            }
          }
        }
      }
    }
  }
  return data
}
