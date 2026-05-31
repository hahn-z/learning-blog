---
title: "PHP数据格式处理：CSV与JSON与XML"
slug: "php-data-formats-csv-json-xml"
category: "文件与流"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "CSV", "JSON", "XML", "数据格式"]
---

# PHP数据格式处理：CSV与JSON与XML

## CSV处理

### fgetcsv/fputcsv

```php
<?php
// 写入CSV
$fp = fopen('users.csv', 'w');
// BOM头（让Excel正确识别UTF-8）
fprintf($fp, chr(0xEF) . chr(0xBB) . chr(0xBF));

fputcsv($fp, ['ID', '姓名', '邮箱', '金额'], ',', '"', '\\');
$users = [
    [1, '张三', 'zhang@example.com', 1500.50],
    [2, '李四', 'li@example.com', 2300.00],
    [3, '王五', 'wang@example.com', 980.75],
];
foreach ($users as $user) {
    fputcsv($fp, $user, ',', '"', '\\');
}
fclose($fp);

// 读取CSV
$fp = fopen('users.csv', 'r');
// 跳过BOM（如果有）
$bom = fread($fp, 3);
if ($bom !== chr(0xEF) . chr(0xBB) . chr(0xBF)) {
    rewind($fp); // 没有BOM，回退
}

$header = fputcsv($fp); // 读取表头 // ❌ fputcsv是写的，读用fgetcsv
// 修正：
$header = fgetcsv($fp);

while (($row = fgetcsv($fp, 0, ',', '"', '\\')) !== false) {
    $data[] = array_combine($header, $row);
}
fclose($fp);

// 处理CSV中的特殊字符
// CSV中包含逗号、换行、双引号的字段会用双引号包裹
// fgetcsv自动处理这些情况
```

### 大文件CSV流式处理

```php
<?php
// 逐行处理大CSV文件，内存占用恒定
function processLargeCsv(string $path, callable $callback, int $skipLines = 0): int
{
    $fp = fopen($path, 'r');
    if ($fp === false) {
        throw new RuntimeException("无法打开文件: {$path}");
    }

    // 跳过BOM
    $bom = fread($fp, 3);
    if ($bom !== "\xEF\xBB\xBF") {
        rewind($fp);
    }

    // 跳过指定行数（如表头）
    for ($i = 0; $i < $skipLines; $i++) {
        fgetcsv($fp);
    }

    $count = 0;
    while (($row = fgetcsv($fp)) !== false) {
        $callback($row, $count);
        $count++;
    }
    fclose($fp);

    return $count;
}

// 使用：批量导入数据库
$pdo = new PDO('mysql:host=localhost;dbname=test', 'root', '');
$pdo->beginTransaction();
$stmt = $pdo->prepare('INSERT INTO users (name, email, amount) VALUES (?, ?, ?)');

$count = processLargeCsv('big-export.csv', function ($row, $idx) use ($stmt) {
    $stmt->execute([$row[1], $row[2], $row[3]]);
    // 每1000条输出进度
    if (($idx + 1) % 1000 === 0) {
        echo "已处理 " . ($idx + 1) . " 条\n";
    }
}, skipLines: 1);

$pdo->commit();
echo "总计导入 {$count} 条记录";
```

## JSON处理

### json_encode/decode选项

```php
<?php
$data = [
    'name' => '张三',
    'age' => 25,
    'email' => null,
    'tags' => ['PHP', 'Go'],
    'price' => 99.90,
];

// 常用选项组合
$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
// {
//     "name": "张三",
//     "age": 25,
//     "email": null,
//     "tags": [
//         "PHP",
//         "Go"
//     ],
//     "price": 99.9
// }

// PHP 7.3+ JSON_THROW_ON_ERROR：异常代替返回false
try {
    $json = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
} catch (JsonException $e) {
    echo "JSON编码失败: " . $e->getMessage();
}

// 解码选项
$decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
// 第二个参数true返回数组，false返回stdClass

// 常用选项
// JSON_UNESCAPED_UNICODE     — 不转义Unicode（中文保持原样）
// JSON_PRETTY_PRINT          — 格式化输出
// JSON_UNESCAPED_SLASHES     — 不转义斜杠
// JSON_NUMERIC_CHECK        — 数字字符串转数字
// JSON_PRESERVE_ZERO_FRACTION — 1.0保持为1.0而不是1
// JSON_INVALID_UTF8_SUBSTITUTE — 替换无效UTF8字符
// JSON_PARTIAL_OUTPUT_ON_ERROR — 尽可能编码，忽略错误

// 深度控制（第3个参数，默认512）
$deep = json_decode($nestedJson, true, 32); // 最多嵌套32层

// 错误处理（不用异常的方式）
$json = json_encode($data);
if (json_last_error() !== JSON_ERROR_NONE) {
    throw new RuntimeException('JSON错误: ' . json_last_error_msg());
}
```

