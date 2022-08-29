const { request } = require("@sudu-cli/utils");

module.exports = function () {
  return request({
    url: "/mock/26/api/templates",
  });
};
