"use strict";

const fs = require("fs");
const fse = require("fs-extra");
const getProjectTemplate = require("./getProjectTemplate");
const {
  log,
  inquirer,
  spinner,
  Package,
  sleep,
  exec,
  formatName,
  formatClassName,
  ejs,
} = require("@sudu-cli/utils");

const COMPONENT_FILE = ".componentrc";
const TYPE_PROJECT = "project";
const TYPE_COMPONENT = "component";
const TEMPLATE_TYPE_NORMAL = "normal";
const TEMPLATE_TYPE_CUSTOM = "custom";

const DEFAULT_TYPE = TYPE_PROJECT; // 默认包类型 project

async function init(options) {
  try {
    // 设置 targetPath
    let targetPath = process.cwd(); // 当前命令执行目录
    if (!options.targetPath) {
      options.targetPath = targetPath;
    }
    // 完成项目初始化的准备和校验工作
    const result = await prepare(options);
    if (!result) {
      log.info("创建项目终止");
      return;
    }
    // 获取项目模板列表
    const { templateList, project } = result;
    // 缓存项目模板文件
    const template = await downloadTemplate(templateList, options);
    log.verbose("template", template);
    if (template.type === TEMPLATE_TYPE_NORMAL) {
      // 安装项目模板
      await installTemplate(template, project, options);
    } else if (template.type === TEMPLATE_TYPE_CUSTOM) {
      // 安装自定义项目模板
      await installCustomTemplate(template, project, options);
    } else {
      throw new Error("未知的模板类型！");
    }
  } catch (error) {
    if (options.debug) {
      log.error("Error:", error.stack);
    } else {
      log.error("Error:", error.message);
    }
  } finally {
    process.exit(0);
  }
}

async function installCustomTemplate(template, ejsData, options) {
  const pkgPath = path.resolve(template.sourcePath, "package.json");
  const pkg = fse.readJsonSync(pkgPath);
  const rootFile = path.resolve(template.sourcePath, pkg.main);
  if (!fs.existsSync(rootFile)) {
    throw new Error("入口文件不存在！");
  }
  log.notice("开始执行自定义模板");
  const targetPath = options.targetPath;
  await execCustomTemplate(rootFile, {
    targetPath,
    data: ejsData,
    template,
  });
  log.success("自定义模板执行成功");
}

function execCustomTemplate(rootFile, options) {
  const code = `require('${rootFile}')(${JSON.stringify(options)})`;
  return new Promise((resolve, reject) => {
    const p = exec("node", ["-e", code], { stdio: "inherit" });
    p.on("error", (e) => {
      reject(e);
    });
    p.on("exit", (c) => {
      resolve(c);
    });
  });
}

// 如果是组件项目，则创建组件相关文件
async function createComponentFile(template, data, dir) {
  const componentData = {
    ...data,
    buildPath: template.buildPath,
    examplePath: template.examplePath,
    npmName: template.npmName,
    npmVersion: template.version,
  };
  const componentFile = path.resolve(dir, COMPONENT_FILE);
  fs.writeFileSync(componentFile, JSON.stringify(componentData));
}

async function installTemplate(template, ejsData, options) {
  // 安装模板
  let spinnerStart = spinner(`正在安装模板...`);
  await sleep(1000);
  const sourceDir = template.path;
  const targetDir = options.targetPath; // --targetPath ||  process.cwd
  fse.ensureDirSync(sourceDir); // 确保目录存在
  fse.ensureDirSync(targetDir);
  fse.copySync(sourceDir, targetDir); // copy 缓存模板到 当前命令执行目录
  spinnerStart.stop(true);
  log.success("模板安装成功");
  // ejs 模板渲染
  const ejsIgnoreFiles = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.vscode/**",
    "**/.DS_Store",
    "**/README.md",
    "**/public/**",
  ];
  if (template.ignore) {
    ejsIgnoreFiles.push(...template.ignore);
  }
  log.verbose("ejsData", ejsData);
  await ejs(targetDir, ejsData, {
    ignore: ejsIgnoreFiles,
  });
  if (template.tag === TYPE_COMPONENT) {
    // 如果是组件，则进行特殊处理
    await createComponentFile(template, ejsData, targetDir);
  }
  // 安装依赖文件
  log.notice("开始安装依赖");
  await npminstall(targetDir);
  log.success("依赖安装成功");
}

