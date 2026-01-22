# Android 应用发布流程

## 发布新版本

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: 新功能描述"

# 2. 创建版本 tag 并推送
git tag v1.0.1
git push origin master --tags
```

推送 tag 后，GitHub Actions 会自动：
1. 构建 Release APK
2. 上传 APK 到你的服务器
3. 更新服务器上的 version.json

## GitHub Secrets 配置

在仓库 Settings -> Secrets and variables -> Actions 中添加：

| Secret 名称 | 说明 |
|------------|------|
| `KEYSTORE_BASE64` | Keystore 文件的 base64 编码: `base64 -i release.keystore` |
| `KEYSTORE_PASSWORD` | Keystore 密码 |
| `KEYSTORE_ALIAS` | Key 别名 |
| `KEYSTORE_ALIAS_PASSWORD` | Key 密码 |
| `UPLOAD_SERVER_URL` | 你的服务器 API 地址，如 `https://api.your-server.com` |
| `UPLOAD_SERVER_TOKEN` | 服务器认证 Token |
| `UPDATE_CHECK_URL` | 版本检查 API 地址 |
| `DOWNLOAD_URL` | 下载基础 URL |

## 服务器端 API 示例

你的服务器需要实现两个接口：

### 1. 上传 APK 接口

```
POST /upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <apk文件>
version: 1.0.1
```

### 2. 更新版本信息接口

```
POST /version
Authorization: Bearer <token>
Content-Type: application/json

{
  "tag_name": "v1.0.1",
  "version": "1.0.1",
  "html_url": "https://your-server.com/download/shadowhour-v1.0.1.apk",
  "body": "更新说明"
}
```

### 3. 版本查询接口 (供 App 调用)

```
GET /api/app/version.json

响应:
{
  "tag_name": "v1.0.1",
  "version": "1.0.1",
  "html_url": "https://your-server.com/download/shadowhour-v1.0.1.apk",
  "body": "## 更新内容\n- 新增xxx功能\n- 修复xxx问题"
}
```

## Node.js 服务器示例

```javascript
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const VERSION_FILE = './version.json';
const DOWNLOAD_DIR = './downloads';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// 认证中间件
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// 上传 APK
app.post('/upload', auth, upload.single('file'), (req, res) => {
  const version = req.body.version;
  const filename = `shadowhour-v${version}.apk`;
  const destPath = path.join(DOWNLOAD_DIR, filename);

  fs.renameSync(req.file.path, destPath);
  res.json({ success: true, filename });
});

// 更新版本信息
app.post('/version', auth, express.json(), (req, res) => {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// 查询版本 (App 调用)
app.get('/api/app/version.json', (req, res) => {
  if (fs.existsSync(VERSION_FILE)) {
    res.json(JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8')));
  } else {
    res.json({ tag_name: 'v1.0.0', version: '1.0.0' });
  }
});

// 下载 APK
app.use('/download', express.static(DOWNLOAD_DIR));

app.listen(3000);
```

## 版本号规范

- `v1.0.0` - 初始版本
- `v1.0.1` - Bug 修复 (patch)
- `v1.1.0` - 新功能 (minor)
- `v2.0.0` - 重大更新 (major)
