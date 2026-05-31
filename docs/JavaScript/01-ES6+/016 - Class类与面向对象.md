---
title: "016 - Class类与面向对象"
slug: "016-js-class"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T14:15:10.886+08:00"
updated_at: "2026-04-29T10:02:46.191+08:00"
reading_time: 12
tags: []
---

# Class类与面向对象

> **难度：** ⭐⭐⭐ 中等 | **分类：** JavaScript 核心 | **阅读时间：** ~15分钟

## 一、概念讲解

JavaScript 的 `class` 是 ES6 引入的语法糖，本质仍基于原型链继承。它提供了更清晰、更接近传统面向对象语言的写法，让开发者可以用 `class`、`constructor`、`extends`、`super` 等关键字来组织代码。

核心概念：
- **类（Class）**：对象的蓝图/模板
- **构造函数（Constructor）**：实例化时自动调用的初始化方法
- **实例属性 vs 静态属性**：属于实例 vs 属于类本身
- **继承（extends）**：子类继承父类的属性和方法
- **多态**：子类重写父类方法

## 二、脑图（ASCII）

```
                Class 类与面向对象
                ┌──────┴──────┐
          基础语法          继承体系
         ┌──┴──┐        ┌───┴───┐
     constructor  extends   super
     实例方法      方法重写   父类构造
     静态方法      多态      Mixin混入
     getter/setter
         │
     私有字段 #field
     静态初始化块 static {}
```

## 三、完整 JS 代码

```javascript
// ==================== v2: Full-featured Class ====================

class Animal {
  // Private fields (ES2022)
  #name;
  #type;

  // Static property
  static count = 0;

  constructor(name, type) {
    this.#name = name;
    this.#type = type;
    Animal.count++;
  }

  // Getter — computed property
  get info() {
    return `${this.#name} (${this.#type})`;
  }

  // Setter — with validation
  set name(val) {
    if (!val || val.trim() === '') {
      throw new Error('Name cannot be empty');
    }
    this.#name = val.trim();
  }

  // Instance method
  speak() {
    return `${this.#name} makes a sound`;
  }

  // Static method
  static getCount() {
    return `Total animals: ${Animal.count}`;
  }
}

class Dog extends Animal {
  #breed;

  constructor(name, breed) {
    super(name, 'Dog'); // Must call super() first
    this.#breed = breed;
  }

  // Override parent method (polymorphism)
  speak() {
    return `${this.info} barks! Woof!`;
  }

  // Static method in subclass
  static createPuppy(name) {
    return new Dog(name, 'Mixed');
  }
}

// ==================== Usage ====================
const d1 = new Dog('Buddy', 'Golden Retriever');
console.log(d1.speak());        // Buddy (Dog) barks! Woof!
console.log(Animal.getCount()); // Total animals: 1

const d2 = Dog.createPuppy('Max');
console.log(d2.speak());        // Max (Dog) barks! Woof!
```

## 四、执行预览

```
Buddy (Dog) barks! Woof!
Total animals: 1
Max (Dog) barks! Woof!
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 类不会提升 | Class 声明不会被 hoisting，必须先定义后使用 |
| constructor 只能一个 | 一个类只能有一个 `constructor`，多了报 `SyntaxError` |
| super 必须在使用 this 前调用 | 子类构造函数中 `super()` 必须在访问 `this` 之前 |
| 私有字段用 `#` 前缀 | `#field` 是真正的私有，不可从外部访问 |
| 静态方法不可被实例调用 | `obj.staticMethod()` 会报错，只能 `ClassName.staticMethod()` |

## 六、避坑指南

❌ **错误写法：**
```javascript
class Foo {
  bar = 123;          // This is a class field, OK
  baz() {}            // Method, OK
  this.qux = 456;     // ❌ SyntaxError! No 'this' in class body
}
```

✅ **正确写法：**
```javascript
class Foo {
  bar = 123;

  constructor() {
    this.qux = 456;   // ✅ Assign in constructor
  }

  baz() {}
}
```

❌ **忘记调用 super：**
```javascript
class Child extends Parent {
  constructor() {
    this.name = 'test'; // ❌ ReferenceError: Must call super()
  }
}
```

✅ **正确写法：**
```javascript
class Child extends Parent {
  constructor() {
    super();            // ✅ Call super first
    this.name = 'test';
  }
}
```

## 七、练习题

🟢 **初级：** 创建一个 `Circle` 类，有 `radius` 属性和 `getArea()` 方法。

🟡 **中级：** 创建 `ElectricCar extends Car`，子类新增 `battery` 属性和 `charge()` 方法，重写 `drive()` 方法显示电量。

🔴 **高级：** 实现一个 `EventEmitter` 类，支持 `on(event, fn)`、`emit(event, ...args)`、`off(event, fn)`，并用静态方法实现单例模式。

## 八、知识点总结（树状）

```
JS Class
├── 基础
│   ├── constructor()
│   ├── 实例方法
│   ├── 静态方法/属性 (static)
│   └── getter / setter
├── 继承
│   ├── extends
│   ├── super()
│   ├── 方法重写 (override)
│   └── Object.getPrototypeOf()
├── 私有性
│   ├── # 私有字段 (ES2022)
│   ├── # 私有方法
│   └── WeakMap 模拟私有 (旧方案)
└── 高级
    ├── Mixin 模式
    ├── new.target
    └── Symbol.species
```

## 九、举一反三

| 场景 | 实现方式 | 关键点 |
|------|----------|--------|
| 单例模式 | `static #instance` + `static getInstance()` | 私有静态字段确保唯一 |
| 工厂模式 | `static create(type)` 返回不同子类 | 闭合开放原则 |
| Mixin | `Object.assign(Target.prototype, Mixin)` | 多继承模拟 |
| 链式调用 | 方法返回 `this` | jQuery 风格 API |
| 不可变类 | getter + `Object.freeze(this)` | 函数式友好 |

## 十、参考资料

- [MDN - Classes](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Classes)
- [ECMAScript Spec - Class Definitions](https://tc39.es/ecma262/#sec-class-definitions)
- [JavaScript.info - Classes](https://javascript.info/class)

## 十一、代码演进

```javascript
// v1: Constructor function (ES5 style)
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function() {
  return this.name + ' makes a sound';
};

// v2: ES6 Class syntax
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} makes a sound`;
  }
}

// v3: Full-featured with private fields, getters, inheritance
class Animal {
  #name;
  static count = 0;

  constructor(name) {
    this.#name = name;
    Animal.count++;
  }

  get info() { return this.#name; }

  speak() {
    return `${this.#name} makes a sound`;
  }
}

class Dog extends Animal {
  #breed;
  constructor(name, breed) {
    super(name);
    this.#breed = breed;
  }

  speak() {
    return `${this.info} barks!`;
  }
}
```
