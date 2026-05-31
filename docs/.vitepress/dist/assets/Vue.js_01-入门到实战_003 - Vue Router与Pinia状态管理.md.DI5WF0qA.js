import{c as i,Q as a,j as n,m as t}from"./chunks/framework.DboXgrwk.js";const g=JSON.parse('{"title":"003 - Vue Router与Pinia状态管理","description":"","frontmatter":{"title":"003 - Vue Router与Pinia状态管理","slug":"003-vue3-router-pinia","category":"Vue.js入门到实战","tech_stack":"Vue.js","created_at":"2026-04-26T10:22:36.39+08:00","updated_at":"2026-04-29T10:02:46.479+08:00","reading_time":25,"tags":["前端"],":v-pre":null},"headers":[],"relativePath":"Vue.js/01-入门到实战/003 - Vue Router与Pinia状态管理.md","filePath":"Vue.js/01-入门到实战/003 - Vue Router与Pinia状态管理.md","lastUpdated":1780196272000}'),l={name:"Vue.js/01-入门到实战/003 - Vue Router与Pinia状态管理.md"};function e(p,s,h,k,r,d){return a(),n("div",null,[...s[0]||(s[0]=[t(`<hr><h1 id="vue-router与pinia状态管理" tabindex="-1">Vue Router与Pinia状态管理 <a class="header-anchor" href="#vue-router与pinia状态管理" aria-label="Permalink to &quot;Vue Router与Pinia状态管理&quot;">​</a></h1><blockquote><p>📊 <strong>难度：中级</strong> | 🏷️ Vue.js 3.x | ⏱️ 阅读约 25 分钟</p></blockquote><hr><h2 id="📖-概念讲解" tabindex="-1">📖 概念讲解 <a class="header-anchor" href="#📖-概念讲解" aria-label="Permalink to &quot;📖 概念讲解&quot;">​</a></h2><p>Vue Router和Pinia是Vue 3生态的两大核心库，分别负责路由管理和状态管理。</p><p><strong>Vue Router 4 核心概念：</strong></p><table tabindex="0"><thead><tr><th>概念</th><th>说明</th></tr></thead><tbody><tr><td>路由配置</td><td><code>createRouter</code> + 路由表定义</td></tr><tr><td>动态路由</td><td><code>/user/:id</code> 参数化路径</td></tr><tr><td>嵌套路由</td><td>子路由在父路由的<code>&lt;router-view&gt;</code>中渲染</td></tr><tr><td>导航守卫</td><td><code>beforeEach</code>等钩子控制路由跳转</td></tr><tr><td>懒加载</td><td><code>() =&gt; import(&#39;./View.vue&#39;)</code> 按需加载</td></tr></tbody></table><p><strong>Pinia 核心概念：</strong></p><p>Pinia是Vue 3官方推荐的状态管理库，替代Vuex。</p><table tabindex="0"><thead><tr><th>概念</th><th>说明</th></tr></thead><tbody><tr><td>Store</td><td>状态容器，通过<code>defineStore</code>定义</td></tr><tr><td>State</td><td>存储数据（类似data）</td></tr><tr><td>Getters</td><td>派生数据（类似computed）</td></tr><tr><td>Actions</td><td>方法（同步+异步都支持）</td></tr><tr><td>Plugins</td><td>扩展功能（持久化、日志等）</td></tr></tbody></table><p><strong>Pinia vs Vuex：</strong></p><table tabindex="0"><thead><tr><th>特性</th><th>Pinia</th><th>Vuex</th></tr></thead><tbody><tr><td>Mutations</td><td>无（Actions直接改）</td><td>必须通过Mutations</td></tr><tr><td>TypeScript</td><td>完美支持</td><td>需要大量类型声明</td></tr><tr><td>模块化</td><td>天然多Store</td><td>需要modules配置</td></tr><tr><td>体积</td><td>~1KB</td><td>~6KB</td></tr><tr><td>Composition API</td><td>原生支持</td><td>需要额外API</td></tr></tbody></table><p><strong>路由与状态协作：</strong></p><p>典型场景：路由守卫中检查Pinia store的登录状态，未登录跳转登录页。</p><h2 id="🧠-知识脑图" tabindex="-1">🧠 知识脑图 <a class="header-anchor" href="#🧠-知识脑图" aria-label="Permalink to &quot;🧠 知识脑图&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Vue Router + Pinia</span></span>
<span class="line"><span>├── Vue Router</span></span>
<span class="line"><span>│   ├── createRouter / createWebHistory</span></span>
<span class="line"><span>│   ├── 路由配置 (routes)</span></span>
<span class="line"><span>│   ├── 动态路由 /user/:id</span></span>
<span class="line"><span>│   ├── 嵌套路由 children</span></span>
<span class="line"><span>│   ├── 导航守卫</span></span>
<span class="line"><span>│   │   ├── beforeEach (全局)</span></span>
<span class="line"><span>│   │   ├── beforeEnter (路由级)</span></span>
<span class="line"><span>│   │   └── onBeforeRouteLeave (组件级)</span></span>
<span class="line"><span>│   ├── 懒加载 () =&gt; import()</span></span>
<span class="line"><span>│   └── useRoute / useRouter</span></span>
<span class="line"><span>├── Pinia</span></span>
<span class="line"><span>│   ├── defineStore</span></span>
<span class="line"><span>│   ├── State → 数据</span></span>
<span class="line"><span>│   ├── Getters → 派生</span></span>
<span class="line"><span>│   ├── Actions → 方法</span></span>
<span class="line"><span>│   ├── storeToRefs → 解构</span></span>
<span class="line"><span>│   └── 插件 (持久化等)</span></span>
<span class="line"><span>└── 协作模式</span></span>
<span class="line"><span>    ├── 守卫检查登录状态</span></span>
<span class="line"><span>    ├── 路由参数驱动store</span></span>
<span class="line"><span>    └── action后跳转路由</span></span></code></pre></div><h2 id="💻-完整代码" tabindex="-1">💻 完整代码 <a class="header-anchor" href="#💻-完整代码" aria-label="Permalink to &quot;💻 完整代码&quot;">​</a></h2><div class="language-vue vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">vue</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">&lt;!-- RouterPiniaDemo.vue - Combined demo --&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">template</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">div</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> class</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;demo&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;!-- Navigation --&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">nav</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> to</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;/&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;Home&lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> to</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;/about&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;About&lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> to</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;/users&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;Users&lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> to</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;/admin&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;Admin&lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-link</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">button</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> @</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">click</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">=</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">authStore.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">toggleLogin</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        {{ authStore.isLoggedIn </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">?</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;Logout&#39;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> :</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;Login&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }}</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      &lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">button</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    &lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">nav</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;!-- Route view --&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    &lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">router-view</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> /&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  &lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">div</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">template</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">&lt;!--</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  === router.js - Route Configuration ===</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { createRouter, createWebHistory } from &#39;vue-router&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // Lazy-loaded route components</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  const routes = [</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    { path: &#39;/&#39;, name: &#39;Home&#39;, component: () =&gt; import(&#39;./views/Home.vue&#39;) },</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    { path: &#39;/about&#39;, name: &#39;About&#39;, component: () =&gt; import(&#39;./views/About.vue&#39;) },</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      path: &#39;/users&#39;,</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      name: &#39;Users&#39;,</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      component: () =&gt; import(&#39;./views/Users.vue&#39;),</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      children: [</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        // Nested route with dynamic param</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        { path: &#39;:id&#39;, name: &#39;UserDetail&#39;, component: () =&gt; import(&#39;./views/UserDetail.vue&#39;) }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      ]</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    },</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      path: &#39;/admin&#39;,</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      name: &#39;Admin&#39;,</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      component: () =&gt; import(&#39;./views/Admin.vue&#39;),</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      // Route-level guard: check auth</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      beforeEnter: (to, from, next) =&gt; {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        const auth = useAuthStore()</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        auth.isLoggedIn ? next() : next(&#39;/?redirect=admin&#39;)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  ]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  const router = createRouter({</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    history: createWebHistory(),</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    routes</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  })</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // Global navigation guard</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  router.beforeEach((to, from) =&gt; {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const auth = useAuthStore()</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    if (to.meta.requiresAuth &amp;&amp; !auth.isLoggedIn) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      return { path: &#39;/&#39;, query: { redirect: to.fullPath } }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  })</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  export default router</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">--&gt;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">&lt;!--</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  === stores/auth.js - Auth Store ===</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { defineStore } from &#39;pinia&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { ref, computed } from &#39;vue&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  export const useAuthStore = defineStore(&#39;auth&#39;, () =&gt; {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // State</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const user = ref(null)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const token = ref(&#39;&#39;)</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // Getters</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const isLoggedIn = computed(() =&gt; !!token.value)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const userName = computed(() =&gt; user.value?.name || &#39;Guest&#39;)</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // Actions</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    function login(userData, userToken) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      user.value = userData</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      token.value = userToken</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      localStorage.setItem(&#39;token&#39;, userToken)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    function logout() {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      user.value = null</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      token.value = &#39;&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      localStorage.removeItem(&#39;token&#39;)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    function toggleLogin() {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      if (isLoggedIn.value) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        logout()</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      } else {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        login({ id: 1, name: &#39;Admin&#39;, role: &#39;admin&#39; }, &#39;mock-jwt-token&#39;)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    return { user, token, isLoggedIn, userName, login, logout, toggleLogin }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  })</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">--&gt;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">&lt;!--</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  === stores/user.js - User Store ===</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { defineStore } from &#39;pinia&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { ref, computed } from &#39;vue&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  export const useUserStore = defineStore(&#39;users&#39;, () =&gt; {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const users = ref([</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      { id: 1, name: &#39;Alice&#39;, email: &#39;alice@demo.com&#39;, role: &#39;admin&#39; },</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      { id: 2, name: &#39;Bob&#39;, email: &#39;bob@demo.com&#39;, role: &#39;user&#39; },</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      { id: 3, name: &#39;Charlie&#39;, email: &#39;charlie@demo.com&#39;, role: &#39;user&#39; }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    ])</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const userCount = computed(() =&gt; users.value.length)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    const admins = computed(() =&gt; users.value.filter(u =&gt; u.role === &#39;admin&#39;))</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    function getUserById(id) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      return users.value.find(u =&gt; u.id === Number(id))</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    function addUser(user) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      users.value.push({ ...user, id: Date.now() })</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    function removeUser(id) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      users.value = users.value.filter(u =&gt; u.id !== id)</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    return { users, userCount, admins, getUserById, addUser, removeUser }</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  })</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">--&gt;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">&lt;!--</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  === views/Home.vue ===</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;template&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;h1&gt;Home&lt;/h1&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;p&gt;Welcome! Logged in: {{ authStore.isLoggedIn ? authStore.userName : &#39;No&#39; }}&lt;/p&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;p&gt;Total users in store: {{ userStore.userCount }}&lt;/p&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;/template&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;script setup&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { useAuthStore } from &#39;../stores/auth&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { useUserStore } from &#39;../stores/user&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  const authStore = useAuthStore()</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  const userStore = useUserStore()</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;/script&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">--&gt;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">&lt;!--</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  === views/UserDetail.vue - Dynamic route ===</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;template&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;div v-if=&quot;user&quot;&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      &lt;h2&gt;{{ user.name }}&lt;/h2&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      &lt;p&gt;Email: {{ user.email }}&lt;/p&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">      &lt;p&gt;Role: {{ user.role }}&lt;/p&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;/div&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;p v-else&gt;User not found&lt;/p&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    &lt;router-link to=&quot;/users&quot;&gt;Back to Users&lt;/router-link&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;/template&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;script setup&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { useRoute } from &#39;vue-router&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { useUserStore } from &#39;../stores/user&#39;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  import { computed } from &#39;vue&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  const route = useRoute()</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  const userStore = useUserStore()</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  const user = computed(() =&gt; userStore.getUserById(route.params.id))</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  &lt;/script&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">--&gt;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&lt;</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">script</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> setup</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Simplified inline demo of Pinia store pattern</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { ref, computed, reactive } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;vue&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Simulated auth store</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> authStore</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> reactive</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  user: </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">ref</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">null</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  token: </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">ref</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  isLoggedIn: </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">computed</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(() </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> false</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">),</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">  toggleLogin</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">() {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    this</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">.token </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> this</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">.token </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">?</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;&#39;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> :</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;mock-jwt&#39;</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    this</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">.user </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> this</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">.token </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">?</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { name: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;Admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> null</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&lt;/</span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">script</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt;</span></span></code></pre></div><h2 id="👀-执行预览" tabindex="-1">👀 执行预览 <a class="header-anchor" href="#👀-执行预览" aria-label="Permalink to &quot;👀 执行预览&quot;">​</a></h2><p><strong>页面渲染效果：</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>[Home] [About] [Users] [Admin]  [Login]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--- Home Page ---</span></span>
<span class="line"><span>Welcome! Logged in: No</span></span>
<span class="line"><span>Total users in store: 3</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--- 点击Login后 ---</span></span>
<span class="line"><span>[Home] [About] [Users] [Admin]  [Logout]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--- Users Page ---</span></span>
<span class="line"><span>• Alice (alice@demo.com) - admin  [View]</span></span>
<span class="line"><span>• Bob (bob@demo.com) - user       [View]</span></span>
<span class="line"><span>• Charlie (charlie@demo.com) - user [View]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--- /users/1 (动态路由) ---</span></span>
<span class="line"><span>Alice</span></span>
<span class="line"><span>Email: alice@demo.com</span></span>
<span class="line"><span>Role: admin</span></span>
<span class="line"><span>[Back to Users]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--- 未登录访问Admin ---</span></span>
<span class="line"><span>自动跳转到首页，URL: /?redirect=/admin</span></span></code></pre></div><h2 id="⚠️-注意事项" tabindex="-1">⚠️ 注意事项 <a class="header-anchor" href="#⚠️-注意事项" aria-label="Permalink to &quot;⚠️ 注意事项&quot;">​</a></h2><table tabindex="0"><thead><tr><th>注意点</th><th>说明</th><th>建议</th></tr></thead><tbody><tr><td>History模式</td><td>需要服务器配置回退</td><td>开发用history，部署配置fallback</td></tr><tr><td>懒加载</td><td>大型应用必须按路由拆分</td><td><code>() =&gt; import(&#39;./View.vue&#39;)</code></td></tr><tr><td>Pinia解构</td><td>直接解构失去响应性</td><td>用<code>storeToRefs(store)</code>解构</td></tr><tr><td>守卫异步</td><td>beforeEach支持async</td><td>适合检查远程登录状态</td></tr><tr><td>路由meta</td><td>携带路由元信息</td><td>用于权限判断、页面标题等</td></tr><tr><td>Store命名</td><td>defineStore第一个参数唯一</td><td>推荐文件名即store名</td></tr></tbody></table><h2 id="🚫-避坑指南" tabindex="-1">🚫 避坑指南 <a class="header-anchor" href="#🚫-避坑指南" aria-label="Permalink to &quot;🚫 避坑指南&quot;">​</a></h2><h3 id="_1-解构pinia-store失去响应性" tabindex="-1">1. 解构Pinia Store失去响应性 <a class="header-anchor" href="#_1-解构pinia-store失去响应性" aria-label="Permalink to &quot;1. 解构Pinia Store失去响应性&quot;">​</a></h3><p>❌ <strong>错误：</strong> <code>const { users, userCount } = useUserStore()</code> ✅ <strong>正确：</strong> <code>const { users, userCount } = storeToRefs(useUserStore())</code></p><h3 id="_2-路由404" tabindex="-1">2. 路由404 <a class="header-anchor" href="#_2-路由404" aria-label="Permalink to &quot;2. 路由404&quot;">​</a></h3><p>❌ <strong>错误：</strong> History模式部署后刷新页面404 ✅ <strong>正确：</strong> 服务器配置所有路径回退到index.html</p><h3 id="_3-在pinia-action中忘记异步" tabindex="-1">3. 在Pinia Action中忘记异步 <a class="header-anchor" href="#_3-在pinia-action中忘记异步" aria-label="Permalink to &quot;3. 在Pinia Action中忘记异步&quot;">​</a></h3><p>❌ <strong>错误：</strong> <code>async function fetchUsers()</code> 但调用时不await ✅ <strong>正确：</strong> <code>await userStore.fetchUsers()</code> 或<code>.then()</code></p><h3 id="_4-路由守卫死循环" tabindex="-1">4. 路由守卫死循环 <a class="header-anchor" href="#_4-路由守卫死循环" aria-label="Permalink to &quot;4. 路由守卫死循环&quot;">​</a></h3><p>❌ <strong>错误：</strong> beforeEach中<code>next(&#39;/login&#39;)</code>又触发守卫 ✅ <strong>正确：</strong> 判断目标路由避免循环：<code>if (to.path !== &#39;/login&#39;) next(&#39;/login&#39;)</code></p><h3 id="_5-v-for中用router-link" tabindex="-1">5. v-for中用router-link <a class="header-anchor" href="#_5-v-for中用router-link" aria-label="Permalink to &quot;5. v-for中用router-link&quot;">​</a></h3><p>❌ <strong>错误：</strong> <code>&lt;div v-for=&quot;item in list&quot;&gt;&lt;router-link :to=&quot;item.path&quot;&gt;&lt;/router-link&gt;&lt;/div&gt;</code> ✅ <strong>正确：</strong> <code>&lt;router-link&gt;</code>可以作为li的父元素或用programmatic navigation</p><h2 id="🧪-练习题" tabindex="-1">🧪 练习题 <a class="header-anchor" href="#🧪-练习题" aria-label="Permalink to &quot;🧪 练习题&quot;">​</a></h2><h3 id="🟢-基础题" tabindex="-1">🟢 基础题 <a class="header-anchor" href="#🟢-基础题" aria-label="Permalink to &quot;🟢 基础题&quot;">​</a></h3><ol><li>配置3个路由（Home/About/Contact），实现导航和页面切换。</li><li>创建一个Pinia store管理购物车（items数组、addItem、removeItem、total）。</li></ol><h3 id="🟡-进阶题" tabindex="-1">🟡 进阶题 <a class="header-anchor" href="#🟡-进阶题" aria-label="Permalink to &quot;🟡 进阶题&quot;">​</a></h3><ol start="3"><li>实现带权限的路由守卫：未登录访问/admin跳转/login，登录后跳回原页面。</li><li>创建一个<code>useProductStore</code>，包含从API获取产品列表的异步action，配合loading状态。</li></ol><h3 id="🔴-挑战题" tabindex="-1">🔴 挑战题 <a class="header-anchor" href="#🔴-挑战题" aria-label="Permalink to &quot;🔴 挑战题&quot;">​</a></h3><ol start="5"><li>实现一个完整的用户管理系统：列表页、详情页、编辑页，路由+Pinia联动，支持增删改查。</li></ol><h2 id="📝-知识点总结" tabindex="-1">📝 知识点总结 <a class="header-anchor" href="#📝-知识点总结" aria-label="Permalink to &quot;📝 知识点总结&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Vue Router + Pinia</span></span>
<span class="line"><span>├── Vue Router</span></span>
<span class="line"><span>│   ├── routes配置</span></span>
<span class="line"><span>│   ├── 动态参数 /:id</span></span>
<span class="line"><span>│   ├── 嵌套路由 children</span></span>
<span class="line"><span>│   ├── 导航守卫 beforeEach</span></span>
<span class="line"><span>│   ├── 懒加载 () =&gt; import()</span></span>
<span class="line"><span>│   └── useRoute / useRouter</span></span>
<span class="line"><span>├── Pinia</span></span>
<span class="line"><span>│   ├── defineStore(&#39;name&#39;, setup)</span></span>
<span class="line"><span>│   ├── State → ref/reactive</span></span>
<span class="line"><span>│   ├── Getters → computed</span></span>
<span class="line"><span>│   ├── Actions → function</span></span>
<span class="line"><span>│   ├── storeToRefs解构</span></span>
<span class="line"><span>│   └── Plugins持久化</span></span>
<span class="line"><span>└── 协作</span></span>
<span class="line"><span>    ├── 守卫查登录</span></span>
<span class="line"><span>    ├── 参数驱动store</span></span>
<span class="line"><span>    └── action后跳转</span></span></code></pre></div><h2 id="🔄-举一反三" tabindex="-1">🔄 举一反三 <a class="header-anchor" href="#🔄-举一反三" aria-label="Permalink to &quot;🔄 举一反三&quot;">​</a></h2><table tabindex="0"><thead><tr><th>概念</th><th>生活类比</th><th>说明</th></tr></thead><tbody><tr><td>Vue Router</td><td>地图导航</td><td>URL是地址，路由是路线</td></tr><tr><td>路由守卫</td><td>保安检查</td><td>到达目的地前先检查权限</td></tr><tr><td>动态路由</td><td>快递单号</td><td>同一模板，不同数据</td></tr><tr><td>懒加载</td><td>即时配送</td><td>需要时才发货</td></tr><tr><td>Pinia Store</td><td>仓库</td><td>所有组件共享的数据中心</td></tr><tr><td>Getters</td><td>仓库管理员</td><td>按需取货、整理归类</td></tr><tr><td>Actions</td><td>采购员</td><td>去外部(API)进货</td></tr></tbody></table><h2 id="📚-参考资料" tabindex="-1">📚 参考资料 <a class="header-anchor" href="#📚-参考资料" aria-label="Permalink to &quot;📚 参考资料&quot;">​</a></h2><ol><li><a href="https://router.vuejs.org/" target="_blank" rel="noreferrer">Vue Router 4 文档</a></li><li><a href="https://pinia.vuejs.org/" target="_blank" rel="noreferrer">Pinia 文档</a></li><li><a href="https://router.vuejs.org/guide/advanced/lazy-loading.html" target="_blank" rel="noreferrer">Vue 3 路由懒加载</a></li><li><a href="https://prazdevs.github.io/pinia-plugin-persistedstate/" target="_blank" rel="noreferrer">Pinia 持久化插件</a></li></ol><h2 id="🚀-代码演进" tabindex="-1">🚀 代码演进 <a class="header-anchor" href="#🚀-代码演进" aria-label="Permalink to &quot;🚀 代码演进&quot;">​</a></h2><h3 id="v1-基础路由配置" tabindex="-1">v1 - 基础路由配置 <a class="header-anchor" href="#v1-基础路由配置" aria-label="Permalink to &quot;v1 - 基础路由配置&quot;">​</a></h3><div class="language-js vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">js</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { createRouter, createWebHistory } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;vue-router&#39;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> router</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> createRouter</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  history: </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">createWebHistory</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  routes: [</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: Home },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/about&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: About }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  ]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div><h3 id="v2-动态路由-守卫" tabindex="-1">v2 - 动态路由 + 守卫 <a class="header-anchor" href="#v2-动态路由-守卫" aria-label="Permalink to &quot;v2 - 动态路由 + 守卫&quot;">​</a></h3><div class="language-js vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">js</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> routes</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> [</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/user/:id&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: UserDetail, beforeEnter: checkAuth }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">router.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">beforeEach</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">((</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">to</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">from</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> auth</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> useAuthStore</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  auth.isLoggedIn </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">?</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">() </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/login&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div><h3 id="v3-完整router-pinia架构" tabindex="-1">v3 - 完整Router + Pinia架构 <a class="header-anchor" href="#v3-完整router-pinia架构" aria-label="Permalink to &quot;v3 - 完整Router + Pinia架构&quot;">​</a></h3><div class="language-js vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">js</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// router.js - lazy load + guards</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> routes</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> [</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">component</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: () </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;./views/Home.vue&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">component</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: () </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;./views/Admin.vue&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    meta: { requiresAuth: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// stores/auth.js - Pinia setup syntax</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">export</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> useAuthStore</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> defineStore</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;auth&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, () </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> token</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> ref</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(localStorage.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">getItem</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;token&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">))</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> isLoggedIn</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> computed</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(() </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> !!</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">token.value)</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  async</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> function</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> login</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">credentials</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    const</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">data</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> api.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">post</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/login&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, credentials)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    token.value </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> data.token</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    localStorage.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">setItem</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;token&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, data.token)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  return</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { token, isLoggedIn, login }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div>`,55)])])}const c=i(l,[["render",e]]);export{g as __pageData,c as default};
