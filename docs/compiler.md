# Compiler
parse(template) --> ast --> generate(ast, state) --> code --> { render: code }

## generate
- genElement
  - genChilden
- genChilden
- genNode
  - genElement