async function npminstall() {
  return new Promise((resolve, reject) => {
    const p = exec(
      "npm",
      ["install", "--registry=https://registry.npm.taobao.org"],
      {
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );
    p.on("error", (e) => {
      reject(e);
    });
    p.on("exit", (c) => {
      resolve(c);
    });
  });
}

async function downloadTemplate(templateList, options) {
  // 用户交互选择
  const templateName = await inquirer({
    choices: createTemplateChoice(templateList),
    message: "请选择项目模板",
  });

  log.verbose("template", templateName);
  const selectedTemplate = templateList.find(
    (item) => item.npmName === templateName
  );

  log.verbose("selected template", selectedTemplate);
  const { cliHome } = options; // C:\Users\Administrator\.sudu-cli
  const targetPath = path.resolve(cliHome, "template"); // C:\Users\Administrator\.sudu-cli\template
  // 基于模板生成 Package 对象
  const templatePkg = new Package({
    targetPath,
    storePath: targetPath,
    name: selectedTemplate.npmName,
    version: selectedTemplate.version,
  });
  // 如果模板不存在则进行下载
  if (!(await templatePkg.exists())) {
    let spinnerStart = spinner(`正在下载模板...`);
    await sleep(1000);
    await templatePkg.install();
    spinnerStart.stop(true);
    log.success("下载模板成功");
  } else {
    log.notice(
      "模板已存在",
      `${selectedTemplate.npmName}@${selectedTemplate.version}`
    );
    log.notice("模板路径", `${targetPath}`);
    let spinnerStart = spinner(`开始更新模板...`);
    await sleep(1000);
    await templatePkg.update();
    spinnerStart.stop(true);
    log.success("更新模板成功");
  }
  // 生成模板路径
  const templateSourcePath = templatePkg.npmFilePath;
  const templatePath = path.resolve(templateSourcePath, "template");
  log.verbose("template path", templatePath);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`[${templateName}]项目模板不存在！`);
  }
  const template = {
    ...selectedTemplate,
    path: templatePath,
    sourcePath: templateSourcePath,
  };
  return template;
}

async function prepare(options) {
  // 1. 判断当前目录是否为空
  const localPath = process.cwd();
  let continueWhenDirNotEmpty = true;
  if (!isDirEmpty(localPath)) {
    // 目录不为空询问是否继续创建
    if (!options.force) {
      continueWhenDirNotEmpty = await inquirer({
        type: "confirm",
        message: "当前文件夹不为空，是否继续创建项目？",
        defaultValue: false,
      });
      if (!continueWhenDirNotEmpty) return;
    }
    // 是否启动强制更新
    if (continueWhenDirNotEmpty || options.force) {
      const targetDir = options.targetPath;
      const confirmEmptyDir = await inquirer({
        type: "confirm",
        message: "是否确认清空当下目录下的文件",
        defaultValue: false,
      });
      if (confirmEmptyDir) {
        fse.emptyDirSync(targetDir);
      }
    }
  }
  let initType = await getInitType();
  let resultData = await getProjectTemplate();
  
  let templateList = resultData.list || [];
  if (!templateList || templateList.length === 0) {
    throw new Error("项目模板列表获取失败");
  }

  let projectName = "";
  let className = "";
  let version = "1.0.0";
  while (!projectName) {
    projectName = await getProjectName(initType);
    if (projectName) {
      projectName = formatName(projectName);
      className = formatClassName(projectName);
    }
    log.verbose("name", projectName);
    log.verbose("className", className);
  }
  do {
    version = await getProjectVersion(version, initType);
    log.verbose("version", version);
  } while (!version);

  if (initType === TYPE_PROJECT) {
    templateList = templateList.filter((item) => item.tag.includes("project"));
    return {
      templateList,
      project: {
        name: projectName,
        className,
        version,
      },
    };
  } else {
    templateList = templateList.filter((item) =>
      item.tag.includes("component")
    );
    let description = "";
    while (!description) {
      description = await getComponentDescription();
      log.verbose("description", description);
    }
    return {
      templateList,
      project: {
        name: projectName,
        className,
        version,
        description,
      },
    };
  }
}

function getInitType() {
  return inquirer({
    type: "list",
    choices: [
      {
        name: "项目",
        value: TYPE_PROJECT,
      },
      {
        name: "组件",
        value: TYPE_COMPONENT,
      },
    ],
    message: "请选择初始化类型",
    defaultValue: DEFAULT_TYPE,
  });
}

function getProjectName(initType) {
  return inquirer({
    type: "string",
    message: initType === TYPE_PROJECT ? "请输入项目名称" : "请输入组件名称",
    defaultValue: "",
  });
}

function getProjectVersion(defaultVersion, initType) {
  return inquirer({
    type: "string",
    message:
      initType === TYPE_PROJECT ? "请输入项目版本号" : "请输入组件版本号",
    defaultValue: defaultVersion,
  });
}

function getComponentDescription() {
  return inquirer({
    type: "string",
    message: "请输入组件的描述信息",
    defaultValue: "",
  });
}

function createTemplateChoice(list) {
  return list.map((item) => ({
    value: item.npmName,
    name: item.name,
  }));
}

function isDirEmpty(localPath) {
  let fileList = fs.readdirSync(localPath); // 当前目录下 文件列表
  fileList = fileList.filter(
    (file) => !file.startsWith(".") && !["node_modules"].includes(file)
  );
  return !fileList || fileList.length <= 0;
}

module.exports = init;
