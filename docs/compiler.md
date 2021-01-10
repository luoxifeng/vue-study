# Compiler
parse(template) --> ast --> generate(ast, state) --> code --> { render: code }

## generate
- genElement
  - genChilden
- genChilden
- genNode
  - genElement

## slot
- 编译阶段
  - slot
  - scopedSlots
- 运行时阶段
  - 子组件初始化
  - render
  
