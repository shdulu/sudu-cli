# sudu-cli 前端统一研发脚手架

## About

前端项目开发脚手架

## Getting Started

### 安装：

```bash
npm install -g @sudu-cli/core
```

### 创建项目

项目/组件初始化

```bash
sudu-cli init 
```

强制清空当前文件夹

```bash
sudu-cli init --force
```

### 发布项目

发布项目/组件

```bash
sudu-cli publish
```

强制更新所有缓存

```bash
sudu-cli publish --force
```

正式发布

```bash
sudu-cli publish --prod
```

手动指定build命令

```bash
sudu-cli publish --buildCmd "npm run build:test"
```


## More

清空本地缓存：

```bash
sudu-cli clean
```

DEBUG 模式：

```bash
sudu-cli --debug
```

调试本地包：

```bash
sudu-cli init --packagePath /Users/sam/Desktop/sudu-cli/packages/init/
```
