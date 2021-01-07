// Full spec-compliant TodoMVC with localStorage persistence
// and hash-based routing in ~150 lines.
/* eslint-disable */
// localStorage persistence
var STORAGE_KEY = 'todos-vuejs-2.0'

// Vue.prototype.$on('hook:beforeMount', () => {
//   alert()
// })
var cfg = {
  props: ['hh', 'd'],
  data() {
    // debugger
    return {
      s: 1551
    };
  },
  computed: {
    ll() {
      return this.s + 1
    },
  },
  created() {
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
      <h3>{{ $attrs.value }}</h3>
      <h3>{{ d.join('-') }}</h3>
    </div>
  `
}
var com = Vue.component('mytest', cfg)

Vue.component('ytest2', cfg)


var app = new Vue({
  data: {
    a: {
      b: {
        k: [],
        c: {
          d: 11
        }
      }
    },
    d: [1, 2]
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
  mixins: [
    {
      created() {

      }
    }
  ],

  filters: {
    pluralize: function (n) {
      return n === 1 ? 'item' : 'items'
    }
  },

  // methods that implement data logic.
  // note there's no DOM manipulation here at all.
  methods: {
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
  }
})

app.$mount('.todoapp')

window.app = app;