### JSON实战：API响应封装

```php
<?php
class JsonResponse
{
    public static function success(mixed $data = null, int $code = 200): never
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => true,
            'data' => $data,
            'timestamp' => time(),
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }

    public static function error(string $message, int $code = 400, string $errorCode = ''): never
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error' => ['code' => $errorCode, 'message' => $message],
            'timestamp' => time(),
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }
}

// 使用
JsonResponse::success(['users' => $users]);
JsonResponse::error('用户不存在', 404, 'USER_NOT_FOUND');
```

## XML处理

### SimpleXML vs DOMDocument

```php
<?php
$xml = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<catalog>
    <book id="1">
        <title>PHP核心编程</title>
        <author>张三</author>
        <price currency="CNY">89.00</price>
    </book>
    <book id="2">
        <title>Go语言实战</title>
        <author>李四</author>
        <price currency="CNY">69.00</price>
    </book>
</catalog>
XML;

// === SimpleXML：简单快速（适合读取） ===
$catalog = simplexml_load_string($xml);

foreach ($catalog->book as $book) {
    echo "ID: {$book['id']}\n";                 // 属性用数组语法
    echo "书名: {$book->title}\n";               // 子元素用对象属性
    echo "价格: {$book->price} ({$book->price['currency']})\n";
}

// 命名空间处理
// $catalog->registerXPathNamespace('ns', 'http://example.com/ns');
// $results = $catalog->xpath('//ns:book');

// 修改XML
$catalog->book[0]->price = '99.00';
echo $catalog->asXML(); // 输出修改后的XML


// === DOMDocument：强大完整（适合创建和修改） ===
$dom = new DOMDocument('1.0', 'UTF-8');
$dom->formatOutput = true;

$root = $dom->createElement('catalog');
$dom->appendChild($root);

$book = $dom->createElement('book');
$book->setAttribute('id', '1');

$title = $dom->createElement('title', 'PHP核心编程');
$book->appendChild($title);

$price = $dom->createElement('price', '89.00');
$price->setAttribute('currency', 'CNY');
$book->appendChild($price);

$root->appendChild($book);

echo $dom->saveXML();

// DOMDocument解析XML并修改
$dom = new DOMDocument();
$dom->loadXML($xml);
$books = $dom->getElementsByTagName('book');
foreach ($books as $book) {
    $price = $book->getElementsByTagName('price')->item(0);
    $oldPrice = (float)$price->textContent;
    $price->textContent = number_format($oldPrice * 1.1, 2); // 涨价10%
}
echo $dom->saveXML();
```

### 对比总结

| 特性 | SimpleXML | DOMDocument |
|------|-----------|-------------|
| 学习曲线 | 低 | 中 |
| 内存占用 | 较低 | 较高 |
| 适合场景 | 读取和简单修改 | 复杂的创建和修改 |
| XPath支持 | ✅ `xpath()` | ✅ `DOMXPath` |
| 命名空间 | `registerXPathNamespace` | 更完善的支持 |
| 验证 | 无 | XSD/DTD验证 |
| 推荐用途 | API响应解析 | XML文档生成 |

## 面试常见追问

**Q: JSON最大深度是多少？为什么需要限制？**
A: `json_decode`默认最大深度512层。限制是为了防止恶意构造的超深嵌套JSON导致栈溢出。实际项目中超过20层的嵌套基本就是恶意输入或设计问题。

**Q: SimpleXML和DOMDocument能互相转换吗？**
A: 可以。SimpleXML → DOM：`dom_import_simplexml($simpleXml)`；DOM → SimpleXML：`simplexml_import_dom($domNode)`。这让你可以在需要时切换两种API。

**Q: 如何处理CSV中中文乱码问题？**
A: 核心原因是编码不一致。解决方案：1) 写入时加UTF-8 BOM头（让Excel识别）；2) 读取时检测并跳过BOM；3) 如果源文件是GBK，用`mb_convert_encoding`转换。BOM是`\xEF\xBB\xBF`三个字节。
