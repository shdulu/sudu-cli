"use strict";

const log = require("./log");
const locale = require("./Locale/loadLocale");
const npm = require("./npm");
const request = require("./request");
const Package = require("./Package");
const inquirer = require("./inquirer");
const spinner = require("./spinner");
const ejs = require("./ejs");
const formatPath = require("./formatPath");

function sleep(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

function execAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const p = exec(command, args, options);
    p.on("error", (e) => {
      reject(e);
    });
    p.on("exit", (c) => {
      resolve(c);
    });
  });
}

function exec(command, args, options) {
  const win32 = process.platform === "win32";
  const cmd = win32 ? "cmd" : command;
  const cmdArgs = win32 ? ["/c"].concat(command, args) : args;
  return require("child_process").spawn(cmd, cmdArgs, options || {});
}

function camelTrans(str, isBig) {
  let i = isBig ? 0 : 1;
  str = str.split("-");
  for (; i < str.length; i += 1) {
    str[i] = firstUpperCase(str[i]);
  }
  return str.join("");
}
function firstUpperCase(str) {
  return str.replace(/^\S/, (s) => s.toUpperCase());
}
function formatName(name) {
  if (name) {
    name = `${name}`.trim();
    if (name) {
      if (/^[.*_\/\\()&^!@#$%+=?<>~`\s]/.test(name)) {
        name = name.replace(/^[.*_\/\\()&^!@#$%+=?<>~`\s]+/g, "");
      }
      if (/^[0-9]+/.test(name)) {
        name = name.replace(/^[0-9]+/, "");
      }
      if (/[.*_\/\\()&^!@#$%+=?<>~`\s]/.test(name)) {
        name = name.replace(/[.*_\/\\()&^!@#$%+=?<>~`\s]/g, "-");
      }
      return camelTrans(name, true);
    } else {
      return name;
    }
  } else {
    return name;
  }
}

function formatClassName(name) {
  return require("kebab-case")(name).replace(/^-/, "");
}

module.exports = {
  log,
  request,
  locale,
  npm,
  Package,
  exec,
  inquirer,
  spinner,
  sleep,
  ejs,
  formatName,
  formatClassName,
  formatPath,
  execAsync
};
