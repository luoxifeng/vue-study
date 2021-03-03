// Full spec-compliant TodoMVC with localStorage persistence
// and hash-based routing in ~150 lines.
/* eslint-disable */
// localStorage persistence
var STORAGE_KEY = 'todos-vuejs-2.0'

// Vue.prototype.$on('hook:beforeMount', () => {
//   alert()
// })
var mytest = {
  model: {
    event: 'inputs'
  },
  props: ['hh', 'd'],
  mixins: [{
    props: ['foo'],
    data() {
      return {}
    },
  }],
  data() {
    // debugger
    return {
      s: 1551,
      k: {
        ds: 123
      },
      
    };
  },
  computed: {
    ll() {
      return this.s + 1
    },
  },
  created() {
    window.mytest = this;
    console.warn('child mytest created')
  },
  beforeMount() {
    console.warn('child mytest beforeMount')
  },
  mounted() {
    console.warn('child mytest mounted')
  },
  template: `
    <div class="blog-post" >
      <h3>{{ s }}</h3>
      <h3>{{ d }}</h3>
      <slot name="asc" />
      <slot name="asd" v-bind="k" kk="123"/>
    </div>
  `
}
// var com = Vue.component('mytest', mytest)

// Vue.component('mytest2', mytest)

// Vue.component('sss', {
//   template: `
//     <div class="blog" >
//     </div>
//   `,
//   beforeMount() {
//     console.warn('sss sss beforeMount')
//   },
//   mounted() {
//     console.warn('sss sss mounted')
//   },

// })

var app = new Vue({
  mixins: [{
    props: ['foo'],
    data() {
      return {}
    },
  }],
  props: ['ddd'],
  data: {
    a: {
      b: {
        k: [ ],
        c: {
          d: 11
        }
      },
      c: [{}]
    },
    d: 1258,
    kk: 'asd',
    hoo: [() => {}],
    hook: {
      insert: [() => {}]
    },
    cls: {
      'teststatic': true
    }
  },
  components: {
    mytest
  },
  // watch todos change for localStorage persistence
  // watch: {
  //   "a.b.c": {
  //     handler: function (val) {
  //       console.log(val)
  //     },
  //     // deep: true
  //   }
  // },

  // computed properties
  // https://vuejs.org/guide/computed.html
  computed: {
    b() {
      return this.a.b.k
    },
  },
  created() {
    this.a.s = 10
    console.warn('root component created')
    // this._hasHookEvent = 1
    // this._events['hook:beforeMount'] = [() => {
    //   debugger
    //   console.log('hook:beforeMount')
    // }]
    // this.$on('hook:mounted', () => {
    //   debugger
    //   console.log('hook:mounted');
    // })
  },
  beforeMount() {
    console.warn('root component beforeMount')
  },
  mounted() {
    console.warn('root component mounted')
  },
  filters: {
    pluralize: function (n) {
      return n === 1 ? 'item' : 'items'
    }
  },

  // methods that implement data logic.
  // note there's no DOM manipulation here at all.
  methods: {
    foo() {},
    moo() {}
  },

  // a custom directive to wait for the DOM to be updated
  // before focusing on the input field.
  // https://vuejs.org/guide/custom-directive.html
  directives: {
    'todo-focus': function (el, binding) {
      if (binding.value) {
        el.focus()
      }
    }
  },
  // render(h) {
  //   return h(
  //     cfg, 
  //     { 
  //       attrs: { ff: 123 },
  //       hook: {
  //         insert(){}
  //       }
  //     }
  //   )
  // }
})

app.$mount('.todoapp')

window.app = app;
